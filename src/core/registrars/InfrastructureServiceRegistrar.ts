import { Container } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';

// 图服务基础设施
import { GraphCacheService } from '../../infrastructure/caching/GraphCacheService';
import { GraphPerformanceMonitor } from '../../service/graph/performance/GraphPerformanceMonitor';
import { GraphQueryValidator } from '../../service/graph/query/GraphQueryValidator';

// 高级映射服务
import { AdvancedMappingService as SemanticRelationshipExtractor } from '../../service/graph/mapping/SemanticRelationshipExtractor';

// 性能监控服务
import { PerformanceDashboard } from '../../service/monitoring/PerformanceDashboard';
import { PerformanceMetricsCollector } from '../../service/monitoring/PerformanceMetricsCollector';
import { TransactionLogger } from '../../service/transaction/TransactionLogger';
import { AutoOptimizationAdvisor } from '../../service/optimization/AutoOptimizationAdvisor';
import { BatchProcessingOptimizer } from '../../service/optimization/BatchProcessingOptimizer';
import { GraphBatchOptimizer } from '../../service/graph/utils/GraphBatchOptimizer';
import { GraphMappingCache } from '../../service/graph/caching/GraphMappingCache';
import { MappingCacheManager } from '../../service/graph/caching/MappingCacheManager';
import { GraphCacheConfigService } from '../../config/service/GraphCacheConfigService';

// 基础设施配置服务
import { InfrastructureConfigService } from '../../infrastructure/config/InfrastructureConfigService';
import { GraphConfigService } from '../../config/service/GraphConfigService';

// 向量批处理优化器
import { VectorBatchOptimizer } from '../../infrastructure/batching/VectorBatchOptimizer';

// 异步任务队列和冲突解决服务
import { AsyncTaskQueue } from '../../infrastructure/batching/AsyncTaskQueue';
import { ConflictResolver } from '../../infrastructure/transaction/ConflictResolver';

// SQLite基础设施
import { SqliteInfrastructure } from '../../database/splite/SqliteInfrastructure';
import { SqliteStateManager } from '../../database/splite/SqliteStateManager';

// 数据库迁移管理
import { MigrationManager } from '../../database/splite/migrations/MigrationManager';
import { DatabaseMigrationRunner } from '../../database/splite/migrations/DatabaseMigrationRunner';

// Cleanup基础设施服务
import { CleanupManager } from '../../infrastructure/cleanup/CleanupManager';

// 基础设施服务
import { CacheService } from '../../infrastructure/caching/CacheService';
import { PerformanceMonitor } from '../../infrastructure/monitoring/PerformanceMonitor';
import { BatchOptimizer } from '../../infrastructure/batching/BatchOptimizer';
import { DatabaseHealthChecker } from '../../infrastructure/monitoring/DatabaseHealthChecker';
import { DatabaseConnectionPool } from '../../infrastructure/connection/DatabaseConnectionPool';
import { TransactionCoordinator } from '../../infrastructure/transaction/TransactionCoordinator';
import { TreeSitterCacheCleanupStrategy } from '../../infrastructure/cleanup/strategies/TreeSitterCacheCleanupStrategy';
import { LRUCacheCleanupStrategy } from '../../infrastructure/cleanup/strategies/LRUCacheCleanupStrategy';
import { GarbageCollectionStrategy } from '../../infrastructure/cleanup/strategies/GarbageCollectionStrategy';
import { FaultToleranceHandler } from '../../utils/FaultToleranceHandler';
import { InfrastructureErrorHandler } from '../../infrastructure/error/InfrastructureErrorHandler';

// 基础设施管理器
import { InfrastructureManager } from '../../infrastructure/InfrastructureManager';

export class InfrastructureServiceRegistrar {
  static register(container: Container): void {
    try {
      // 基础设施服务
      container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
      container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
      container.bind<FaultToleranceHandler>(TYPES.FaultToleranceHandler).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const transactionLogger = context.get<TransactionLogger>(TYPES.TransactionLogger);
        const cache = context.get<GraphMappingCache>(TYPES.GraphMappingCache);
        const graphConfigService = context.get<GraphConfigService>(TYPES.GraphConfigService);

        const options = graphConfigService.getFaultToleranceOptions();

        return new FaultToleranceHandler(
          logger,
          transactionLogger,
          cache,
          options
        );
      }).inSingletonScope();

      // 基础设施错误处理器
      container.bind<InfrastructureErrorHandler>(TYPES.InfrastructureErrorHandler).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const performanceMonitor = context.get<PerformanceMonitor>(TYPES.PerformanceMonitor);

        // 创建一个简单的警报管理器实现
        const alertManager = {
          sendAlert: jest.fn() // 在实际环境中应该实现真实的警报管理器
        };

        return new InfrastructureErrorHandler(
          logger,
          alertManager as any,
          performanceMonitor
        );
      }).inSingletonScope();

      // 图服务基础设施
      container.bind<GraphCacheService>(TYPES.GraphCacheService).to(GraphCacheService).inSingletonScope();
      container.bind<GraphPerformanceMonitor>(TYPES.GraphPerformanceMonitor).to(GraphPerformanceMonitor).inSingletonScope();
      container.bind<GraphQueryValidator>(TYPES.GraphQueryValidator).to(GraphQueryValidator).inSingletonScope();
      container.bind<MappingCacheManager>(TYPES.MappingCacheManager).to(MappingCacheManager).inSingletonScope();

      // 绑定CacheConfig，从GraphCacheConfigService获取配置
      container.bind<any>(TYPES.CacheConfig).toDynamicValue(context => {
        const graphCacheConfigService = context.get<GraphCacheConfigService>(TYPES.GraphCacheConfigService);
        return graphCacheConfigService.getConfig();
      }).inSingletonScope();

      // 高级映射服务
      container.bind<SemanticRelationshipExtractor>(TYPES.AdvancedMappingService).to(SemanticRelationshipExtractor).inSingletonScope();
      container.bind<GraphMappingCache>(TYPES.GraphMappingCache).to(GraphMappingCache).inSingletonScope();

      // 性能监控和优化服务
      console.log('Binding PerformanceDashboard...');
      container.bind<PerformanceDashboard>(TYPES.PerformanceDashboard).to(PerformanceDashboard).inSingletonScope();
      console.log('PerformanceDashboard bound');

      console.log('Binding TransactionLogger...');
      container.bind<TransactionLogger>(TYPES.TransactionLogger).to(TransactionLogger).inSingletonScope();
      console.log('TransactionLogger bound');

      console.log('Attempting to bind PerformanceMetricsCollector...');
      try {
        // Disable auto-collection in test environment to prevent open handles
        const isTestEnvironment = process.env.NODE_ENV === 'test';
        const options = isTestEnvironment ? { enableAutoCollection: false } : {};

        container.bind<PerformanceMetricsCollector>(TYPES.PerformanceMetricsCollector).toConstantValue(
          new PerformanceMetricsCollector(
            container.get<LoggerService>(TYPES.LoggerService),
            container.get<PerformanceDashboard>(TYPES.PerformanceDashboard),
            container.get<TransactionLogger>(TYPES.TransactionLogger),
            container.get<GraphMappingCache>(TYPES.GraphMappingCache),
            options
          )
        );
        console.log('PerformanceMetricsCollector bound');
      } catch (error: any) {
        console.error('Error binding PerformanceMetricsCollector:', error);
        console.error('Error stack:', error?.stack);
        throw error;
      }

      console.log('Attempting to bind GraphBatchOptimizer...');
      try {
        container.bind<GraphBatchOptimizer>(TYPES.GraphBatchOptimizer).toConstantValue(
          new GraphBatchOptimizer(
            container.get<LoggerService>(TYPES.LoggerService),
            {} // 默认选项
          )
        );
        console.log('GraphBatchOptimizer bound');
      } catch (error: any) {
        console.error('Error binding GraphBatchOptimizer:', error);
        console.error('Error stack:', error?.stack);
        throw error;
      }

      console.log('Attempting to bind AutoOptimizationAdvisor...');
      try {
        container.bind<AutoOptimizationAdvisor>(TYPES.AutoOptimizationAdvisor).toConstantValue(
          new AutoOptimizationAdvisor(
            container.get<LoggerService>(TYPES.LoggerService),
            container.get<PerformanceDashboard>(TYPES.PerformanceDashboard),
            container.get<PerformanceMetricsCollector>(TYPES.PerformanceMetricsCollector),
            container.get<GraphBatchOptimizer>(TYPES.GraphBatchOptimizer),
            container.get<GraphMappingCache>(TYPES.GraphMappingCache),
            {} // 默认选项
          )
        );
        console.log('AutoOptimizationAdvisor bound');
      } catch (error: any) {
        console.error('Error binding AutoOptimizationAdvisor:', error);
        console.error('Error stack:', error?.stack);
        throw error;
      }
      // container.bind<BatchProcessingOptimizer>(TYPES.BatchProcessingOptimizer).to(BatchProcessingOptimizer).inSingletonScope();

      // 基础设施配置服务
      container.bind<InfrastructureConfigService>(TYPES.InfrastructureConfigService)
        .to(InfrastructureConfigService).inSingletonScope();
      container.bind<GraphConfigService>(TYPES.GraphConfigService)
        .to(GraphConfigService).inSingletonScope();

      // 向量批处理优化器
      container.bind<VectorBatchOptimizer>(TYPES.VectorBatchOptimizer)
        .to(VectorBatchOptimizer).inSingletonScope();

      // 注册 AsyncTaskQueue
      console.log('Binding AsyncTaskQueue...');
      container.bind<AsyncTaskQueue>(TYPES.AsyncTaskQueue)
        .toDynamicValue(context => {
          const logger = context.get<LoggerService>(TYPES.LoggerService);

          return new AsyncTaskQueue(
            logger,
            {
              maxConcurrency: 5,
              defaultMaxRetries: 3,
              defaultTimeout: 30000,
              autoStart: true
            }
          );
        }).inSingletonScope();

      // 注册 ConflictResolver
      console.log('Binding ConflictResolver...');
      container.bind<ConflictResolver>(TYPES.ConflictResolver)
        .toDynamicValue(context => {
          const logger = context.get<LoggerService>(TYPES.LoggerService);

          return new ConflictResolver(logger);
        }).inSingletonScope();

      // CleanupManager - 注册为基础设施服务
      container.bind<CleanupManager>(TYPES.CleanupManager).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const cleanupManager = new CleanupManager(logger);

        // 初始化CleanupManager
        cleanupManager.initialize();

        // 注册清理策略
        cleanupManager.registerStrategy(new TreeSitterCacheCleanupStrategy(logger));
        cleanupManager.registerStrategy(new LRUCacheCleanupStrategy(logger));
        cleanupManager.registerStrategy(new GarbageCollectionStrategy(logger));

        return cleanupManager;
      }).inSingletonScope();

      // 基础设施核心服务（在CleanupManager外部注册，确保正确的依赖顺序）
      container.bind<CacheService>(TYPES.CacheService).to(CacheService).inSingletonScope();
      container.bind<PerformanceMonitor>(TYPES.PerformanceMonitor).to(PerformanceMonitor).inSingletonScope();
      container.bind<BatchOptimizer>(TYPES.BatchOptimizer).to(BatchOptimizer).inSingletonScope();
      container.bind<DatabaseHealthChecker>(TYPES.HealthChecker).to(DatabaseHealthChecker).inSingletonScope();
      container.bind<DatabaseConnectionPool>(TYPES.DatabaseConnectionPool).to(DatabaseConnectionPool).inSingletonScope();
      container.bind<TransactionCoordinator>(TYPES.TransactionCoordinator).to(TransactionCoordinator).inSingletonScope();

      // 基础设施管理器 - 使用动态绑定确保正确的初始化顺序
      container.bind<InfrastructureManager>(TYPES.InfrastructureManager).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const cacheService = context.get<CacheService>(TYPES.CacheService);
        const performanceMonitor = context.get<PerformanceMonitor>(TYPES.PerformanceMonitor);
        const batchOptimizer = context.get<BatchOptimizer>(TYPES.BatchOptimizer);
        const transactionCoordinator = context.get<TransactionCoordinator>(TYPES.TransactionCoordinator);
        const databaseConnectionPool = context.get<DatabaseConnectionPool>(TYPES.DatabaseConnectionPool);
        const infrastructureConfigService = context.get<InfrastructureConfigService>(TYPES.InfrastructureConfigService);

        const infrastructureManager = new InfrastructureManager(
          logger,
          cacheService,
          performanceMonitor,
          batchOptimizer,
          transactionCoordinator,
          databaseConnectionPool,
          infrastructureConfigService
        );

        // 获取健康检查器并注册基础设施的健康检查器
        const healthChecker = context.get<DatabaseHealthChecker>(TYPES.HealthChecker);
        infrastructureManager.registerHealthCheckers(healthChecker);

        return infrastructureManager;
      }).inSingletonScope();

      // SQLite基础设施
      container.bind<SqliteInfrastructure>(TYPES.SqliteInfrastructure).to(SqliteInfrastructure).inSingletonScope();
      container.bind<SqliteStateManager>(TYPES.SqliteStateManager).to(SqliteStateManager).inSingletonScope();

      // 数据库迁移管理
      container.bind<MigrationManager>(TYPES.MigrationManager).to(MigrationManager).inSingletonScope();
      container.bind<DatabaseMigrationRunner>(TYPES.DatabaseMigrationRunner).to(DatabaseMigrationRunner).inSingletonScope();
    } catch (error: any) {
      console.error('Error registering infrastructure services:', error);
      console.error('Error stack:', error?.stack);
      throw error;
    }
  }
}