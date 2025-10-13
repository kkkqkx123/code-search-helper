import { ISplitStrategy } from '../../interfaces/ISplitStrategy';
import { CodeChunk } from '../../Splitter';
import { ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../../types';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * 分割策略基类
 * 提供通用的功能和配置管理
 */
export abstract class BaseSplitStrategy implements ISplitStrategy {
  protected options: Required<ChunkingOptions>;
  protected logger?: LoggerService;
  protected treeSitterService?: TreeSitterService;

  constructor(options?: ChunkingOptions) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  }

  /**
   * 设置TreeSitter服务
   */
  setTreeSitterService(treeSitterService: TreeSitterService): void {
    this.treeSitterService = treeSitterService;
  }

  /**
   * 设置日志服务
   */
  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  /**
   * 验证输入参数
   */
  protected validateInput(content: string, language: string): boolean {
    if (!content || content.trim() === '') {
      this.logger?.warn('Empty content provided to split strategy');
      return false;
    }

    if (!language || language.trim() === '') {
      this.logger?.warn('Empty language provided to split strategy');
      return false;
    }

    if (!this.supportsLanguage(language)) {
      this.logger?.debug(`Language ${language} not supported by ${this.getName()}`);
      return false;
    }

    return true;
  }

  /**
   * 创建代码块
   */
  protected createChunk(
    content: string, 
    metadata: Partial<CodeChunk['metadata']>
  ): CodeChunk {
    return {
      content,
      metadata: {
        startLine: metadata.startLine || 1,
        endLine: metadata.endLine || 1,
        language: metadata.language || 'unknown',
        filePath: metadata.filePath,
        type: metadata.type || 'generic',
        functionName: metadata.functionName,
        className: metadata.className,
        complexity: metadata.complexity,
        nodeIds: metadata.nodeIds || []
      }
    };
  }

  /**
   * 检查代码块是否有效
   */
  protected isValidChunk(chunk: CodeChunk): boolean {
    if (!chunk.content || chunk.content.trim().length < (this.options.minChunkSize || 50)) {
      return false;
    }

    if (!chunk.metadata.startLine || !chunk.metadata.endLine) {
      return false;
    }

    if (chunk.metadata.endLine < chunk.metadata.startLine) {
      return false;
    }

    return true;
  }

  /**
   * 过滤无效的代码块
   */
  protected filterValidChunks(chunks: CodeChunk[]): CodeChunk[] {
    return chunks.filter(chunk => this.isValidChunk(chunk));
  }

  /**
   * 抽象方法：获取策略名称
   */
  abstract getName(): string;

  /**
   * 抽象方法：检查是否支持语言
   */
  abstract supportsLanguage(language: string): boolean;

  /**
   * 抽象方法：获取优先级
   */
  abstract getPriority(): number;

  /**
   * 抽象方法：执行分割
   */
  abstract split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]>;
}