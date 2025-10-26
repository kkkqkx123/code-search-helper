import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from './IProcessingStrategy';
import { DetectionResult } from '../../../universal/UnifiedDetectionCenter';
import { UniversalTextSplitter } from '../../../universal/UniversalTextSplitter';

/**
 * 行策略实现
 * 使用简单的行数分段作为后备策略
 */
@injectable()
export class LineStrategy implements IProcessingStrategy {
  constructor(
    @inject(TYPES.UniversalTextSplitter) private universalTextSplitter?: UniversalTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Line strategy for ${filePath}`);
    if (!this.universalTextSplitter) {
      this.logger?.warn('UniversalTextSplitter not available, falling back to simple line strategy');
      // 如果没有UniversalTextSplitter，返回一个包含全部内容的简单块
      return {
        chunks: [{
          content,
          metadata: {
            startLine: 1,
            endLine: content.split('\n').length,
            language: detection.language,
            filePath,
            fallback: true
          }
        }],
        metadata: { strategy: 'LineStrategy', error: 'UniversalTextSplitter not available' }
      };
    }
    const chunks = await this.universalTextSplitter.chunkByLines(content, filePath, detection.language);
    return { chunks };
  }

  getName(): string {
    return 'LineStrategy';
  }

  getDescription(): string {
    return 'Uses simple line-based splitting as a fallback';
  }
}