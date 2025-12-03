/**
 * 基本编程语言配置
 * 包含仅有单个 .ts 文件的简单查询语言
 */
import { LanguageConfig, LanguageStrategy } from './LanguageCore';

export const BASIC_PROGRAMMING_STRATEGY: LanguageStrategy = {
  primary: 'ast',
  fallback: ['line'],
  useSimplifiedAST: true,
  supportedQueryTypes: ['functions', 'classes'],
  maxQueryDepth: 3
};

export const BASIC_PROGRAMMING_LANGUAGES: LanguageConfig[] = [
  {
    name: 'php',
    displayName: 'PHP',
    queryDir: 'php',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.php'],
    aliases: ['php'],
    strategy: BASIC_PROGRAMMING_STRATEGY
  },
  
  {
    name: 'ruby',
    displayName: 'Ruby',
    queryDir: 'ruby',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.rb'],
    aliases: ['rb', 'ruby'],
    strategy: BASIC_PROGRAMMING_STRATEGY
  },
  
  {
    name: 'scala',
    displayName: 'Scala',
    queryDir: 'scala',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.scala'],
    aliases: ['scala'],
    strategy: BASIC_PROGRAMMING_STRATEGY
  },
  
  {
    name: 'swift',
    displayName: 'Swift',
    queryDir: 'swift',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.swift'],
    aliases: ['swift'],
    strategy: BASIC_PROGRAMMING_STRATEGY
  },
  
  {
    name: 'solidity',
    displayName: 'Solidity',
    queryDir: 'solidity',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.sol'],
    aliases: ['solidity'],
    strategy: {
      ...BASIC_PROGRAMMING_STRATEGY,
      supportedQueryTypes: ['functions', 'classes']
    }
  },
  
  {
    name: 'elixir',
    displayName: 'Elixir',
    queryDir: 'elixir',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.ex', '.exs'],
    aliases: ['elixir'],
    strategy: {
      ...BASIC_PROGRAMMING_STRATEGY,
      supportedQueryTypes: ['functions', 'modules']
    }
  },
  
  {
    name: 'ocaml',
    displayName: 'OCaml',
    queryDir: 'ocaml',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.ml', '.mli'],
    aliases: ['ocaml'],
    strategy: {
      ...BASIC_PROGRAMMING_STRATEGY,
      supportedQueryTypes: ['functions', 'types']
    }
  },
  
  {
    name: 'lua',
    displayName: 'Lua',
    queryDir: 'lua',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.lua'],
    aliases: ['lua'],
    strategy: {
      ...BASIC_PROGRAMMING_STRATEGY,
      supportedQueryTypes: ['functions']
    }
  },
  
  {
    name: 'zig',
    displayName: 'Zig',
    queryDir: 'zig',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.zig'],
    aliases: ['zig'],
    strategy: {
      ...BASIC_PROGRAMMING_STRATEGY,
      supportedQueryTypes: ['functions', 'types']
    }
  },
  
  {
    name: 'elisp',
    displayName: 'Emacs Lisp',
    queryDir: 'elisp',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.el', '.elisp'],
    aliases: ['elisp'],
    strategy: {
      ...BASIC_PROGRAMMING_STRATEGY,
      supportedQueryTypes: ['functions']
    }
  },
  
  {
    name: 'systemrdl',
    displayName: 'SystemRDL',
    queryDir: 'systemrdl',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.rdl'],
    aliases: ['systemrdl'],
    strategy: {
      ...BASIC_PROGRAMMING_STRATEGY,
      supportedQueryTypes: ['components', 'fields']
    }
  },
  
  {
    name: 'tlaplus',
    displayName: 'TLA+',
    queryDir: 'tlaplus',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.tla', '.cfg'],
    aliases: ['tlaplus'],
    strategy: {
      ...BASIC_PROGRAMMING_STRATEGY,
      supportedQueryTypes: ['operators', 'specs']
    }
  },
  
  {
    name: 'embedded_template',
    displayName: 'Embedded Template',
    queryDir: 'embedded_template',
    hasSubdir: false,
    category: 'basic_programming',
    extensions: ['.html', '.vue', '.jsx', '.tsx'],
    aliases: ['embedded_template'],
    strategy: {
      ...BASIC_PROGRAMMING_STRATEGY,
      supportedQueryTypes: ['expressions', 'statements']
    }
  }
];