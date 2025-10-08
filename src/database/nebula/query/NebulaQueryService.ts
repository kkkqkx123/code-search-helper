import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { DatabaseLoggerService } from '../../common/DatabaseLoggerService';
import { DatabaseEventType } from '../../common/DatabaseEventTypes';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { NebulaQueryResult, NebulaConfig } from '../NebulaTypes';
import { PerformanceMonitor } from '../../common/PerformanceMonitor';
import { NebulaConfigService } from '../../../config/service/NebulaConfigService';
import { createClient } from '@nebula-contrib/nebula-nodejs';
import { NebulaQueryUtils } from './NebulaQueryUtils';

export interface INebulaQueryService {
  executeQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult>;
  executeParameterizedQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult>;
  prepareQuery(nGQL: string, parameters?: Record<string, any>): string;
  formatResults(result: any, executionTime: number): NebulaQueryResult;
  validateQuery(nGQL: string): boolean;
  executeBatch(queries: Array<{ query: string; params?: Record<string, any> }>): Promise<NebulaQueryResult[]>;
}

@injectable()
export class NebulaQueryService implements INebulaQueryService {
  private databaseLogger: DatabaseLoggerService;
  private errorHandler: ErrorHandlerService;
  private performanceMonitor: PerformanceMonitor;
  private configService: NebulaConfigService;
  private client: any; // Nebula客户端实例

  constructor(
    @inject(TYPES.DatabaseLoggerService) databaseLogger: DatabaseLoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: PerformanceMonitor,
    @inject(TYPES.NebulaConfigService) configService: NebulaConfigService
  ) {
    this.databaseLogger = databaseLogger;
    this.errorHandler = errorHandler;
    this.performanceMonitor = performanceMonitor;
    this.configService = configService;
  }

  /**
   * 获取Nebula客户端实例
   */
  private async getClient(): Promise<any> {
    if (!this.client) {
      const config: NebulaConfig = this.configService.loadConfig();
      const clientConfig: any = {
        servers: [`${config.host}:${config.port}`],
        userName: config.username,
        password: config.password,
        poolSize: config.maxConnections || 10,
        bufferSize: config.bufferSize || 10,
        executeTimeout: config.timeout || 30000,
        pingInterval: config.pingInterval || 3000
      };

      const validSpace = (config.space && config.space !== 'undefined' && config.space !== '') ? config.space : undefined;
      if (validSpace) {
        clientConfig.space = validSpace;
      }

      this.client = createClient(clientConfig);
    }

    return this.client;
  }

  async executeQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult> {
    const startTime = Date.now();

    try {
      // 使用 DatabaseLoggerService 记录查询执行事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Executing Nebula query',
          query: nGQL.substring(0, 100) + (nGQL.length > 100 ? '...' : ''),
          hasParameters: !!parameters && Object.keys(parameters).length > 0
        }
      });

      const client = await this.getClient();
      const finalQuery = parameters ? NebulaQueryUtils.interpolateParameters(nGQL, parameters) : nGQL;
      const result = await client.execute(finalQuery);
      const executionTime = Date.now() - startTime;

      // 转换结果格式
      const nebulaResult = {
        table: result?.table || {},
        results: result?.results || [],
        rows: result?.rows || [],
        data: result?.data || [],
        executionTime,
        timeCost: result?.timeCost || 0,
        error: result?.error || undefined
      };

      // 记录性能指标
      this.performanceMonitor.recordOperation('executeQuery', executionTime, {
        queryLength: nGQL.length,
        hasParameters: !!parameters
      });

      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Query executed successfully',
          executionTime,
          hasData: !!(nebulaResult.data && nebulaResult.data.length > 0),
          dataSize: nebulaResult.data?.length,
          hasError: !!nebulaResult.error,
          error: nebulaResult.error
        }
      });

      return nebulaResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const executionTime = Date.now() - startTime;

      // 使用 DatabaseLoggerService 记录查询执行失败事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Query execution failed',
          error: errorMessage,
          executionTime,
          query: nGQL.substring(0, 100) + (nGQL.length > 100 ? '...' : '')
        }
      });

      this.errorHandler.handleError(
        new Error(`Failed to execute Nebula query: ${errorMessage}`),
        {
          component: 'NebulaQueryService',
          operation: 'executeQuery',
          query: nGQL,
          parameters
        }
      );

      throw error;
    }
  }

  async executeParameterizedQuery(nGQL: string, parameters?: Record<string, any>): Promise<NebulaQueryResult> {
    const startTime = Date.now();

    try {
      // 准备查询语句
      const preparedQuery = this.prepareQuery(nGQL, parameters);

      // 使用 DatabaseLoggerService 记录参数化查询执行事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Executing parameterized query',
          originalQuery: nGQL,
          preparedQuery: preparedQuery.substring(0, 100) + (preparedQuery.length > 100 ? '...' : ''),
          hasParameters: !!parameters && Object.keys(parameters).length > 0
        }
      });

      const client = await this.getClient();
      const result = await client.execute(preparedQuery);
      const executionTime = Date.now() - startTime;

      // 转换结果格式
      const nebulaResult = {
        table: result?.table || {},
        results: result?.results || [],
        rows: result?.rows || [],
        data: result?.data || [],
        executionTime,
        timeCost: result?.timeCost || 0,
        error: result?.error || undefined
      };

      // 记录性能指标
      this.performanceMonitor.recordOperation('executeParameterizedQuery', executionTime, {
        queryLength: nGQL.length,
        hasParameters: !!parameters
      });

      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Parameterized query executed successfully',
          executionTime,
          hasData: !!(nebulaResult.data && nebulaResult.data.length > 0),
          dataSize: nebulaResult.data?.length,
          hasError: !!nebulaResult.error,
          error: nebulaResult.error
        }
      });

      return nebulaResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const executionTime = Date.now() - startTime;

      // 使用 DatabaseLoggerService 记录参数化查询执行失败事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Parameterized query execution failed',
          error: errorMessage,
          executionTime,
          originalQuery: nGQL.substring(0, 100) + (nGQL.length > 100 ? '...' : ''),
          hasParameters: !!parameters
        }
      });

      this.errorHandler.handleError(
        new Error(`Failed to execute parameterized Nebula query: ${errorMessage}`),
        {
          component: 'NebulaQueryService',
          operation: 'executeParameterizedQuery',
          query: nGQL,
          parameters
        }
      );

      throw error;
    }
  }

  prepareQuery(nGQL: string, parameters?: Record<string, any>): string {
    if (!parameters || Object.keys(parameters).length === 0) {
      return nGQL;
    }

    // 简单的参数插值，实际实现可能需要更复杂的参数处理
    let preparedQuery = nGQL;
    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = new RegExp(`\\$${key}`, 'g');
      const escapedValue = typeof value === 'string' ? `"${value}"` : String(value);
      preparedQuery = preparedQuery.replace(placeholder, escapedValue);
    }

    return preparedQuery;
  }

  formatResults(result: any, executionTime: number): NebulaQueryResult {
    return {
      table: result?.table || {},
      results: result?.results || [],
      rows: result?.rows || [],
      data: result?.data || [],
      executionTime,
      timeCost: result?.timeCost || 0,
      space: result?.space,
      error: result?.error || undefined
    };
  }

  validateQuery(nGQL: string): boolean {
    if (!nGQL || typeof nGQL !== 'string' || nGQL.trim() === '') {
      return false;
    }

    // 简单的查询验证
    const trimmedQuery = nGQL.trim();
    const uppercaseQuery = trimmedQuery.toUpperCase();

    // 检查是否是不允许的查询类型（如DROP SPACE等）
    if (uppercaseQuery.startsWith('DROP SPACE') ||
      uppercaseQuery.startsWith('CREATE SPACE') ||
      uppercaseQuery.startsWith('USE ') && trimmedQuery.includes('undefined')) {
      return false;
    }

    return true;
  }

  async executeBatch(queries: Array<{ query: string; params?: Record<string, any> }>): Promise<NebulaQueryResult[]> {
    const startTime = Date.now();

    try {
      // 使用 DatabaseLoggerService 记录批量查询执行事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Executing batch queries',
          queryCount: queries.length
        }
      });

      const results: NebulaQueryResult[] = [];
      for (const { query, params } of queries) {
        const result = await this.executeQuery(query, params);
        results.push(result);
      }

      const executionTime = Date.now() - startTime;

      // 记录性能指标
      this.performanceMonitor.recordOperation('executeBatch', executionTime, {
        queryCount: queries.length
      });

      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.QUERY_EXECUTED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Batch queries executed successfully',
          executionTime,
          resultCount: results.length
        }
      });

      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const executionTime = Date.now() - startTime;

      // 使用 DatabaseLoggerService 记录批量查询执行失败事件
      await this.databaseLogger.logDatabaseEvent({
        type: DatabaseEventType.ERROR_OCCURRED,
        source: 'nebula',
        timestamp: new Date(),
        data: {
          message: 'Batch query execution failed',
          error: errorMessage,
          executionTime,
          queryCount: queries.length
        }
      });

      this.errorHandler.handleError(
        new Error(`Failed to execute batch Nebula queries: ${errorMessage}`),
        {
          component: 'NebulaQueryService',
          operation: 'executeBatch',
          queries
        }
      );

      throw error;
    }
  }
}