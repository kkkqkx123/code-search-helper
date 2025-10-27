import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { BackupFileProcessor } from '../../detection/BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../../detection/ExtensionlessFileProcessor';
import { UniversalProcessingConfig } from '../../config/UniversalProcessingConfig';
import * as path from 'path';
import { LANGUAGE_MAP } from '../constants';
import { FileFeatureDetector } from '../../detection/FileFeatureDetector';

// 定义接口和类型
export interface ILanguageDetectionInfo {
  language: string;
  confidence: number;
  detectionMethod: 'extension' | 'content' | 'backup' | 'default';
  metadata?: Record<string, any>;
}

export interface IStrategySelectionContext {
  filePath: string;
  content: string;
  languageInfo: ILanguageDetectionInfo;
}

export interface IStrategySelectionResult {
  strategy: ProcessingStrategyType;
  reason: string;
  shouldFallback: boolean;
  fallbackReason?: string;
  parameters?: Record<string, any>;
}

export enum ProcessingStrategyType {
  TREESITTER_AST = 'treesitter-ast',
  UNIVERSAL_BRACKET = 'universal-bracket',
  UNIVERSAL_SEMANTIC = 'universal-semantic',
  UNIVERSAL_SEMANTIC_FINE = 'universal-semantic-fine',
  UNIVERSAL_LINE = 'universal-line'
}

export interface IProcessingStrategySelector {
  name: string;
  description: string;
  detectLanguageIntelligently(filePath: string, content: string): Promise<ILanguageDetectionInfo>;
  selectProcessingStrategy(context: IStrategySelectionContext): Promise<IStrategySelectionResult>;
  isCodeLanguage(language: string): boolean;
  isTextLanguage(language: string): boolean;
  canUseTreeSitter(language: string): boolean;
  isStructuredFile(content: string, language: string): boolean;
}

/**
 * 处理策略选择器
 * 负责智能语言检测和处理策略选择
 */
@injectable()
export class ProcessingStrategySelector implements IProcessingStrategySelector {
  private logger?: LoggerService;
  private backupFileProcessor: BackupFileProcessor;
  private extensionlessFileProcessor: ExtensionlessFileProcessor;
  private config: UniversalProcessingConfig;
  private fileFeatureDetector: FileFeatureDetector;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.BackupFileProcessor) backupFileProcessor?: BackupFileProcessor,
    @inject(TYPES.ExtensionlessFileProcessor) extensionlessFileProcessor?: ExtensionlessFileProcessor,
    @inject(TYPES.UniversalProcessingConfig) config?: UniversalProcessingConfig
  ) {
    this.logger = logger;

    // 如果没有提供依赖，创建默认实例
    this.backupFileProcessor = backupFileProcessor || new BackupFileProcessor(logger);
    this.extensionlessFileProcessor = extensionlessFileProcessor || new ExtensionlessFileProcessor(logger);
    this.config = config || new UniversalProcessingConfig(logger);
    this.fileFeatureDetector = new FileFeatureDetector(logger);
  }

  get name(): string {
    return 'ProcessingStrategySelector';
  }

  get description(): string {
    return 'Intelligent language detection and processing strategy selection';
  }

  /**
   * 智能语言检测
   */
  async detectLanguageIntelligently(filePath: string, content: string): Promise<ILanguageDetectionInfo> {
    try {
      this.logger?.debug(`Detecting language for file: ${filePath}`);

      // 1. 检查是否为备份文件
      if (this.backupFileProcessor.isBackupFile(filePath)) {
        const backupInfo = this.backupFileProcessor.inferOriginalType(filePath);
        const confidenceThreshold = this.config.getBackupFileConfidenceThreshold();

        this.logger?.info(`Detected backup file, original language: ${backupInfo.originalLanguage}, confidence: ${backupInfo.confidence}, threshold: ${confidenceThreshold}`);

        // 只有当置信度超过阈值时才采纳备份文件的推断结果
        if (backupInfo.confidence >= confidenceThreshold) {
          return {
            language: backupInfo.originalLanguage,
            confidence: backupInfo.confidence,
            detectionMethod: 'backup',
            metadata: {
              originalExtension: backupInfo.originalExtension
            }
          };
        } else {
          this.logger?.info(`Backup file confidence ${backupInfo.confidence} below threshold ${confidenceThreshold}, treating as regular file`);
          // 如果置信度低于阈值，继续使用其他检测方法
          // 不返回，继续执行下面的检测逻辑
        }
      }

      // 2. 检查文件扩展名
      const ext = path.extname(filePath).toLowerCase();
      if (ext) {
        const languageFromExt = this.detectLanguageByExtension(ext);
        if (languageFromExt !== 'unknown') {
          // 对于通用扩展名（如.md），进一步检查内容
          if (languageFromExt === 'markdown' || languageFromExt === 'text') {
            const contentDetection = this.extensionlessFileProcessor.detectLanguageByContent(content);
            if (contentDetection.confidence > 0.3) {
              this.logger?.info(`Content-based detection override: ${contentDetection.language} (confidence: ${contentDetection.confidence})`);
              return {
                language: contentDetection.language,
                confidence: contentDetection.confidence,
                detectionMethod: 'content',
                metadata: {
                  originalExtension: languageFromExt,
                  overrideReason: 'content_confidence_higher'
                }
              };
            }
          }

          this.logger?.info(`Extension-based detection: ${languageFromExt}`);
          return {
            language: languageFromExt,
            confidence: 0.8,
            detectionMethod: 'extension',
            metadata: {
              extension: ext
            }
          };
        }
      }

      // 3. 基于内容检测
      const contentDetection = this.extensionlessFileProcessor.detectLanguageByContent(content);
      if (contentDetection.language !== 'unknown' && contentDetection.confidence > 0.05) {
        this.logger?.info(`Content-based detection: ${contentDetection.language} (confidence: ${contentDetection.confidence})`);
        return {
          language: contentDetection.language,
          confidence: contentDetection.confidence,
          detectionMethod: 'content',
          metadata: {
            indicators: contentDetection.indicators
          }
        };
      }

      // 4. 默认返回text
      this.logger?.info(`Defaulting to text language`);
      return {
        language: 'text',
        confidence: 0.1,
        detectionMethod: 'default',
        metadata: {
          reason: 'no_clear_detection'
        }
      };
    } catch (error) {
      this.logger?.error(`Error in language detection: ${error}`);
      // 出错时返回默认语言
      return {
        language: 'text',
        confidence: 0.05,
        detectionMethod: 'default' as const,
        metadata: {
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * 选择处理策略
   */
  async selectProcessingStrategy(context: IStrategySelectionContext): Promise<IStrategySelectionResult> {
    try {
      const { filePath, content, languageInfo } = context;
      const { language } = languageInfo;

      this.logger?.debug(`Selecting processing strategy for ${filePath} (language: ${language})`);

      // 如果是备份文件，使用通用处理
      if (this.backupFileProcessor.isBackupFile(filePath)) {
        this.logger?.info(`Backup file detected, using bracket-based processing`);
        return {
          strategy: ProcessingStrategyType.UNIVERSAL_BRACKET,
          reason: 'Backup file - using safe bracket-based processing',
          shouldFallback: false,
          parameters: {
            backupType: 'detected'
          }
        };
      }

      // 如果是代码文件，优先使用TreeSitter进行AST解析
      if (this.isCodeLanguage(language)) {
        // 检查是否可以使用TreeSitter
        if (this.canUseTreeSitter(language)) {
          this.logger?.info(`Code language with TreeSitter support: ${language}`);
          return {
            strategy: ProcessingStrategyType.TREESITTER_AST,
            reason: `Code language ${language} supports TreeSitter AST parsing`,
            shouldFallback: false,
            parameters: {
              language,
              hasTreeSitterSupport: true
            }
          };
        }

        // 检查是否为结构化文件
        if (this.isStructuredFile(content, language)) {
          this.logger?.info(`Structured file detected for language: ${language}`);
          return {
            strategy: ProcessingStrategyType.UNIVERSAL_BRACKET,
            reason: `Structured file detected - using bracket-balanced segmentation`,
            shouldFallback: false,
            parameters: {
              language,
              structuredType: 'detected'
            }
          };
        }

        // 如果不能使用TreeSitter，使用精细的语义分段
        this.logger?.info(`Code language without TreeSitter support: ${language}`);
        return {
          strategy: ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE,
          reason: `Code language ${language} - using fine semantic segmentation`,
          shouldFallback: false,
          parameters: {
            language,
            hasTreeSitterSupport: false
          }
        };
      }

      // 对于文本类语言（markdown, text等），使用语义分段
      if (this.isTextLanguage(language)) {
        this.logger?.info(`Text language detected: ${language}`);
        return {
          strategy: ProcessingStrategyType.UNIVERSAL_SEMANTIC,
          reason: `Text language ${language} - using semantic segmentation`,
          shouldFallback: false,
          parameters: {
            language,
            contentType: 'text'
          }
        };
      }

      // 对于结构化文件，使用括号平衡分段
      if (this.isStructuredFile(content, language)) {
        this.logger?.info(`Structured file detected for language: ${language}`);
        return {
          strategy: ProcessingStrategyType.UNIVERSAL_BRACKET,
          reason: `Structured file detected - using bracket-balanced segmentation`,
          shouldFallback: false,
          parameters: {
            language,
            structuredType: 'detected'
          }
        };
      }

      // 默认使用行分段
      this.logger?.info(`Defaulting to line-based segmentation for: ${language}`);
      return {
        strategy: ProcessingStrategyType.UNIVERSAL_LINE,
        reason: `Default strategy for ${language} - using line-based segmentation`,
        shouldFallback: false,
        parameters: {
          language,
          defaultStrategy: true
        }
      };
    } catch (error) {
      this.logger?.error(`Error in strategy selection: ${error}`);
      // 出错时使用降级策略
      return {
        strategy: ProcessingStrategyType.UNIVERSAL_LINE,
        reason: `Error in strategy selection, falling back to line-based: ${(error as Error).message}`,
        shouldFallback: true,
        fallbackReason: `Strategy selection error: ${(error as Error).message}`,
        parameters: {
          error: (error as Error).message
        }
      };
    }
  }

  /**
   * 根据扩展名检测语言
   */
  private detectLanguageByExtension(extension: string): string {
    return this.fileFeatureDetector.detectLanguageByExtension(extension, LANGUAGE_MAP);
  }

  /**
   * 检查是否为代码语言
   */
  isCodeLanguage(language: string): boolean {
    return this.fileFeatureDetector.isCodeLanguage(language);
  }

  /**
   * 检查是否为文本类语言（需要智能分段的非代码文件）
   */
  isTextLanguage(language: string): boolean {
    return this.fileFeatureDetector.isTextLanguage(language);
  }

  /**
   * 检查是否可以使用TreeSitter
   */
  canUseTreeSitter(language: string): boolean {
    return this.fileFeatureDetector.canUseTreeSitter(language);
  }

  /**
   * 检查是否为结构化文件
   */
  isStructuredFile(content: string, language: string): boolean {
    return this.fileFeatureDetector.isStructuredFile(content, language);
  }
}