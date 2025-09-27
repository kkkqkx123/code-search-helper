import { CodeChunk } from '../../parser/types';
import { VectorPoint } from '../../../database/qdrant/QdrantClientWrapper';
import { IndexingOptions } from '../EmbeddingService';

export class ChunkProcessingUtils {
  static extractUniqueFileCount(chunks: CodeChunk[]): number {
    const uniqueFiles = new Set<string>();

    for (const chunk of chunks) {
      if (chunk.metadata.filePath) {
        uniqueFiles.add(chunk.metadata.filePath);
      }
    }

    return uniqueFiles.size;
  }

  static async getExistingChunkIds(
    chunkIds: string[],
    getExistingChunkIdsFn: (collectionName: string, chunkIds: string[]) => Promise<string[]>
  ): Promise<string[]> {
    try {
      const existingChunkIds = await getExistingChunkIdsFn('', chunkIds);
      return existingChunkIds;
    } catch (error) {
      return [];
    }
  }

  static async getChunkIdsByFiles(
    filePaths: string[],
    getChunkIdsByFilesFn: (collectionName: string, filePaths: string[]) => Promise<string[]>
  ): Promise<string[]> {
    try {
      const chunkIds = await getChunkIdsByFilesFn('', filePaths);
      return chunkIds;
    } catch (error) {
      return [];
    }
  }

  static async processChunksInBatches(
    chunks: CodeChunk[],
    options: IndexingOptions,
    batchSize: number,
    operationType: 'create' | 'update',
    convertChunksToVectorPointsOptimized: (
      chunks: CodeChunk[],
      options: IndexingOptions,
      batchSize: number
    ) => Promise<VectorPoint[]>,
    retryOperation: <T>(operation: () => Promise<T>) => Promise<T>,
    upsertPoints: (collectionName: string, vectorPoints: VectorPoint[]) => Promise<boolean>,
    currentCollection: string,
    logger: any
  ): Promise<{
    success: boolean;
    processedFiles: number;
    totalChunks: number;
    uniqueChunks: number;
    duplicatesRemoved: number;
    processingTime: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const result = {
      success: false,
      processedFiles: 0,
      totalChunks: chunks.length,
      uniqueChunks: 0,
      duplicatesRemoved: 0,
      processingTime: 0,
      errors: [] as string[],
    };

    try {
      const vectorPoints = await convertChunksToVectorPointsOptimized(chunks, options, batchSize);

      if (vectorPoints.length === 0) {
        result.success = true;
        result.processingTime = Date.now() - startTime;
        return result;
      }

      // Store vector points with retry logic
      const success = await retryOperation(() => upsertPoints(currentCollection, vectorPoints));

      if (success) {
        result.success = true;
        result.uniqueChunks = vectorPoints.length;
        result.duplicatesRemoved = chunks.length - vectorPoints.length;
        result.processingTime = Date.now() - startTime;

        logger.debug(`Chunks ${operationType}d successfully in batch`, {
          operationType,
          totalChunks: chunks.length,
          uniqueChunks: vectorPoints.length,
          duplicatesRemoved: result.duplicatesRemoved,
          processingTime: result.processingTime,
          batchSize,
        });
      } else {
        throw new Error(`Failed to ${operationType} vector points in batch`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push(`${operationType} failed: ${errorMessage}`);
      logger.error(`Failed to ${operationType} chunks in batch`, {
        operationType,
        batchSize,
        error: errorMessage,
      });
    }

    return result;
  }
}
