import { Container } from 'inversify';
import { TYPES } from '../../types';

// 文件系统服务
import { FileSystemTraversal } from '../../service/filesystem/FileSystemTraversal';
import { FileWatcherService } from '../../service/filesystem/FileWatcherService';
import { ChangeDetectionService } from '../../service/filesystem/ChangeDetectionService';

// 项目管理服务
import { IndexSyncService } from '../../service/index/IndexSyncService';
import { ProjectStateManager } from '../../service/project/ProjectStateManager';

// 性能优化服务
import { PerformanceOptimizerService } from '../../service/resilience/ResilientBatchingService';

// 解析服务
import { TreeSitterService } from '../../service/parser/core/parse/TreeSitterService';
import { TreeSitterCoreService } from '../../service/parser/core/parse/TreeSitterCoreService';
import { ASTCodeSplitter } from '../../service/parser/splitting/ASTCodeSplitter';

// 搜索服务
import { FileSearchService } from '../../service/filesearch/FileSearchService';
import { FileVectorIndexer } from '../../service/filesearch/FileVectorIndexer';
import { FileQueryProcessor } from '../../service/filesearch/FileQueryProcessor';
import { FileQueryIntentClassifier } from '../../service/filesearch/FileQueryIntentClassifier';
import { FileSearchCache } from '../../service/filesearch/FileSearchCache';

// Nebula监控服务
import { NebulaConnectionMonitor } from '../../service/graph/monitoring/NebulaConnectionMonitor';

export class BusinessServiceRegistrar {
  static register(container: Container): void {
    // 文件系统服务
    container.bind<FileSystemTraversal>(TYPES.FileSystemTraversal).to(FileSystemTraversal).inSingletonScope();
    container.bind<FileWatcherService>(TYPES.FileWatcherService).to(FileWatcherService).inSingletonScope();
    container.bind<ChangeDetectionService>(TYPES.ChangeDetectionService).to(ChangeDetectionService).inSingletonScope();

    // 项目管理服务
    container.bind<IndexSyncService>(TYPES.IndexSyncService).to(IndexSyncService).inSingletonScope();
    container.bind<ProjectStateManager>(TYPES.ProjectStateManager).to(ProjectStateManager).inSingletonScope();

    // 性能优化服务
    container.bind<PerformanceOptimizerService>(TYPES.PerformanceOptimizerService).to(PerformanceOptimizerService).inSingletonScope();

    // 解析服务
    container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
    container.bind<TreeSitterService>(TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();
    container.bind<ASTCodeSplitter>(TYPES.ASTCodeSplitter).to(ASTCodeSplitter).inSingletonScope();

    // 搜索服务
    container.bind<FileSearchService>(TYPES.FileSearchService).to(FileSearchService).inSingletonScope();
    container.bind<FileVectorIndexer>(TYPES.FileVectorIndexer).to(FileVectorIndexer).inSingletonScope();
    container.bind<FileQueryProcessor>(TYPES.FileQueryProcessor).to(FileQueryProcessor).inSingletonScope();
    container.bind<FileQueryIntentClassifier>(TYPES.FileQueryIntentClassifier).to(FileQueryIntentClassifier).inSingletonScope();
    container.bind<FileSearchCache>(TYPES.FileSearchCache).to(FileSearchCache).inSingletonScope();
    
    // Nebula监控服务
    container.bind<NebulaConnectionMonitor>(TYPES.NebulaConnectionMonitor).to(NebulaConnectionMonitor).inSingletonScope();
  }
}