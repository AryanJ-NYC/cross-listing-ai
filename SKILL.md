---
name: cross-marketplace-listing-generator
description: Turn product photos into marketplace-ready listing copy for eBay, Mercari, Facebook Marketplace, Craigslist, and TCGPlayer.
metadata: {"openclaw":{"requires":{"bins":["node"]}}}
---

# Cross-Marketplace Listing Generator

Use this skill when a seller wants to turn product images into listing copy for multiple marketplaces.

## Behavior

- Prefer `node ./dist/cli.js generate --interactive` for normal seller-facing flows.
- Non-interactive `generate` defaults to JSON and omits the duplicated `humanReadable` block, but prefer `node ./dist/cli.js generate --input <path> --output json` when you want an explicit machine-readable contract.
- If extraction is uncertain or incomplete, stop and ask the seller to confirm or edit the item details before treating the output as final.
- Do not invent pricing, shipping, or condition details that are not present in the source images or seller review.
- Only generate `TCGPlayer` output when the item is clearly a trading card and card-specific fields are present.
- If command execution fails, run `node ./dist/cli.js doctor --output json` before retrying the generate flow.

## Examples

```bash
node ./dist/cli.js generate --interactive
node ./dist/cli.js generate --input ./examples/pokemon-card.json
node ./dist/cli.js generate --input ./examples/pokemon-card.json --output both
node ./dist/cli.js doctor --output json
```

## Notes

- Runtime requires `OPENAI_API_KEY` for image extraction.
- `v1a` is `US English` only.
- `v1a` does not post listings to marketplace APIs.
