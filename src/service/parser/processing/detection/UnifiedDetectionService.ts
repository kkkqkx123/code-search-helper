import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { UnifiedConfigManager } from '../../config/UnifiedConfigManager';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { FileFeatureDetector } from './FileFeatureDetector';
import { LanguageDetectionService } from './LanguageDetectionService';
import { BackupFileProcessor } from './BackupFileProcessor';
import { ExtensionlessFileProcessor } from './ExtensionlessFileProcessor';
import { LanguageDetector } from '../../core/language-detection/LanguageDetector';

/**
 * 检测结果接口
 */
export interface DetectionResult {
  language: string;
  confidence: number;
  detectionMethod: 'extension' | 'content' | 'backup' | 'treesitter' | 'hybrid';
  metadata: {
    originalExtension?: string;
    overrideReason?: string;
    fileFeatures?: FileFeatures;
    astInfo?: any;
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
  private detectionCache: Map<string, DetectionResult> = new Map();
  private readonly cacheSizeLimit = 1000; // 限制缓存大小
 private fileFeatureDetector: FileFeatureDetector;
  private backupFileProcessor: BackupFileProcessor;
  private extensionlessFileProcessor: ExtensionlessFileProcessor;

  private languageDetector: LanguageDetector;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.UnifiedConfigManager) configManager?: UnifiedConfigManager,
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.FileFeatureDetector) fileFeatureDetector?: FileFeatureDetector,
    @inject(TYPES.BackupFileProcessor) backupFileProcessor?: BackupFileProcessor,
    @inject(TYPES.ExtensionlessFileProcessor) extensionlessFileProcessor?: ExtensionlessFileProcessor,
    @inject(TYPES.LanguageDetector) languageDetector?: LanguageDetector
  ) {
    this.logger = logger;
    this.configManager = configManager || new UnifiedConfigManager();
    this.fileFeatureDetector = fileFeatureDetector || FileFeatureDetector.getInstance(logger);
    this.backupFileProcessor = backupFileProcessor || new BackupFileProcessor(logger);
    this.extensionlessFileProcessor = extensionlessFileProcessor || new ExtensionlessFileProcessor(logger);
    this.languageDetector = languageDetector || new LanguageDetector();
    this.logger?.debug('UnifiedDetectionService initialized');
  }

  /**
   * 智能文件检测（主要入口）
   */
  async detectFile(filePath: string, content: string): Promise<DetectionResult> {
    this.logger?.debug(`Detecting file: ${filePath}`);

    // 创建缓存键，包含文件路径和内容长度以确保一致性
    const cacheKey = `${filePath}:${content.length}:${this.getContentHash(content)}`;

    // 检查缓存
    if (this.detectionCache.has(cacheKey)) {
      this.logger?.debug(`Cache hit for detection: ${filePath}`);
      return this.detectionCache.get(cacheKey)!;
    }

    try {
      // 1. 检查是否为备份文件
      const backupResult = this.detectBackupFile(filePath, content);
      if (backupResult) {
        this.logger?.info(`Detected backup file: ${backupResult.language} (confidence: ${backupResult.confidence})`);
        return backupResult;
      }

      // 2. 基于扩展名的语言检测
      const extensionResult = this.detectLanguageByExtension(filePath);
      
      // 3. 基于内容的语言检测
      const contentResult = this.detectLanguageByContent(content);
      
      // 4. 智能决策
      const finalResult = this.makeDetectionDecision(filePath, content, extensionResult, contentResult);
      
      // 5. 文件特征分析
      const fileFeatures = this.analyzeFileFeatures(content, finalResult.language);
      finalResult.metadata.fileFeatures = fileFeatures;
      
      // 6. AST生成（如果适用）
      if (this.shouldGenerateAST(finalResult, fileFeatures) && this.treeSitterService) {
        try {
          const astInfo = await this.generateAST(content, finalResult.language);
          if (astInfo) {
            finalResult.metadata.astInfo = astInfo;
            this.logger?.debug(`AST generated successfully for ${filePath}`);
          }
        } catch (error) {
          this.logger?.warn(`Failed to generate AST for ${filePath}:`, error);
          // AST生成失败不应该影响整个检测过程
        }
      }
      
      // 7. 处理策略推荐
      finalResult.metadata.processingStrategy = this.recommendProcessingStrategy(finalResult, fileFeatures);

      this.logger?.debug(`Final detection result: ${finalResult.language} (confidence: ${finalResult.confidence})`);
      
      // 缓存结果
      this.cacheDetectionResult(cacheKey, finalResult);
      
      return finalResult;

    } catch (error) {
      this.logger?.error(`File detection failed for ${filePath}:`, error);
      const fallbackResult = this.createFallbackResult(filePath, content);
      // 缓存降级结果
      this.cacheDetectionResult(cacheKey, fallbackResult);
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
    // 使用现有的ExtensionlessFileProcessor进行内容检测
    const detectionResult = this.extensionlessFileProcessor.detectLanguageByContent(content);
    
    return {
      language: detectionResult.language,
      confidence: detectionResult.confidence,
      detectionMethod: 'content',
      metadata: { pattern: detectionResult.indicators.join(', ') }
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
   * 判断是否应该生成AST
   */
  private shouldGenerateAST(detection: DetectionResult, features: FileFeatures): boolean {
    // 只为代码文件生成AST
    if (!features.isCodeFile) {
      return false;
    }

    // 只为高置信度的检测生成AST
    if (detection.confidence < 0.7) {
      return false;
    }

    // 只为结构化文件生成AST
    if (!features.isStructuredFile) {
      return false;
    }

    // 文件大小限制（避免为过大的文件生成AST）
    if (features.size > 100000) { // 100KB
      return false;
    }

    return true;
  }

  /**
   * 生成AST信息
   */
  private async generateAST(content: string, language: string): Promise<any> {
    if (!this.treeSitterService) {
      return null;
    }

    try {
      // 检测语言 - 使用更宽松的匹配方式
      const supportedLanguages = this.treeSitterService.getSupportedLanguages();
      const detectedLanguage = supportedLanguages.find(lang => 
        lang.name.toLowerCase() === language.toLowerCase()
      );
      if (!detectedLanguage) {
        this.logger?.warn(`TreeSitter does not support language: ${language}`);
        return null;
      }

      // 解析代码
      const parseResult = await this.treeSitterService.parseCode(content, detectedLanguage.name);
      if (!parseResult.success || !parseResult.ast) {
        this.logger?.warn(`Failed to parse ${language} code with TreeSitter`);
        return null;
      }

      // 提取函数和类信息
      const functions = await this.treeSitterService.extractFunctions(parseResult.ast);
      const classes = await this.treeSitterService.extractClasses(parseResult.ast);

      return {
        ast: parseResult.ast,
        language: detectedLanguage.name,
        functions: functions.length,
        classes: classes.length,
        parseSuccess: true,
        timestamp: Date.now()
      };

    } catch (error) {
      this.logger?.error(`AST generation failed for ${language}:`, error);
      return null;
    }
  }

  /**
   * 生成内容哈希
   */
  private getContentHash(content: string): string {
    // 简单的哈希算法，基于内容的前100个字符和后100个字符
    const prefix = content.substring(0, 100);
    const suffix = content.length > 100 ? content.substring(content.length - 100) : '';
    const combined = prefix + suffix;
    
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 缓存检测结果
   */
  private cacheDetectionResult(cacheKey: string, result: DetectionResult): void {
    // 管理缓存大小
    if (this.detectionCache.size >= this.cacheSizeLimit) {
      // 删除最旧的条目（简单的FIFO策略）
      const firstKey = this.detectionCache.keys().next().value;
      if (firstKey) {
        this.detectionCache.delete(firstKey);
      }
    }

    // 缓存结果
    this.detectionCache.set(cacheKey, result);
    this.logger?.debug(`Detection result cached for key: ${cacheKey}`);
  }

  /**
   * 清除检测缓存
   */
  clearCache(): void {
    this.detectionCache.clear();
    this.logger?.info('UnifiedDetectionService cache cleared');
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