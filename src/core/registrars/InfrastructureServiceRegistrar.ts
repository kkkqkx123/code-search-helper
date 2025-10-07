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

// 性能监控服务
import { PerformanceDashboard } from '../../service/monitoring/PerformanceDashboard';
import { AutoOptimizationAdvisor } from '../../service/optimization/AutoOptimizationAdvisor';
import { BatchProcessingOptimizer } from '../../service/optimization/BatchProcessingOptimizer';

// 基础设施配置服务
import { InfrastructureConfigService } from '../../infrastructure/config/InfrastructureConfigService';

// 向量批处理优化器
import { VectorBatchOptimizer } from '../../infrastructure/batching/VectorBatchOptimizer';

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
    
    // 性能监控和优化服务
    container.bind<PerformanceDashboard>(TYPES.PerformanceDashboard).to(PerformanceDashboard).inSingletonScope();
    container.bind<AutoOptimizationAdvisor>(TYPES.AutoOptimizationAdvisor).to(AutoOptimizationAdvisor).inSingletonScope();
    container.bind<BatchProcessingOptimizer>(TYPES.BatchProcessingOptimizer).to(BatchProcessingOptimizer).inSingletonScope();
    
    // 基础设施配置服务
    container.bind<InfrastructureConfigService>(TYPES.InfrastructureConfigService)
      .to(InfrastructureConfigService).inSingletonScope();
    
    // 向量批处理优化器
    container.bind<VectorBatchOptimizer>(TYPES.VectorBatchOptimizer)
      .to(VectorBatchOptimizer).inSingletonScope();
  }
}