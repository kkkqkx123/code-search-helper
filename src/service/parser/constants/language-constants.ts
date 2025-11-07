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
  '.cmd': 'batch'
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

// 具有强特征的语言列表
export const STRONG_FEATURE_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'go', 'rust',
  'php', 'ruby', 'shell', 'json', 'html', 'css', 'sql', 'dockerfile'
];