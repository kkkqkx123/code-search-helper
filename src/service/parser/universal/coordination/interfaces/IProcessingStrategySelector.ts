/**
 * 处理策略类型枚举
 */
export enum ProcessingStrategyType {
  TREESITTER_AST = 'treesitter-ast',
  UNIVERSAL_SEMANTIC_FINE = 'universal-semantic-fine',
  UNIVERSAL_SEMANTIC = 'universal-semantic',
  UNIVERSAL_BRACKET = 'universal-bracket',
  UNIVERSAL_LINE = 'universal-line',
  FALLBACK_LINE = 'fallback-line'
}

/**
 * 语言检测信息接口
 */
export interface ILanguageDetectionInfo {
  /** 检测到的语言 */
  language: string;
  /** 检测置信度 (0-1) */
  confidence: number;
  /** 检测方法 */
  detectionMethod: 'extension' | 'content' | 'backup' | 'default';
  /** 额外的检测信息 */
  metadata?: Record<string, any>;
}

/**
 * 处理策略选择上下文接口
 */
export interface IStrategySelectionContext {
  /** 文件路径 */
  filePath: string;
  /** 文件内容 */
  content: string;
  /** 检测到的语言信息 */
  languageInfo: ILanguageDetectionInfo;
  /** 文件大小 */
  fileSize?: number;
  /** 内存使用情况 */
  memoryUsage?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  /** 错误统计 */
  errorStats?: {
    count: number;
    lastErrorTime: number;
    errorRate: number;
  };
  /** 时间戳 */
  timestamp: Date;
}

/**
 * 处理策略选择结果接口
 */
export interface IStrategySelectionResult {
  /** 选择的策略类型 */
  strategy: ProcessingStrategyType;
  /** 选择原因 */
  reason: string;
  /** 策略参数 */
  parameters?: Record<string, any>;
  /** 是否需要降级处理 */
  shouldFallback: boolean;
  /** 降级原因（如果需要） */
  fallbackReason?: string;
}

/**
 * 处理策略选择器接口
 * 负责根据文件特征选择合适的处理策略
 */
export interface IProcessingStrategySelector {
  /** 选择器名称 */
  readonly name: string;
  
  /** 选择器描述 */
  readonly description: string;
  
  /**
   * 智能语言检测
   * @param filePath 文件路径
   * @param content 文件内容
   * @returns 语言检测信息
   */
  detectLanguageIntelligently(filePath: string, content: string): Promise<ILanguageDetectionInfo>;
  
  /**
   * 选择处理策略
   * @param context 策略选择上下文
   * @returns 策略选择结果
   */
  selectProcessingStrategy(context: IStrategySelectionContext): Promise<IStrategySelectionResult>;
  
  /**
   * 检查是否可以使用TreeSitter
   * @param language 语言类型
   * @returns 是否支持
   */
  canUseTreeSitter(language: string): boolean;
  
  /**
   * 检查是否为代码语言
   * @param language 语言类型
   * @returns 是否为代码语言
   */
  isCodeLanguage(language: string): boolean;
  
  /**
   * 检查是否为文本类语言
   * @param language 语言类型
   * @returns 是否为文本类语言
   */
  isTextLanguage(language: string): boolean;
  
  /**
   * 检查是否为结构化文件
   * @param content 文件内容
   * @param language 语言类型
   * @returns 是否为结构化文件
   */
  isStructuredFile(content: string, language: string): boolean;
}