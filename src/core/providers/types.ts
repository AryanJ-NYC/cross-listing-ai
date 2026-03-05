import type { ExtractedItem } from '../schemas.js';

export type ImageInput = string;

export interface ItemExtractionProvider {
  extractFromImages(imageInputs: ImageInput[]): Promise<ExtractedItem>;
}
