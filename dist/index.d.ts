import { E as ExtractedItem, M as Marketplace, L as ListingGenerationResult } from './schemas-BwbiKRTg.js';
export { C as ConditionSchema, D as DoctorCheck, a as DoctorResult, b as DoctorResultSchema, c as ExtractedItemConditionSchema, d as ExtractedItemSchema, G as GenerateFileInput, e as GenerateFileInputSchema, f as ListingGenerationResultSchema, g as ListingSchema, h as MarketplaceSchema, O as OutputFormat, i as OutputFormatSchema, S as SkippedMarketplaceSchema, j as conditions, m as marketplaces, s as schemaVersion } from './schemas-BwbiKRTg.js';
import 'zod';

declare function generateMarketplaceListings(extractedItem: ExtractedItem, requestedMarketplaces: Marketplace[]): ListingGenerationResult;

declare function looksLikeTcgInventory(item: {
    category: ExtractedItem['category'];
    tcg?: ExtractedItem['tcg'];
}): boolean;

type TcgLike = {
    cardName?: string | null;
    cardNumber?: string | null;
    foil?: boolean | null;
    game?: string | null;
    language?: string | null;
    rarity?: string | null;
    set?: string | null;
};
declare function normalizeExtractedItem(item: ExtractedItem): ExtractedItem;
declare function normalizeTcgDetails(value: TcgLike | undefined | null): {
    set?: string | undefined;
    cardName?: string | undefined;
    cardNumber?: string | undefined;
    foil?: boolean | undefined;
    game?: string | undefined;
    language?: string | undefined;
    rarity?: string | undefined;
} | undefined;

declare function renderHumanReadable(result: Omit<ListingGenerationResult, 'humanReadable'>): string;

export { ExtractedItem, ListingGenerationResult, Marketplace, generateMarketplaceListings, looksLikeTcgInventory, normalizeExtractedItem, normalizeTcgDetails, renderHumanReadable };
