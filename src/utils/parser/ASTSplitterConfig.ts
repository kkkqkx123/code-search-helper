/**
 * AST分割器配置接口
 * 定义了ASTCodeSplitter的所有配置选项
 */

import { LanguageSpecificConfig, NestingConfig } from './ConfigurationManager';

/**
 * 降级策略枚举
 */
export enum FallbackStrategy {
  LINE_BASED = 'line-based',
  BRACKET_BALANCING = 'bracket-balancing',
  SEMANTIC_BOUNDARY = 'semantic-boundary',
  SIMPLE_SPLIT = 'simple-split'
}

/**
 * 性能配置接口
 */
export interface PerformanceConfig {
  /** 是否启用缓存 */
  enableCaching?: boolean;
  /** 最大缓存大小 */
  maxCacheSize?: number;
  /** 是否启用并行处理 */
  enableParallelProcessing?: boolean;
  /** 最大并发数 */
  maxConcurrency?: number;
  /** 超时时间（毫秒） */
  timeout?: number;
  /** 内存限制（MB） */
  memoryLimit?: number;
}

/**
 * 提取配置接口
 */
export interface ExtractionConfig {
  /** 提取的结构类型 */
  structureTypes?: string[];
  /** 最小结构大小 */
  minStructureSize?: number;
  /** 最大结构大小 */
  maxStructureSize?: number;
  /** 是否提取注释 */
  extractComments?: boolean;
  /** 是否提取文档字符串 */
  extractDocstrings?: boolean;
  /** 是否提取类型定义 */
  extractTypeDefinitions?: boolean;
}

/**
 * 验证配置接口
 */
export interface ValidationConfig {
  /** 是否启用验证 */
  enableValidation?: boolean;
  /** 严格模式 */
  strictMode?: boolean;
  /** 自定义验证规则 */
  customRules?: Array<{
    name: string;
    pattern: RegExp;
    action: 'include' | 'exclude';
  }>;
}

/**
 * AST分割器配置接口
 */
export interface ASTSplitterConfig {
  // 基础大小限制（调整后的合理值）
  maxFunctionSize?: number;        // 函数最大字符数
  maxClassSize?: number;           // 类最大字符数
  maxNamespaceSize?: number;       // 命名空间最大字符数
  minFunctionLines?: number;       // 函数最小行数
  minClassLines?: number;          // 类最小行数
  maxChunkSize?: number;           // 通用代码块最大大小
  minChunkSize?: number;           // 通用代码块最小大小
  
  // 嵌套提取控制
  enableNestedExtraction?: boolean;     // 是否启用嵌套提取
  maxNestingLevel?: number;             // 最大嵌套层级
  preserveNestedMethods?: boolean;      // 是否保留嵌套方法的完整实现
  preserveNestedFunctions?: boolean;    // 是否保留嵌套函数的完整实现
  preserveNestedClasses?: boolean;      // 是否保留嵌套类的完整实现
  
  // 语义边界控制
  preferSemanticBoundaries?: boolean;   // 是否优先语义边界
  extractImports?: boolean;             // 是否提取导入语句
  extractNamespaces?: boolean;          // 是否提取命名空间
  extractTemplates?: boolean;           // 是否提取模板声明
  
  // 降级策略
  fallbackStrategies?: FallbackStrategy[]; // 降级策略顺序
  enableFallback?: boolean;             // 是否启用降级
  fallbackThreshold?: number;           // 降级阈值
  
  // 性能配置
  performance?: PerformanceConfig;
  
  // 提取配置
  extraction?: ExtractionConfig;
  
  // 验证配置
  validation?: ValidationConfig;
  
  // 语言特定配置
  languageSpecific?: LanguageSpecificConfig;
  
  // 高级选项
  advanced?: {
    /** 是否启用实验性功能 */
    enableExperimental?: boolean;
    /** 调试模式 */
    debugMode?: boolean;
    /** 日志级别 */
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    /** 自定义处理器 */
    customProcessors?: Array<{
      name: string;
      priority: number;
      processor: (content: string, language: string) => any[];
    }>;
  };
}

/**
 * 默认配置工厂
 */
export class ASTSplitterConfigFactory {
  /**
   * 创建默认配置
   */
  static createDefault(): ASTSplitterConfig {
    return {
      // 基础大小限制（调整后的合理值）
      maxFunctionSize: 1000,
      maxClassSize: 2000,
      maxNamespaceSize: 3000,
      minFunctionLines: 3,
      minClassLines: 2,
      maxChunkSize: 1500,
      minChunkSize: 50,
      
      // 嵌套提取控制
      enableNestedExtraction: true,
      maxNestingLevel: 2,
      preserveNestedMethods: true,
      preserveNestedFunctions: false,
      preserveNestedClasses: false,
      
      // 语义边界控制
      preferSemanticBoundaries: true,
      extractImports: true,
      extractNamespaces: true,
      extractTemplates: true,
      
      // 降级策略
      fallbackStrategies: [
        FallbackStrategy.LINE_BASED,
        FallbackStrategy.BRACKET_BALANCING
      ],
      enableFallback: true,
      fallbackThreshold: 0.5,
      
      // 性能配置
      performance: {
        enableCaching: true,
        maxCacheSize: 1000,
        enableParallelProcessing: true,
        maxConcurrency: 4,
        timeout: 30000,
        memoryLimit: 512
      },
      
      // 提取配置
      extraction: {
        structureTypes: ['function', 'class', 'namespace', 'import', 'template'],
        minStructureSize: 10,
        maxStructureSize: 5000,
        extractComments: false,
        extractDocstrings: true,
        extractTypeDefinitions: true
      },
      
      // 验证配置
      validation: {
        enableValidation: true,
        strictMode: false,
        customRules: []
      },
      
      // 高级选项
      advanced: {
        enableExperimental: false,
        debugMode: false,
        logLevel: 'info',
        customProcessors: []
      }
    };
  }

  /**
   * 创建高性能配置
   */
  static createHighPerformance(): ASTSplitterConfig {
    const config = this.createDefault();
    
    // 优化性能设置
    if (config.performance) {
      config.performance.enableCaching = true;
      config.performance.maxCacheSize = 2000;
      config.performance.enableParallelProcessing = true;
      config.performance.maxConcurrency = 8;
      config.performance.timeout = 15000;
    }
    
    // 禁用一些耗时功能
    if (config.extraction) {
      config.extraction.extractComments = false;
      config.extraction.extractDocstrings = false;
    }
    
    if (config.validation) {
      config.validation.strictMode = false;
    }
    
    return config;
  }

  /**
   * 创建高质量配置
   */
  static createHighQuality(): ASTSplitterConfig {
    const config = this.createDefault();
    
    // 启用所有提取功能
    if (config.extraction) {
      config.extraction.extractComments = true;
      config.extraction.extractDocstrings = true;
      config.extraction.extractTypeDefinitions = true;
    }
    
    // 启用严格验证
    if (config.validation) {
      config.validation.strictMode = true;
    }
    
    // 启用嵌套提取
    config.enableNestedExtraction = true;
    config.maxNestingLevel = 3;
    config.preserveNestedMethods = true;
    config.preserveNestedFunctions = true;
    config.preserveNestedClasses = true;
    
    return config;
  }

  /**
   * 创建语言特定配置
   */
  static createForLanguage(language: string): ASTSplitterConfig {
    const config = this.createDefault();
    
    // 根据语言调整配置
    switch (language.toLowerCase()) {
      case 'python':
        config.maxFunctionSize = 800;
        config.maxClassSize = 1500;
        config.extraction!.structureTypes = ['function', 'class', 'import'];
        break;
        
      case 'javascript':
      case 'typescript':
        config.maxFunctionSize = 600;
        config.maxClassSize = 1200;
        config.extraction!.structureTypes = ['function', 'class', 'import', 'export'];
        break;
        
      case 'cpp':
        config.maxNamespaceSize = 4000;
        config.extraction!.structureTypes = ['function', 'class', 'namespace', 'template', 'import'];
        break;
        
      case 'java':
        config.maxClassSize = 2500;
        config.extraction!.structureTypes = ['class', 'method', 'import', 'package'];
        break;
        
      case 'go':
        config.maxFunctionSize = 700;
        config.extraction!.structureTypes = ['function', 'struct', 'interface', 'import'];
        break;
    }
    
    return config;
  }

  /**
   * 合并配置
   */
  static merge(baseConfig: ASTSplitterConfig, userConfig: Partial<ASTSplitterConfig>): ASTSplitterConfig {
    const result = { ...baseConfig };
    
    for (const [key, value] of Object.entries(userConfig)) {
      if (value === undefined) continue;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // 递归合并对象
        if (typeof result[key as keyof ASTSplitterConfig] === 'object' && 
            result[key as keyof ASTSplitterConfig] !== null && 
            !Array.isArray(result[key as keyof ASTSplitterConfig])) {
          result[key as keyof ASTSplitterConfig] = {
            ...result[key as keyof ASTSplitterConfig] as any,
            ...value
          };
        } else {
          result[key as keyof ASTSplitterConfig] = value as any;
        }
      } else {
        // 直接赋值
        result[key as keyof ASTSplitterConfig] = value as any;
      }
    }
    
    return result;
  }

  /**
   * 验证配置
   */
  static validate(config: ASTSplitterConfig): {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 验证基础配置
    if (config.maxFunctionSize && config.maxFunctionSize < 100) {
      errors.push('maxFunctionSize should be at least 100');
    }
    
    if (config.maxClassSize && config.maxClassSize < 200) {
      errors.push('maxClassSize should be at least 200');
    }
    
    if (config.minFunctionLines && config.minFunctionLines < 1) {
      errors.push('minFunctionLines should be at least 1');
    }
    
    if (config.minClassLines && config.minClassLines < 1) {
      errors.push('minClassLines should be at least 1');
    }
    
    if (config.maxChunkSize && config.minChunkSize && config.maxChunkSize <= config.minChunkSize) {
      errors.push('maxChunkSize should be greater than minChunkSize');
    }

    // 验证嵌套配置
    if (config.enableNestedExtraction && config.maxNestingLevel && config.maxNestingLevel < 1) {
      errors.push('maxNestingLevel should be at least 1 when nested extraction is enabled');
    }
    
    if (config.maxNestingLevel && config.maxNestingLevel > 5) {
      warnings.push('maxNestingLevel greater than 5 may cause performance issues');
    }

    // 验证性能配置
    if (config.performance) {
      if (config.performance.maxConcurrency && config.performance.maxConcurrency < 1) {
        errors.push('maxConcurrency should be at least 1');
      }
      
      if (config.performance.maxConcurrency && config.performance.maxConcurrency > 16) {
        warnings.push('maxConcurrency greater than 16 may cause system overload');
      }
      
      if (config.performance.memoryLimit && config.performance.memoryLimit < 64) {
        warnings.push('memoryLimit less than 64MB may be insufficient for large files');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}