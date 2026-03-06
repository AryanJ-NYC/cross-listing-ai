import type { ExtractedItem } from '../schemas';
import { buildBaseListing } from './shared';

export function renderFacebookMarketplaceListing(item: ExtractedItem) {
  return buildBaseListing('facebook-marketplace', item, {
    maxTitleLength: 100,
    notesToSeller: ['Add pickup or delivery details in the Facebook Marketplace form.'],
  });
}
