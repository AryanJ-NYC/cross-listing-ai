import { describe, expect, test, vi } from 'vitest';

import { runGenerateCommand } from '../src/commands/generate.js';
import type { ExtractedItem } from '../src/core/schemas.js';

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
  test('renders combined human + JSON output from a JSON input file', async () => {
    const result = await runGenerateCommand(
      {
        input: 'example.json',
        output: 'both',
      },
      {
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

  test('defaults to JSON output for non-interactive runs when no output is specified', async () => {
    const result = await runGenerateCommand(
      {
        input: 'example.json',
      },
      {
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
        extractor: {
          extractFromImages: async () => ({
            ...readyItem,
            missingFields: ['condition'],
          }),
        },
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

    const result = await runGenerateCommand(
      {
        interactive: true,
        marketplaces: 'ebay',
        output: 'text',
      },
      {
        collectInputs: async () => ({
          images: ['https://example.com/item.jpg'],
          marketplaces: ['ebay'],
        }),
        extractor: {
          extractFromImages: async () => ({
            ...readyItem,
            condition: 'good',
            missingFields: ['condition'],
            uncertainties: ['condition'],
          }),
        },
        reviewer,
      }
    );

    expect(reviewer).toHaveBeenCalledOnce();
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Status: ready');
  });

  test('rejects invalid marketplace names instead of silently dropping them', async () => {
    await expect(
      runGenerateCommand(
        {
          images: ['https://example.com/item.jpg'],
          marketplaces: 'ebay,invalid-marketplace',
        },
        {
          extractor: {
            extractFromImages: async () => readyItem,
          },
        }
      )
    ).rejects.toThrow('Invalid marketplaces: invalid-marketplace');
  });

  test('rejects non-interactive runs with no images or input source', async () => {
    await expect(
      runGenerateCommand(
        {},
        {
          extractor: {
            extractFromImages: async () => readyItem,
          },
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
          readTextFile: async () =>
            JSON.stringify({
              extractedItem: readyItem,
              marketplaces: [],
            }),
        }
      )
    ).rejects.toThrow('Select at least one marketplace.');
  });
});
