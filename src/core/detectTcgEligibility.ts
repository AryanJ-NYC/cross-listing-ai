import type { ExtractedItem } from './schemas';

export function detectTcgEligibility(item: ExtractedItem) {
  const tcg = item.tcg;
  const hasRequiredFields = Boolean(tcg?.cardName?.trim() && tcg?.game?.trim() && tcg?.set?.trim());

  if (looksLikeTcgInventory(item) && hasRequiredFields) {
    return { eligible: true as const };
  }

  return {
    eligible: false as const,
    reason: 'TCGPlayer is only available for trading card inventory with card-specific data.',
  };
}

export function looksLikeTcgInventory(item: { category: ExtractedItem['category']; tcg?: ExtractedItem['tcg'] }) {
  const category = normalizeValue(item.category);
  const game = normalizeValue(item.tcg?.game ?? '');

  return matchesAnyKeyword(category, tcgCategoryKeywords) || matchesAnyKeyword(game, tcgGameKeywords);
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function matchesAnyKeyword(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

const tcgCategoryKeywords = [
  'trading card',
  'trading-card',
  'tcg',
  'ccg',
  'pokemon card',
  'pokemon',
  'magic the gathering',
  'mtg',
  'yu-gi-oh',
  'yugioh',
  'lorcana',
  'digimon',
  'flesh and blood',
  'one piece',
  'dragon ball',
  'star wars unlimited',
];

const tcgGameKeywords = [
  'pokemon',
  'magic',
  'mtg',
  'yu-gi-oh',
  'yugioh',
  'lorcana',
  'digimon',
  'flesh and blood',
  'one piece',
  'dragon ball',
  'star wars unlimited',
];
