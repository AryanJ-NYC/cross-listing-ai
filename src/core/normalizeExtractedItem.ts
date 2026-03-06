import { TcgDetailsSchema, type ExtractedItem } from './schemas';

type TcgLike = {
  cardName?: string | null;
  cardNumber?: string | null;
  foil?: boolean | null;
  game?: string | null;
  language?: string | null;
  rarity?: string | null;
  set?: string | null;
};

export function normalizeExtractedItem(item: ExtractedItem): ExtractedItem {
  const normalizedTcg = normalizeTcgDetails(item.tcg);

  return {
    ...item,
    ...(normalizedTcg ? { tcg: normalizedTcg } : {}),
    ...(!normalizedTcg && item.tcg ? { tcg: undefined } : {}),
  };
}

export function normalizeTcgDetails(value: TcgLike | undefined | null) {
  if (!value) {
    return undefined;
  }

  const normalizedEntries = Object.entries(value).filter(([, entry]) => {
    if (typeof entry === 'boolean') {
      return true;
    }

    return Boolean(entry?.trim());
  });

  if (normalizedEntries.length === 0) {
    return undefined;
  }

  return TcgDetailsSchema.parse(Object.fromEntries(normalizedEntries));
}
