import { Container } from 'inversify';
import { TYPES } from '../../types';

// 文件系统服务
import { FileSystemTraversal } from '../../service/filesystem/FileSystemTraversal';
import { FileWatcherService } from '../../service/filesystem/FileWatcherService';
import { ChangeDetectionService } from '../../service/filesystem/ChangeDetectionService';

// 项目管理服务
import { IndexService } from '../../service/index/IndexService';
import { IndexingLogicService } from '../../service/index/IndexingLogicService';
import { ProjectStateManager } from '../../service/project/ProjectStateManager';

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
import { MemoryGuard } from '../../service/parser/universal/MemoryGuard';
import { BackupFileProcessor } from '../../service/parser/universal/BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../../service/parser/universal/ExtensionlessFileProcessor';
import { ProcessingGuard } from '../../service/parser/universal/ProcessingGuard';

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

    // 项目管理服务
    container.bind<IndexService>(TYPES.IndexService).to(IndexService).inSingletonScope();
    container.bind<IndexingLogicService>(TYPES.IndexingLogicService).to(IndexingLogicService).inSingletonScope();
    container.bind<ProjectStateManager>(TYPES.ProjectStateManager).to(ProjectStateManager).inSingletonScope();

    // 性能优化服务
    container.bind<PerformanceOptimizerService>(TYPES.PerformanceOptimizerService).to(PerformanceOptimizerService).inSingletonScope();

    // 解析服务
    container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
    container.bind<TreeSitterService>(TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();
    container.bind<ASTCodeSplitter>(TYPES.ASTCodeSplitter).to(ASTCodeSplitter).inSingletonScope();
    container.bind<ChunkToVectorCoordinationService>(TYPES.ChunkToVectorCoordinationService).to(ChunkToVectorCoordinationService).inSingletonScope();

    // 通用文件处理服务
    container.bind<UniversalTextSplitter>(TYPES.UniversalTextSplitter).to(UniversalTextSplitter).inSingletonScope();
    container.bind<ErrorThresholdManager>(TYPES.ErrorThresholdManager).to(ErrorThresholdManager).inSingletonScope();
    container.bind<MemoryGuard>(TYPES.MemoryGuard).to(MemoryGuard).inSingletonScope();
    container.bind<BackupFileProcessor>(TYPES.BackupFileProcessor).to(BackupFileProcessor).inSingletonScope();
    container.bind<ExtensionlessFileProcessor>(TYPES.ExtensionlessFileProcessor).to(ExtensionlessFileProcessor).inSingletonScope();
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

  }
}