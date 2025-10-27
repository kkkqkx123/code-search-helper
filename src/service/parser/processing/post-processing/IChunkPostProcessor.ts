import { CodeChunk, EnhancedChunkingOptions } from '../types/splitting-types';

export interface PostProcessingContext {
  originalContent: string;
 language: string;
 filePath?: string;
  options: EnhancedChunkingOptions;
}

export interface IChunkPostProcessor {
  process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]>;
  getName(): string;
  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean;
}