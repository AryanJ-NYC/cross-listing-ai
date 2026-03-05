import type { ExtractedItem } from '../schemas.js';
import { buildBaseListing } from './shared.js';

export function renderEbayListing(item: ExtractedItem) {
  return buildBaseListing('ebay', item, {
    maxTitleLength: 80,
    notesToSeller: ['Review shipping profile and item specifics before posting to eBay.'],
  });
}
