import { injectable, inject } from 'inversify';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { DatabaseLoggerService } from '../common/DatabaseLoggerService';
import { NebulaConnectionManager } from './NebulaConnectionManager';
import { NebulaQueryBuilder } from './NebulaQueryBuilder';
import { NebulaProjectManager } from './NebulaProjectManager';
import { TYPES } from '../../types';
import { NebulaDataService } from './data/NebulaDataService';
import { NebulaSpaceService } from './space/NebulaSpaceService';
import {
  NebulaNode,
  NebulaRelationship,
  NebulaEventType,
  NebulaEvent,
  ProjectSpaceInfo,
  NebulaSpaceInfo
} from './NebulaTypes';
import { BaseDatabaseService } from '../common/BaseDatabaseService';
import { IDatabaseService, IConnectionManager, IProjectManager } from '../common/IDatabaseService';
import { DatabaseEventType, NebulaEventType as UnifiedNebulaEventType } from '../common/DatabaseEventTypes';
import { DatabaseError, DatabaseErrorType } from '../common/DatabaseError';

export interface INebulaService {
  // 基础操作
  initialize(): Promise<boolean>;
  isConnected(): boolean;
  isInitialized(): boolean;
  close(): Promise<void>;
  reconnect(): Promise<boolean>;
  
  // 项目相关操作
  createSpaceForProject(projectPath: string): Promise<boolean>;
  deleteSpaceForProject(projectPath: string): Promise<boolean>;
  
  // 数据操作
  insertNodes(nodes: NebulaNode[]): Promise<boolean>;
  insertRelationships(relationships: NebulaRelationship[]): Promise<boolean>;
  
  // 查询操作
  findNodesByLabel(label: string, filter?: any): Promise<any[]>;
  findRelationships(type?: string, filter?: any): Promise<any[]>;
  
  // 兼容性方法（保持向后兼容）
  executeReadQuery(nGQL: string, parameters?: Record<string, any>): Promise<any>;
  executeWriteQuery(nGQL: string, parameters?: Record<string, any>): Promise<any>;
  executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<any[]>;
  useSpace(spaceName: string): Promise<void>;
  createNode(label: string, properties: Record<string, any>): Promise<string>;
  createRelationship(
    type: string,
    sourceId: string,
    targetId: string,
    properties?: Record<string, any>
  ): Promise<void>;
  findNodes(label: string, properties?: Record<string, any>): Promise<any[]>;
  getDatabaseStats(): Promise<any>;
  
  // 事件处理
  addEventListener(type: NebulaEventType | string, listener: (event: any) => void): void;
  removeEventListener(type: NebulaEventType | string, listener: (event: any) => void): void;
}

@injectable()
export class NebulaService extends BaseDatabaseService implements INebulaService, IDatabaseService {
  private databaseLogger: DatabaseLoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  protected connectionManager: NebulaConnectionManager;
  private dataService: NebulaDataService;
  private spaceService: NebulaSpaceService;
  private queryBuilder: NebulaQueryBuilder;
  protected projectManager: NebulaProjectManager;
  protected initialized = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private reconnectDelay = 1000;

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.NebulaConnectionManager) connectionManager: NebulaConnectionManager,
    @inject(TYPES.NebulaDataService) dataService: NebulaDataService,
    @inject(TYPES.NebulaSpaceService) spaceService: NebulaSpaceService,
    @inject(TYPES.NebulaQueryBuilder) queryBuilder: NebulaQueryBuilder,
    @inject(TYPES.INebulaProjectManager) projectManager: NebulaProjectManager
  ) {
    // 调用父类构造函数，提供必要的依赖
    super(
      connectionManager as unknown as IConnectionManager,
      projectManager as unknown as IProjectManager
    );
    
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.connectionManager = connectionManager;
    this.dataService = dataService;
    this.spaceService = spaceService;
    this.queryBuilder = queryBuilder;
    this.projectManager = projectManager;
  }

  /**
   * 初始化 Nebula 服务
   */
  async initialize(): Promise<boolean> {
    try {
      // 初始化基础服务
      const baseInitialized = await super.initialize();
      if (!baseInitialized) {
        return false;
      }

      // 使用 DatabaseLoggerService 记录初始化事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SERVICE_INITIALIZED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Initializing Nebula service' }
      });

      // 连接到Nebula数据库
      const connected = await this.connectionManager.connect();

      if (!connected) {
        // 使用 DatabaseLoggerService 记录连接失败事件
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.CONNECTION_FAILED,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: 'Failed to connect to Nebula database, will continue without graph database' },
          error: new Error('Failed to connect to Nebula database, will continue without graph database')
        });
        this.emitEvent('error', new Error('Failed to connect to Nebula database, will continue without graph database'));
        // 重置重连尝试计数，避免无限重连
        this.reconnectAttempts = 0;
        return false;  // 返回false表示初始化失败，但不会导致无限重连
      }

      // 不再在服务初始化时初始化schema，而是依赖于项目空间创建时初始化

      this.initialized = true;
      this.reconnectAttempts = 0; // 成功连接后重置重连尝试计数
      // 使用 DatabaseLoggerService 记录初始化成功事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SERVICE_INITIALIZED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Nebula service initialized successfully' }
      });
      this.emitEvent('initialized', { timestamp: new Date() });

      return true;
    } catch (error) {
      // 使用 DatabaseLoggerService 记录初始化失败事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.SERVICE_ERROR,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Failed to initialize Nebula service, will continue without graph database' },
        error: error instanceof Error ? error : new Error(String(error))
      });
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      // 重置重连尝试计数，避免无限重连
      this.reconnectAttempts = 0;
      return false;  // 返回false表示初始化失败，但不会导致无限重连
    }
  }

  private async initializeSchema(): Promise<void> {
    try {
      // 使用 DatabaseLoggerService 记录schema初始化事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Initializing Nebula schema' }
      });

      // 创建代码库分析所需的标签（使用反引号转义保留关键字）
      const tags = [
        { name: 'File', fields: 'name string, `path` string, type string, size int, language string, hash string' },
        { name: 'Function', fields: 'name string, signature string, parameters string, returnType string, visibility string, isStatic bool, isAsync bool' },
        { name: 'Class', fields: 'name string, type string, extends string, implements string, isAbstract bool, isFinal bool' },
        { name: 'Variable', fields: 'name string, type string, value string, isConstant bool, isGlobal bool, scope string' },
        { name: 'Import', fields: 'module string, alias string, isDefault bool, isTypeOnly bool' },
        { name: 'Export', fields: 'name string, type string, isDefault bool' },
        { name: 'Comment', fields: 'content string, type string, line int, column int' }
      ];

      // 创建代码库分析所需的边类型
      const edgeTypes = [
        { name: 'CONTAINS', fields: 'line int, column int' },
        { name: 'CALLS', fields: 'line int, column int' },
        { name: 'EXTENDS', fields: 'line int' },
        { name: 'IMPLEMENTS', fields: 'line int' },
        { name: 'IMPORTS', fields: 'line int, isTypeOnly bool' },
        { name: 'EXPORTS', fields: 'line int' },
        { name: 'REFERENCES', fields: 'line int, column int, context string' },
        { name: 'MODIFIES', fields: 'line int, column int' },
        { name: 'DECLARES', fields: 'line int, column int' },
        { name: 'OVERRIDES', fields: 'line int' }
      ];

      // 创建标签 - 这些会自动应用到当前激活的space
      for (const tag of tags) {
        try {
          const createTagQuery = `CREATE TAG IF NOT EXISTS ${tag.name} (${tag.fields})`;
          await this.executeWriteQuery(createTagQuery);
          // 使用 DatabaseLoggerService 记录标签创建事件
          await this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.DATA_INSERTED,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: `Created tag: ${tag.name}` }
          });
        } catch (error) {
          // 使用 DatabaseLoggerService 记录标签创建失败事件
          await this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.DATA_ERROR,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: `Failed to create tag ${tag.name}` },
            error: error instanceof Error ? error : new Error(String(error))
          });
        }
      }

      // 创建边类型 - 这些会自动应用到当前激活的space
      for (const edgeType of edgeTypes) {
        try {
          const createEdgeQuery = `CREATE EDGE IF NOT EXISTS ${edgeType.name} (${edgeType.fields})`;
          await this.executeWriteQuery(createEdgeQuery);
          // 使用 DatabaseLoggerService 记录边类型创建事件
          await this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.DATA_INSERTED,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: `Created edge type: ${edgeType.name}` }
          });
        } catch (error) {
          // 使用 DatabaseLoggerService 记录边类型创建失败事件
          await this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.DATA_ERROR,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: `Failed to create edge type ${edgeType.name}` },
            error: error instanceof Error ? error : new Error(String(error))
          });
        }
      }

      // 使用 DatabaseLoggerService 记录schema初始化完成事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Nebula schema initialized' }
      });
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  async executeReadQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      // 尝试重新连接
      const reconnected = await this.reconnect();
      if (!reconnected) {
        throw new Error('Nebula service is not initialized and reconnection failed');
      }
    }

    try {
      const result = await this.connectionManager.executeQuery(nGQL, parameters);

      if (result.error) {
        // 检查是否是连接错误，如果是则尝试重连
        if (result.error.includes('connect') || result.error.includes('connection')) {
          // 使用 DatabaseLoggerService 记录连接错误事件
          await this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.CONNECTION_ERROR,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: 'Connection error detected, attempting to reconnect...' }
          });
          const reconnected = await this.reconnect();
          if (reconnected) {
            // 重连成功后重新执行查询
            const retryResult = await this.connectionManager.executeQuery(nGQL, parameters);
            if (retryResult.error) {
              throw new Error(retryResult.error);
            }
            return retryResult;
          } else {
            // 如果重连失败，抛出错误而不继续重试
            throw new Error('Connection error and reconnection failed: ' + result.error);
          }
        }
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      // 检查是否是连接错误，如果是则尝试重连
      if (error instanceof Error && (error.message.includes('connect') || error.message.includes('connection'))) {
        // 使用 DatabaseLoggerService 记录连接错误事件
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.CONNECTION_ERROR,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: 'Connection error in executeReadQuery, attempting to reconnect...' }
        });
        const reconnected = await this.reconnect();
        if (reconnected) {
          // 重连成功后重新执行查询
          try {
            const retryResult = await this.connectionManager.executeQuery(nGQL, parameters);
            if (retryResult.error) {
              throw new Error(retryResult.error);
            }
            return retryResult;
          } catch (retryError) {
            // 如果重试查询也失败，抛出错误而不继续重试
            throw new Error('Reconnection successful but query execution failed: ' + (retryError instanceof Error ? retryError.message : String(retryError)));
          }
        } else {
          // 如果重连失败，抛出错误而不继续重试
          throw new Error('Connection error and reconnection failed: ' + error.message);
        }
      }
      
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async executeWriteQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      // 尝试重新连接
      const reconnected = await this.reconnect();
      if (!reconnected) {
        throw new Error('Nebula service is not initialized and reconnection failed');
      }
    }

    try {
      const result = await this.connectionManager.executeQuery(nGQL, parameters);

      if (result.error) {
        // 检查是否是连接错误，如果是则尝试重连
        if (result.error.includes('connect') || result.error.includes('connection')) {
          // 使用 DatabaseLoggerService 记录连接错误事件
          await this.databaseLogger.logDatabaseEvent({
            type: DatabaseEventType.CONNECTION_ERROR,
            source: 'nebula',
            timestamp: new Date(),
            data: { message: 'Connection error detected, attempting to reconnect...' }
          });
          const reconnected = await this.reconnect();
          if (reconnected) {
            // 重连成功后重新执行查询
            const retryResult = await this.connectionManager.executeQuery(nGQL, parameters);
            if (retryResult.error) {
              throw new Error(retryResult.error);
            }
            return retryResult;
          } else {
            // 如果重连失败，抛出错误而不继续重试
            throw new Error('Connection error and reconnection failed: ' + result.error);
          }
        }
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      // 检查是否是连接错误，如果是则尝试重连
      if (error instanceof Error && (error.message.includes('connect') || error.message.includes('connection'))) {
        // 使用 DatabaseLoggerService 记录连接错误事件
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.CONNECTION_ERROR,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: 'Connection error in executeWriteQuery, attempting to reconnect...' }
        });
        const reconnected = await this.reconnect();
        if (reconnected) {
          // 重连成功后重新执行查询
          try {
            const retryResult = await this.connectionManager.executeQuery(nGQL, parameters);
            if (retryResult.error) {
              throw new Error(retryResult.error);
            }
            return retryResult;
          } catch (retryError) {
            // 如果重试查询也失败，抛出错误而不继续重试
            throw new Error('Reconnection successful but query execution failed: ' + (retryError instanceof Error ? retryError.message : String(retryError)));
          }
        } else {
          // 如果重连失败，抛出错误而不继续重连
          throw new Error('Connection error and reconnection failed: ' + error.message);
        }
      }
      
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<any[]> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      // 尝试重新连接
      const reconnected = await this.reconnect();
      if (!reconnected) {
        throw new Error('Nebula service is not initialized and reconnection failed');
      }
    }

    try {
      const results = await this.connectionManager.executeTransaction(queries);
      return results;
    } catch (error) {
      // 检查是否是连接错误，如果是则尝试重连
      if (error instanceof Error && (error.message.includes('connect') || error.message.includes('connection'))) {
        // 使用 DatabaseLoggerService 记录连接错误事件
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.CONNECTION_ERROR,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: 'Connection error detected in transaction, attempting to reconnect...' }
        });
        const reconnected = await this.reconnect();
        if (reconnected) {
          // 重连成功后重新执行事务
          try {
            const retryResults = await this.connectionManager.executeTransaction(queries);
            return retryResults;
          } catch (retryError) {
            // 如果重试事务也失败，抛出错误而不继续重试
            throw new Error('Reconnection successful but transaction execution failed: ' + (retryError instanceof Error ? retryError.message : String(retryError)));
          }
        } else {
          // 如果重连失败，抛出错误而不继续重连
          throw new Error('Connection error and reconnection failed: ' + error.message);
        }
      }
      
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async useSpace(spaceName: string): Promise<void> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      throw new Error('Nebula service is not initialized');
    }

    // 验证spaceName是否有效
    if (!spaceName || spaceName === 'undefined' || spaceName === '') {
      throw new Error(`Invalid space name provided: ${spaceName}`);
    }

    try {
      const success = await this.spaceService.useSpace(spaceName);
      if (success) {
        // 使用 DatabaseLoggerService 记录空间切换事件
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.SPACE_CREATED,  // 使用SPACE_CREATED类型，因为这是关于空间的操作
          source: 'nebula',
          timestamp: new Date(),
          data: { message: `Switched to space: ${spaceName}`, spaceName }
        });
      } else {
        throw new Error(`Failed to switch to space: ${spaceName}`);
      }
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async createNode(label: string, properties: Record<string, any>): Promise<string> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      throw new Error('Nebula service is not initialized');
    }

    try {
      const nodeId = await this.dataService.createNode({ label, properties });
      this.emitEvent('data_inserted', { label, nodeId, properties });
      return nodeId;
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async createRelationship(
    type: string,
    sourceId: string,
    targetId: string,
    properties?: Record<string, any>
  ): Promise<void> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      throw new Error('Nebula service is not initialized');
    }

    try {
      await this.dataService.createRelationship({
        type,
        sourceId,
        targetId,
        properties
      });
      this.emitEvent('data_inserted', { type, sourceId, targetId, properties });
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async findNodes(label: string, properties?: Record<string, any>): Promise<any[]> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      throw new Error('Nebula service is not initialized');
    }

    try {
      const nodes = await this.dataService.findNodesByLabel(label, properties);
      this.emitEvent('data_queried', { label, properties, resultCount: nodes.length });
      return nodes;
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      throw new Error('Nebula service is not initialized');
    }

    try {
      const relationships = await this.dataService.findRelationships(type, properties);
      this.emitEvent('data_queried', { type, properties, resultCount: relationships.length });
      return relationships;
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async getDatabaseStats(): Promise<any> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      throw new Error('Nebula service is not initialized');
    }

    try {
      // 检查连接状态
      if (!this.connectionManager.isConnected()) {
        throw new Error('Nebula service is not connected');
      }
      
      const stats = await this.dataService.getDatabaseStats();
      return stats;
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.connectionManager.disconnect();
      await super.close();
      this.initialized = false;
      // 使用 DatabaseLoggerService 记录服务关闭事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_CLOSED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Nebula service closed' }
      });
      this.emitEvent('closed', { timestamp: new Date() });
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 尝试重新连接到Nebula数据库
   */
  async reconnect(): Promise<boolean> {
    try {
      // 使用 DatabaseLoggerService 记录重连尝试事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_ERROR,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Attempting to reconnect to Nebula database' }
      });
      
      // 增加重连尝试次数
      this.reconnectAttempts++;
      
      // 如果超过最大重连次数，返回失败
      if (this.reconnectAttempts > this.maxReconnectAttempts) {
        // 使用 DatabaseLoggerService 记录重连失败事件
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.CONNECTION_ERROR,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: `Max reconnect attempts (${this.maxReconnectAttempts}) exceeded, giving up on Nebula service` }
        });
        // 重置重连尝试次数，避免永久锁定
        this.reconnectAttempts = 0;
        return false;
      }
      
      // 关闭现有连接
      await this.close();
      
      // 等待一段时间再重连
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay * this.reconnectAttempts));
      
      // 重新初始化
      const connected = await this.initialize();
      
      if (connected) {
        // 使用 DatabaseLoggerService 记录重连成功事件
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.CONNECTION_OPENED,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: 'Successfully reconnected to Nebula database' }
        });
        this.reconnectAttempts = 0; // 重置重连次数
        return true;
      } else {
        // 使用 DatabaseLoggerService 记录重连失败事件
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.CONNECTION_ERROR,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: `Reconnect attempt ${this.reconnectAttempts} failed` }
        });
        // 即使重连失败，也不要重置重连次数，以便达到最大尝试次数后停止
        return false;
      }
    } catch (error) {
      // 使用 DatabaseLoggerService 记录重连错误事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.CONNECTION_ERROR,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: 'Error during reconnection attempt' },
        error: error instanceof Error ? error : new Error(String(error))
      });
      return false;
    }
  }

  /**
   * 检查服务是否已初始化且连接正常
   */
  isInitialized(): boolean {
    return this.initialized && this.isConnected();
  }

  /**
   * 为项目创建空间
   */
  async createSpaceForProject(projectPath: string): Promise<boolean> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      throw new Error('Nebula service is not initialized');
    }

    try {
      // 使用项目管理器创建空间
      const result = await this.projectManager.createSpaceForProject(projectPath);
      
      if (result) {
        this.emitEvent('project_space_created', { projectPath });
        // 使用 DatabaseLoggerService 记录空间创建事件
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.SPACE_CREATED,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: `Created space for project: ${projectPath}`, projectPath }
        });
      }
      
      return result;
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 删除项目的空间
   */
  async deleteSpaceForProject(projectPath: string): Promise<boolean> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      throw new Error('Nebula service is not initialized');
    }

    try {
      // 使用项目管理器删除空间
      const result = await this.projectManager.deleteSpaceForProject(projectPath);
      
      if (result) {
        this.emitEvent('project_space_deleted', { projectPath });
        // 使用 DatabaseLoggerService 记录空间删除事件
        await this.databaseLogger.logDatabaseEvent({
          type: DatabaseEventType.SPACE_DELETED,
          source: 'nebula',
          timestamp: new Date(),
          data: { message: `Deleted space for project: ${projectPath}`, projectPath }
        });
      }
      
      return result;
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 批量插入节点
   */
  async insertNodes(nodes: NebulaNode[]): Promise<boolean> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      throw new Error('Nebula service is not initialized');
    }

    try {
      const startTime = Date.now();
      
      // 按标签分组节点
      const nodesByLabel = this.groupNodesByLabel(nodes);
      
      // 为每个标签创建批量插入语句
      const queries: Array<{ query: string; params: Record<string, any> }> = [];
      
      for (const [label, labelNodes] of Object.entries(nodesByLabel)) {
        const query = `
          INSERT VERTEX ${label}(${Object.keys(labelNodes[0].properties).join(', ')})
          VALUES ${labelNodes.map(node =>
            `"${node.id}": (${Object.values(node.properties).map(val =>
              typeof val === 'string' ? `"${val}"` : val
            ).join(', ')})`
          ).join(', ')}
        `;
        
        queries.push({ query, params: {} });
      }
      
      // 执行事务
      await this.executeTransaction(queries);
      
      const duration = Date.now() - startTime;
      this.emitEvent('data_inserted', { nodeCount: nodes.length, duration });
      // 使用 DatabaseLoggerService 记录节点插入事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_INSERTED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Inserted ${nodes.length} nodes`, nodeCount: nodes.length }
      });
      return true;
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 批量插入关系
   */
  async insertRelationships(relationships: NebulaRelationship[]): Promise<boolean> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      throw new Error('Nebula service is not initialized');
    }

    try {
      const startTime = Date.now();
      
      // 按类型分组关系
      const relationshipsByType = this.groupRelationshipsByType(relationships);
      
      // 为每个类型创建批量插入语句
      const queries: Array<{ query: string; params: Record<string, any> }> = [];
      
      for (const [type, typeRelationships] of Object.entries(relationshipsByType)) {
        const query = `
          INSERT EDGE ${type}(${typeRelationships[0].properties ? Object.keys(typeRelationships[0].properties).join(', ') : ''})
          VALUES ${typeRelationships.map(rel =>
            `"${rel.sourceId}" -> "${rel.targetId}": ${rel.properties ?
              `(${Object.values(rel.properties).map(val =>
                typeof val === 'string' ? `"${val}"` : val
              ).join(', ')})` : '()'
            }`
          ).join(', ')}
        `;
        
        queries.push({ query, params: {} });
      }
      
      // 执行事务
      await this.executeTransaction(queries);
      
      const duration = Date.now() - startTime;
      this.emitEvent('data_inserted', { relationshipCount: relationships.length, duration });
      // 使用 DatabaseLoggerService 记录关系插入事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.DATA_INSERTED,
        source: 'nebula',
        timestamp: new Date(),
        data: { message: `Inserted ${relationships.length} relationships`, relationshipCount: relationships.length }
      });
      return true;
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 根据标签查找节点
   */
  async findNodesByLabel(label: string, filter?: any): Promise<any[]> {
    if (!this.initialized) {
      // 如果服务从未成功初始化过，不尝试重新连接
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        throw new Error('Nebula service is not initialized and reconnection attempts exhausted');
      }
      
      throw new Error('Nebula service is not initialized');
    }

    try {
      const startTime = Date.now();
      
      let query = `MATCH (v:${label}) RETURN v`;
      
      if (filter) {
        const conditions = Object.entries(filter).map(([key, value]) =>
          `v.${key} == ${typeof value === 'string' ? `"${value}"` : value}`
        ).join(' AND ');
        query += ` WHERE ${conditions}`;
      }
      
      const result = await this.executeReadQuery(query);
      const duration = Date.now() - startTime;
      
      this.emitEvent('data_queried', { label, filter, duration, resultCount: result.data?.length || 0 });
      return result.data || [];
    } catch (error) {
      this.emitEvent('error', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * 添加事件监听器
   */
  addEventListener(type: NebulaEventType | string, listener: (event: any) => void): void {
    // 添加到基础服务
    super.addEventListener(type, listener);
    
    // 使用 DatabaseLoggerService 记录事件监听器添加事件
    this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.SERVICE_INITIALIZED,
      source: 'nebula',
      timestamp: new Date(),
      data: { message: `Event listener added for type: ${type}`, eventType: type }
    }).catch(error => {
      // 如果日志记录失败，我们不希望影响主流程
      console.error('Failed to log event listener addition:', error);
    });
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(type: NebulaEventType | string, listener: (event: any) => void): void {
    // 从基础服务移除
    super.removeEventListener(type, listener);
    
    // 使用 DatabaseLoggerService 记录事件监听器移除事件
    this.databaseLogger.logDatabaseEvent({
      type: DatabaseEventType.SERVICE_INITIALIZED,
      source: 'nebula',
      timestamp: new Date(),
      data: { message: `Event listener removed for type: ${type}`, eventType: type }
    }).catch(error => {
      // 如果日志记录失败，我们不希望影响主流程
      console.error('Failed to log event listener removal:', error);
    });
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details?: any;
    error?: string;
  }> {
    try {
      const baseHealth = await super.healthCheck();
      
      if (baseHealth.status === 'unhealthy') {
        return baseHealth;
      }
      
      // 检查Nebula特定组件
      const connectionStatus = this.isConnected();
      const stats = await this.getDatabaseStats();
      
      return {
        status: connectionStatus ? 'healthy' : 'unhealthy',
        details: {
          ...baseHealth.details,
          spacesCount: stats.spaces?.length || 0,
          nodesCount: stats.nodes || 0,
          edgesCount: stats.edges || 0,
          nebulaStatus: 'operational'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 从项目路径生成空间名称
   */
  private generateSpaceNameFromPath(projectPath: string): string {
    // 将路径转换为有效的空间名称
    return projectPath
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }

  /**
   * 初始化空间模式
   */
  private async initializeSpaceSchema(): Promise<void> {
    // 等待空间创建完成
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 创建标签和边类型
    await this.initializeSchema();
  }

  /**
   * 按标签分组节点
   */
  private groupNodesByLabel(nodes: NebulaNode[]): Record<string, NebulaNode[]> {
    return nodes.reduce((acc, node) => {
      if (!acc[node.label]) {
        acc[node.label] = [];
      }
      acc[node.label].push(node);
      return acc;
    }, {} as Record<string, NebulaNode[]>);
  }

  /**
   * 按类型分组关系
   */
  private groupRelationshipsByType(relationships: NebulaRelationship[]): Record<string, NebulaRelationship[]> {
    return relationships.reduce((acc, relationship) => {
      if (!acc[relationship.type]) {
        acc[relationship.type] = [];
      }
      acc[relationship.type].push(relationship);
      return acc;
    }, {} as Record<string, NebulaRelationship[]>);
  }
}