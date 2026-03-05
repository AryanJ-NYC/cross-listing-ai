import { checkbox, confirm, input, select } from '@inquirer/prompts';

import { type ExtractedItem, type Marketplace, conditions, marketplaces } from '../schemas.js';
import { looksLikeTcgInventory } from '../detectTcgEligibility.js';

type PromptDependencies = {
  checkbox: typeof checkbox;
  input: typeof input;
};

type ReviewPromptDependencies = {
  confirm: typeof confirm;
  input: typeof input;
  select: typeof select;
};

export async function collectInteractiveInputs(
  dependencies: PromptDependencies = {
    checkbox,
    input,
  }
) {
  const images = await dependencies.input({
    message: 'Enter local image paths or image URLs, comma-separated',
  });
  const selectedMarketplaces = await dependencies.checkbox({
    choices: marketplaces.map((marketplace) => ({
      checked: marketplace !== 'tcgplayer',
      name: marketplace,
      value: marketplace,
    })),
    message: 'Select marketplaces to target',
  });

  return {
    images: images
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    marketplaces: selectedMarketplaces as Marketplace[],
  };
}

export async function reviewExtractedItem(
  item: ExtractedItem,
  dependencies: ReviewPromptDependencies = {
    confirm,
    input,
    select,
  }
) {
  return reviewExtractedItemWithPrompts(item, dependencies);
}

async function reviewExtractedItemWithPrompts(
  item: ExtractedItem,
  dependencies: ReviewPromptDependencies
) {
  const review = {
    ...item,
    category: await dependencies.input({
      default: item.category,
      message: 'Category',
    }),
    condition: (await dependencies.select({
      choices: conditions.map((condition) => ({ name: condition, value: condition })),
      default: item.condition,
      message: 'Condition',
    })) as ExtractedItem['condition'],
    description: await dependencies.input({
      default: item.description,
      message: 'Description',
    }),
    title: await dependencies.input({
      default: item.title,
      message: 'Title',
    }),
    attributes: parseAttributes(
      await dependencies.input({
        default: serializeAttributes(item.attributes),
        message: 'Attributes (key=value, comma-separated)',
      })
    ),
  };
  const unresolvedUncertainties = parseCommaSeparatedValues(
    await dependencies.input({
      default: item.uncertainties.join(', '),
      message: 'Remaining uncertainties (comma-separated, leave blank if none)',
    })
  );

  if (looksLikeTcgInventory(review) || review.tcg) {
    review.tcg = {
      cardName: await dependencies.input({
        default: review.tcg?.cardName ?? '',
        message: 'Card name',
      }),
      cardNumber: await dependencies.input({
        default: review.tcg?.cardNumber ?? '',
        message: 'Card number',
      }),
      foil: await dependencies.confirm({
        default: review.tcg?.foil ?? false,
        message: 'Foil finish?',
      }),
      game: await dependencies.input({
        default: review.tcg?.game ?? '',
        message: 'Game',
      }),
      language: await dependencies.input({
        default: review.tcg?.language ?? 'English',
        message: 'Language',
      }),
      rarity: await dependencies.input({
        default: review.tcg?.rarity ?? '',
        message: 'Rarity',
      }),
      set: await dependencies.input({
        default: review.tcg?.set ?? '',
        message: 'Set',
      }),
    };
  }

  return refreshSignals(review, unresolvedUncertainties);
}

function refreshSignals(item: ExtractedItem, uncertainties: string[]): ExtractedItem {
  const missingFields = [...requiredFieldChecks(item), ...requiredTcgFieldChecks(item)];

  return {
    ...item,
    missingFields,
    uncertainties,
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

function parseAttributes(value: string) {
  return Object.fromEntries(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const separatorIndex = entry.indexOf('=');
        if (separatorIndex === -1) {
          return [entry, ''];
        }

        return [entry.slice(0, separatorIndex).trim(), entry.slice(separatorIndex + 1).trim()];
      })
      .filter(([key, entryValue]) => key && entryValue)
  );
}

function parseCommaSeparatedValues(value: string) {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function serializeAttributes(attributes: Record<string, string>) {
  return Object.entries(attributes)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}
