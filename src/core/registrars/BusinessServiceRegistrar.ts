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

// 通用文件处理服务
import { UniversalTextSplitter } from '../../service/parser/universal/UniversalTextSplitter';
import { ErrorThresholdManager } from '../../service/parser/universal/ErrorThresholdManager';
import { MemoryGuard } from '../../service/parser/guard/MemoryGuard';
import { BackupFileProcessor } from '../../service/parser/universal/BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../../service/parser/universal/ExtensionlessFileProcessor';
import { ProcessingGuard } from '../../service/parser/universal/ProcessingGuard';
import { CleanupManager } from '../../service/parser/universal/cleanup/CleanupManager';

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
    // 文件系统服务
    container.bind<FileSystemTraversal>(TYPES.FileSystemTraversal).to(FileSystemTraversal).inSingletonScope();
    container.bind<FileWatcherService>(TYPES.FileWatcherService).to(FileWatcherService).inSingletonScope();
    container.bind<ChangeDetectionService>(TYPES.ChangeDetectionService).to(ChangeDetectionService).inSingletonScope();
    container.bind<HotReloadRecoveryService>(TYPES.HotReloadRecoveryService).to(HotReloadRecoveryService).inSingletonScope();
    container.bind<ProjectHotReloadService>(TYPES.ProjectHotReloadService).to(ProjectHotReloadService).inSingletonScope();
    container.bind<HotReloadConfigService>(TYPES.HotReloadConfigService).to(HotReloadConfigService).inSingletonScope();
    container.bind<HotReloadMonitoringService>(TYPES.HotReloadMonitoringService).to(HotReloadMonitoringService).inSingletonScope();
    container.bind<HotReloadErrorPersistenceService>(TYPES.HotReloadErrorPersistenceService).to(HotReloadErrorPersistenceService).inSingletonScope();
    container.bind<HotReloadRestartService>(TYPES.HotReloadRestartService).to(HotReloadRestartService).inSingletonScope();

    // 项目管理服务
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
    container.bind<PerformanceOptimizerService>(TYPES.PerformanceOptimizerService).toDynamicValue(context => {
      const logger = context.get<LoggerService>(TYPES.LoggerService);
      const errorHandler = context.get<ErrorHandlerService>(TYPES.ErrorHandlerService);
      const configService = context.get<ConfigService>(TYPES.ConfigService);
      const memoryMonitor = context.get<MemoryMonitorService>(TYPES.MemoryMonitorService);
      return new PerformanceOptimizerService(logger, errorHandler, configService, memoryMonitor);
    }).inSingletonScope();

    // 解析服务
    container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
    container.bind<TreeSitterService>(TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();
    container.bind<ASTCodeSplitter>(TYPES.ASTCodeSplitter).to(ASTCodeSplitter).inSingletonScope();
    container.bind<ChunkToVectorCoordinationService>(TYPES.ChunkToVectorCoordinationService).to(ChunkToVectorCoordinationService).inSingletonScope();

    // CleanupManager - 需要在ErrorThresholdManager和MemoryGuard之前注册
    container.bind<CleanupManager>(TYPES.CleanupManager).toDynamicValue(context => {
      const logger = context.get<LoggerService>(TYPES.LoggerService);
      const cleanupManager = new CleanupManager(logger);
      
      // 初始化CleanupManager
      cleanupManager.initialize();
      
      // 注册清理策略
      const { TreeSitterCacheCleanupStrategy } = require('../../service/parser/universal/cleanup/strategies/TreeSitterCacheCleanupStrategy');
      const { LRUCacheCleanupStrategy } = require('../../service/parser/universal/cleanup/strategies/LRUCacheCleanupStrategy');
      const { GarbageCollectionStrategy } = require('../../service/parser/universal/cleanup/strategies/GarbageCollectionStrategy');
      
      cleanupManager.registerStrategy(new TreeSitterCacheCleanupStrategy(logger));
      cleanupManager.registerStrategy(new LRUCacheCleanupStrategy(logger));
      cleanupManager.registerStrategy(new GarbageCollectionStrategy(logger));
      
      return cleanupManager;
    }).inSingletonScope();

    // 通用文件处理服务
    container.bind<UniversalTextSplitter>(TYPES.UniversalTextSplitter).toDynamicValue(context => {
      const logger = context.get<LoggerService>(TYPES.LoggerService);
      return new UniversalTextSplitter(logger);
    }).inSingletonScope();
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
  } catch(error: any) {
    console.error('Error registering business services:', error);
    console.error('Error stack:', error?.stack);
    throw error;
  }
}