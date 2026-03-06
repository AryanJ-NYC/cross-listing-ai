// src/core/schemas.ts
import { z } from "zod";
var schemaVersion = "1.0.0";
var marketplaces = [
  "ebay",
  "mercari",
  "facebook-marketplace",
  "craigslist",
  "tcgplayer"
];
var outputFormats = ["text", "json", "both"];
var conditions = [
  "brand new",
  "like new",
  "very good",
  "good",
  "acceptable",
  "for parts or not working"
];
var MarketplaceSchema = z.enum(marketplaces);
var OutputFormatSchema = z.enum(outputFormats);
var ConditionSchema = z.enum(conditions);
var ExtractedItemConditionSchema = z.union([ConditionSchema, z.literal("")]);
var TcgDetailsSchema = z.object({
  cardName: z.string().min(1).optional(),
  cardNumber: z.string().min(1).optional(),
  foil: z.boolean().optional(),
  game: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  rarity: z.string().min(1).optional(),
  set: z.string().min(1).optional()
}).strict();
var ExtractedItemSchema = z.object({
  attributes: z.record(z.string(), z.string()),
  category: z.string(),
  condition: ExtractedItemConditionSchema,
  description: z.string(),
  missingFields: z.array(z.string()),
  tcg: TcgDetailsSchema.optional(),
  title: z.string(),
  uncertainties: z.array(z.string())
}).strict();
var ListingSchema = z.object({
  bullets: z.array(z.string()).optional(),
  copyBlock: z.string().min(1),
  description: z.string().min(1),
  itemSpecifics: z.record(z.string(), z.string()).optional(),
  marketplace: MarketplaceSchema,
  notesToSeller: z.array(z.string()),
  title: z.string().min(1)
}).strict();
var SkippedMarketplaceSchema = z.object({
  marketplace: MarketplaceSchema,
  reason: z.string().min(1)
}).strict();
var ListingGenerationResultSchema = z.object({
  extractedItem: ExtractedItemSchema,
  humanReadable: z.string().min(1),
  listings: z.array(ListingSchema),
  schemaVersion: z.string().min(1),
  skippedMarketplaces: z.array(SkippedMarketplaceSchema),
  status: z.enum(["ready", "needs_input"])
}).strict();
var GenerateFileInputSchema = z.object({
  extractedItem: ExtractedItemSchema.optional(),
  imageUrls: z.array(z.string().url()).optional(),
  marketplaces: z.array(MarketplaceSchema).optional(),
  output: OutputFormatSchema.optional()
}).strict().superRefine((value, ctx) => {
  if (value.extractedItem && value.imageUrls?.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide either extractedItem or imageUrls, not both.",
      path: ["imageUrls"]
    });
  }
  if (!value.extractedItem && (!value.imageUrls || value.imageUrls.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide either extractedItem or imageUrls.",
      path: ["imageUrls"]
    });
  }
});
var DoctorCheckSchema = z.object({
  message: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["pass", "fail"])
}).strict();
var DoctorResultSchema = z.object({
  checks: z.array(DoctorCheckSchema),
  humanReadable: z.string().min(1),
  ok: z.boolean()
}).strict();

// src/core/detectTcgEligibility.ts
function detectTcgEligibility(item) {
  const tcg = item.tcg;
  const hasRequiredFields = Boolean(tcg?.cardName?.trim() && tcg?.game?.trim() && tcg?.set?.trim());
  if (looksLikeTcgInventory(item) && hasRequiredFields) {
    return { eligible: true };
  }
  return {
    eligible: false,
    reason: "TCGPlayer is only available for trading card inventory with card-specific data."
  };
}
function looksLikeTcgInventory(item) {
  const category = normalizeValue(item.category);
  const game = normalizeValue(item.tcg?.game ?? "");
  return matchesAnyKeyword(category, tcgCategoryKeywords) || matchesAnyKeyword(game, tcgGameKeywords);
}
function normalizeValue(value) {
  return value.trim().toLowerCase();
}
function matchesAnyKeyword(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}
var tcgCategoryKeywords = [
  "trading card",
  "trading-card",
  "tcg",
  "ccg",
  "pokemon card",
  "pokemon",
  "magic the gathering",
  "mtg",
  "yu-gi-oh",
  "yugioh",
  "lorcana",
  "digimon",
  "flesh and blood",
  "one piece",
  "dragon ball",
  "star wars unlimited"
];
var tcgGameKeywords = [
  "pokemon",
  "magic",
  "mtg",
  "yu-gi-oh",
  "yugioh",
  "lorcana",
  "digimon",
  "flesh and blood",
  "one piece",
  "dragon ball",
  "star wars unlimited"
];

// src/core/renderHumanReadable.ts
function renderHumanReadable(result) {
  const sections = [
    `Status: ${result.status}`,
    renderIssueSummary(result),
    ...result.listings.map((listing) => ["", headingFor(listing.marketplace), "", listing.copyBlock].join("\n"))
  ];
  if (result.listings.length === 0) {
    sections.push("", "No listing copy generated yet.");
  }
  if (result.skippedMarketplaces.length > 0) {
    sections.push(
      "",
      "Skipped marketplaces:",
      ...result.skippedMarketplaces.map((entry) => `- ${headingFor(entry.marketplace)}: ${entry.reason}`)
    );
  }
  return sections.filter(Boolean).join("\n");
}
function renderIssueSummary(result) {
  const issues = [
    ...result.extractedItem.missingFields.map((field) => `Missing: ${field}`),
    ...result.extractedItem.uncertainties.map((field) => `Uncertain: ${field}`)
  ];
  return issues.length === 0 ? "" : issues.join("\n");
}
function headingFor(marketplace) {
  switch (marketplace) {
    case "ebay":
      return "eBay";
    case "mercari":
      return "Mercari";
    case "facebook-marketplace":
      return "Facebook Marketplace";
    case "craigslist":
      return "Craigslist";
    case "tcgplayer":
      return "TCGPlayer";
    default:
      return marketplace;
  }
}

// src/core/normalizeExtractedItem.ts
function normalizeExtractedItem(item) {
  const normalizedTcg = normalizeTcgDetails(item.tcg);
  return {
    ...item,
    ...normalizedTcg ? { tcg: normalizedTcg } : {},
    ...!normalizedTcg && item.tcg ? { tcg: void 0 } : {}
  };
}
function normalizeTcgDetails(value) {
  if (!value) {
    return void 0;
  }
  const normalizedEntries = Object.entries(value).filter(([, entry]) => {
    if (typeof entry === "boolean") {
      return true;
    }
    return Boolean(entry?.trim());
  });
  if (normalizedEntries.length === 0) {
    return void 0;
  }
  return TcgDetailsSchema.parse(Object.fromEntries(normalizedEntries));
}

// src/core/marketplaces/shared.ts
function buildBaseListing(marketplace, item, options) {
  const title = clampTitle([options.titlePrefix, item.title].filter(Boolean).join(" "), options.maxTitleLength);
  const bullets = buildBullets(item);
  const itemSpecifics = buildItemSpecifics(item);
  const description = [item.description, bullets.map((bullet) => `- ${bullet}`).join("\n")].join("\n\n");
  const notesToSeller = options.notesToSeller ?? [];
  return {
    bullets,
    copyBlock: buildCopyBlock(title, description, itemSpecifics, notesToSeller),
    description,
    itemSpecifics,
    marketplace,
    notesToSeller,
    title
  };
}
function buildBullets(item) {
  return Object.entries(item.attributes).slice(0, 4).map(([key, value]) => `${startCase(key)}: ${value}`);
}
function buildCopyBlock(title, description, itemSpecifics, notesToSeller) {
  const specificsBlock = Object.entries(itemSpecifics).map(([key, value]) => `${key}: ${value}`).join("\n");
  const notesBlock = notesToSeller.length === 0 ? "" : `

Notes to seller:
${notesToSeller.map((note) => `- ${note}`).join("\n")}`;
  return `Title: ${title}

Description:
${description}

Item specifics:
${specificsBlock}${notesBlock}`;
}
function buildItemSpecifics(item) {
  const specifics = {
    Category: item.category,
    Condition: startCase(item.condition)
  };
  for (const [key, value] of Object.entries(item.attributes)) {
    specifics[startCase(key)] = value;
  }
  return specifics;
}
function clampTitle(value, maxLength) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  const truncated = normalized.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim();
}
function startCase(value) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

// src/core/marketplaces/craigslist.ts
function renderCraigslistListing(item) {
  return buildBaseListing("craigslist", item, {
    maxTitleLength: 120,
    notesToSeller: ["Add location, contact preference, and delivery notes before posting to Craigslist."]
  });
}

// src/core/marketplaces/ebay.ts
function renderEbayListing(item) {
  return buildBaseListing("ebay", item, {
    maxTitleLength: 80,
    notesToSeller: ["Review shipping profile and item specifics before posting to eBay."]
  });
}

// src/core/marketplaces/facebookMarketplace.ts
function renderFacebookMarketplaceListing(item) {
  return buildBaseListing("facebook-marketplace", item, {
    maxTitleLength: 100,
    notesToSeller: ["Add pickup or delivery details in the Facebook Marketplace form."]
  });
}

// src/core/marketplaces/mercari.ts
function renderMercariListing(item) {
  return buildBaseListing("mercari", item, {
    maxTitleLength: 80,
    notesToSeller: ["Double-check Mercari category mapping and shipping method before posting."]
  });
}

// src/core/marketplaces/tcgplayer.ts
function renderTcgplayerListing(item) {
  const listing = buildBaseListing("tcgplayer", item, {
    maxTitleLength: 255,
    notesToSeller: ["Confirm print, language, and finish match the card before posting to TCGPlayer."]
  });
  return {
    ...listing,
    copyBlock: listing.copyBlock.slice(0, 7e3),
    description: listing.description.slice(0, 5e3)
  };
}

// src/core/generateMarketplaceListings.ts
function generateMarketplaceListings(extractedItem, requestedMarketplaces) {
  const normalizedItem = withRequiredSignals(normalizeExtractedItem(extractedItem));
  if (normalizedItem.missingFields.length > 0 || normalizedItem.uncertainties.length > 0) {
    return ListingGenerationResultSchema.parse({
      extractedItem: normalizedItem,
      humanReadable: renderHumanReadable({
        extractedItem: normalizedItem,
        listings: [],
        schemaVersion,
        skippedMarketplaces: [],
        status: "needs_input"
      }),
      listings: [],
      schemaVersion,
      skippedMarketplaces: [],
      status: "needs_input"
    });
  }
  const listings = [];
  const skippedMarketplaces = [];
  for (const marketplace of Array.from(new Set(requestedMarketplaces))) {
    if (marketplace === "tcgplayer") {
      const tcg = detectTcgEligibility(normalizedItem);
      if (!tcg.eligible) {
        skippedMarketplaces.push({ marketplace, reason: tcg.reason });
        continue;
      }
      listings.push(renderTcgplayerListing(normalizedItem));
      continue;
    }
    listings.push(renderListing(marketplace, normalizedItem));
  }
  const status = listings.length > 0 ? "ready" : "needs_input";
  return ListingGenerationResultSchema.parse({
    extractedItem: normalizedItem,
    humanReadable: renderHumanReadable({
      extractedItem: normalizedItem,
      listings,
      schemaVersion,
      skippedMarketplaces,
      status
    }),
    listings,
    schemaVersion,
    skippedMarketplaces,
    status
  });
}
function renderListing(marketplace, item) {
  switch (marketplace) {
    case "ebay":
      return renderEbayListing(item);
    case "mercari":
      return renderMercariListing(item);
    case "facebook-marketplace":
      return renderFacebookMarketplaceListing(item);
    case "craigslist":
      return renderCraigslistListing(item);
  }
}
function withRequiredSignals(item) {
  return {
    ...item,
    missingFields: Array.from(
      /* @__PURE__ */ new Set([...item.missingFields, ...requiredFieldChecks(item), ...requiredTcgFieldChecks(item)])
    )
  };
}
function requiredFieldChecks(item) {
  return [
    ["title", item.title],
    ["description", item.description],
    ["condition", item.condition],
    ["category", item.category]
  ].filter(([, value]) => !String(value).trim()).map(([field]) => field);
}
function requiredTcgFieldChecks(item) {
  if (!looksLikeTcgInventory(item)) {
    return [];
  }
  return [
    ["tcg.cardName", item.tcg?.cardName ?? ""],
    ["tcg.game", item.tcg?.game ?? ""],
    ["tcg.set", item.tcg?.set ?? ""]
  ].filter(([, value]) => !String(value).trim()).map(([field]) => field);
}

export {
  marketplaces,
  conditions,
  OutputFormatSchema,
  ExtractedItemConditionSchema,
  ListingGenerationResultSchema,
  GenerateFileInputSchema,
  DoctorResultSchema,
  looksLikeTcgInventory,
  renderHumanReadable,
  normalizeExtractedItem,
  normalizeTcgDetails,
  generateMarketplaceListings
};
//# sourceMappingURL=chunk-PE47LNGQ.js.map