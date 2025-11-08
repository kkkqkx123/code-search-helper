/**
 * 语言相关常量定义
 */

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
  '.cmd': 'batch',
  '.csv': 'csv',
};

// 代码语言列表常量
export const CODE_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
  'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'shell',
  'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'json',
  'xml', 'yaml', 'toml', 'sql', 'dockerfile', 'cmake', 'perl', 'r', 'matlab',
  'lua', 'dart', 'elixir', 'erlang', 'haskell', 'ocaml', 'fsharp',
  'visualbasic', 'powershell', 'batch'
];

// 结构化文件语言列表
export const STRUCTURED_LANGUAGES = [
  'toml', 'json', 'xml', 'yaml', 'html', 'css', 'scss', 'sass'
];

// 默认支持的文件扩展名列表（带点号）
export const DEFAULT_SUPPORTED_EXTENSIONS = Object.keys(LANGUAGE_MAP);

// 支持 Tree-sitter 解析的语言列表
export const TREE_SITTER_SUPPORTED_LANGUAGES = [
  'c', 'cpp', 'csharp', 'css', 'go', 'html', 'java', 'javascript',
  'kotlin', 'python', 'rust', 'tsx', 'typescript', 'vue', 'toml', 'yaml'
];

// 具有强特征的语言列表
export const STRONG_FEATURE_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 'rust',
  'php', 'ruby', 'shell', 'json', 'html', 'css', 'sql', 'dockerfile'
];

// Tree-sitter 语言名称到标准语言名称的映射
export const TREE_SITTER_LANGUAGE_MAP: Record<string, string> = {
  // 编程语言
  'typescript': 'typescript',
  'javascript': 'javascript',
  'python': 'python',
  'java': 'java',
  'go': 'go',
  'rust': 'rust',
  'cpp': 'cpp',
  'c': 'c',
  'c_sharp': 'csharp',
  'swift': 'swift',
  'kotlin': 'kotlin',
  'ruby': 'ruby',
  'php': 'php',
  'scala': 'scala',
  'elixir': 'elixir',
  'lua': 'lua',
  'ocaml': 'ocaml',
  'solidity': 'solidity',
  'systemrdl': 'systemrdl',
  'tlaplus': 'tlaplus',
  'zig': 'zig',
  'elisp': 'elisp',

  // 前端和标记语言
  'html': 'html',
  'css': 'css',
  'vue': 'vue',
  'tsx': 'tsx',
  'jsx': 'jsx',
  'embedded_template': 'embedded_template',

  // 数据和配置文件
  'json': 'json',
  'yaml': 'yaml',
  'toml': 'toml',
  'xml': 'xml',
  'markdown': 'markdown',

  // 其他
  'bash': 'shell',
  'sql': 'sql'
};

// 特殊语言处理规则
export const SPECIAL_LANGUAGE_HANDLERS = {
  // 配置文件语言 - 通常基于文件扩展名而非内容
  configFiles: {
    extensions: ['.json', '.yaml', '.yml', '.toml', '.xml', '.ini', '.cfg', '.conf'],
    languages: ['json', 'yaml', 'toml', 'xml']
  },

  // 前端语言 - 可能包含多种语言混合
  frontendLanguages: {
    extensions: ['.vue', '.jsx', '.tsx', '.html'],
    languages: ['vue', 'jsx', 'tsx', 'html'],
    // Vue 文件可能包含 HTML、CSS、JS/TS
    containsMultiple: true
  },

  // 嵌入式模板语言
  embeddedTemplates: {
    extensions: ['.html', '.vue', '.jsx', '.tsx'],
    languages: ['embedded_template', 'html', 'vue', 'jsx', 'tsx']
  }
};

// 语言分类
export const LANGUAGE_CATEGORIES = {
  PROGRAMMING: 'programming',
  MARKUP: 'markup',
  DATA: 'data',
  CONFIG: 'config',
  TEMPLATE: 'template'
} as const;

// 按分类组织的语言映射
export const LANGUAGES_BY_CATEGORY = {
  [LANGUAGE_CATEGORIES.PROGRAMMING]: [
    'typescript', 'javascript', 'python', 'java', 'go', 'rust',
    'cpp', 'c', 'csharp', 'swift', 'kotlin', 'ruby', 'php',
    'scala', 'elixir', 'lua', 'ocaml', 'solidity', 'systemrdl',
    'tlaplus', 'zig', 'elisp', 'shell', 'sql'
  ],

  [LANGUAGE_CATEGORIES.MARKUP]: [
    'html', 'css', 'vue', 'markdown'
  ],

  [LANGUAGE_CATEGORIES.DATA]: [
    'json', 'yaml', 'toml', 'xml'
  ],

  [LANGUAGE_CATEGORIES.CONFIG]: [
    'json', 'yaml', 'toml', 'xml'
  ],

  [LANGUAGE_CATEGORIES.TEMPLATE]: [
    'embedded_template', 'vue', 'jsx', 'tsx'
  ]
};

// 语言别名映射
export const LANGUAGE_ALIASES: Record<string, string> = {
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'rb': 'ruby',
  'rs': 'rust',
  'cs': 'csharp',
  'kt': 'kotlin',
  'md': 'markdown',
  'yml': 'yaml',
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
  'fish': 'shell'
};

// 获取标准语言名称
export function getStandardLanguageName(languageName: string): string {
  // 首先检查 Tree-sitter 映射
  if (TREE_SITTER_LANGUAGE_MAP[languageName]) {
    return TREE_SITTER_LANGUAGE_MAP[languageName];
  }

  // 检查别名映射
  if (LANGUAGE_ALIASES[languageName]) {
    return LANGUAGE_ALIASES[languageName];
  }

  // 如果没有找到映射，返回原始名称（小写）
  return languageName.toLowerCase();
}

// 检查是否为配置文件语言
export function isConfigLanguage(languageName: string): boolean {
  const standardName = getStandardLanguageName(languageName);
  return SPECIAL_LANGUAGE_HANDLERS.configFiles.languages.includes(standardName);
}

// 检查是否为前端语言
export function isFrontendLanguage(languageName: string): boolean {
  const standardName = getStandardLanguageName(languageName);
  return SPECIAL_LANGUAGE_HANDLERS.frontendLanguages.languages.includes(standardName);
}

// 检查是否为嵌入式模板语言
export function isEmbeddedTemplateLanguage(languageName: string): boolean {
  const standardName = getStandardLanguageName(languageName);
  return SPECIAL_LANGUAGE_HANDLERS.embeddedTemplates.languages.includes(standardName);
}

// 获取语言分类
export function getLanguageCategory(languageName: string): string {
  const standardName = getStandardLanguageName(languageName);

  for (const [category, languages] of Object.entries(LANGUAGES_BY_CATEGORY)) {
    if (languages.includes(standardName)) {
      return category;
    }
  }

  return LANGUAGE_CATEGORIES.PROGRAMMING; // 默认分类
}