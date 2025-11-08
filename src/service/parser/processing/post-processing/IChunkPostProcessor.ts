import { CodeChunk } from '../types/CodeChunk';
import { ChunkingOptions, EnhancedChunkingOptions } from '../strategies/types/SegmentationTypes';
import { ProcessingConfig } from '../core/types/ConfigTypes';

export interface PostProcessingContext {
  originalContent: string;
  language: string;
  filePath?: string;
  config: ProcessingConfig;
  options: EnhancedChunkingOptions;
  advancedOptions?: {
    enableEnhancedBalancing?: boolean;
    enableIntelligentFiltering?: boolean;
    enableSmartRebalancing?: boolean;
    enableAdvancedMerging?: boolean;
    enableBoundaryOptimization?: boolean;
    addOverlap?: boolean;
    minChunkSizeThreshold?: number;
    maxChunkSizeThreshold?: number;
    rebalancingStrategy?: string;
    semanticWeight?: number;
    syntacticWeight?: number;
    structuralWeight?: number;
    enableChunkDeduplication?: boolean;
    deduplicationThreshold?: number;
  };
}

export interface IChunkPostProcessor {
  process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]>;
  getName(): string;
  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean;
}