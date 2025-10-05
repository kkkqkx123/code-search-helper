import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { IDatabaseService } from './IDatabaseService';
import { NebulaService } from '../nebula/NebulaService';
import { QdrantService } from '../qdrant/QdrantService';
import { DatabaseConfigManager } from './DatabaseConfigManager';
import { DatabaseLoggerService } from './DatabaseLoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { DatabaseError, DatabaseErrorType } from './DatabaseError';
import { diContainer } from '../../core/DIContainer';  // 导入DI容器
import { DatabaseEventType } from './DatabaseEventTypes';  // 导入事件类型

/**
 * 数据库类型枚举
 */
export enum DatabaseType {
  QDRANT = 'qdrant',
  NEBULA = 'nebula'
}

/**
 * 数据库配置接口
 */
export interface DatabaseConfig {
  type: DatabaseType;
  connection: ConnectionConfig;
  pool?: PoolConfig;
  features: FeatureConfig;
}

/**
 * 连接配置接口
 */
export interface ConnectionConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  apiKey?: string;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * 连接池配置接口
 */
export interface PoolConfig {
  minConnections?: number;
  maxConnections?: number;
  idleTimeout?: number;
}

/**
 * 功能配置接口
 */
export interface FeatureConfig {
  enableCaching?: boolean;
  enableCompression?: boolean;
  enableEncryption?: boolean;
  enableMonitoring?: boolean;
}

/**
 * 数据库服务工厂
 * 提供统一的数据库服务创建接口
 */
@injectable()
export class DatabaseServiceFactory {
  private configManager: DatabaseConfigManager;
  
  constructor(
    @inject(TYPES.DatabaseLoggerService) private logger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) {
    // 创建DatabaseConfigManager实例
    this.configManager = new DatabaseConfigManager(this.logger);
  }

  /**
   * 根据配置创建数据库服务实例
   */
  async createService(config: DatabaseConfig): Promise<IDatabaseService> {
    try {
      // 验证配置
      this.validateConfig(config);

      let service: IDatabaseService;

      switch (config.type) {
        case DatabaseType.QDRANT:
          service = await this.createQdrantService(config);
          break;
        case DatabaseType.NEBULA:
          service = await this.createNebulaService(config);
          break;
        default:
          throw DatabaseError.configurationError(
            `Unsupported database type: ${config.type}`,
            {
              component: 'DatabaseServiceFactory',
              operation: 'createService',
              details: { config }
            }
          );
      }

      // 记录服务创建事件
      await this.logger.logDatabaseEvent({
        type: DatabaseEventType.SERVICE_INITIALIZED,
        source: config.type,
        timestamp: new Date(),
        data: {
          config,
          serviceType: config.type
        }
      });

      return service;
    } catch (error) {
      const dbError = DatabaseError.fromError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: 'DatabaseServiceFactory',
          operation: 'createService',
          details: { config }
        }
      );

      this.errorHandler.handleError(dbError, dbError.context);
      throw dbError;
    }
  }

  /**
   * 创建Qdrant服务实例
   */
  private async createQdrantService(config: DatabaseConfig): Promise<QdrantService> {
    // 从DI容器获取QdrantService实例
    try {
      // 从DI容器获取QdrantService实例
      const qdrantService = diContainer.get<QdrantService>(TYPES.QdrantService);
      
      // 配置Qdrant服务
      await this.configureService(qdrantService, config);

      return qdrantService;
    } catch (error) {
      throw DatabaseError.internalError(
        `Failed to create Qdrant service: ${error instanceof Error ? error.message : String(error)}`,
        {
          component: 'DatabaseServiceFactory',
          operation: 'createQdrantService',
          details: { config }
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * 创建Nebula服务实例
   */
  private async createNebulaService(config: DatabaseConfig): Promise<NebulaService> {
    try {
      // 从DI容器获取NebulaService实例
      const nebulaService = diContainer.get<NebulaService>(TYPES.INebulaService);
      
      // 配置Nebula服务
      await this.configureService(nebulaService, config);

      return nebulaService;
    } catch (error) {
      throw DatabaseError.internalError(
        `Failed to create Nebula service: ${error instanceof Error ? error.message : String(error)}`,
        {
          component: 'DatabaseServiceFactory',
          operation: 'createNebulaService',
          details: { config }
        },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * 配置服务
   */
  private async configureService(service: IDatabaseService, config: DatabaseConfig): Promise<void> {
    // 这里可以根据配置对服务进行进一步的配置
    // 例如设置连接参数、启用功能等
    console.log(`Configuring service of type: ${config.type}`);
  }

  /**
   * 验证配置
   */
  private validateConfig(config: DatabaseConfig): void {
    if (!config || typeof config !== 'object') {
      throw DatabaseError.validationError(
        'Config must be a valid object',
        {
          component: 'DatabaseServiceFactory',
          operation: 'validateConfig',
          details: { config }
        }
      );
    }

    if (!config.type || !Object.values(DatabaseType).includes(config.type)) {
      throw DatabaseError.validationError(
        `Invalid database type: ${config.type}. Must be one of: ${Object.values(DatabaseType).join(', ')}`,
        {
          component: 'DatabaseServiceFactory',
          operation: 'validateConfig',
          details: { config }
        }
      );
    }

    if (!config.connection || typeof config.connection !== 'object') {
      throw DatabaseError.validationError(
        'Connection config must be a valid object',
        {
          component: 'DatabaseServiceFactory',
          operation: 'validateConfig',
          details: { config }
        }
      );
    }

    if (!config.connection.host || typeof config.connection.host !== 'string') {
      throw DatabaseError.validationError(
        'Connection host must be a non-empty string',
        {
          component: 'DatabaseServiceFactory',
          operation: 'validateConfig',
          details: { config }
        }
      );
    }

    if (typeof config.connection.port !== 'number' || config.connection.port <= 0) {
      throw DatabaseError.validationError(
        'Connection port must be a positive number',
        {
          component: 'DatabaseServiceFactory',
          operation: 'validateConfig',
          details: { config }
        }
      );
    }
  }

  /**
   * 获取支持的数据库类型列表
   */
  getSupportedDatabaseTypes(): DatabaseType[] {
    return Object.values(DatabaseType);
  }
}