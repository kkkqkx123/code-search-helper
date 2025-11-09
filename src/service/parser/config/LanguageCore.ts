/**
 * 核心语言定义
 * 基于实际目录结构定义的语言分类系统
 */

export interface LanguageStrategy {
  primary: string;
  fallback: string[];
  useFullAST?: boolean;
  useSimplifiedAST?: boolean;
  supportedQueryTypes?: string[];
  maxQueryDepth: number;
  skipComplexQueries?: boolean;
  skipASTParsing?: boolean;
  skipSyntaxAnalysis?: boolean;
  skipSemanticAnalysis?: boolean;
  specializedProcessor?: string;
}

export interface LanguageConfig {
  name: string;
  displayName: string;
  queryDir: string;
  hasSubdir: boolean;
  strategy: LanguageStrategy;
  category: 'advanced_programming' | 'basic_programming' | 'data_format' | 'special_processing' | 'hybrid_processing' | 'text_format';
  extensions: string[];
  aliases: string[];
}

// 高级编程语言（复杂 AST 查询）
export const ADVANCED_PROGRAMMING_LANGUAGES = [
  'typescript', 'javascript', 'python', 'java', 'cpp', 'c',
  'go', 'rust', 'csharp', 'kotlin', 'tsx', 'vue'
];

// 基本编程语言（简单 AST 查询）
export const BASIC_PROGRAMMING_LANGUAGES = [
  'php', 'ruby', 'scala', 'swift', 'solidity', 'elixir',
  'ocaml', 'lua', 'zig', 'elisp', 'systemrdl', 'tlaplus', 'embedded_template'
];

// 数据格式语言（结构化查询）
export const DATA_FORMAT_LANGUAGES = ['json', 'yaml', 'toml'];

// 特殊处理语言（跳过 AST）
export const SPECIAL_PROCESSING_LANGUAGES = ['markdown', 'xml'];

// 混合处理语言
export const HYBRID_LANGUAGES = ['html', 'css'];

/**
 * 语言配置映射
 * 基于实际的目录结构和查询规则复杂度进行分类
 */
export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  // 高级编程语言
  typescript: {
    name: 'typescript',
    displayName: 'TypeScript',
    queryDir: 'typescript',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.ts', '.tsx'],
    aliases: ['ts', 'typescript'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['structure_aware', 'function'],
      useFullAST: true,
      supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'exports', 'variables', 'types', 'interfaces', 'control-flow', 'data-flow', 'expressions'],
      maxQueryDepth: 10
    }
  },

  javascript: {
    name: 'javascript',
    displayName: 'JavaScript',
    queryDir: 'javascript',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.js', '.jsx'],
    aliases: ['js', 'javascript'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['structure_aware', 'function'],
      useFullAST: true,
      supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'exports', 'variables', 'types', 'control-flow', 'data-flow', 'expressions'],
      maxQueryDepth: 10
    }
  },

  python: {
    name: 'python',
    displayName: 'Python',
    queryDir: 'python',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.py'],
    aliases: ['py', 'python'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['structure_aware', 'function'],
      useFullAST: true,
      supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'types', 'data-flow', 'control-flow'],
      maxQueryDepth: 10
    }
  },

  java: {
    name: 'java',
    displayName: 'Java',
    queryDir: 'java',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.java'],
    aliases: ['java'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['structure_aware', 'function'],
      useFullAST: true,
      supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'types', 'interfaces'],
      maxQueryDepth: 10
    }
  },

  cpp: {
    name: 'cpp',
    displayName: 'C++',
    queryDir: 'cpp',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.cpp', '.cc', '.cxx', '.c++', '.hpp'],
    aliases: ['c++', 'cpp', 'cxx'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['structure_aware', 'function'],
      useFullAST: true,
      supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'variables', 'types', 'namespaces', 'modern-features'],
      maxQueryDepth: 10
    }
  },

  go: {
    name: 'go',
    displayName: 'Go',
    queryDir: 'go',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.go'],
    aliases: ['go'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['structure_aware', 'function'],
      useFullAST: true,
      supportedQueryTypes: ['functions', 'concurrency', 'data-flow'],
      maxQueryDepth: 10
    }
  },

  rust: {
    name: 'rust',
    displayName: 'Rust',
    queryDir: 'rust',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.rs'],
    aliases: ['rs', 'rust'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['structure_aware', 'function'],
      useFullAST: true,
      supportedQueryTypes: ['functions', 'modules', 'types', 'macros'],
      maxQueryDepth: 10
    }
  },

  csharp: {
    name: 'csharp',
    displayName: 'C#',
    queryDir: 'csharp',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.cs'],
    aliases: ['c#', 'csharp'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['structure_aware', 'function'],
      useFullAST: true,
      supportedQueryTypes: ['functions', 'classes', 'methods', 'properties', 'patterns'],
      maxQueryDepth: 10
    }
  },

  kotlin: {
    name: 'kotlin',
    displayName: 'Kotlin',
    queryDir: 'kotlin',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.kt'],
    aliases: ['kt', 'kotlin'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['structure_aware', 'function'],
      useFullAST: true,
      supportedQueryTypes: ['functions', 'classes', 'methods', 'properties'],
      maxQueryDepth: 10
    }
  },

  tsx: {
    name: 'tsx',
    displayName: 'TSX',
    queryDir: 'tsx',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.tsx'],
    aliases: ['tsx'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['structure_aware', 'function'],
      useFullAST: true,
      supportedQueryTypes: ['components', 'jsx', 'types-hooks'],
      maxQueryDepth: 10
    }
  },

  vue: {
    name: 'vue',
    displayName: 'Vue',
    queryDir: 'vue',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.vue'],
    aliases: ['vue'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['structure_aware', 'function'],
      useFullAST: true,
      supportedQueryTypes: ['components', 'template-directives'],
      maxQueryDepth: 10
    }
  },

  c: {
    name: 'c',
    displayName: 'C',
    queryDir: 'c',
    hasSubdir: true,
    category: 'advanced_programming',
    extensions: ['.c', '.h'],
    aliases: ['c'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['structure_aware', 'function'],
      useFullAST: true,
      supportedQueryTypes: ['functions', 'control-flow', 'data-flow'],
      maxQueryDepth: 10
    }
  },

  html: {
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

  css: {
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
  },

  // 基本编程语言
  php: {
    name: 'php',
    displayName: 'PHP',
    queryDir: 'php',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.php'],
    aliases: ['php'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['functions', 'classes'],
      maxQueryDepth: 3
    }
  },

  ruby: {
    name: 'ruby',
    displayName: 'Ruby',
    queryDir: 'ruby',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.rb'],
    aliases: ['rb', 'ruby'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['functions', 'classes'],
      maxQueryDepth: 3
    }
  },

  scala: {
    name: 'scala',
    displayName: 'Scala',
    queryDir: 'scala',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.scala'],
    aliases: ['scala'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['functions', 'classes'],
      maxQueryDepth: 3
    }
  },

  swift: {
    name: 'swift',
    displayName: 'Swift',
    queryDir: 'swift',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.swift'],
    aliases: ['swift'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['functions', 'classes'],
      maxQueryDepth: 3
    }
  },

  solidity: {
    name: 'solidity',
    displayName: 'Solidity',
    queryDir: 'solidity',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.sol'],
    aliases: ['solidity'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['functions', 'classes'],
      maxQueryDepth: 3
    }
  },

  elixir: {
    name: 'elixir',
    displayName: 'Elixir',
    queryDir: 'elixir',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.ex', '.exs'],
    aliases: ['elixir'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['functions', 'modules'],
      maxQueryDepth: 3
    }
  },

  ocaml: {
    name: 'ocaml',
    displayName: 'OCaml',
    queryDir: 'ocaml',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.ml', '.mli'],
    aliases: ['ocaml'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['functions', 'types'],
      maxQueryDepth: 3
    }
  },

  lua: {
    name: 'lua',
    displayName: 'Lua',
    queryDir: 'lua',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.lua'],
    aliases: ['lua'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['functions'],
      maxQueryDepth: 3
    }
  },

  zig: {
    name: 'zig',
    displayName: 'Zig',
    queryDir: 'zig',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.zig'],
    aliases: ['zig'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['functions', 'types'],
      maxQueryDepth: 3
    }
  },

  elisp: {
    name: 'elisp',
    displayName: 'Emacs Lisp',
    queryDir: 'elisp',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.el', '.elisp'],
    aliases: ['elisp'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['functions'],
      maxQueryDepth: 3
    }
  },

  systemrdl: {
    name: 'systemrdl',
    displayName: 'SystemRDL',
    queryDir: 'systemrdl',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.rdl'],
    aliases: ['systemrdl'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['components', 'fields'],
      maxQueryDepth: 3
    }
  },

  tlaplus: {
    name: 'tlaplus',
    displayName: 'TLA+',
    queryDir: 'tlaplus',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.tla', '.cfg'],
    aliases: ['tlaplus'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['operators', 'specs'],
      maxQueryDepth: 3
    }
  },

  embedded_template: {
    name: 'embedded_template',
    displayName: 'Embedded Template',
    queryDir: 'embedded_template',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.html', '.vue', '.jsx', '.tsx'],
    aliases: ['embedded_template'],
    strategy: {
      primary: 'treesitter_ast',
      fallback: ['universal_line'],
      useSimplifiedAST: true,
      supportedQueryTypes: ['expressions', 'statements'],
      maxQueryDepth: 3
    }
  },

  // 数据格式语言
  json: {
    name: 'json',
    displayName: 'JSON',
    queryDir: 'json',
    hasSubdir: false,
    category: 'data_format',
    extensions: ['.json'],
    aliases: ['json'],
    strategy: {
      primary: 'universal_bracket',
      fallback: ['universal_line'],
      skipComplexQueries: true,
      maxQueryDepth: 2
    }
  },

  yaml: {
    name: 'yaml',
    displayName: 'YAML',
    queryDir: 'yaml',
    hasSubdir: false,
    category: 'data_format',
    extensions: ['.yaml', '.yml'],
    aliases: ['yaml', 'yml'],
    strategy: {
      primary: 'universal_bracket',
      fallback: ['universal_line'],
      skipComplexQueries: true,
      maxQueryDepth: 2
    }
  },

  toml: {
    name: 'toml',
    displayName: 'TOML',
    queryDir: 'toml',
    hasSubdir: false,
    category: 'data_format',
    extensions: ['.toml'],
    aliases: ['toml'],
    strategy: {
      primary: 'universal_bracket',
      fallback: ['universal_line'],
      skipComplexQueries: true,
      maxQueryDepth: 2
    }
  },

  // 特殊处理语言
  markdown: {
    name: 'markdown',
    displayName: 'Markdown',
    queryDir: 'markdown',
    hasSubdir: false,
    category: 'special_processing',
    extensions: ['.md', '.markdown'],
    aliases: ['md', 'markdown'],
    strategy: {
      primary: 'specialized_processor',
      skipASTParsing: true,
      specializedProcessor: 'MarkdownTextStrategy',
      maxQueryDepth: 1,
      fallback: ['universal_line']
    }
  },

  xml: {
    name: 'xml',
    displayName: 'XML',
    queryDir: 'xml',
    hasSubdir: false,
    category: 'special_processing',
    extensions: ['.xml'],
    aliases: ['xml'],
    strategy: {
      primary: 'specialized_processor',
      skipASTParsing: true,
      specializedProcessor: 'XMLTextStrategy',
      maxQueryDepth: 1,
      fallback: ['universal_line']
    }
  }
};