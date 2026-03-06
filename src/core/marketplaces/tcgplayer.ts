import type { ExtractedItem } from '../schemas';
import { buildBaseListing } from './shared';

export function renderTcgplayerListing(item: ExtractedItem) {
  const listing = buildBaseListing('tcgplayer', item, {
    maxTitleLength: 255,
    notesToSeller: ['Confirm print, language, and finish match the card before posting to TCGPlayer.'],
  });

  return {
    ...listing,
    copyBlock: listing.copyBlock.slice(0, 7000),
    description: listing.description.slice(0, 5000),
  };
}
