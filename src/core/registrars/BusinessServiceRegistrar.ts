import { Container } from 'inversify';
import { TYPES } from '../../types';

// 文件系统服务
import { FileSystemTraversal } from '../../service/filesystem/FileSystemTraversal';
import { FileWatcherService } from '../../service/filesystem/FileWatcherService';
import { ChangeDetectionService } from '../../service/filesystem/ChangeDetectionService';

// 项目管理服务
import { IndexService } from '../../service/index/IndexService';
import { ProjectStateManager } from '../../service/project/ProjectStateManager';

// 性能优化服务
import { PerformanceOptimizerService } from '../../service/resilience/ResilientBatchingService';

// 解析服务
import { TreeSitterService } from '../../service/parser/core/parse/TreeSitterService';
import { TreeSitterCoreService } from '../../service/parser/core/parse/TreeSitterCoreService';
import { ASTCodeSplitter } from '../../service/parser/splitting/ASTCodeSplitter';
import { ChunkToVectorCoordinationService } from '../../service/parser/ChunkToVectorCoordinationService';

// 搜索服务
import { FileSearchService } from '../../service/filesearch/FileSearchService';
import { FileVectorIndexer } from '../../service/filesearch/FileVectorIndexer';
import { FileQueryProcessor } from '../../service/filesearch/FileQueryProcessor';
import { FileQueryIntentClassifier } from '../../service/filesearch/FileQueryIntentClassifier';
import { FileSearchCache } from '../../service/filesearch/FileSearchCache';

// Nebula监控服务
import { NebulaConnectionMonitor } from '../../service/graph/monitoring/NebulaConnectionMonitor';

// 图服务
import { GraphCacheService } from '../../service/graph/cache/GraphCacheService';
import { GraphPerformanceMonitor } from '../../service/graph/performance/GraphPerformanceMonitor';
import { GraphBatchOptimizer } from '../../service/graph/performance/GraphBatchOptimizer';
import { GraphQueryValidator } from '../../service/graph/validation/GraphQueryValidator';
import { GraphAnalysisService } from '../../service/graph/core/GraphAnalysisService';
import { GraphDataService } from '../../service/graph/core/GraphDataService';
import { GraphTransactionService } from '../../service/graph/core/GraphTransactionService';
import { GraphSearchServiceNew } from '../../service/graph/core/GraphSearchServiceNew';
import { GraphServiceNewAdapter } from '../../service/graph/core/GraphServiceNewAdapter';

export class BusinessServiceRegistrar {
  static register(container: Container): void {
    // 文件系统服务
    container.bind<FileSystemTraversal>(TYPES.FileSystemTraversal).to(FileSystemTraversal).inSingletonScope();
    container.bind<FileWatcherService>(TYPES.FileWatcherService).to(FileWatcherService).inSingletonScope();
    container.bind<ChangeDetectionService>(TYPES.ChangeDetectionService).to(ChangeDetectionService).inSingletonScope();

    // 项目管理服务
    container.bind<IndexService>(TYPES.IndexSyncService).to(IndexService).inSingletonScope();
    container.bind<ProjectStateManager>(TYPES.ProjectStateManager).to(ProjectStateManager).inSingletonScope();

    // 性能优化服务
    container.bind<PerformanceOptimizerService>(TYPES.PerformanceOptimizerService).to(PerformanceOptimizerService).inSingletonScope();

    // 解析服务
    container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).to(TreeSitterCoreService).inSingletonScope();
    container.bind<TreeSitterService>(TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();
    container.bind<ASTCodeSplitter>(TYPES.ASTCodeSplitter).to(ASTCodeSplitter).inSingletonScope();
    container.bind<ChunkToVectorCoordinationService>(TYPES.ChunkToVectorCoordinationService).to(ChunkToVectorCoordinationService).inSingletonScope();

    // 搜索服务
    container.bind<FileSearchService>(TYPES.FileSearchService).to(FileSearchService).inSingletonScope();
    container.bind<FileVectorIndexer>(TYPES.FileVectorIndexer).to(FileVectorIndexer).inSingletonScope();
    container.bind<FileQueryProcessor>(TYPES.FileQueryProcessor).to(FileQueryProcessor).inSingletonScope();
    container.bind<FileQueryIntentClassifier>(TYPES.FileQueryIntentClassifier).to(FileQueryIntentClassifier).inSingletonScope();
    container.bind<FileSearchCache>(TYPES.FileSearchCache).to(FileSearchCache).inSingletonScope();

    // Nebula监控服务
    container.bind<NebulaConnectionMonitor>(TYPES.NebulaConnectionMonitor).to(NebulaConnectionMonitor).inSingletonScope();

    // 图服务
    container.bind<GraphCacheService>(TYPES.GraphCacheService).to(GraphCacheService).inSingletonScope();
    container.bind<GraphPerformanceMonitor>(TYPES.GraphPerformanceMonitor).to(GraphPerformanceMonitor).inSingletonScope();
    container.bind<GraphBatchOptimizer>(TYPES.GraphBatchOptimizer).to(GraphBatchOptimizer).inSingletonScope();
    container.bind<GraphQueryValidator>(TYPES.GraphQueryValidator).to(GraphQueryValidator).inSingletonScope();
    container.bind<GraphAnalysisService>(TYPES.GraphAnalysisService).to(GraphAnalysisService).inSingletonScope();
    container.bind<GraphDataService>(TYPES.GraphDataService).to(GraphDataService).inSingletonScope();
    container.bind<GraphTransactionService>(TYPES.GraphTransactionService).to(GraphTransactionService).inSingletonScope();
    container.bind<GraphSearchServiceNew>(TYPES.GraphSearchServiceNew).to(GraphSearchServiceNew).inSingletonScope();
    container.bind<GraphServiceNewAdapter>(TYPES.GraphServiceNewAdapter).to(GraphServiceNewAdapter).inSingletonScope();
  }
}