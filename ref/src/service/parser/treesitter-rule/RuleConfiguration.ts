/**
 * Tree-sitter规则配置系统
 * 提供灵活的配置选项和规则管理
 */

export interface RuleConfig {
  enabled: boolean;
  priority: number;
  maxDepth: number;
  minComplexity: number;
  maxComplexity: number;
  minLines: number;
  maxLines: number;
  languages: string[];
  customPatterns?: string[];
  excludePatterns?: string[];
  includeContext?: boolean;
  extractImports?: boolean;
  extractExports?: boolean;
}

export interface LanguageSpecificConfig {
  nodeTypes: string[];
  patterns: string[];
  keywords: string[];
  specialHandling?: Record<string, any>;
}

export interface RuleConfiguration {
  global: {
    maxFileSize: number;
    maxTotalSnippets: number;
    timeout: number;
    parallelProcessing: boolean;
    cacheEnabled: boolean;
  };
  rules: Record<string, RuleConfig>;
  languages: Record<string, LanguageSpecificConfig>;
  featureFlags: {
    enableModernFeatures: boolean;
    enableReactivePatterns: boolean;
    enableTestExtraction: boolean;
    enableContextAnalysis: boolean;
    enablePerformanceMetrics: boolean;
  };
}

export const DEFAULT_CONFIG: RuleConfiguration = {
  global: {
    maxFileSize: 1024 * 1024, // 1MB
    maxTotalSnippets: 1000,
    timeout: 30000, // 30秒
    parallelProcessing: true,
    cacheEnabled: true,
  },
  rules: {
    DestructuringAssignmentRule: {
      enabled: true,
      priority: 1,
      maxDepth: 50,
      minComplexity: 2,
      maxComplexity: 50,
      minLines: 1,
      maxLines: 20,
      languages: ['javascript', 'typescript', 'python', 'java'],
      includeContext: true,
      extractImports: true,
      extractExports: false,
    },
    ControlStructureRule: {
      enabled: true,
      priority: 2,
      maxDepth: 50,
      minComplexity: 3,
      maxComplexity: 100,
      minLines: 2,
      maxLines: 50,
      languages: ['javascript', 'typescript', 'python', 'java', 'go', 'rust'],
      includeContext: true,
      extractImports: false,
      extractExports: false,
    },
    FunctionCallChainRule: {
      enabled: true,
      priority: 3,
      maxDepth: 50,
      minComplexity: 2,
      maxComplexity: 80,
      minLines: 1,
      maxLines: 30,
      languages: ['javascript', 'typescript', 'python', 'java'],
      includeContext: true,
      extractImports: true,
      extractExports: false,
    },
    ModernLanguageFeaturesRule: {
      enabled: true,
      priority: 4,
      maxDepth: 50,
      minComplexity: 2,
      maxComplexity: 100,
      minLines: 1,
      maxLines: 100,
      languages: ['javascript', 'typescript', 'python'],
      includeContext: true,
      extractImports: true,
      extractExports: true,
      customPatterns: ['async.*function', 'await\s+\w+', '\?\.|\?\?', '@\w+', '#\w+', '\.\.\.'],
    },
    ReactiveProgrammingRule: {
      enabled: true,
      priority: 5,
      maxDepth: 50,
      minComplexity: 3,
      maxComplexity: 150,
      minLines: 2,
      maxLines: 100,
      languages: ['javascript', 'typescript'],
      includeContext: true,
      extractImports: true,
      extractExports: false,
      customPatterns: [
        '\.pipe\s*\(',
        '\.subscribe\s*\(',
        'Observable',
        'Subject',
        'BehaviorSubject',
      ],
    },
    TestCodeRule: {
      enabled: true,
      priority: 6,
      maxDepth: 50,
      minComplexity: 1,
      maxComplexity: 200,
      minLines: 1,
      maxLines: 200,
      languages: ['javascript', 'typescript', 'python', 'java', 'go'],
      includeContext: true,
      extractImports: true,
      extractExports: false,
      customPatterns: [
        'describe\s*\(',
        'it\s*\(',
        'test\s*\(',
        'expect\s*\(',
        'assert\s*\(',
        'should\s*\(',
      ],
    },
    ReactRule: {
      enabled: true,
      priority: 7,
      maxDepth: 50,
      minComplexity: 3,
      maxComplexity: 150,
      minLines: 3,
      maxLines: 200,
      languages: ['javascript', 'typescript'],
      includeContext: true,
      extractImports: true,
      extractExports: true,
      customPatterns: [
        'import.*React',
        'useState\s*\(',
        'useEffect\s*\(',
        'function\s+[A-Z].*return.*<',
        'class\s+[A-Z].*extends.*Component',
      ],
    },
    DjangoRule: {
      enabled: true,
      priority: 8,
      maxDepth: 50,
      minComplexity: 2,
      maxComplexity: 200,
      minLines: 2,
      maxLines: 150,
      languages: ['python'],
      includeContext: true,
      extractImports: true,
      extractExports: false,
      customPatterns: [
        'from django.db import models',
        'class.*models.Model',
        'def.*request.*:',
        '@login_required',
        'objects.filter',
        'render\\(',
      ],
    },
    SpringBootRule: {
      enabled: true,
      priority: 9,
      maxDepth: 50,
      minComplexity: 3,
      maxComplexity: 250,
      minLines: 3,
      maxLines: 300,
      languages: ['java'],
      includeContext: true,
      extractImports: true,
      extractExports: false,
      customPatterns: [
        '@SpringBootApplication',
        '@RestController',
        '@Service',
        '@Entity',
        '@Autowired',
        '@GetMapping',
        '@Transactional',
      ],
    },
    PyTorchRule: {
      enabled: true,
      priority: 10,
      maxDepth: 50,
      minComplexity: 4,
      maxComplexity: 300,
      minLines: 5,
      maxLines: 400,
      languages: ['python'],
      includeContext: true,
      extractImports: true,
      extractExports: false,
      customPatterns: [
        'import torch',
        'class.*nn.Module',
        'def forward\\(',
        'model.train\\(',
        'optimizer.step\\(',
        'loss.backward\\(',
      ],
    },
    VueRule: {
      enabled: true,
      priority: 11,
      maxDepth: 50,
      minComplexity: 3,
      maxComplexity: 200,
      minLines: 3,
      maxLines: 250,
      languages: ['javascript', 'typescript'],
      includeContext: true,
      extractImports: true,
      extractExports: false,
      customPatterns: [
        'import.*vue',
        'export default',
        'defineComponent\\(',
        'setup\\(',
        'ref\\(',
        'reactive\\(',
        'computed\\(',
        'watch\\(',
        '<script setup>',
      ],
    },
    ExpressRule: {
      enabled: true,
      priority: 12,
      maxDepth: 50,
      minComplexity: 2,
      maxComplexity: 150,
      minLines: 2,
      maxLines: 100,
      languages: ['javascript'],
      includeContext: true,
      extractImports: true,
      extractExports: false,
      customPatterns: [
        'import.*express',
        'express\\(\\)',
        'app\\.(get|post|put|delete|patch)',
        'router\\.(get|post|put|delete|patch)',
        'app\\.use\\(',
        'res\\.(send|json|render)',
        'req\\.(params|query|body)',
      ],
    },
    PytestRule: {
      enabled: true,
      priority: 13,
      maxDepth: 50,
      minComplexity: 2,
      maxComplexity: 100,
      minLines: 2,
      maxLines: 150,
      languages: ['python'],
      includeContext: true,
      extractImports: true,
      extractExports: false,
      customPatterns: [
        'import pytest',
        'def test_',
        'class Test',
        '@pytest\\.fixture',
        '@pytest\\.mark',
        'assert ',
        'with pytest\\.raises',
        '@pytest\\.parametrize',
      ],
    },
    JUnitRule: {
      enabled: true,
      priority: 14,
      maxDepth: 50,
      minComplexity: 2,
      maxComplexity: 120,
      minLines: 2,
      maxLines: 200,
      languages: ['java'],
      includeContext: true,
      extractImports: true,
      extractExports: false,
      customPatterns: [
        'import org.junit.jupiter',
        '@Test',
        '@BeforeEach',
        '@AfterEach',
        '@BeforeAll',
        '@AfterAll',
        '@ParameterizedTest',
        'assert',
        'Assertions\\.',
      ],
    },
  },
  languages: {
    javascript: {
      nodeTypes: [
        'function_declaration',
        'arrow_function',
        'class_declaration',
        'method_definition',
        'object_pattern',
        'array_pattern',
        'template_string',
        'template_literal',
        'spread_element',
      ],
      patterns: [
        'function\s*\(',
        '=>\s*\{',
        'class\s+\w+',
        'async\s+function',
        'await\s+\w+',
        '\.\.\.',
      ],
      keywords: [
        'function',
        'class',
        'async',
        'await',
        'const',
        'let',
        'var',
        'import',
        'export',
        'extends',
        'implements',
        'interface',
      ],
    },
    typescript: {
      nodeTypes: [
        'type_alias_declaration',
        'interface_declaration',
        'generic_type',
        'type_parameter_declaration',
        'decorator',
        'private_identifier',
      ],
      patterns: ['type\s+\w+\s*=', 'interface\s+\w+', '@\w+', '#\w+', '<\w+>', 'extends\s+\w+'],
      keywords: [
        'type',
        'interface',
        'implements',
        'extends',
        'readonly',
        'private',
        'public',
        'protected',
        'abstract',
        'static',
      ],
    },
    python: {
      nodeTypes: [
        'function_definition',
        'class_definition',
        'list_comprehension',
        'dictionary_comprehension',
        'generator_expression',
        'decorator',
      ],
      patterns: [
        'def\s+\w+',
        'class\s+\w+',
        '@\w+',
        '\*\w+',
        '\*\*\w+',
        'async\s+def',
        'await\s+\w+',
      ],
      keywords: [
        'def',
        'class',
        'async',
        'await',
        'import',
        'from',
        'as',
        'lambda',
        'yield',
        'with',
        'try',
        'except',
        'finally',
      ],
    },
    java: {
      nodeTypes: [
        'method_declaration',
        'class_declaration',
        'interface_declaration',
        'enum_declaration',
        'annotation',
        'generic_type',
      ],
      patterns: [
        'public\s+class',
        'private\s+class',
        'interface\s+\w+',
        '@\w+',
        '<\w+>',
        'extends\s+\w+',
      ],
      keywords: [
        'public',
        'private',
        'protected',
        'static',
        'final',
        'abstract',
        'interface',
        'class',
        'extends',
        'implements',
        'enum',
        '@',
      ],
    },
    go: {
      nodeTypes: [
        'function_declaration',
        'method_declaration',
        'struct_type',
        'interface_type',
        'type_declaration',
        'goroutine',
      ],
      patterns: ['func\s+\w+', 'type\s+\w+\s+struct', 'interface\s+\w+', 'go\s+func', 'chan\s+\w+'],
      keywords: [
        'func',
        'type',
        'struct',
        'interface',
        'go',
        'chan',
        'select',
        'defer',
        'fallthrough',
        'range',
        'make',
        'new',
      ],
    },
  },
  featureFlags: {
    enableModernFeatures: true,
    enableReactivePatterns: true,
    enableTestExtraction: true,
    enableContextAnalysis: true,
    enablePerformanceMetrics: true,
  },
};

export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private config: RuleConfiguration = DEFAULT_CONFIG;

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  getConfig(): RuleConfiguration {
    return this.config;
  }

  updateConfig(newConfig: Partial<RuleConfiguration>): void {
    this.config = {
      ...this.config,
      ...newConfig,
      rules: {
        ...this.config.rules,
        ...newConfig.rules,
      },
      languages: {
        ...this.config.languages,
        ...newConfig.languages,
      },
      featureFlags: {
        ...this.config.featureFlags,
        ...newConfig.featureFlags,
      },
    };
  }

  getRuleConfig(ruleName: string): RuleConfig | undefined {
    return this.config.rules[ruleName];
  }

  setRuleConfig(ruleName: string, config: Partial<RuleConfig>): void {
    if (this.config.rules[ruleName]) {
      this.config.rules[ruleName] = {
        ...this.config.rules[ruleName],
        ...config,
      };
    }
  }

  enableRule(ruleName: string): void {
    if (this.config.rules[ruleName]) {
      this.config.rules[ruleName].enabled = true;
    }
  }

  disableRule(ruleName: string): void {
    if (this.config.rules[ruleName]) {
      this.config.rules[ruleName].enabled = false;
    }
  }

  isRuleEnabled(ruleName: string): boolean {
    return this.config.rules[ruleName]?.enabled ?? false;
  }

  getEnabledRules(): string[] {
    return Object.keys(this.config.rules).filter(ruleName => this.config.rules[ruleName].enabled);
  }

  getRulesForLanguage(language: string): string[] {
    return Object.keys(this.config.rules).filter(ruleName =>
      this.config.rules[ruleName].languages.includes(language)
    );
  }

  getLanguageConfig(language: string): LanguageSpecificConfig | undefined {
    return this.config.languages[language];
  }

  isFeatureEnabled(feature: keyof RuleConfiguration['featureFlags']): boolean {
    return this.config.featureFlags[feature];
  }
}

export default ConfigurationManager;
