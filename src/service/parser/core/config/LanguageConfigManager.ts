import { StrategyConfiguration } from '../strategy/ChunkingStrategy';

/**
 * 语言特定配置接口
 */
export interface LanguageConfiguration {
  /** 语言名称 */
  language: string;
  
  /** 文件扩展名 */
  fileExtensions: string[];
  
  /** 支持的分段类型 */
  chunkTypes: string[];
  
  /** 默认分段配置 */
  defaultChunkConfig: StrategyConfiguration;
  
  /** 语法规则 */
  syntaxRules: SyntaxRule[];
  
  /** 特殊处理规则 */
  specialRules: SpecialRule[];
  
  /** 性能优化配置 */
  performanceConfig: PerformanceConfig;
}

/**
 * 语法规则
 */
export interface SyntaxRule {
  /** 规则名称 */
  name: string;
  
  /** 规则描述 */
  description: string;
  
  /** 适用的节点类型 */
  nodeTypes: string[];
  
  /** 处理函数 */
  handler: string;
  
  /** 优先级 */
  priority: number;
}

/**
 * 特殊处理规则
 */
export interface SpecialRule {
  /** 规则名称 */
  name: string;
  
  /** 规则描述 */
  description: string;
  
  /** 匹配模式 */
  pattern: string | RegExp;
  
  /** 替换模式 */
  replacement: string;
  
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 性能配置
 */
export interface PerformanceConfig {
  /** 最大文件大小（字节） */
  maxFileSize: number;
  
  /** 最大解析时间（毫秒） */
  maxParseTime: number;
  
  /** 缓存大小 */
  cacheSize: number;
  
  /** 是否启用并行处理 */
  enableParallel: boolean;
  
  /** 并行处理线程数 */
  parallelThreads: number;
}

/**
 * 语言配置管理器
 */
export class LanguageConfigManager {
  private configs: Map<string, LanguageConfiguration> = new Map();
  private defaultConfig!: LanguageConfiguration;
  
  constructor() {
    this.initializeDefaultConfig();
    this.initializeLanguageConfigs();
  }
  
  /**
   * 初始化默认配置
   */
  private initializeDefaultConfig(): void {
    this.defaultConfig = {
      language: 'default',
      fileExtensions: [],
      chunkTypes: ['function', 'class', 'module'],
      defaultChunkConfig: {
        maxChunkSize: 2000,
        minChunkSize: 100,
        preserveComments: true,
        preserveEmptyLines: false,
        maxNestingLevel: 10
      },
      syntaxRules: [],
      specialRules: [],
      performanceConfig: {
        maxFileSize: 1024 * 1024, // 1MB
        maxParseTime: 5000, // 5秒
        cacheSize: 1000,
        enableParallel: true,
        parallelThreads: 4
      }
    };
  }
  
  /**
   * 初始化语言特定配置
   */
  private initializeLanguageConfigs(): void {
    // TypeScript 配置
    this.addLanguageConfig({
      language: 'typescript',
      fileExtensions: ['.ts', '.tsx'],
      chunkTypes: [
        'import_statement',
        'export_statement',
        'interface_declaration',
        'type_alias_declaration',
        'class_declaration',
        'function_declaration',
        'method_definition',
        'arrow_function',
        'variable_declaration'
      ],
      defaultChunkConfig: {
        maxChunkSize: 2000,
        minChunkSize: 200,
        preserveComments: true,
        preserveEmptyLines: false,
        maxNestingLevel: 15
      },
      syntaxRules: [
        {
          name: 'typescript_interface',
          description: '处理TypeScript接口声明',
          nodeTypes: ['interface_declaration'],
          handler: 'handleInterfaceDeclaration',
          priority: 1
        },
        {
          name: 'typescript_type_alias',
          description: '处理TypeScript类型别名',
          nodeTypes: ['type_alias_declaration'],
          handler: 'handleTypeAliasDeclaration',
          priority: 1
        },
        {
          name: 'typescript_decorator',
          description: '处理TypeScript装饰器',
          nodeTypes: ['decorator'],
          handler: 'handleDecorator',
          priority: 2
        }
      ],
      specialRules: [
        {
          name: 'typescript_generic',
          description: '处理泛型语法',
          pattern: /<[^>]+>/g,
          replacement: 'GENERIC',
          enabled: true
        }
      ],
      performanceConfig: {
        maxFileSize: 2 * 1024 * 1024, // 2MB
        maxParseTime: 8000, // 8秒
        cacheSize: 1500,
        enableParallel: true,
        parallelThreads: 4
      }
    });
    
    // JavaScript 配置
    this.addLanguageConfig({
      language: 'javascript',
      fileExtensions: ['.js', '.jsx'],
      chunkTypes: [
        'import_statement',
        'export_statement',
        'class_declaration',
        'function_declaration',
        'method_definition',
        'arrow_function',
        'variable_declaration'
      ],
      defaultChunkConfig: {
        maxChunkSize: 2000,
        minChunkSize: 200,
        preserveComments: true,
        preserveEmptyLines: false,
        maxNestingLevel: 15
      },
      syntaxRules: [
        {
          name: 'javascript_class',
          description: '处理JavaScript类声明',
          nodeTypes: ['class_declaration'],
          handler: 'handleClassDeclaration',
          priority: 1
        },
        {
          name: 'javascript_arrow_function',
          description: '处理箭头函数',
          nodeTypes: ['arrow_function'],
          handler: 'handleArrowFunction',
          priority: 1
        }
      ],
      specialRules: [
        {
          name: 'javascript_template_literal',
          description: '处理模板字面量',
          pattern: /`[^`]*`/g,
          replacement: 'TEMPLATE_LITERAL',
          enabled: true
        }
      ],
      performanceConfig: {
        maxFileSize: 2 * 1024 * 1024, // 2MB
        maxParseTime: 8000, // 8秒
        cacheSize: 1500,
        enableParallel: true,
        parallelThreads: 4
      }
    });
    
    // Python 配置
    this.addLanguageConfig({
      language: 'python',
      fileExtensions: ['.py'],
      chunkTypes: [
        'import_statement',
        'class_definition',
        'function_definition',
        'if_statement',
        'for_statement',
        'while_statement',
        'try_statement',
        'with_statement'
      ],
      defaultChunkConfig: {
        maxChunkSize: 1500,
        minChunkSize: 150,
        preserveComments: true,
        preserveEmptyLines: false,
        maxNestingLevel: 12
      },
      syntaxRules: [
        {
          name: 'python_decorator',
          description: '处理Python装饰器',
          nodeTypes: ['decorator'],
          handler: 'handleDecorator',
          priority: 1
        },
        {
          name: 'python_comprehension',
          description: '处理列表推导式',
          nodeTypes: ['list_comprehension', 'dict_comprehension', 'set_comprehension'],
          handler: 'handleComprehension',
          priority: 2
        }
      ],
      specialRules: [
        {
          name: 'python_f_string',
          description: '处理f-string',
          pattern: /f"[^"]*"/g,
          replacement: 'F_STRING',
          enabled: true
        }
      ],
      performanceConfig: {
        maxFileSize: 1024 * 1024, // 1MB
        maxParseTime: 6000, // 6秒
        cacheSize: 1200,
        enableParallel: true,
        parallelThreads: 3
      }
    });
    
    // Java 配置
    this.addLanguageConfig({
      language: 'java',
      fileExtensions: ['.java'],
      chunkTypes: [
        'import_declaration',
        'package_declaration',
        'class_declaration',
        'interface_declaration',
        'enum_declaration',
        'method_declaration',
        'constructor_declaration',
        'field_declaration'
      ],
      defaultChunkConfig: {
        maxChunkSize: 2500,
        minChunkSize: 250,
        preserveComments: true,
        preserveEmptyLines: false,
        maxNestingLevel: 10
      },
      syntaxRules: [
        {
          name: 'java_annotation',
          description: '处理Java注解',
          nodeTypes: ['annotation'],
          handler: 'handleAnnotation',
          priority: 1
        },
        {
          name: 'java_generic',
          description: '处理Java泛型',
          nodeTypes: ['generic_type'],
          handler: 'handleGenericType',
          priority: 2
        }
      ],
      specialRules: [
        {
          name: 'java_lambda',
          description: '处理Lambda表达式',
          pattern: /\([^)]*\)\s*->/g,
          replacement: 'LAMBDA',
          enabled: true
        }
      ],
      performanceConfig: {
        maxFileSize: 3 * 1024 * 1024, // 3MB
        maxParseTime: 10000, // 10秒
        cacheSize: 2000,
        enableParallel: true,
        parallelThreads: 4
      }
    });
    
    // Go 配置
    this.addLanguageConfig({
      language: 'go',
      fileExtensions: ['.go'],
      chunkTypes: [
        'import_declaration',
        'package_clause',
        'type_declaration',
        'function_declaration',
        'method_declaration',
        'var_declaration',
        'const_declaration'
      ],
      defaultChunkConfig: {
        maxChunkSize: 1800,
        minChunkSize: 180,
        preserveComments: true,
        preserveEmptyLines: false,
        maxNestingLevel: 8
      },
      syntaxRules: [
        {
          name: 'go_struct',
          description: '处理Go结构体',
          nodeTypes: ['struct_type'],
          handler: 'handleStructType',
          priority: 1
        },
        {
          name: 'go_interface',
          description: '处理Go接口',
          nodeTypes: ['interface_type'],
          handler: 'handleInterfaceType',
          priority: 1
        }
      ],
      specialRules: [
        {
          name: 'go_channel',
          description: '处理通道操作',
          pattern: /make\(\s*chan\s+/g,
          replacement: 'CHANNEL',
          enabled: true
        }
      ],
      performanceConfig: {
        maxFileSize: 1024 * 1024, // 1MB
        maxParseTime: 5000, // 5秒
        cacheSize: 1000,
        enableParallel: true,
        parallelThreads: 3
      }
    });
  }
  
  /**
   * 添加语言配置
   */
  addLanguageConfig(config: LanguageConfiguration): void {
    this.configs.set(config.language, config);
  }
  
  /**
   * 获取语言配置
   */
  getLanguageConfig(language: string): LanguageConfiguration {
    return this.configs.get(language) || this.defaultConfig;
  }
  
  /**
   * 根据文件扩展名获取语言配置
   */
  getLanguageConfigByExtension(extension: string): LanguageConfiguration {
    for (const config of this.configs.values()) {
      if (config.fileExtensions.includes(extension)) {
        return config;
      }
    }
    return this.defaultConfig;
  }
  
  /**
   * 获取所有支持的语言
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.configs.keys());
  }
  
  /**
   * 获取语言的分段类型
   */
  getChunkTypes(language: string): string[] {
    const config = this.getLanguageConfig(language);
    return config.chunkTypes;
  }
  
  /**
   * 获取语言的默认配置
   */
  getDefaultConfiguration(language: string): StrategyConfiguration {
    const config = this.getLanguageConfig(language);
    return config.defaultChunkConfig;
  }
  
  /**
   * 获取语言的性能配置
   */
  getPerformanceConfig(language: string): PerformanceConfig {
    const config = this.getLanguageConfig(language);
    return config.performanceConfig;
  }
  
  /**
   * 获取语言的语法规则
   */
  getSyntaxRules(language: string): SyntaxRule[] {
    const config = this.getLanguageConfig(language);
    return config.syntaxRules;
  }
  
  /**
   * 获取语言的特殊规则
   */
  getSpecialRules(language: string): SpecialRule[] {
    const config = this.getLanguageConfig(language);
    return config.specialRules;
  }
  
  /**
   * 检查语言是否支持
   */
  isLanguageSupported(language: string): boolean {
    return this.configs.has(language);
  }
  
  /**
   * 更新语言配置
   */
  updateLanguageConfig(language: string, updates: Partial<LanguageConfiguration>): void {
    const existing = this.getLanguageConfig(language);
    const updated = { ...existing, ...updates };
    this.configs.set(language, updated);
  }
  
  /**
   * 移除语言配置
   */
  removeLanguageConfig(language: string): void {
    this.configs.delete(language);
  }
  
  /**
   * 获取所有配置
   */
  getAllConfigs(): Map<string, LanguageConfiguration> {
    return new Map(this.configs);
  }
}

/**
 * 配置管理器工厂
 */
export class ConfigManagerFactory {
  private static instance: LanguageConfigManager;
  
  static getInstance(): LanguageConfigManager {
    if (!this.instance) {
      this.instance = new LanguageConfigManager();
    }
    return this.instance;
  }
}