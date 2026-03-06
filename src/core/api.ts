import {
  type ExtractedItem,
  type ListingGenerationResult,
  ListingGenerationResultSchema,
  renderHumanReadable,
} from './crosslistCore.js';

export async function callCrosslistApi(
  input: CrosslistApiInput,
  options: {
    apiBaseUrl?: string;
    fetchImpl?: typeof fetch;
  } = {}
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = new URL('/api/public/v1/crosslist/generate', resolveApiBaseUrl(options.apiBaseUrl));
  const response = await fetchImpl(endpoint, {
    body: JSON.stringify(
      'imageUrls' in input
        ? {
            image_urls: input.imageUrls,
            marketplaces: input.marketplaces,
          }
        : {
            extracted_item: input.extractedItem,
            marketplaces: input.marketplaces,
          }
    ),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  const responseBody: any = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractProblemMessage(responseBody, response.status));
  }

  return ListingGenerationResultSchema.parse({
    extractedItem: responseBody?.data?.extracted_item,
    humanReadable: renderHumanReadable({
      extractedItem: responseBody?.data?.extracted_item,
      listings: responseBody?.data?.listings,
      schemaVersion: responseBody?.data?.schema_version,
      skippedMarketplaces: responseBody?.data?.skipped_marketplaces,
      status: responseBody?.data?.status,
    }),
    listings: responseBody?.data?.listings,
    schemaVersion: responseBody?.data?.schema_version,
    skippedMarketplaces: responseBody?.data?.skipped_marketplaces,
    status: responseBody?.data?.status,
  });
}

export function resolveApiBaseUrl(explicitBaseUrl?: string) {
  return explicitBaseUrl?.trim() || process.env.CROSSLIST_API_BASE_URL?.trim() || defaultApiBaseUrl;
}

function extractProblemMessage(responseBody: any, status: number) {
  if (responseBody?.detail) {
    return responseBody.detail;
  }

  if (responseBody?.title) {
    return `${responseBody.title} (${status})`;
  }

  return `Crosslist API request failed with status ${status}.`;
}

const defaultApiBaseUrl = 'https://satstash.io';

export type CrosslistApiInput =
  | {
      imageUrls: string[];
      marketplaces: string[];
      extractedItem?: never;
    }
  | {
      extractedItem: ExtractedItem;
      marketplaces: string[];
      imageUrls?: never;
    };
