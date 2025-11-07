import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { BackupFileProcessor } from './BackupFileProcessor';
import { IFileFeatureDetector } from './IFileFeatureDetector';
import { fileUtils, languageFeatureDetector } from '../../utils';
import { languageMappingManager } from '../../config/LanguageMappingManager';

/**
 * 语言检测结果接口（兼容core目录的接口）
 */
export interface LanguageDetectionResult {
  language: string | undefined;
  confidence: number;
  method: 'extension' | 'content' | 'backup' | 'hybrid' | 'fallback' | 'query_analysis';
  metadata?: {
    originalExtension?: string;
    indicators?: string[];
    processingStrategy?: string;
    queryMatches?: number;
    totalQueries?: number;
  };
}

/**
 * 统一的语言检测服务
 * 整合了core目录和processing/detection目录的所有功能，使用基于查询规则的分类系统
 */
@injectable()
export class LanguageDetectionService {
  private backupProcessor: BackupFileProcessor;
  private fileFeatureDetector: IFileFeatureDetector;
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.BackupFileProcessor) backupProcessor?: BackupFileProcessor,
    @inject(TYPES.FileFeatureDetector) fileFeatureDetector?: IFileFeatureDetector
  ) {
    this.logger = logger;
    this.backupProcessor = backupProcessor || new BackupFileProcessor(logger);
    this.fileFeatureDetector = fileFeatureDetector!;
  }

  /**
   * 智能语言检测 - 兼容core目录的LanguageDetector接口
   * @param filePath 文件路径
   * @param content 代码内容（可选）
   * @returns 语言检测结果
   */
  async detectLanguage(filePath: string, content?: string): Promise<LanguageDetectionResult> {
    this.logger?.debug(`Detecting language for: ${filePath}`);

    try {
      // 1. 首先检查是否为备份文件
      const backupMetadata = this.backupProcessor.getBackupFileMetadata(filePath);
      if (backupMetadata.isBackup && backupMetadata.originalInfo) {
        const language = backupMetadata.originalInfo.language;
        if (language && language !== 'unknown') {
          return {
            language,
            confidence: backupMetadata.originalInfo.confidence,
            method: 'backup',
            metadata: {
              originalExtension: backupMetadata.originalInfo.extension
            }
          };
        }
      }

      // 2. 尝试通过扩展名检测 using the new classification system
      const extensionResult = await this.detectLanguageByExtensionAsync(filePath);
      if (extensionResult.language && extensionResult.language !== 'unknown' && languageMappingManager.isLanguageSupported(extensionResult.language)) {
        return extensionResult;
      }

      // 3. 如果扩展名检测失败，尝试内容检测
      if (content) {
        const contentDetection = this.detectLanguageByContent(content);
        if (contentDetection.confidence > 0.5) {
          return contentDetection;
        }
      }

      // 如果所有检测都失败，尝试基于文件路径的简单检测
      const simpleDetection = this.detectLanguageSync(filePath);
      if (simpleDetection && simpleDetection !== 'unknown' && languageMappingManager.isLanguageSupported(simpleDetection)) {
        return {
          language: simpleDetection,
          confidence: 0.3,
          method: 'fallback'
        };
      }

      return {
        language: undefined,
        confidence: 0.0,
        method: 'fallback'
      };
    } catch (error) {
      this.logger?.error(`Language detection failed for ${filePath}:`, error);
      // 如果所有检测都失败，尝试基于文件路径的简单检测
      const simpleDetection = this.detectLanguageSync(filePath);
      if (simpleDetection && simpleDetection !== 'unknown' && languageMappingManager.isLanguageSupported(simpleDetection)) {
        return {
          language: simpleDetection,
          confidence: 0.3,
          method: 'fallback'
        };
      }

      return {
        language: undefined,
        confidence: 0.0,
        method: 'fallback'
      };
    }
  }

  /**
   * 同步语言检测 - 仅基于文件扩展名（兼容core目录接口）
   * @param filePath 文件路径
   * @returns 编程语言名称或undefined
   */
  detectLanguageSync(filePath: string): string | undefined {
    return languageMappingManager.getLanguageByPath(filePath);
  }

  /**
   * 根据扩展名检测语言（异步版本）
   * @param filePath 文件路径
   * @returns 语言检测结果
   */
  async detectLanguageByExtensionAsync(filePath: string): Promise<LanguageDetectionResult> {
    const language = languageMappingManager.getLanguageByPath(filePath);
    const extension = fileUtils.extractFileExtension(filePath);

    return {
      language,
      confidence: language ? 0.9 : 0.1,
      method: 'extension',
      metadata: {
        originalExtension: extension
      }
    };
  }

  /**
   * 根据内容检测语言
   * @param content 代码内容
   * @returns 语言检测结果
   */
  detectLanguageByContent(content: string): LanguageDetectionResult {
    // 使用工具类的内容检测
    const detection = languageFeatureDetector.detectLanguageByContent(content);

    if (detection.language && detection.confidence > 0.5 && languageMappingManager.isLanguageSupported(detection.language)) {
      return {
        language: detection.language,
        confidence: detection.confidence,
        method: 'content',
        metadata: {
          indicators: [] // languageFeatureDetector 不提供 indicators，使用空数组
        }
      };
    }

    return detection;
  }

  /**
   * 获取支持的语言列表（兼容core目录接口）
   * @returns 支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return languageMappingManager.getAllSupportedLanguages();
  }

  /**
   * 检查语言是否支持AST解析（兼容core目录接口）
   * @param language 编程语言名称
   * @returns 是否支持AST解析
   */
  isLanguageSupportedForAST(language: string | undefined): boolean {
    if (!language) return false;
    return languageMappingManager.isLanguageSupported(language) && !languageMappingManager.getLanguageConfig(language)?.strategy.skipASTParsing;
  }

  /**
   * 验证语言检测结果（兼容core目录接口）
   * @param content 代码内容
   * @param detectedLanguage 检测到的语言
   * @returns 验证结果
   */
  validateLanguageDetection(content: string, detectedLanguage: string): boolean {
    return languageFeatureDetector.validateLanguageDetection(content, detectedLanguage);
  }

  /**
   * 根据文件扩展名检测语言（兼容core目录接口）
   * @param ext 文件扩展名
   * @returns 编程语言名称或undefined
   */
  detectLanguageByExtension(ext: string): string | undefined {
    return languageMappingManager.getLanguageByExtension(ext);
  }

  /**
   * 获取文件扩展名（兼容core目录接口）
   * @param filePath 文件路径
   * @returns 文件扩展名
   */
  getFileExtension(filePath: string): string {
    return fileUtils.extractFileExtension(filePath);
  }

  /**
   * TreeSitter专用语言检测（兼容TreeSitterLanguageDetector接口）
   * @param filePath 文件路径
   * @param parsers 解析器映射
   * @param content 代码内容（可选）
   * @returns 解析器语言或null
   */
  detectLanguageByParserConfig(
    filePath: string,
    parsers: Map<string, any>,
    content?: string
  ): any | null {
    try {
      // 首先检查是否为备份文件
      const backupMetadata = this.backupProcessor.getBackupFileMetadata(filePath);
      if (backupMetadata.isBackup && backupMetadata.originalInfo) {
        const language = backupMetadata.originalInfo.language;
        if (language && language !== 'unknown' && languageMappingManager.isLanguageSupported(language)) {
          const parser = parsers.get(language);
          return parser && parser.supported ? parser : null;
        }
      }

      // 1. 安全提取文件扩展名
      const ext = this.extractFileExtension(filePath);
      if (!ext) {
        // 如果没有扩展名，尝试内容检测
        if (content) {
          const contentDetection = languageFeatureDetector.detectLanguageByContent(content);
          if (contentDetection.language && contentDetection.confidence > 0.5 && languageMappingManager.isLanguageSupported(contentDetection.language)) {
            const parser = parsers.get(contentDetection.language);
            return parser && parser.supported ? parser : null;
          }
        }
        return null;
      }

      // 2. 基于扩展名的初步检测 using new classification system
      let language = parsers.get(this.getLanguageKeyByExtension(ext));

      // 3. 基于内容的二次验证（如果提供了内容）
      if (content && language) {
        const confirmedLanguage = this.validateLanguageByContent(content, language);
        if (confirmedLanguage) {
          return confirmedLanguage;
        }
      }

      // 4. Fallback：基于内容特征检测
      if (content && !language) {
        const detectedByContent = this.detectLanguageByContentFeatures(content, parsers);
        if (detectedByContent) {
          language = detectedByContent;
        }
      }

      return language && language.supported ? language : null;
    } catch (error) {
      this.logger?.error(`Language detection failed for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 安全的文件扩展名提取
   * @param filePath 文件路径
   * @returns 文件扩展名
   */
  private extractFileExtension(filePath: string): string {
    return fileUtils.extractFileExtension(filePath);
  }

  /**
   * 基于扩展名获取语言键
   * @param ext 文件扩展名
   * @returns 语言键
   */
  private getLanguageKeyByExtension(ext: string): string {
    return languageMappingManager.getLanguageByExtension(ext) || '';
  }

  /**
   * 基于内容验证语言
   * @param content 代码内容
   * @param detectedLanguage 检测到的语言
   * @returns 验证后的语言或null
   */
  private validateLanguageByContent(content: string, detectedLanguage: any): any | null {
    try {
      const contentLower = content.trim().toLowerCase();

      // 使用公共的特征检测器验证
      const isValid = languageFeatureDetector.validateLanguageDetection(content, detectedLanguage.name.toLowerCase());

      if (isValid) {
        return detectedLanguage;
      }

      return null; // 验证失败
    } catch (error) {
      this.logger?.error('Language content validation failed:', error);
      return detectedLanguage; // 验证出错时信任扩展名检测
    }
  }

  /**
   * 基于内容特征检测语言
   * @param content 代码内容
   * @param parsers 解析器映射
   * @returns 检测到的语言或null
   */
  private detectLanguageByContentFeatures(content: string, parsers: Map<string, any>): any | null {
    try {
      // 使用语言特征检测器进行内容检测
      const detectionResult = languageFeatureDetector.detectLanguageByContent(content);

      if (detectionResult.language && detectionResult.confidence > 0.5 && languageMappingManager.isLanguageSupported(detectionResult.language)) {
        return parsers.get(detectionResult.language) || null;
      }

      return null;
    } catch (error) {
      this.logger?.error('Language detection by content features failed:', error);
      return null;
    }
  }
}