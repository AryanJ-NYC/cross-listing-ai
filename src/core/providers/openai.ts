import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { type ItemExtractionProvider } from './types.js';
import {
  ConditionSchema,
  type ExtractedItem,
  ExtractedItemSchema,
} from '../schemas.js';
import { normalizeTcgDetails } from '../normalizeExtractedItem.js';

export const supportedImageExtensions = ['.jpg', '.jpeg', '.png', '.webp'] as const;

export function isSupportedLocalImagePath(filePath: string) {
  return supportedImageExtensions.includes(extname(filePath).toLowerCase() as (typeof supportedImageExtensions)[number]);
}

export const OpenAIExtractedItemSchema = z
  .object({
    attributes: z.record(z.string(), z.string()),
    category: z.string().min(1),
    condition: ConditionSchema,
    description: z.string().min(1),
    missingFields: z.array(z.string()),
    tcg: z
      .object({
        cardName: z.string().nullable(),
        cardNumber: z.string().nullable(),
        foil: z.boolean().nullable(),
        game: z.string().nullable(),
        language: z.string().nullable(),
        rarity: z.string().nullable(),
        set: z.string().nullable(),
      })
      .strict()
      .nullable(),
    title: z.string().min(1),
    uncertainties: z.array(z.string()),
  })
  .strict();

export class OpenAIItemExtractionProvider implements ItemExtractionProvider {
  constructor(
    private readonly client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    private readonly model = 'gpt-4.1-mini'
  ) {}

  async extractFromImages(imageInputs: string[]): Promise<ExtractedItem> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required to extract item details from images.');
    }

    const completion = await this.client.chat.completions.parse({
      messages: [
        {
          role: 'system',
          content:
            'You extract structured seller listing data from product photos. Use US English. Never invent facts. Unknown fields must stay missing and be reflected in missingFields or uncertainties.',
        },
        {
          role: 'user',
          content: [
            {
              text:
                'Review these product images and extract a listing title, description, condition, category, attributes, missing fields, uncertainties, and optional trading card fields when relevant.',
              type: 'text',
            },
            ...(await Promise.all(imageInputs.map((input) => toImagePart(input)))),
          ],
        },
      ],
      model: this.model,
      response_format: zodResponseFormat(OpenAIExtractedItemSchema, 'crosslist_extracted_item'),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error('OpenAI did not return structured extraction data.');
    }

    return ExtractedItemSchema.parse({
      ...parsed,
      tcg: normalizeTcgDetails(parsed.tcg),
    });
  }
}

async function toImagePart(input: string): Promise<OpenAI.Chat.Completions.ChatCompletionContentPartImage> {
  return {
    image_url: {
      url: isRemoteUrl(input) ? input : await toDataUrl(input),
    },
    type: 'image_url',
  };
}

function isRemoteUrl(input: string) {
  return /^https?:\/\//i.test(input);
}

async function toDataUrl(filePath: string) {
  const bytes = await readFile(filePath);
  const mimeType = mimeTypeFor(filePath);
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

function mimeTypeFor(filePath: string) {
  switch (extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}
