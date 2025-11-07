import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { UnifiedConfigManager } from '../../config/UnifiedConfigManager';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { IFileFeatureDetector } from './IFileFeatureDetector';
import { BackupFileProcessor } from './BackupFileProcessor';
import { LanguageDetector } from '../../core/language-detection/LanguageDetector';
import { languageFeatureDetector } from '../../utils';
import { IEventBus } from '../../../../interfaces/IEventBus';
import { ParserEvents, FileDetectedEvent, FileDetectionFailedEvent } from '../../events/ParserEvents';

export enum ProcessingStrategyType {
  TREESITTER_AST = 'treesitter_ast',
  UNIVERSAL_SEMANTIC_FINE = 'universal_semantic_fine',
  UNIVERSAL_SEMANTIC = 'universal_semantic',
  UNIVERSAL_BRACKET = 'universal_bracket',
  UNIVERSAL_LINE = 'universal_line',
  MARKDOWN_SPECIALIZED = 'markdown_specialized',
  XML_SPECIALIZED = 'xml_specialized',
  HTML_LAYERED = 'html_layered',
  EMERGENCY_SINGLE_CHUNK = 'emergency_single_chunk'
}
/**
 * 检测结果接口
 */
export interface DetectionResult {
  language: string;
  confidence: number;
  detectionMethod: 'extension' | 'content' | 'backup' | 'hybrid';
  fileType?: 'backup' | 'normal' | 'extensionless' | 'unknown'; // 添加fileType字段
  processingStrategy?: string; // 添加processingStrategy字段
  filePath?: string; // 添加filePath字段
  metadata: {
    originalExtension?: string;
    overrideReason?: string;
    fileFeatures?: FileFeatures;
    processingStrategy?: string;
  };
}

/**
 * 文件特征接口
 */
export interface FileFeatures {
  isCodeFile: boolean;
  isTextFile: boolean;
  isMarkdownFile: boolean;
  isXMLFile: boolean;
  isStructuredFile: boolean;
  isHighlyStructured: boolean;
  complexity: number;
  lineCount: number;
  size: number;
  hasImports: boolean;
  hasExports: boolean;
  hasFunctions: boolean;
  hasClasses: boolean;
}

/**
 * 语言检测信息接口
 */
export interface LanguageDetectionInfo {
  language: string;
  confidence: number;
  detectionMethod: string;
  metadata?: any;
}

/**
 * 统一检测服务
 * 整合了 UnifiedDetectionCenter、LanguageDetector 和 FileFeatureDetector 的功能
 */
@injectable()
export class UnifiedDetectionService {
  private logger?: LoggerService;
  private configManager: UnifiedConfigManager;
  private fileFeatureDetector: IFileFeatureDetector;
  private backupFileProcessor: BackupFileProcessor;
  private languageDetector: LanguageDetector;
  private eventBus?: IEventBus;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.UnifiedConfigManager) configManager?: UnifiedConfigManager,
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.FileFeatureDetector) fileFeatureDetector?: IFileFeatureDetector,
    @inject(TYPES.BackupFileProcessor) backupFileProcessor?: BackupFileProcessor,
    @inject(TYPES.LanguageDetector) languageDetector?: LanguageDetector,
    @inject(TYPES.EventBus) eventBus?: IEventBus
  ) {
    this.logger = logger;
    this.configManager = configManager || new UnifiedConfigManager();
    this.fileFeatureDetector = fileFeatureDetector!;
    this.backupFileProcessor = backupFileProcessor || new BackupFileProcessor(logger);
    this.languageDetector = languageDetector || new LanguageDetector();
    this.eventBus = eventBus;
    this.logger?.debug('UnifiedDetectionService initialized');
  }

  /**
   * 智能文件检测（主要入口）
   */
  async detectFile(filePath: string, content: string): Promise<DetectionResult> {
    const startTime = Date.now();
    this.logger?.debug(`Detecting file: ${filePath}`);

    // 发布检测开始事件
    this.eventBus?.emit(ParserEvents.FILE_DETECTION_STARTED, { filePath, contentLength: content.length });

    try {
      // 1. 检查是否为备份文件
      const backupResult = this.detectBackupFile(filePath, content);
      if (backupResult) {
        backupResult.filePath = filePath; // 添加filePath
        this.logger?.info(`Detected backup file: ${backupResult.language} (confidence: ${backupResult.confidence})`);
        return backupResult;
      }

      // 2. 基于扩展名的语言检测
      const extensionResult = this.detectLanguageByExtension(filePath);

      // 3. 基于内容的语言检测
      const contentResult = this.detectLanguageByContent(content);

      // 4. 智能决策
      const finalResult = this.makeDetectionDecision(filePath, content, extensionResult, contentResult);
      finalResult.filePath = filePath; // 添加filePath

      // 5. 文件特征分析
      const fileFeatures = this.analyzeFileFeatures(content, finalResult.language);
      finalResult.metadata.fileFeatures = fileFeatures;

      // 6. 处理策略推荐
      finalResult.metadata.processingStrategy = this.recommendProcessingStrategy(finalResult, fileFeatures);
      finalResult.processingStrategy = finalResult.metadata.processingStrategy;

      // 确保fileType有值
      if (!finalResult.fileType) {
        finalResult.fileType = 'normal';
      }

      this.logger?.debug(`Final detection result: ${finalResult.language} (confidence: ${finalResult.confidence})`);

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

      const fallbackResult = this.createFallbackResult(filePath, content);
      fallbackResult.filePath = filePath; // 添加filePath
      return fallbackResult;
    }
  }

  /**
   * 检测备份文件
   */
  private detectBackupFile(filePath: string, content: string): DetectionResult | null {
    // 使用现有的BackupFileProcessor
    if (!this.backupFileProcessor.isBackupFile(filePath)) {
      return null;
    }

    const backupMetadata = this.backupFileProcessor.getBackupFileMetadata(filePath);
    if (backupMetadata.originalInfo && backupMetadata.originalInfo.confidence >= 0.5) {
      return {
        language: backupMetadata.originalInfo.language,
        confidence: backupMetadata.originalInfo.confidence,
        detectionMethod: 'backup',
        fileType: 'backup',
        metadata: {
          originalExtension: backupMetadata.originalInfo.extension,
          fileFeatures: this.analyzeFileFeatures(content, backupMetadata.originalInfo.language)
        }
      };
    }

    return null;
  }

  /**
   * 基于扩展名检测语言
   */
  private detectLanguageByExtension(filePath: string): LanguageDetectionInfo {
    // 使用LanguageDetector中的语言映射逻辑
    const extension = this.getFileExtension(filePath);
    // 通过依赖注入的LanguageDetector获取语言
    const language = this.languageDetector.detectLanguageByExtension(extension);

    return {
      language: language || 'unknown',
      confidence: language ? 0.9 : 0.1,
      detectionMethod: 'extension',
      metadata: { extension }
    };
  }



  /**
   * 基于内容检测语言
   */
  private detectLanguageByContent(content: string): LanguageDetectionInfo {
    // 使用languageFeatureDetector进行内容检测
    const detectionResult = languageFeatureDetector.detectLanguageByContent(content);

    return {
      language: detectionResult.language || 'unknown',
      confidence: detectionResult.confidence,
      detectionMethod: 'content',
      metadata: { pattern: '' } // languageFeatureDetector 不提供 indicators，使用空字符串
    };
  }

  /**
   * 智能决策
   */
  private makeDetectionDecision(
    filePath: string,
    content: string,
    extensionResult: LanguageDetectionInfo,
    contentResult: LanguageDetectionInfo
  ): DetectionResult {
    // 如果扩展名检测置信度高，且内容检测不冲突，使用扩展名结果
    if (extensionResult.confidence >= 0.8 &&
      (contentResult.language === 'unknown' || contentResult.language === extensionResult.language)) {
      return {
        language: extensionResult.language,
        confidence: extensionResult.confidence,
        detectionMethod: 'extension',
        fileType: 'normal',
        metadata: {
          originalExtension: (extensionResult.metadata as any)?.extension
        }
      };
    }

    // 如果内容检测置信度高，使用内容结果
    if (contentResult.confidence >= 0.5) {
      return {
        language: contentResult.language,
        confidence: contentResult.confidence,
        detectionMethod: 'content',
        fileType: 'extensionless',
        metadata: {
          originalExtension: (extensionResult.metadata as any)?.extension,
          overrideReason: 'content_confidence_higher'
        }
      };
    }

    // 混合检测
    if (extensionResult.language !== 'unknown' && contentResult.language !== 'unknown') {
      return {
        language: extensionResult.language, // 优先扩展名
        confidence: Math.max(extensionResult.confidence, contentResult.confidence) * 0.8,
        detectionMethod: 'hybrid',
        fileType: extensionResult.language !== 'unknown' ? 'normal' : 'extensionless',
        metadata: {
          originalExtension: (extensionResult.metadata as any)?.extension,
          processingStrategy: contentResult.language
        }
      };
    }

    // 默认使用扩展名结果
    return {
      language: extensionResult.language,
      confidence: extensionResult.confidence,
      detectionMethod: 'extension',
      fileType: extensionResult.language !== 'unknown' ? 'normal' : 'unknown',
      metadata: {
        originalExtension: (extensionResult.metadata as any)?.extension
      }
    };
  }

  /**
   * 分析文件特征
   */
  private analyzeFileFeatures(content: string, language: string): FileFeatures {
    const lines = content.split('\n');
    const size = content.length;

    // 使用现有的FileFeatureDetector方法
    const isCodeFile = this.fileFeatureDetector.isCodeLanguage(language);
    const isTextFile = this.fileFeatureDetector.isTextLanguage(language);
    const isMarkdownFile = this.fileFeatureDetector.isMarkdown(language);
    const isXMLFile = this.fileFeatureDetector.isXML(language);
    const isHighlyStructured = this.fileFeatureDetector.isHighlyStructured(content, language);
    const isStructuredFile = this.fileFeatureDetector.isStructuredFile(content, language);

    // 计算复杂度
    const complexity = this.fileFeatureDetector.calculateComplexity(content);

    // 检查导入/导出/函数/类
    const hasImports = this.hasImports(content, language);
    const hasExports = this.hasExports(content, language);
    const hasFunctions = this.hasFunctions(content, language);
    const hasClasses = this.hasClasses(content, language);

    return {
      isCodeFile,
      isTextFile,
      isMarkdownFile,
      isXMLFile,
      isStructuredFile,
      isHighlyStructured,
      complexity,
      lineCount: lines.length,
      size,
      hasImports,
      hasExports,
      hasFunctions,
      hasClasses
    };
  }

  /**
   * 推荐处理策略
   */
  private recommendProcessingStrategy(detection: DetectionResult, features: FileFeatures): string {
    const { language, confidence } = detection;

    // 低置信度使用简单策略
    if (confidence < 0.5) {
      return 'universal-line';
    }

    // 备份文件使用保守策略
    if (detection.detectionMethod === 'backup') {
      return 'universal-bracket';
    }

    // 小文件使用简单策略
    if (features.size < 1000) {
      return 'universal-line';
    }

    // 大文件使用语义策略
    if (features.size > 50000) {
      return 'universal_semantic';
    }

    // 结构化文件使用语法感知策略
    if (features.isHighlyStructured) {
      // 检查是否支持TreeSitter
      if (this.canUseTreeSitter(language)) {
        return 'treesitter_ast';
      }
      return 'universal_bracket';
    }

    // 代码文件使用语义策略
    if (features.isCodeFile && features.isStructuredFile) {
      return 'universal_semantic_fine';
    }

    // Markdown文件使用专门策略
    if (features.isMarkdownFile) {
      return 'markdown-specialized';
    }

    // XML文件使用专门策略
    if (features.isXMLFile) {
      // HTML文件使用分层处理策略
      if (language.toLowerCase() === 'html' || language.toLowerCase() === 'xhtml') {
        return 'html_layered';
      }
      return 'xml-specialized';
    }

    // 默认使用语义策略
    return 'universal_semantic';
  }

  /**
   * 辅助方法
   */
  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot !== -1 ? filePath.substring(lastDot).toLowerCase() : '';
  }

  /**
   * 检查是否可以使用TreeSitter
   */
  private canUseTreeSitter(language: string): boolean {
    return this.fileFeatureDetector.canUseTreeSitter(language);
  }

  /**
    * 创建降级结果
    */
  private createFallbackResult(filePath: string, content: string): DetectionResult {
    return {
      language: 'text',
      confidence: 0.1,
      detectionMethod: 'hybrid',
      fileType: 'unknown',
      metadata: {
        fileFeatures: this.analyzeFileFeatures(content, 'text'),
        processingStrategy: 'universal_line'
      }
    };
  }

  private hasImports(content: string, language: string): boolean {
    return this.fileFeatureDetector.hasImports(content, language);
  }

  private hasExports(content: string, language: string): boolean {
    return this.fileFeatureDetector.hasExports(content, language);
  }

  private hasFunctions(content: string, language: string): boolean {
    return this.fileFeatureDetector.hasFunctions(content, language);
  }

  private hasClasses(content: string, language: string): boolean {
    return this.fileFeatureDetector.hasClasses(content, language);
  }

  private calculateComplexity(content: string, language: string): number {
    return this.fileFeatureDetector.calculateComplexity(content);
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
}