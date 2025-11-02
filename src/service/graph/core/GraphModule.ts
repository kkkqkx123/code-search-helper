import { ContainerModule } from 'inversify';
import { TYPES } from '../../../types';
import { GraphAnalysisService } from './GraphAnalysisService';
import { GraphDataService } from './GraphDataService';
import { GraphSearchServiceNew } from './GraphSearchService';
import { IGraphSearchService } from './IGraphSearchService';
import { IGraphService } from './IGraphService';


// 导入基础设施服务实现
import { GraphCacheService } from '../../caching/GraphCacheService';
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

    // 绑定GraphService以解决依赖问题
    bind(TYPES.GraphService)
      .to(GraphSearchServiceNew)
      .inSingletonScope();
  } catch (error: any) {
    console.error('Error creating GraphModule:', error);
    console.error('Error stack:', error?.stack);
    throw error;
  }
});