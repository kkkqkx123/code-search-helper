/**
 * Parser模块统一常量管理
 * 所有parser相关的常量都应该定义在这里
 * 
 * 这个模块的目的是解决parser模块中常量定义的重复和命名冲突问题，
 * 提供一个中心化的常量管理方案。
 */

export * from './backup-constants';
export * from './language-constants';
export * from './processing-constants';

// ==================== 导出查询模式 ====================
export { solidityQuery } from "./queries/solidity"
export { default as phpQuery } from "./queries/php"
export { default as vueQuery } from "./queries/vue"
export { default as typescriptQuery } from "./queries/typescript"
export { default as tsxQuery } from "./queries/tsx"
export { default as pythonQuery } from "./queries/python"
export { default as javascriptQuery } from "./queries/javascript"
export { default as javaQuery } from "./queries/java"
export { default as jsonQuery } from "./queries/json"
export { default as rustQuery } from "./queries/rust"
export { default as rubyQuery } from "./queries/ruby"
export { default as cppQuery } from "./queries/cpp"
export { default as cQuery } from "./queries/c"
export { default as csharpQuery } from "./queries/csharp"
export { default as goQuery } from "./queries/go"
export { default as swiftQuery } from "./queries/swift"
export { default as kotlinQuery } from "./queries/kotlin"
export { default as cssQuery } from "./queries/css"
export { default as elixirQuery } from "./queries/elixir"
export { default as htmlQuery } from "./queries/html"
export { default as luaQuery } from "./queries/lua"
export { ocamlQuery } from "./queries/ocaml"
export { tomlQuery } from "./queries/toml"
export { default as systemrdlQuery } from "./queries/systemrdl"
export { default as tlaPlusQuery } from "./queries/tlaplus"
export { zigQuery } from "./queries/zig"
export { default as embeddedTemplateQuery } from "./queries/embedded_template"
export { elispQuery } from "./queries/elisp"
export { scalaQuery } from "./queries/scala"

// ==================== 语言映射常量 ====================
export const LANGUAGE_MAPPINGS = {
  // 扩展名到语言的映射
  EXTENSION_TO_LANGUAGE: {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'javascript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.c++': 'cpp',
    '.c': 'c',
    '.h': 'c',  // C头文件
    '.hpp': 'cpp', // C++头文件
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.rb': 'ruby',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.md': 'markdown',
    '.txt': 'text',
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.sql': 'sql',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.fish': 'shell',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.vue': 'vue',
    '.svelte': 'svelte',
    '.pl': 'perl',
    '.r': 'r',
    '.m': 'matlab',
    '.lua': 'lua',
    '.dart': 'dart',
    '.ex': 'elixir',
    '.exs': 'elixir',
    '.erl': 'erlang',
    '.hs': 'haskell',
    '.ml': 'ocaml',
    '.fs': 'fsharp',
    '.vb': 'visualbasic',
    '.ps1': 'powershell',
    '.bat': 'batch',
    '.cmd': 'batch',
    '.ini': 'ini',
    '.cfg': 'ini',
    '.conf': 'ini',
    '.toml': 'toml',
    '.dockerfile': 'dockerfile',
    '.makefile': 'makefile',
    '.cmake': 'cmake'
  } as const,

  // 语言到扩展名的映射
  LANGUAGE_TO_EXTENSIONS: {
    'javascript': ['.js', '.jsx'],
    'typescript': ['.ts', '.tsx'],
    'python': ['.py'],
    'java': ['.java'],
    'cpp': ['.cpp', '.cc', '.cxx', '.c++', '.hpp'],
    'c': ['.c', '.h'],
    'csharp': ['.cs'],
    'go': ['.go'],
    'rust': ['.rs'],
    'php': ['.php'],
    'ruby': ['.rb'],
    'swift': ['.swift'],
    'kotlin': ['.kt'],
    'scala': ['.scala'],
    'markdown': ['.md'],
    'text': ['.txt'],
    'json': ['.json'],
    'xml': ['.xml'],
    'yaml': ['.yaml', '.yml'],
    'sql': ['.sql'],
    'shell': ['.sh', '.bash', '.zsh', '.fish'],
    'html': ['.html'],
    'css': ['.css'],
    'scss': ['.scss'],
    'sass': ['.sass'],
    'less': ['.less'],
    'vue': ['.vue'],
    'svelte': ['.svelte'],
    'perl': ['.pl'],
    'r': ['.r'],
    'matlab': ['.m'],
    'lua': ['.lua'],
    'dart': ['.dart'],
    'elixir': ['.ex', '.exs'],
    'erlang': ['.erl'],
    'haskell': ['.hs'],
    'ocaml': ['.ml'],
    'fsharp': ['.fs'],
    'visualbasic': ['.vb'],
    'powershell': ['.ps1'],
    'batch': ['.bat', '.cmd'],
    'ini': ['.ini', '.cfg', '.conf'],
    'toml': ['.toml'],
    'dockerfile': ['.dockerfile'],
    'cmake': ['.cmake']
  } as const
} as const;

// ==================== 代码语言列表常量 ====================
/**
 * 所有支持的编程语言列表
 */
export const CODE_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
  'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'shell',
  'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'json',
  'xml', 'yaml', 'sql', 'dockerfile', 'cmake', 'perl', 'r', 'matlab',
  'lua', 'dart', 'elixir', 'erlang', 'haskell', 'ocaml', 'fsharp',
  'visualbasic', 'powershell', 'batch'
] as const;

/**
 * 结构化文件语言列表（需要特殊处理的文件类型）
 */
export const STRUCTURED_LANGUAGES = [
  'json', 'xml', 'yaml', 'html', 'css', 'scss', 'sass'
] as const;

// ==================== 缓存配置常量 ====================
/**
 * 缓存相关的配置常量，按照用途分类
 */
export const CACHE_CONFIG = {
  // 内容哈希生成器缓存配置
  CONTENT_HASH: {
    MAX_CACHE_SIZE: 10000,
    CONTENT_HASH_LENGTH: 16
  },

  // 平衡分块器缓存配置
  BALANCED_CHUNKER: {
    MAX_CACHE_SIZE: 1000
  },

  // 内容标准化缓存配置
  CONTENT_NORMALIZATION: {
    MAX_CACHE_SIZE: 10000
  },

  // LRU缓存默认配置
  LRU_CACHE: {
    DEFAULT_MAX_SIZE: 1000
  }
} as const;

// ==================== 分块配置常量 ====================
/**
 * 代码分块相关的配置常量
 */
export const CHUNKING_CONFIG = {
  // 默认分块大小限制
  DEFAULT_MAX_CHUNK_SIZE: 2000,
  DEFAULT_CHUNK_OVERLAP: 200,
  DEFAULT_MAX_LINES_PER_CHUNK: 50,

  // 块大小限制（基于kilocode经验，但根据文件大小动态调整）
  BLOCK_SIZE_LIMITS: {
    MIN_BLOCK_CHARS: 20,                    // 小文件最小块大小（原50太大）
    MAX_BLOCK_CHARS: 1000,                  // 避免AI处理超长上下文
    MAX_CHARS_TOLERANCE_FACTOR: 1.2,        // 允许1200字符的弹性空间
    MIN_CHUNK_REMAINDER_CHARS: 100          // 小文件最后一块最小大小（原200太大）
  },

  // 小文件阈值 - 小于这个大小的文件直接作为一个块处理
  SMALL_FILE_THRESHOLD: {
    CHARS: 300,    // 300字符以下
    LINES: 15      // 15行以下
  },

  // 重叠配置(仅用于非代码/拆分后的长代码)
  OVERLAP: {
    DEFAULT_SIZE: 200,
    MAX_RATIO: 0.3,  // 最大重叠比例
    MIN_SIZE: 20     // 最小重叠大小
  }
} as const;

// ==================== 相似度配置常量 ====================
/**
 * 内容相似度计算相关的配置常量
 */
export const SIMILARITY_CONFIG = {
  // 默认相似度阈值
  DEFAULT_THRESHOLD: 0.8,

  // 最小内容长度（低于此长度的内容不参与相似度比较）
  MIN_CONTENT_LENGTH: 10,

  // 哈希相关配置
  HASH: {
    PREFIX_LENGTH: 8,  // 哈希前缀长度（用于快速比较）
    ALGORITHM: 'sha256'
  }
} as const;

// ==================== 备份文件模式常量 ====================
/**
 * 备份文件识别相关的配置常量
 */
export const BACKUP_FILE_PATTERNS = [
  '.bak',
  '.backup',
  '.old',
  '.tmp',
  '.temp',
  '.orig',
  '.save',
  '.swp', // Vim swap files
  '.swo', // Vim swap files
  '~',    // Emacs backup files
  '.bak$', // Regex pattern for .bak at end
  '.backup$',
  '.old$',
  '.tmp$',
  '.temp$'
] as const;

// ==================== 错误处理配置常量 ====================
/**
 * 错误处理相关的配置常量
 */
export const ERROR_CONFIG = {
  // 最大错误数量限制
  MAX_ERRORS: 5,

  // 错误重置时间间隔（毫秒）
  ERROR_RESET_INTERVAL: 60000, // 1分钟

  // 错误阈值管理器配置
  ERROR_THRESHOLD_MAX_ERRORS: 5,
  ERROR_THRESHOLD_RESET_INTERVAL: 60000
} as const;

// ==================== 内存配置常量 ====================
/**
 * 内存管理相关的配置常量
 */
export const MEMORY_CONFIG = {
  // 默认内存限制（MB）
  MEMORY_LIMIT_MB: 500,

  // 内存检查间隔（毫秒）
  MEMORY_CHECK_INTERVAL: 5000, // 5秒

  // 内存保护配置
  MEMORY_GUARD_DEFAULT_LIMIT_MB: 500,
  MEMORY_GUARD_CRITICAL_THRESHOLD_PERCENT: 90,  // 90%为临界阈值
  MEMORY_GUARD_WARNING_THRESHOLD_PERCENT: 80    // 80%为警告阈值
} as const;

// ==================== Shebang模式常量 ====================
/**
 * Shebang脚本识别模式
 */
export const SHEBANG_PATTERNS: ReadonlyArray<[string, string]> = [
  ['#!/bin/bash', 'shell'],
  ['#!/bin/sh', 'shell'],
  ['#!/usr/bin/env bash', 'shell'],
  ['#!/usr/bin/env sh', 'shell'],
  ['#!/usr/bin/env python', 'python'],
  ['#!/usr/bin/env python3', 'python'],
  ['#!/usr/bin/env python2', 'python'],
  ['#!/usr/bin/python', 'python'],
  ['#!/usr/bin/python3', 'python'],
  ['#!/usr/bin/env node', 'javascript'],
  ['#!/usr/bin/env nodejs', 'javascript'],
  ['#!/usr/bin/env ruby', 'ruby'],
  ['#!/usr/bin/env perl', 'perl'],
  ['#!/usr/bin/env lua', 'lua']
];

// ==================== 语法模式常量 ====================
/**
 * 代码语法分析相关的模式常量
 */
export const SYNTAX_PATTERNS = {
  // 函数开始模式
  FUNCTION_START: [
    /^\s*(?:export\s+)?(?:async\s+)?function\s+\w+/,
    /^\s*(?:export\s+)?const\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function)/,
    /^\s*(?:export\s+)?let\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function)/,
    /^\s*(?:export\s+)?var\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function)/,
    /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?(?:async\s+)?\w+\s+\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*{/,
    /^\s*def\s+\w+\s*\(/,
    /^\s*fn\s+\w+\s*\(/,
    /^\s*(?:pub\s+)?fn\s+\w+\s*\(/,
    /^\s*func\s+(?:\(\w+\s+\*?\w+\)\s+)?\w+\s*\(/,
    /^\s*(?:function|procedure)\s+\w+\s*\(/i
  ],

  // 类开始模式
  CLASS_START: [
    /^\s*(?:export\s+)?class\s+\w+/,
    /^\s*(?:export\s+)?interface\s+\w+/,
    /^\s*(?:export\s+)?(?:abstract\s+)?class\s+\w+/,
    /^\s*(?:public|private|protected|internal)?\s*(?:static\s+)?class\s+\w+/,
    /^\s*class\s+\w+\s*\(/,
    /^\s*(?:pub\s+)?struct\s+\w+/,
    /^\s*(?:pub\s+)?enum\s+\w+/,
    /^\s*type\s+\w+\s+struct\s*\{/,
    /^\s*data\s+class\s+\w+/,
    /^\s*object\s+\w+/i
  ],

  // 导入语句模式
  IMPORT_PATTERNS: [
    /^\s*(?:import|require|using|use|extern|include|from\s+\S+\s+import)/,
    /^\s*#include\s*[<"]/,
    /^\s*@import/
  ]
} as const;

// ==================== 辅助函数 ====================

/**
 * 根据文件大小动态调整块大小限制
 * 
 * @param contentLength - 内容长度（字符数）
 * @param lineCount - 行数
 * @returns 动态调整的块大小限制配置
 */
export const getDynamicBlockLimits = (contentLength: number, lineCount: number) => {
  // 小文件：放宽限制
  if (contentLength < 500 || lineCount < 20) {
    return {
      MIN_BLOCK_CHARS: 10,
      MAX_BLOCK_CHARS: 800,
      MAX_CHARS_TOLERANCE_FACTOR: 1.5,
      MIN_CHUNK_REMAINDER_CHARS: 50
    };
  }

  // 中等文件：标准限制
  if (contentLength < 2000 || lineCount < 100) {
    return CHUNKING_CONFIG.BLOCK_SIZE_LIMITS;
  }

  // 大文件：严格限制
  return {
    MIN_BLOCK_CHARS: 50,
    MAX_BLOCK_CHARS: 1000,
    MAX_CHARS_TOLERANCE_FACTOR: 1.2,
    MIN_CHUNK_REMAINDER_CHARS: 200
  };
};

/**
 * 获取所有支持的编程语言
 * 
 * @returns 所有支持的编程语言名称数组
 */
export const getAllSupportedLanguages = (): readonly string[] => {
  return Object.keys(LANGUAGE_MAPPINGS.LANGUAGE_TO_EXTENSIONS);
};

/**
 * 检查编程语言是否受支持
 * 
 * @param language - 编程语言名称
 * @returns 是否支持该语言
 */
export const isLanguageSupported = (language: string): boolean => {
  if (!language) return false;
  const normalizedLanguage = language.toLowerCase();
  return normalizedLanguage in LANGUAGE_MAPPINGS.LANGUAGE_TO_EXTENSIONS;
};

/**
 * 根据扩展名获取编程语言
 * 
 * @param ext - 文件扩展名（包含点号，如 '.js'）
 * @returns 编程语言名称或undefined
 */
export const getLanguageByExtension = (ext: string): string | undefined => {
  if (!ext) return undefined;
  const normalizedExt = ext.toLowerCase();
  return (LANGUAGE_MAPPINGS.EXTENSION_TO_LANGUAGE as any)[normalizedExt];
};

/**
 * 根据编程语言获取所有支持的扩展名
 * 
 * @param language - 编程语言名称
 * @returns 文件扩展名数组
 */
export const getExtensionsByLanguage = (language: string): string[] => {
  if (!language) return [];
  const normalizedLanguage = language.toLowerCase();
  return (LANGUAGE_MAPPINGS.LANGUAGE_TO_EXTENSIONS as any)[normalizedLanguage] || [];
};

/**
 * 根据文件路径获取编程语言
 * 
 * @param filePath - 文件路径
 * @returns 编程语言名称或undefined
 */
export const getLanguageFromPath = (filePath: string): string | undefined => {
  if (!filePath) return undefined;

  // 提取文件扩展名
  const lastDotIndex = filePath.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === filePath.length - 1) {
    return undefined;
  }

  const ext = filePath.substring(lastDotIndex);
  return getLanguageByExtension(ext);
};

/**
 * 检查文件扩展名是否受支持
 * 
 * @param ext - 文件扩展名
 * @returns 是否支持该扩展名
 */
export const isExtensionSupported = (ext: string): boolean => {
  if (!ext) return false;
  const normalizedExt = ext.toLowerCase();
  return normalizedExt in LANGUAGE_MAPPINGS.EXTENSION_TO_LANGUAGE;
};

/**
 * 获取语言映射的只读副本
 * 
 * @returns 扩展名到语言的映射对象副本
 */
export const getExtensionToLanguageMap = (): Readonly<Record<string, string>> => {
  return { ...LANGUAGE_MAPPINGS.EXTENSION_TO_LANGUAGE };
};

/**
 * 获取语言到扩展名映射的只读副本
 * 
 * @returns 语言到扩展名的映射对象副本
 */
export const getLanguageToExtensionsMap = (): Record<string, string[]> => {
  return { ...LANGUAGE_MAPPINGS.LANGUAGE_TO_EXTENSIONS as any };
};