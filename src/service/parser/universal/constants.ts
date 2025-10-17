/**
 * 通用文件处理常量定义
 */

// 备份文件模式常量
export const BACKUP_FILE_PATTERNS = [
  '.bak',
  '.backup',
  '.old',
  '.tmp',
  '.temp',
  '.orig',
  '.save',
  '.bak$', // Regex pattern for .bak at end
  '.backup$',
  '.old$',
  '.tmp$',
  '.temp$'
];

// 备份文件类型映射
export const BACKUP_FILE_TYPE_MAP = {
  '.bak': 'standard-backup',
  '.backup': 'full-backup',
  '.old': 'old-version',
  '.tmp': 'temporary',
  '.temp': 'temporary',
  '.orig': 'original',
  '.save': 'saved'
} as const;

// 语言映射常量
export const LANGUAGE_MAP: Record<string, string> = {
  '.js': 'javascript',
  '.ts': 'typescript',
  '.jsx': 'javascript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.cpp': 'cpp',
  '.c': 'c',
  '.h': 'cpp',
  '.hpp': 'cpp',
  '.cs': 'csharp',
  '.go': 'go',
  '.rs': 'rust',
  '.php': 'php',
  '.rb': 'ruby',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.md': 'markdown',
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
  '.txt': 'text',
  '.log': 'log',
  '.ini': 'ini',
  '.cfg': 'ini',
  '.conf': 'ini',
  '.toml': 'toml',
  '.dockerfile': 'dockerfile',
  '.makefile': 'makefile',
  '.cmake': 'cmake',
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
  '.cmd': 'batch'
};

// 代码语言列表常量
export const CODE_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
  'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'shell',
  'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'json',
  'xml', 'yaml', 'sql', 'dockerfile', 'cmake', 'perl', 'r', 'matlab',
  'lua', 'dart', 'elixir', 'erlang', 'haskell', 'ocaml', 'fsharp',
  'visualbasic', 'powershell', 'batch'
];

// 结构化文件语言列表
export const STRUCTURED_LANGUAGES = [
  'json', 'xml', 'yaml', 'html', 'css', 'scss', 'sass'
];

// 块大小限制常量（基于kilocode经验，但根据文件大小动态调整）
export const BLOCK_SIZE_LIMITS = {
  MIN_BLOCK_CHARS: 20,                    // 小文件最小块大小（原50太大）
  MAX_BLOCK_CHARS: 1000,                  // 避免AI处理超长上下文
  MAX_CHARS_TOLERANCE_FACTOR: 1.2,        // 允许1200字符的弹性空间
  MIN_CHUNK_REMAINDER_CHARS: 100          // 小文件最后一块最小大小（原200太大）
} as const;

// 根据文件大小动态调整块大小限制
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
    return BLOCK_SIZE_LIMITS;
  }
  
  // 大文件：严格限制
  return {
    MIN_BLOCK_CHARS: 50,
    MAX_BLOCK_CHARS: 1000,
    MAX_CHARS_TOLERANCE_FACTOR: 1.2,
    MIN_CHUNK_REMAINDER_CHARS: 200
  };
};

// 小文件阈值 - 小于这个大小的文件直接作为一个块处理
export const SMALL_FILE_THRESHOLD = {
  CHARS: 300,    // 300字符以下
  LINES: 15      // 15行以下
} as const;

// 配置默认值常量
export const DEFAULT_CONFIG = {
  // 错误处理配置
  MAX_ERRORS: 5,
  ERROR_RESET_INTERVAL: 60000, // 1分钟
  
  // 内存限制配置
  MEMORY_LIMIT_MB: 500,
  MEMORY_CHECK_INTERVAL: 5000, // 5秒
  
  // 分段参数配置
  MAX_CHUNK_SIZE: 2000,
  CHUNK_OVERLAP: 200,
  MAX_LINES_PER_CHUNK: 50,
  
  // 文本分段器配置
  TEXT_SPLITTER_OPTIONS: {
    maxChunkSize: 2000,
    overlapSize: 200,
    maxLinesPerChunk: 50,
    errorThreshold: 5,
    memoryLimitMB: 500,
    enableBracketBalance: true,
    enableSemanticDetection: true
  },
  
  // 备份文件模式
  BACKUP_FILE_PATTERNS: ['.bak', '.backup', '.old', '.tmp', '.temp', '.orig', '.save']
} as const;

// Shebang模式常量
export const SHEBANG_PATTERNS: [string, string][] = [
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
  ['#!/usr/bin/node', 'javascript'],
  ['#!/usr/bin/env ruby', 'ruby'],
  ['#!/usr/bin/env perl', 'perl'],
  ['#!/usr/bin/env php', 'php'],
  ['#!/usr/bin/env lua', 'lua'],
  ['#!/usr/bin/env awk', 'awk'],
  ['#!/usr/bin/env sed', 'sed'],
  ['#!/usr/bin/env tcl', 'tcl'],
  ['#!/usr/bin/env expect', 'expect'],
  ['#!/usr/bin/env fish', 'fish'],
  ['#!/usr/bin/env zsh', 'shell'],
  ['#!/usr/bin/env ksh', 'shell'],
  ['#!/usr/bin/env csh', 'shell'],
  ['#!/usr/bin/env tcsh', 'shell']
];

// 语法模式常量
export const SYNTAX_PATTERNS: Record<string, RegExp[]> = {
  python: [
    /^import\s+\w+/m,
    /^from\s+\w+\s+import/m,
    /^def\s+\w+\s*\(/m,
    /^class\s+\w+/m,
    /print\s*\(/m,
    /self\./m,
    /if\s+__name__\s*==\s*['"']__main__['"']/m,
    /#\s*.*$/m, // Python注释
    /\"\"\"[\s\S]*?\"\"\"/m, // Python多行注释
    /'''[\s\S]*?'''/m
  ],
  javascript: [
    /function\s+\w+\s*\(/m,
    /const\s+\w+\s*=/m,
    /let\s+\w+\s*=/m,
    /var\s+\w+\s*=/m,
    /import\s+.*from\s+['"`]/m,
    /export\s+(default\s+)?/m,
    /require\s*\(/m,
    /module\.exports/m,
    /console\.log/m,
    /=>\s*{/m, // 箭头函数
    /\/\*[\s\S]*?\*\//m, // 多行注释
    /\/\/.*$/m // 单行注释
  ],
  typescript: [
    /function\s+\w+\s*\(/m,
    /const\s+\w+\s*=/m,
    /let\s+\w+\s*=/m,
    /var\s+\w+\s*=/m,
    /import\s+.*from\s+['"`]/m,
    /export\s+(default\s+)?/m,
    /require\s*\(/m,
    /module\.exports/m,
    /console\.log/m,
    /=>\s*{/m, // 箭头函数
    /\/\*[\s\S]*?\*\//m, // 多行注释
    /\/\/.*$/m, // 单行注释
    // TypeScript特有模式
    /interface\s+\w+/m,
    /type\s+\w+\s*=/m,
    /declare\s+/m,
    /as\s+\w+/m,
    /:\s*(string|number|boolean|void|any|unknown)/m,
    /Promise<[^>]+>/m,
    /Array<[^>]+>/m,
    /enum\s+\w+/m,
    /abstract\s+class/m,
    /implements\s+\w+/m,
    /extends\s+\w+/m,
    /private\s+/m,
    /public\s+/m,
    /protected\s+/m,
    /readonly\s+/m
  ],
  java: [
    /public\s+class\s+\w+/m,
    /private\s+class\s+\w+/m,
    /package\s+[\w.]+/m,
    /import\s+[\w.]+/m,
    /public\s+static\s+void\s+main/m,
    /System\.out\.println/m,
    /@\w+/m, // 注解
    /extends\s+\w+/m,
    /implements\s+\w+/m,
    /throws\s+\w+/m,
    /@\w+/m
  ],
  cpp: [
    /#include\s*<[^>]+>/m,
    /#include\s*"[^"]+"/m,
    /using\s+namespace\s+\w+/m,
    /std::/m,
    /cout\s*<</m,
    /cin\s*>>/m,
    /template\s*<[^>]*>/m,
    /class\s+\w+/m,
    /namespace\s+\w+/m,
    /\/\*[\s\S]*?\*\//m,
    /\/\/.*$/m
  ],
  c: [
    /#include\s*<[^>]+>/m,
    /#include\s*"[^"]+"/m,
    /printf\s*\(/m,
    /scanf\s*\(/m,
    /malloc\s*\(/m,
    /free\s*\(/m,
    /struct\s+\w+/m,
    /typedef\s+/m,
    /\/\*[\s\S]*?\*\//m,
    /\/\/.*$/m
  ],
  go: [
    /package\s+\w+/m,
    /import\s*\(/m,
    /import\s+"[^"]+"/m,
    /func\s+\w+\s*\(/m,
    /go\s+\w+\s*\(/m,
    /chan\s+\w+/m,
    /select\s*{/m,
    /defer\s+/m,
    /range\s+/m,
    /\/\/.*$/m,
    /\/\*[\s\S]*?\*\//m
  ],
  rust: [
    /use\s+[\w:]+/m,
    /fn\s+\w+\s*\(/m,
    /let\s+mut\s+\w+/m,
    /let\s+\w+/m,
    /impl\s+\w+/m,
    /struct\s+\w+/m,
    /enum\s+\w+/m,
    /match\s+\w+\s*{/m,
    /Some\(/m,
    /None/m,
    /Ok\(/m,
    /Err\(/m,
    /->\s+\w+/m,
    /\/\/.*$/m,
    /\/\*[\s\S]*?\*\//m
  ],
  ruby: [
    /require\s+['"`][^'"`]+['"`]/m,
    /def\s+\w+/m,
    /class\s+\w+/m,
    /module\s+\w+/m,
    /puts\s+/m,
    /print\s+/m,
    /@\w+/m, // 实例变量
    /\$\w+/m, // 全局变量
    /\w+\s*do\s*\|/m,
    /end\s*$/m,
    /#\s*.*$/m
  ],
  php: [
    /<\?php/m,
    /\$\w+\s*=/m, // 变量
    /function\s+\w+\s*\(/m,
    /class\s+\w+/m,
    /echo\s+/m,
    /print\s+/m,
    /include\s+/m,
    /require\s+/m,
    /namespace\s+\w+/m,
    /use\s+\w+/m,
    /\/\*[\s\S]*?\*\//m,
    /\/\/.*$/m
  ],
  shell: [
    /#!\/bin\/[a-z]+/m,
    /\$\{?\w+\}?/m, // 变量
    /function\s+\w+\s*\(\s*\)/m,
    /if\s+\[/m,
    /for\s+\w+/m,
    /while\s+/m,
    /echo\s+/m,
    /export\s+\w+/m,
    /#\s*.*$/m
  ],
  json: [
    /^\s*\{[\s\S]*\}\s*$/m,
    /^\s*\[[\s\S]*\]\s*$/m,
    /"\w+"\s*:/m,
    /:\s*"[^"]*"/m,
    /:\s*\d+/m,
    /:\s*(true|false|null)/m
  ],
  yaml: [
    /^\w+:\s*.*$/m,
    /^\s+-\s+/m,
    /^\s*\w+:\s*\n(\s{2,}.*\n)*/m,
    /true|false|null/m,
    /#\s*.*$/m
  ],
  html: [
    /<!DOCTYPE\s+html>/i,
    /<html[^>]*>/i,
    /<head[^>]*>/i,
    /<body[^>]*>/i,
    /<div[^>]*>/i,
    /<script[^>]*>/i,
    /<style[^>]*>/i,
    /<link[^>]*>/i,
    /<meta[^>]*>/i,
    /<!--[\s\S]*?-->/m
  ],
  css: [
    /\w+\s*\{\s*[^}]*\}/m,
    /\.\w+\s*\{/m, // 类选择器
    /#\w+\s*\{/m, // ID选择器
    /@\w+/m, // @规则
    /color\s*:/m,
    /background\s*:/m,
    /margin\s*:/m,
    /padding\s*:/m,
    /\/\*[\s\S]*?\*\//m
  ],
  sql: [
    /SELECT\s+.+\s+FROM\s+/i,
    /INSERT\s+INTO\s+/i,
    /UPDATE\s+.+\s+SET\s+/i,
    /DELETE\s+FROM\s+/i,
    /CREATE\s+TABLE\s+/i,
    /ALTER\s+TABLE\s+/i,
    /DROP\s+TABLE\s+/i,
    /WHERE\s+/i,
    /ORDER\s+BY\s+/i,
    /GROUP\s+BY\s+/i,
    /HAVING\s+/i,
    /JOIN\s+/i,
    /--\s*.*$/m,
    /\/\*[\s\S]*?\*\//m
  ],
  dockerfile: [
    /FROM\s+\w+/i,
    /RUN\s+/i,
    /COPY\s+/i,
    /ADD\s+/i,
    /CMD\s+/i,
    /ENTRYPOINT\s+/i,
    /ENV\s+/i,
    /EXPOSE\s+/i,
    /VOLUME\s+/i,
    /WORKDIR\s+/i,
    /USER\s+/i,
    /#\s*.*$/m
  ],
  markdown: [
    /^#\s+.*$/m, // 标题
    /^\*\*.*\*\*$/m, // 粗体
    /\*.*\*/m, // 斜体
    /\[.*\]\(.*\)/m, // 链接
    /!\[.*\]\(.*\)/m, // 图片
    /```[\s\S]*?```/m, // 代码块
    /^>\s+.*$/m, // 引用
    /^\d+\.\s+.*$/m, // 有序列表
    /^-\s+.*$/m, // 无序列表
    /^\*\s+.*$/m,
    /^\+\s+.*$/m
  ],
  xml: [
    /<\?xml\s+version/i,
    /<[^>]+>/m,
    /<\/[^>]+>/m,
    /<[^\/>]+\/>/m, // 自闭合标签
    /<!--[\s\S]*?-->/m
  ],
  toml: [
    /^\w+\s*=\s*".*"/m,
    /^\w+\s*=\s*\d+/m,
    /^\w+\s*=\s*(true|false)/m,
    /^\[\w+\]$/m,
    /#\s*.*$/m
  ],
  ini: [
    /^\[\w+\]$/m,
    /^\w+\s*=\s*.*$/m,
    /;\s*.*$/m,
    /#\s*.*$/m
  ],
  makefile: [
    /^\w+:\s*$/m,
    /^\w+:\s+.*$/m,
    /^\t\w+/m, // 命令
    /\$\(\w+\)/m, // 变量
    /\$\{\w+\}/m, // 变量
    /ifeq\s+/m,
    /endif/m,
    /#\s*.*$/m
  ],
  cmake: [
    /cmake_minimum_required\s*\(/m,
    /project\s*\(/m,
    /add_executable\s*\(/m,
    /add_library\s*\(/m,
    /target_link_libraries\s*\(/m,
    /find_package\s*\(/m,
    /include_directories\s*\(/m,
    /set\s*\(/m,
    /message\s*\(/m,
    /#\s*.*$/m
  ],
  perl: [
    /use\s+\w+/m,
    /my\s+\$\w+/m,
    /our\s+\$\w+/m,
    /sub\s+\w+/m,
    /\$\w+\s*=/m,
    /print\s+/m,
    /if\s*\(/m,
    /#\s*.*$/m
  ],
  lua: [
    /require\s+['"`][^'"`]+['"`]/m,
    /function\s+\w+/m,
    /local\s+\w+/m,
    /print\s*\(/m,
    /if\s+/m,
    /for\s+/m,
    /while\s+/m,
    /--\s*.*$/m,
    /--\[\[ [\s\S]*? \]\]/m
  ],
  r: [
    /library\s*\(/m,
    /<-/m,
    /function\s*\(/m,
    /for\s*\(/m,
    /if\s*\(/m,
    /print\s*\(/m,
    /#\s*.*$/m
  ],
  matlab: [
    /function\s+\w+/m,
    /end\s*$/m,
    /disp\s*\(/m,
    /fprintf\s*\(/m,
    /if\s+/m,
    /for\s+/m,
    /while\s+/m,
    /%\s*.*$/m
  ]
};

// 文件结构模式常量
export const FILE_STRUCTURE_PATTERNS: [string, RegExp][] = [
  ['dockerfile', /^(FROM|RUN|COPY|ADD|CMD|ENTRYPOINT|ENV|EXPOSE|VOLUME|WORKDIR|USER)/i],
  ['makefile', /^[a-zA-Z_][a-zA-Z0-9_]*\s*:/m],
  ['cmake', /^(cmake_minimum_required|project|add_executable|add_library)/i],
  ['python', /^(import|from|def|class)\s+/m]
];

// 具有强特征的语言列表
export const STRONG_FEATURE_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 'rust',
  'php', 'ruby', 'shell', 'json', 'html', 'css', 'sql', 'dockerfile'
];