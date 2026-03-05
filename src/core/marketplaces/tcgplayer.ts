import type { ExtractedItem } from '../schemas.js';
import { buildBaseListing } from './shared.js';

export function renderTcgplayerListing(item: ExtractedItem) {
  const listing = buildBaseListing('tcgplayer', item, {
    maxTitleLength: 255,
    notesToSeller: ['Confirm print, language, and finish match the card before posting to TCGPlayer.'],
  });

  return {
    ...listing,
    description: listing.description.slice(0, 5000),
    copyBlock: listing.copyBlock.slice(0, 7000),
  };
}
