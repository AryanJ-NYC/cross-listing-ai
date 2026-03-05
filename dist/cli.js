#!/usr/bin/env node

// src/cli.ts
import { fileURLToPath } from "url";
import { Command } from "commander";

// src/commands/doctor.ts
import { stat } from "fs/promises";

// src/core/providers/openai.ts
import { readFile } from "fs/promises";
import { extname } from "path";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z as z2 } from "zod";

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
  category: z.string().min(1),
  condition: ConditionSchema,
  description: z.string().min(1),
  missingFields: z.array(z.string()),
  tcg: TcgDetailsSchema.optional(),
  title: z.string().min(1),
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
  images: z.array(z.string()).optional(),
  marketplaces: z.array(MarketplaceSchema).optional(),
  output: OutputFormatSchema.optional()
}).strict().superRefine((value, ctx) => {
  if (!value.extractedItem && (!value.images || value.images.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide either extractedItem or images.",
      path: ["images"]
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

// src/core/providers/openai.ts
var supportedImageExtensions = [".jpg", ".jpeg", ".png", ".webp"];
function isSupportedLocalImagePath(filePath) {
  return supportedImageExtensions.includes(extname(filePath).toLowerCase());
}
var OpenAIExtractedItemSchema = z2.object({
  attributes: z2.record(z2.string(), z2.string()),
  category: z2.string().min(1),
  condition: ConditionSchema,
  description: z2.string().min(1),
  missingFields: z2.array(z2.string()),
  tcg: z2.object({
    cardName: z2.string().nullable(),
    cardNumber: z2.string().nullable(),
    foil: z2.boolean().nullable(),
    game: z2.string().nullable(),
    language: z2.string().nullable(),
    rarity: z2.string().nullable(),
    set: z2.string().nullable()
  }).strict().nullable(),
  title: z2.string().min(1),
  uncertainties: z2.array(z2.string())
}).strict();
var OpenAIItemExtractionProvider = class {
  constructor(client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }), model = "gpt-4.1-mini") {
    this.client = client;
    this.model = model;
  }
  async extractFromImages(imageInputs) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required to extract item details from images.");
    }
    const completion = await this.client.chat.completions.parse({
      messages: [
        {
          role: "system",
          content: "You extract structured seller listing data from product photos. Use US English. Never invent facts. Unknown fields must stay missing and be reflected in missingFields or uncertainties."
        },
        {
          role: "user",
          content: [
            {
              text: "Review these product images and extract a listing title, description, condition, category, attributes, missing fields, uncertainties, and optional trading card fields when relevant.",
              type: "text"
            },
            ...await Promise.all(imageInputs.map((input2) => toImagePart(input2)))
          ]
        }
      ],
      model: this.model,
      response_format: zodResponseFormat(OpenAIExtractedItemSchema, "crosslist_extracted_item")
    });
    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error("OpenAI did not return structured extraction data.");
    }
    return ExtractedItemSchema.parse({
      ...parsed,
      tcg: normalizeTcgDetails(parsed.tcg)
    });
  }
};
async function toImagePart(input2) {
  return {
    image_url: {
      url: isRemoteUrl(input2) ? input2 : await toDataUrl(input2)
    },
    type: "image_url"
  };
}
function isRemoteUrl(input2) {
  return /^https?:\/\//i.test(input2);
}
async function toDataUrl(filePath) {
  const bytes = await readFile(filePath);
  const mimeType = mimeTypeFor(filePath);
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}
function mimeTypeFor(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
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

// src/commands/doctor.ts
async function runDoctor(options = {}) {
  const env = options.env ?? process.env;
  const reachabilityCheck = options.reachabilityCheck ?? defaultReachabilityCheck;
  const checks = [];
  checks.push(checkNodeVersion(options.nodeVersion ?? process.versions.node));
  checks.push(checkEnvVar("OPENAI_API_KEY", env.OPENAI_API_KEY));
  for (const input2 of options.imageInputs ?? []) {
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
    env: dependencies.env,
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
async function checkImageInput(input2, reachabilityCheck) {
  if (/^https?:\/\//i.test(input2)) {
    const reachable = await reachabilityCheck(input2);
    return {
      message: reachable ? "Remote image URL is reachable." : "Remote image URL could not be reached.",
      name: `image:${input2}`,
      status: reachable ? "pass" : "fail"
    };
  }
  const details = await stat(input2).catch(() => null);
  if (!details) {
    return {
      message: "Local image file was not found.",
      name: `image:${input2}`,
      status: "fail"
    };
  }
  if (!details.isFile()) {
    return {
      message: "Local image path must point to a file, not a directory.",
      name: `image:${input2}`,
      status: "fail"
    };
  }
  if (!isSupportedLocalImagePath(input2)) {
    return {
      message: "Local image must use .jpg, .jpeg, .png, or .webp.",
      name: `image:${input2}`,
      status: "fail"
    };
  }
  return {
    message: "Local image file exists and uses a supported format.",
    name: `image:${input2}`,
    status: "pass"
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
function checkEnvVar(name, value) {
  const configured = Boolean(value?.trim());
  return {
    message: configured ? `${name} is configured.` : `${name} is missing.`,
    name,
    status: configured ? "pass" : "fail"
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
import { readFile as readFile2 } from "fs/promises";

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
function normalizeValue(value) {
  return value.trim().toLowerCase();
}
function matchesAnyKeyword(value, keywords) {
  return keywords.some((keyword) => value.includes(keyword));
}

// src/core/renderHumanReadable.ts
function renderHumanReadable(result) {
  const sections = [
    `Status: ${result.status}`,
    renderIssueSummary(result),
    ...result.listings.map((listing) => {
      return [
        "",
        headingFor(listing.marketplace),
        "",
        listing.copyBlock
      ].join("\n");
    })
  ];
  if (result.listings.length === 0) {
    sections.push("", "No listing copy generated yet.");
  }
  if (result.skippedMarketplaces.length > 0) {
    sections.push(
      "",
      "Skipped marketplaces:",
      ...result.skippedMarketplaces.map(
        (entry) => `- ${headingFor(entry.marketplace)}: ${entry.reason}`
      )
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
    description: listing.description.slice(0, 5e3),
    copyBlock: listing.copyBlock.slice(0, 7e3)
  };
}

// src/core/generateMarketplaceListings.ts
function generateMarketplaceListings(extractedItem, requestedMarketplaces) {
  if (extractedItem.missingFields.length > 0 || extractedItem.uncertainties.length > 0) {
    return ListingGenerationResultSchema.parse({
      extractedItem,
      humanReadable: renderHumanReadable({
        extractedItem,
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
  for (const marketplace of new Set(requestedMarketplaces)) {
    if (marketplace === "tcgplayer") {
      const tcg = detectTcgEligibility(extractedItem);
      if (!tcg.eligible) {
        skippedMarketplaces.push({ marketplace, reason: tcg.reason });
        continue;
      }
      listings.push(renderTcgplayerListing(extractedItem));
      continue;
    }
    listings.push(renderListing(marketplace, extractedItem));
  }
  const status = listings.length > 0 ? "ready" : "needs_input";
  return ListingGenerationResultSchema.parse({
    extractedItem,
    humanReadable: renderHumanReadable({
      extractedItem,
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

// src/core/review/interactiveReview.ts
import { checkbox, confirm, input, select } from "@inquirer/prompts";
async function collectInteractiveInputs(dependencies = {
  checkbox,
  input
}) {
  const images = await dependencies.input({
    message: "Enter local image paths or image URLs, comma-separated"
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
    images: images.split(",").map((value) => value.trim()).filter(Boolean),
    marketplaces: selectedMarketplaces
  };
}
async function reviewExtractedItem(item, dependencies = {
  confirm,
  input,
  select
}) {
  return reviewExtractedItemWithPrompts(item, dependencies);
}
async function reviewExtractedItemWithPrompts(item, dependencies) {
  const review = {
    ...item,
    category: await dependencies.input({
      default: item.category,
      message: "Category"
    }),
    condition: await dependencies.select({
      choices: conditions.map((condition) => ({ name: condition, value: condition })),
      default: item.condition,
      message: "Condition"
    }),
    description: await dependencies.input({
      default: item.description,
      message: "Description"
    }),
    title: await dependencies.input({
      default: item.title,
      message: "Title"
    }),
    attributes: parseAttributes(
      await dependencies.input({
        default: serializeAttributes(item.attributes),
        message: "Attributes (key=value, comma-separated)"
      })
    )
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
  const missingFields = [...requiredFieldChecks(item), ...requiredTcgFieldChecks(item)];
  return {
    ...item,
    missingFields,
    uncertainties
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
  const readTextFile = dependencies.readTextFile ?? ((path) => readFile2(path, "utf8"));
  const reviewer = dependencies.reviewer ?? reviewExtractedItem;
  const collectInputs = dependencies.collectInputs ?? collectInteractiveInputs;
  const requested = await resolveRequestedInput(options, readTextFile, collectInputs);
  const requestedOutput = OutputFormatSchema.parse(
    options.output ?? requested.output ?? defaultOutputFormat(options.interactive)
  );
  const extractedItem = requested.extractedItem ?? await (dependencies.extractor ?? new OpenAIItemExtractionProvider()).extractFromImages(
    requested.images
  );
  const reviewedItem = options.interactive ? await reviewer(extractedItem) : extractedItem;
  const result = generateMarketplaceListings(reviewedItem, requested.marketplaces);
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
      images: parsed.images ?? [],
      marketplaces: assertMarketplaces(parsed.marketplaces ?? [...marketplaces]),
      output: parsed.output
    };
  }
  if (options.interactive && (!options.images || options.images.length === 0)) {
    const interactive = await collectInputs();
    return {
      images: assertImages(interactive.images),
      marketplaces: assertMarketplaces(
        interactive.marketplaces.length > 0 ? parseMarketplaces(interactive.marketplaces.join(",")) : [...marketplaces]
      )
    };
  }
  return {
    images: assertImages(options.images ?? []),
    marketplaces: assertMarketplaces(parseMarketplaces(options.marketplaces))
  };
}
function parseMarketplaces(value) {
  if (!value) {
    return [...marketplaces];
  }
  const requested = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  const valid = requested.filter(
    (entry) => marketplaces.includes(entry)
  );
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
function assertImages(images) {
  if (images.length === 0) {
    throw new Error("Provide --images, --input, or --interactive.");
  }
  return images;
}
function assertMarketplaces(requested) {
  if (requested.length === 0) {
    throw new Error("Select at least one marketplace.");
  }
  return requested;
}

// src/cli.ts
function buildCli(dependencies = {}) {
  const writeStdout = dependencies.stdout?.write.bind(dependencies.stdout) ?? process.stdout.write.bind(process.stdout);
  const writeStderr = dependencies.stderr?.write.bind(dependencies.stderr) ?? process.stderr.write.bind(process.stderr);
  const setExitCode = dependencies.setExitCode ?? ((value) => {
    process.exitCode = value;
  });
  const runGenerate = dependencies.runGenerateCommand ?? runGenerateCommand;
  const runDoctor2 = dependencies.runDoctorCommand ?? runDoctorCommand;
  const program = new Command();
  program.name("crosslist").description("Generate cross-marketplace listing copy from product images.").version("1.0.0");
  program.command("generate").description("Generate marketplace-ready listings from images or a JSON input file.").option("--interactive", "Run the seller review flow").option("--images <images...>", "Local image paths or remote URLs").option("--input <path>", "Path to a JSON input file").option("--marketplaces <marketplaces>", "Comma-separated marketplaces").option("--output <format>", "text, json, or both").action(async (options) => {
    await runCommand(async () => {
      const result = await runGenerate(options);
      writeStdout(`${result.output}
`);
      setExitCode(result.exitCode);
    }, writeStderr, setExitCode);
  });
  program.command("doctor").description("Check runtime prerequisites for crosslist.").argument("[images...]", "Optional images to validate").option("--images <images...>", "Local image paths or remote URLs").option("--output <format>", "text, json, or both", "text").action(async (images, options) => {
    await runCommand(async () => {
      const result = await runDoctor2({
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
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void runCli();
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
export {
  buildCli,
  runCli
};
//# sourceMappingURL=cli.js.map