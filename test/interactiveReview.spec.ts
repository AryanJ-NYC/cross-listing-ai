import { describe, expect, test } from 'vitest';

import { collectInteractiveInputs, reviewExtractedItem } from '../src/core/review/interactiveReview.js';

describe('collectInteractiveInputs', () => {
  test('normalizes comma-separated image input and uses explicit marketplace selections', async () => {
    const inputPrompt = Object.assign(async () => ' ./one.jpg, https://example.com/two.png ', {
      cancel: () => undefined,
    });
    const checkboxPrompt = Object.assign(async () => ['ebay', 'mercari'], {
      cancel: () => undefined,
    });

    const result = await collectInteractiveInputs({
      checkbox: checkboxPrompt as unknown as typeof import('@inquirer/prompts').checkbox,
      input: inputPrompt as unknown as typeof import('@inquirer/prompts').input,
    });

    expect(result).toEqual({
      images: ['./one.jpg', 'https://example.com/two.png'],
      marketplaces: ['ebay', 'mercari'],
    });
  });

  test('lets sellers revise attributes and explicitly keep unresolved uncertainties', async () => {
    const inputValues = [
      'Pokemon card',
      'Reviewed description',
      'Reviewed title',
      'brand=Pokemon, set=Jungle, language=English',
      'centering, surface',
      'Jolteon',
      '4/64',
      'Pokemon',
      'English',
      'Rare Holo',
      'Jungle',
    ];
    const inputPrompt = Object.assign(async () => inputValues.shift() ?? '', {
      cancel: () => undefined,
    });
    const selectPrompt = Object.assign(async () => 'like new', {
      cancel: () => undefined,
    });
    const confirmPrompt = Object.assign(async () => true, {
      cancel: () => undefined,
    });

    const result = await reviewExtractedItem(
      {
        attributes: {
          brand: 'Unknown',
        },
        category: 'Pokemon card',
        condition: 'good',
        description: 'Original description',
        missingFields: [],
        tcg: {
          cardName: '',
          foil: false,
          game: '',
          language: '',
          rarity: '',
          set: '',
        },
        title: 'Original title',
        uncertainties: ['centering', 'surface'],
      },
      {
        confirm: confirmPrompt as unknown as typeof import('@inquirer/prompts').confirm,
        input: inputPrompt as unknown as typeof import('@inquirer/prompts').input,
        select: selectPrompt as unknown as typeof import('@inquirer/prompts').select,
      }
    );

    expect(result.attributes).toEqual({
      brand: 'Pokemon',
      language: 'English',
      set: 'Jungle',
    });
    expect(result.uncertainties).toEqual(['centering', 'surface']);
    expect(result.tcg?.cardName).toBe('Jolteon');
  });
});
