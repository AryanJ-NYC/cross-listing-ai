import { readFile } from 'node:fs/promises';

import { generateMarketplaceListings } from '../core/generateMarketplaceListings.js';
import { OpenAIItemExtractionProvider } from '../core/providers/openai.js';
import type { ItemExtractionProvider } from '../core/providers/types.js';
import { collectInteractiveInputs, reviewExtractedItem } from '../core/review/interactiveReview.js';
import {
  type ExtractedItem,
  type GenerateFileInput,
  type ListingGenerationResult,
  type Marketplace,
  type OutputFormat,
  GenerateFileInputSchema,
  OutputFormatSchema,
  marketplaces,
} from '../core/schemas.js';

export async function runGenerateCommand(
  options: {
    images?: string[];
    input?: string;
    interactive?: boolean;
    marketplaces?: string;
    output?: string;
  },
  dependencies: {
    extractor?: ItemExtractionProvider;
    readTextFile?: (path: string) => Promise<string>;
    reviewer?: typeof reviewExtractedItem;
    collectInputs?: typeof collectInteractiveInputs;
  } = {}
) {
  const readTextFile = dependencies.readTextFile ?? ((path: string) => readFile(path, 'utf8'));
  const reviewer = dependencies.reviewer ?? reviewExtractedItem;
  const collectInputs = dependencies.collectInputs ?? collectInteractiveInputs;

  const requested = await resolveRequestedInput(options, readTextFile, collectInputs);
  const requestedOutput = OutputFormatSchema.parse(
    options.output ?? requested.output ?? defaultOutputFormat(options.interactive)
  );
  const extractedItem =
    requested.extractedItem ??
    (await (dependencies.extractor ?? new OpenAIItemExtractionProvider()).extractFromImages(
      requested.images
    ));
  const reviewedItem = options.interactive ? await reviewer(extractedItem) : extractedItem;
  const result = generateMarketplaceListings(reviewedItem, requested.marketplaces);

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
  images: string[];
  marketplaces: Marketplace[];
  output?: OutputFormat;
}> {
  if (options.input) {
    const parsed = GenerateFileInputSchema.parse(JSON.parse(await readTextFile(options.input))) as GenerateFileInput;
    return {
      extractedItem: parsed.extractedItem,
      images: parsed.images ?? [],
      marketplaces: assertMarketplaces(parsed.marketplaces ?? [...marketplaces]),
      output: parsed.output,
    };
  }

  if (options.interactive && (!options.images || options.images.length === 0)) {
    const interactive = await collectInputs();
    return {
      images: assertImages(interactive.images),
      marketplaces: assertMarketplaces(
        interactive.marketplaces.length > 0
          ? parseMarketplaces(interactive.marketplaces.join(','))
          : [...marketplaces]
      ),
    };
  }

  return {
    images: assertImages(options.images ?? []),
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
  const valid = requested.filter((entry): entry is Marketplace =>
    marketplaces.includes(entry as Marketplace)
  );
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

function assertImages(images: string[]) {
  if (images.length === 0) {
    throw new Error('Provide --images, --input, or --interactive.');
  }

  return images;
}

function assertMarketplaces(requested: Marketplace[]) {
  if (requested.length === 0) {
    throw new Error('Select at least one marketplace.');
  }

  return requested;
}
