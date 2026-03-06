import type { ExtractedItem } from '../schemas';
import { buildBaseListing } from './shared';

export function renderEbayListing(item: ExtractedItem) {
  return buildBaseListing('ebay', item, {
    maxTitleLength: 80,
    notesToSeller: ['Review shipping profile and item specifics before posting to eBay.'],
  });
}
