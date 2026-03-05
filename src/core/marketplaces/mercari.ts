import type { ExtractedItem } from '../schemas.js';
import { buildBaseListing } from './shared.js';

export function renderMercariListing(item: ExtractedItem) {
  return buildBaseListing('mercari', item, {
    maxTitleLength: 80,
    notesToSeller: ['Double-check Mercari category mapping and shipping method before posting.'],
  });
}
