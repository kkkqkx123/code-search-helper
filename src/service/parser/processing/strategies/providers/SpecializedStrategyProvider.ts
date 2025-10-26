import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { MarkdownTextSplitter } from '../../utils/md/MarkdownTextSplitter';
import { XMLTextSplitter } from '../../utils/xml/XMLTextSplitter';

/**
 * Markdown策略实现
 * 实现ISplitStrategy接口，使用专门的Markdown分段
 */
@injectable()
export class MarkdownSplitStrategy implements ISplitStrategy {
  constructor(
    @inject(TYPES.MarkdownTextSplitter) private markdownSplitter?: MarkdownTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ) {
    this.logger?.debug(`Using Markdown strategy for ${filePath}`);

    if (!this.markdownSplitter) {
      this.logger?.warn('MarkdownSplitter not available, falling back to semantic strategy');
      throw new Error('MarkdownSplitter not available');
    }

    try {
      const chunks = await this.markdownSplitter.chunkMarkdown(content, filePath || '');

      // 为每个块添加ID并确保元数据格式正确
      return chunks.map((chunk, index) => ({
        id: `markdown_${Date.now()}_${index}`,
        content: typeof chunk === 'string' ? chunk : chunk.content,
        metadata: {
          ...(typeof chunk === 'object' ? chunk.metadata : {}),
          startLine: chunk.metadata?.startLine || 1,
          endLine: chunk.metadata?.endLine || content.split('\n').length,
          language: 'markdown',
          filePath: filePath,
          type: 'markdown' as const
        }
      }));
    } catch (error) {
      this.logger?.error(`Markdown strategy failed: ${error}`);
      throw error;
    }
  }

  getName(): string {
    return 'MarkdownStrategy';
  }

  getDescription(): string {
    return 'Uses specialized Markdown splitting to preserve semantic structure';
  }

  supportsLanguage(language: string): boolean {
    return ['markdown', 'md'].includes(language.toLowerCase());
  }

  getPriority(): number {
    return 1; // 高优先级，对于Markdown文件
  }
}

/**
 * XML策略实现
 * 实现ISplitStrategy接口，使用专门的XML分段
 */
@injectable()
export class XMLSplitStrategy implements ISplitStrategy {
  constructor(
    @inject(TYPES.XMLTextSplitter) private xmlSplitter?: XMLTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ) {
    this.logger?.debug(`Using XML strategy for ${filePath}`);

    if (!this.xmlSplitter) {
      this.logger?.warn('XMLSplitter not available, falling back to semantic strategy');
      throw new Error('XMLSplitter not available');
    }

    try {
      const chunks = await this.xmlSplitter.chunkXML(content, filePath || '');

      // 为每个块添加ID并确保元数据格式正确
      return chunks.map((chunk, index) => ({
        id: `xml_${Date.now()}_${index}`,
        content: typeof chunk === 'string' ? chunk : chunk.content,
        metadata: {
          ...(typeof chunk === 'object' ? chunk.metadata : {}),
          startLine: chunk.metadata?.startLine || 1,
          endLine: chunk.metadata?.endLine || content.split('\n').length,
          language: language,
          filePath: filePath,
          type: 'element' as const
        }
      }));
    } catch (error) {
      this.logger?.error(`XML strategy failed: ${error}`);
      throw error;
    }
  }

  getName(): string {
    return 'XMLStrategy';
  }

  getDescription(): string {
    return 'Uses specialized XML splitting to preserve element structure';
  }

  supportsLanguage(language: string): boolean {
    return ['xml', 'html', 'xhtml', 'svg'].includes(language.toLowerCase());
  }

  getPriority(): number {
    return 1; // 高优先级，对于XML/HTML文件
  }
}

/**
 * Markdown策略提供者
 */
@injectable()
export class MarkdownStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.MarkdownTextSplitter) private markdownSplitter?: MarkdownTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'markdown_specialized';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new MarkdownSplitStrategy(
      options?.markdownSplitter || this.markdownSplitter,
      this.logger
    );
  }

  getDependencies(): string[] {
    return ['MarkdownTextSplitter'];
  }

  supportsLanguage(language: string): boolean {
    return ['markdown', 'md'].includes(language.toLowerCase());
  }

  getPriority(): number {
    return 1; // 高优先级
  }

  getDescription(): string {
    return 'Provides specialized Markdown document splitting';
  }
}

/**
 * XML策略提供者
 */
@injectable()
export class XMLStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.XMLTextSplitter) private xmlSplitter?: XMLTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'xml_specialized';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new XMLSplitStrategy(
      options?.xmlSplitter || this.xmlSplitter,
      this.logger
    );
  }

  getDependencies(): string[] {
    return ['XMLTextSplitter'];
  }

  supportsLanguage(language: string): boolean {
    return ['xml', 'html', 'xhtml', 'svg'].includes(language.toLowerCase());
  }

  getPriority(): number {
    return 1; // 高优先级
  }

  getDescription(): string {
    return 'Provides specialized XML/HTML document splitting';
  }
}