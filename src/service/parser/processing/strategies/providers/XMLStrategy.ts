import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from './IProcessingStrategy';
import { DetectionResult } from '../../../universal/UnifiedDetectionCenter';
import { XMLTextSplitter } from '../../../universal/xml/XMLTextSplitter';

/**
 * XML策略实现
 * 使用专门的XML分段器
 */
@injectable()
export class XMLStrategy implements IProcessingStrategy {
  constructor(
    @inject(TYPES.XMLTextSplitter) private xmlSplitter?: XMLTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using XML strategy for ${filePath}`);
    if (!this.xmlSplitter) {
      this.logger?.warn('XMLSplitter not available, falling back to semantic strategy');
      throw new Error('XMLSplitter not available');
    }
    const chunks = await this.xmlSplitter.chunkXML(content, filePath);
    return { chunks, metadata: { strategy: 'XMLStrategy' } };
  }

  getName(): string {
    return 'XMLStrategy';
  }

  getDescription(): string {
    return 'Uses specialized XML splitting to preserve element structure';
  }
}