import { detectTcgEligibility, looksLikeTcgInventory } from './detectTcgEligibility';
import { renderHumanReadable } from './renderHumanReadable';
import { normalizeExtractedItem } from './normalizeExtractedItem';
import { renderCraigslistListing } from './marketplaces/craigslist';
import { renderEbayListing } from './marketplaces/ebay';
import { renderFacebookMarketplaceListing } from './marketplaces/facebookMarketplace';
import { renderMercariListing } from './marketplaces/mercari';
import { renderTcgplayerListing } from './marketplaces/tcgplayer';
import {
  type ExtractedItem,
  type Listing,
  type ListingGenerationResult,
  type Marketplace,
  ListingGenerationResultSchema,
  schemaVersion,
} from './schemas';

export function generateMarketplaceListings(
  extractedItem: ExtractedItem,
  requestedMarketplaces: Marketplace[]
): ListingGenerationResult {
  const normalizedItem = withRequiredSignals(normalizeExtractedItem(extractedItem));

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

  for (const marketplace of Array.from(new Set(requestedMarketplaces))) {
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

function withRequiredSignals(item: ExtractedItem): ExtractedItem {
  return {
    ...item,
    missingFields: Array.from(
      new Set([...item.missingFields, ...requiredFieldChecks(item), ...requiredTcgFieldChecks(item)])
    ),
  };
}

function requiredFieldChecks(item: ExtractedItem) {
  return (
    [
      ['title', item.title],
      ['description', item.description],
      ['condition', item.condition],
      ['category', item.category],
    ] as Array<[string, string]>
  )
    .filter(([, value]) => !String(value).trim())
    .map(([field]) => field);
}

function requiredTcgFieldChecks(item: ExtractedItem) {
  if (!looksLikeTcgInventory(item)) {
    return [];
  }

  return (
    [
      ['tcg.cardName', item.tcg?.cardName ?? ''],
      ['tcg.game', item.tcg?.game ?? ''],
      ['tcg.set', item.tcg?.set ?? ''],
    ] as Array<[string, string]>
  )
    .filter(([, value]) => !String(value).trim())
    .map(([field]) => field);
}
