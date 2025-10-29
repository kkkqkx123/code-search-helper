import { UnifiedDetectionService, DetectionResult } from '../../../service/parser/processing/detection/UnifiedDetectionService';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 适配器类，将UnifiedDetectionService适配到旧接口
 * 这个适配器提供向后兼容性，但使用UnifiedDetectionService作为实现
 */
export class UnifiedDetectionServiceAdapter {
  private unifiedDetectionService: UnifiedDetectionService;

  constructor(unifiedDetectionService: UnifiedDetectionService, logger?: LoggerService) {
    this.unifiedDetectionService = unifiedDetectionService;
  }

  /**
   * 检测文件 - 适配UnifiedDetectionService的方法到旧接口
   */
  async detectFile(filePath: string, content: string): Promise<DetectionResult> {
    // 调用UnifiedDetectionService的检测方法
    const serviceResult = await this.unifiedDetectionService.detectFile(filePath, content);
    
    // 将ServiceDetectionResult转换为DetectionResult
    return {
      language: serviceResult.language,
      confidence: serviceResult.confidence,
      detectionMethod: serviceResult.detectionMethod || 'extension',
      fileType: serviceResult.fileType,
      processingStrategy: serviceResult.processingStrategy,
      metadata: {
        originalExtension: serviceResult.metadata?.originalExtension,
        overrideReason: serviceResult.metadata?.overrideReason,
        fileFeatures: serviceResult.metadata?.fileFeatures,
        astInfo: serviceResult.metadata?.astInfo,
        processingStrategy: serviceResult.metadata?.processingStrategy
      }
    };
  }

  /**
   * 批量检测文件
   */
  async batchDetect(filePaths: Array<{ filePath: string; content: string }>): Promise<Map<string, DetectionResult>> {
    const results = new Map<string, DetectionResult>();
    
    // 并行处理检测
    const detectionPromises = filePaths.map(async ({ filePath, content }) => {
      const result = await this.detectFile(filePath, content);
      results.set(filePath, result);
    });
    
    await Promise.all(detectionPromises);
    
    return results;
  }

  /**
   * 将检测方法映射到文件类型
   */
  private mapFileType(detectionMethod: string): DetectionResult['fileType'] {
    switch (detectionMethod) {
      case 'extension':
        return 'normal';
      case 'content':
        return 'extensionless';
      case 'backup':
        return 'backup';
      default:
        return 'unknown';
    }
  }

  /**
   * 从文件路径提取扩展名
   */
  private extractExtension(filePath: string): string | undefined {
    const lastDotIndex = filePath.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return undefined;
    }
    return filePath.substring(lastDotIndex).toLowerCase();
  }
}