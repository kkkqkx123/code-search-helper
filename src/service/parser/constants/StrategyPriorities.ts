/**
 * 统一的策略优先级常量
 * 数值越小优先级越高
 */

export const UNIFIED_STRATEGY_PRIORITIES: Record<string, number> = {
  // 0-2: 特定格式策略（最高优先级）
  'markdown-segmentation': 0,
  'xml-segmentation': 1,
  'layered-html': 2,
  
  // 3-5: 复杂分析策略
  'ast-segmentation': 3,
  'semantic-segmentation': 4,
  'standardization-segmentation': 5,
  
  // 6-8: 结构化策略
  'semantic-strategy': 6,
  'bracket-strategy': 7,
  'ast-strategy': 8,
  
  // 9-11: 代码元素策略
  'function-strategy': 9,
  'class-strategy': 10,
  'import-strategy': 11,
  
  // 12: 降级策略（最低优先级）
  'line-segmentation': 12
};

/**
 * 语言特定策略推荐
 * 按优先级从高到低排序
 */
export const LANGUAGE_SPECIFIC_STRATEGIES: Record<string, string[]> = {
  'typescript': [
    'ast-segmentation',
    'function-strategy', 
    'class-strategy',
    'semantic-strategy',
    'bracket-strategy',
    'import-strategy'
  ],
  'javascript': [
    'ast-segmentation',
    'function-strategy',
    'class-strategy', 
    'semantic-strategy',
    'bracket-strategy',
    'import-strategy'
  ],
  'python': [
    'function-strategy',
    'class-strategy',
    'semantic-strategy',
    'ast-segmentation',
    'import-strategy'
  ],
  'java': [
    'ast-segmentation',
    'function-strategy',
    'class-strategy',
    'bracket-strategy',
    'import-strategy',
    'semantic-strategy'
  ],
  'c': [
    'bracket-strategy',
    'function-strategy',
    'semantic-strategy',
    'import-strategy'
  ],
  'cpp': [
    'bracket-strategy',
    'function-strategy',
    'class-strategy',
    'ast-segmentation',
    'import-strategy',
    'semantic-strategy'
  ],
  'csharp': [
    'ast-segmentation',
    'function-strategy',
    'class-strategy',
    'bracket-strategy',
    'import-strategy',
    'semantic-strategy'
  ],
  'go': [
    'function-strategy',
    'class-strategy',
    'semantic-strategy',
    'ast-segmentation',
    'import-strategy'
  ],
  'rust': [
    'bracket-strategy',
    'function-strategy',
    'class-strategy',
    'semantic-strategy',
    'ast-segmentation',
    'import-strategy'
  ],
  'php': [
    'function-strategy',
    'class-strategy',
    'semantic-strategy',
    'ast-segmentation',
    'import-strategy'
  ],
  'ruby': [
    'function-strategy',
    'class-strategy',
    'semantic-strategy',
    'import-strategy'
  ],
  'swift': [
    'ast-segmentation',
    'function-strategy',
    'class-strategy',
    'bracket-strategy',
    'import-strategy',
    'semantic-strategy'
  ],
  'kotlin': [
    'ast-segmentation',
    'function-strategy',
    'class-strategy',
    'semantic-strategy',
    'bracket-strategy',
    'import-strategy'
  ],
  'scala': [
    'ast-segmentation',
    'function-strategy',
    'class-strategy',
    'bracket-strategy',
    'semantic-strategy'
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
  '.htm': 'layered-html'
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

// 以下策略使用 PROGRAMMING_LANGUAGES
export const FUNCTION_STRATEGY_SUPPORTED_LANGUAGES = PROGRAMMING_LANGUAGES;
export const CLASS_STRATEGY_SUPPORTED_LANGUAGES = PROGRAMMING_LANGUAGES;
export const IMPORT_STRATEGY_SUPPORTED_LANGUAGES = PROGRAMMING_LANGUAGES;
export const AST_STRATEGY_SUPPORTED_LANGUAGES = PROGRAMMING_LANGUAGES;
export const AST_SEGMENTATION_SUPPORTED_LANGUAGES = PROGRAMMING_LANGUAGES;
export const STANDARDIZATION_SEGMENTATION_SUPPORTED_LANGUAGES = PROGRAMMING_LANGUAGES;
export const SEMANTIC_SEGMENTATION_SUPPORTED_LANGUAGES = PROGRAMMING_LANGUAGES;