import type { ExtractedItem } from '../schemas.js';
import { buildBaseListing } from './shared.js';

export function renderCraigslistListing(item: ExtractedItem) {
  return buildBaseListing('craigslist', item, {
    maxTitleLength: 120,
    notesToSeller: ['Add location, contact preference, and delivery notes before posting to Craigslist.'],
  });
}
