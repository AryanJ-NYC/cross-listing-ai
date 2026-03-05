import type { ListingGenerationResult } from './schemas.js';

export function renderHumanReadable(result: Omit<ListingGenerationResult, 'humanReadable'>) {
  const sections = [
    `Status: ${result.status}`,
    renderIssueSummary(result),
    ...result.listings.map((listing) => {
      return [
        '',
        headingFor(listing.marketplace),
        '',
        listing.copyBlock,
      ].join('\n');
    }),
  ];

  if (result.listings.length === 0) {
    sections.push('', 'No listing copy generated yet.');
  }

  if (result.skippedMarketplaces.length > 0) {
    sections.push(
      '',
      'Skipped marketplaces:',
      ...result.skippedMarketplaces.map(
        (entry) => `- ${headingFor(entry.marketplace)}: ${entry.reason}`
      )
    );
  }

  return sections.filter(Boolean).join('\n');
}

function renderIssueSummary(result: Omit<ListingGenerationResult, 'humanReadable'>) {
  const issues = [
    ...result.extractedItem.missingFields.map((field) => `Missing: ${field}`),
    ...result.extractedItem.uncertainties.map((field) => `Uncertain: ${field}`),
  ];

  return issues.length === 0 ? '' : issues.join('\n');
}

function headingFor(marketplace: string) {
  switch (marketplace) {
    case 'ebay':
      return 'eBay';
    case 'mercari':
      return 'Mercari';
    case 'facebook-marketplace':
      return 'Facebook Marketplace';
    case 'craigslist':
      return 'Craigslist';
    case 'tcgplayer':
      return 'TCGPlayer';
    default:
      return marketplace;
  }
}
