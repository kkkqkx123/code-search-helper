import { CodeChunk } from '../types/CodeChunk';
import { ChunkingOptions } from '../strategies/types/SegmentationTypes';
import { ProcessingConfig } from '../core/types/ConfigTypes';

export interface PostProcessingContext {
  originalContent: string;
  language: string;
  filePath?: string;
  config: ProcessingConfig;
  options: ChunkingOptions;
}

export interface IChunkPostProcessor {
  process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]>;
  getName(): string;
  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean;
}