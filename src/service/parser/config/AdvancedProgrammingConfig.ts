/**
 * 高级编程语言配置
 * 包含具有复杂 AST 查询的高级编程语言
 */
import { LanguageConfig, LanguageStrategy } from './LanguageCore';

export const ADVANCED_PROGRAMMING_STRATEGY: LanguageStrategy = {
  primary: 'treesitter_ast',
  fallback: ['structure_aware', 'function'],
  useFullAST: true,
  supportedQueryTypes: [
    'functions', 'classes', 'methods', 'imports', 'exports', 
    'variables', 'types', 'interfaces', 'control-flow', 
    'data-flow', 'expressions'
  ],
  maxQueryDepth: 10
};

export const ADVANCED_PROGRAMMING_LANGUAGES: LanguageConfig[] = [
  {
    name: 'typescript',
    displayName: 'TypeScript',
    queryDir: 'typescript',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.ts', '.tsx'],
    aliases: ['ts', 'typescript'],
    strategy: ADVANCED_PROGRAMMING_STRATEGY
  },
  
  {
    name: 'javascript',
    displayName: 'JavaScript',
    queryDir: 'javascript',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.js', '.jsx'],
    aliases: ['js', 'javascript'],
    strategy: ADVANCED_PROGRAMMING_STRATEGY
  },
  
  {
    name: 'python',
    displayName: 'Python',
    queryDir: 'python',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.py'],
    aliases: ['py', 'python'],
    strategy: {
      ...ADVANCED_PROGRAMMING_STRATEGY,
      supportedQueryTypes: [
        'functions', 'classes', 'methods', 'imports', 'variables',
        'types', 'data-flow', 'control-flow'
      ]
    }
  },
  
  {
    name: 'java',
    displayName: 'Java',
    queryDir: 'java',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.java'],
    aliases: ['java'],
    strategy: {
      ...ADVANCED_PROGRAMMING_STRATEGY,
      supportedQueryTypes: [
        'functions', 'classes', 'methods', 'imports', 'variables',
        'types', 'interfaces'
      ]
    }
  },
  
  {
    name: 'cpp',
    displayName: 'C++',
    queryDir: 'cpp',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.cpp', '.cc', '.cxx', '.c++', '.hpp'],
    aliases: ['c++', 'cpp', 'cxx'],
    strategy: {
      ...ADVANCED_PROGRAMMING_STRATEGY,
      supportedQueryTypes: [
        'functions', 'classes', 'methods', 'imports', 'variables',
        'types', 'namespaces', 'modern-features'
      ]
    }
  },
  
  {
    name: 'go',
    displayName: 'Go',
    queryDir: 'go',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.go'],
    aliases: ['go'],
    strategy: {
      ...ADVANCED_PROGRAMMING_STRATEGY,
      supportedQueryTypes: [
        'functions', 'concurrency', 'data-flow'
      ]
    }
  },
  
  {
    name: 'rust',
    displayName: 'Rust',
    queryDir: 'rust',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.rs'],
    aliases: ['rs', 'rust'],
    strategy: {
      ...ADVANCED_PROGRAMMING_STRATEGY,
      supportedQueryTypes: [
        'functions', 'modules', 'types', 'macros'
      ]
    }
  },
  
  {
    name: 'csharp',
    displayName: 'C#',
    queryDir: 'csharp',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.cs'],
    aliases: ['c#', 'cs', 'csharp'],
    strategy: {
      ...ADVANCED_PROGRAMMING_STRATEGY,
      supportedQueryTypes: [
        'functions', 'classes', 'methods', 'properties', 'patterns'
      ]
    }
  },
  
  {
    name: 'kotlin',
    displayName: 'Kotlin',
    queryDir: 'kotlin',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.kt'],
    aliases: ['kt', 'kotlin'],
    strategy: {
      ...ADVANCED_PROGRAMMING_STRATEGY,
      supportedQueryTypes: [
        'functions', 'classes', 'methods', 'properties'
      ]
    }
  },
  
  {
    name: 'tsx',
    displayName: 'TSX',
    queryDir: 'tsx',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.tsx'],
    aliases: ['tsx'],
    strategy: {
      ...ADVANCED_PROGRAMMING_STRATEGY,
      supportedQueryTypes: [
        'components', 'jsx', 'types-hooks'
      ]
    }
  },
  
  {
    name: 'vue',
    displayName: 'Vue',
    queryDir: 'vue',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.vue'],
    aliases: ['vue'],
    strategy: {
      ...ADVANCED_PROGRAMMING_STRATEGY,
      supportedQueryTypes: [
        'components', 'template-directives'
      ]
    }
  },
  
  {
    name: 'c',
    displayName: 'C',
    queryDir: 'c',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.c', '.h'],
    aliases: ['c'],
    strategy: {
      ...ADVANCED_PROGRAMMING_STRATEGY,
      supportedQueryTypes: [
        'functions', 'control-flow', 'data-flow'
      ]
    }
  },
  
  {
    name: 'html',
    displayName: 'HTML',
    queryDir: 'html',
    hasSubdir: true,
    category: 'hybrid_processing',
    extensions: ['.html'],
    aliases: ['html'],
    strategy: {
      primary: 'specialized_processor',
      fallback: ['treesitter_ast'],
      specializedProcessor: 'XMLTextStrategy',
      supportedQueryTypes: ['elements', 'attributes'],
      maxQueryDepth: 10
    }
  },
  
  {
    name: 'css',
    displayName: 'CSS',
    queryDir: 'css',
    hasSubdir: true,
    category: 'hybrid_processing',
    extensions: ['.css'],
    aliases: ['css'],
    strategy: {
      primary: 'specialized_processor',
      fallback: ['treesitter_ast'],
      specializedProcessor: 'CSSTextStrategy',
      supportedQueryTypes: ['rules', 'properties', 'selectors'],
      maxQueryDepth: 8
    }
  }
];