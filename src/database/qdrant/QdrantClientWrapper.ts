import { QdrantClient } from '@qdrant/js-client-rest';
import { injectable, inject } from 'inversify';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { TYPES } from '../../types';

export interface QdrantConfig {
  host: string;
  port: number;
  apiKey?: string | undefined;
  useHttps: boolean;
  timeout: number;
}

export interface VectorPoint {
  id: string | number;
  vector: number[];
  payload: {
    content: string;
    filePath: string;
    language: string;
    chunkType: string;
    startLine: number;
    endLine: number;
    functionName?: string;
    className?: string;
    snippetMetadata?: any;
    metadata: Record<string, any>;
    timestamp: Date;
    projectId?: string;
  };
}

export interface CollectionInfo {
  name: string;
  vectors: {
    size: number;
    distance: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan';
  };
  pointsCount: number;
  status: 'green' | 'yellow' | 'red' | 'grey';
}

export interface SearchOptions {
  limit?: number;
  scoreThreshold?: number;
  filter?: {
    language?: string[];
    chunkType?: string[];
    filePath?: string[];
    projectId?: string;
    snippetType?: string[];
  };
  withPayload?: boolean;
  withVector?: boolean;
}

export interface SearchResult {
  id: string;
  score: number;
  payload: VectorPoint['payload'];
}

export interface IQdrantClient {
  connect(): Promise<boolean>;
  createCollection(
    collectionName: string,
    vectorSize: number,
    distance?: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan',
    recreateIfExists?: boolean
  ): Promise<boolean>;
  collectionExists(collectionName: string): Promise<boolean>;
  deleteCollection(collectionName: string): Promise<boolean>;
  getCollectionInfo(collectionName: string): Promise<CollectionInfo | null>;
  upsertPoints(collectionName: string, points: VectorPoint[]): Promise<boolean>;
  searchVectors(
    collectionName: string,
    queryVector: number[],
    options?: SearchOptions
  ): Promise<SearchResult[]>;
  deletePoints(collectionName: string, pointIds: string[]): Promise<boolean>;
  clearCollection(collectionName: string): Promise<boolean>;
  getPointCount(collectionName: string): Promise<number>;
  createPayloadIndex(collectionName: string, field: string): Promise<boolean>;
  isConnectedToDatabase(): boolean;
  close(): Promise<void>;
  // New methods
  getChunkIdsByFiles(collectionName: string, filePaths: string[]): Promise<string[]>;
  getExistingChunkIds(collectionName: string, chunkIds: string[]): Promise<string[]>;
}

@injectable()
export class QdrantClientWrapper {
  private client: QdrantClient;
  private config: QdrantConfig;
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private isConnected: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;

    const qdrantConfig = configService.get('qdrant');
    this.config = {
      host: qdrantConfig.host,
      port: qdrantConfig.port,
      apiKey: process.env.QDRANT_API_KEY,
      useHttps: false,
      timeout: 30000,
    };

    this.client = new QdrantClient({
      url: `${this.config.useHttps ? 'https' : 'http'}://${this.config.host}:${this.config.port}`,
      ...(this.config.apiKey ? { apiKey: this.config.apiKey } : {}),
      timeout: this.config.timeout,
    });
  }

  async connect(): Promise<boolean> {
    try {
      // Use getCollections as a health check
      await this.client.getCollections();
      this.isConnected = true;
      this.logger.info('Connected to Qdrant successfully');
      return true;
    } catch (error) {
      this.isConnected = false;
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to connect to Qdrant: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantClient', operation: 'connect' }
      );
      this.logger.error('Failed to connect to Qdrant', { errorId: report.id });
      return false;
    }
  }

  async createCollection(
    collectionName: string,
    vectorSize: number,
    distance: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan' = 'Cosine',
    recreateIfExists: boolean = false
  ): Promise<boolean> {
    try {
      const exists = await this.collectionExists(collectionName);

      if (exists && recreateIfExists) {
        await this.deleteCollection(collectionName);
      } else if (exists) {
        this.logger.info(`Collection ${collectionName} already exists`);
        return true;
      }

      await this.client.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: distance,
        },
        optimizers_config: {
          default_segment_number: 2,
        },
        replication_factor: 1,
      });

      // 修复：确保payload索引创建成功，否则抛出异常
      const payloadIndexes = [
        'language',
        'chunkType',
        'filePath',
        'projectId',
        'snippetMetadata.snippetType'
      ];
      
      for (const field of payloadIndexes) {
        const indexCreated = await this.createPayloadIndex(collectionName, field);
        if (!indexCreated) {
          throw new Error(`Failed to create payload index for field: ${field}`);
        }
      }

      this.logger.info(`Created collection ${collectionName} with all payload indexes`, {
        vectorSize,
        distance,
      });

      return true;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to create collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantClient', operation: 'createCollection' }
      );
      this.logger.error('Failed to create collection', { errorId: report.id, collectionName });
      return false;
    }
  }

  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.some(col => col.name === collectionName);
    } catch (error) {
      this.logger.warn('Failed to check collection existence', {
        collectionName,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async deleteCollection(collectionName: string): Promise<boolean> {
    try {
      await this.client.deleteCollection(collectionName);
      this.logger.info(`Deleted collection ${collectionName}`);
      return true;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to delete collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantClient', operation: 'deleteCollection' }
      );
      this.logger.error('Failed to delete collection', { errorId: report.id, collectionName });
      return false;
    }
  }

  async getCollectionInfo(collectionName: string): Promise<CollectionInfo | null> {
    try {
      const info = await this.client.getCollection(collectionName);

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

  async upsertPoints(collectionName: string, points: VectorPoint[]): Promise<boolean> {
    try {
      if (points.length === 0) {
        return true;
      }

      const batchSize = 100;
      for (let i = 0; i < points.length; i += batchSize) {
        const batch = points.slice(i, i + batchSize);

        await this.client.upsert(collectionName, {
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

      this.logger.info(`Upserted ${points.length} points to collection ${collectionName}`);
      return true;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to upsert points to ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantClient', operation: 'upsertPoints' }
      );
      this.logger.error('Failed to upsert points', {
        errorId: report.id,
        collectionName,
        pointCount: points.length,
        error: error,
      });
      return false;
    }
  }

  async searchVectors(
    collectionName: string,
    queryVector: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
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

      const results = await this.client.search(collectionName, {
        vector: queryVector,
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
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to search vectors in ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantClient', operation: 'searchVectors' }
      );
      this.logger.error('Failed to search vectors', { errorId: report.id, collectionName });
      return [];
    }
  }

  async deletePoints(collectionName: string, pointIds: string[]): Promise<boolean> {
    try {
      await this.client.delete(collectionName, {
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
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to delete points from ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantClient', operation: 'deletePoints' }
      );
      this.logger.error('Failed to delete points', { errorId: report.id, collectionName });
      return false;
    }
  }

  async getChunkIdsByFiles(collectionName: string, filePaths: string[]): Promise<string[]> {
    try {
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
      const results = await this.client.scroll(collectionName, {
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
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to get chunk IDs by files from ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantClient', operation: 'getChunkIdsByFiles' }
      );
      this.logger.error('Failed to get chunk IDs by files', { errorId: report.id, collectionName });
      return [];
    }
  }

  async getExistingChunkIds(collectionName: string, chunkIds: string[]): Promise<string[]> {
    try {
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
      const results = await this.client.scroll(collectionName, {
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
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to get existing chunk IDs from ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantClient', operation: 'getExistingChunkIds' }
      );
      this.logger.error('Failed to get existing chunk IDs', { errorId: report.id, collectionName });
      return [];
    }
  }

  async clearCollection(collectionName: string): Promise<boolean> {
    try {
      await this.client.delete(collectionName, {
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
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to clear collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantClient', operation: 'clearCollection' }
      );
      this.logger.error('Failed to clear collection', { errorId: report.id, collectionName });
      return false;
    }
  }

  async getPointCount(collectionName: string): Promise<number> {
    try {
      const info = await this.client.getCollection(collectionName);
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
      await this.client.createPayloadIndex(collectionName, {
        field_name: field,
        field_schema: 'keyword',
      });

      this.logger.info(`Created payload index for field ${field} in collection ${collectionName}`);
      return true;
    } catch (error) {
      // 修复：检查是否为"已存在"错误，如果是则返回true，否则抛出异常
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
      throw error; // 抛出异常而不是返回false
    }
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

  isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  async close(): Promise<void> {
    // Clear health check interval if it exists
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Close the Qdrant client connection if it has a close method
    if (this.client && typeof (this.client as any).close === 'function') {
      try {
        await (this.client as any).close();
      } catch (error) {
        this.logger.warn('Error closing Qdrant client', { error });
      }
    }

    this.isConnected = false;
    this.logger.info('Qdrant client connection closed');
  }
}
