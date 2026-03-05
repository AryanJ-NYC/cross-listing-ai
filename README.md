# Cross-Marketplace Listing Generator

`cmd-market` Phase 1a ships as a standalone ClawHub skill plus a bundled Node CLI. It turns product photos into marketplace-ready listing copy for `eBay`, `Mercari`, `Facebook Marketplace`, `Craigslist`, and `TCGPlayer` when the item is clearly trading card inventory.

## What it does

- accepts local image paths, remote image URLs, or JSON input
- extracts structured item details with OpenAI multimodal
- pauses for seller review in interactive mode
- generates marketplace-specific listing text
- emits human-readable output, structured JSON, or both

## Scope

- `US English` only
- `no pricing`
- `no marketplace posting APIs`
- `no marketplace auth`

## Requirements

- `Node 20+`
- `OPENAI_API_KEY` for image extraction

## Install

```bash
pnpm install
pnpm build
```

## Commands

```bash
crosslist generate --interactive
crosslist generate --input ./examples/walkman.json
crosslist generate --input ./examples/walkman.json --output both
crosslist generate --input ./examples/pokemon-card.json --output json
crosslist doctor
crosslist doctor --images ./path/to/item.jpg
crosslist doctor --output json
```

Defaults:

- `generate --interactive` defaults to text output for seller review.
- non-interactive `generate` defaults to JSON output for agents and automation, without duplicating the `humanReadable` block.
- `doctor` defaults to text output and supports `--output json` or `--output both`.

## JSON file mode

You can pass either `images` or a fully reviewed `extractedItem`.

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

## Development

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Publish

The repo root is the publishable skill bundle.

```bash
pnpm build
clawhub publish . --slug cross-marketplace-listing-generator --name "Cross-Marketplace Listing Generator" --version 1.0.0 --tags latest,ebay,mercari,facebook-marketplace,craigslist,tcgplayer,crosslist,reselling,ecommerce
```
