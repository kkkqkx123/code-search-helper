import { ContainerModule, interfaces } from 'inversify';
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
import { GraphServiceNewAdapter } from './GraphServiceNewAdapter';
import { IGraphAnalysisService } from './IGraphAnalysisService';
import { IGraphDataService } from './IGraphDataService';
import { IGraphTransactionService } from './IGraphTransactionService';
import { IGraphService } from '../core/IGraphService';

// 创建图服务模块
export const GraphModule = new ContainerModule((bind: interfaces.Bind) => {
  // 绑定图分析服务
  bind<IGraphAnalysisService>(TYPES.GraphAnalysisService)
    .to(GraphAnalysisService)
    .inSingletonScope();

  // 绑定图数据服务
  bind<IGraphDataService>(TYPES.GraphDataService)
    .to(GraphDataService)
    .inSingletonScope();

  // 绑定图事务服务
  bind<IGraphTransactionService>(TYPES.GraphTransactionService)
    .to(GraphTransactionService)
    .inSingletonScope();

  // 绑定图服务适配器（实现旧接口）
  bind<IGraphService>(TYPES.GraphServiceNewAdapter)
    .to(GraphServiceNewAdapter)
    .inSingletonScope();

  // 绑定基础设施服务（如果尚未绑定）
  bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
  bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
  bind<GraphDatabaseService>(TYPES.GraphDatabaseService).to(GraphDatabaseService).inSingletonScope();
  bind<GraphQueryBuilder>(TYPES.GraphQueryBuilder).to(GraphQueryBuilder).inSingletonScope();
  bind<IPerformanceMonitor>(TYPES.GraphPerformanceMonitor).toDynamicValue((context) => {
    // 这里应该根据实际的性能监控实现来绑定
    // 暂时使用占位符
    return {} as IPerformanceMonitor;
  }).inSingletonScope();
  bind<ICacheService>(TYPES.GraphCacheService).toDynamicValue((context) => {
    // 这里应该根据实际的缓存服务实现来绑定
    // 暂时使用占位符
    return {} as ICacheService;
  }).inSingletonScope();
  bind<IBatchOptimizer>(TYPES.GraphBatchOptimizer).toDynamicValue((context) => {
    // 这里应该根据实际的批处理优化器实现来绑定
    // 暂时使用占位符
    return {} as IBatchOptimizer;
  }).inSingletonScope();
  bind<TransactionManager>(TYPES.TransactionManager).to(TransactionManager).inSingletonScope();
});