import { Container } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { SimilarityServiceRegistrar } from './SimilarityServiceRegistrar';

// 文件系统服务
import { IgnoreRuleManager } from '../../service/ignore/IgnoreRuleManager';
import { FileSystemTraversal } from '../../service/filesystem/FileSystemTraversal';
import { FileWatcherService } from '../../service/filesystem/FileWatcherService';
import { ChangeDetectionService } from '../../service/filesystem/ChangeDetectionService';
import { HotReloadRecoveryService } from '../../service/filesystem/HotReloadRecoveryService';
import { ProjectHotReloadService } from '../../service/filesystem/ProjectHotReloadService';
import { HotReloadConfigService } from '../../service/filesystem/HotReloadConfigService';
import { HotReloadMonitoringService } from '../../service/filesystem/HotReloadMonitoringService';
import { HotReloadErrorPersistenceService } from '../../service/filesystem/HotReloadErrorPersistenceService';
import { HotReloadRestartService } from '../../service/filesystem/HotReloadRestartService';
import { FileHashManager, FileHashManagerImpl } from '../../service/filesystem/FileHashManager';

// 项目管理服务
import { ProjectStateManager } from '../../service/project/ProjectStateManager';
import { CoreStateService } from '../../service/project/services/CoreStateService';
import { StorageStateService } from '../../service/project/services/StorageStateService';

// 索引服务
import { VectorIndexService } from '../../service/index/VectorIndexService';
import { GraphIndexService } from '../../service/index/GraphIndexService';
import { HybridIndexService } from '../../service/index/HybridIndexService';

// 性能优化服务
import { PerformanceOptimizerService } from '../../service/optimization/PerformanceOptimizerService';

// 解析服务
import { TreeSitterService } from '../../service/parser/core/parse/TreeSitterService';
import { TreeSitterCoreService } from '../../service/parser/core/parse/TreeSitterCoreService';
import { TreeSitterQueryEngine } from '../../service/parser/core/query/TreeSitterQueryEngine';

import { ChunkToVectorCoordinationService } from '../../service/parser/ChunkToVectorCoordinationService';
import { QueryResultNormalizer } from '../../service/parser/core/normalization/QueryResultNormalizer';
import { SegmentationConfigService } from '../../config/service/SegmentationConfigService';

// 新的AST结构提取器相关服务
import { ASTStructureExtractor } from '../../service/parser/core/normalization/ASTStructureExtractor';
import { ASTStructureExtractorFactory } from '../../service/parser/core/normalization/ASTStructureExtractorFactory';
import { UnifiedContentAnalyzer } from '../../service/parser/core/normalization/ContentAnalyzer';
import { StructureTypeConverter } from '../../service/parser/core/normalization/utils/StructureTypeConverter';

// 通用文件处理服务
import { UniversalTextStrategy } from '../../service/parser/processing/strategies/implementations/UniversalTextStrategy';
import { ErrorThresholdInterceptor } from '../../service/parser/processing/utils/protection/ErrorThresholdInterceptor';
import { MemoryGuard } from '../../service/parser/guard/MemoryGuard';
import { BackupFileProcessor } from '../../service/parser/detection/BackupFileProcessor';
import { OverlapPostProcessor } from '../../service/parser/post-processing/OverlapPostProcessor';
import { ASTNodeTracker } from '../../service/parser/processing/utils/AST/ASTNodeTracker';
import { ChunkRebalancer } from '../../service/parser/processing/utils/ChunkRebalancer';
// ProcessingGuard 现在是 UnifiedGuardCoordinator 的别名，通过类型定义处理
import { CleanupManager } from '../../infrastructure/cleanup/CleanupManager';
import { GuardCoordinator } from '../../service/parser/guard/GuardCoordinator';
import { IntelligentFallbackEngine } from '../../service/parser/guard/IntelligentFallbackEngine';

import { MarkdownTextStrategy } from '../../service/parser/processing/utils/md/MarkdownTextStrategy';
import { XMLTextStrategy } from '../../service/parser/processing/utils/xml/XMLTextStrategy';

import { HTMLContentExtractor } from '../../service/parser/processing/utils/html/HTMLContentExtractor';

import { LanguageDetector } from '../../service/parser/core/language-detection/LanguageDetector';
import { DetectionService } from '../../service/parser/detection/DetectionService';

// 新增的依赖倒置和事件系统
import { IServiceContainer } from '../../interfaces/IServiceContainer';
import { ServiceContainerAdapter } from '../../infrastructure/container/ServiceContainerAdapter';
import { IEventBus } from '../../interfaces/IEventBus';
import { EventBus } from '../../infrastructure/events/EventBus';
import { IFileFeatureDetector } from '../../service/parser/detection/IFileFeatureDetector';
import { FileFeatureDetector } from '../../service/parser/detection/FileFeatureDetector';

// 分段器模块服务
import { ProtectionCoordinator } from '../../service/parser/processing/utils/protection/ProtectionCoordinator';
import { ChunkFilter } from '../../service/parser/processing/utils/chunking/ChunkFilter';
import { ChunkMerger } from '../../service/parser/processing/utils/chunking/evaluators/ChunkMerger';
import { ChunkSimilarityCalculator } from '../../service/parser/processing/utils/chunking/evaluators/ChunkSimilarityCalculator';

// 新增的processing模块替代组件
import { StrategyFactory } from '../../service/parser/processing/factory/StrategyFactory';
import { ProcessingCoordinator } from '../../service/parser/processing/coordinator/ProcessingCoordinator';

import { ChunkPostProcessorCoordinator } from '../../service/parser/post-processing/ChunkPostProcessorCoordinator';
import { ProcessingConfig } from '../../service/parser/processing/core/types/ConfigTypes';

// 文件搜索服务
import { FileSearchService } from '../../service/filesearch/FileSearchService';
import { FileVectorIndexer } from '../../service/filesearch/FileVectorIndexer';
import { FileQueryProcessor } from '../../service/filesearch/FileQueryProcessor';
import { FileQueryIntentClassifier } from '../../service/filesearch/FileQueryIntentClassifier';
import { FileSearchCache } from '../../service/filesearch/FileSearchCache';

// Nebula监控服务
import { NebulaConnectionMonitor } from '../../database/nebula/NebulaConnectionMonitor';

// 内存监控服务
import { MemoryMonitorService } from '../../service/memory/MemoryMonitorService';
import { IMemoryMonitorService } from '../../service/memory/interfaces/IMemoryMonitorService';

// 图索引性能监控
import { IGraphIndexPerformanceMonitor, GraphIndexMetric, GraphIndexPerformanceStats } from '../../infrastructure/monitoring/GraphIndexMetrics';

// 图构建服务
import { GraphConstructionService } from '../../service/graph/construction/GraphConstructionService';



export class BusinessServiceRegistrar {
  static register(container: Container): void {
    const logger = container.get<LoggerService>(TYPES.LoggerService);

    try {
      logger?.info('Registering business services...');

      // 首先注册相似度服务，确保所有依赖都可用
      logger?.info('Registering similarity services first...');
      SimilarityServiceRegistrar.register(container);
      logger?.info('Similarity services registered successfully');

      // 文件系统服务
      container.bind<FileSystemTraversal>(TYPES.FileSystemTraversal).to(FileSystemTraversal).inSingletonScope();
      container.bind<FileHashManager>(TYPES.FileHashManager).to(FileHashManagerImpl).inSingletonScope();
      container.bind<FileWatcherService>(TYPES.FileWatcherService).to(FileWatcherService).inSingletonScope();
      container.bind<ChangeDetectionService>(TYPES.ChangeDetectionService).to(ChangeDetectionService).inSingletonScope();
      container.bind<HotReloadRecoveryService>(TYPES.HotReloadRecoveryService).to(HotReloadRecoveryService).inSingletonScope();
      container.bind<ProjectHotReloadService>(TYPES.ProjectHotReloadService).to(ProjectHotReloadService).inSingletonScope();
      container.bind<HotReloadConfigService>(TYPES.HotReloadConfigService).to(HotReloadConfigService).inSingletonScope();
      container.bind<HotReloadMonitoringService>(TYPES.HotReloadMonitoringService).to(HotReloadMonitoringService).inSingletonScope();
      container.bind<HotReloadErrorPersistenceService>(TYPES.HotReloadErrorPersistenceService).to(HotReloadErrorPersistenceService).inSingletonScope();
      container.bind<HotReloadRestartService>(TYPES.HotReloadRestartService).to(HotReloadRestartService).inSingletonScope();

      // 项目管理服务
      container.bind<CoreStateService>(TYPES.CoreStateService).to(CoreStateService).inSingletonScope();
      container.bind<StorageStateService>(TYPES.StorageStateService).to(StorageStateService).inSingletonScope();
      container.bind<ProjectStateManager>(TYPES.ProjectStateManager).to(ProjectStateManager).inSingletonScope();

      // 图构建服务
      container.bind<GraphConstructionService>(TYPES.GraphConstructionService).to(GraphConstructionService).inSingletonScope();

      // 索引服务架构
      container.bind<VectorIndexService>(TYPES.VectorIndexService).to(VectorIndexService).inSingletonScope();
      container.bind<GraphIndexService>(TYPES.GraphIndexService).to(GraphIndexService).inSingletonScope();
      container.bind<HybridIndexService>(TYPES.HybridIndexService).to(HybridIndexService).inSingletonScope();

      // 忽略规则管理器 - 使用 toDynamicValue 确保正确注入依赖
      container.bind<IgnoreRuleManager>(TYPES.IgnoreRuleManager).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        return new IgnoreRuleManager(logger);
      }).inSingletonScope();

      // 性能优化服务
      container.bind<PerformanceOptimizerService>(TYPES.PerformanceOptimizerService).to(PerformanceOptimizerService).inSingletonScope();

      // 批处理策略已在 InfrastructureServiceRegistrar 中注册

      // 分段配置服务
      container.bind<SegmentationConfigService>(TYPES.SegmentationConfigService).to(SegmentationConfigService).inSingletonScope();


      // 解析服务
      container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
      container.bind<TreeSitterService>(TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();
      container.bind<TreeSitterQueryEngine>(TYPES.TreeSitterQueryEngine).to(TreeSitterQueryEngine).inSingletonScope();
      container.bind<ChunkToVectorCoordinationService>(TYPES.ChunkToVectorCoordinationService).to(ChunkToVectorCoordinationService).inSingletonScope();

      // 标准化服务
      container.bind<QueryResultNormalizer>(TYPES.QueryResultNormalizer).to(QueryResultNormalizer).inSingletonScope();

      // 新的AST结构提取器相关服务
      container.bind<StructureTypeConverter>(TYPES.StructureTypeConverter).to(StructureTypeConverter).inSingletonScope();

      container.bind<ASTStructureExtractorFactory>(TYPES.ASTStructureExtractorFactory).toDynamicValue(context => {
        const queryNormalizer = context.get<QueryResultNormalizer>(TYPES.QueryResultNormalizer);
        const treeSitterCoreService = context.get<TreeSitterCoreService>(TYPES.TreeSitterCoreService);
        return new ASTStructureExtractorFactory(queryNormalizer, treeSitterCoreService);
      }).inSingletonScope();

      container.bind<ASTStructureExtractor>(TYPES.ASTStructureExtractor).toDynamicValue(context => {
        const factory = context.get<ASTStructureExtractorFactory>(TYPES.ASTStructureExtractorFactory);
        return factory.getInstance();
      }).inSingletonScope();

      container.bind<UnifiedContentAnalyzer>(TYPES.UnifiedContentAnalyzer).toDynamicValue(context => {
        const queryNormalizer = context.get<QueryResultNormalizer>(TYPES.QueryResultNormalizer);
        const treeSitterCoreService = context.get<TreeSitterCoreService>(TYPES.TreeSitterCoreService);
        const astStructureExtractor = context.get<ASTStructureExtractor>(TYPES.ASTStructureExtractor);
        return new UnifiedContentAnalyzer(queryNormalizer, treeSitterCoreService, astStructureExtractor);
      }).inSingletonScope();

      // 分段器模块服务 - 注意：UniversalTextStrategy 现在不使用 @injectable，需要手动实例化
      container.bind<UniversalTextStrategy>(TYPES.UniversalTextStrategy).toDynamicValue(() => {
        return new UniversalTextStrategy({
          name: 'universal-text-segmentation',
          supportedLanguages: ['*'],
          enabled: true,
          description: 'Universal Text Segmentation Strategy',
          maxChunkSize: 3000,
          minChunkSize: 200,
          maxLinesPerChunk: 100,
          minLinesPerChunk: 5,
          overlapSize: 100,
          enableIntelligentChunking: true,
          memoryLimitMB: 512,
          errorThreshold: 10
        });
      }).inSingletonScope();

      // 新增的processing模块替代组件
      container.bind<StrategyFactory>(TYPES.StrategyFactory).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const segmentationConfigService = context.get<SegmentationConfigService>(TYPES.SegmentationConfigService);

        // 创建默认的ProcessingConfig
        const processingConfig: ProcessingConfig = {
          chunking: {
            maxChunkSize: 2000,
            minChunkSize: 200,
            overlapSize: 100,
            maxLinesPerChunk: 50,
            minLinesPerChunk: 5,
            maxOverlapRatio: 0.2,
            defaultStrategy: 'semantic',
            strategyPriorities: {
              'semantic': 10,
              'bracket': 8,
              'line': 6,
              'ast': 9
            },
            enableIntelligentChunking: true,
            enableSemanticBoundaryDetection: true
          },
          features: {
            enableAST: true,
            enableSemanticDetection: true,
            enableBracketBalance: true,
            enableCodeOverlap: true,
            enableStandardization: true,
            standardizationFallback: true,
            enableComplexityCalculation: true,
            enableLanguageFeatureDetection: true,
            featureDetectionThresholds: {}
          },
          performance: {
            memoryLimitMB: 500,
            maxExecutionTime: 30000,
            enableCaching: true,
            cacheSizeLimit: 100,
            enablePerformanceMonitoring: true,
            concurrencyLimit: 10,
            queueSizeLimit: 100,
            enableBatchProcessing: true,
            batchSize: 50,
            enableLazyLoading: true
          },
          languages: {},
          postProcessing: {
            enabled: true,
            enabledProcessors: ['OverlapPostProcessor', 'ChunkFilter', 'ChunkRebalancer'],
            processorConfigs: {},
            processorOrder: ['OverlapPostProcessor', 'ChunkFilter', 'ChunkRebalancer'],
            maxProcessingRounds: 3,
            enableParallelProcessing: false,
            parallelProcessingLimit: 5
          },
          global: {
            debugMode: false,
            logLevel: 'info',
            enableMetrics: true,
            enableStatistics: true,
            configVersion: '1.0.0',
            compatibilityMode: false,
            strictMode: false,
            experimentalFeatures: [],
            customProperties: {}
          },
          version: '1.0.0',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        return new StrategyFactory(processingConfig);
      }).inSingletonScope();



      container.bind<ChunkPostProcessorCoordinator>(TYPES.ChunkPostProcessorCoordinator).to(ChunkPostProcessorCoordinator).inSingletonScope();

      // 注册 ProcessingCoordinator
      container.bind<ProcessingCoordinator>(TYPES.UnifiedProcessingCoordinator).to(ProcessingCoordinator).inSingletonScope();

      // 块相似性计算器
      container.bind<ChunkSimilarityCalculator>(TYPES.ChunkSimilarityCalculator).to(ChunkSimilarityCalculator).inSingletonScope();

      // 块合并器
      container.bind<ChunkMerger>(TYPES.ChunkMerger).to(ChunkMerger).inSingletonScope();

      // 处理器
      container.bind<ChunkFilter>(TYPES.ChunkFilter).to(ChunkFilter).inSingletonScope();
      container.bind<OverlapPostProcessor>(TYPES.OverlapPostProcessor).to(OverlapPostProcessor).inSingletonScope();
      container.bind<ASTNodeTracker>(TYPES.ASTNodeTracker).to(ASTNodeTracker).inSingletonScope();
      container.bind<ChunkRebalancer>(TYPES.ChunkRebalancer).to(ChunkRebalancer).inSingletonScope();

      // 通用文件处理服务 - 使用新的模块化分段器
      container.bind<ErrorThresholdInterceptor>(TYPES.ErrorThresholdManager).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const cleanupManager = context.get<CleanupManager>(TYPES.CleanupManager);
        // 从环境变量获取配置，如果没有则使用默认值
        const maxErrors = parseInt(process.env.UNIVERSAL_MAX_ERRORS || '5', 10);
        const resetInterval = parseInt(process.env.UNIVERSAL_ERROR_RESET_INTERVAL || '6000', 10);
        const config = { maxErrorCount: maxErrors };
        const errorThresholdInterceptor = new ErrorThresholdInterceptor(config, logger, cleanupManager, maxErrors, resetInterval);
        return errorThresholdInterceptor;
      }).inSingletonScope();
      container.bind<MemoryGuard>(TYPES.MemoryGuard).toDynamicValue(context => {
        const memoryMonitorService = context.get<IMemoryMonitorService>(TYPES.MemoryMonitorService);
        const memoryLimitMB = context.get<number>(TYPES.MemoryLimitMB);
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const cleanupManager = context.get<CleanupManager>(TYPES.CleanupManager);
        return new MemoryGuard(memoryMonitorService, memoryLimitMB, logger, cleanupManager);
      }).inSingletonScope();
      container.bind<BackupFileProcessor>(TYPES.BackupFileProcessor).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        return new BackupFileProcessor(logger);
      }).inSingletonScope();
      // 将 ProcessingGuard 直接绑定到 UnifiedGuardCoordinator（直接迁移策略）
      container.bind(TYPES.ProcessingGuard).toDynamicValue(context => {
        return context.get<GuardCoordinator>(TYPES.UnifiedGuardCoordinator);
      }).inSingletonScope();

      // 服务容器适配器
      container.bind<IServiceContainer>(TYPES.ServiceContainer).toDynamicValue(context => {
        return new ServiceContainerAdapter((context as any).container);
      }).inSingletonScope();

      // 事件总线
      container.bind<IEventBus>(TYPES.EventBus).to(EventBus).inSingletonScope();

      // 文件特征检测器
      container.bind<IFileFeatureDetector>(TYPES.FileFeatureDetector).to(FileFeatureDetector).inSingletonScope();

      // 语言检测服务
      container.bind<LanguageDetector>(TYPES.LanguageDetector).to(LanguageDetector).inSingletonScope();

      // 文件检测服务
      container.bind<DetectionService>(TYPES.DetectionService).to(DetectionService).inSingletonScope();

      // 智能降级引擎
      container.bind<IntelligentFallbackEngine>(TYPES.IntelligentFallbackEngine).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        return new IntelligentFallbackEngine(logger);
      }).inSingletonScope();

      // UnifiedGuardCoordinator - 使用依赖倒置的统一保护机制协调器
      container.bind<GuardCoordinator>(TYPES.UnifiedGuardCoordinator).toDynamicValue(context => {
        const memoryMonitorService = context.get<IMemoryMonitorService>(TYPES.MemoryMonitorService);
        const errorThresholdInterceptor = context.get<ErrorThresholdInterceptor>(TYPES.ErrorThresholdManager);
        const cleanupManager = context.get<CleanupManager>(TYPES.CleanupManager);
        const serviceContainer = context.get<IServiceContainer>(TYPES.ServiceContainer);
        const logger = context.get<LoggerService>(TYPES.LoggerService);

        const memoryLimitMB = context.get<number>(TYPES.MemoryLimitMB);
        const memoryCheckIntervalMs = context.get<number>(TYPES.MemoryCheckIntervalMs);

        return new GuardCoordinator(
          memoryMonitorService,
          errorThresholdInterceptor,
          cleanupManager,
          serviceContainer,
          memoryLimitMB,
          memoryCheckIntervalMs,
          logger
        );
      }).inSingletonScope();



      // 特殊格式文本分割器
      container.bind<MarkdownTextStrategy>(TYPES.MarkdownTextStrategy).to(MarkdownTextStrategy).inSingletonScope();
      container.bind<XMLTextStrategy>(TYPES.XMLTextStrategy).to(XMLTextStrategy).inSingletonScope();

      // HTML内容提取器
      container.bind<HTMLContentExtractor>(TYPES.HTMLContentExtractor).to(HTMLContentExtractor).inSingletonScope();

      // 搜索服务
      container.bind<FileSearchService>(TYPES.FileSearchService).to(FileSearchService).inSingletonScope();
      container.bind<FileVectorIndexer>(TYPES.FileVectorIndexer).to(FileVectorIndexer).inSingletonScope();
      container.bind<FileQueryProcessor>(TYPES.FileQueryProcessor).to(FileQueryProcessor).inSingletonScope();
      container.bind<FileQueryIntentClassifier>(TYPES.FileQueryIntentClassifier).to(FileQueryIntentClassifier).inSingletonScope();
      container.bind<FileSearchCache>(TYPES.FileSearchCache).to(FileSearchCache).inSingletonScope();

      // Nebula监控服务
      container.bind<NebulaConnectionMonitor>(TYPES.NebulaConnectionMonitor).to(NebulaConnectionMonitor).inSingletonScope();

      // 内存监控服务
      container.bind<IMemoryMonitorService>(TYPES.MemoryMonitorService).to(MemoryMonitorService).inSingletonScope();

      // MemoryGuard 参数
      container.bind<number>(TYPES.MemoryLimitMB).toConstantValue(500);
      container.bind<number>(TYPES.MemoryCheckIntervalMs).toConstantValue(5000);

      // 图索引性能监控 - 使用模拟实现
      container.bind<IGraphIndexPerformanceMonitor>(TYPES.GraphIndexPerformanceMonitor).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const stats = new Map<string, GraphIndexPerformanceStats>();

        return {
          recordMetric: (metric: GraphIndexMetric) => {
            logger?.debug(`Recording graph index metric: ${metric.operation} for project ${metric.projectId}`);

            // 更新统计信息
            if (!stats.has(metric.projectId)) {
              stats.set(metric.projectId, {
                projectId: metric.projectId,
                totalOperations: 0,
                successfulOperations: 0,
                failedOperations: 0,
                averageOperationTime: 0,
                totalFilesProcessed: 0,
                totalNodesCreated: 0,
                totalRelationshipsCreated: 0,
                averageBatchSize: 0,
                successRate: 0,
                lastUpdated: Date.now(),
                operations: {
                  startIndexing: 0,
                  stopIndexing: 0,
                  processBatch: 0,
                  storeFiles: 0,
                  createSpace: 0
                }
              });
            }

            const projectStats = stats.get(metric.projectId)!;
            projectStats.totalOperations++;
            projectStats.operations[metric.operation]++;

            if (metric.success) {
              projectStats.successfulOperations++;
            } else {
              projectStats.failedOperations++;
            }

            projectStats.successRate = projectStats.successfulOperations / projectStats.totalOperations;

            // 更新平均操作时间
            const totalTime = projectStats.averageOperationTime * (projectStats.totalOperations - 1) + metric.duration;
            projectStats.averageOperationTime = totalTime / projectStats.totalOperations;

            // 更新其他统计信息
            if (metric.metadata.fileCount) {
              projectStats.totalFilesProcessed += metric.metadata.fileCount;
            }
            if (metric.metadata.nodesCreated) {
              projectStats.totalNodesCreated += metric.metadata.nodesCreated;
            }
            if (metric.metadata.relationshipsCreated) {
              projectStats.totalRelationshipsCreated += metric.metadata.relationshipsCreated;
            }
            if (metric.metadata.batchSize) {
              const totalBatchSize = projectStats.averageBatchSize * (projectStats.totalOperations - 1) + metric.metadata.batchSize;
              projectStats.averageBatchSize = totalBatchSize / projectStats.totalOperations;
            }

            projectStats.lastUpdated = Date.now();
          },

          getPerformanceStats: (projectId: string) => {
            return stats.get(projectId) || null;
          },

          getAllPerformanceStats: () => {
            return new Map(stats);
          },

          clearProjectStats: (projectId: string) => {
            stats.delete(projectId);
          },

          clearAllStats: () => {
            stats.clear();
          },

          getPerformanceReport: (projectId?: string) => {
            const allStats = projectId ?
              (stats.get(projectId) ? [stats.get(projectId)!] : []) :
              Array.from(stats.values());

            const totalProjects = allStats.length;
            const totalOperations = allStats.reduce((sum, stat) => sum + stat.totalOperations, 0);
            const overallSuccessRate = totalOperations > 0 ?
              allStats.reduce((sum, stat) => sum + stat.successfulOperations, 0) / totalOperations : 0;
            const averageOperationTime = totalOperations > 0 ?
              allStats.reduce((sum, stat) => sum + stat.averageOperationTime * stat.totalOperations, 0) / totalOperations : 0;

            return {
              summary: {
                totalProjects,
                totalOperations,
                overallSuccessRate,
                averageOperationTime
              },
              projectStats: allStats.map(stat => ({
                projectId: stat.projectId,
                stats: stat
              }))
            };
          }
        };
      }).inSingletonScope();

      logger?.info('Business services registered successfully');
    } catch (error: any) {
      logger?.error('Failed to register business services:', error);
      logger?.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        kind: error?.kind
      });
      throw error;
    }
  }
}