/**
 * Markdown 文件分段规则配置
 * 专门处理 Markdown 文件的分段策略和规则
 */

export interface MarkdownChunkingConfig {
  // 分段大小限制
  minChunkSize: number;        // 最小分段大小（字符数）
  maxChunkSize: number;        // 最大分段大小（字符数）
  minLinesPerChunk: number;    // 最小行数
  maxLinesPerChunk: number;    // 最大行数
  
  // 标题处理
  mergeWithHeading: boolean;   // 是否将标题与后续内容合并
  headingLevelWeights: number[]; // 标题级别权重 [H1, H2, H3, H4, H5, H6]
  
  // 特殊元素处理
  preserveCodeBlocks: boolean; // 保持代码块完整
  preserveTables: boolean;     // 保持表格完整
  preserveLists: boolean;      // 保持列表完整
  
  // 合并策略
  mergeConsecutiveHeadings: boolean; // 合并连续的标题
  mergeBoldWithContent: boolean;     // 合并加粗文本与后续内容
  mergeShortParagraphs: boolean;     // 合并短段落
  
  // 语义分析
  enableSemanticMerge: boolean;      // 启用语义合并
  semanticSimilarityThreshold: number; // 语义相似度阈值
}

/**
 * Markdown 正则表达式模式
 */
export const MARKDOWN_PATTERNS = {
  // 标题
  HEADING: /^(#{1,6})\s+(.+)$/m,
  HEADING_1: /^#\s+(.+)$/m,
  HEADING_2: /^##\s+(.+)$/m,
  HEADING_3: /^###\s+(.+)$/m,
  HEADING_4: /^####\s+(.+)$/m,
  HEADING_5: /^#####\s+(.+)$/m,
  HEADING_6: /^######\s+(.+)$/m,
  
  // 代码块
  CODE_BLOCK_START: /^```(\w*)$/m,
  CODE_BLOCK_END: /^```$/m,
  INLINE_CODE: /`[^`]+`/g,
  
  // 表格
  TABLE_ROW: /^\|.*\|$/m,
  TABLE_SEPARATOR: /^\|[\s\-:|]+\|$/m,
  
  // 列表
  ORDERED_LIST: /^\d+\.\s+/m,
  UNORDERED_LIST: /^[\*\-\+]\s+/m,
  LIST_ITEM: /^(\s*)([\d\*\-\+])\s+(.+)$/m,
  TASK_LIST: /^[\*\-\+]\s+\[([ x])\]\s+/m,
  
  // 引用
  BLOCKQUOTE: /^>\s+/m,
  
  // 链接和图片
  LINK: /\[([^\]]+)\]\(([^)]+)\)/g,
  IMAGE: /!\[([^\]]*)\]\(([^)]+)\)/g,
  
  // 强调
  BOLD: /\*\*([^*]+)\*\*/g,
  ITALIC: /\*([^*]+)\*/g,
  BOLD_ITALIC: /\*\*\*([^*]+)\*\*\*/g,
  
  // 分隔线
  HORIZONTAL_RULE: /^([\*\-_]\s*){3,}$/m,
  
  // 空行
  EMPTY_LINE: /^\s*$/,
  
  // 段落
  PARAGRAPH: /^[^\s#>`|\*\-\+!\[\n].*$/,
  
  // HTML 标签
  HTML_TAG: /<[^>]+>/g
} as const;

/**
 * Markdown 块类型定义
 */
export enum MarkdownBlockType {
  HEADING = 'heading',
  PARAGRAPH = 'paragraph',
  CODE_BLOCK = 'code_block',
  TABLE = 'table',
  LIST = 'list',
  BLOCKQUOTE = 'blockquote',
  HORIZONTAL_RULE = 'horizontal_rule',
  HTML = 'html',
  EMPTY = 'empty'
}

/**
 * Markdown 分段配置默认值
 */
export const DEFAULT_MARKDOWN_CONFIG: MarkdownChunkingConfig = {
  minChunkSize: 300,      // 最小300字符
  maxChunkSize: 1500,     // 最大1500字符
  minLinesPerChunk: 3,    // 最少3行
 maxLinesPerChunk: 30,   // 最多30行
  
  // 标题处理
  mergeWithHeading: true,
  headingLevelWeights: [10, 8, 6, 4, 2, 1], // H1-H6权重
  
  // 特殊元素处理
  preserveCodeBlocks: true,
  preserveTables: true,
  preserveLists: true,
  
  // 合并策略
  mergeConsecutiveHeadings: true,
  mergeBoldWithContent: true,
  mergeShortParagraphs: true,
  
  // 语义分析
  enableSemanticMerge: true,
  semanticSimilarityThreshold: 0.7
};

/**
 * Markdown 语义分数权重
 */
export const MARKDOWN_SEMANTIC_WEIGHTS = {
  [MarkdownBlockType.HEADING]: 10,
  [MarkdownBlockType.CODE_BLOCK]: 8,
  [MarkdownBlockType.TABLE]: 6,
  [MarkdownBlockType.LIST]: 4,
  [MarkdownBlockType.BLOCKQUOTE]: 3,
  [MarkdownBlockType.PARAGRAPH]: 2,
  [MarkdownBlockType.HORIZONTAL_RULE]: 1,
  [MarkdownBlockType.HTML]: 2,
  [MarkdownBlockType.EMPTY]: 0
} as const;

/**
 * 判断是否为 Markdown 文件
 */
export function isMarkdownFile(filePath: string): boolean {
  const markdownExtensions = ['.md', '.markdown', '.mdown', '.mkd', '.mkdn'];
  const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  return markdownExtensions.includes(ext);
}

/**
 * 获取标题级别
 */
export function getHeadingLevel(line: string): number {
  const match = line.match(/^#{1,6}/);
  if (match) {
    return match[0].length;
  }
  return 0;
}

/**
 * 判断是否为代码块开始/结束
 */
export function isCodeBlockDelimiter(line: string, inCodeBlock: boolean): boolean {
  const trimmed = line.trim();
  if (!inCodeBlock) {
    return MARKDOWN_PATTERNS.CODE_BLOCK_START.test(trimmed);
  } else {
    return MARKDOWN_PATTERNS.CODE_BLOCK_END.test(trimmed);
  }
}

/**
 * 判断是否为表格行
 */
export function isTableRow(line: string): boolean {
  return MARKDOWN_PATTERNS.TABLE_ROW.test(line.trim());
}

/**
 * 判断是否为表格分隔符
 */
export function isTableSeparator(line: string): boolean {
  return MARKDOWN_PATTERNS.TABLE_SEPARATOR.test(line.trim());
}

/**
 * 判断是否为列表项
 */
export function isListItem(line: string): boolean {
  return MARKDOWN_PATTERNS.LIST_ITEM.test(line.trim());
}

/**
 * 判断是否为引用
 */
export function isBlockquote(line: string): boolean {
  return MARKDOWN_PATTERNS.BLOCKQUOTE.test(line.trim());
}

/**
 * 判断是否为段落
 */
export function isParagraph(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  // 排除其他块类型
  return !(
    MARKDOWN_PATTERNS.HEADING.test(trimmed) ||
    MARKDOWN_PATTERNS.CODE_BLOCK_START.test(trimmed) ||
    MARKDOWN_PATTERNS.CODE_BLOCK_END.test(trimmed) ||
    MARKDOWN_PATTERNS.TABLE_ROW.test(trimmed) ||
    MARKDOWN_PATTERNS.TABLE_SEPARATOR.test(trimmed) ||
    MARKDOWN_PATTERNS.LIST_ITEM.test(trimmed) ||
    MARKDOWN_PATTERNS.BLOCKQUOTE.test(trimmed) ||
    MARKDOWN_PATTERNS.HORIZONTAL_RULE.test(trimmed)
  );
}

/**
 * 获取块类型
 */
export function getMarkdownBlockType(line: string, inCodeBlock: boolean): MarkdownBlockType {
  const trimmed = line.trim();
  
  if (!trimmed) return MarkdownBlockType.EMPTY;
  if (inCodeBlock) return MarkdownBlockType.CODE_BLOCK;
  
  if (MARKDOWN_PATTERNS.HEADING.test(trimmed)) return MarkdownBlockType.HEADING;
  if (MARKDOWN_PATTERNS.CODE_BLOCK_START.test(trimmed)) return MarkdownBlockType.CODE_BLOCK;
  if (MARKDOWN_PATTERNS.TABLE_ROW.test(trimmed)) return MarkdownBlockType.TABLE;
  if (MARKDOWN_PATTERNS.LIST_ITEM.test(trimmed)) return MarkdownBlockType.LIST;
  if (MARKDOWN_PATTERNS.BLOCKQUOTE.test(trimmed)) return MarkdownBlockType.BLOCKQUOTE;
  if (MARKDOWN_PATTERNS.HORIZONTAL_RULE.test(trimmed)) return MarkdownBlockType.HORIZONTAL_RULE;
  if (MARKDOWN_PATTERNS.HTML_TAG.test(trimmed)) return MarkdownBlockType.HTML;
  if (isParagraph(trimmed)) return MarkdownBlockType.PARAGRAPH;
  
  return MarkdownBlockType.PARAGRAPH;
}

/**
 * 计算语义相似度（简单的基于关键词的相似度）
 */
export function calculateSemanticSimilarity(text1: string, text2: string): number {
  const words1 = extractKeywords(text1);
  const words2 = extractKeywords(text2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const intersection = words1.filter(word => words2.includes(word));
  const union = [...new Set([...words1, ...words2])];
  
  return intersection.length / union.length;
}

/**
 * 提取关键词
 */
function extractKeywords(text: string): string[] {
  // 简单的关键词提取：去除标点符号，转换为小写，按空格分割
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2) // 过滤掉太短的词
    .filter(word => !isCommonWord(word));
}

/**
 * 判断是否为常见词
 */
function isCommonWord(word: string): boolean {
  const commonWords = [
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you',
    'he', 'she', 'it', 'we', 'they', 'them', 'their', 'there', 'where', 'when',
    'what', 'who', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 'just', 'now'
  ];
  
  return commonWords.includes(word);
}