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
import { ASTCodeSplitter } from '../../service/parser/processing/strategies/impl/ASTCodeSplitter';
import { ChunkToVectorCoordinationService } from '../../service/parser/ChunkToVectorCoordinationService';
import { QueryResultNormalizer } from '../../service/parser/core/normalization/QueryResultNormalizer';
import { UnifiedConfigManager } from '../../service/parser/config/UnifiedConfigManager';

// 通用文件处理服务
import { UniversalTextStrategy } from '../../service/parser/processing/utils/UniversalTextStrategy';
import { ErrorThresholdInterceptor } from '../../service/parser/processing/utils/protection/ErrorThresholdInterceptor';
import { MemoryGuard } from '../../service/parser/guard/MemoryGuard';
import { BackupFileProcessor } from '../../service/parser/processing/detection/BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../../service/parser/processing/detection/ExtensionlessFileProcessor';
// ProcessingGuard 现在是 UnifiedGuardCoordinator 的别名，通过类型定义处理
import { CleanupManager } from '../../infrastructure/cleanup/CleanupManager';
import { UnifiedGuardCoordinator } from '../../service/parser/guard/UnifiedGuardCoordinator';
import { ProcessingStrategySelector } from '../../service/parser/processing/utils/coordination/ProcessingStrategySelector';
import { FileProcessingCoordinator } from '../../service/parser/processing/utils/coordination/FileProcessingCoordinator';
// import { OptimizedProcessingGuard } from '../../service/parser/guard/OptimizedProcessingGuard'; // 暂时注释掉，文件不存在
import { UnifiedDetectionCenter } from '../../service/parser/processing/detection/UnifiedDetectionCenter';
import { IntelligentFallbackEngine } from '../../service/parser/processing/utils/IntelligentFallbackEngine';
import { ProcessingStrategyFactory } from '../../service/parser/processing/strategies/providers/ProcessingStrategyFactory';
import { MarkdownTextStrategy } from '../../service/parser/processing/utils/md/MarkdownTextStrategy';
import { XMLTextStrategy } from '../../service/parser/processing/utils/xml/XMLTextStrategy';
import { ConfigCoordinator } from '../../service/parser/processing/coordination/ConfigCoordinator';
import { PerformanceMonitoringCoordinator } from '../../service/parser/processing/coordination/PerformanceMonitoringCoordinator';
import { UnifiedProcessingCoordinator } from '../../service/parser/processing/coordination/UnifiedProcessingCoordinator';
import { UnifiedStrategyManager } from '../../service/parser/processing/strategies/manager/UnifiedStrategyManager';
import { UnifiedDetectionService } from '../../service/parser/processing/detection/UnifiedDetectionService';

// 分段器模块服务
import { SegmentationStrategyCoordinator } from '../../service/parser/processing/coordination/SegmentationStrategyCoordinator';
import { ConfigurationManager } from '../../service/parser/processing/config/ConfigurationManager';
import { ProtectionCoordinator } from '../../service/parser/processing/utils/protection/ProtectionCoordinator';
import { ComplexityCalculator } from '../../service/parser/processing/utils/calculation/ComplexityCalculator';
import { ChunkFilter } from '../../service/parser/processing/utils/chunking/ChunkFilter';
import { SemanticSegmentationStrategy } from '../../service/parser/processing/strategies/segmentation/SemanticSegmentationStrategy';
import { BracketSegmentationStrategy } from '../../service/parser/processing/strategies/segmentation/BracketSegmentationStrategy';
import { LineStrategyProvider } from '../../service/parser/processing/strategies/providers/LineStrategyProvider';
import { MarkdownSegmentationStrategy } from '../../service/parser/processing/strategies/segmentation/MarkdownSegmentationStrategy';
import { StandardizationSegmentationStrategy } from '../../service/parser/processing/strategies/segmentation/StandardizationSegmentationStrategy';

// 新增的策略提供者
import { ImportStrategyProvider } from '../../service/parser/processing/strategies/providers/ImportStrategyProvider';
import { SyntaxAwareStrategyProvider } from '../../service/parser/processing/strategies/providers/SyntaxAwareStrategyProvider';
import { IntelligentStrategyProvider } from '../../service/parser/processing/strategies/providers/IntelligentStrategyProvider';
import { StructureAwareStrategyProvider } from '../../service/parser/processing/strategies/providers/StructureAwareStrategyProvider';
import { SemanticStrategyProvider } from '../../service/parser/processing/strategies/providers/SemanticStrategyProvider';

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
        const universalTextSplitter = context.get<UniversalTextStrategy>(TYPES.UniversalTextStrategy);
        const treeSitterService = context.get<TreeSitterService>(TYPES.TreeSitterService);
        return new FileProcessingCoordinator(logger, universalTextSplitter, treeSitterService);
      }).inSingletonScope();

      // CleanupManager 现在在 InfrastructureServiceRegistrar 中注册
      /* 通过DIContainer.ts的注册顺序保证：
      InfrastructureServiceRegistrar.register()在BusinessServiceRegistrar.register()之前调用
      */

      // 分段器模块服务 - 统一在这里管理
      // 核心类
      container.bind<UniversalTextStrategy>(TYPES.UniversalTextStrategy).to(UniversalTextStrategy).inSingletonScope();
      container.bind<SegmentationStrategyCoordinator>(TYPES.SegmentationStrategyCoordinator).to(SegmentationStrategyCoordinator).inSingletonScope();

      // 配置和保护
      container.bind<ConfigurationManager>(TYPES.ConfigurationManager).to(ConfigurationManager).inSingletonScope();
      container.bind<ProtectionCoordinator>(TYPES.ProtectionCoordinator).to(ProtectionCoordinator).inSingletonScope();

      // 复杂度计算器
      container.bind<ComplexityCalculator>(TYPES.ComplexityCalculator).to(ComplexityCalculator).inSingletonScope();

      // 策略
      container.bind<SemanticSegmentationStrategy>(TYPES.SemanticSegmentationStrategy).to(SemanticSegmentationStrategy).inSingletonScope();
      container.bind<BracketSegmentationStrategy>(TYPES.BracketSegmentationStrategy).to(BracketSegmentationStrategy).inSingletonScope();
      // container.bind<LineSegmentationStrategy>(TYPES.LineSegmentationStrategy).to(LineSegmentationStrategy).inSingletonScope(); // 暂时注释掉
      container.bind<MarkdownSegmentationStrategy>(TYPES.MarkdownSegmentationStrategy).to(MarkdownSegmentationStrategy).inSingletonScope();
      container.bind<StandardizationSegmentationStrategy>(TYPES.StandardizationSegmentationStrategy).to(StandardizationSegmentationStrategy).inSingletonScope();

      // 新增的策略提供者
      container.bind<ImportStrategyProvider>(TYPES.ImportStrategyProvider).to(ImportStrategyProvider).inSingletonScope();
      container.bind<SyntaxAwareStrategyProvider>(TYPES.SyntaxAwareStrategyProvider).to(SyntaxAwareStrategyProvider).inSingletonScope();
      container.bind<IntelligentStrategyProvider>(TYPES.IntelligentStrategyProvider).to(IntelligentStrategyProvider).inSingletonScope();
      container.bind<StructureAwareStrategyProvider>(TYPES.StructureAwareStrategyProvider).to(StructureAwareStrategyProvider).inSingletonScope();
      container.bind<SemanticStrategyProvider>(TYPES.SemanticStrategyProvider).to(SemanticStrategyProvider).inSingletonScope();

      // 处理器
      container.bind<ChunkFilter>(TYPES.ChunkFilter).to(ChunkFilter).inSingletonScope();

      // 初始化分段器模块 - 设置策略和处理器
      BusinessServiceRegistrar.initializeSegmentationServices(container);
      BusinessServiceRegistrar.initializeSegmentationStrategyCoordinator(container);

      // 通用文件处理服务 - 使用新的模块化分段器
      container.bind<ErrorThresholdInterceptor>(TYPES.ErrorThresholdManager).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const cleanupManager = context.get<CleanupManager>(TYPES.CleanupManager);
        // 从环境变量获取配置，如果没有则使用默认值
        const maxErrors = parseInt(process.env.UNIVERSAL_MAX_ERRORS || '5', 10);
        const resetInterval = parseInt(process.env.UNIVERSAL_ERROR_RESET_INTERVAL || '60000', 10);
        const config = { maxErrorCount: maxErrors };
        const errorThresholdInterceptor = new ErrorThresholdInterceptor(config, logger, cleanupManager, maxErrors, resetInterval);
        return errorThresholdInterceptor;
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
      // 将 ProcessingGuard 直接绑定到 UnifiedGuardCoordinator（直接迁移策略）
      container.bind(TYPES.ProcessingGuard).toDynamicValue(context => {
        return context.get<UnifiedGuardCoordinator>(TYPES.UnifiedGuardCoordinator);
      }).inSingletonScope();

      // 优化的处理保护器
      // container.bind<OptimizedProcessingGuard>(TYPES.OptimizedProcessingGuard).toDynamicValue(context => {
      //   const logger = context.get<LoggerService>(TYPES.LoggerService);
      //   const errorThresholdManager = context.get<ErrorThresholdManager>(TYPES.ErrorThresholdManager);
      //   const memoryGuard = context.get<MemoryGuard>(TYPES.MemoryGuard);
      //   const strategyFactory = context.get<ProcessingStrategyFactory>(TYPES.ProcessingStrategyFactory);
      //   const detectionCenter = context.get<UnifiedDetectionCenter>(TYPES.UnifiedDetectionCenter);
      //   const fallbackEngine = context.get<IntelligentFallbackEngine>(TYPES.IntelligentFallbackEngine);

      //   return OptimizedProcessingGuard.getInstance(
      //     logger,
      //     errorThresholdManager,
      //     memoryGuard,
      //     strategyFactory,
      //     detectionCenter
      //   );
      // }).inSingletonScope(); // 暂时注释掉，类不存在

      // 统一检测中心
      container.bind<UnifiedDetectionCenter>(TYPES.UnifiedDetectionCenter).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const backupProcessor = context.get<BackupFileProcessor>(TYPES.BackupFileProcessor);
        const extensionlessProcessor = context.get<ExtensionlessFileProcessor>(TYPES.ExtensionlessFileProcessor);

        return new UnifiedDetectionCenter(logger, backupProcessor, extensionlessProcessor);
      }).inSingletonScope();

      // 智能降级引擎
      container.bind<IntelligentFallbackEngine>(TYPES.IntelligentFallbackEngine).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        return new IntelligentFallbackEngine(logger);
      }).inSingletonScope();

      // 处理策略工厂
      container.bind<ProcessingStrategyFactory>(TYPES.ProcessingStrategyFactory).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        const universalTextSplitter = context.get<UniversalTextStrategy>(TYPES.UniversalTextStrategy);
        const treeSitterService = context.get<TreeSitterService>(TYPES.TreeSitterService);
        const markdownSplitter = context.get<MarkdownTextStrategy>(TYPES.MarkdownTextStrategy);
        const xmlSplitter = context.get<XMLTextStrategy>(TYPES.XMLTextStrategy);

        return new ProcessingStrategyFactory(logger, treeSitterService, markdownSplitter, xmlSplitter);
      }).inSingletonScope();

      // UnifiedGuardCoordinator - 新的统一保护机制协调器
      container.bind<UnifiedGuardCoordinator>(TYPES.UnifiedGuardCoordinator).toDynamicValue(context => {
        const memoryMonitorService = context.get<MemoryMonitorService>(TYPES.MemoryMonitorService);
        const errorThresholdInterceptor = context.get<ErrorThresholdInterceptor>(TYPES.ErrorThresholdManager);
        const cleanupManager = context.get<CleanupManager>(TYPES.CleanupManager);
        const logger = context.get<LoggerService>(TYPES.LoggerService);

        // 获取策略选择器和文件处理协调器
        const processingStrategySelector = context.get<ProcessingStrategySelector>(TYPES.ProcessingStrategySelector);
        const fileProcessingCoordinator = context.get<FileProcessingCoordinator>(TYPES.FileProcessingCoordinator);

        // 获取 ProcessingGuard 整合的依赖
        const detectionCenter = context.get<UnifiedDetectionCenter>(TYPES.UnifiedDetectionCenter);
        const strategyFactory = context.get<ProcessingStrategyFactory>(TYPES.ProcessingStrategyFactory);
        const fallbackEngine = context.get<IntelligentFallbackEngine>(TYPES.IntelligentFallbackEngine);

        const memoryLimitMB = context.get<number>(TYPES.MemoryLimitMB);
        const memoryCheckIntervalMs = context.get<number>(TYPES.MemoryCheckIntervalMs);

        return UnifiedGuardCoordinator.getInstance(
          memoryMonitorService,
          errorThresholdInterceptor,
          cleanupManager,
          processingStrategySelector,
          fileProcessingCoordinator,
          detectionCenter,
          strategyFactory,
          fallbackEngine,
          memoryLimitMB,
          memoryCheckIntervalMs,
          logger
        );
      }).inSingletonScope();

      // 配置协调器
      container.bind<ConfigCoordinator>(TYPES.ConfigCoordinator).toDynamicValue(context => {
        const configManager = context.get<UnifiedConfigManager>(TYPES.UnifiedConfigManager);
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        return new ConfigCoordinator(configManager, logger);
      }).inSingletonScope();

      // 性能监控协调器
      container.bind<PerformanceMonitoringCoordinator>(TYPES.PerformanceMonitoringCoordinator).toDynamicValue(context => {
        const logger = context.get<LoggerService>(TYPES.LoggerService);
        return new PerformanceMonitoringCoordinator(logger);
      }).inSingletonScope();

      // 统一处理协调器
      container.bind<UnifiedProcessingCoordinator>(TYPES.UnifiedProcessingCoordinator).toDynamicValue(context => {
        const strategyManager = context.get<UnifiedStrategyManager>(TYPES.UnifiedStrategyManager);
        const detectionService = context.get<UnifiedDetectionService>(TYPES.UnifiedDetectionService);
        const configManager = context.get<UnifiedConfigManager>(TYPES.UnifiedConfigManager);
        const guardCoordinator = context.get<UnifiedGuardCoordinator>(TYPES.UnifiedGuardCoordinator);
        const performanceMonitor = context.get<PerformanceMonitoringCoordinator>(TYPES.PerformanceMonitoringCoordinator);
        const configCoordinator = context.get<ConfigCoordinator>(TYPES.ConfigCoordinator);
        const segmentationCoordinator = context.get<SegmentationStrategyCoordinator>(TYPES.SegmentationStrategyCoordinator);
        const logger = context.get<LoggerService>(TYPES.LoggerService);

        return new UnifiedProcessingCoordinator(
          strategyManager,
          detectionService,
          configManager,
          guardCoordinator,
          performanceMonitor,
          configCoordinator,
          segmentationCoordinator,
          logger
        );
      }).inSingletonScope();

      // 特殊格式文本分割器
      container.bind<MarkdownTextStrategy>(TYPES.MarkdownTextStrategy).to(MarkdownTextStrategy).inSingletonScope();
      container.bind<XMLTextStrategy>(TYPES.XMLTextStrategy).to(XMLTextStrategy).inSingletonScope();

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

      // 设置策略到协调器
      const segmentationCoordinator = container.get<SegmentationStrategyCoordinator>(TYPES.SegmentationStrategyCoordinator);
      logger?.debug('SegmentationStrategyCoordinator retrieved from container');

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
          segmentationCoordinator.addStrategy(strategyInstance);
          logger?.debug(`Added segmentation strategy: ${strategy.name}`);
        } catch (error) {
          logger?.error(`Failed to add segmentation strategy ${strategy.name}:`, error);
          throw error;
        }
      }

      // 设置处理器到UniversalTextStrategy
      const universalTextSplitter = container.get<UniversalTextStrategy>(TYPES.UniversalTextStrategy);
      logger?.debug('UniversalTextStrategy retrieved from container');

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

  /**
   * 初始化分段策略协调器 - 添加策略到协调器
   */
  private static initializeSegmentationStrategyCoordinator(container: Container): void {
    const logger = container.get<LoggerService>(TYPES.LoggerService);

    try {
      logger?.info('Initializing SegmentationStrategyCoordinator with strategies...');

      // 获取分段策略协调器实例
      const segmentationCoordinator = container.get<SegmentationStrategyCoordinator>(TYPES.SegmentationStrategyCoordinator);
      logger?.debug('SegmentationStrategyCoordinator retrieved from container');

      // 获取所有分段策略
      const strategies = [
        { name: 'SemanticSegmentationStrategy', type: TYPES.SemanticSegmentationStrategy },
        { name: 'BracketSegmentationStrategy', type: TYPES.BracketSegmentationStrategy },
        { name: 'LineSegmentationStrategy', type: TYPES.LineSegmentationStrategy },
        { name: 'MarkdownSegmentationStrategy', type: TYPES.MarkdownSegmentationStrategy },
        { name: 'StandardizationSegmentationStrategy', type: TYPES.StandardizationSegmentationStrategy }
      ];

      // 添加策略到协调器
      for (const strategy of strategies) {
        try {
          const strategyInstance = container.get<any>(strategy.type);
          segmentationCoordinator.addStrategy(strategyInstance);
          logger?.debug(`Added segmentation strategy to coordinator: ${strategy.name}`);
        } catch (error) {
          logger?.error(`Failed to add segmentation strategy to coordinator ${strategy.name}:`, error);
          // 这里我们继续添加其他策略，而不是抛出异常
          continue;
        }
      }

      logger?.info('SegmentationStrategyCoordinator initialized successfully');
    } catch (error) {
      logger?.error('Failed to initialize SegmentationStrategyCoordinator:', error);
      throw error;
    }
  }
}