import { injectable, inject } from 'inversify';
import { LoggerService } from '../utils/LoggerService';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { TYPES } from '../types';
import { IQdrantConnectionManager } from './QdrantConnectionManager';
import { 
  CollectionInfo,
  VectorDistance,
  CollectionCreateOptions,
  CollectionStatus,
  CollectionStats,
  DEFAULT_COLLECTION_OPTIONS,
  ERROR_MESSAGES,
  QdrantEventType,
  QdrantEvent
} from './QdrantTypes';

/**
 * Qdrant 集合管理器接口
 */
export interface IQdrantCollectionManager {
  createCollection(name: string, vectorSize: number, distance?: VectorDistance, recreateIfExists?: boolean): Promise<boolean>;
  createCollectionWithOptions(name: string, options: CollectionCreateOptions): Promise<boolean>;
  deleteCollection(name: string): Promise<boolean>;
  collectionExists(name: string): Promise<boolean>;
  getCollectionInfo(collectionName: string): Promise<CollectionInfo | null>;
  getCollectionStats(collectionName: string): Promise<CollectionStats | null>;
  createPayloadIndex(collectionName: string, field: string, fieldType?: string): Promise<boolean>;
  createPayloadIndexes(collectionName: string, fields: string[]): Promise<boolean>;
  listCollections(): Promise<string[]>;
  addEventListener(type: QdrantEventType, listener: (event: QdrantEvent) => void): void;
  removeEventListener(type: QdrantEventType, listener: (event: QdrantEvent) => void): void;
}

/**
 * Qdrant 集合管理器实现
 * 
 * 负责创建、删除、检查集合，获取集合信息，管理集合配置等
 */
@injectable()
export class QdrantCollectionManager implements IQdrantCollectionManager {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private connectionManager: IQdrantConnectionManager;
  private eventListeners: Map<QdrantEventType, ((event: QdrantEvent) => void)[]> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.IQdrantConnectionManager) connectionManager: IQdrantConnectionManager
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.connectionManager = connectionManager;
  }

  /**
   * 创建集合
   */
  async createCollection(
    name: string,
    vectorSize: number,
    distance: VectorDistance = 'Cosine',
    recreateIfExists: boolean = false
  ): Promise<boolean> {
    const options: CollectionCreateOptions = {
      vectorSize,
      distance,
      recreateIfExists
    };
    return this.createCollectionWithOptions(name, options);
  }

  /**
   * 使用选项创建集合
   */
  async createCollectionWithOptions(name: string, options: CollectionCreateOptions): Promise<boolean> {
    try {
      const client = this.connectionManager.getClient();
      if (!client) {
        throw new Error(ERROR_MESSAGES.CONNECTION_FAILED);
      }

      const exists = await this.collectionExists(name);

      // 如果集合已存在，检查向量维度是否匹配
      if (exists && !options.recreateIfExists) {
        const collectionInfo = await this.getCollectionInfo(name);
        if (collectionInfo && collectionInfo.vectors.size !== options.vectorSize) {
          this.logger.warn(`Collection ${name} exists with different vector size`, {
            existingSize: collectionInfo.vectors.size,
            requestedSize: options.vectorSize
          });
          // 如果维度不匹配，删除并重新创建集合
          await this.deleteCollection(name);
        } else {
          this.logger.info(`Collection ${name} already exists with correct vector size: ${options.vectorSize}`);
          return true;
        }
      } else if (exists && options.recreateIfExists) {
        await this.deleteCollection(name);
      }

      // 合并默认选项
      const finalOptions = {
        ...DEFAULT_COLLECTION_OPTIONS,
        ...options,
        optimizersConfig: {
          ...DEFAULT_COLLECTION_OPTIONS.optimizersConfig,
          ...options.optimizersConfig
        }
      };

      this.logger.info(`Creating collection ${name} with vector size: ${finalOptions.vectorSize}`, {
        distance: finalOptions.distance,
        optimizersConfig: finalOptions.optimizersConfig
      });

      await client.createCollection(name, {
        vectors: {
          size: finalOptions.vectorSize,
          distance: finalOptions.distance,
        },
        optimizers_config: finalOptions.optimizersConfig,
        replication_factor: finalOptions.replicationFactor,
        write_consistency_factor: finalOptions.writeConsistencyFactor,
      });

      // 创建payload索引
      const payloadIndexes = finalOptions.payloadIndexes || DEFAULT_COLLECTION_OPTIONS.payloadIndexes;
      if (payloadIndexes) {
        for (const field of payloadIndexes) {
          const indexCreated = await this.createPayloadIndex(name, field);
          if (!indexCreated) {
            throw new Error(`Failed to create payload index for field: ${field}`);
          }
        }
      }

      this.logger.info(`Created collection ${name} with all payload indexes`, {
        vectorSize: finalOptions.vectorSize,
        distance: finalOptions.distance,
        indexesCount: payloadIndexes?.length || 0
      });

      this.emitEvent(QdrantEventType.COLLECTION_CREATED, {
        collectionName: name,
        vectorSize: finalOptions.vectorSize,
        distance: finalOptions.distance
      });

      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to create collection ${name}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantCollectionManager', operation: 'createCollection' }
      );
      return false;
    }
  }

  /**
   * 检查集合是否存在
   */
  async collectionExists(name: string): Promise<boolean> {
    try {
      const client = this.connectionManager.getClient();
      if (!client) {
        return false;
      }

      const collections = await client.getCollections();
      return collections.collections.some(col => col.name === name);
    } catch (error) {
      this.logger.warn('Failed to check collection existence', {
        collectionName: name,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 删除集合
   */
  async deleteCollection(name: string): Promise<boolean> {
    try {
      const client = this.connectionManager.getClient();
      if (!client) {
        throw new Error(ERROR_MESSAGES.CONNECTION_FAILED);
      }

      await client.deleteCollection(name);
      this.logger.info(`Deleted collection ${name}`);
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to delete collection ${name}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantCollectionManager', operation: 'deleteCollection' }
      );
      return false;
    }
  }

  /**
   * 获取集合信息
   */
  async getCollectionInfo(collectionName: string): Promise<CollectionInfo | null> {
    try {
      const client = this.connectionManager.getClient();
      if (!client) {
        return null;
      }

      const info = await client.getCollection(collectionName);

      // 处理向量配置的新结构
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
              ? (vectorDistance as VectorDistance)
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

  /**
   * 获取集合统计信息
   */
  async getCollectionStats(collectionName: string): Promise<CollectionStats | null> {
    try {
      const collectionInfo = await this.getCollectionInfo(collectionName);
      if (!collectionInfo) {
        return null;
      }

      // 这里可以添加更多统计信息的获取逻辑
      // 例如磁盘使用情况、内存使用情况等
      return {
        name: collectionInfo.name,
        vectorsCount: collectionInfo.pointsCount,
        vectorSize: collectionInfo.vectors.size,
        distance: collectionInfo.vectors.distance,
        status: this.mapStatusToEnum(collectionInfo.status),
        indexedVectorsCount: collectionInfo.pointsCount, // 假设所有向量都已索引
        payloadSchema: {}, // 可以从集合配置中获取
        diskUsage: 0, // 需要从 Qdrant API 获取
        memoryUsage: 0 // 需要从 Qdrant API 获取
      };
    } catch (error) {
      this.logger.warn('Failed to get collection stats', {
        collectionName,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 创建有效载荷索引
   */
  async createPayloadIndex(collectionName: string, field: string, fieldType: string = 'keyword'): Promise<boolean> {
    try {
      const client = this.connectionManager.getClient();
      if (!client) {
        throw new Error(ERROR_MESSAGES.CONNECTION_FAILED);
      }

      await client.createPayloadIndex(collectionName, {
        field_name: field,
        field_schema: fieldType as any,
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
        fieldType,
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * 批量创建有效载荷索引
   */
  async createPayloadIndexes(collectionName: string, fields: string[]): Promise<boolean> {
    try {
      const results = await Promise.all(
        fields.map(field => this.createPayloadIndex(collectionName, field))
      );
      
      const successCount = results.filter(result => result).length;
      const totalCount = results.length;
      
      this.logger.info(`Created payload indexes for collection ${collectionName}`, {
        successCount,
        totalCount,
        fields
      });
      
      return successCount === totalCount;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to create payload indexes for collection ${collectionName}: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QdrantCollectionManager', operation: 'createPayloadIndexes' }
      );
      return false;
    }
  }

  /**
   * 列出所有集合
   */
  async listCollections(): Promise<string[]> {
    try {
      const client = this.connectionManager.getClient();
      if (!client) {
        return [];
      }

      const collections = await client.getCollections();
      return collections.collections.map(col => col.name);
    } catch (error) {
      this.logger.warn('Failed to list collections', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * 添加事件监听器
   */
  addEventListener(type: QdrantEventType, listener: (event: QdrantEvent) => void): void {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, []);
    }
    this.eventListeners.get(type)!.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(type: QdrantEventType, listener: (event: QdrantEvent) => void): void {
    const listeners = this.eventListeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 发射事件
   */
  private emitEvent(type: QdrantEventType, data?: any, error?: Error): void {
    const event: QdrantEvent = {
      type,
      timestamp: new Date(),
      data,
      error
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (err) {
          this.logger.error('Error in event listener', {
            eventType: type,
            error: err instanceof Error ? err.message : String(err)
          });
        }
      });
    }
  }

  /**
   * 将状态字符串映射为枚举
   */
  private mapStatusToEnum(status: string): CollectionStatus {
    switch (status.toLowerCase()) {
      case 'green':
      case 'ready':
        return CollectionStatus.READY;
      case 'yellow':
      case 'updating':
        return CollectionStatus.UPDATING;
      case 'red':
      case 'error':
        return CollectionStatus.ERROR;
      default:
        return CollectionStatus.READY;
    }
  }
}