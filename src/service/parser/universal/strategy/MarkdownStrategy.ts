import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { IProcessingStrategy } from '../strategies/IProcessingStrategy';
import { DetectionResult } from '../UnifiedDetectionCenter';
import { MarkdownTextSplitter } from '../md/MarkdownTextSplitter';

/**
 * Markdown策略实现
 * 使用专门的Markdown分段器
 */
@injectable()
export class MarkdownStrategy implements IProcessingStrategy {
  constructor(
    @inject(TYPES.MarkdownTextSplitter) private markdownSplitter?: MarkdownTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {}

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Markdown strategy for ${filePath}`);
    if (!this.markdownSplitter) {
      this.logger?.warn('MarkdownSplitter not available, falling back to semantic strategy');
      throw new Error('MarkdownSplitter not available');
    }
    const chunks = await this.markdownSplitter.chunkMarkdown(content, filePath);
    return { chunks, metadata: { strategy: 'MarkdownStrategy' } };
  }

  getName(): string {
    return 'MarkdownStrategy';
  }

  getDescription(): string {
    return 'Uses specialized Markdown splitting to preserve semantic structure';
  }
}