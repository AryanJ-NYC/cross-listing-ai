"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ConditionSchema: () => ConditionSchema,
  DoctorResultSchema: () => DoctorResultSchema,
  ExtractedItemConditionSchema: () => ExtractedItemConditionSchema,
  ExtractedItemSchema: () => ExtractedItemSchema,
  GenerateFileInputSchema: () => GenerateFileInputSchema,
  ListingGenerationResultSchema: () => ListingGenerationResultSchema,
  ListingSchema: () => ListingSchema,
  MarketplaceSchema: () => MarketplaceSchema,
  OutputFormatSchema: () => OutputFormatSchema,
  SkippedMarketplaceSchema: () => SkippedMarketplaceSchema,
  buildCli: () => buildCli,
  conditions: () => conditions,
  generateMarketplaceListings: () => generateMarketplaceListings,
  looksLikeTcgInventory: () => looksLikeTcgInventory,
  marketplaces: () => marketplaces,
  normalizeExtractedItem: () => normalizeExtractedItem,
  normalizeTcgDetails: () => normalizeTcgDetails,
  renderHumanReadable: () => renderHumanReadable,
  runCli: () => runCli,
  schemaVersion: () => schemaVersion
});
module.exports = __toCommonJS(index_exports);

// src/core/schemas.ts
var import_zod = require("zod");
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
var MarketplaceSchema = import_zod.z.enum(marketplaces);
var OutputFormatSchema = import_zod.z.enum(outputFormats);
var ConditionSchema = import_zod.z.enum(conditions);
var ExtractedItemConditionSchema = import_zod.z.union([ConditionSchema, import_zod.z.literal("")]);
var TcgDetailsSchema = import_zod.z.object({
  cardName: import_zod.z.string().min(1).optional(),
  cardNumber: import_zod.z.string().min(1).optional(),
  foil: import_zod.z.boolean().optional(),
  game: import_zod.z.string().min(1).optional(),
  language: import_zod.z.string().min(1).optional(),
  rarity: import_zod.z.string().min(1).optional(),
  set: import_zod.z.string().min(1).optional()
}).strict();
var ExtractedItemSchema = import_zod.z.object({
  attributes: import_zod.z.record(import_zod.z.string(), import_zod.z.string()),
  category: import_zod.z.string(),
  condition: ExtractedItemConditionSchema,
  description: import_zod.z.string(),
  missingFields: import_zod.z.array(import_zod.z.string()),
  tcg: TcgDetailsSchema.optional(),
  title: import_zod.z.string(),
  uncertainties: import_zod.z.array(import_zod.z.string())
}).strict();
var ListingSchema = import_zod.z.object({
  bullets: import_zod.z.array(import_zod.z.string()).optional(),
  copyBlock: import_zod.z.string().min(1),
  description: import_zod.z.string().min(1),
  itemSpecifics: import_zod.z.record(import_zod.z.string(), import_zod.z.string()).optional(),
  marketplace: MarketplaceSchema,
  notesToSeller: import_zod.z.array(import_zod.z.string()),
  title: import_zod.z.string().min(1)
}).strict();
var SkippedMarketplaceSchema = import_zod.z.object({
  marketplace: MarketplaceSchema,
  reason: import_zod.z.string().min(1)
}).strict();
var ListingGenerationResultSchema = import_zod.z.object({
  extractedItem: ExtractedItemSchema,
  humanReadable: import_zod.z.string().min(1),
  listings: import_zod.z.array(ListingSchema),
  schemaVersion: import_zod.z.string().min(1),
  skippedMarketplaces: import_zod.z.array(SkippedMarketplaceSchema),
  status: import_zod.z.enum(["ready", "needs_input"])
}).strict();
var GenerateFileInputSchema = import_zod.z.object({
  extractedItem: ExtractedItemSchema.optional(),
  imageUrls: import_zod.z.array(import_zod.z.string().url()).optional(),
  marketplaces: import_zod.z.array(MarketplaceSchema).optional(),
  output: OutputFormatSchema.optional()
}).strict().superRefine((value, ctx) => {
  if (value.extractedItem && value.imageUrls?.length) {
    ctx.addIssue({
      code: import_zod.z.ZodIssueCode.custom,
      message: "Provide either extractedItem or imageUrls, not both.",
      path: ["imageUrls"]
    });
  }
  if (!value.extractedItem && (!value.imageUrls || value.imageUrls.length === 0)) {
    ctx.addIssue({
      code: import_zod.z.ZodIssueCode.custom,
      message: "Provide either extractedItem or imageUrls.",
      path: ["imageUrls"]
    });
  }
});
var DoctorCheckSchema = import_zod.z.object({
  message: import_zod.z.string().min(1),
  name: import_zod.z.string().min(1),
  status: import_zod.z.enum(["pass", "fail"])
}).strict();
var DoctorResultSchema = import_zod.z.object({
  checks: import_zod.z.array(DoctorCheckSchema),
  humanReadable: import_zod.z.string().min(1),
  ok: import_zod.z.boolean()
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

// src/program.ts
var import_commander = require("commander");

// src/core/api.ts
async function callCrosslistApi(input2, options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = new URL("/api/public/v1/crosslist/generate", resolveApiBaseUrl(options.apiBaseUrl));
  const response = await fetchImpl(endpoint, {
    body: JSON.stringify(
      "imageUrls" in input2 ? {
        image_urls: input2.imageUrls,
        marketplaces: input2.marketplaces
      } : {
        extracted_item: input2.extractedItem,
        marketplaces: input2.marketplaces
      }
    ),
    headers: { "content-type": "application/json" },
    method: "POST"
  });
  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractProblemMessage(responseBody, response.status));
  }
  return ListingGenerationResultSchema.parse({
    extractedItem: responseBody?.data?.extracted_item,
    humanReadable: renderHumanReadable({
      extractedItem: responseBody?.data?.extracted_item,
      listings: responseBody?.data?.listings,
      schemaVersion: responseBody?.data?.schema_version,
      skippedMarketplaces: responseBody?.data?.skipped_marketplaces,
      status: responseBody?.data?.status
    }),
    listings: responseBody?.data?.listings,
    schemaVersion: responseBody?.data?.schema_version,
    skippedMarketplaces: responseBody?.data?.skipped_marketplaces,
    status: responseBody?.data?.status
  });
}
function resolveApiBaseUrl(explicitBaseUrl) {
  return explicitBaseUrl?.trim() || process.env.CROSSLIST_API_BASE_URL?.trim() || defaultApiBaseUrl;
}
function extractProblemMessage(responseBody, status) {
  if (responseBody?.detail) {
    return responseBody.detail;
  }
  if (responseBody?.title) {
    return `${responseBody.title} (${status})`;
  }
  return `Crosslist API request failed with status ${status}.`;
}
var defaultApiBaseUrl = "https://satstash.io";

// src/commands/doctor.ts
async function runDoctor(options = {}) {
  const imageInputs = options.imageInputs ?? [];
  const apiSupportCheck = options.apiSupportCheck ?? defaultApiSupportCheck;
  const reachabilityCheck = options.reachabilityCheck ?? defaultReachabilityCheck;
  const apiBaseUrl = resolveApiBaseUrl(options.apiBaseUrl);
  const checks = [];
  checks.push(checkNodeVersion(options.nodeVersion ?? process.versions.node));
  checks.push(await checkApiBaseUrl(apiBaseUrl, apiSupportCheck));
  for (const input2 of imageInputs) {
    checks.push(await checkImageInput(input2, reachabilityCheck));
  }
  const result = {
    checks,
    humanReadable: checks.map((check) => `[${check.status.toUpperCase()}] ${check.name}: ${check.message}`).join("\n"),
    ok: checks.every((check) => check.status === "pass")
  };
  return DoctorResultSchema.parse(result);
}
async function runDoctorCommand(options, dependencies = {}) {
  const result = await runDoctor({
    apiSupportCheck: dependencies.apiSupportCheck,
    apiBaseUrl: options.apiBaseUrl,
    imageInputs: options.images,
    nodeVersion: dependencies.nodeVersion,
    reachabilityCheck: dependencies.reachabilityCheck
  });
  const requestedOutput = OutputFormatSchema.parse(options.output ?? "text");
  return {
    exitCode: result.ok ? 0 : 1,
    output: formatOutput(result, requestedOutput),
    result
  };
}
async function checkApiBaseUrl(apiBaseUrl, apiSupportCheck) {
  try {
    const url = new URL("/api/public/v1/openapi.json", apiBaseUrl).toString();
    const reachable = await apiSupportCheck(url);
    return {
      message: reachable ? "Public API is reachable and exposes /crosslist/generate." : "Public API could not be reached or does not expose /crosslist/generate.",
      name: `api:${apiBaseUrl}`,
      status: reachable ? "pass" : "fail"
    };
  } catch {
    return {
      message: "API base URL is invalid.",
      name: `api:${apiBaseUrl}`,
      status: "fail"
    };
  }
}
async function checkImageInput(input2, reachabilityCheck) {
  if (!/^https?:\/\//i.test(input2)) {
    return {
      message: "Image extraction is URL-only in v1. Provide a hosted image URL.",
      name: `image:${input2}`,
      status: "fail"
    };
  }
  const reachable = await reachabilityCheck(input2);
  return {
    message: reachable ? "Remote image URL is reachable." : "Remote image URL could not be reached.",
    name: `image:${input2}`,
    status: reachable ? "pass" : "fail"
  };
}
function checkNodeVersion(version) {
  const major = Number.parseInt(version.split(".")[0] ?? "0", 10);
  return {
    message: major >= 20 ? "Node version is supported." : "Node 20 or newer is required.",
    name: "node",
    status: major >= 20 ? "pass" : "fail"
  };
}
async function defaultReachabilityCheck(url) {
  const response = await fetch(url, { method: "HEAD" }).catch(() => null);
  if (response?.ok) {
    return true;
  }
  const fallback = await fetch(url).catch(() => null);
  return fallback?.ok ?? false;
}
async function defaultApiSupportCheck(url) {
  const response = await fetch(url).catch(() => null);
  if (!response?.ok) {
    return false;
  }
  const body = await response.json().catch(() => null);
  return Boolean(body?.paths?.["/crosslist/generate"]);
}
function formatOutput(result, requestedOutput) {
  if (requestedOutput === "json") {
    return JSON.stringify(result, null, 2);
  }
  if (requestedOutput === "text") {
    return result.humanReadable;
  }
  return `${result.humanReadable}

JSON:
${JSON.stringify(result, null, 2)}`;
}

// src/commands/generate.ts
var import_promises = require("fs/promises");

// src/core/review/interactiveReview.ts
var import_prompts = require("@inquirer/prompts");
async function collectInteractiveInputs(dependencies = {
  checkbox: import_prompts.checkbox,
  input: import_prompts.input
}) {
  const images = await dependencies.input({
    message: "Enter hosted image URLs, comma-separated"
  });
  const selectedMarketplaces = await dependencies.checkbox({
    choices: marketplaces.map((marketplace) => ({
      checked: marketplace !== "tcgplayer",
      name: marketplace,
      value: marketplace
    })),
    message: "Select marketplaces to target"
  });
  return {
    imageUrls: images.split(",").map((value) => value.trim()).filter(Boolean),
    marketplaces: selectedMarketplaces
  };
}
async function reviewExtractedItem(item, dependencies = {
  confirm: import_prompts.confirm,
  input: import_prompts.input,
  select: import_prompts.select
}) {
  return reviewExtractedItemWithPrompts(item, dependencies);
}
async function reviewExtractedItemWithPrompts(item, dependencies) {
  const review = {
    ...item,
    attributes: parseAttributes(
      await dependencies.input({
        default: serializeAttributes(item.attributes),
        message: "Attributes (key=value, comma-separated)"
      })
    ),
    category: await dependencies.input({
      default: item.category,
      message: "Category"
    }),
    condition: await dependencies.select({
      choices: [{ name: "unknown", value: "" }, ...conditions.map((condition) => ({ name: condition, value: condition }))],
      default: item.condition || "",
      message: "Condition"
    }),
    description: await dependencies.input({
      default: item.description,
      message: "Description"
    }),
    title: await dependencies.input({
      default: item.title,
      message: "Title"
    })
  };
  const unresolvedUncertainties = parseCommaSeparatedValues(
    await dependencies.input({
      default: item.uncertainties.join(", "),
      message: "Remaining uncertainties (comma-separated, leave blank if none)"
    })
  );
  if (looksLikeTcgInventory(review) || review.tcg) {
    review.tcg = {
      cardName: await dependencies.input({
        default: review.tcg?.cardName ?? "",
        message: "Card name"
      }),
      cardNumber: await dependencies.input({
        default: review.tcg?.cardNumber ?? "",
        message: "Card number"
      }),
      foil: await dependencies.confirm({
        default: review.tcg?.foil ?? false,
        message: "Foil finish?"
      }),
      game: await dependencies.input({
        default: review.tcg?.game ?? "",
        message: "Game"
      }),
      language: await dependencies.input({
        default: review.tcg?.language ?? "English",
        message: "Language"
      }),
      rarity: await dependencies.input({
        default: review.tcg?.rarity ?? "",
        message: "Rarity"
      }),
      set: await dependencies.input({
        default: review.tcg?.set ?? "",
        message: "Set"
      })
    };
  }
  return refreshSignals(review, unresolvedUncertainties);
}
function refreshSignals(item, uncertainties) {
  return normalizeExtractedItem({
    ...item,
    missingFields: [...requiredFieldChecks2(item), ...requiredTcgFieldChecks2(item)],
    uncertainties
  });
}
function requiredFieldChecks2(item) {
  return [
    ["title", item.title],
    ["description", item.description],
    ["condition", item.condition],
    ["category", item.category]
  ].filter(([, value]) => !String(value).trim()).map(([field]) => field);
}
function requiredTcgFieldChecks2(item) {
  if (!looksLikeTcgInventory(item)) {
    return [];
  }
  return [
    ["tcg.cardName", item.tcg?.cardName ?? ""],
    ["tcg.game", item.tcg?.game ?? ""],
    ["tcg.set", item.tcg?.set ?? ""]
  ].filter(([, value]) => !String(value).trim()).map(([field]) => field);
}
function parseAttributes(value) {
  return Object.fromEntries(
    value.split(",").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) {
        return [entry, ""];
      }
      return [entry.slice(0, separatorIndex).trim(), entry.slice(separatorIndex + 1).trim()];
    }).filter(([key, entryValue]) => key && entryValue)
  );
}
function parseCommaSeparatedValues(value) {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}
function serializeAttributes(attributes) {
  return Object.entries(attributes).map(([key, value]) => `${key}=${value}`).join(", ");
}

// src/commands/generate.ts
async function runGenerateCommand(options, dependencies = {}) {
  const readTextFile = dependencies.readTextFile ?? ((path) => (0, import_promises.readFile)(path, "utf8"));
  const reviewer = dependencies.reviewer ?? reviewExtractedItem;
  const collectInputs = dependencies.collectInputs ?? collectInteractiveInputs;
  const requested = await resolveRequestedInput(options, readTextFile, collectInputs);
  const requestedOutput = OutputFormatSchema.parse(
    options.output ?? requested.output ?? defaultOutputFormat(options.interactive)
  );
  const result = options.interactive ? await callCrosslistApi(
    {
      extractedItem: await reviewer(
        requested.extractedItem ?? (await callCrosslistApi(
          {
            imageUrls: assertRemoteImageUrls(requested.imageUrls),
            marketplaces: requested.marketplaces
          },
          {
            apiBaseUrl: options.apiBaseUrl,
            fetchImpl: dependencies.fetchImpl
          }
        )).extractedItem
      ),
      marketplaces: requested.marketplaces
    },
    {
      apiBaseUrl: options.apiBaseUrl,
      fetchImpl: dependencies.fetchImpl
    }
  ) : requested.extractedItem ? await callCrosslistApi(
    {
      extractedItem: requested.extractedItem,
      marketplaces: requested.marketplaces
    },
    {
      apiBaseUrl: options.apiBaseUrl,
      fetchImpl: dependencies.fetchImpl
    }
  ) : await callCrosslistApi(
    {
      imageUrls: assertRemoteImageUrls(requested.imageUrls),
      marketplaces: requested.marketplaces
    },
    {
      apiBaseUrl: options.apiBaseUrl,
      fetchImpl: dependencies.fetchImpl
    }
  );
  return {
    exitCode: result.status === "ready" ? 0 : 1,
    output: formatOutput2(result, requestedOutput),
    result
  };
}
async function resolveRequestedInput(options, readTextFile, collectInputs) {
  if (options.input) {
    const parsed = GenerateFileInputSchema.parse(JSON.parse(await readTextFile(options.input)));
    return {
      extractedItem: parsed.extractedItem,
      imageUrls: parsed.imageUrls ?? [],
      marketplaces: assertMarketplaces(
        options.marketplaces ? parseMarketplaces(options.marketplaces) : parsed.marketplaces ?? [...marketplaces]
      ),
      output: parsed.output
    };
  }
  if (options.interactive && (!options.images || options.images.length === 0)) {
    const interactive = await collectInputs();
    return {
      imageUrls: interactive.imageUrls,
      marketplaces: assertMarketplaces(
        options.marketplaces ? parseMarketplaces(options.marketplaces) : interactive.marketplaces
      )
    };
  }
  return {
    imageUrls: options.images ?? [],
    marketplaces: assertMarketplaces(parseMarketplaces(options.marketplaces))
  };
}
function parseMarketplaces(value) {
  if (!value) {
    return [...marketplaces];
  }
  const requested = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  const valid = requested.filter((entry) => marketplaces.includes(entry));
  const invalid = requested.filter((entry) => !marketplaces.includes(entry));
  if (invalid.length > 0) {
    throw new Error(`Invalid marketplaces: ${invalid.join(", ")}`);
  }
  return valid;
}
function formatOutput2(result, requestedOutput) {
  if (requestedOutput === "json") {
    return JSON.stringify(toSerializableResult(result, false), null, 2);
  }
  if (requestedOutput === "text") {
    return result.humanReadable;
  }
  return `${result.humanReadable}

JSON:
${JSON.stringify(toSerializableResult(result, true), null, 2)}`;
}
function defaultOutputFormat(interactive) {
  return interactive ? "text" : "json";
}
function toSerializableResult(result, includeHumanReadable) {
  if (includeHumanReadable) {
    return result;
  }
  const { humanReadable, ...jsonSafeResult } = result;
  void humanReadable;
  return jsonSafeResult;
}
function assertMarketplaces(requested) {
  if (requested.length === 0) {
    throw new Error("Select at least one marketplace.");
  }
  return requested;
}
function assertRemoteImageUrls(imageUrls) {
  if (imageUrls.length === 0) {
    throw new Error("Provide --images, --input, or --interactive.");
  }
  const localInputs = imageUrls.filter((imageUrl) => !/^https?:\/\//i.test(imageUrl));
  if (localInputs.length > 0) {
    throw new Error("Image extraction is URL-only in v1. Provide hosted image URLs instead of local file paths.");
  }
  return imageUrls;
}

// src/program.ts
function buildCli(dependencies = {}) {
  const writeStdout = dependencies.stdout?.write.bind(dependencies.stdout) ?? process.stdout.write.bind(process.stdout);
  const writeStderr = dependencies.stderr?.write.bind(dependencies.stderr) ?? process.stderr.write.bind(process.stderr);
  const setExitCode = dependencies.setExitCode ?? ((value) => {
    process.exitCode = value;
  });
  const runGenerate = dependencies.runGenerateCommand ?? runGenerateCommand;
  const runDoctor2 = dependencies.runDoctorCommand ?? runDoctorCommand;
  const program = new import_commander.Command();
  program.name("crosslist").description("Generate cross-marketplace listing copy from hosted product images.").version("1.0.0");
  program.command("generate").description("Generate marketplace-ready listings from hosted image URLs or a JSON input file.").option("--interactive", "Run the seller review flow").option("--images <images...>", "Hosted image URLs").option("--input <path>", "Path to a JSON input file").option("--marketplaces <marketplaces>", "Comma-separated marketplaces").option("--output <format>", "text, json, or both").option("--api-base-url <url>", "Override the SatStash API base URL").action(async (options) => {
    await runCommand(async () => {
      const result = await runGenerate(options);
      writeStdout(`${result.output}
`);
      setExitCode(result.exitCode);
    }, writeStderr, setExitCode);
  });
  program.command("doctor").description("Check runtime prerequisites for crosslist.").argument("[images...]", "Optional hosted image URLs to validate").option("--images <images...>", "Hosted image URLs").option("--output <format>", "text, json, or both", "text").option("--api-base-url <url>", "Override the SatStash API base URL").action(async (images, options) => {
    await runCommand(async () => {
      const result = await runDoctor2({
        apiBaseUrl: options.apiBaseUrl,
        images: [...images, ...options.images ?? []],
        output: options.output
      });
      writeStdout(`${result.output}
`);
      setExitCode(result.exitCode);
    }, writeStderr, setExitCode);
  });
  return program;
}
async function runCli(argv = process.argv) {
  await buildCli().parseAsync(argv);
}
async function runCommand(action, writeStderr, setExitCode) {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeStderr(`Error: ${message}
`);
    setExitCode(1);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ConditionSchema,
  DoctorResultSchema,
  ExtractedItemConditionSchema,
  ExtractedItemSchema,
  GenerateFileInputSchema,
  ListingGenerationResultSchema,
  ListingSchema,
  MarketplaceSchema,
  OutputFormatSchema,
  SkippedMarketplaceSchema,
  buildCli,
  conditions,
  generateMarketplaceListings,
  looksLikeTcgInventory,
  marketplaces,
  normalizeExtractedItem,
  normalizeTcgDetails,
  renderHumanReadable,
  runCli,
  schemaVersion
});
//# sourceMappingURL=index.cjs.map