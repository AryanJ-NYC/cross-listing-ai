#!/usr/bin/env node
import {
  DoctorResultSchema,
  GenerateFileInputSchema,
  ListingGenerationResultSchema,
  OutputFormatSchema,
  conditions,
  looksLikeTcgInventory,
  marketplaces,
  normalizeExtractedItem,
  renderHumanReadable
} from "./chunk-PE47LNGQ.js";

// src/cli.ts
import { fileURLToPath } from "url";
import { Command } from "commander";

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
import { readFile } from "fs/promises";

// src/core/review/interactiveReview.ts
import { checkbox, confirm, input, select } from "@inquirer/prompts";
async function collectInteractiveInputs(dependencies = {
  checkbox,
  input
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
  confirm,
  input,
  select
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
    missingFields: [...requiredFieldChecks(item), ...requiredTcgFieldChecks(item)],
    uncertainties
  });
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
  const readTextFile = dependencies.readTextFile ?? ((path) => readFile(path, "utf8"));
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