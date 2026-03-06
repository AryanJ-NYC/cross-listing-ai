import type { ExtractedItem, Listing, Marketplace } from '../schemas';

export function buildBaseListing(
  marketplace: Marketplace,
  item: ExtractedItem,
  options: {
    maxTitleLength: number;
    notesToSeller?: string[];
    titlePrefix?: string;
  }
): Listing {
  const title = clampTitle([options.titlePrefix, item.title].filter(Boolean).join(' '), options.maxTitleLength);
  const bullets = buildBullets(item);
  const itemSpecifics = buildItemSpecifics(item);
  const description = [item.description, bullets.map((bullet) => `- ${bullet}`).join('\n')].join('\n\n');
  const notesToSeller = options.notesToSeller ?? [];

  return {
    bullets,
    copyBlock: buildCopyBlock(title, description, itemSpecifics, notesToSeller),
    description,
    itemSpecifics,
    marketplace,
    notesToSeller,
    title,
  };
}

function buildBullets(item: ExtractedItem) {
  return Object.entries(item.attributes)
    .slice(0, 4)
    .map(([key, value]) => `${startCase(key)}: ${value}`);
}

function buildCopyBlock(
  title: string,
  description: string,
  itemSpecifics: Record<string, string>,
  notesToSeller: string[]
) {
  const specificsBlock = Object.entries(itemSpecifics)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
  const notesBlock =
    notesToSeller.length === 0 ? '' : `\n\nNotes to seller:\n${notesToSeller.map((note) => `- ${note}`).join('\n')}`;

  return `Title: ${title}\n\nDescription:\n${description}\n\nItem specifics:\n${specificsBlock}${notesBlock}`;
}

function buildItemSpecifics(item: ExtractedItem) {
  const specifics: Record<string, string> = {
    Category: item.category,
    Condition: startCase(item.condition),
  };

  for (const [key, value] of Object.entries(item.attributes)) {
    specifics[startCase(key)] = value;
  }

  return specifics;
}

function clampTitle(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = normalized.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim();
}

function startCase(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
