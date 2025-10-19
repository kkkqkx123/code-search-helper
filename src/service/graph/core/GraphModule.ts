import { ContainerModule } from 'inversify';
import { TYPES } from '../../../types';
import { GraphAnalysisService } from './GraphAnalysisService';
import { GraphDataService } from './GraphDataService';
import { GraphTransactionService } from './GraphTransactionService';
import { GraphSearchServiceNew } from './GraphSearchService';
import { GraphServiceNewAdapter } from './GraphServiceNewAdapter';
import { IGraphSearchService } from './IGraphSearchService';

// 导入基础设施服务实现
import { GraphCacheService } from '../../../infrastructure/caching/GraphCacheService';
import { GraphPerformanceMonitor } from '../../graph/performance/GraphPerformanceMonitor';
import { GraphBatchOptimizer } from '../../graph/performance/GraphBatchOptimizer';
import { GraphQueryValidator } from '../query/GraphQueryValidator';

// 创建图服务模块
export const GraphModule = new ContainerModule((bindObj: any) => {
  try {
    const bind = bindObj.bind;

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

    // 绑定图搜索服务接口和实现
    bind(TYPES.IGraphSearchService)
      .to(GraphSearchServiceNew)
      .inSingletonScope();
    bind(TYPES.GraphSearchServiceNew)
      .to(GraphSearchServiceNew)
      .inSingletonScope();
    // 为了向后兼容，也绑定旧的GraphSearchService类型
    bind(TYPES.GraphSearchService)
      .to(GraphSearchServiceNew)
      .inSingletonScope();

    // 绑定图服务适配器（实现旧接口）
    bind(TYPES.GraphServiceNewAdapter)
      .to(GraphServiceNewAdapter)
      .inSingletonScope();

    // 绑定GraphService以解决依赖问题
    bind(TYPES.GraphService)
      .to(GraphServiceNewAdapter)
      .inSingletonScope();
  } catch (error: any) {
    console.error('Error creating GraphModule:', error);
    console.error('Error stack:', error?.stack);
    throw error;
  }
});