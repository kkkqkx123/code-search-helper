import { injectable, inject } from 'inversify';
import * as path from 'path';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';
import { BackupFileProcessor } from './BackupFileProcessor';
import { ExtensionlessFileProcessor } from './ExtensionlessFileProcessor';
import { LanguageDetector } from '../core/language-detection/LanguageDetector';
import { UniversalProcessingConfig } from './UniversalProcessingConfig';
import { FileFeatureDetector } from './utils/FileFeatureDetector';

export interface DetectionResult {
  language: string;
  confidence: number;
  fileType: 'backup' | 'normal' | 'extensionless' | 'unknown';
  extension?: string;
  originalExtension?: string;
  indicators?: string[];
  processingStrategy?: string;
  contentLength?: number;
  isHighlyStructured?: boolean;
  metadata?: {
    originalExtension?: string;
    overrideReason?: string;
    fileFeatures?: any;
    astInfo?: any;
    processingStrategy?: string;
  };
}

export enum ProcessingStrategyType {
  TREESITTER_AST = 'treesitter-ast',
  UNIVERSAL_SEMANTIC_FINE = 'universal-semantic-fine',
  UNIVERSAL_SEMANTIC = 'universal-semantic',
  UNIVERSAL_BRACKET = 'universal-bracket',
  UNIVERSAL_LINE = 'universal-line',
  MARKDOWN_SPECIALIZED = 'markdown-specialized',
  XML_SPECIALIZED = 'xml-specialized',
  EMERGENCY_SINGLE_CHUNK = 'emergency-single-chunk'
}

@injectable()
export class UnifiedDetectionCenter {
  private backupProcessor: BackupFileProcessor;
  private extensionlessProcessor: ExtensionlessFileProcessor;
  private languageDetector: LanguageDetector;
  private config: UniversalProcessingConfig;
  private fileFeatureDetector: FileFeatureDetector;
  private detectionCache: Map<string, DetectionResult> = new Map();
  private readonly cacheSizeLimit = 1000; // 限制缓存大小

  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    @inject(TYPES.BackupFileProcessor) backupProcessor?: BackupFileProcessor,
    @inject(TYPES.ExtensionlessFileProcessor) extensionlessProcessor?: ExtensionlessFileProcessor,
    @inject(TYPES.UniversalProcessingConfig) config?: UniversalProcessingConfig
  ) {
    this.backupProcessor = backupProcessor || new BackupFileProcessor(logger);
    this.extensionlessProcessor = extensionlessProcessor || new ExtensionlessFileProcessor(logger);
    this.languageDetector = new LanguageDetector();
    this.config = config || new UniversalProcessingConfig(logger);
    this.fileFeatureDetector = new FileFeatureDetector(logger);
  }

  async detectFile(filePath: string, content: string): Promise<DetectionResult> {
    const cacheKey = `${filePath}:${content.length}`;

    // 检查缓存
    if (this.detectionCache.has(cacheKey)) {
      this.logger?.debug(`Cache hit for detection: ${filePath}`);
      return this.detectionCache.get(cacheKey)!;
    }

    // 统一检测流程
    const result = await this.performUnifiedDetection(filePath, content);

    // 管理缓存大小
    if (this.detectionCache.size >= this.cacheSizeLimit) {
      // 删除最旧的条目
      const firstKey = this.detectionCache.keys().next().value;
      if (firstKey) {
        this.detectionCache.delete(firstKey);
      }
    }

    // 缓存结果
    this.detectionCache.set(cacheKey, result);

    return result;
  }

  private async performUnifiedDetection(filePath: string, content: string): Promise<DetectionResult> {
    this.logger?.debug(`Performing unified detection for: ${filePath}`);

    // 1. 备份文件检测（最高优先级）
    if (this.backupProcessor.isBackupFile(filePath)) {
      const backupInfo = this.backupProcessor.inferOriginalType(filePath);
      if (backupInfo.confidence >= this.config.getBackupFileConfidenceThreshold()) {
        this.logger?.info(`Detected backup file, original language: ${backupInfo.originalLanguage}, confidence: ${backupInfo.confidence}`);
        return {
          language: backupInfo.originalLanguage,
          confidence: backupInfo.confidence,
          fileType: 'backup',
          originalExtension: backupInfo.originalExtension,
          processingStrategy: this.determineBackupStrategy(backupInfo),
          metadata: {
            originalExtension: backupInfo.originalExtension,
            processingStrategy: this.determineBackupStrategy(backupInfo)
          }
        };
      }
    }

    // 2. 扩展名检测
    // 2. 扩展名检测
    const ext = path.extname(filePath).toLowerCase();
    if (ext) {
      const language = this.languageDetector.detectLanguageSync(filePath);
      if (language && language !== 'unknown') {
        const isHighlyStructured = this.fileFeatureDetector.isHighlyStructured(content, language);
        return {
          language,
          confidence: 0.8,
          fileType: 'normal',
          extension: ext,
          processingStrategy: this.determineExtensionStrategy(language, content),
          isHighlyStructured,
          metadata: {
            processingStrategy: this.determineExtensionStrategy(language, content)
          }
        };
      }
    }

    // 3. 内容检测（无扩展名文件）
    const contentDetection = this.extensionlessProcessor.detectLanguageByContent(content);
    if (contentDetection.language !== 'unknown' && contentDetection.confidence > 0.5) {
      const isHighlyStructured = this.fileFeatureDetector.isHighlyStructured(content, contentDetection.language);
      return {
        language: contentDetection.language,
        confidence: contentDetection.confidence,
        fileType: 'extensionless',
        indicators: contentDetection.indicators,
        processingStrategy: this.determineContentStrategy(contentDetection),
        isHighlyStructured
      };
    }

    // 4. 默认处理
    const isHighlyStructured = this.fileFeatureDetector.isHighlyStructured(content, 'text');
    return {
      language: 'text',
      confidence: 0.1,
      fileType: 'unknown',
      processingStrategy: ProcessingStrategyType.UNIVERSAL_LINE,
      isHighlyStructured
    };
  }
  private determineBackupStrategy(backupInfo: any): string {
    // 备份文件使用括号平衡分段策略以确保安全性
    return ProcessingStrategyType.UNIVERSAL_BRACKET;
  }

  private determineExtensionStrategy(language: string, content: string): string {
    // 根据语言类型确定策略
    if (this.fileFeatureDetector.isMarkdown(language)) {
      return ProcessingStrategyType.MARKDOWN_SPECIALIZED;
    }

    if (this.fileFeatureDetector.isXML(language)) {
      return ProcessingStrategyType.XML_SPECIALIZED;
    }

    if (this.fileFeatureDetector.isCodeLanguage(language)) {
      // 检查是否支持TreeSitter
      if (this.fileFeatureDetector.canUseTreeSitter(language)) {
        return ProcessingStrategyType.TREESITTER_AST;
      }

      // 检查是否为结构化文件
      if (this.fileFeatureDetector.isHighlyStructured(content, language)) {
        return ProcessingStrategyType.UNIVERSAL_BRACKET;
      }

      return ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE;
    }

    return ProcessingStrategyType.UNIVERSAL_SEMANTIC;
  }

  private determineContentStrategy(contentDetection: any): string {
    const language = contentDetection.language;

    if (this.fileFeatureDetector.isMarkdown(language)) {
      return ProcessingStrategyType.MARKDOWN_SPECIALIZED;
    }

    if (this.fileFeatureDetector.isXML(language)) {
      return ProcessingStrategyType.XML_SPECIALIZED;
    }

    if (this.fileFeatureDetector.isCodeLanguage(language)) {
      // 检查是否支持TreeSitter
      if (this.fileFeatureDetector.canUseTreeSitter(language)) {
        return ProcessingStrategyType.TREESITTER_AST;
      }

      return ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE;
    }

    return ProcessingStrategyType.UNIVERSAL_SEMANTIC;
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
   * 清除检测缓存
   */
  clearCache(): void {
    this.detectionCache.clear();
    this.logger?.info('UnifiedDetectionCenter cache cleared');
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { size: number; limit: number } {
    return {
      size: this.detectionCache.size,
      limit: this.cacheSizeLimit
    };
  }
}