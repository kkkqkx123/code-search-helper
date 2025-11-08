/**
 * 配置管理器
 * 统一配置管理逻辑，支持语言特定配置和嵌套配置
 */

/**
 * 配置模式接口
 */
export interface ConfigSchema<T> {
  /** 必需字段 */
  required: (keyof T)[];
  /** 可选字段及其默认值 */
  optional?: Partial<T>;
  /** 验证函数 */
  validators?: {
    [K in keyof T]?: (value: T[K]) => boolean | string;
  };
  /** 类型定义 */
  types?: {
    [K in keyof T]?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  };
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误消息 */
  errors?: string[];
  /** 警告消息 */
  warnings?: string[];
}

/**
 * 语言特定配置接口
 */
export interface LanguageSpecificConfig {
  /** C++配置 */
  cpp?: {
    extractTemplates?: boolean;
    extractPreprocessor?: boolean;
    maxTemplateDepth?: number;
    extractNamespaces?: boolean;
    extractClasses?: boolean;
    extractFunctions?: boolean;
  };
  /** Python配置 */
  python?: {
    extractDecorators?: boolean;
    extractAsyncFunctions?: boolean;
    extractComprehensions?: boolean;
    extractClasses?: boolean;
    extractFunctions?: boolean;
    extractImports?: boolean;
  };
  /** JavaScript配置 */
  javascript?: {
    extractJSX?: boolean;
    extractClosures?: boolean;
    extractPrototypes?: boolean;
    extractClasses?: boolean;
    extractFunctions?: boolean;
    extractImports?: boolean;
  };
  /** Java配置 */
  java?: {
    extractAnnotations?: boolean;
    extractGenerics?: boolean;
    extractPackages?: boolean;
    extractClasses?: boolean;
    extractMethods?: boolean;
    extractImports?: boolean;
  };
  /** Go配置 */
  go?: {
    extractInterfaces?: boolean;
    extractGoroutines?: boolean;
    extractChannels?: boolean;
    extractStructs?: boolean;
    extractFunctions?: boolean;
    extractImports?: boolean;
  };
}

/**
 * 嵌套配置接口
 */
export interface NestingConfig {
  /** 是否启用嵌套提取 */
  enableNestedExtraction?: boolean;
  /** 最大嵌套级别 */
  maxNestingLevel?: number;
  /** 保留嵌套方法的完整实现 */
  preserveNestedMethods?: boolean;
  /** 保留嵌套函数的完整实现 */
  preserveNestedFunctions?: boolean;
  /** 保留嵌套类的完整实现 */
  preserveNestedClasses?: boolean;
  /** 嵌套结构最小大小 */
  minNestedSize?: number;
  /** 嵌套结构最大大小 */
  maxNestedSize?: number;
}

/**
 * AST分割器配置接口
 */
export interface ASTSplitterConfig {
  // 基础大小限制
  maxFunctionSize?: number;
  maxClassSize?: number;
  maxNamespaceSize?: number;
  minFunctionLines?: number;
  minClassLines?: number;
  maxChunkSize?: number;
  minChunkSize?: number;
  
  // 嵌套提取控制
  enableNestedExtraction?: boolean;
  maxNestingLevel?: number;
  preserveNestedMethods?: boolean;
  preserveNestedFunctions?: boolean;
  preserveNestedClasses?: boolean;
  
  // 语义边界控制
  preferSemanticBoundaries?: boolean;
  extractImports?: boolean;
  extractNamespaces?: boolean;
  extractTemplates?: boolean;
  
  // 降级策略
  fallbackStrategies?: string[];
  enableFallback?: boolean;
  
  // 性能配置
  enableCaching?: boolean;
  maxCacheSize?: number;
  enableParallelProcessing?: boolean;
  maxConcurrency?: number;
  
  // 语言特定配置
  languageSpecific?: LanguageSpecificConfig;
}

/**
 * 配置管理器类
 */
export class ConfigurationManager {
  /**
   * 合并配置
   */
  static mergeConfig<T extends object>(defaultConfig: T, userConfig: Partial<T>): T {
    const result = { ...defaultConfig };
    
    for (const key in userConfig) {
      const userValue = userConfig[key];
      const defaultValue = result[key];
      
      if (userValue === undefined) continue;
      
      if (typeof userValue === 'object' && userValue !== null && !Array.isArray(userValue)) {
        // 递归合并对象
        if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)) {
          result[key] = this.mergeConfig(defaultValue, userValue) as any;
        } else {
          result[key] = userValue as any;
        }
      } else {
        // 直接赋值
        result[key] = userValue as any;
      }
    }
    
    return result;
  }

  /**
   * 验证配置
   */
  static validateConfig<T extends object>(config: T, schema: ConfigSchema<T>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查必需字段
    for (const requiredField of schema.required) {
      if (!(requiredField in config) || config[requiredField] === undefined) {
        errors.push(`Required field '${String(requiredField)}' is missing`);
      }
    }

    // 检查字段类型
    if (schema.types) {
      for (const [field, expectedType] of Object.entries(schema.types)) {
        const value = config[field as keyof T];
        if (value !== undefined && !this.checkType(value as any, expectedType as string)) {
          errors.push(`Field '${field}' should be of type '${expectedType}', got '${typeof value}'`);
        }
      }
    }

    // 运行自定义验证器
    if (schema.validators) {
      for (const [field, validator] of Object.entries(schema.validators)) {
        const value = config[field as keyof T];
        if (value !== undefined) {
          const result = (validator as (value: any) => boolean | string)(value);
          if (result === false) {
            errors.push(`Field '${field}' validation failed`);
          } else if (typeof result === 'string') {
            errors.push(`Field '${field}': ${result}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * 创建配置代理
   */
  static createConfigProxy<T extends object>(config: T, onChange?: (config: T) => void): T {
    return new Proxy(config, {
      set(target, property, value) {
        const oldValue = target[property as keyof T];
        target[property as keyof T] = value;
        
        if (onChange && oldValue !== value) {
          onChange(target);
        }
        
        return true;
      }
    });
  }

  /**
   * 获取语言特定配置
   */
  static getLanguageSpecificConfig(language: string): Partial<LanguageSpecificConfig> {
    const defaultConfigs: LanguageSpecificConfig = {
      cpp: {
        extractTemplates: true,
        extractPreprocessor: true,
        maxTemplateDepth: 3,
        extractNamespaces: true,
        extractClasses: true,
        extractFunctions: true
      },
      python: {
        extractDecorators: true,
        extractAsyncFunctions: true,
        extractComprehensions: true,
        extractClasses: true,
        extractFunctions: true,
        extractImports: true
      },
      javascript: {
        extractJSX: true,
        extractClosures: true,
        extractPrototypes: true,
        extractClasses: true,
        extractFunctions: true,
        extractImports: true
      },
      java: {
        extractAnnotations: true,
        extractGenerics: true,
        extractPackages: true,
        extractClasses: true,
        extractMethods: true,
        extractImports: true
      },
      go: {
        extractInterfaces: true,
        extractGoroutines: true,
        extractChannels: true,
        extractStructs: true,
        extractFunctions: true,
        extractImports: true
      }
    };

    return (defaultConfigs[language as keyof LanguageSpecificConfig] || {}) as Partial<LanguageSpecificConfig>;
  }

  /**
   * 合并语言配置
   */
  static mergeLanguageConfig(
    baseConfig: ASTSplitterConfig, 
    langConfig: LanguageSpecificConfig
  ): ASTSplitterConfig {
    const result = { ...baseConfig };
    
    if (!result.languageSpecific) {
      result.languageSpecific = {};
    }

    // 合并语言特定配置
    for (const [language, config] of Object.entries(langConfig)) {
      if (config) {
        result.languageSpecific[language as keyof LanguageSpecificConfig] = {
          ...result.languageSpecific[language as keyof LanguageSpecificConfig],
          ...config
        };
      }
    }

    return result;
  }

  /**
   * 验证嵌套配置
   */
  static validateNestingConfig(config: NestingConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (config.enableNestedExtraction && config.maxNestingLevel !== undefined) {
      if (config.maxNestingLevel < 1) {
        errors.push('maxNestingLevel must be at least 1 when nested extraction is enabled');
      }
      
      if (config.maxNestingLevel > 5) {
        warnings.push('maxNestingLevel greater than 5 may cause performance issues');
      }
    }

    if (config.minNestedSize !== undefined && config.maxNestedSize !== undefined) {
      if (config.minNestedSize > config.maxNestedSize) {
        errors.push('minNestedSize cannot be greater than maxNestedSize');
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * 创建默认AST分割器配置
   */
  static createDefaultASTSplitterConfig(): ASTSplitterConfig {
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
      fallbackStrategies: ['line-based', 'bracket-balancing'],
      enableFallback: true,
      
      // 性能配置
      enableCaching: true,
      maxCacheSize: 1000,
      enableParallelProcessing: true,
      maxConcurrency: 4
    };
  }

  /**
   * 优化配置
   */
  static optimizeConfig(config: ASTSplitterConfig, language: string): ASTSplitterConfig {
    const optimized = { ...config };
    const langConfig = this.getLanguageSpecificConfig(language);

    // 应用语言特定优化
    if (langConfig[language as keyof LanguageSpecificConfig]) {
      optimized.languageSpecific = this.mergeLanguageConfig(
        optimized,
        { [language]: langConfig[language as keyof LanguageSpecificConfig] }
      ).languageSpecific;
    }

    // 根据语言调整大小限制
    switch (language) {
      case 'python':
        optimized.maxFunctionSize = Math.min(optimized.maxFunctionSize || 1000, 800);
        optimized.maxClassSize = Math.min(optimized.maxClassSize || 2000, 1500);
        break;
      case 'javascript':
        optimized.maxFunctionSize = Math.min(optimized.maxFunctionSize || 1000, 600);
        optimized.maxClassSize = Math.min(optimized.maxClassSize || 2000, 1200);
        break;
      case 'cpp':
        optimized.maxNamespaceSize = Math.max(optimized.maxNamespaceSize || 3000, 4000);
        break;
    }

    return optimized;
  }

  /**
   * 序列化配置
   */
  static serializeConfig<T extends object>(config: T): string {
    return JSON.stringify(config, null, 2);
  }

  /**
   * 反序列化配置
   */
  static deserializeConfig<T extends object>(serialized: string): T {
    try {
      return JSON.parse(serialized);
    } catch (error) {
      throw new Error(`Failed to deserialize config: ${error}`);
    }
  }

  /**
   * 比较配置
   */
  static compareConfigs<T extends object>(config1: T, config2: T): {
    added: string[];
    removed: string[];
    modified: string[];
    unchanged: string[];
  } {
    const result = {
      added: [] as string[],
      removed: [] as string[],
      modified: [] as string[],
      unchanged: [] as string[]
    };

    const keys1 = new Set(Object.keys(config1));
    const keys2 = new Set(Object.keys(config2));

    // 查找添加的字段
    for (const key of keys2) {
      if (!keys1.has(key)) {
        result.added.push(key);
      }
    }

    // 查找删除的字段
    for (const key of keys1) {
      if (!keys2.has(key)) {
        result.removed.push(key);
      }
    }

    // 查找修改和未修改的字段
    for (const key of keys1) {
      if (keys2.has(key)) {
        const value1 = config1[key as keyof T];
        const value2 = config2[key as keyof T];
        
        if (JSON.stringify(value1) !== JSON.stringify(value2)) {
          result.modified.push(key);
        } else {
          result.unchanged.push(key);
        }
      }
    }

    return result;
  }

  /**
   * 创建配置模板
   */
  static createConfigTemplate(): ASTSplitterConfig {
    return {
      // 基础配置
      maxFunctionSize: 1000,
      maxClassSize: 2000,
      maxNamespaceSize: 3000,
      minFunctionLines: 3,
      minClassLines: 2,
      maxChunkSize: 1500,
      minChunkSize: 50,
      
      // 嵌套配置
      enableNestedExtraction: true,
      maxNestingLevel: 2,
      preserveNestedMethods: true,
      preserveNestedFunctions: false,
      preserveNestedClasses: false,
      
      // 语义配置
      preferSemanticBoundaries: true,
      extractImports: true,
      extractNamespaces: true,
      extractTemplates: true,
      
      // 降级配置
      fallbackStrategies: ['line-based', 'bracket-balancing'],
      enableFallback: true,
      
      // 性能配置
      enableCaching: true,
      maxCacheSize: 1000,
      enableParallelProcessing: true,
      maxConcurrency: 4,
      
      // 语言特定配置
      languageSpecific: {
        cpp: {
          extractTemplates: true,
          extractPreprocessor: true,
          maxTemplateDepth: 3
        },
        python: {
          extractDecorators: true,
          extractAsyncFunctions: true
        },
        javascript: {
          extractJSX: true,
          extractClosures: true
        }
      }
    };
  }

  // 私有辅助方法

  /**
   * 检查类型
   */
  private static checkType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }
}