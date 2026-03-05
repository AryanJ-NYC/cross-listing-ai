import { describe, expect, test } from 'vitest';
import { zodResponseFormat } from 'openai/helpers/zod';

import { OpenAIExtractedItemSchema } from '../src/core/providers/openai.js';

describe('OpenAIExtractedItemSchema', () => {
  test('is compatible with the OpenAI structured-output helper', () => {
    expect(() => zodResponseFormat(OpenAIExtractedItemSchema, 'crosslist_extracted_item')).not.toThrow();
  });
});
