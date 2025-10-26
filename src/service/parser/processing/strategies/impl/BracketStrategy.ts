import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from './IProcessingStrategy';
import { DetectionResult } from '../../../universal/UnifiedDetectionCenter';
import { UniversalTextSplitter } from '../../../universal/UniversalTextSplitter';

/**
 * 括号策略实现
 * 使用括号平衡和行数进行分段
 */
@injectable()
export class BracketStrategy implements IProcessingStrategy {
  constructor(
    @inject(TYPES.UniversalTextSplitter) private universalTextSplitter?: UniversalTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Bracket strategy for ${filePath}`);
    if (!this.universalTextSplitter) {
      this.logger?.warn('UniversalTextSplitter not available, falling back to line strategy');
      throw new Error('UniversalTextSplitter not available');
    }
    const chunks = await this.universalTextSplitter.chunkByBracketsAndLines(content, filePath, detection.language);
    return { chunks };
  }

  getName(): string {
    return 'BracketStrategy';
  }

  getDescription(): string {
    return 'Uses bracket and line-based splitting for structured content';
  }
}