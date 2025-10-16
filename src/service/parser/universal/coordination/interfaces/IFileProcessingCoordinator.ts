import { CodeChunk } from '../../../splitting/Splitter';
import { IStrategySelectionResult } from './IProcessingStrategySelector';

/**
 * 文件处理上下文接口
 */
export interface IFileProcessingContext {
  /** 文件路径 */
  filePath: string;
  /** 文件内容 */
  content: string;
  /** 选择的处理策略 */
  strategy: IStrategySelectionResult;
  /** 语言信息 */
  language: string;
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
 * 文件处理结果接口
 */
export interface IFileProcessingResult {
  /** 处理生成的分块 */
  chunks: CodeChunk[];
  /** 使用的处理策略 */
  processingStrategy: string;
  /** 处理是否成功 */
  success: boolean;
  /** 错误信息（如果处理失败） */
  error?: Error;
  /** 处理耗时（毫秒） */
  duration: number;
  /** 额外的结果数据 */
  metadata?: Record<string, any>;
}

/**
 * 降级处理结果接口
 */
export interface IFallbackResult {
  /** 降级处理生成的分块 */
  chunks: CodeChunk[];
  /** 降级原因 */
  reason: string;
  /** 降级策略 */
  fallbackStrategy: string;
  /** 原始错误（如果有） */
  originalError?: Error;
}

/**
 * 文件处理协调器接口
 * 负责协调文件处理流程，包括策略执行和降级处理
 */
export interface IFileProcessingCoordinator {
  /** 协调器名称 */
  readonly name: string;
  
  /** 协调器描述 */
  readonly description: string;
  
  /**
   * 执行文件处理
   * @param context 文件处理上下文
   * @returns 文件处理结果
   */
  processFile(context: IFileProcessingContext): Promise<IFileProcessingResult>;
  
  /**
   * 执行处理策略
   * @param strategy 处理策略
   * @param filePath 文件路径
   * @param content 文件内容
   * @param language 语言类型
   * @returns 处理结果
   */
  executeProcessingStrategy(
    strategy: IStrategySelectionResult,
    filePath: string,
    content: string,
    language: string
  ): Promise<CodeChunk[]>;
  
  /**
   * 执行降级处理
   * @param filePath 文件路径
   * @param content 文件内容
   * @param reason 降级原因
   * @param originalError 原始错误（可选）
   * @returns 降级处理结果
   */
  processWithFallback(
    filePath: string,
    content: string,
    reason: string,
    originalError?: Error
  ): Promise<IFallbackResult>;
  
  /**
   * 使用TreeSitter进行AST解析分段
   * @param content 文件内容
   * @param filePath 文件路径
   * @param language 语言类型
   * @returns 分块结果
   */
  chunkByTreeSitter(content: string, filePath: string, language: string): Promise<CodeChunk[]>;
  
  /**
   * 使用精细语义分段
   * @param content 文件内容
   * @param filePath 文件路径
   * @param language 语言类型
   * @returns 分块结果
   */
  chunkByFineSemantic(content: string, filePath: string, language: string): Promise<CodeChunk[]>;
}