import { afterEach, describe, expect, test, vi } from 'vitest';

import { runGenerateCommand } from '../src/commands/generate.js';
import type { ExtractedItem } from '../src/core/crosslistCore.js';
import { generateMarketplaceListings } from '../src/core/crosslistCore.js';

const readyItem: ExtractedItem = {
  attributes: {
    brand: 'Sony',
    color: 'Black',
    model: 'WM-FX195',
  },
  category: 'portable cassette player',
  condition: 'very good',
  description: 'Working Sony Walkman cassette player with headphones and battery door intact.',
  missingFields: [],
  title: 'Sony WM-FX195 Walkman Cassette Player with Headphones',
  uncertainties: [],
};

describe('runGenerateCommand', () => {
  afterEach(() => {
    delete process.env.CROSSLIST_API_BASE_URL;
  });

  test('renders combined human + JSON output from a JSON input file', async () => {
    const result = await runGenerateCommand(
      {
        input: 'example.json',
        output: 'both',
      },
      {
        fetchImpl: vi.fn(async () => toApiResponse(generateMarketplaceListings(readyItem, ['ebay', 'mercari']))) as any,
        readTextFile: async () =>
          JSON.stringify({
            extractedItem: readyItem,
            marketplaces: ['ebay', 'mercari'],
          }),
      }
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('eBay');
    expect(result.output).toContain('"status": "ready"');
    expect(result.result.listings).toHaveLength(2);
  });

  test('uses the output format declared inside a JSON input file when no CLI override is provided', async () => {
    const result = await runGenerateCommand(
      {
        input: 'example.json',
      },
      {
        fetchImpl: vi.fn(async () => toApiResponse(generateMarketplaceListings(readyItem, ['ebay']))) as any,
        readTextFile: async () =>
          JSON.stringify({
            extractedItem: readyItem,
            marketplaces: ['ebay'],
            output: 'json',
          }),
      }
    );

    expect(result.exitCode).toBe(0);
    expect(result.output.trim().startsWith('{')).toBe(true);
    expect(result.output).toContain('"marketplace": "ebay"');
    expect(result.output).not.toContain('"humanReadable"');
  });

  test('lets CLI marketplaces override the marketplaces declared inside a JSON input file', async () => {
    const fetchImpl = vi.fn(async () => toApiResponse(generateMarketplaceListings(readyItem, ['ebay'])));

    const result = await runGenerateCommand(
      {
        input: 'example.json',
        marketplaces: 'ebay',
      },
      {
        fetchImpl: fetchImpl as any,
        readTextFile: async () =>
          JSON.stringify({
            extractedItem: readyItem,
            marketplaces: ['ebay', 'mercari'],
          }),
      }
    );

    expect(result.exitCode).toBe(0);
    expect(result.result.listings.map((listing) => listing.marketplace)).toEqual(['ebay']);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const firstCall = fetchImpl.mock.calls[0] as unknown as [string | URL, { body?: string | null }];
    expect(JSON.parse(String(firstCall[1]?.body))).toMatchObject({
      marketplaces: ['ebay'],
    });
  });

  test('defaults to JSON output for non-interactive runs when no output is specified', async () => {
    const result = await runGenerateCommand(
      {
        input: 'example.json',
      },
      {
        fetchImpl: vi.fn(async () => toApiResponse(generateMarketplaceListings(readyItem, ['ebay']))) as any,
        readTextFile: async () =>
          JSON.stringify({
            extractedItem: readyItem,
            marketplaces: ['ebay'],
          }),
      }
    );

    expect(result.output.trim().startsWith('{')).toBe(true);
    expect(result.output).toContain('"status": "ready"');
    expect(result.output).not.toContain('"humanReadable"');
  });

  test('returns non-zero and machine-readable JSON when review is still needed', async () => {
    const result = await runGenerateCommand(
      {
        images: ['https://example.com/item.jpg'],
        output: 'json',
      },
      {
        fetchImpl: vi.fn(async () =>
          toApiResponse(
            generateMarketplaceListings(
              {
                ...readyItem,
                missingFields: ['condition'],
              },
              ['ebay', 'mercari', 'facebook-marketplace', 'craigslist', 'tcgplayer']
            )
          )
        ) as any,
      }
    );

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toMatchObject({
      status: 'needs_input',
    });
    expect(result.output).not.toContain('"humanReadable"');
  });

  test('runs the interactive review flow before generating output', async () => {
    const reviewer = vi.fn(async (item: ExtractedItem) => ({
      ...item,
      condition: 'like new' as const,
      missingFields: [],
      uncertainties: [],
    }));
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        toApiResponse(
          generateMarketplaceListings(
            {
              ...readyItem,
              condition: 'good',
              missingFields: ['condition'],
              uncertainties: ['condition'],
            },
            ['ebay']
          )
        )
      )
      .mockResolvedValueOnce(
        toApiResponse(
          generateMarketplaceListings(
            {
              ...readyItem,
              condition: 'like new',
              missingFields: [],
              uncertainties: [],
            },
            ['ebay']
          )
        )
      );

    const result = await runGenerateCommand(
      {
        interactive: true,
        marketplaces: 'ebay',
        output: 'text',
      },
      {
        collectInputs: async () => ({
          imageUrls: ['https://example.com/item.jpg'],
          marketplaces: ['ebay'],
        }),
        fetchImpl: fetchImpl as any,
        reviewer,
      }
    );

    expect(reviewer).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Status: ready');
  });

  test('rejects local file paths because image extraction is URL-only in v1', async () => {
    await expect(
      runGenerateCommand(
        {
          images: ['./item.jpg'],
        },
        {
          fetchImpl: vi.fn() as any,
        }
      )
    ).rejects.toThrow('Image extraction is URL-only in v1. Provide hosted image URLs instead of local file paths.');
  });

  test('rejects an empty interactive marketplace selection instead of silently selecting all marketplaces', async () => {
    await expect(
      runGenerateCommand(
        {
          interactive: true,
        },
        {
          collectInputs: async () => ({
            imageUrls: ['https://example.com/item.jpg'],
            marketplaces: [],
          }),
          fetchImpl: vi.fn() as any,
        }
      )
    ).rejects.toThrow('Select at least one marketplace.');
  });

  test('returns needs_input instead of throwing when interactive review clears required tcg fields', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        toApiResponse(
          generateMarketplaceListings(
            {
              attributes: {
                game: 'Pokemon',
                set: 'Jungle',
              },
              category: 'Pokemon card',
              condition: 'like new',
              description: 'Near mint Jolteon holo card from Jungle.',
              missingFields: [],
              tcg: {
                cardName: 'Jolteon',
                cardNumber: '4/64',
                foil: true,
                game: 'Pokemon',
                language: 'English',
                rarity: 'Rare Holo',
                set: 'Jungle',
              },
              title: 'Jolteon 4/64 Jungle Rare Holo Pokemon Card',
              uncertainties: [],
            },
            ['tcgplayer']
          )
        )
      )
      .mockResolvedValueOnce(
        toApiResponse(
          generateMarketplaceListings(
            {
              attributes: {
                game: 'Pokemon',
                set: 'Jungle',
              },
              category: 'Pokemon card',
              condition: 'like new',
              description: 'Near mint Jolteon holo card from Jungle.',
              missingFields: ['tcg.cardName', 'tcg.game', 'tcg.set'],
              title: 'Jolteon 4/64 Jungle Rare Holo Pokemon Card',
              uncertainties: [],
            },
            ['tcgplayer']
          )
        )
      );

    const result = await runGenerateCommand(
      {
        interactive: true,
        output: 'json',
      },
      {
        collectInputs: async () => ({
          imageUrls: ['https://example.com/item.jpg'],
          marketplaces: ['tcgplayer'],
        }),
        fetchImpl: fetchImpl as any,
        reviewer: async (item) => ({
          ...item,
          missingFields: ['tcg.cardName', 'tcg.game', 'tcg.set'],
          tcg: undefined,
          uncertainties: [],
        }),
      }
    );

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.output)).toMatchObject({
      status: 'needs_input',
    });
  });

  test('rejects invalid marketplace names instead of silently dropping them', async () => {
    await expect(
      runGenerateCommand(
        {
          images: ['https://example.com/item.jpg'],
          marketplaces: 'ebay,invalid-marketplace',
        },
        {
          fetchImpl: vi.fn() as any,
        }
      )
    ).rejects.toThrow('Invalid marketplaces: invalid-marketplace');
  });

  test('rejects invalid marketplace names even when using a JSON input file', async () => {
    await expect(
      runGenerateCommand(
        {
          input: 'example.json',
          marketplaces: 'invalid-marketplace',
        },
        {
          fetchImpl: vi.fn() as any,
          readTextFile: async () =>
            JSON.stringify({
              extractedItem: readyItem,
              marketplaces: ['ebay'],
            }),
        }
      )
    ).rejects.toThrow('Invalid marketplaces: invalid-marketplace');
  });

  test('rejects non-interactive runs with no images or input source', async () => {
    await expect(
      runGenerateCommand(
        {},
        {
          fetchImpl: vi.fn() as any,
        }
      )
    ).rejects.toThrow('Provide --images, --input, or --interactive.');
  });

  test('rejects empty marketplace selections from JSON input', async () => {
    await expect(
      runGenerateCommand(
        {
          input: 'example.json',
        },
        {
          fetchImpl: vi.fn() as any,
          readTextFile: async () =>
            JSON.stringify({
              extractedItem: readyItem,
              marketplaces: [],
            }),
        }
      )
    ).rejects.toThrow('Select at least one marketplace.');
  });

  test('rejects JSON input files that provide both extractedItem and imageUrls', async () => {
    await expect(
      runGenerateCommand(
        {
          input: 'example.json',
        },
        {
          fetchImpl: vi.fn() as any,
          readTextFile: async () =>
            JSON.stringify({
              extractedItem: readyItem,
              imageUrls: ['https://example.com/item.jpg'],
              marketplaces: ['ebay'],
            }),
        }
      )
    ).rejects.toThrow('Provide either extractedItem or imageUrls, not both.');
  });

  test('prefers the explicit API base URL over the environment variable', async () => {
    process.env.CROSSLIST_API_BASE_URL = 'https://env.example';
    const fetchImpl = vi.fn(async () => toApiResponse(generateMarketplaceListings(readyItem, ['ebay'])));

    await runGenerateCommand(
      {
        apiBaseUrl: 'https://flag.example',
        images: ['https://example.com/item.jpg'],
        marketplaces: 'ebay',
      },
      {
        fetchImpl: fetchImpl as any,
      }
    );

    const firstCall = fetchImpl.mock.calls[0] as unknown as [string | URL, { body?: string | null }];
    expect(String(firstCall[0])).toContain('https://flag.example/api/public/v1/crosslist/generate');
  });

  test('interactive runs with a reviewed extractedItem skip the pre-review API call', async () => {
    const fetchImpl = vi.fn(async () => toApiResponse(generateMarketplaceListings(readyItem, ['ebay'])));

    const result = await runGenerateCommand(
      {
        input: 'example.json',
        interactive: true,
        marketplaces: 'ebay',
        output: 'json',
      },
      {
        fetchImpl: fetchImpl as any,
        readTextFile: async () =>
          JSON.stringify({
            extractedItem: readyItem,
            marketplaces: ['ebay'],
          }),
        reviewer: async (item) => item,
      }
    );

    expect(result.exitCode).toBe(0);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

function toApiResponse(result: ReturnType<typeof generateMarketplaceListings>) {
  return new Response(
    JSON.stringify({
      data: {
        extracted_item: result.extractedItem,
        listings: result.listings,
        schema_version: result.schemaVersion,
        skipped_marketplaces: result.skippedMarketplaces,
        status: result.status,
      },
      meta: {
        api_version: 'v1',
        request_id: 'request-1',
        timestamp: '2026-03-06T00:00:00.000Z',
      },
    }),
    {
      headers: { 'content-type': 'application/json' },
      status: 200,
    }
  );
}
