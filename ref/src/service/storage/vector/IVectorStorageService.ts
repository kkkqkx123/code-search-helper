import { CodeChunk } from '../../parser/types';
import { SearchOptions, SearchResult } from '../../../database/qdrant/QdrantClientWrapper';

export interface VectorStorageConfig {
  collectionName: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclidean' | 'Dot';
  recreateCollection: boolean;
}

export interface IndexingOptions {
  projectId?: string;
  batchSize?: number;
  skipDeduplication?: boolean;
  overwriteExisting?: boolean;
}

export interface IndexingResult {
  success: boolean;
  processedFiles: number;
  totalChunks: number;
  uniqueChunks: number;
  duplicatesRemoved: number;
  processingTime: number;
  errors: string[];
}

export interface IVectorStorageService {
  initialize(projectId?: string): Promise<boolean>;
  storeChunks(chunks: CodeChunk[], options?: IndexingOptions): Promise<IndexingResult>;
  searchVectors(queryVector: number[], options?: SearchOptions): Promise<SearchResult[]>;
  deleteChunks(chunkIds: string[]): Promise<boolean>;
  clearCollection(): Promise<boolean>;
  getCollectionStats(): Promise<{
    totalPoints: number;
    collectionInfo: any;
  }>;
  updateConfig(newConfig: Partial<VectorStorageConfig>): Promise<void>;
  isServiceInitialized(): boolean;
  updateChunks(chunks: CodeChunk[], options?: IndexingOptions): Promise<IndexingResult>;
}