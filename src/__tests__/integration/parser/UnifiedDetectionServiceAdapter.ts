import { UnifiedDetectionService, DetectionResult as ServiceDetectionResult } from '../../../service/parser/processing/detection/UnifiedDetectionService';
import { UnifiedDetectionCenter, DetectionResult } from '../../../service/parser/processing/detection/UnifiedDetectionCenter';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 适配器类，将UnifiedDetectionService适配到UnifiedDetectionCenter接口
 * 这个适配器继承自UnifiedDetectionCenter，但使用UnifiedDetectionService作为实现
 */
export class UnifiedDetectionServiceAdapter extends UnifiedDetectionCenter {
  private unifiedDetectionService: UnifiedDetectionService;

  constructor(unifiedDetectionService: UnifiedDetectionService, logger?: LoggerService) {
    // 调用父类构造函数，传入必要的参数
    super(logger);
    this.unifiedDetectionService = unifiedDetectionService;
  }

  /**
   * 检测文件 - 适配UnifiedDetectionService的方法到UnifiedDetectionCenter的接口
   */
  async detectFile(filePath: string, content: string): Promise<DetectionResult> {
    // 调用UnifiedDetectionService的检测方法
    const serviceResult: ServiceDetectionResult = await this.unifiedDetectionService.detectFile(filePath, content);
    
    // 将ServiceDetectionResult转换为DetectionResult
    return {
      language: serviceResult.language,
      confidence: serviceResult.confidence,
      fileType: this.mapFileType(serviceResult.detectionMethod),
      extension: this.extractExtension(filePath),
      originalExtension: serviceResult.metadata?.originalExtension,
      indicators: [], // UnifiedDetectionService不提供此信息
      processingStrategy: serviceResult.metadata?.processingStrategy,
      contentLength: serviceResult.metadata?.fileFeatures?.size,
      isHighlyStructured: serviceResult.metadata?.fileFeatures?.isHighlyStructured,
      metadata: {
        originalExtension: serviceResult.metadata?.originalExtension,
        overrideReason: serviceResult.metadata?.overrideReason,
        fileFeatures: serviceResult.metadata?.fileFeatures,
        astInfo: serviceResult.metadata?.astInfo,
        processingStrategy: serviceResult.metadata?.processingStrategy,
        detectionMethod: serviceResult.detectionMethod
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