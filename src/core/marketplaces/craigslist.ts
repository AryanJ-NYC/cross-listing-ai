import type { ExtractedItem } from '../schemas';
import { buildBaseListing } from './shared';

export function renderCraigslistListing(item: ExtractedItem) {
  return buildBaseListing('craigslist', item, {
    maxTitleLength: 120,
    notesToSeller: ['Add location, contact preference, and delivery notes before posting to Craigslist.'],
  });
}
