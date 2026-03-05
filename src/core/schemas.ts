import { z } from 'zod';

export const schemaVersion = '1.0.0';

export const marketplaces = [
  'ebay',
  'mercari',
  'facebook-marketplace',
  'craigslist',
  'tcgplayer',
] as const;

export const outputFormats = ['text', 'json', 'both'] as const;

export const conditions = [
  'brand new',
  'like new',
  'very good',
  'good',
  'acceptable',
  'for parts or not working',
] as const;

export const MarketplaceSchema = z.enum(marketplaces);
export const OutputFormatSchema = z.enum(outputFormats);
export const ConditionSchema = z.enum(conditions);

export const TcgDetailsSchema = z
  .object({
    cardName: z.string().min(1).optional(),
    cardNumber: z.string().min(1).optional(),
    foil: z.boolean().optional(),
    game: z.string().min(1).optional(),
    language: z.string().min(1).optional(),
    rarity: z.string().min(1).optional(),
    set: z.string().min(1).optional(),
  })
  .strict();

export const ExtractedItemSchema = z
  .object({
    attributes: z.record(z.string(), z.string()),
    category: z.string().min(1),
    condition: ConditionSchema,
    description: z.string().min(1),
    missingFields: z.array(z.string()),
    tcg: TcgDetailsSchema.optional(),
    title: z.string().min(1),
    uncertainties: z.array(z.string()),
  })
  .strict();

export const ListingSchema = z
  .object({
    bullets: z.array(z.string()).optional(),
    copyBlock: z.string().min(1),
    description: z.string().min(1),
    itemSpecifics: z.record(z.string(), z.string()).optional(),
    marketplace: MarketplaceSchema,
    notesToSeller: z.array(z.string()),
    title: z.string().min(1),
  })
  .strict();

export const SkippedMarketplaceSchema = z
  .object({
    marketplace: MarketplaceSchema,
    reason: z.string().min(1),
  })
  .strict();

export const ListingGenerationResultSchema = z
  .object({
    extractedItem: ExtractedItemSchema,
    humanReadable: z.string().min(1),
    listings: z.array(ListingSchema),
    schemaVersion: z.string().min(1),
    skippedMarketplaces: z.array(SkippedMarketplaceSchema),
    status: z.enum(['ready', 'needs_input']),
  })
  .strict();

export const GenerateFileInputSchema = z
  .object({
    extractedItem: ExtractedItemSchema.optional(),
    images: z.array(z.string()).optional(),
    marketplaces: z.array(MarketplaceSchema).optional(),
    output: OutputFormatSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.extractedItem && (!value.images || value.images.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide either extractedItem or images.',
        path: ['images'],
      });
    }
  });

export const DoctorCheckSchema = z
  .object({
    message: z.string().min(1),
    name: z.string().min(1),
    status: z.enum(['pass', 'fail']),
  })
  .strict();

export const DoctorResultSchema = z
  .object({
    checks: z.array(DoctorCheckSchema),
    humanReadable: z.string().min(1),
    ok: z.boolean(),
  })
  .strict();

export type Condition = z.infer<typeof ConditionSchema>;
export type DoctorCheck = z.infer<typeof DoctorCheckSchema>;
export type DoctorResult = z.infer<typeof DoctorResultSchema>;
export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;
export type GenerateFileInput = z.infer<typeof GenerateFileInputSchema>;
export type Listing = z.infer<typeof ListingSchema>;
export type ListingGenerationResult = z.infer<typeof ListingGenerationResultSchema>;
export type Marketplace = z.infer<typeof MarketplaceSchema>;
export type OutputFormat = z.infer<typeof OutputFormatSchema>;
