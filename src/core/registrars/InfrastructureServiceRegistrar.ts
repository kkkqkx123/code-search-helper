import { Container } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';

// 图服务基础设施
import { GraphCacheService } from '../../service/graph/cache/GraphCacheService';
import { GraphPerformanceMonitor } from '../../service/graph/performance/GraphPerformanceMonitor';
import { GraphQueryValidator } from '../../service/graph/validation/GraphQueryValidator';

// 高级映射服务
import { AdvancedMappingService as SemanticRelationshipExtractor } from '../../service/mapping/SemanticRelationshipExtractor';

// 性能监控服务
import { PerformanceDashboard } from '../../service/monitoring/PerformanceDashboard';
import { PerformanceMetricsCollector } from '../../service/monitoring/PerformanceMetricsCollector';
import { TransactionLogger } from '../../service/transaction/TransactionLogger';
import { AutoOptimizationAdvisor } from '../../service/optimization/AutoOptimizationAdvisor';
import { BatchProcessingOptimizer } from '../../service/optimization/BatchProcessingOptimizer';
import { GraphBatchOptimizer } from '../../service/batching/GraphBatchOptimizer';
import { GraphMappingCache } from '../../service/caching/GraphMappingCache';

// 基础设施配置服务
import { InfrastructureConfigService } from '../../infrastructure/config/InfrastructureConfigService';

// 向量批处理优化器
import { VectorBatchOptimizer } from '../../infrastructure/batching/VectorBatchOptimizer';

export class InfrastructureServiceRegistrar {
  static register(container: Container): void {
    try {
      // 基础设施服务
      container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
      container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();

      // 图服务基础设施
      container.bind<GraphCacheService>(TYPES.GraphCacheService).to(GraphCacheService).inSingletonScope();
      container.bind<GraphPerformanceMonitor>(TYPES.GraphPerformanceMonitor).to(GraphPerformanceMonitor).inSingletonScope();
      container.bind<GraphQueryValidator>(TYPES.GraphQueryValidator).to(GraphQueryValidator).inSingletonScope();

      // 高级映射服务
      container.bind<SemanticRelationshipExtractor>(TYPES.AdvancedMappingService).to(SemanticRelationshipExtractor).inSingletonScope();
      container.bind<GraphMappingCache>(TYPES.GraphMappingCache).to(GraphMappingCache).inSingletonScope();

      // 性能监控和优化服务
      console.log('Binding PerformanceDashboard...');
      container.bind<PerformanceDashboard>(TYPES.PerformanceDashboard).to(PerformanceDashboard).inSingletonScope();
      console.log('PerformanceDashboard bound');

      console.log('Binding TransactionLogger...');
      container.bind<TransactionLogger>(TYPES.TransactionLogger).to(TransactionLogger).inSingletonScope();
      console.log('TransactionLogger bound');

      console.log('Attempting to bind PerformanceMetricsCollector...');
      try {
        // Disable auto-collection in test environment to prevent open handles
        const isTestEnvironment = process.env.NODE_ENV === 'test';
        const options = isTestEnvironment ? { enableAutoCollection: false } : {};

        container.bind<PerformanceMetricsCollector>(TYPES.PerformanceMetricsCollector).toConstantValue(
          new PerformanceMetricsCollector(
            container.get<LoggerService>(TYPES.LoggerService),
            container.get<PerformanceDashboard>(TYPES.PerformanceDashboard),
            container.get<TransactionLogger>(TYPES.TransactionLogger),
            container.get<GraphMappingCache>(TYPES.GraphMappingCache),
            options
          )
        );
        console.log('PerformanceMetricsCollector bound');
      } catch (error: any) {
        console.error('Error binding PerformanceMetricsCollector:', error);
        console.error('Error stack:', error?.stack);
        throw error;
      }

      console.log('Attempting to bind GraphBatchOptimizer...');
      try {
        container.bind<GraphBatchOptimizer>(TYPES.GraphBatchOptimizer).toConstantValue(
          new GraphBatchOptimizer(
            container.get<LoggerService>(TYPES.LoggerService),
            {} // 默认选项
          )
        );
        console.log('GraphBatchOptimizer bound');
      } catch (error: any) {
        console.error('Error binding GraphBatchOptimizer:', error);
        console.error('Error stack:', error?.stack);
        throw error;
      }

      console.log('Attempting to bind AutoOptimizationAdvisor...');
      try {
        container.bind<AutoOptimizationAdvisor>(TYPES.AutoOptimizationAdvisor).toConstantValue(
          new AutoOptimizationAdvisor(
            container.get<LoggerService>(TYPES.LoggerService),
            container.get<PerformanceDashboard>(TYPES.PerformanceDashboard),
            container.get<PerformanceMetricsCollector>(TYPES.PerformanceMetricsCollector),
            container.get<GraphBatchOptimizer>(TYPES.GraphBatchOptimizer),
            container.get<GraphMappingCache>(TYPES.GraphMappingCache),
            {} // 默认选项
          )
        );
        console.log('AutoOptimizationAdvisor bound');
      } catch (error: any) {
        console.error('Error binding AutoOptimizationAdvisor:', error);
        console.error('Error stack:', error?.stack);
        throw error;
      }
      // container.bind<BatchProcessingOptimizer>(TYPES.BatchProcessingOptimizer).to(BatchProcessingOptimizer).inSingletonScope();

      // 基础设施配置服务
      container.bind<InfrastructureConfigService>(TYPES.InfrastructureConfigService)
        .to(InfrastructureConfigService).inSingletonScope();

      // 向量批处理优化器
      container.bind<VectorBatchOptimizer>(TYPES.VectorBatchOptimizer)
        .to(VectorBatchOptimizer).inSingletonScope();
    } catch (error: any) {
      console.error('Error registering infrastructure services:', error);
      console.error('Error stack:', error?.stack);
      throw error;
    }
  }
}