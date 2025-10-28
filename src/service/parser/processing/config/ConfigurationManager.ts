import { injectable, inject } from 'inversify';
import { IConfigurationManager, UniversalChunkingOptions } from '../strategies/types/SegmentationTypes';
import { DEFAULT_CONFIG, BLOCK_SIZE_LIMITS, SMALL_FILE_THRESHOLD } from '../constants';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';

/**
 * 配置管理器实现
 * 职责：管理分段配置，提供配置验证和默认值
 */
@injectable()
export class ConfigurationManager implements IConfigurationManager {
  private defaultOptions: UniversalChunkingOptions;

  constructor(@inject(TYPES.LoggerService) private logger?: LoggerService) {
    try {
      this.logger?.debug('Initializing ConfigurationManager...');
      this.defaultOptions = this.createDefaultOptions();
      this.logger?.debug('ConfigurationManager initialized successfully');
    } catch (error) {
      this.logger?.error('Failed to initialize ConfigurationManager:', error);
      throw error;
    }
  }

  /**
   * 获取默认配置
   */
  getDefaultOptions(): UniversalChunkingOptions {
    return { ...this.defaultOptions };
  }

  /**
   * 验证配置
   */
  validateOptions(options: Partial<UniversalChunkingOptions>): boolean {
    try {
      // 检查必需的字段
      if (options.maxChunkSize !== undefined && options.maxChunkSize <= 0) {
        return false;
      }

      if (options.overlapSize !== undefined && options.overlapSize < 0) {
        return false;
      }

      if (options.maxLinesPerChunk !== undefined && options.maxLinesPerChunk <= 0) {
        return false;
      }

      if (options.maxOverlapRatio !== undefined &&
        (options.maxOverlapRatio < 0 || options.maxOverlapRatio > 1)) {
        return false;
      }

      if (options.errorThreshold !== undefined && options.errorThreshold < 0) {
        return false;
      }

      if (options.memoryLimitMB !== undefined && options.memoryLimitMB <= 0) {
        return false;
      }

      // 验证处理器配置
      if (options.filterConfig) {
        const { minChunkSize, maxChunkSize } = options.filterConfig;
        if (minChunkSize >= maxChunkSize || minChunkSize < 0 || maxChunkSize <= 0) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 合并配置
   */
  mergeOptions(
    base: UniversalChunkingOptions,
    override: Partial<UniversalChunkingOptions>
  ): UniversalChunkingOptions {
    const merged: UniversalChunkingOptions = {
      ...base,
      ...override
    };

    // 深度合并嵌套对象
    if (override.filterConfig) {
      merged.filterConfig = {
        ...base.filterConfig,
        ...override.filterConfig
      };
    }

    if (override.protectionConfig) {
      merged.protectionConfig = {
        ...base.protectionConfig,
        ...override.protectionConfig
      };
    }

    return merged;
  }

  /**
   * 获取特定语言的配置
   */
  getLanguageSpecificConfig(language: string): Partial<UniversalChunkingOptions> {
    const languageConfigs: Record<string, Partial<UniversalChunkingOptions>> = {
      'javascript': {
        maxChunkSize: 2000,
        maxLinesPerChunk: 100,
        enableSemanticDetection: true,
        enableBracketBalance: true
      },
      'typescript': {
        maxChunkSize: 2000,
        maxLinesPerChunk: 100,
        enableSemanticDetection: true,
        enableBracketBalance: true
      },
      'python': {
        maxChunkSize: 1500,
        maxLinesPerChunk: 80,
        enableSemanticDetection: true,
        enableBracketBalance: false
      },
      'java': {
        maxChunkSize: 2500,
        maxLinesPerChunk: 120,
        enableSemanticDetection: true,
        enableBracketBalance: true
      },
      'cpp': {
        maxChunkSize: 2000,
        maxLinesPerChunk: 100,
        enableSemanticDetection: true,
        enableBracketBalance: true
      },
      'c': {
        maxChunkSize: 1800,
        maxLinesPerChunk: 90,
        enableSemanticDetection: true,
        enableBracketBalance: true
      },
      'csharp': {
        maxChunkSize: 2200,
        maxLinesPerChunk: 110,
        enableSemanticDetection: true,
        enableBracketBalance: true
      },
      'go': {
        maxChunkSize: 1800,
        maxLinesPerChunk: 90,
        enableSemanticDetection: true,
        enableBracketBalance: true
      },
      'rust': {
        maxChunkSize: 2000,
        maxLinesPerChunk: 100,
        enableSemanticDetection: true,
        enableBracketBalance: true
      },
      'markdown': {
        maxChunkSize: 3000,
        maxLinesPerChunk: 150,
        enableSemanticDetection: false,
        enableBracketBalance: false,
        enableCodeOverlap: true
      }
    };

    return languageConfigs[language] || {};
  }

  /**
   * 创建默认配置
   */
  private createDefaultOptions(): UniversalChunkingOptions {
    return {
      // 基础分段参数
      maxChunkSize: DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.maxChunkSize,
      overlapSize: DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.overlapSize,
      maxLinesPerChunk: DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.maxLinesPerChunk,

      // 功能开关
      enableBracketBalance: DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.enableBracketBalance,
      enableSemanticDetection: DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.enableSemanticDetection,
      enableCodeOverlap: false,
      enableStandardization: true,
      standardizationFallback: true,

      // 重叠控制
      maxOverlapRatio: 0.3,

      // 错误和性能控制
      errorThreshold: DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.errorThreshold,
      memoryLimitMB: DEFAULT_CONFIG.TEXT_SPLITTER_OPTIONS.memoryLimitMB,

      // 处理器配置
      filterConfig: {
        enableSmallChunkFilter: true,
        enableChunkRebalancing: true,
        minChunkSize: BLOCK_SIZE_LIMITS.MIN_BLOCK_CHARS,
        maxChunkSize: BLOCK_SIZE_LIMITS.MAX_BLOCK_CHARS
      },

      // 保护配置
      protectionConfig: {
        enableProtection: true,
        protectionLevel: 'medium' as const
      }
    };
  }

  /**
   * 更新默认配置
   */
  updateDefaultOptions(options: Partial<UniversalChunkingOptions>): void {
    if (this.validateOptions(options)) {
      this.defaultOptions = this.mergeOptions(this.defaultOptions, options);
    } else {
      throw new Error('Invalid configuration options provided');
    }
  }

  /**
   * 重置为默认配置
   */
  resetToDefaults(): void {
    this.defaultOptions = this.createDefaultOptions();
  }
}