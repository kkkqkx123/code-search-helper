import { QdrantClient } from '@qdrant/js-client-rest';
import { LoggerService } from '../utils/LoggerService';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { IVectorStore, VectorPoint, CollectionInfo, SearchOptions, SearchResult } from './IVectorStore';

export interface QdrantConfig {
  host: string;
  port: number;
  apiKey?: string;
  useHttps: boolean;
  timeout: number;
}

export class QdrantService implements IVectorStore {
  private client: QdrantClient | null = null;
  private config: QdrantConfig;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private isConnectedFlag: boolean = false;
  private isInitialized: boolean = false;

  constructor(
    logger: LoggerService,
    errorHandler: ErrorHandlerService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;

    // 简化配置获取
    this.config = {
      host: process.env.QDRANT_HOST || 'localhost',
      port: parseInt(process.env.QDRANT_PORT || '6333'),
      apiKey: process.env.QDRANT_API_KEY,
      useHttps: process.env.QDRANT_USE_HTTPS === 'true',
      timeout: parseInt(process.env.QDRANT_TIMEOUT || '30000'),
    };
  }

  private async ensureClientInitialized(): Promise<boolean> {
    if (!this.isInitialized) {
      this.client = new QdrantClient({
        url: `${this.config.useHttps ? 'https' : 'http'}://${this.config.host}:${this.config.port}`,
        ...(this.config.apiKey ? { apiKey: this.config.apiKey } : {}),
        timeout: this.config.timeout,
      });
      this.isInitialized = true;
    }
    return true;
  }

  async initialize(): Promise<boolean> {
    try {
      await this.ensureClientInitialized();
      // Use getCollections as a health check
      await this.client!.getCollections();
      this.isConnectedFlag = true;
      this.logger.info('Connected to Qdrant successfully');
      return true;
    } catch (error) {
      this.isConnectedFlag = false;
      this.errorHandler.handleError(
        new Error(
          `Failed to connect to Qdrant: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantService', operation: 'initialize' }
      );
      return false;
    }
  }

  async createCollection(
    name: string,
    vectorSize: number,
    distance: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan' = 'Cosine',
    recreateIfExists: boolean = false
  ): Promise<boolean> {
    try {
      await this.ensureClientInitialized();
      const exists = await this.collectionExists(name);

      if (exists && recreateIfExists) {
        await this.deleteCollection(name);
      } else if (exists) {
        this.logger.info(`Collection ${name} already exists`);
        return true;
      }

      await this.client!.createCollection(name, {
        vectors: {
          size: vectorSize,
          distance: distance,
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      });

      // 创建payload索引
      const payloadIndexes = [
        'language',
        'chunkType',
        'filePath',
        'projectId',
        'snippetMetadata.snippetType'
      ];

      for (const field of payloadIndexes) {
        const indexCreated = await this.createPayloadIndex(name, field);
        if (!indexCreated) {
          throw new Error(`Failed to create payload index for field: ${field}`);
        }
      }

      this.logger.info(`Created collection ${name} with all payload indexes`, {
        vectorSize,
        distance,
      });

      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to create collection ${name}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantService', operation: 'createCollection' }
      );
      return false;
    }
  }

   async collectionExists(name: string): Promise<boolean> {
     try {
       await this.ensureClientInitialized();
       const collections = await this.client!.getCollections();
       return collections.collections.some(col => col.name === name);
     } catch (error) {
       this.logger.warn('Failed to check collection existence', {
         collectionName: name,
         error: error instanceof Error ? error.message : String(error),
       });
       return false;
     }
   }

  async deleteCollection(name: string): Promise<boolean> {
    try {
      await this.ensureClientInitialized();
      await this.client!.deleteCollection(name);
      this.logger.info(`Deleted collection ${name}`);
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to delete collection ${name}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantService', operation: 'deleteCollection' }
      );
      return false;
    }
  }

  async getCollectionInfo(collectionName: string): Promise<CollectionInfo | null> {
    try {
      await this.ensureClientInitialized();
      const info = await this.client!.getCollection(collectionName);

      // Handle the new structure of vectors configuration
      const vectorsConfig = info.config.params.vectors;
      const vectorSize =
        typeof vectorsConfig === 'object' && vectorsConfig !== null && 'size' in vectorsConfig
          ? vectorsConfig.size
          : 0;
      const vectorDistance =
        typeof vectorsConfig === 'object' && vectorsConfig !== null && 'distance' in vectorsConfig
          ? vectorsConfig.distance
          : 'Cosine';

      return {
        name: collectionName,
        vectors: {
          size: typeof vectorSize === 'number' ? vectorSize : 0,
          distance:
            typeof vectorDistance === 'string'
              ? (vectorDistance as 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan')
              : 'Cosine',
        },
        pointsCount: info.points_count || 0,
        status: info.status,
      };
    } catch (error) {
      this.logger.warn('Failed to get collection info', {
        collectionName,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

   async upsertVectors(collectionName: string, vectors: VectorPoint[]): Promise<boolean> {
     try {
       await this.ensureClientInitialized();
       if (vectors.length === 0) {
         return true;
       }
 
       const batchSize = 100;
       for (let i = 0; i < vectors.length; i += batchSize) {
         const batch = vectors.slice(i, i + batchSize);
 
         await this.client!.upsert(collectionName, {
           points: batch.map(point => ({
             id: point.id,
             vector: point.vector,
             payload: {
               ...point.payload,
               timestamp: point.payload.timestamp.toISOString(),
             },
           })),
         });
       }
 
       this.logger.info(`Upserted ${vectors.length} points to collection ${collectionName}`);
       return true;
     } catch (error) {
       this.errorHandler.handleError(
         new Error(
           `Failed to upsert points to ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
         ),
         { component: 'QdrantService', operation: 'upsertVectors' }
       );
       return false;
     }
   }

   async searchVectors(
     collectionName: string,
     query: number[],
     options: SearchOptions = {}
   ): Promise<SearchResult[]> {
     try {
       await this.ensureClientInitialized();
       const searchParams: any = {
         limit: options.limit || 10,
         with_payload: options.withPayload !== false,
         with_vector: options.withVector || false,
       };
 
       if (options.scoreThreshold !== undefined) {
         searchParams.score_threshold = options.scoreThreshold;
       }
 
       if (options.filter) {
         searchParams.filter = this.buildFilter(options.filter);
       }
 
       const results = await this.client!.search(collectionName, {
         vector: query,
         ...searchParams,
       });
 
       return results.map(result => ({
         id: result.id as string,
         score: result.score,
         payload: {
           ...(result.payload as any),
           timestamp:
             result.payload?.timestamp && typeof result.payload.timestamp === 'string'
               ? new Date(result.payload.timestamp)
               : new Date(),
         },
       }));
     } catch (error) {
       this.errorHandler.handleError(
         new Error(
           `Failed to search vectors in ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
         ),
         { component: 'QdrantService', operation: 'searchVectors' }
       );
       return [];
     }
   }

  async deletePoints(collectionName: string, pointIds: string[]): Promise<boolean> {
    try {
      await this.ensureClientInitialized();
      await this.client!.delete(collectionName, {
        filter: {
          must: [
            {
              key: 'id',
              match: {
                any: pointIds,
              },
            },
          ],
        },
      });

      this.logger.info(`Deleted ${pointIds.length} points from collection ${collectionName}`);
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to delete points from ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantService', operation: 'deletePoints' }
      );
      return false;
    }
  }

  async clearCollection(collectionName: string): Promise<boolean> {
    try {
      await this.ensureClientInitialized();
      await this.client!.delete(collectionName, {
        filter: {
          must: [
            {
              key: 'id',
              match: {
                any: true,
              },
            },
          ],
        },
      });

      this.logger.info(`Cleared collection ${collectionName}`);
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to clear collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantService', operation: 'clearCollection' }
      );
      return false;
    }
  }

  async getPointCount(collectionName: string): Promise<number> {
    try {
      await this.ensureClientInitialized();
      const info = await this.client!.getCollection(collectionName);
      return info.points_count || 0;
    } catch (error) {
      this.logger.warn('Failed to get point count', {
        collectionName,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  async createPayloadIndex(collectionName: string, field: string): Promise<boolean> {
    try {
      await this.ensureClientInitialized();
      await this.client!.createPayloadIndex(collectionName, {
        field_name: field,
        field_schema: 'keyword',
      });

      this.logger.info(`Created payload index for field ${field} in collection ${collectionName}`);
      return true;
    } catch (error) {
      // 检查是否为"已存在"错误，如果是则返回true
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.toLowerCase().includes('already exists')) {
        this.logger.info(`Payload index for field ${field} already exists in collection ${collectionName}`);
        return true;
      }

      this.logger.error('Failed to create payload index', {
        collectionName,
        field,
        error: errorMessage,
      });
      return false;
    }
  }

  async getChunkIdsByFiles(collectionName: string, filePaths: string[]): Promise<string[]> {
    try {
      await this.ensureClientInitialized();
      // Build filter to match any of the provided file paths
      const filter = {
        must: [
          {
            key: 'filePath',
            match: {
              any: filePaths,
            },
          },
        ],
      };

      // Search for points matching the filter, only retrieving IDs
      const results = await this.client!.scroll(collectionName, {
        filter,
        with_payload: false,
        with_vector: false,
        limit: 1000, // Adjust this limit as needed
      });

      // Extract IDs from the results
      const chunkIds = results.points.map(point => point.id as string);

      this.logger.debug(`Found ${chunkIds.length} chunk IDs for ${filePaths.length} files`, {
        fileCount: filePaths.length,
        chunkCount: chunkIds.length,
      });

      return chunkIds;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to get chunk IDs by files from ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantService', operation: 'getChunkIdsByFiles' }
      );
      return [];
    }
  }

  async getExistingChunkIds(collectionName: string, chunkIds: string[]): Promise<string[]> {
    try {
      await this.ensureClientInitialized();
      // Build filter to match any of the provided chunk IDs
      const filter = {
        must: [
          {
            key: 'id',
            match: {
              any: chunkIds,
            },
          },
        ],
      };

      // Search for points matching the filter, only retrieving IDs
      const results = await this.client!.scroll(collectionName, {
        filter,
        with_payload: false,
        with_vector: false,
        limit: 1000, // Adjust this limit as needed
      });

      // Extract IDs from the results
      const existingChunkIds = results.points.map(point => point.id as string);

      this.logger.debug(
        `Found ${existingChunkIds.length} existing chunk IDs out of ${chunkIds.length} requested`,
        {
          requestedCount: chunkIds.length,
          existingCount: existingChunkIds.length,
        }
      );

      return existingChunkIds;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to get existing chunk IDs from ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantService', operation: 'getExistingChunkIds' }
      );
      return [];
    }
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }

  async close(): Promise<void> {
    // Close the Qdrant client connection if it has a close method
    if (this.client && typeof (this.client as any).close === 'function') {
      try {
        await (this.client as any).close();
      } catch (error) {
        this.logger.warn('Error closing Qdrant client', { error });
      }
    }

    this.client = null;
    this.isConnectedFlag = false;
    this.isInitialized = false;
    this.logger.info('Qdrant client connection closed');
  }

  private buildFilter(filter: SearchOptions['filter']): any {
    if (!filter) return undefined;

    const must: any[] = [];

    if (filter.language) {
      must.push({
        key: 'language',
        match: {
          any: filter.language,
        },
      });
    }

    if (filter.chunkType) {
      must.push({
        key: 'chunkType',
        match: {
          any: filter.chunkType,
        },
      });
    }

    if (filter.filePath) {
      must.push({
        key: 'filePath',
        match: {
          any: filter.filePath,
        },
      });
    }

    if (filter.projectId) {
      must.push({
        key: 'projectId',
        match: {
          value: filter.projectId,
        },
      });
    }

    if (filter.snippetType) {
      must.push({
        key: 'snippetMetadata.snippetType',
        match: {
          any: filter.snippetType,
        },
      });
    }

    return must.length > 0 ? { must } : undefined;
  }
}