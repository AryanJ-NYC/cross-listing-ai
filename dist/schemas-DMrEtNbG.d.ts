import { z } from 'zod';

declare const marketplaces: readonly ["ebay", "mercari", "facebook-marketplace", "craigslist", "tcgplayer"];
declare const conditions: readonly ["brand new", "like new", "very good", "good", "acceptable", "for parts or not working"];
declare const MarketplaceSchema: z.ZodEnum<["ebay", "mercari", "facebook-marketplace", "craigslist", "tcgplayer"]>;
declare const OutputFormatSchema: z.ZodEnum<["text", "json", "both"]>;
declare const ExtractedItemConditionSchema: z.ZodUnion<[z.ZodEnum<["brand new", "like new", "very good", "good", "acceptable", "for parts or not working"]>, z.ZodLiteral<"">]>;
declare const ExtractedItemSchema: z.ZodObject<{
    attributes: z.ZodRecord<z.ZodString, z.ZodString>;
    category: z.ZodString;
    condition: z.ZodUnion<[z.ZodEnum<["brand new", "like new", "very good", "good", "acceptable", "for parts or not working"]>, z.ZodLiteral<"">]>;
    description: z.ZodString;
    missingFields: z.ZodArray<z.ZodString, "many">;
    tcg: z.ZodOptional<z.ZodObject<{
        cardName: z.ZodOptional<z.ZodString>;
        cardNumber: z.ZodOptional<z.ZodString>;
        foil: z.ZodOptional<z.ZodBoolean>;
        game: z.ZodOptional<z.ZodString>;
        language: z.ZodOptional<z.ZodString>;
        rarity: z.ZodOptional<z.ZodString>;
        set: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        set?: string | undefined;
        cardName?: string | undefined;
        cardNumber?: string | undefined;
        foil?: boolean | undefined;
        game?: string | undefined;
        language?: string | undefined;
        rarity?: string | undefined;
    }, {
        set?: string | undefined;
        cardName?: string | undefined;
        cardNumber?: string | undefined;
        foil?: boolean | undefined;
        game?: string | undefined;
        language?: string | undefined;
        rarity?: string | undefined;
    }>>;
    title: z.ZodString;
    uncertainties: z.ZodArray<z.ZodString, "many">;
}, "strict", z.ZodTypeAny, {
    attributes: Record<string, string>;
    category: string;
    condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
    description: string;
    missingFields: string[];
    title: string;
    uncertainties: string[];
    tcg?: {
        set?: string | undefined;
        cardName?: string | undefined;
        cardNumber?: string | undefined;
        foil?: boolean | undefined;
        game?: string | undefined;
        language?: string | undefined;
        rarity?: string | undefined;
    } | undefined;
}, {
    attributes: Record<string, string>;
    category: string;
    condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
    description: string;
    missingFields: string[];
    title: string;
    uncertainties: string[];
    tcg?: {
        set?: string | undefined;
        cardName?: string | undefined;
        cardNumber?: string | undefined;
        foil?: boolean | undefined;
        game?: string | undefined;
        language?: string | undefined;
        rarity?: string | undefined;
    } | undefined;
}>;
declare const ListingGenerationResultSchema: z.ZodObject<{
    extractedItem: z.ZodObject<{
        attributes: z.ZodRecord<z.ZodString, z.ZodString>;
        category: z.ZodString;
        condition: z.ZodUnion<[z.ZodEnum<["brand new", "like new", "very good", "good", "acceptable", "for parts or not working"]>, z.ZodLiteral<"">]>;
        description: z.ZodString;
        missingFields: z.ZodArray<z.ZodString, "many">;
        tcg: z.ZodOptional<z.ZodObject<{
            cardName: z.ZodOptional<z.ZodString>;
            cardNumber: z.ZodOptional<z.ZodString>;
            foil: z.ZodOptional<z.ZodBoolean>;
            game: z.ZodOptional<z.ZodString>;
            language: z.ZodOptional<z.ZodString>;
            rarity: z.ZodOptional<z.ZodString>;
            set: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        }, {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        }>>;
        title: z.ZodString;
        uncertainties: z.ZodArray<z.ZodString, "many">;
    }, "strict", z.ZodTypeAny, {
        attributes: Record<string, string>;
        category: string;
        condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
        description: string;
        missingFields: string[];
        title: string;
        uncertainties: string[];
        tcg?: {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        } | undefined;
    }, {
        attributes: Record<string, string>;
        category: string;
        condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
        description: string;
        missingFields: string[];
        title: string;
        uncertainties: string[];
        tcg?: {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        } | undefined;
    }>;
    humanReadable: z.ZodString;
    listings: z.ZodArray<z.ZodObject<{
        bullets: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        copyBlock: z.ZodString;
        description: z.ZodString;
        itemSpecifics: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        marketplace: z.ZodEnum<["ebay", "mercari", "facebook-marketplace", "craigslist", "tcgplayer"]>;
        notesToSeller: z.ZodArray<z.ZodString, "many">;
        title: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        description: string;
        title: string;
        copyBlock: string;
        marketplace: "ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer";
        notesToSeller: string[];
        bullets?: string[] | undefined;
        itemSpecifics?: Record<string, string> | undefined;
    }, {
        description: string;
        title: string;
        copyBlock: string;
        marketplace: "ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer";
        notesToSeller: string[];
        bullets?: string[] | undefined;
        itemSpecifics?: Record<string, string> | undefined;
    }>, "many">;
    schemaVersion: z.ZodString;
    skippedMarketplaces: z.ZodArray<z.ZodObject<{
        marketplace: z.ZodEnum<["ebay", "mercari", "facebook-marketplace", "craigslist", "tcgplayer"]>;
        reason: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        marketplace: "ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer";
        reason: string;
    }, {
        marketplace: "ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer";
        reason: string;
    }>, "many">;
    status: z.ZodEnum<["ready", "needs_input"]>;
}, "strict", z.ZodTypeAny, {
    status: "ready" | "needs_input";
    extractedItem: {
        attributes: Record<string, string>;
        category: string;
        condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
        description: string;
        missingFields: string[];
        title: string;
        uncertainties: string[];
        tcg?: {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        } | undefined;
    };
    humanReadable: string;
    listings: {
        description: string;
        title: string;
        copyBlock: string;
        marketplace: "ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer";
        notesToSeller: string[];
        bullets?: string[] | undefined;
        itemSpecifics?: Record<string, string> | undefined;
    }[];
    schemaVersion: string;
    skippedMarketplaces: {
        marketplace: "ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer";
        reason: string;
    }[];
}, {
    status: "ready" | "needs_input";
    extractedItem: {
        attributes: Record<string, string>;
        category: string;
        condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
        description: string;
        missingFields: string[];
        title: string;
        uncertainties: string[];
        tcg?: {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        } | undefined;
    };
    humanReadable: string;
    listings: {
        description: string;
        title: string;
        copyBlock: string;
        marketplace: "ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer";
        notesToSeller: string[];
        bullets?: string[] | undefined;
        itemSpecifics?: Record<string, string> | undefined;
    }[];
    schemaVersion: string;
    skippedMarketplaces: {
        marketplace: "ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer";
        reason: string;
    }[];
}>;
declare const GenerateFileInputSchema: z.ZodEffects<z.ZodObject<{
    extractedItem: z.ZodOptional<z.ZodObject<{
        attributes: z.ZodRecord<z.ZodString, z.ZodString>;
        category: z.ZodString;
        condition: z.ZodUnion<[z.ZodEnum<["brand new", "like new", "very good", "good", "acceptable", "for parts or not working"]>, z.ZodLiteral<"">]>;
        description: z.ZodString;
        missingFields: z.ZodArray<z.ZodString, "many">;
        tcg: z.ZodOptional<z.ZodObject<{
            cardName: z.ZodOptional<z.ZodString>;
            cardNumber: z.ZodOptional<z.ZodString>;
            foil: z.ZodOptional<z.ZodBoolean>;
            game: z.ZodOptional<z.ZodString>;
            language: z.ZodOptional<z.ZodString>;
            rarity: z.ZodOptional<z.ZodString>;
            set: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        }, {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        }>>;
        title: z.ZodString;
        uncertainties: z.ZodArray<z.ZodString, "many">;
    }, "strict", z.ZodTypeAny, {
        attributes: Record<string, string>;
        category: string;
        condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
        description: string;
        missingFields: string[];
        title: string;
        uncertainties: string[];
        tcg?: {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        } | undefined;
    }, {
        attributes: Record<string, string>;
        category: string;
        condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
        description: string;
        missingFields: string[];
        title: string;
        uncertainties: string[];
        tcg?: {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        } | undefined;
    }>>;
    imageUrls: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    marketplaces: z.ZodOptional<z.ZodArray<z.ZodEnum<["ebay", "mercari", "facebook-marketplace", "craigslist", "tcgplayer"]>, "many">>;
    output: z.ZodOptional<z.ZodEnum<["text", "json", "both"]>>;
}, "strict", z.ZodTypeAny, {
    extractedItem?: {
        attributes: Record<string, string>;
        category: string;
        condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
        description: string;
        missingFields: string[];
        title: string;
        uncertainties: string[];
        tcg?: {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        } | undefined;
    } | undefined;
    imageUrls?: string[] | undefined;
    marketplaces?: ("ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer")[] | undefined;
    output?: "text" | "json" | "both" | undefined;
}, {
    extractedItem?: {
        attributes: Record<string, string>;
        category: string;
        condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
        description: string;
        missingFields: string[];
        title: string;
        uncertainties: string[];
        tcg?: {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        } | undefined;
    } | undefined;
    imageUrls?: string[] | undefined;
    marketplaces?: ("ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer")[] | undefined;
    output?: "text" | "json" | "both" | undefined;
}>, {
    extractedItem?: {
        attributes: Record<string, string>;
        category: string;
        condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
        description: string;
        missingFields: string[];
        title: string;
        uncertainties: string[];
        tcg?: {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        } | undefined;
    } | undefined;
    imageUrls?: string[] | undefined;
    marketplaces?: ("ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer")[] | undefined;
    output?: "text" | "json" | "both" | undefined;
}, {
    extractedItem?: {
        attributes: Record<string, string>;
        category: string;
        condition: "" | "brand new" | "like new" | "very good" | "good" | "acceptable" | "for parts or not working";
        description: string;
        missingFields: string[];
        title: string;
        uncertainties: string[];
        tcg?: {
            set?: string | undefined;
            cardName?: string | undefined;
            cardNumber?: string | undefined;
            foil?: boolean | undefined;
            game?: string | undefined;
            language?: string | undefined;
            rarity?: string | undefined;
        } | undefined;
    } | undefined;
    imageUrls?: string[] | undefined;
    marketplaces?: ("ebay" | "mercari" | "facebook-marketplace" | "craigslist" | "tcgplayer")[] | undefined;
    output?: "text" | "json" | "both" | undefined;
}>;
declare const DoctorCheckSchema: z.ZodObject<{
    message: z.ZodString;
    name: z.ZodString;
    status: z.ZodEnum<["pass", "fail"]>;
}, "strict", z.ZodTypeAny, {
    status: "pass" | "fail";
    message: string;
    name: string;
}, {
    status: "pass" | "fail";
    message: string;
    name: string;
}>;
declare const DoctorResultSchema: z.ZodObject<{
    checks: z.ZodArray<z.ZodObject<{
        message: z.ZodString;
        name: z.ZodString;
        status: z.ZodEnum<["pass", "fail"]>;
    }, "strict", z.ZodTypeAny, {
        status: "pass" | "fail";
        message: string;
        name: string;
    }, {
        status: "pass" | "fail";
        message: string;
        name: string;
    }>, "many">;
    humanReadable: z.ZodString;
    ok: z.ZodBoolean;
}, "strict", z.ZodTypeAny, {
    humanReadable: string;
    checks: {
        status: "pass" | "fail";
        message: string;
        name: string;
    }[];
    ok: boolean;
}, {
    humanReadable: string;
    checks: {
        status: "pass" | "fail";
        message: string;
        name: string;
    }[];
    ok: boolean;
}>;
type DoctorCheck = z.infer<typeof DoctorCheckSchema>;
type DoctorResult = z.infer<typeof DoctorResultSchema>;
type ExtractedItem = z.infer<typeof ExtractedItemSchema>;
type GenerateFileInput = z.infer<typeof GenerateFileInputSchema>;
type ListingGenerationResult = z.infer<typeof ListingGenerationResultSchema>;
type Marketplace = z.infer<typeof MarketplaceSchema>;
type OutputFormat = z.infer<typeof OutputFormatSchema>;

export { type DoctorCheck as D, type ExtractedItem as E, type GenerateFileInput as G, type ListingGenerationResult as L, type Marketplace as M, type OutputFormat as O, type DoctorResult as a, DoctorResultSchema as b, ExtractedItemConditionSchema as c, GenerateFileInputSchema as d, ListingGenerationResultSchema as e, OutputFormatSchema as f, conditions as g, marketplaces as m };
