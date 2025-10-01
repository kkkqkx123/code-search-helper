import { ContainerModule } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { GraphDatabaseService } from '../../../database/graph/GraphDatabaseService';
import { GraphQueryBuilder } from '../../../database/query/GraphQueryBuilder';
import { ICacheService } from '../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';
import { IBatchOptimizer } from '../../../infrastructure/batching/types';
import { TransactionManager } from '../../../database/core/TransactionManager';
import { GraphAnalysisService } from './GraphAnalysisService';
import { GraphDataService } from './GraphDataService';
import { GraphTransactionService } from './GraphTransactionService';
import { GraphSearchServiceNew } from './GraphSearchServiceNew';
import { GraphServiceNewAdapter } from './GraphServiceNewAdapter';
import { IGraphAnalysisService } from './IGraphAnalysisService';
import { IGraphDataService } from './IGraphDataService';
import { IGraphTransactionService } from './IGraphTransactionService';
import { IGraphSearchService } from './IGraphSearchService';
import { IGraphService } from './IGraphService';

// 创建图服务模块
export const GraphModule = new ContainerModule((bind: any) => {
  // 绑定图分析服务
  bind(TYPES.GraphAnalysisService)
    .to(GraphAnalysisService)
    .inSingletonScope();

  // 绑定图数据服务
  bind(TYPES.GraphDataService)
    .to(GraphDataService)
    .inSingletonScope();

  // 绑定图事务服务
  bind(TYPES.GraphTransactionService)
    .to(GraphTransactionService)
    .inSingletonScope();

  // 绑定图搜索服务
  bind(TYPES.GraphSearchServiceNew)
    .to(GraphSearchServiceNew)
    .inSingletonScope();

  // 绑定图服务适配器（实现旧接口）
  bind(TYPES.GraphServiceNewAdapter)
    .to(GraphServiceNewAdapter)
    .inSingletonScope();

  // 绑定基础设施服务（如果尚未绑定）
  bind(TYPES.LoggerService).to(LoggerService).inSingletonScope();
  bind(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
  bind(TYPES.GraphDatabaseService).to(GraphDatabaseService).inSingletonScope();
  bind(TYPES.GraphQueryBuilder).to(GraphQueryBuilder).inSingletonScope();
  bind(TYPES.GraphPerformanceMonitor).toDynamicValue((context: any) => {
    // 这里应该根据实际的性能监控实现来绑定
    // 暂时使用占位符
    return {};
  }).inSingletonScope();
  bind(TYPES.GraphCacheService).toDynamicValue((context: any) => {
    // 这里应该根据实际的缓存服务实现来绑定
    // 暂时使用占位符
    return {};
  }).inSingletonScope();
  bind(TYPES.GraphBatchOptimizer).toDynamicValue((context: any) => {
    // 这里应该根据实际的批处理优化器实现来绑定
    // 暂时使用占位符
    return {};
  }).inSingletonScope();
  bind(TYPES.TransactionManager).to(TransactionManager).inSingletonScope();
});