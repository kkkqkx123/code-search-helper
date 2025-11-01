import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../../infrastructure/types';
import { IDatabaseInfrastructure } from '../../infrastructure/InfrastructureManager';
import { ICacheService } from '../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../infrastructure/monitoring/types';
import { IBatchOptimizer } from '../../infrastructure/batching/types';
import { IHealthChecker } from '../../infrastructure/monitoring/types';
import { DatabaseConnectionPool } from '../../infrastructure/connection/DatabaseConnectionPool';
import { CacheService } from '../../infrastructure/caching/CacheService';
import { PerformanceMonitor } from '../../infrastructure/monitoring/PerformanceMonitor';
import { BatchOptimizer } from '../../service/optimization/BatchOptimizerService';
import { DatabaseHealthChecker } from '../../service/monitoring/DatabaseHealthChecker';
import { GraphOperation, BatchResult } from '../../infrastructure/batching/types';

@injectable()
export class NebulaInfrastructure implements IDatabaseInfrastructure {
  readonly databaseType = DatabaseType.NEBULA;

  private logger: LoggerService;
  private cacheService: ICacheService;
  private performanceMonitor: IPerformanceMonitor;
  private batchOptimizer: IBatchOptimizer;
  private healthChecker: IHealthChecker;
  private connectionManager: DatabaseConnectionPool;
  private initialized = false;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.CacheService) cacheService: CacheService,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: IPerformanceMonitor,
    @inject(TYPES.BatchOptimizer) batchOptimizer: BatchOptimizer,
    @inject(TYPES.HealthChecker) healthChecker: DatabaseHealthChecker,
    @inject(TYPES.DatabaseConnectionPool) connectionManager: DatabaseConnectionPool
  ) {
    this.logger = logger;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
    this.batchOptimizer = batchOptimizer;
    this.healthChecker = healthChecker;
    this.connectionManager = connectionManager;

    this.logger.info('Nebula infrastructure created');
  }

  getCacheService(): ICacheService {
    this.ensureInitialized();
    return this.cacheService;
  }

  getPerformanceMonitor(): IPerformanceMonitor {
    this.ensureInitialized();
    return this.performanceMonitor;
  }

  getBatchOptimizer(): IBatchOptimizer {
    this.ensureInitialized();
    return this.batchOptimizer;
  }

  getHealthChecker(): IHealthChecker {
    this.ensureInitialized();
    return this.healthChecker;
  }

  getConnectionManager(): DatabaseConnectionPool {
    this.ensureInitialized();
    return this.connectionManager;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Nebula infrastructure already initialized');
      return;
    }

    this.logger.info('Initializing Nebula infrastructure');

    try {
      // 启动性能监控
      this.performanceMonitor.startPeriodicMonitoring(30000);

      // 验证连接池
      const testConnection = await this.connectionManager.getConnection(this.databaseType);
      await this.connectionManager.releaseConnection(testConnection);

      // 执行健康检查
      await this.healthChecker.checkHealth();

      this.initialized = true;
      this.logger.info('Nebula infrastructure initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Nebula infrastructure', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      this.logger.warn('Nebula infrastructure not initialized, nothing to shutdown');
      return;
    }

    this.logger.info('Shutting down Nebula infrastructure');

    try {
      // 停止性能监控
      this.performanceMonitor.stopPeriodicMonitoring();

      // 清理缓存
      this.cacheService.clearAllCache();

      // 重置性能指标
      this.performanceMonitor.resetMetrics();

      this.initialized = false;
      this.logger.info('Nebula infrastructure shutdown completed');
    } catch (error) {
      this.logger.error('Error during Nebula infrastructure shutdown', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Nebula infrastructure is not initialized. Call initialize() first.');
    }
  }

  // Nebula特定的辅助方法
  async cacheGraphData(spaceName: string, data: any): Promise<void> {
    await (this.cacheService as CacheService).cacheNebulaGraphData(spaceName, data);
    this.logger.debug('Cached graph data', { spaceName });
  }

  async getGraphData(spaceName: string): Promise<any | null> {
    const data = await (this.cacheService as CacheService).getNebulaGraphData(spaceName);
    this.logger.debug('Retrieved graph data', { spaceName, found: !!data });
    return data;
  }

  async recordGraphOperation(
    operation: string,
    spaceName: string,
    duration: number,
    success: boolean
  ): Promise<void> {
    await this.performanceMonitor.recordNebulaOperation(
      operation,
      spaceName,
      duration,
      success
    );
    this.logger.debug('Recorded graph operation', {
      operation,
      spaceName,
      duration,
      success
    });
  }

  async executeGraphBatch(
    operations: GraphOperation[]
  ): Promise<BatchResult> {
    this.logger.debug('Executing graph batch operation', {
      operationCount: operations.length
    });

    const startTime = Date.now();
    const result = await (this.batchOptimizer as BatchOptimizer).executeGraphBatchOptimization(
      operations,
      this.databaseType
    );
    const duration = Date.now() - startTime;

    // 记录批处理性能
    await this.recordGraphOperation(
      'batch_execute',
      'unknown_space', // 实际应用中应该从操作中获取
      duration,
      result.successfulOperations === result.totalOperations
    );

    return result;
  }

  async executeGraphQuery(
    query: string,
    parameters?: any,
    spaceName?: string
  ): Promise<any> {
    this.ensureInitialized();

    const startTime = Date.now();
    let success = false;
    let result: any = null;

    try {
      // 获取连接
      const connection = await this.connectionManager.getConnection(this.databaseType);

      try {
        // 在实际实现中，这里会执行真正的图查询
        // 目前为模拟实现
        this.logger.debug('Executing graph query', { query, parameters, spaceName });

        // 模拟查询执行
        result = {
          success: true,
          data: [], // 实际查询结果
          executionTime: Date.now() - startTime
        };

        success = true;
      } finally {
        // 释放连接
        await this.connectionManager.releaseConnection(connection);
      }
    } catch (error) {
      this.logger.error('Graph query execution failed', {
        query,
        error: (error as Error).message
      });
      throw error;
    } finally {
      // 记录操作性能
      const duration = Date.now() - startTime;
      await this.recordGraphOperation(
        'query',
        spaceName || 'default_space',
        duration,
        success
      );
    }

    return result;
  }

  async createSpace(
    spaceName: string,
    options?: {
      partitionNum?: number;
      replicaFactor?: number;
      vidType?: string;
    }
  ): Promise<void> {
    this.ensureInitialized();

    this.logger.info('Creating Nebula space', { spaceName, options });

    const startTime = Date.now();
    let success = false;

    try {
      // 获取连接
      const connection = await this.connectionManager.getConnection(this.databaseType);

      try {
        // 在实际实现中，这里会执行真正的创建空间操作
        // 目前为模拟实现
        this.logger.debug('Creating space with connection', { spaceName });

        // 模拟创建空间
        success = true;
      } finally {
        // 释放连接
        await this.connectionManager.releaseConnection(connection);
      }
    } catch (error) {
      this.logger.error('Space creation failed', {
        spaceName,
        error: (error as Error).message
      });
      throw error;
    } finally {
      // 记录操作性能
      const duration = Date.now() - startTime;
      await this.recordGraphOperation(
        'create_space',
        spaceName,
        duration,
        success
      );
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}