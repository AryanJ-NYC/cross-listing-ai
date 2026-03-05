import { detectTcgEligibility } from './detectTcgEligibility.js';
import { normalizeExtractedItem } from './normalizeExtractedItem.js';
import { renderHumanReadable } from './renderHumanReadable.js';
import { renderCraigslistListing } from './marketplaces/craigslist.js';
import { renderEbayListing } from './marketplaces/ebay.js';
import { renderFacebookMarketplaceListing } from './marketplaces/facebookMarketplace.js';
import { renderMercariListing } from './marketplaces/mercari.js';
import { renderTcgplayerListing } from './marketplaces/tcgplayer.js';
import {
  type ExtractedItem,
  type Listing,
  type ListingGenerationResult,
  type Marketplace,
  ListingGenerationResultSchema,
  schemaVersion,
} from './schemas.js';

export function generateMarketplaceListings(
  extractedItem: ExtractedItem,
  requestedMarketplaces: Marketplace[]
): ListingGenerationResult {
  const normalizedItem = normalizeExtractedItem(extractedItem);

  if (normalizedItem.missingFields.length > 0 || normalizedItem.uncertainties.length > 0) {
    return ListingGenerationResultSchema.parse({
      extractedItem: normalizedItem,
      humanReadable: renderHumanReadable({
        extractedItem: normalizedItem,
        listings: [],
        schemaVersion,
        skippedMarketplaces: [],
        status: 'needs_input',
      }),
      listings: [],
      schemaVersion,
      skippedMarketplaces: [],
      status: 'needs_input',
    });
  }

  const listings: Listing[] = [];
  const skippedMarketplaces: Array<{ marketplace: Marketplace; reason: string }> = [];

  for (const marketplace of new Set(requestedMarketplaces)) {
    if (marketplace === 'tcgplayer') {
      const tcg = detectTcgEligibility(normalizedItem);
      if (!tcg.eligible) {
        skippedMarketplaces.push({ marketplace, reason: tcg.reason });
        continue;
      }
      listings.push(renderTcgplayerListing(normalizedItem));
      continue;
    }

    listings.push(renderListing(marketplace, normalizedItem));
  }

  const status = listings.length > 0 ? 'ready' : 'needs_input';

  return ListingGenerationResultSchema.parse({
    extractedItem: normalizedItem,
    humanReadable: renderHumanReadable({
      extractedItem: normalizedItem,
      listings,
      schemaVersion,
      skippedMarketplaces,
      status,
    }),
    listings,
    schemaVersion,
    skippedMarketplaces,
    status,
  });
}

function renderListing(marketplace: Exclude<Marketplace, 'tcgplayer'>, item: ExtractedItem) {
  switch (marketplace) {
    case 'ebay':
      return renderEbayListing(item);
    case 'mercari':
      return renderMercariListing(item);
    case 'facebook-marketplace':
      return renderFacebookMarketplaceListing(item);
    case 'craigslist':
      return renderCraigslistListing(item);
  }
}
