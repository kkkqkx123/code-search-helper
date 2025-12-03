import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';
import { languageMappingManager } from '../config/LanguageMappingManager';
import { IFileFeatureDetector, FileFeatures, DetectionResult } from './IFileFeatureDetector';
import { IEventBus } from '../../../interfaces/IEventBus';
import { ParserEvents, FileDetectedEvent, FileDetectionFailedEvent } from '../events/ParserEvents';

/**
 * 核心语言检测服务接口
 */
export interface ILanguageDetector {
  /**
   * 检测语言
   * @param filePath 文件路径
   * @param content 代码内容（可选）
   * @returns 语言检测结果
   */
  detectLanguage(filePath: string, content?: string): Promise<LanguageDetectionResult>;

  /**
   * 同步检测语言 - 仅基于文件扩展名
   * @param filePath 文件路径
   * @returns 编程语言名称或undefined
   */
  detectLanguageSync(filePath: string): string | undefined;

  /**
   * 获取支持的语言列表
   * @returns 支持的语言列表
   */
  getSupportedLanguages(): string[];

  /**
   * 检查语言是否支持AST解析
   * @param language 编程语言名称
   * @returns 是否支持AST解析
   */
  isLanguageSupportedForAST(language: string | undefined): boolean;
}

export enum ProcessingStrategyType {
  // 简化的策略名称
  BINARY = 'binary',
  MARKDOWN = 'markdown',
  XML = 'xml',
  HTML = 'html',
  AST = 'ast',
  SEMANTIC = 'semantic',
  BRACKET = 'bracket',
  LINE = 'line',
  TEXT = 'text',
}

/**
 * 语言检测结果接口（向后兼容）
 */
export interface LanguageDetectionResult {
  language: string | undefined;
  method: 'extension' | 'content' | 'backup' | 'hybrid' | 'fallback' | 'query_analysis';
  metadata?: {
    originalExtension?: string;
    indicators?: string[];
    queryMatches?: number;
    totalQueries?: number;
  };
}

/**
 * 核心语言检测服务实现
 * 提供基础的语言检测功能，集成了基于查询规则目录的语言分类
 */
@injectable()
export class LanguageDetector implements ILanguageDetector {
  private logger?: LoggerService;
  private fileFeatureDetector: IFileFeatureDetector;
  private eventBus?: IEventBus;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.FileFeatureDetector) fileFeatureDetector?: IFileFeatureDetector,
    @inject(TYPES.EventBus) eventBus?: IEventBus
  ) {
    this.logger = logger;
    this.fileFeatureDetector = fileFeatureDetector!;
    this.eventBus = eventBus;
    this.logger?.debug('LanguageDetector initialized');
  }

  /**
   * 智能文件检测（主要入口）- 合并自 DetectionService
   */
  async detectFile(filePath: string, content: string): Promise<DetectionResult> {
    const startTime = Date.now();
    this.logger?.debug(`Detecting file: ${filePath}`);

    // 发布检测开始事件
    this.eventBus?.emit(ParserEvents.FILE_DETECTION_STARTED, { filePath, contentLength: content.length });

    try {
      // 1. 基于扩展名的语言检测（仅保留此方法）
      const language = this.detectLanguageSync(filePath);

      // 2. 直接使用扩展名结果，不再进行内容检测
      const finalResult: DetectionResult = {
        language: language || 'unknown',
        detectionMethod: 'extension',
        fileType: language !== 'unknown' ? 'normal' : 'unknown',
        filePath: filePath,
        metadata: {
          originalExtension: this.getFileExtension(filePath)
        }
      };

      // 3. 文件特征分析（保留基本的特征分析）
      const fileFeatures = this.fileFeatureDetector.analyzeFileFeatures(content, finalResult.language);
      finalResult.metadata.fileFeatures = fileFeatures;

      // 4. 处理策略推荐
      finalResult.metadata.processingStrategy = this.fileFeatureDetector.recommendProcessingStrategy(finalResult, fileFeatures);
      finalResult.processingStrategy = finalResult.metadata.processingStrategy;

      // 确保fileType有值
      if (!finalResult.fileType) {
        finalResult.fileType = 'normal';
      }

      this.logger?.debug(`Final detection result: ${finalResult.language}`);

      return finalResult;

    } catch (error) {
      this.logger?.error(`File detection failed for ${filePath}:`, error);

      // 发布检测失败事件
      const errorEventData: FileDetectionFailedEvent = {
        filePath,
        error: error as Error,
        duration: Date.now() - startTime
      };
      this.eventBus?.emit(ParserEvents.FILE_DETECTION_FAILED, errorEventData);

      const fallbackResult = this.fileFeatureDetector.createFallbackResult(filePath, content);
      fallbackResult.filePath = filePath;
      return fallbackResult;
    }
  }

  /**
   * 检测语言（简化版）
   */
  async detectLanguage(filePath: string, content?: string): Promise<LanguageDetectionResult> {
    // 仅基于扩展名检测，移除内容检测
    const extensionResult = this.detectLanguageSync(filePath);
    if (extensionResult && extensionResult !== 'unknown' && languageMappingManager.isLanguageSupported(extensionResult)) {
      return {
        language: extensionResult,
        method: 'extension',
        metadata: {
          originalExtension: this.getFileExtension(filePath)
        }
      };
    }

    return {
      language: undefined,
      method: 'fallback'
    };
  }

  /**
   * 同步检测语言 - 仅基于文件扩展名
   */
  detectLanguageSync(filePath: string): string | undefined {
    return languageMappingManager.getLanguageByPath(filePath);
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return languageMappingManager.getAllSupportedLanguages();
  }

  /**
   * 检查语言是否支持AST解析
   */
  isLanguageSupportedForAST(language: string | undefined): boolean {
    if (!language) return false;

    const config = languageMappingManager.getLanguageConfig(language);
    if (!config) return false;

    // 检查该语言的策略是否跳过AST解析
    return !config.strategy.skipASTParsing;
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot !== -1 ? filePath.substring(lastDot).toLowerCase() : '';
  }

}