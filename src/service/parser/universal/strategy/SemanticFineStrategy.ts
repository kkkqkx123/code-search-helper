import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { IProcessingStrategy } from '../strategies/IProcessingStrategy';
import { DetectionResult } from '../UnifiedDetectionCenter';
import { UniversalTextSplitter } from '../UniversalTextSplitter';

/**
 * 精细语义策略实现
 * 使用更精细的语义边界检测进行分段
 */
@injectable()
export class SemanticFineStrategy implements IProcessingStrategy {
  constructor(
    @inject(TYPES.UniversalTextSplitter) private universalTextSplitter?: UniversalTextSplitter,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {}

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Semantic Fine strategy for ${filePath}`);

    if (!this.universalTextSplitter) {
      this.logger?.warn('UniversalTextSplitter not available, falling back to semantic strategy');
      throw new Error('UniversalTextSplitter not available');
    }

    // 保存原始选项
    const originalOptions = {
      maxChunkSize: this.universalTextSplitter.getOptions?.()?.maxChunkSize || 2000,
      overlapSize: this.universalTextSplitter.getOptions?.()?.overlapSize || 20,
      maxLinesPerChunk: this.universalTextSplitter.getOptions?.()?.maxLinesPerChunk || 50
    };

    try {
      // 根据内容大小调整重叠大小，小文件使用更小的重叠
      const contentLines = content.split('\n').length;
      const adjustedOverlapSize = Math.min(50, Math.max(20, contentLines * 2)); // 每行约2-50字符重叠

      // 临时设置更精细的分段参数
      this.universalTextSplitter.setOptions({
        maxChunkSize: 800, // 从2000降低到800
        maxLinesPerChunk: 20, // 从50降低到20
        overlapSize: adjustedOverlapSize,   // 动态调整重叠大小
        enableSemanticDetection: true
      });

      const chunks = await this.universalTextSplitter.chunkBySemanticBoundaries(content, filePath, detection.language);

      this.logger?.debug(`Semantic Fine strategy completed, generated ${chunks.length} chunks`);

      return { chunks };

    } catch (error) {
      this.logger?.error(`Semantic Fine strategy failed: ${error}`);
      throw error;
    } finally {
      // 恢复原始选项
      try {
        this.universalTextSplitter.setOptions({
          ...originalOptions,
          enableSemanticDetection: true
        });
      } catch (restoreError) {
        this.logger?.warn(`Failed to restore original text splitter options: ${restoreError}`);
      }
    }
  }

  getName(): string {
    return 'SemanticFineStrategy';
  }

  getDescription(): string {
    return 'Uses fine-grained semantic segmentation with adjusted parameters';
  }
}