import { Container } from 'inversify';
import { TYPES } from '../../types';
import { SimilarityService } from '../../service/similarity/SimilarityService';
import { SimilarityCacheManager } from '../../service/similarity/cache/SimilarityCacheManager';
import { SimilarityPerformanceMonitor } from '../../service/similarity/monitoring/SimilarityPerformanceMonitor';
import { SimilarityServiceInitializer } from '../../service/similarity/initializer/SimilarityServiceInitializer';

// 策略类
import { LevenshteinSimilarityStrategy } from '../../service/similarity/strategies/LevenshteinSimilarityStrategy';
import { SemanticSimilarityStrategy } from '../../service/similarity/strategies/SemanticSimilarityStrategy';
import { KeywordSimilarityStrategy } from '../../service/similarity/strategies/KeywordSimilarityStrategy';
import { HybridSimilarityStrategy } from '../../service/similarity/strategies/HybridSimilarityStrategy';

/**
 * 相似度服务注册器
 * 负责将所有相似度相关的服务注册到DI容器
 */
export class SimilarityServiceRegistrar {
  static register(container: Container): void {
    const logger = container.isBound(TYPES.LoggerService) 
      ? container.get(TYPES.LoggerService) 
      : undefined;

    try {
      logger?.info('Registering similarity services...');

      // 注册性能监控器
      container.bind<SimilarityPerformanceMonitor>(TYPES.SimilarityPerformanceMonitor)
        .to(SimilarityPerformanceMonitor)
        .inSingletonScope();

      // 注册缓存管理器
      container.bind<SimilarityCacheManager>(TYPES.SimilarityCacheManager)
        .toDynamicValue(context => {
          const logger = context.container.isBound(TYPES.LoggerService) 
            ? context.container.get(TYPES.LoggerService) 
            : undefined;
          
          // 从配置中获取缓存大小，如果没有则使用默认值
          const cacheSize = process.env.SIMILARITY_CACHE_SIZE 
            ? parseInt(process.env.SIMILARITY_CACHE_SIZE, 10) 
            : 1000;
          
          return new SimilarityCacheManager(logger, cacheSize);
        })
        .inSingletonScope();

      // 注册相似度策略
      container.bind<LevenshteinSimilarityStrategy>(LevenshteinSimilarityStrategy)
        .to(LevenshteinSimilarityStrategy)
        .inSingletonScope();

      container.bind<SemanticSimilarityStrategy>(SemanticSimilarityStrategy)
        .to(SemanticSimilarityStrategy)
        .inSingletonScope();

      container.bind<KeywordSimilarityStrategy>(KeywordSimilarityStrategy)
        .to(KeywordSimilarityStrategy)
        .inSingletonScope();

      container.bind<HybridSimilarityStrategy>(HybridSimilarityStrategy)
        .to(HybridSimilarityStrategy)
        .inSingletonScope();

      // 注册主相似度服务
      container.bind<SimilarityService>(TYPES.SimilarityService)
        .to(SimilarityService)
        .inSingletonScope();

      // 注册相似度服务初始化器
      container.bind<SimilarityServiceInitializer>(TYPES.SimilarityServiceInitializer)
        .to(SimilarityServiceInitializer)
        .inSingletonScope();

      logger?.info('Similarity services registered successfully');
    } catch (error) {
      logger?.error('Failed to register similarity services:', error);
      throw error;
    }
  }

  /**
   * 注册相似度服务到现有容器（用于动态注册）
   */
  static registerToExistingContainer(container: Container): void {
    // 检查是否已经注册
    if (container.isBound(TYPES.SimilarityService)) {
      console.warn('SimilarityService already registered, skipping...');
      return;
    }

    this.register(container);
  }

  /**
   * 获取相似度服务的依赖配置
   */
  static getDependencyConfig(): {
    services: Array<{
      symbol: symbol;
      implementation: any;
      scope: string;
    }>;
    optionalDependencies: symbol[];
  } {
    return {
      services: [
        {
          symbol: TYPES.SimilarityService,
          implementation: SimilarityService,
          scope: 'Singleton'
        },
        {
          symbol: TYPES.SimilarityCacheManager,
          implementation: SimilarityCacheManager,
          scope: 'Singleton'
        },
        {
          symbol: TYPES.SimilarityPerformanceMonitor,
          implementation: SimilarityPerformanceMonitor,
          scope: 'Singleton'
        },
        {
          symbol: TYPES.LevenshteinSimilarityStrategy,
          implementation: LevenshteinSimilarityStrategy,
          scope: 'Singleton'
        },
        {
          symbol: TYPES.SemanticSimilarityStrategy,
          implementation: SemanticSimilarityStrategy,
          scope: 'Singleton'
        },
        {
          symbol: TYPES.KeywordSimilarityStrategy,
          implementation: KeywordSimilarityStrategy,
          scope: 'Singleton'
        },
        {
          symbol: TYPES.HybridSimilarityStrategy,
          implementation: HybridSimilarityStrategy,
          scope: 'Singleton'
        },
        {
          symbol: TYPES.SimilarityServiceInitializer,
          implementation: SimilarityServiceInitializer,
          scope: 'Singleton'
        }
      ],
      optionalDependencies: [
        TYPES.LoggerService,
        TYPES.EmbedderFactory,
        TYPES.EmbeddingCacheService
      ]
    };
  }

  /**
   * 验证相似度服务的依赖是否满足
   */
  static validateDependencies(container: Container): {
    isValid: boolean;
    missingDependencies: symbol[];
    warnings: string[];
  } {
    const config = this.getDependencyConfig();
    const missingDependencies: symbol[] = [];
    const warnings: string[] = [];

    // 检查必需的依赖
    const requiredDependencies = [
      TYPES.EmbedderFactory,
      TYPES.EmbeddingCacheService
    ];

    requiredDependencies.forEach(dep => {
      if (!container.isBound(dep)) {
        missingDependencies.push(dep);
      }
    });

    // 检查可选依赖
    config.optionalDependencies.forEach(dep => {
      if (!container.isBound(dep)) {
        warnings.push(`Optional dependency not available: ${dep.toString()}`);
      }
    });

    return {
      isValid: missingDependencies.length === 0,
      missingDependencies,
      warnings
    };
  }

  /**
   * 获取相似度服务的配置选项
   */
  static getConfigurationOptions(): {
    cache: {
      maxSize: number;
      defaultTTL: number;
    };
    performance: {
      enableMonitoring: boolean;
      metricsRetentionTime: number;
    };
    strategies: {
      default: string;
      enabled: string[];
    };
  } {
    return {
      cache: {
        maxSize: parseInt(process.env.SIMILARITY_CACHE_SIZE || '1000', 10),
        defaultTTL: parseInt(process.env.SIMILARITY_CACHE_TTL || '300000', 10) // 5分钟
      },
      performance: {
        enableMonitoring: process.env.SIMILARITY_ENABLE_MONITORING !== 'false',
        metricsRetentionTime: parseInt(process.env.SIMILARITY_METRICS_RETENTION || '3600000', 10) // 1小时
      },
      strategies: {
        default: process.env.SIMILARITY_DEFAULT_STRATEGY || 'hybrid',
        enabled: (process.env.SIMILARITY_ENABLED_STRATEGIES || 'levenshtein,semantic,keyword,hybrid').split(',')
      }
    };
  }
}