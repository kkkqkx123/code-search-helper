import { Container } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';

// 图服务基础设施
import { GraphCacheService } from '../../service/graph/cache/GraphCacheService';
import { GraphPerformanceMonitor } from '../../service/graph/performance/GraphPerformanceMonitor';
import { GraphBatchOptimizer } from '../../service/graph/performance/GraphBatchOptimizer';
import { GraphQueryValidator } from '../../service/graph/validation/GraphQueryValidator';

// 高级映射服务
import { AdvancedMappingService as SemanticRelationshipExtractor } from '../../service/mapping/SemanticRelationshipExtractor';

// 基础设施配置服务
import { InfrastructureConfigService } from '../../infrastructure/config/InfrastructureConfigService';

export class InfrastructureServiceRegistrar {
  static register(container: Container): void {
    // 基础设施服务
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    
    // 图服务基础设施
    container.bind<GraphCacheService>(TYPES.GraphCacheService).to(GraphCacheService).inSingletonScope();
    container.bind<GraphPerformanceMonitor>(TYPES.GraphPerformanceMonitor).to(GraphPerformanceMonitor).inSingletonScope();
    container.bind<GraphBatchOptimizer>(TYPES.GraphBatchOptimizer).to(GraphBatchOptimizer).inSingletonScope();
    container.bind<GraphQueryValidator>(TYPES.GraphQueryValidator).to(GraphQueryValidator).inSingletonScope();
    
    // 高级映射服务
    container.bind<SemanticRelationshipExtractor>(TYPES.AdvancedMappingService).to(SemanticRelationshipExtractor).inSingletonScope();
    
    // 基础设施配置服务
    container.bind<InfrastructureConfigService>(TYPES.InfrastructureConfigService)
      .to(InfrastructureConfigService).inSingletonScope();
  }
}