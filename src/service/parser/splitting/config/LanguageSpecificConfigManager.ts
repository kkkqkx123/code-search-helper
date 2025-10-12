import { BalancedChunker } from '../BalancedChunker';

export interface LanguageSpecificConfig {
  boundaries: {
    functionEnd: RegExp[];
    classEnd: RegExp[];
    methodEnd: RegExp[];
    importEnd: RegExp[];
    statementEnd: RegExp[];
  };
  
  weights: {
    syntactic: number;
    semantic: number;
    logical: number;
    comment: number;
  };
  
  chunking: {
    defaultMaxSize: number;
    defaultOverlap: number;
    preferWholeStructures: boolean;
  };
}

export interface LanguageWeights {
  syntactic: number;
  function: number;
  class: number;
  method: number;
  import: number;
  logical: number;
  comment: number;
}

const DEFAULT_LANGUAGE_CONFIG: LanguageSpecificConfig = {
  boundaries: {
    functionEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/],
    classEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/],
    methodEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/],
    importEnd: [/^import .*;$/, /^export .*;$/],
    statementEnd: [/^\s*;\s*$/, /^\s*}\s*$/]
  },
  weights: {
    syntactic: 0.7, semantic: 0.8, logical: 0.6, comment: 0.4
  },
  chunking: {
    defaultMaxSize: 1000,
    defaultOverlap: 200,
    preferWholeStructures: true
 }
};

export const LANGUAGE_CONFIGS: Record<string, LanguageSpecificConfig> = {
  typescript: {
    boundaries: {
      functionEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/, /^\s*}\s*\);?$/],
      classEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/],
      methodEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/],
      importEnd: [/^import\s+.*;?$/, /^export\s+.*;?$/, /^import\s*{.*}\s*from\s*.+;?$/, /^import\s*.+\s*=\s*require\(.+\);?$/],
      statementEnd: [/^\s*;\s*$/, /^\s*}\s*$/, /^\s*,$/]
    },
    weights: {
      syntactic: 0.8, semantic: 0.9, logical: 0.6, comment: 0.4
    },
    chunking: {
      defaultMaxSize: 1000,
      defaultOverlap: 200,
      preferWholeStructures: true
    }
 },
  javascript: {
    boundaries: {
      functionEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/, /^\s*}\s*\);?$/],
      classEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/],
      methodEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/],
      importEnd: [/^import\s+.*;?$/, /^export\s+.*;?$/, /^import\s*{.*}\s*from\s*.+;?$/, /^import\s*.+\s*=\s*require\(.+\);?$/],
      statementEnd: [/^\s*;\s*$/, /^\s*}\s*$/, /^\s*,$/]
    },
    weights: {
      syntactic: 0.8, semantic: 0.9, logical: 0.6, comment: 0.4
    },
    chunking: {
      defaultMaxSize: 1000,
      defaultOverlap: 200,
      preferWholeStructures: true
    }
  },
  python: {
    boundaries: {
      functionEnd: [/^\s*$/, /^\s*#.*$/, /^\s*""".*"""\s*$/], // Python uses indentation, so empty line often indicates end
      classEnd: [/^\s*$/, /^\s*#.*$/],
      methodEnd: [/^\s*$/, /^\s*#.*$/],
      importEnd: [/^import\s+.*$/, /^from\s+.*\s+import\s+.*$/, /^from\s+.*\s+import\s+\(.*\)$/],
      statementEnd: [/^\s*$/, /^\s*#.*$/]
    },
    weights: {
      syntactic: 0.7, semantic: 0.9, logical: 0.7, comment: 0.5
    },
    chunking: {
      defaultMaxSize: 1200, // Python tends to have longer lines with less dense syntax
      defaultOverlap: 150,
      preferWholeStructures: true
    }
 },
  java: {
    boundaries: {
      functionEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/, /^\s*}\s*\/\*.*\*\/\s*$/],
      classEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/],
      methodEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/],
      importEnd: [/^import\s+.*;$/, /^package\s+.*;$/],
      statementEnd: [/^\s*;\s*$/, /^\s*}\s*$/]
    },
    weights: {
      syntactic: 0.8, semantic: 0.9, logical: 0.5, comment: 0.4
    },
    chunking: {
      defaultMaxSize: 1000,
      defaultOverlap: 200,
      preferWholeStructures: true
    }
  },
  go: {
    boundaries: {
      functionEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/],
      classEnd: [], // Go doesn't have classes
      methodEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/],
      importEnd: [/^import\s+\(.*$/, /^import\s+".*"$/, /^\s*".*"$/], // Multi-line imports
      statementEnd: [/^\s*;\s*$/, /^\s*}\s*$/, /^\s*$/] // Go can have empty lines as statement separators in some contexts
    },
    weights: {
      syntactic: 0.7, semantic: 0.8, logical: 0.6, comment: 0.4
    },
    chunking: {
      defaultMaxSize: 1000,
      defaultOverlap: 180,
      preferWholeStructures: true
    }
  },
  rust: {
    boundaries: {
      functionEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/, /^\s*}\s*\/\*.*\*\/\s*$/],
      classEnd: [], // Rust doesn't have classes, but has impl blocks
      methodEnd: [/^\s*}\s*$/, /^\s*}\s*\/\/.*$/],
      importEnd: [/^use\s+.*;$/, /^extern\s+crate\s+.*;$/],
      statementEnd: [/^\s*;\s*$/, /^\s*}\s*$/]
    },
    weights: {
      syntactic: 0.8, semantic: 0.9, logical: 0.6, comment: 0.4
    },
    chunking: {
      defaultMaxSize: 1000,
      defaultOverlap: 20,
      preferWholeStructures: true
    }
 },
  default: DEFAULT_LANGUAGE_CONFIG
};

export class LanguageSpecificConfigManager {
  private configCache: Map<string, LanguageSpecificConfig> = new Map();
  private balancedChunker: BalancedChunker;

  constructor() {
    this.balancedChunker = new BalancedChunker();
    this.initializeCache();
  }

  private initializeCache(): void {
    // 初始化缓存所有语言配置
    Object.keys(LANGUAGE_CONFIGS).forEach(lang => {
      this.configCache.set(lang, LANGUAGE_CONFIGS[lang]);
    });
  }

 /**
   * 获取指定语言的配置
   */
  getConfig(language: string): LanguageSpecificConfig {
    const cached = this.configCache.get(language);
    if (cached) {
      return cached;
    }

    // 如果没有缓存，获取配置并缓存
    const config = LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS.default;
    this.configCache.set(language, config);
    return config;
  }

  /**
   * 获取语言特定的权重
   */
  getWeights(language: string): LanguageWeights {
    const config = this.getConfig(language);
    return {
      syntactic: config.weights.syntactic,
      function: 0.9, // Default semantic weights
      class: 0.9,
      method: 0.8,
      import: 0.7,
      logical: config.weights.logical,
      comment: config.weights.comment
    };
 }

  /**
   * 检查某行是否是特定语言的函数结束边界
   */
  isFunctionEnd(line: string, language: string): boolean {
    const config = this.getConfig(language);
    return config.boundaries.functionEnd.some(regex => regex.test(line));
  }

  /**
   * 检查某行是否是特定语言的类结束边界
   */
  isClassEnd(line: string, language: string): boolean {
    const config = this.getConfig(language);
    return config.boundaries.classEnd.some(regex => regex.test(line));
  }

  /**
   * 检查某行是否是特定语言的方法结束边界
   */
  isMethodEnd(line: string, language: string): boolean {
    const config = this.getConfig(language);
    return config.boundaries.methodEnd.some(regex => regex.test(line));
  }

  /**
   * 检查某行是否是特定语言的导入结束边界
   */
  isImportEnd(line: string, language: string): boolean {
    const config = this.getConfig(language);
    return config.boundaries.importEnd.some(regex => regex.test(line));
  }

  /**
   * 检查某行是否是特定语言的语句结束边界
   */
  isStatementEnd(line: string, language: string): boolean {
    const config = this.getConfig(language);
    return config.boundaries.statementEnd.some(regex => regex.test(line));
  }

  /**
   * 获取特定语言的默认分段选项
   */
 getDefaultChunkingOptions(language: string) {
    const config = this.getConfig(language);
    return {
      maxChunkSize: config.chunking.defaultMaxSize,
      overlapSize: config.chunking.defaultOverlap,
      preferWholeStructures: config.chunking.preferWholeStructures
    };
  }

  /**
   * 验证配置的有效性
   */
  validateConfig(config: LanguageSpecificConfig): boolean {
    try {
      // 检查边界配置是否为数组
      if (!Array.isArray(config.boundaries.functionEnd)) return false;
      if (!Array.isArray(config.boundaries.classEnd)) return false;
      if (!Array.isArray(config.boundaries.methodEnd)) return false;
      if (!Array.isArray(config.boundaries.importEnd)) return false;
      if (!Array.isArray(config.boundaries.statementEnd)) return false;

      // 检查权重是否在合理范围内
      if (config.weights.syntactic < 0 || config.weights.syntactic > 1) return false;
      if (config.weights.semantic < 0 || config.weights.semantic > 1) return false;
      if (config.weights.logical < 0 || config.weights.logical > 1) return false;
      if (config.weights.comment < 0 || config.weights.comment > 1) return false;

      // 检查分段配置
      if (config.chunking.defaultMaxSize <= 0) return false;
      if (config.chunking.defaultOverlap < 0) return false;

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 添加或更新语言配置
   */
  setConfig(language: string, config: LanguageSpecificConfig): void {
    if (!this.validateConfig(config)) {
      throw new Error(`Invalid configuration for language: ${language}`);
    }
    
    LANGUAGE_CONFIGS[language] = config;
    this.configCache.set(language, config);
 }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return Object.keys(LANGUAGE_CONFIGS).filter(lang => lang !== 'default');
  }
}