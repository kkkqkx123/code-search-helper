/**
 * 统一的策略优先级常量
 * 数值越小优先级越高
 * 优化后版本：移除了冗余和过度设计的策略
 */

export const UNIFIED_STRATEGY_PRIORITIES: Record<string, number> = {
  // 0-2: 特定格式策略（最高优先级）
  'markdown-segmentation': 0,
  'xml-segmentation': 1,
  'layered-html': 2,
  
  // 3-4: 核心分段策略（优化后）
  'ast-codesplitter': 3,
  'bracket-segmentation': 4,
  
  // 5: 通用文本策略（中等优先级）
  'universal-text-segmentation': 5,
  
  // 6: 降级策略（最低优先级）
  'line-segmentation': 6
};

/**
 * 语言特定策略推荐
 * 按优先级从高到低排序
 * 优化后版本：简化策略选择
 */
export const LANGUAGE_SPECIFIC_STRATEGIES: Record<string, string[]> = {
  'typescript': [
    'ast-codesplitter',
    'bracket-segmentation',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'javascript': [
    'ast-codesplitter',
    'bracket-segmentation',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'python': [
    'ast-codesplitter',
    'bracket-segmentation',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'java': [
    'ast-codesplitter',
    'bracket-segmentation',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'c': [
    'bracket-segmentation',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'cpp': [
    'bracket-segmentation',
    'ast-codesplitter',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'csharp': [
    'ast-codesplitter',
    'bracket-segmentation',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'go': [
    'ast-codesplitter',
    'bracket-segmentation',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'rust': [
    'bracket-segmentation',
    'ast-codesplitter',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'php': [
    'ast-codesplitter',
    'bracket-segmentation',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'ruby': [
    'bracket-segmentation',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'swift': [
    'ast-codesplitter',
    'bracket-segmentation',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'kotlin': [
    'ast-codesplitter',
    'bracket-segmentation',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'scala': [
    'ast-codesplitter',
    'bracket-segmentation',
    'universal-text-segmentation',
    'line-segmentation'
  ],
  // 通用语言支持
  'text': [
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'unknown': [
    'universal-text-segmentation',
    'line-segmentation'
  ],
  // 纯文本格式语言 - 直接使用通用文本策略，跳过复杂处理
  'ini': [
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'csv': [
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'log': [
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'env': [
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'properties': [
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'dockerfile': [
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'gitignore': [
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'makefile': [
    'universal-text-segmentation',
    'line-segmentation'
  ],
  'readme': [
    'universal-text-segmentation',
    'line-segmentation'
  ]
};

/**
 * 文件类型特定策略映射
 */
export const FILE_TYPE_STRATEGIES: Record<string, string> = {
  '.md': 'markdown-segmentation',
  '.markdown': 'markdown-segmentation',
  '.xml': 'xml-segmentation',
  '.html': 'layered-html',
  '.htm': 'layered-html',
  '.xhtml': 'layered-html'
};

/**
 * 获取按优先级排序的策略列表
 * @param strategies 策略名称数组
 * @returns 按优先级排序的策略数组
 */
export function getPrioritizedStrategies(strategies: string[]): string[] {
  return strategies
    .filter(strategy => UNIFIED_STRATEGY_PRIORITIES.hasOwnProperty(strategy))
    .sort((a, b) => UNIFIED_STRATEGY_PRIORITIES[a] - UNIFIED_STRATEGY_PRIORITIES[b]);
}

/**
 * 获取语言特定的推荐策略
 * @param language 编程语言名称
 * @returns 推荐的策略列表
 */
export function getLanguageSpecificStrategies(language: string): string[] {
  return LANGUAGE_SPECIFIC_STRATEGIES[language.toLowerCase()] || 
         Object.keys(UNIFIED_STRATEGY_PRIORITIES);
}

/**
 * 获取文件类型特定的策略
 * @param filePath 文件路径
 * @returns 特定策略名称或null
 */
export function getFileTypeSpecificStrategy(filePath: string): string | null {
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  return FILE_TYPE_STRATEGIES[ext] || null;
}

/**
 * 策略支持的语言常量
 */
export const PROGRAMMING_LANGUAGES: string[] = [
  'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
  'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
];

export const BRACKET_STRATEGY_SUPPORTED_LANGUAGES: string[] = [
  'typescript', 'javascript', 'java', 'c', 'cpp',
  'csharp', 'go', 'rust', 'php', 'swift', 'kotlin', 'scala'
];

export const BRACKET_SEGMENTATION_SUPPORTED_LANGUAGES: string[] = [
  'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go', 'rust', 'xml'
];

// 优化后的策略支持语言
export const AST_CODESPLITTER_SUPPORTED_LANGUAGES = PROGRAMMING_LANGUAGES;
export const MARKDOWN_SEGMENTATION_SUPPORTED_LANGUAGES = ['markdown'];
export const XML_SEGMENTATION_SUPPORTED_LANGUAGES = ['xml'];
export const LAYERED_HTML_SUPPORTED_LANGUAGES = ['html', 'htm'];
export const LINE_SEGMENTATION_SUPPORTED_LANGUAGES = PROGRAMMING_LANGUAGES;
export const UNIVERSAL_TEXT_SEGMENTATION_SUPPORTED_LANGUAGES = ['*']; // 支持所有语言