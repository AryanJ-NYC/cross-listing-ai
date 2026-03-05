import { describe, expect, test } from 'vitest';

import type { ExtractedItem, ListingGenerationResult } from '../src/core/schemas.js';
import { generateMarketplaceListings } from '../src/core/generateMarketplaceListings.js';

const baseItem: ExtractedItem = {
  attributes: {
    brand: 'Nike',
    color: 'White/Red',
    model: 'Air Jordan 1 Retro High OG',
    size: '10',
  },
  category: 'sneakers',
  condition: 'good',
  description:
    'Used pair of Air Jordan 1 Retro High OG sneakers in white and red. Includes original box.',
  missingFields: [],
  title: 'Nike Air Jordan 1 Retro High OG Sneakers Size 10 White/Red',
  uncertainties: [],
};

describe('generateMarketplaceListings', () => {
  test('generates four non-TCG listings and skips TCGPlayer for a sneaker item', () => {
    const result = generateMarketplaceListings(baseItem, [
      'ebay',
      'mercari',
      'facebook-marketplace',
      'craigslist',
      'tcgplayer',
    ]);

    expect(result.listings).toHaveLength(4);
    expect(result.skippedMarketplaces).toEqual([
      {
        marketplace: 'tcgplayer',
        reason: 'TCGPlayer is only available for trading card inventory with card-specific data.',
      },
    ]);
    expect(result.listings.map((listing) => listing.marketplace)).toEqual([
      'ebay',
      'mercari',
      'facebook-marketplace',
      'craigslist',
    ]);
  });

  test('returns needs_input when the item still has missing required fields', () => {
    const result = generateMarketplaceListings(
      {
        ...baseItem,
        missingFields: ['condition'],
      },
      ['ebay']
    );

    expect(result.status).toBe('needs_input');
    expect(result.listings).toHaveLength(0);
  });

  test('includes a tcgplayer listing when tcg fields are present', () => {
    const result = generateMarketplaceListings(
      {
        attributes: {
          cardNumber: '4/64',
          game: 'Pokemon',
          rarity: 'Rare Holo',
          set: 'Jungle',
        },
        category: 'trading-card-single',
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
      ['ebay', 'tcgplayer']
    );

    expect(result.status).toBe('ready');
    expect(result.listings.map((listing) => listing.marketplace)).toEqual(['ebay', 'tcgplayer']);
  });
});

describe('ListingGenerationResult human output', () => {
  test('renders human-readable output alongside JSON-safe listing data', () => {
    const result: ListingGenerationResult = generateMarketplaceListings(baseItem, ['ebay']);

    expect(result.humanReadable).toContain('eBay');
    expect(result.humanReadable).toContain('Nike Air Jordan 1');
    expect(result.humanReadable).toContain('Item specifics:');
    expect(result.humanReadable).toContain('Notes to seller:');
  });
});

test('treats common card categories as eligible for tcgplayer when tcg fields are present', () => {
  const result = generateMarketplaceListings(
    {
      attributes: {
        game: 'Pokemon',
        rarity: 'Rare Holo',
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
  );

  expect(result.listings.map((listing) => listing.marketplace)).toEqual(['tcgplayer']);
});

test('does not report success when every requested marketplace is skipped', () => {
  const result = generateMarketplaceListings(baseItem, ['tcgplayer']);

  expect(result.status).toBe('needs_input');
  expect(result.listings).toHaveLength(0);
  expect(result.skippedMarketplaces).toEqual([
    {
      marketplace: 'tcgplayer',
      reason: 'TCGPlayer is only available for trading card inventory with card-specific data.',
    },
  ]);
});
