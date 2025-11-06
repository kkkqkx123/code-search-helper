/**
 * 统一语言映射配置
 * 集中管理所有语言相关的映射关系和配置信息
 */

export interface LanguageMapping {
  // 基础信息
  name: string;
  displayName: string;
  extensions: string[];
  aliases: string[];
  
  // Tree-sitter 相关
  treeSitterModule: string;
  treeSitterImport: string;
  treeSitterLanguageName?: string; // 如 c_sharp
  
  // 查询系统相关
  queryDir: string;
  supportedQueryTypes: string[];
  
  // 处理相关
  supported: boolean;
  priority: number;
  
  // 配置相关
  maxChunkSize?: number;
  maxLinesPerChunk?: number;
  enableSemanticDetection?: boolean;
  enableBracketBalance?: boolean;
  
  // 策略支持
  supportedStrategies: string[];
  
  // 分类
  category: 'programming' | 'markup' | 'data' | 'config';
}

/**
 * 完整的语言映射配置
 * 包含系统中所有支持的语言的详细信息
 */
export const LANGUAGE_MAPPINGS: Record<string, LanguageMapping> = {
  javascript: {
    name: 'javascript',
    displayName: 'JavaScript',
    extensions: ['.js', '.jsx'],
    aliases: ['js', 'javascript'],
    treeSitterModule: 'tree-sitter-javascript',
    treeSitterImport: 'default',
    queryDir: 'javascript',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'exports', 'variables', 'types'],
    supported: true,
    priority: 1,
    maxChunkSize: 2000,
    maxLinesPerChunk: 100,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'programming'
  },
  
  typescript: {
    name: 'typescript',
    displayName: 'TypeScript',
    extensions: ['.ts', '.tsx'],
    aliases: ['ts', 'typescript'],
    treeSitterModule: 'tree-sitter-typescript',
    treeSitterImport: 'typescript',
    queryDir: 'typescript',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'exports', 'variables', 'types', 'interfaces'],
    supported: true,
    priority: 1,
    maxChunkSize: 2000,
    maxLinesPerChunk: 100,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'programming'
  },
  
  python: {
    name: 'python',
    displayName: 'Python',
    extensions: ['.py'],
    aliases: ['py', 'python'],
    treeSitterModule: 'tree-sitter-python',
    treeSitterImport: 'default',
    queryDir: 'python',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'types'],
    supported: true,
    priority: 1,
    maxChunkSize: 1800,
    maxLinesPerChunk: 90,
    enableSemanticDetection: true,
    enableBracketBalance: false, // Python 使用缩进
    supportedStrategies: ['ast', 'structure-aware'],
    category: 'programming'
  },
  
  java: {
    name: 'java',
    displayName: 'Java',
    extensions: ['.java'],
    aliases: ['java'],
    treeSitterModule: 'tree-sitter-java',
    treeSitterImport: 'default',
    queryDir: 'java',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'types', 'interfaces'],
    supported: true,
    priority: 1,
    maxChunkSize: 2100,
    maxLinesPerChunk: 105,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'programming'
  },
  
  go: {
    name: 'go',
    displayName: 'Go',
    extensions: ['.go'],
    aliases: ['go'],
    treeSitterModule: 'tree-sitter-go',
    treeSitterImport: 'default',
    queryDir: 'go',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'types'],
    supported: true,
    priority: 1,
    maxChunkSize: 1900,
    maxLinesPerChunk: 95,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'programming'
  },
  
  rust: {
    name: 'rust',
    displayName: 'Rust',
    extensions: ['.rs'],
    aliases: ['rs', 'rust'],
    treeSitterModule: 'tree-sitter-rust',
    treeSitterImport: 'default',
    queryDir: 'rust',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'types'],
    supported: true,
    priority: 1,
    maxChunkSize: 2000,
    maxLinesPerChunk: 100,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'programming'
  },
  
  cpp: {
    name: 'cpp',
    displayName: 'C++',
    extensions: ['.cpp', '.cc', '.cxx', '.c++', '.hpp'],
    aliases: ['c++', 'cpp', 'cxx'],
    treeSitterModule: 'tree-sitter-cpp',
    treeSitterImport: 'default',
    queryDir: 'cpp',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'types'],
    supported: true,
    priority: 1,
    maxChunkSize: 2100,
    maxLinesPerChunk: 105,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'programming'
  },
  
  c: {
    name: 'c',
    displayName: 'C',
    extensions: ['.c', '.h'],
    aliases: ['c'],
    treeSitterModule: 'tree-sitter-c',
    treeSitterImport: 'default',
    queryDir: 'c',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'types'],
    supported: true,
    priority: 1,
    maxChunkSize: 2000,
    maxLinesPerChunk: 100,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'programming'
  },
  
  csharp: {
    name: 'csharp',
    displayName: 'C#',
    extensions: ['.cs'],
    aliases: ['c#', 'csharp'],
    treeSitterModule: 'tree-sitter-c-sharp',
    treeSitterImport: 'default',
    treeSitterLanguageName: 'c_sharp', // 用于 TreeSitterCoreService
    queryDir: 'csharp',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'properties', 'interfaces', 'imports', 'variables'],
    supported: true,
    priority: 1,
    maxChunkSize: 2200,
    maxLinesPerChunk: 110,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'programming'
  },
  
  swift: {
    name: 'swift',
    displayName: 'Swift',
    extensions: ['.swift'],
    aliases: ['swift'],
    treeSitterModule: 'tree-sitter-swift',
    treeSitterImport: 'default',
    queryDir: 'swift',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'types'],
    supported: true,
    priority: 2,
    maxChunkSize: 2000,
    maxLinesPerChunk: 100,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'programming'
  },
  
  kotlin: {
    name: 'kotlin',
    displayName: 'Kotlin',
    extensions: ['.kt'],
    aliases: ['kt', 'kotlin'],
    treeSitterModule: 'tree-sitter-kotlin',
    treeSitterImport: 'default',
    queryDir: 'kotlin',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'types'],
    supported: true,
    priority: 2,
    maxChunkSize: 2000,
    maxLinesPerChunk: 100,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'programming'
  },
  
  ruby: {
    name: 'ruby',
    displayName: 'Ruby',
    extensions: ['.rb'],
    aliases: ['rb', 'ruby'],
    treeSitterModule: 'tree-sitter-ruby',
    treeSitterImport: 'default',
    queryDir: 'ruby',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables'],
    supported: true,
    priority: 2,
    maxChunkSize: 1800,
    maxLinesPerChunk: 90,
    enableSemanticDetection: true,
    enableBracketBalance: false,
    supportedStrategies: ['ast', 'structure-aware'],
    category: 'programming'
  },
  
  php: {
    name: 'php',
    displayName: 'PHP',
    extensions: ['.php'],
    aliases: ['php'],
    treeSitterModule: 'tree-sitter-php',
    treeSitterImport: 'default',
    queryDir: 'php',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables'],
    supported: true,
    priority: 2,
    maxChunkSize: 1900,
    maxLinesPerChunk: 95,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'programming'
  },
  
  scala: {
    name: 'scala',
    displayName: 'Scala',
    extensions: ['.scala'],
    aliases: ['scala'],
    treeSitterModule: 'tree-sitter-scala',
    treeSitterImport: 'default',
    queryDir: 'scala',
    supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'types'],
    supported: true,
    priority: 2,
    maxChunkSize: 2000,
    maxLinesPerChunk: 100,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'programming'
  },
  
  html: {
    name: 'html',
    displayName: 'HTML',
    extensions: ['.html'],
    aliases: ['html'],
    treeSitterModule: 'tree-sitter-html',
    treeSitterImport: 'default',
    queryDir: 'html',
    supportedQueryTypes: ['elements', 'attributes'],
    supported: true,
    priority: 2,
    maxChunkSize: 1500,
    maxLinesPerChunk: 75,
    enableSemanticDetection: false,
    enableBracketBalance: true,
    supportedStrategies: ['bracket'],
    category: 'markup'
  },
  
  css: {
    name: 'css',
    displayName: 'CSS',
    extensions: ['.css'],
    aliases: ['css'],
    treeSitterModule: 'tree-sitter-css',
    treeSitterImport: 'default',
    queryDir: 'css',
    supportedQueryTypes: ['rules', 'properties', 'selectors'],
    supported: true,
    priority: 2,
    maxChunkSize: 1500,
    maxLinesPerChunk: 75,
    enableSemanticDetection: false,
    enableBracketBalance: true,
    supportedStrategies: ['bracket'],
    category: 'markup'
  },
  
  vue: {
    name: 'vue',
    displayName: 'Vue',
    extensions: ['.vue'],
    aliases: ['vue'],
    treeSitterModule: 'tree-sitter-vue',
    treeSitterImport: 'default',
    queryDir: 'vue',
    supportedQueryTypes: ['components', 'template-directives'],
    supported: true,
    priority: 2,
    maxChunkSize: 1800,
    maxLinesPerChunk: 90,
    enableSemanticDetection: true,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket', 'structure-aware'],
    category: 'markup'
  },
  
  json: {
    name: 'json',
    displayName: 'JSON',
    extensions: ['.json'],
    aliases: ['json'],
    treeSitterModule: 'tree-sitter-json',
    treeSitterImport: 'default',
    queryDir: 'json',
    supportedQueryTypes: [],
    supported: true,
    priority: 3,
    maxChunkSize: 1000,
    maxLinesPerChunk: 50,
    enableSemanticDetection: false,
    enableBracketBalance: true,
    supportedStrategies: ['bracket'],
    category: 'data'
  },
  
  yaml: {
    name: 'yaml',
    displayName: 'YAML',
    extensions: ['.yaml', '.yml'],
    aliases: ['yaml', 'yml'],
    treeSitterModule: 'tree-sitter-yaml',
    treeSitterImport: 'default',
    queryDir: 'yaml',
    supportedQueryTypes: [],
    supported: true,
    priority: 3,
    maxChunkSize: 1000,
    maxLinesPerChunk: 50,
    enableSemanticDetection: false,
    enableBracketBalance: false,
    supportedStrategies: ['structure-aware'],
    category: 'data'
  },
  
  toml: {
    name: 'toml',
    displayName: 'TOML',
    extensions: ['.toml'],
    aliases: ['toml'],
    treeSitterModule: 'tree-sitter-toml',
    treeSitterImport: 'default',
    queryDir: 'toml',
    supportedQueryTypes: [],
    supported: true,
    priority: 3,
    maxChunkSize: 1000,
    maxLinesPerChunk: 50,
    enableSemanticDetection: false,
    enableBracketBalance: false,
    supportedStrategies: ['structure-aware'],
    category: 'data'
  },
  
  xml: {
    name: 'xml',
    displayName: 'XML',
    extensions: ['.xml'],
    aliases: ['xml'],
    treeSitterModule: 'tree-sitter-xml',
    treeSitterImport: 'default',
    queryDir: 'xml',
    supportedQueryTypes: [],
    supported: true,
    priority: 3,
    maxChunkSize: 1500,
    maxLinesPerChunk: 75,
    enableSemanticDetection: false,
    enableBracketBalance: true,
    supportedStrategies: ['bracket'],
    category: 'markup'
  },
  
  markdown: {
    name: 'markdown',
    displayName: 'Markdown',
    extensions: ['.md'],
    aliases: ['md', 'markdown'],
    treeSitterModule: 'tree-sitter-markdown',
    treeSitterImport: 'default',
    queryDir: 'markdown',
    supportedQueryTypes: [],
    supported: true,
    priority: 3,
    maxChunkSize: 1200,
    maxLinesPerChunk: 60,
    enableSemanticDetection: false,
    enableBracketBalance: false,
    supportedStrategies: ['structure-aware'],
    category: 'markup'
  },
  
  shell: {
    name: 'shell',
    displayName: 'Shell',
    extensions: ['.sh', '.bash', '.zsh', '.fish'],
    aliases: ['sh', 'bash', 'zsh', 'fish', 'shell'],
    treeSitterModule: 'tree-sitter-bash',
    treeSitterImport: 'default',
    queryDir: 'shell',
    supportedQueryTypes: ['functions'],
    supported: true,
    priority: 3,
    maxChunkSize: 1500,
    maxLinesPerChunk: 75,
    enableSemanticDetection: false,
    enableBracketBalance: true,
    supportedStrategies: ['ast', 'bracket'],
    category: 'programming'
  },
  
  sql: {
    name: 'sql',
    displayName: 'SQL',
    extensions: ['.sql'],
    aliases: ['sql'],
    treeSitterModule: 'tree-sitter-sql',
    treeSitterImport: 'default',
    queryDir: 'sql',
    supportedQueryTypes: [],
    supported: true,
    priority: 3,
    maxChunkSize: 1800,
    maxLinesPerChunk: 90,
    enableSemanticDetection: false,
    enableBracketBalance: true,
    supportedStrategies: ['structure-aware'],
    category: 'programming'
  }
};

/**
 * 查询类型定义
 */
export const QUERY_TYPES = {
  FUNCTIONS: 'functions',
  CLASSES: 'classes',
  METHODS: 'methods',
  IMPORTS: 'imports',
  EXPORTS: 'exports',
  VARIABLES: 'variables',
  TYPES: 'types',
  INTERFACES: 'interfaces',
  PROPERTIES: 'properties',
  ELEMENTS: 'elements',
  ATTRIBUTES: 'attributes',
  RULES: 'rules',
  SELECTORS: 'selectors',
  COMPONENTS: 'components',
  TEMPLATE_DIRECTIVES: 'template-directives'
} as const;

/**
 * 策略类型定义
 */
export const STRATEGY_TYPES = {
  AST: 'ast',
  BRACKET: 'bracket',
  STRUCTURE_AWARE: 'structure-aware'
} as const;

/**
 * 语言分类定义
 */
export const LANGUAGE_CATEGORIES = {
  PROGRAMMING: 'programming',
  MARKUP: 'markup',
  DATA: 'data',
  CONFIG: 'config'
} as const;