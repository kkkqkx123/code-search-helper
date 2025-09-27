import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { TYPES } from '../../types';
import { CodeChunk } from '../parser/types';
import { VectorPoint } from '../../database/qdrant/QdrantClientWrapper';

export interface IndexingOptions {
  projectId?: string;
  batchSize?: number;
  skipDeduplication?: boolean;
  overwriteExisting?: boolean;
}

@injectable()
export class EmbeddingService {
  private logger: LoggerService;
  private embedderFactory: EmbedderFactory;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.EmbedderFactory) embedderFactory: EmbedderFactory
  ) {
    this.logger = logger;
    this.embedderFactory = embedderFactory;
  }

  async convertChunksToVectorPoints(
    chunks: CodeChunk[],
    options: IndexingOptions
  ): Promise<VectorPoint[]> {
    const vectorPoints: VectorPoint[] = [];
    const batchSize = options.batchSize || 100;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      for (const chunk of batch) {
        try {
          const vector = await this.generateEmbedding(chunk.content);

          // Check if this is a SnippetChunk
          const isSnippet = chunk.type === 'snippet' && 'snippetMetadata' in chunk;

          const vectorPoint: VectorPoint = {
            id: chunk.id,
            vector,
            payload: {
              content: chunk.content,
              filePath: chunk.metadata.filePath || '',
              language: chunk.metadata.language || 'unknown',
              chunkType: chunk.type,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              ...(chunk.functionName && { functionName: chunk.functionName }),
              ...(chunk.className && { className: chunk.className }),
              ...(options.projectId && { projectId: options.projectId }),
              ...(isSnippet && { snippetMetadata: (chunk as any).snippetMetadata }),
              metadata: {
                ...chunk.metadata,
                imports: chunk.imports || [],
                exports: chunk.exports || [],
                complexity: chunk.metadata.complexity || 1,
                parameters: chunk.metadata.parameters || [],
                returnType: chunk.metadata.returnType || 'unknown',
              },
              timestamp: new Date(),
            },
          };

          vectorPoints.push(vectorPoint);
        } catch (error) {
          this.logger.warn('Failed to generate embedding for chunk', {
            chunkId: chunk.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return vectorPoints;
  }

  async generateEmbedding(content: string): Promise<number[]> {
    try {
      // Use the embedder factory to get the configured embedder and generate embedding
      const result = await this.embedderFactory.embed({ text: content });

      // Handle both single result and array result
      const embeddingResult = Array.isArray(result) ? result[0] : result;
      return embeddingResult.vector;
    } catch (error) {
      this.logger.error('Failed to generate embedding', {
        error: error instanceof Error ? error.message : String(error),
        contentLength: content.length,
      });
      throw error;
    }
  }

  async convertChunksToVectorPointsOptimized(
    chunks: CodeChunk[],
    options: IndexingOptions,
    batchSize: number,
    checkMemoryUsage: () => boolean,
    processWithTimeout: <T>(operation: () => Promise<T>, timeoutMs: number) => Promise<T>
  ): Promise<VectorPoint[]> {
    if (chunks.length === 0) {
      return [];
    }

    const vectorPoints: VectorPoint[] = [];

    // Process chunks in batches with concurrent embedding generation
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      // Check memory usage before processing each batch
      if (!checkMemoryUsage()) {
        throw new Error('Insufficient memory available for batch processing');
      }

      // Generate embeddings for the batch with timeout and retry
      const batchVectorPoints = await processWithTimeout(
        () => this.generateEmbeddingsForBatch(batch, options),
        300000 // Default timeout of 5 minutes
      );

      vectorPoints.push(...batchVectorPoints);
    }

    return vectorPoints;
  }

  private async generateEmbeddingsForBatch(
    batch: CodeChunk[],
    options: IndexingOptions
  ): Promise<VectorPoint[]> {
    // Generate embeddings concurrently for better performance
    const embeddingPromises = batch.map(async chunk => {
      try {
        const vector = await this.generateEmbedding(chunk.content);

        // Check if this is a SnippetChunk
        const isSnippet = chunk.type === 'snippet' && 'snippetMetadata' in chunk;

        const vectorPoint: VectorPoint = {
          id: chunk.id,
          vector,
          payload: {
            content: chunk.content,
            filePath: chunk.metadata.filePath || '',
            language: chunk.metadata.language || 'unknown',
            chunkType: chunk.type,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            ...(chunk.functionName && { functionName: chunk.functionName }),
            ...(chunk.className && { className: chunk.className }),
            ...(options.projectId && { projectId: options.projectId }),
            ...(isSnippet && { snippetMetadata: (chunk as any).snippetMetadata }),
            metadata: {
              ...chunk.metadata,
              imports: chunk.imports || [],
              exports: chunk.exports || [],
              complexity: chunk.metadata.complexity || 1,
              parameters: chunk.metadata.parameters || [],
              returnType: chunk.metadata.returnType || 'unknown',
            },
            timestamp: new Date(),
          },
        };

        return vectorPoint;
      } catch (error) {
        this.logger.warn('Failed to generate embedding for chunk', {
          chunkId: chunk.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return null; // Filter out failed chunks
      }
    });

    // Wait for all embeddings to complete and filter out null results
    const results = await Promise.all(embeddingPromises);
    return results.filter((point): point is VectorPoint => point !== null);
  }
}
