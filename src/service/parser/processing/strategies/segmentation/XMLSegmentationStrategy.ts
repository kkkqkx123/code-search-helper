import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from '../impl/base/IProcessingStrategy';
import { DetectionResult } from '../../detection/UnifiedDetectionCenter';
import { XMLTextStrategy } from '../../utils/xml/XMLTextStrategy';

/**
 * XML策略实现
 * 使用专门的XML分段器
 */
@injectable()
export class XMLStrategy implements IProcessingStrategy {
  constructor(
    @inject(TYPES.XMLTextStrategy) private xmlStrategy?: XMLTextStrategy,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using XML strategy for ${filePath}`);
    if (!this.xmlStrategy) {
      this.logger?.warn('XMLStrategy not available, falling back to semantic strategy');
      throw new Error('XMLStrategy not available');
    }
    const chunks = await this.xmlStrategy.chunkXML(content, filePath);
    return { chunks, metadata: { strategy: 'XMLStrategy' } };
  }

  getName(): string {
    return 'XMLStrategy';
  }

  getDescription(): string {
    return 'Uses specialized XML splitting to preserve element structure';
  }
}