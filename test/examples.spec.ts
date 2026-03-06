import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { GenerateFileInputSchema } from '../src/core/crosslistCore.js';

describe('example and fixture JSON files', () => {
  test.each([
    '../examples/pokemon-card.json',
    '../examples/walkman.json',
    '../fixtures/ambiguous-lot.json',
    '../fixtures/pokemon-card-reviewed.json',
    '../fixtures/walkman-reviewed.json',
  ])('parses %s with the public input schema', (path) => {
    const parsed = JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));

    expect(() => GenerateFileInputSchema.parse(parsed)).not.toThrow();
  });
});
