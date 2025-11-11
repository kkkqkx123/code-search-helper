import { Container } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';

// 图服务基础设施
import { GraphCacheService } from '../../service/caching/GraphCacheService';
import { GraphPerformanceMonitor } from '../../service/graph/performance/GraphPerformanceMonitor';
import { GraphQueryValidator } from '../../service/graph/query/GraphQueryValidator';

// 高级映射服务
import { AdvancedMappingService as SemanticRelationshipExtractor } from '../../service/graph/mapping/SemanticRelationshipExtractor';

// 性能监控服务
import { PerformanceDashboard } from '../../service/monitoring/PerformanceDashboard';
import { PerformanceMetricsCollector } from '../../service/monitoring/PerformanceMetricsCollector';
import { AutoOptimizationAdvisor } from '../../service/optimization/AutoOptimizationAdvisor';
import { BatchProcessingOptimizer } from '../../service/optimization/BatchProcessingOptimizer';
import { GraphMappingCache } from '../../service/graph/caching/GraphMappingCache';
import { MappingCacheManager } from '../../service/graph/caching/MappingCacheManager';
import { GraphCacheConfigService } from '../../config/service/GraphCacheConfigService';

// 基础设施配置服务
import { InfrastructureConfigService } from '../../infrastructure/config/InfrastructureConfigService';
import { GraphConfigService } from '../../config/service/GraphConfigService';

// 批处理服务
import { BatchProcessingService } from '../../infrastructure/batching/BatchProcessingService';
import { BatchStrategyFactory } from '../../infrastructure/batching/strategies/BatchStrategyFactory';
import { IMemoryMonitorService } from '../../service/memory/interfaces/IMemoryMonitorService';
import { SemanticBatchStrategy } from '../../infrastructure/batching/strategies/SemanticBatchStrategy';
import { QdrantBatchStrategy } from '../../infrastructure/batching/strategies/QdrantBatchStrategy';
import { NebulaBatchStrategy } from '../../infrastructure/batching/strategies/NebulaBatchStrategy';
import { GraphBatchStrategy } from '../../infrastructure/batching/strategies/GraphBatchStrategy';
import { EmbeddingBatchStrategy } from '../../infrastructure/batching/strategies/EmbeddingBatchStrategy';
import { ConfigService } from '../../config/ConfigService';

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
import { DatabaseHealthChecker } from '../../service/monitoring/DatabaseHealthChecker';
import { TreeSitterCacheCleanupStrategy } from '../../infrastructure/cleanup/strategies/TreeSitterCacheCleanupStrategy';
import { LRUCacheCleanupStrategy } from '../../infrastructure/cleanup/strategies/LRUCacheCleanupStrategy';
import { GarbageCollectionStrategy } from '../../infrastructure/cleanup/strategies/GarbageCollectionStrategy';
import { FaultToleranceHandler } from '../../utils/FaultToleranceHandler';
import { DatabaseErrorHandler } from '../../database/error/DatabaseErrorHandler';

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
        const cache = context.get<GraphMappingCache>(TYPES.GraphMappingCache);
        const graphConfigService = context.get<GraphConfigService>(TYPES.GraphConfigService);

        const options = graphConfigService.getFaultToleranceOptions();

        return new FaultToleranceHandler(
          logger,
          cache,
          options
        );
      }).inSingletonScope();

      // 基础设施错误处理器
      container.bind<DatabaseErrorHandler>(TYPES.InfrastructureErrorHandler).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const performanceMonitor = context.get<PerformanceMonitor>(TYPES.PerformanceMonitor);

        // 创建一个简单的警报管理器实现
        const alertManager = {
          sendAlert: jest.fn() // 在实际环境中应该实现真实的警报管理器
        };

        return new DatabaseErrorHandler(
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

      console.log('Attempting to bind PerformanceMetricsCollector...');
      try {
        // Disable auto-collection in test environment to prevent open handles
        const isTestEnvironment = process.env.NODE_ENV === 'test';
        const options = isTestEnvironment ? { enableAutoCollection: false } : {};
container.bind<PerformanceMetricsCollector>(TYPES.PerformanceMetricsCollector).toConstantValue(
  new PerformanceMetricsCollector(
    container.get<LoggerService>(TYPES.LoggerService),
    container.get<PerformanceDashboard>(TYPES.PerformanceDashboard),
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

      console.log('Attempting to bind BatchProcessingService...');
      try {
        container.bind<BatchProcessingService>(TYPES.BatchProcessingService).toConstantValue(
          new BatchProcessingService(
            container.get<LoggerService>(TYPES.LoggerService),
            container.get<ErrorHandlerService>(TYPES.ErrorHandlerService),
            container.get<ConfigService>(TYPES.ConfigService),
            container.get<IMemoryMonitorService>(TYPES.MemoryMonitorService),
            container.get<BatchStrategyFactory>(TYPES.BatchStrategyFactory),
            container.get<SemanticBatchStrategy>(TYPES.SemanticBatchStrategy)
          )
        );
        console.log('BatchProcessingService bound');
      } catch (error: any) {
        console.error('Error binding BatchProcessingService:', error);
        console.error('Error stack:', error?.stack);
        throw error;
      }

      console.log('Attempting to bind BatchStrategyFactory...');
      try {
        container.bind<BatchStrategyFactory>(TYPES.BatchStrategyFactory).toConstantValue(
          new BatchStrategyFactory(
            container.get<LoggerService>(TYPES.LoggerService),
            container.get<SemanticBatchStrategy>(TYPES.SemanticBatchStrategy),
            container.get<QdrantBatchStrategy>(TYPES.QdrantBatchStrategy),
            container.get<NebulaBatchStrategy>(TYPES.NebulaBatchStrategy),
            container.get<GraphBatchStrategy>(TYPES.GraphBatchStrategy),
            container.get<EmbeddingBatchStrategy>(TYPES.EmbeddingBatchStrategy)
          )
        );
        console.log('BatchStrategyFactory bound');
      } catch (error: any) {
        console.error('Error binding BatchStrategyFactory:', error);
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
            container.get<BatchProcessingService>(TYPES.BatchProcessingService),
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

      // 基础设施配置服务
      container.bind<InfrastructureConfigService>(TYPES.InfrastructureConfigService)
        .to(InfrastructureConfigService).inSingletonScope();
      container.bind<GraphConfigService>(TYPES.GraphConfigService)
        .to(GraphConfigService).inSingletonScope();

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
      container.bind<DatabaseHealthChecker>(TYPES.HealthChecker).to(DatabaseHealthChecker).inSingletonScope();

      // 基础设施管理器 - 使用动态绑定确保正确的初始化顺序
      container.bind<InfrastructureManager>(TYPES.InfrastructureManager).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const cacheService = context.get<CacheService>(TYPES.CacheService);
        const performanceMonitor = context.get<PerformanceMonitor>(TYPES.PerformanceMonitor);
        const batchProcessingService = context.get<BatchProcessingService>(TYPES.BatchProcessingService);
        const infrastructureConfigService = context.get<InfrastructureConfigService>(TYPES.InfrastructureConfigService);

        const infrastructureManager = new InfrastructureManager(
          logger,
          cacheService,
          performanceMonitor,
          batchProcessingService,
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