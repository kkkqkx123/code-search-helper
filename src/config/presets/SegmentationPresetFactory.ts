import { SegmentationConfig, SegmentationMode } from '../ConfigTypes';

/**
 * 分段配置预设工厂
 * 负责根据不同模式创建分段配置对象
 */
export class SegmentationPresetFactory {
  /**
   * 根据模式创建配置
   * @param mode 配置模式
   * @returns 分段配置对象
   */
  static create(mode: SegmentationMode): SegmentationConfig {
    switch (mode) {
      case SegmentationMode.HIGH_PERFORMANCE:
        return this.createHighPerformanceConfig();
      case SegmentationMode.HIGH_QUALITY:
        return this.createHighQualityConfig();
      default:
        return this.createDefaultConfig();
    }
  }

  /**
   * 创建默认配置
   * 平衡性能和质量
   */
  private static createDefaultConfig(): SegmentationConfig {
    return {
      global: {
        minChunkSize: 50,
        maxChunkSize: 2000,
        chunkOverlap: 200,
        minLinesPerChunk: 1,
        maxLinesPerChunk: 50,
      },
      performance: {
        maxFileSize: 1024 * 1024, // 1MB
        maxParseTime: 5000, // 5秒
        enableCaching: true,
        maxCacheSize: 1000,
        enableParallel: true,
        parallelThreads: 4,
      },
      nesting: {
        enableNestedExtraction: true,
        maxNestingLevel: 10,
      },
      fallback: {
        enableFallback: true,
        fallbackThreshold: 0.5,
        strategies: ['line-based', 'bracket-balancing'],
      },
      languageSpecific: {
        typescript: {
          maxChunkSize: 2000,
          minChunkSize: 200,
          maxNestingLevel: 15,
          preserveComments: true,
          preserveEmptyLines: false,
        },
        javascript: {
          maxChunkSize: 2000,
          minChunkSize: 200,
          maxNestingLevel: 15,
          preserveComments: true,
          preserveEmptyLines: false,
        },
        python: {
          maxChunkSize: 1500,
          minChunkSize: 150,
          maxNestingLevel: 12,
          preserveComments: true,
          preserveEmptyLines: false,
        },
        java: {
          maxChunkSize: 2500,
          minChunkSize: 250,
          maxNestingLevel: 10,
          preserveComments: true,
          preserveEmptyLines: false,
        },
        go: {
          maxChunkSize: 1800,
          minChunkSize: 180,
          maxNestingLevel: 8,
          preserveComments: true,
          preserveEmptyLines: false,
        },
        rust: {
          maxChunkSize: 2000,
          minChunkSize: 200,
          maxNestingLevel: 10,
          preserveComments: true,
          preserveEmptyLines: false,
        },
        cpp: {
          maxChunkSize: 2100,
          minChunkSize: 210,
          maxNestingLevel: 10,
          preserveComments: true,
          preserveEmptyLines: false,
        },
        csharp: {
          maxChunkSize: 2200,
          minChunkSize: 220,
          maxNestingLevel: 10,
          preserveComments: true,
          preserveEmptyLines: false,
        },
      },
    };
  }

  /**
   * 创建高性能配置
   * 优化处理速度，减少资源消耗
   */
  private static createHighPerformanceConfig(): SegmentationConfig {
    const config = this.createDefaultConfig();
    
    // 优化性能设置
    config.performance.enableCaching = true;
    config.performance.maxCacheSize = 2000;
    config.performance.enableParallel = true;
    config.performance.parallelThreads = 8;
    config.performance.maxParseTime = 3000; // 减少解析时间
    
    // 调整分段设置以提高速度
    config.global.maxChunkSize = 3000; // 增大分段以减少分段数量
    config.global.chunkOverlap = 100; // 减少重叠
    
    // 禁用嵌套提取以提高速度
    config.nesting.enableNestedExtraction = false;
    config.nesting.maxNestingLevel = 3;
    
    // 调整降级策略
    config.fallback.fallbackThreshold = 0.3; // 更早降级
    config.fallback.strategies = ['line-based']; // 使用最快的降级策略
    
    // 调整语言特定配置
    Object.keys(config.languageSpecific).forEach(lang => {
      const langConfig = config.languageSpecific[lang];
      langConfig.maxChunkSize *= 1.5;
      langConfig.maxNestingLevel = Math.min(langConfig.maxNestingLevel, 5);
      langConfig.preserveComments = false; // 不保留注释以提高速度
    });
    
    return config;
  }

  /**
   * 创建高质量配置
   * 优化分段质量，可能牺牲一些性能
   */
  private static createHighQualityConfig(): SegmentationConfig {
    const config = this.createDefaultConfig();
    
    // 调整性能设置以提高质量
    config.performance.maxParseTime = 10000; // 增加解析时间
    config.performance.maxCacheSize = 500; // 减少缓存以节省内存
    config.performance.parallelThreads = 2; // 减少并行以避免资源竞争
    
    // 调整分段设置以提高质量
    config.global.maxChunkSize = 1500; // 减小分段以提高精度
    config.global.chunkOverlap = 300; // 增加重叠以保留更多上下文
    
    // 启用嵌套提取
    config.nesting.enableNestedExtraction = true;
    config.nesting.maxNestingLevel = 15;
    
    // 调整降级策略
    config.fallback.fallbackThreshold = 0.7; // 更晚降级
    config.fallback.strategies = ['bracket-balancing', 'semantic-aware', 'line-based'];
    
    // 调整语言特定配置
    Object.keys(config.languageSpecific).forEach(lang => {
      const langConfig = config.languageSpecific[lang];
      langConfig.maxChunkSize *= 0.8;
      langConfig.maxNestingLevel = Math.max(langConfig.maxNestingLevel, 12);
      langConfig.preserveComments = true; // 保留注释
      langConfig.preserveEmptyLines = true; // 保留空行
    });
    
    return config;
  }
}