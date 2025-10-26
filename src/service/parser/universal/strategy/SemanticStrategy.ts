import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { IProcessingStrategy } from '../strategies/IProcessingStrategy';
import { DetectionResult } from '../UnifiedDetectionCenter';
import { UniversalTextSplitter } from '../UniversalTextSplitter';

/**
 * 语义策略实现
 * 使用语义边界检测进行分段
 */
@injectable()
export class SemanticStrategy implements IProcessingStrategy {
  constructor(
    @inject(TYPES.UniversalTextSplitter) private universalTextSplitter?: UniversalTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {}

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Semantic strategy for ${filePath}`);
    if (!this.universalTextSplitter) {
      this.logger?.warn('UniversalTextSplitter not available, falling back to line strategy');
      throw new Error('UniversalTextSplitter not available');
    }
    const chunks = await this.universalTextSplitter.chunkBySemanticBoundaries(content, filePath, detection.language);
    return { chunks };
  }

  getName(): string {
    return 'SemanticStrategy';
  }

  getDescription(): string {
    return 'Uses semantic boundary detection for code splitting';
  }
}