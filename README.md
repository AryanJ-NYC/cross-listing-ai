# Cross-Marketplace Listing Generator

`crosslist` is an open-source `cmd-market` package that ships two things from one repo:

- a standalone CLI for sellers and agents
- a reusable core library that SatStash can consume as a dependency

The CLI is a thin wrapper over SatStash public API generation endpoints and uses the shared core locally for review and formatting.

## What it does

- accepts hosted image URLs or JSON input
- calls SatStash `POST /api/public/v1/crosslist/generate`
- pauses for seller review in interactive mode
- generates marketplace-specific listing text
- emits human-readable output, structured JSON, or both

## Scope

- `US English` only
- `no pricing`
- `no marketplace posting APIs`
- `no marketplace auth`
- `URL-only` for image extraction in `v1`

## Requirements

- `Node 20+`
- network access to `https://satstash.io/api/public/v1`

## Install

```bash
pnpm install
pnpm build
```

## Commands

```bash
pnpm dev -- generate --interactive
pnpm dev -- generate --input ./examples/walkman.json
pnpm dev -- generate --input ./examples/walkman.json --output both
pnpm dev -- generate --images https://cdn.example.com/item.jpg --marketplaces ebay,mercari --output json
pnpm dev -- doctor
pnpm dev -- doctor --images https://cdn.example.com/item.jpg
pnpm dev -- doctor --api-base-url http://localhost:3000 --output json
```

Defaults:

- `generate --interactive` defaults to text output for seller review.
- non-interactive `generate` defaults to JSON output for agents and automation, without duplicating the `humanReadable` block.
- `doctor` defaults to text output and supports `--output json` or `--output both`.
- production API base URL defaults to `https://satstash.io`, but `--api-base-url` wins over `CROSSLIST_API_BASE_URL`.
- `doctor` verifies that the target API actually exposes `/api/public/v1/crosslist/generate`, not just that the docs URL loads.

## JSON file mode

You can pass either `imageUrls` or a fully reviewed `extractedItem`.

```json
{
  "marketplaces": ["ebay", "mercari"],
  "extractedItem": {
    "title": "Sony WM-FX195 Walkman Cassette Player with Headphones",
    "description": "Working Sony Walkman cassette player with headphones and battery door intact.",
    "condition": "very good",
    "category": "portable cassette player",
    "attributes": {
      "brand": "Sony",
      "model": "WM-FX195",
      "color": "Black"
    },
    "missingFields": [],
    "uncertainties": []
  }
}
```

## Library usage

SatStash and other consumers can import the shared core from the package root:

```ts
import {
  generateMarketplaceListings,
  marketplaces,
  renderHumanReadable,
  type ExtractedItem,
} from '@cmd-market/crosslist';
```

## Development

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Public API

The CLI wraps:

```text
POST /api/public/v1/crosslist/generate
```

Request accepts exactly one of:

- `image_urls` plus `marketplaces`
- `extracted_item` plus `marketplaces`

Success returns a public API envelope with `data` and `meta`. The CLI unwraps that envelope and renders local text/JSON output.
