import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaConnectionManager } from './NebulaConnectionManager';
import { NebulaQueryBuilder } from './NebulaQueryBuilder';
import { TYPES } from '../../types';

export interface INebulaService {
  initialize(): Promise<boolean>;
  isConnected(): boolean;
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
  findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]>;
  getDatabaseStats(): Promise<any>;
  close(): Promise<void>;
}

@injectable()
export class NebulaService implements INebulaService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private connectionManager: NebulaConnectionManager;
  private queryBuilder: NebulaQueryBuilder;
  private initialized = false;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.NebulaConnectionManager) connectionManager: NebulaConnectionManager,
    @inject(TYPES.NebulaQueryBuilder) queryBuilder: NebulaQueryBuilder
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.connectionManager = connectionManager;
    this.queryBuilder = queryBuilder;
  }

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing Nebula service');

      // 连接到Nebula数据库
      const connected = await this.connectionManager.connect();

      if (!connected) {
        throw new Error('Failed to connect to Nebula database');
      }

      // 初始化默认的标签和边类型（如果不存在）
      await this.initializeSchema();

      this.initialized = true;
      this.logger.info('Nebula service initialized successfully');

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to initialize Nebula service: ${errorMessage}`),
        { component: 'NebulaService', operation: 'initialize' }
      );

      return false;
    }
  }

  private async initializeSchema(): Promise<void> {
    try {
      this.logger.debug('Initializing Nebula schema');

      // 创建代码库分析所需的标签
      const tags = [
        { name: 'File', fields: 'name string, path string, type string, size int, language string, hash string' },
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

      // 创建标签
      for (const tag of tags) {
        try {
          const createTagQuery = `CREATE TAG IF NOT EXISTS ${tag.name} (${tag.fields})`;
          await this.executeWriteQuery(createTagQuery);
          this.logger.debug(`Created tag: ${tag.name}`);
        } catch (error) {
          this.logger.warn(`Failed to create tag ${tag.name}`, error);
        }
      }

      // 创建边类型
      for (const edgeType of edgeTypes) {
        try {
          const createEdgeQuery = `CREATE EDGE IF NOT EXISTS ${edgeType.name} (${edgeType.fields})`;
          await this.executeWriteQuery(createEdgeQuery);
          this.logger.debug(`Created edge type: ${edgeType.name}`);
        } catch (error) {
          this.logger.warn(`Failed to create edge type ${edgeType.name}`, error);
        }
      }

      this.logger.debug('Nebula schema initialized');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to initialize Nebula schema: ${errorMessage}`),
        { component: 'NebulaService', operation: 'initializeSchema' }
      );

      throw error;
    }
  }

  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  async executeReadQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
    if (!this.initialized) {
      throw new Error('Nebula service is not initialized');
    }

    try {
      const result = await this.connectionManager.executeQuery(nGQL, parameters);

      if (result.error) {
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to execute read query: ${errorMessage}`),
        {
          component: 'NebulaService',
          operation: 'executeReadQuery',
          query: nGQL,
          parameters
        }
      );

      throw error;
    }
  }

  async executeWriteQuery(nGQL: string, parameters?: Record<string, any>): Promise<any> {
    if (!this.initialized) {
      throw new Error('Nebula service is not initialized');
    }

    try {
      const result = await this.connectionManager.executeQuery(nGQL, parameters);

      if (result.error) {
        throw new Error(result.error);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to execute write query: ${errorMessage}`),
        {
          component: 'NebulaService',
          operation: 'executeWriteQuery',
          query: nGQL,
          parameters
        }
      );

      throw error;
    }
  }

  async executeTransaction(queries: Array<{ query: string; params: Record<string, any> }>): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('Nebula service is not initialized');
    }

    try {
      const results = await this.connectionManager.executeTransaction(queries);
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to execute transaction: ${errorMessage}`),
        {
          component: 'NebulaService',
          operation: 'executeTransaction',
          queries
        }
      );

      throw error;
    }
  }

  async useSpace(spaceName: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Nebula service is not initialized');
    }

    try {
      await this.executeWriteQuery(`USE ${spaceName}`);
      this.logger.debug(`Switched to space: ${spaceName}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to switch to space ${spaceName}: ${errorMessage}`),
        {
          component: 'NebulaService',
          operation: 'useSpace',
          spaceName
        }
      );

      throw error;
    }
  }

  async createNode(label: string, properties: Record<string, any>): Promise<string> {
    if (!this.initialized) {
      throw new Error('Nebula service is not initialized');
    }

    try {
      const nodeId = await this.connectionManager.createNode({ label, properties });
      return nodeId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to create node: ${errorMessage}`),
        {
          component: 'NebulaService',
          operation: 'createNode',
          label,
          properties
        }
      );

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
      throw new Error('Nebula service is not initialized');
    }

    try {
      await this.connectionManager.createRelationship({
        type,
        sourceId,
        targetId,
        properties
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to create relationship: ${errorMessage}`),
        {
          component: 'NebulaService',
          operation: 'createRelationship',
          type,
          sourceId,
          targetId,
          properties
        }
      );

      throw error;
    }
  }

  async findNodes(label: string, properties?: Record<string, any>): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('Nebula service is not initialized');
    }

    try {
      const nodes = await this.connectionManager.findNodesByLabel(label, properties);
      return nodes;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to find nodes: ${errorMessage}`),
        {
          component: 'NebulaService',
          operation: 'findNodes',
          label,
          properties
        }
      );

      throw error;
    }
  }

  async findRelationships(type?: string, properties?: Record<string, any>): Promise<any[]> {
    if (!this.initialized) {
      throw new Error('Nebula service is not initialized');
    }

    try {
      const relationships = await this.connectionManager.findRelationships(type, properties);
      return relationships;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to find relationships: ${errorMessage}`),
        {
          component: 'NebulaService',
          operation: 'findRelationships',
          type,
          properties
        }
      );

      throw error;
    }
  }

  async getDatabaseStats(): Promise<any> {
    if (!this.initialized) {
      throw new Error('Nebula service is not initialized');
    }

    try {
      const stats = await this.connectionManager.getDatabaseStats();
      return stats;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to get database stats: ${errorMessage}`),
        {
          component: 'NebulaService',
          operation: 'getDatabaseStats'
        }
      );

      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.connectionManager.disconnect();
      this.initialized = false;
      this.logger.info('Nebula service closed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.errorHandler.handleError(
        new Error(`Failed to close Nebula service: ${errorMessage}`),
        { component: 'NebulaService', operation: 'close' }
      );
    }
  }
}