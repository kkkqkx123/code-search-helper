import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { DatabaseType } from '../types';
import { IDatabaseInfrastructure } from '../InfrastructureManager';
import { ICacheService } from '../caching/types';
import { IPerformanceMonitor } from '../monitoring/types';
import { IBatchOptimizer } from '../batching/types';
import { IHealthChecker } from '../monitoring/types';
import { DatabaseConnectionPool } from '../connection/DatabaseConnectionPool';
import { CacheService } from '../caching/CacheService';
import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';
import { BatchOptimizer } from '../batching/BatchOptimizer';
import { DatabaseHealthChecker } from '../monitoring/DatabaseHealthChecker';

@injectable()
export class QdrantInfrastructure implements IDatabaseInfrastructure {
  readonly databaseType = DatabaseType.QDRANT;
  
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
    
    this.logger.info('Qdrant infrastructure created');
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
      this.logger.warn('Qdrant infrastructure already initialized');
      return;
    }

    this.logger.info('Initializing Qdrant infrastructure');

    try {
      // 启动性能监控
      this.performanceMonitor.startPeriodicMonitoring(30000);
      
      // 验证连接池
      const testConnection = await this.connectionManager.getConnection(this.databaseType);
      await this.connectionManager.releaseConnection(testConnection);
      
      // 执行健康检查
      await this.healthChecker.checkHealth();
      
      this.initialized = true;
      this.logger.info('Qdrant infrastructure initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Qdrant infrastructure', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      this.logger.warn('Qdrant infrastructure not initialized, nothing to shutdown');
      return;
    }

    this.logger.info('Shutting down Qdrant infrastructure');

    try {
      // 停止性能监控
      this.performanceMonitor.stopPeriodicMonitoring();
      
      // 清理缓存
      this.cacheService.clearAllCache();
      
      // 重置性能指标
      this.performanceMonitor.resetMetrics();
      
      this.initialized = false;
      this.logger.info('Qdrant infrastructure shutdown completed');
    } catch (error) {
      this.logger.error('Error during Qdrant infrastructure shutdown', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Qdrant infrastructure is not initialized. Call initialize() first.');
    }
  }

  // Qdrant特定的辅助方法
  async cacheVectorData(collectionName: string, data: any): Promise<void> {
    const key = `qdrant:vector:${collectionName}`;
    await (this.cacheService as CacheService).cacheVectorData(collectionName, data);
    this.logger.debug('Cached vector data', { collectionName });
  }

  async getVectorData(collectionName: string): Promise<any | null> {
    const data = await (this.cacheService as CacheService).getVectorData(collectionName);
    this.logger.debug('Retrieved vector data', { collectionName, found: !!data });
    return data;
  }

  async recordVectorOperation(
    operation: 'insert' | 'search' | 'update' | 'delete',
    collectionName: string,
    vectorCount: number,
    dimension: number,
    duration: number,
    success: boolean
  ): Promise<void> {
    await this.performanceMonitor.recordVectorOperation(
      operation,
      collectionName,
      vectorCount,
      dimension,
      duration,
      success
    );
    this.logger.debug('Recorded vector operation', {
      operation,
      collectionName,
      vectorCount,
      duration,
      success
    });
  }

  async executeVectorBatch<T>(
    items: T[],
    operation: (batch: T[]) => Promise<any>,
    options?: { batchSize?: number; concurrency?: number }
  ): Promise<any[]> {
    this.logger.debug('Executing vector batch operation', {
      itemCount: items.length,
      options
    });

    const startTime = Date.now();
    const results = await this.batchOptimizer.executeWithOptimalBatching(
      items,
      operation,
      options
    );
    const duration = Date.now() - startTime;

    // 记录批处理性能
    await this.recordVectorOperation(
      'insert', // 假设是插入操作，实际应该从参数获取
      'batch',
      items.length,
      0, // 向量维度在实际应用中应该从数据获取
      duration,
      true
    );

    return results;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}