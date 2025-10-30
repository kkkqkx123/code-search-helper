import { IConfigurationManager } from '../../../service/parser/processing/strategies/types/SegmentationTypes';
import { UniversalChunkingOptions } from '../../../service/parser/processing/strategies/types/SegmentationTypes';
import { UnifiedConfigManager } from '../../../service/parser/config/UnifiedConfigManager';
import { ChunkingOptions } from '../../../service/parser/interfaces/CoreISplitStrategy';

/**
 * 适配器类，将UnifiedConfigManager适配到IConfigurationManager接口
 */
export class ConfigurationManagerAdapter implements IConfigurationManager {
  private unifiedConfigManager: UnifiedConfigManager;

  constructor(unifiedConfigManager: UnifiedConfigManager) {
    this.unifiedConfigManager = unifiedConfigManager;
  }

  /**
   * 获取默认配置
   */
  getDefaultOptions(): UniversalChunkingOptions {
    const globalConfig = this.unifiedConfigManager.getGlobalConfig();
    
    // 将ChunkingOptions转换为UniversalChunkingOptions
    return {
      maxChunkSize: globalConfig.basic?.maxChunkSize || 2000,
      overlapSize: globalConfig.basic?.overlapSize || 200,
      maxLinesPerChunk: globalConfig.basic?.maxLines || 100,
      enableBracketBalance: globalConfig.basic?.optimizationLevel !== 'low',
      enableSemanticDetection: globalConfig.basic?.optimizationLevel !== 'low',
      enableCodeOverlap: globalConfig.basic?.addOverlap || false,
      enableStandardization: true,
      standardizationFallback: true,
      maxOverlapRatio: globalConfig.advanced?.maxOverlapRatio || 0.3,
      errorThreshold: 10,
      memoryLimitMB: 512,
      filterConfig: {
        enableSmallChunkFilter: true,
        enableChunkRebalancing: true,
        minChunkSize: globalConfig.basic?.minChunkSize || 100,
        maxChunkSize: globalConfig.basic?.maxChunkSize ? globalConfig.basic.maxChunkSize * 2 : 4000
      },
      protectionConfig: {
        enableProtection: true,
        protectionLevel: 'medium'
      }
    };
  }

  /**
   * 验证配置
   */
  validateOptions(options: Partial<UniversalChunkingOptions>): boolean {
    // 简单验证配置选项
    if (options.maxChunkSize && options.maxChunkSize <= 0) {
      return false;
    }
    
    if (options.overlapSize && options.overlapSize < 0) {
      return false;
    }
    
    if (options.maxLinesPerChunk && options.maxLinesPerChunk <= 0) {
      return false;
    }
    
    return true;
  }

  /**
   * 合并配置
   */
  mergeOptions(
    base: UniversalChunkingOptions,
    override: Partial<UniversalChunkingOptions>
  ): UniversalChunkingOptions {
    return { ...base, ...override };
  }

  /**
   * 获取特定语言的配置
   */
  getLanguageSpecificConfig(language: string): Partial<UniversalChunkingOptions> {
    const languageConfig = this.unifiedConfigManager.getLanguageConfig(language);
    
    // 将ChunkingOptions转换为Partial<UniversalChunkingOptions>
    return {
      maxChunkSize: languageConfig.basic?.maxChunkSize,
      overlapSize: languageConfig.basic?.overlapSize,
      maxLinesPerChunk: languageConfig.basic?.maxLines,
      enableBracketBalance: languageConfig.basic?.optimizationLevel !== 'low',
      enableSemanticDetection: languageConfig.basic?.optimizationLevel !== 'low',
      enableCodeOverlap: languageConfig.basic?.addOverlap,
      maxOverlapRatio: languageConfig.advanced?.maxOverlapRatio
    };
  }
}