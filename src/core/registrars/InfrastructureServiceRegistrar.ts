import { Container } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../embedders/EmbeddingCacheService';

// 图服务基础设施
import { GraphCacheService } from '../../service/caching/GraphCacheService';
import { GraphPerformanceMonitor } from '../../service/graph/performance/GraphPerformanceMonitor';
import { GraphQueryValidator } from '../../service/graph/query/GraphQueryValidator';

// 性能监控服务
import { PerformanceDashboard } from '../../service/monitoring/PerformanceDashboard';
import { PerformanceMetricsCollector } from '../../service/monitoring/PerformanceMetricsCollector';
import { DatabasePerformanceMonitor } from '../../service/monitoring/DatabasePerformanceMonitor';
import { VectorPerformanceMonitor } from '../../service/monitoring/VectorPerformanceMonitor';
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
import { FaultToleranceHandler, FaultToleranceOptions } from '../../utils/FaultToleranceHandler';
import { DatabaseErrorHandler } from '../../database/error/DatabaseErrorHandler';

// 基础设施管理器
import { InfrastructureManager } from '../../infrastructure/InfrastructureManager';

export class InfrastructureServiceRegistrar {
  static registerBasicServices(container: Container): void {
    try {
      // 基础设施服务 - 不依赖ConfigService的服务
      container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
      container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();

      // 批处理策略 - 基础策略，不依赖ConfigService
      container.bind<SemanticBatchStrategy>(TYPES.SemanticBatchStrategy).to(SemanticBatchStrategy).inSingletonScope();
      container.bind<QdrantBatchStrategy>(TYPES.QdrantBatchStrategy).to(QdrantBatchStrategy).inSingletonScope();
      container.bind<NebulaBatchStrategy>(TYPES.NebulaBatchStrategy).to(NebulaBatchStrategy).inSingletonScope();
      container.bind<GraphBatchStrategy>(TYPES.GraphBatchStrategy).to(GraphBatchStrategy).inSingletonScope();
      container.bind<EmbeddingBatchStrategy>(TYPES.EmbeddingBatchStrategy).to(EmbeddingBatchStrategy).inSingletonScope();
      container.bind<BatchStrategyFactory>(TYPES.BatchStrategyFactory).to(BatchStrategyFactory).inSingletonScope();
      // 注意：GraphConfigService可能还没有注册，所以这里使用默认配置
      container.bind<FaultToleranceHandler>(TYPES.FaultToleranceHandler).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const cache = context.get<GraphMappingCache>(TYPES.GraphMappingCache);
        
        // 使用默认的容错配置选项
        const defaultOptions: Partial<FaultToleranceOptions> = {
          maxRetries: 3,
          retryDelay: 1000,
          exponentialBackoff: true,
          circuitBreakerEnabled: true,
          circuitBreakerFailureThreshold: 5,
          circuitBreakerTimeout: 3000,
          fallbackStrategy: 'cache'
        };

        return new FaultToleranceHandler(
          logger,
          cache,
          defaultOptions
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

      // 绑定CacheConfig，使用默认配置避免循环依赖
      container.bind<any>(TYPES.CacheConfig).toConstantValue({
        maxSize: 10000,
        defaultTTL: 300,
        maxMemory: 100 * 1024 * 1024,
        enableCompression: true,
        compressionThreshold: 1024,
        enableStats: true,
        compressionLevel: 6
      });

      // 图映射缓存服务
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
      // 专门的性能监控器
      container.bind<DatabasePerformanceMonitor>(TYPES.DatabasePerformanceMonitor).to(DatabasePerformanceMonitor).inSingletonScope();
      container.bind<VectorPerformanceMonitor>(TYPES.VectorPerformanceMonitor).to(VectorPerformanceMonitor).inSingletonScope();
      container.bind<DatabaseHealthChecker>(TYPES.HealthChecker).to(DatabaseHealthChecker).inSingletonScope();

      // SQLite基础设施
      container.bind<SqliteInfrastructure>(TYPES.SqliteInfrastructure).to(SqliteInfrastructure).inSingletonScope();
      container.bind<SqliteStateManager>(TYPES.SqliteStateManager).to(SqliteStateManager).inSingletonScope();

      // 数据库迁移管理
      container.bind<MigrationManager>(TYPES.MigrationManager).to(MigrationManager).inSingletonScope();
      container.bind<DatabaseMigrationRunner>(TYPES.DatabaseMigrationRunner).to(DatabaseMigrationRunner).inSingletonScope();
    } catch (error: any) {
      console.error('Error registering basic infrastructure services:', error);
      console.error('Error stack:', error?.stack);
      throw error;
    }
  }

  static registerAdvancedServices(container: Container): void {
    try {
      console.log('Attempting to bind BatchProcessingService...');
      try {
        // 修改为动态绑定，延迟初始化直到ConfigService可用
        container.bind<BatchProcessingService>(TYPES.BatchProcessingService).toDynamicValue(context => {
          console.log('Creating BatchProcessingService dynamically...');
          const logger = context.get<LoggerService>(TYPES.LoggerService);
          const errorHandler = context.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
          const configService = context.get<ConfigService>(TYPES.ConfigService);
          const memoryMonitorService = context.get<IMemoryMonitorService>(TYPES.MemoryMonitorService);
          const batchStrategyFactory = context.get<BatchStrategyFactory>(TYPES.BatchStrategyFactory);
          const semanticBatchStrategy = context.get<SemanticBatchStrategy>(TYPES.SemanticBatchStrategy);

          console.log('All dependencies retrieved, creating BatchProcessingService...');
          const batchProcessingService = new BatchProcessingService(
            logger,
            errorHandler,
            configService,
            memoryMonitorService,
            batchStrategyFactory,
            semanticBatchStrategy
          );
          
          console.log('BatchProcessingService created successfully');
          return batchProcessingService;
        }).inSingletonScope();
        console.log('BatchProcessingService bound');
      } catch (error: any) {
        console.error('Error binding BatchProcessingService:', error);
        console.error('Error stack:', error?.stack);
        throw error;
      }

      // 设置延迟注入的配置服务
      this.setupDelayedConfigInjection(container);

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
    } catch (error: any) {
      console.error('Error registering advanced infrastructure services:', error);
      console.error('Error stack:', error?.stack);
      throw error;
    }
  }

  /**
   * 设置延迟配置注入，解决循环依赖问题
   */
  static setupDelayedConfigInjection(container: Container): void {
    try {
      // 获取配置服务和需要延迟注入的服务
      const configService = container.get<ConfigService>(TYPES.ConfigService);
      
      // 设置 EmbedderFactory 的配置服务
      if (container.isBound(TYPES.EmbedderFactory)) {
        const embedderFactory = container.get<EmbedderFactory>(TYPES.EmbedderFactory);
        if (typeof embedderFactory.setConfigService === 'function') {
          embedderFactory.setConfigService(configService);
        }
      }
      
      // 设置 EmbeddingCacheService 的配置服务
      if (container.isBound(TYPES.EmbeddingCacheService)) {
        const embeddingCacheService = container.get<EmbeddingCacheService>(TYPES.EmbeddingCacheService);
        if (typeof embeddingCacheService.setConfigService === 'function') {
          embeddingCacheService.setConfigService(configService);
        }
      }
    } catch (error: any) {
      console.error('Error setting up delayed config injection:', error);
      console.error('Error stack:', error?.stack);
      throw error;
    }
  }

  // 保持向后兼容性的方法
  static register(container: Container): void {
    console.warn('InfrastructureServiceRegistrar.register() is deprecated. Use registerBasicServices() and registerAdvancedServices() instead.');
    this.registerBasicServices(container);
    // 注意：这里不调用registerAdvancedServices，因为ConfigService可能还没有注册
  }
}