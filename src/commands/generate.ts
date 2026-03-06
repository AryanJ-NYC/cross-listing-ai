import { readFile } from 'node:fs/promises';

import { callCrosslistApi } from '../core/api.js';
import {
  type ExtractedItem,
  GenerateFileInputSchema,
  type ListingGenerationResult,
  marketplaces,
  type Marketplace,
  OutputFormatSchema,
  type OutputFormat,
} from '../core/crosslistCore.js';
import { collectInteractiveInputs, reviewExtractedItem } from '../core/review/interactiveReview.js';

export async function runGenerateCommand(
  options: {
    apiBaseUrl?: string;
    images?: string[];
    input?: string;
    interactive?: boolean;
    marketplaces?: string;
    output?: string;
  },
  dependencies: {
    collectInputs?: typeof collectInteractiveInputs;
    fetchImpl?: typeof fetch;
    readTextFile?: (path: string) => Promise<string>;
    reviewer?: typeof reviewExtractedItem;
  } = {}
) {
  const readTextFile = dependencies.readTextFile ?? ((path: string) => readFile(path, 'utf8'));
  const reviewer = dependencies.reviewer ?? reviewExtractedItem;
  const collectInputs = dependencies.collectInputs ?? collectInteractiveInputs;
  const requested = await resolveRequestedInput(options, readTextFile, collectInputs);
  const requestedOutput = OutputFormatSchema.parse(
    options.output ?? requested.output ?? defaultOutputFormat(options.interactive)
  );
  const result = options.interactive
    ? await callCrosslistApi(
        {
          extractedItem: await reviewer(
            requested.extractedItem ??
              (
                await callCrosslistApi(
                  {
                    imageUrls: assertRemoteImageUrls(requested.imageUrls),
                    marketplaces: requested.marketplaces,
                  },
                  {
                    apiBaseUrl: options.apiBaseUrl,
                    fetchImpl: dependencies.fetchImpl,
                  }
                )
              ).extractedItem
          ),
          marketplaces: requested.marketplaces,
        },
        {
          apiBaseUrl: options.apiBaseUrl,
          fetchImpl: dependencies.fetchImpl,
        }
      )
    : requested.extractedItem
      ? await callCrosslistApi(
          {
            extractedItem: requested.extractedItem,
            marketplaces: requested.marketplaces,
          },
          {
            apiBaseUrl: options.apiBaseUrl,
            fetchImpl: dependencies.fetchImpl,
          }
        )
      : await callCrosslistApi(
          {
            imageUrls: assertRemoteImageUrls(requested.imageUrls),
            marketplaces: requested.marketplaces,
          },
          {
            apiBaseUrl: options.apiBaseUrl,
            fetchImpl: dependencies.fetchImpl,
          }
        );

  return {
    exitCode: result.status === 'ready' ? 0 : 1,
    output: formatOutput(result, requestedOutput),
    result,
  };
}

async function resolveRequestedInput(
  options: {
    images?: string[];
    input?: string;
    interactive?: boolean;
    marketplaces?: string;
  },
  readTextFile: (path: string) => Promise<string>,
  collectInputs: typeof collectInteractiveInputs
): Promise<{
  extractedItem?: ExtractedItem;
  imageUrls: string[];
  marketplaces: Marketplace[];
  output?: OutputFormat;
}> {
  if (options.input) {
    const parsed = GenerateFileInputSchema.parse(JSON.parse(await readTextFile(options.input)));
    return {
      extractedItem: parsed.extractedItem,
      imageUrls: parsed.imageUrls ?? [],
      marketplaces: assertMarketplaces(
        options.marketplaces ? parseMarketplaces(options.marketplaces) : parsed.marketplaces ?? [...marketplaces]
      ),
      output: parsed.output,
    };
  }

  if (options.interactive && (!options.images || options.images.length === 0)) {
    const interactive = await collectInputs();
    return {
      imageUrls: interactive.imageUrls,
      marketplaces: assertMarketplaces(
        options.marketplaces ? parseMarketplaces(options.marketplaces) : interactive.marketplaces
      ),
    };
  }

  return {
    imageUrls: options.images ?? [],
    marketplaces: assertMarketplaces(parseMarketplaces(options.marketplaces)),
  };
}

function parseMarketplaces(value: string | undefined): Marketplace[] {
  if (!value) {
    return [...marketplaces];
  }

  const requested = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const valid = requested.filter((entry): entry is Marketplace => marketplaces.includes(entry as Marketplace));
  const invalid = requested.filter((entry) => !marketplaces.includes(entry as Marketplace));

  if (invalid.length > 0) {
    throw new Error(`Invalid marketplaces: ${invalid.join(', ')}`);
  }

  return valid;
}

function formatOutput(result: ListingGenerationResult, requestedOutput: OutputFormat) {
  if (requestedOutput === 'json') {
    return JSON.stringify(toSerializableResult(result, false), null, 2);
  }

  if (requestedOutput === 'text') {
    return result.humanReadable;
  }

  return `${result.humanReadable}\n\nJSON:\n${JSON.stringify(toSerializableResult(result, true), null, 2)}`;
}

function defaultOutputFormat(interactive: boolean | undefined): OutputFormat {
  return interactive ? 'text' : 'json';
}

function toSerializableResult(result: ListingGenerationResult, includeHumanReadable: boolean) {
  if (includeHumanReadable) {
    return result;
  }

  const { humanReadable, ...jsonSafeResult } = result;
  void humanReadable;
  return jsonSafeResult;
}

function assertMarketplaces(requested: Marketplace[]) {
  if (requested.length === 0) {
    throw new Error('Select at least one marketplace.');
  }

  return requested;
}

function assertRemoteImageUrls(imageUrls: string[]) {
  if (imageUrls.length === 0) {
    throw new Error('Provide --images, --input, or --interactive.');
  }

  const localInputs = imageUrls.filter((imageUrl) => !/^https?:\/\//i.test(imageUrl));
  if (localInputs.length > 0) {
    throw new Error('Image extraction is URL-only in v1. Provide hosted image URLs instead of local file paths.');
  }

  return imageUrls;
}
