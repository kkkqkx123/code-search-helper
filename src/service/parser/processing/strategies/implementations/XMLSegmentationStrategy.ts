import { BaseStrategy } from '../base/BaseStrategy';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { ProcessingResult } from '../../types/Processing';
import { CodeChunk, ChunkType } from '../../types/CodeChunk';
import { StrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../utils/logger';

/**
 * XML分段策略配置
 */
export interface XMLStrategyConfig extends StrategyConfig {
  /** 最大块大小 */
  maxChunkSize?: number;
  /** 最小块大小 */
  minChunkSize?: number;
  /** 最大标签深度 */
  maxTagDepth?: number;
  /** 是否保持属性完整性 */
  preserveAttributes?: boolean;
}

/**
 * XML分段策略
 * 使用专门的XML分段器
 */
export class XMLSegmentationStrategy extends BaseStrategy {
  protected config: XMLStrategyConfig;
  private logger: Logger;

  constructor(config: XMLStrategyConfig) {
    const defaultConfig: StrategyConfig = {
      name: 'xml-segmentation',
      priority: 30,
      supportedLanguages: ['xml', 'html', 'htm', 'xhtml', 'svg'],
      enabled: true,
      description: 'XML Segmentation Strategy',
    };
    super({ ...defaultConfig, ...config });
    this.config = {
      maxChunkSize: 3000,
      minChunkSize: 200,
      maxTagDepth: 10,
      preserveAttributes: true,
      ...config
    };
    this.logger = Logger.getInstance();
  }

  /**
   * 检查是否可以处理指定的上下文
   */
  canHandle(context: IProcessingContext): boolean {
    const { language, content } = context;

    // 检查是否为XML相关文件
    if (!language || !['xml', 'html', 'htm', 'xhtml', 'svg'].includes(language.toLowerCase())) {
      return false;
    }

    // 检查内容是否包含XML结构
    return /<[^>]+>/.test(content);
  }

  /**
   * 执行策略
   */
  async execute(context: IProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();
    try {
      const chunks = await this.process(context);
      return this.createSuccessResult(chunks, Date.now() - startTime);
    } catch (error) {
      return this.createFailureResult(Date.now() - startTime, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 执行分段处理
   */
  async process(context: IProcessingContext): Promise<CodeChunk[]> {
    const startTime = Date.now();
    this.logger.debug(`Using XML segmentation strategy for ${context.filePath}`);

    try {
      const chunks: CodeChunk[] = [];
      const lines = context.content.split('\n');

      // 简单的XML标签平衡分段
      let currentChunk: string[] = [];
      let currentLine = 1;
      let tagDepth = 0;
      let currentTagStack: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        currentChunk.push(line);

        // 解析标签
        const tags = this.extractTags(line);
        for (const tag of tags) {
          if (this.isOpeningTag(tag)) {
            const tagName = this.getTagName(tag);
            if (!this.isSelfClosingTag(tag)) {
              tagDepth++;
              currentTagStack.push(tagName);
            }
          } else if (this.isClosingTag(tag)) {
            const tagName = this.getTagName(tag);
            // 查找匹配的开标签
            for (let j = currentTagStack.length - 1; j >= 0; j--) {
              if (currentTagStack[j] === tagName) {
                currentTagStack.splice(j, 1);
                tagDepth--;
                break;
              }
            }
          }
        }

        // 分段条件：标签平衡且达到最小大小
        const chunkContent = currentChunk.join('\n');
        const shouldSplit = this.shouldSplit(
          tagDepth,
          currentTagStack,
          currentChunk,
          chunkContent,
          i,
          lines.length
        );

        if (shouldSplit) {
          chunks.push(this.createChunk(
            chunkContent,
            currentLine,
            currentLine + currentChunk.length - 1,
            context.language || 'xml',
            ChunkType.BLOCK,
            {
              filePath: context.filePath,
              complexity: this.calculateComplexity(chunkContent),
              tagDepth: tagDepth,
              openTags: [...currentTagStack],
              type: 'xml_element'
            }
          ));

          currentChunk = [];
          currentLine = i + 1;
          tagDepth = 0;
          currentTagStack = [];
        }
      }

      // 处理剩余内容
      if (currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        chunks.push(this.createChunk(
          chunkContent,
          currentLine,
          currentLine + currentChunk.length - 1,
          context.language || 'xml',
          ChunkType.BLOCK,
          {
            filePath: context.filePath,
            complexity: this.calculateComplexity(chunkContent),
            tagDepth: tagDepth,
            openTags: [...currentTagStack],
            type: 'xml_element'
          }
        ));
      }

      this.updatePerformanceStats(Date.now() - startTime, true, chunks.length);
      this.logger.debug(`XML segmentation created ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger.error(`XML segmentation failed: ${error}`);

      // 降级到简单的行分段
      this.logger.warn(`Falling back to line-based segmentation for ${context.filePath}`);
      return this.createFallbackChunks(context);
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return ['xml', 'html', 'htm', 'xhtml', 'svg'];
  }

  /**
   * 提取行中的标签
   */
  private extractTags(line: string): string[] {
    const tagRegex = /<\/?[^>]+>/g;
    const tags: string[] = [];
    let match;

    while ((match = tagRegex.exec(line)) !== null) {
      tags.push(match[0]);
    }

    return tags;
  }

  /**
   * 判断是否为开标签
   */
  private isOpeningTag(tag: string): boolean {
    return tag.startsWith('<') && !tag.startsWith('</') && !tag.endsWith('/>');
  }

  /**
   * 判断是否为闭标签
   */
  private isClosingTag(tag: string): boolean {
    return tag.startsWith('</');
  }

  /**
   * 判断是否为自闭合标签
   */
  private isSelfClosingTag(tag: string): boolean {
    return tag.endsWith('/>');
  }

  /**
   * 获取标签名称
   */
  private getTagName(tag: string): string {
    const match = tag.match(/<\/?([^\s>]+)/);
    return match ? match[1] : '';
  }

  /**
   * 判断是否应该分段
   */
  private shouldSplit(
    tagDepth: number,
    tagStack: string[],
    currentChunk: string[],
    chunkContent: string,
    currentIndex: number,
    totalLines: number
  ): boolean {
    // 标签平衡且达到最小大小
    const isBalanced = tagDepth === 0 && tagStack.length === 0;
    const hasMinSize = currentChunk.length >= 3 && chunkContent.length >= this.config.minChunkSize!;

    // 块大小限制
    const exceedsMaxSize = chunkContent.length >= this.config.maxChunkSize! ||
      currentChunk.length >= 50;

    // 深度限制
    const exceedsMaxDepth = tagDepth > this.config.maxTagDepth!;

    // 到达文件末尾
    const isEndOfFile = currentIndex === totalLines - 1;

    return (isBalanced && hasMinSize) || exceedsMaxSize || exceedsMaxDepth || isEndOfFile;
  }

  /**
   * 计算复杂度
   */
  protected calculateComplexity(content: string): number {
    let complexity = 0;

    // 基于标签数量计算复杂度
    const tags = content.match(/<\/?[^>]+>/g) || [];
    complexity += tags.length * 2;

    // 基于属性数量计算复杂度
    const attributes = content.match(/\w+\s*=\s*["'][^"']*["']/g) || [];
    complexity += attributes.length;

    // 基于嵌套深度计算复杂度
    const openTags = content.match(/<[^\/][^>]*>/g) || [];
    const closeTags = content.match(/<\/[^>]*>/g) || [];
    const maxDepth = Math.max(openTags.length - closeTags.length, 0);
    complexity += maxDepth * 3;

    // 基于内容长度调整
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1) * 2;

    return Math.round(complexity);
  }

  /**
   * 创建降级块
   */
  private createFallbackChunks(context: IProcessingContext): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = context.content.split('\n');

    // 简单的行分段
    const maxLinesPerChunk = 50;
    for (let i = 0; i < lines.length; i += maxLinesPerChunk) {
      const chunkLines = lines.slice(i, Math.min(i + maxLinesPerChunk, lines.length));
      const chunkContent = chunkLines.join('\n');

      chunks.push(this.createChunk(
        chunkContent,
        i + 1,
        Math.min(i + maxLinesPerChunk, lines.length),
        context.language || 'xml',
        ChunkType.GENERIC,
        {
          filePath: context.filePath,
          complexity: this.calculateComplexity(chunkContent),
          fallback: true
        }
      ));
    }

    return chunks;
  }

  /**
   * 获取策略配置
   */
  getConfig(): XMLStrategyConfig {
    return { ...this.config };
  }

  /**
   * 更新策略配置
   */
  updateConfig(config: Partial<XMLStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }
}