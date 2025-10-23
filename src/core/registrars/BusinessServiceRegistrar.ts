import { Container } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';

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
import { IndexService } from '../../service/index/IndexService';
import { IndexingLogicService } from '../../service/index/IndexingLogicService';
import { ProjectStateManager } from '../../service/project/ProjectStateManager';
import { CoreStateService } from '../../service/project/services/CoreStateService';
import { StorageStateService } from '../../service/project/services/StorageStateService';

// 新增的索引服务
import { VectorIndexService } from '../../service/index/VectorIndexService';
import { GraphIndexService } from '../../service/index/GraphIndexService';
import { StorageCoordinatorService } from '../../service/index/StorageCoordinatorService';
import { ConcurrencyService } from '../../service/index/shared/ConcurrencyService';
import { FileTraversalService } from '../../service/index/shared/FileTraversalService';

// 性能优化服务
import { PerformanceOptimizerService } from '../../infrastructure/batching/PerformanceOptimizerService';

// 解析服务
import { TreeSitterService } from '../../service/parser/core/parse/TreeSitterService';
import { TreeSitterCoreService } from '../../service/parser/core/parse/TreeSitterCoreService';
import { ASTCodeSplitter } from '../../service/parser/splitting/ASTCodeSplitter';
import { ChunkToVectorCoordinationService } from '../../service/parser/ChunkToVectorCoordinationService';
import { QueryResultNormalizer } from '../../service/parser/core/normalization/QueryResultNormalizer';

// 通用文件处理服务
import { UniversalTextSplitter } from '../../service/parser/universal/UniversalTextSplitter';
import { ErrorThresholdManager } from '../../service/parser/universal/ErrorThresholdManager';
import { MemoryGuard } from '../../service/parser/guard/MemoryGuard';
import { BackupFileProcessor } from '../../service/parser/universal/BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../../service/parser/universal/ExtensionlessFileProcessor';
import { ProcessingGuard } from '../../service/parser/guard/ProcessingGuard';
import { CleanupManager } from '../../infrastructure/cleanup/CleanupManager';
import { UnifiedGuardCoordinator } from '../../service/parser/guard/UnifiedGuardCoordinator';
import { ProcessingStrategySelector } from '../../service/parser/universal/coordination/ProcessingStrategySelector';
import { FileProcessingCoordinator } from '../../service/parser/universal/coordination/FileProcessingCoordinator';

// 分段器模块服务
import { SegmentationContextManager } from '../../service/parser/universal/context/SegmentationContextManager';
import { ConfigurationManager } from '../../service/parser/universal/config/ConfigurationManager';
import { ProtectionCoordinator } from '../../service/parser/universal/protection/ProtectionCoordinator';
import { ComplexityCalculator } from '../../service/parser/universal/processors/ComplexityCalculator';
import { OverlapProcessor } from '../../service/parser/universal/processors/OverlapProcessor';
import { ChunkFilter } from '../../service/parser/universal/processors/ChunkFilter';
import { ChunkRebalancer } from '../../service/parser/universal/processors/ChunkRebalancer';
import { SemanticSegmentationStrategy } from '../../service/parser/universal/strategies/SemanticSegmentationStrategy';
import { BracketSegmentationStrategy } from '../../service/parser/universal/strategies/BracketSegmentationStrategy';
import { LineSegmentationStrategy } from '../../service/parser/universal/strategies/LineSegmentationStrategy';
import { MarkdownSegmentationStrategy } from '../../service/parser/universal/strategies/MarkdownSegmentationStrategy';
import { StandardizationSegmentationStrategy } from '../../service/parser/universal/strategies/StandardizationSegmentationStrategy';

// 文件搜索服务
import { FileSearchService } from '../../service/filesearch/FileSearchService';
import { FileVectorIndexer } from '../../service/filesearch/FileVectorIndexer';
import { FileQueryProcessor } from '../../service/filesearch/FileQueryProcessor';
import { FileQueryIntentClassifier } from '../../service/filesearch/FileQueryIntentClassifier';
import { FileSearchCache } from '../../service/filesearch/FileSearchCache';

// Nebula监控服务
import { NebulaConnectionMonitor } from '../../service/graph/monitoring/NebulaConnectionMonitor';

// 内存监控服务
import { MemoryMonitorService } from '../../service/memory/MemoryMonitorService';



export class BusinessServiceRegistrar {
  static register(container: Container): void {
    const logger = container.get<LoggerService>(TYPES.LoggerService);
    
    try {
      logger?.info('Registering business services...');
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
    container.bind<IndexService>(TYPES.IndexService).to(IndexService).inSingletonScope();
    container.bind<IndexingLogicService>(TYPES.IndexingLogicService).to(IndexingLogicService).inSingletonScope();
    container.bind<CoreStateService>(TYPES.CoreStateService).to(CoreStateService).inSingletonScope();
    container.bind<StorageStateService>(TYPES.StorageStateService).to(StorageStateService).inSingletonScope();
    container.bind<ProjectStateManager>(TYPES.ProjectStateManager).to(ProjectStateManager).inSingletonScope();

    // 文件遍历服务
    container.bind<FileTraversalService>(TYPES.FileTraversalService).to(FileTraversalService).inSingletonScope();

    // 并发服务
    container.bind<ConcurrencyService>(TYPES.ConcurrencyService).to(ConcurrencyService).inSingletonScope();

    // 新增的索引服务
    container.bind<VectorIndexService>(TYPES.VectorIndexService).to(VectorIndexService).inSingletonScope();
    container.bind<GraphIndexService>(TYPES.GraphIndexService).to(GraphIndexService).inSingletonScope();
    container.bind<StorageCoordinatorService>(TYPES.StorageCoordinatorService).to(StorageCoordinatorService).inSingletonScope();

    // 忽略规则管理器 - 使用 toDynamicValue 确保正确注入依赖
    container.bind<IgnoreRuleManager>(TYPES.IgnoreRuleManager).toDynamicValue(context => {
      const logger = context.get<LoggerService>(TYPES.LoggerService);
      return new IgnoreRuleManager(logger);
    }).inSingletonScope();

    // 性能优化服务
    container.bind<PerformanceOptimizerService>(TYPES.PerformanceOptimizerService).to(PerformanceOptimizerService).inSingletonScope();

    // 解析服务
    container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
    container.bind<TreeSitterService>(TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();
    container.bind<ASTCodeSplitter>(TYPES.ASTCodeSplitter).to(ASTCodeSplitter).inSingletonScope();
    container.bind<ChunkToVectorCoordinationService>(TYPES.ChunkToVectorCoordinationService).to(ChunkToVectorCoordinationService).inSingletonScope();
    
    // 标准化服务
    container.bind<QueryResultNormalizer>(TYPES.QueryResultNormalizer).to(QueryResultNormalizer).inSingletonScope();

    // 处理策略选择器 - 需要在UnifiedGuardCoordinator之前注册
    container.bind<ProcessingStrategySelector>(TYPES.ProcessingStrategySelector).toDynamicValue(context => {
      const logger = context.get<LoggerService>(TYPES.LoggerService);
      return new ProcessingStrategySelector(logger);
    }).inSingletonScope();

    // 文件处理协调器 - 需要在UnifiedGuardCoordinator之前注册
    container.bind<FileProcessingCoordinator>(TYPES.FileProcessingCoordinator).toDynamicValue(context => {
      const logger = context.get<LoggerService>(TYPES.LoggerService);
      const universalTextSplitter = context.get<UniversalTextSplitter>(TYPES.UniversalTextSplitter);
      const treeSitterService = context.get<TreeSitterService>(TYPES.TreeSitterService);
      return new FileProcessingCoordinator(logger, universalTextSplitter, treeSitterService);
    }).inSingletonScope();

    // CleanupManager 现在在 InfrastructureServiceRegistrar 中注册
    /* 通过DIContainer.ts的注册顺序保证：
    InfrastructureServiceRegistrar.register()在BusinessServiceRegistrar.register()之前调用
    */

    // 分段器模块服务 - 统一在这里管理
    // 核心类
    container.bind<UniversalTextSplitter>(TYPES.UniversalTextSplitter).to(UniversalTextSplitter).inSingletonScope();
    container.bind<SegmentationContextManager>(TYPES.SegmentationContextManager).to(SegmentationContextManager).inSingletonScope();
    
    // 配置和保护
    container.bind<ConfigurationManager>(TYPES.ConfigurationManager).to(ConfigurationManager).inSingletonScope();
    container.bind<ProtectionCoordinator>(TYPES.ProtectionCoordinator).to(ProtectionCoordinator).inSingletonScope();
    
    // 复杂度计算器
    container.bind<ComplexityCalculator>(TYPES.ComplexityCalculator).to(ComplexityCalculator).inSingletonScope();
    
    // 策略
    container.bind<SemanticSegmentationStrategy>(TYPES.SemanticSegmentationStrategy).to(SemanticSegmentationStrategy).inSingletonScope();
    container.bind<BracketSegmentationStrategy>(TYPES.BracketSegmentationStrategy).to(BracketSegmentationStrategy).inSingletonScope();
    container.bind<LineSegmentationStrategy>(TYPES.LineSegmentationStrategy).to(LineSegmentationStrategy).inSingletonScope();
    container.bind<MarkdownSegmentationStrategy>(TYPES.MarkdownSegmentationStrategy).to(MarkdownSegmentationStrategy).inSingletonScope();
    container.bind<StandardizationSegmentationStrategy>(TYPES.StandardizationSegmentationStrategy).to(StandardizationSegmentationStrategy).inSingletonScope();
    
    // 处理器
    container.bind<OverlapProcessor>(TYPES.OverlapProcessor).to(OverlapProcessor).inSingletonScope();
    container.bind<ChunkFilter>(TYPES.ChunkFilter).to(ChunkFilter).inSingletonScope();
    container.bind<ChunkRebalancer>(TYPES.ChunkRebalancer).to(ChunkRebalancer).inSingletonScope();

    // 初始化分段器模块 - 设置策略和处理器
    BusinessServiceRegistrar.initializeSegmentationServices(container);

    // 通用文件处理服务 - 使用新的模块化分段器
    container.bind<ErrorThresholdManager>(TYPES.ErrorThresholdManager).toDynamicValue(context => {
      const logger = context.get<LoggerService>(TYPES.LoggerService);
      const cleanupManager = context.get<CleanupManager>(TYPES.CleanupManager);
      // 从环境变量获取配置，如果没有则使用默认值
      const maxErrors = parseInt(process.env.UNIVERSAL_MAX_ERRORS || '5', 10);
      const resetInterval = parseInt(process.env.UNIVERSAL_ERROR_RESET_INTERVAL || '60000', 10);
      return new ErrorThresholdManager(logger, cleanupManager, maxErrors, resetInterval);
    }).inSingletonScope();
    container.bind<MemoryGuard>(TYPES.MemoryGuard).toDynamicValue(context => {
      const memoryMonitorService = context.get<MemoryMonitorService>(TYPES.MemoryMonitorService);
      const memoryLimitMB = context.get<number>(TYPES.MemoryLimitMB);
      const memoryCheckIntervalMs = context.get<number>(TYPES.MemoryCheckIntervalMs);
      const logger = context.get<LoggerService>(TYPES.LoggerService);
      const cleanupManager = context.get<CleanupManager>(TYPES.CleanupManager);
      return new MemoryGuard(memoryMonitorService, memoryLimitMB, memoryCheckIntervalMs, logger, cleanupManager);
    }).inSingletonScope();
    container.bind<BackupFileProcessor>(TYPES.BackupFileProcessor).toDynamicValue(context => {
      const logger = context.get<LoggerService>(TYPES.LoggerService);
      return new BackupFileProcessor(logger);
    }).inSingletonScope();
    container.bind<ExtensionlessFileProcessor>(TYPES.ExtensionlessFileProcessor).toDynamicValue(context => {
      const logger = context.get<LoggerService>(TYPES.LoggerService);
      return new ExtensionlessFileProcessor(logger);
    }).inSingletonScope();
    container.bind<ProcessingGuard>(TYPES.ProcessingGuard).to(ProcessingGuard).inSingletonScope();

    // UnifiedGuardCoordinator - 新的统一保护机制协调器
    container.bind<UnifiedGuardCoordinator>(TYPES.UnifiedGuardCoordinator).toDynamicValue(context => {
      const memoryMonitorService = context.get<MemoryMonitorService>(TYPES.MemoryMonitorService);
      const errorThresholdManager = context.get<ErrorThresholdManager>(TYPES.ErrorThresholdManager);
      const cleanupManager = context.get<CleanupManager>(TYPES.CleanupManager);
      const logger = context.get<LoggerService>(TYPES.LoggerService);

      // 获取策略选择器和文件处理协调器
      const processingStrategySelector = context.get<ProcessingStrategySelector>(TYPES.ProcessingStrategySelector);
      const fileProcessingCoordinator = context.get<FileProcessingCoordinator>(TYPES.FileProcessingCoordinator);

      const memoryLimitMB = context.get<number>(TYPES.MemoryLimitMB);
      const memoryCheckIntervalMs = context.get<number>(TYPES.MemoryCheckIntervalMs);

      return UnifiedGuardCoordinator.getInstance(
        memoryMonitorService,
        errorThresholdManager,
        cleanupManager,
        processingStrategySelector,
        fileProcessingCoordinator,
        memoryLimitMB,
        memoryCheckIntervalMs,
        logger
      );
    }).inSingletonScope();

    // 搜索服务
    container.bind<FileSearchService>(TYPES.FileSearchService).to(FileSearchService).inSingletonScope();
    container.bind<FileVectorIndexer>(TYPES.FileVectorIndexer).to(FileVectorIndexer).inSingletonScope();
    container.bind<FileQueryProcessor>(TYPES.FileQueryProcessor).to(FileQueryProcessor).inSingletonScope();
    container.bind<FileQueryIntentClassifier>(TYPES.FileQueryIntentClassifier).to(FileQueryIntentClassifier).inSingletonScope();
    container.bind<FileSearchCache>(TYPES.FileSearchCache).to(FileSearchCache).inSingletonScope();

    // Nebula监控服务
    container.bind<NebulaConnectionMonitor>(TYPES.NebulaConnectionMonitor).to(NebulaConnectionMonitor).inSingletonScope();

    // 内存监控服务
    container.bind<MemoryMonitorService>(TYPES.MemoryMonitorService).to(MemoryMonitorService).inSingletonScope();

    // MemoryGuard 参数
    container.bind<number>(TYPES.MemoryLimitMB).toConstantValue(500);
    container.bind<number>(TYPES.MemoryCheckIntervalMs).toConstantValue(5000);
    
    logger?.info('Business services registered successfully');
    } catch (error) {
      logger?.error('Failed to register business services:', error);
      throw error;
    }
  }

  /**
   * 初始化分段器服务 - 设置策略和处理器
   */
  private static initializeSegmentationServices(container: Container): void {
    const logger = container.get<LoggerService>(TYPES.LoggerService);
    
    try {
      logger?.info('Initializing segmentation services...');
      
      // 设置策略到上下文管理器
      const contextManager = container.get<SegmentationContextManager>(TYPES.SegmentationContextManager);
      logger?.debug('SegmentationContextManager retrieved from container');
      
      // 添加所有策略
      const strategies = [
        { name: 'SemanticSegmentationStrategy', type: TYPES.SemanticSegmentationStrategy },
        { name: 'BracketSegmentationStrategy', type: TYPES.BracketSegmentationStrategy },
        { name: 'LineSegmentationStrategy', type: TYPES.LineSegmentationStrategy },
        { name: 'MarkdownSegmentationStrategy', type: TYPES.MarkdownSegmentationStrategy },
        { name: 'StandardizationSegmentationStrategy', type: TYPES.StandardizationSegmentationStrategy }
      ];
      
      for (const strategy of strategies) {
        try {
          const strategyInstance = container.get<any>(strategy.type);
          contextManager.addStrategy(strategyInstance);
          logger?.debug(`Added segmentation strategy: ${strategy.name}`);
        } catch (error) {
          logger?.error(`Failed to add segmentation strategy ${strategy.name}:`, error);
          throw error;
        }
      }
      
      // 设置处理器到UniversalTextSplitter
      const universalTextSplitter = container.get<UniversalTextSplitter>(TYPES.UniversalTextSplitter);
      logger?.debug('UniversalTextSplitter retrieved from container');
      
      const processors = [
        { name: 'OverlapProcessor', type: TYPES.OverlapProcessor },
        { name: 'ChunkFilter', type: TYPES.ChunkFilter },
        { name: 'ChunkRebalancer', type: TYPES.ChunkRebalancer }
      ];
      
      for (const processor of processors) {
        try {
          const processorInstance = container.get<any>(processor.type);
          universalTextSplitter.addProcessor(processorInstance);
          logger?.debug(`Added segmentation processor: ${processor.name}`);
        } catch (error) {
          logger?.error(`Failed to add segmentation processor ${processor.name}:`, error);
          throw error;
        }
      }
      
      logger?.info('Segmentation services initialized successfully');
    } catch (error) {
      logger?.error('Failed to initialize segmentation services:', error);
      throw error;
    }
  }
}