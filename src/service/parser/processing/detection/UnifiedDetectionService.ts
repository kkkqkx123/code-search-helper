import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { UnifiedConfigManager } from '../../config/UnifiedConfigManager';

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
  private languageMap: Map<string, string[]> = new Map();
  private contentPatterns: Map<string, RegExp[]> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.UnifiedConfigManager) configManager?: UnifiedConfigManager
  ) {
    this.logger = logger;
    this.configManager = configManager || new UnifiedConfigManager();
    this.initializeLanguageMap();
    this.initializeContentPatterns();
    this.logger?.debug('UnifiedDetectionService initialized');
  }

  /**
   * 智能文件检测（主要入口）
   */
  async detectFile(filePath: string, content: string): Promise<DetectionResult> {
    this.logger?.debug(`Detecting file: ${filePath}`);

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
      
      // 6. 处理策略推荐
      finalResult.metadata.processingStrategy = this.recommendProcessingStrategy(finalResult, fileFeatures);

      this.logger?.debug(`Final detection result: ${finalResult.language} (confidence: ${finalResult.confidence})`);
      return finalResult;

    } catch (error) {
      this.logger?.error(`File detection failed for ${filePath}:`, error);
      return this.createFallbackResult(filePath, content);
    }
  }

  /**
   * 检测备份文件
   */
  private detectBackupFile(filePath: string, content: string): DetectionResult | null {
    const backupConfig = this.configManager.getUniversalConfig().backup;
    const backupPatterns = backupConfig.backupFilePatterns;
    const confidenceThreshold = backupConfig.backupFileConfidenceThreshold;

    // 检查文件路径是否匹配备份模式
    const isBackupFile = backupPatterns.some(pattern => {
      if (pattern === '') return false; // 跳过空模式
      return filePath.includes(pattern);
    });

    if (!isBackupFile) {
      return null;
    }

    // 推断原始文件类型
    const originalType = this.inferOriginalType(filePath, content);
    
    if (originalType.confidence >= confidenceThreshold) {
      return {
        language: originalType.language,
        confidence: originalType.confidence,
        detectionMethod: 'backup',
        metadata: {
          originalExtension: originalType.extension,
          fileFeatures: this.analyzeFileFeatures(content, originalType.language)
        }
      };
    }

    return null;
  }

  /**
   * 推断原始文件类型
   */
  private inferOriginalType(filePath: string, content: string): { language: string; extension: string; confidence: number } {
    // 移除备份模式
    const backupPatterns = this.configManager.getUniversalConfig().backup.backupFilePatterns;
    let cleanPath = filePath;
    
    for (const pattern of backupPatterns) {
      if (pattern && cleanPath.includes(pattern)) {
        cleanPath = cleanPath.replace(pattern, '');
      }
    }

    // 尝试从清理后的路径获取扩展名
    const extension = this.getFileExtension(cleanPath);
    const language = this.getLanguageByExtension(extension);
    
    if (language !== 'unknown') {
      return { language, extension, confidence: 0.8 };
    }

    // 基于内容推断
    const contentDetection = this.detectLanguageByContent(content);
    return {
      language: contentDetection.language,
      extension: extension || '.txt',
      confidence: contentDetection.confidence * 0.7 // 降低置信度
    };
  }

  /**
   * 基于扩展名检测语言
   */
  private detectLanguageByExtension(filePath: string): LanguageDetectionInfo {
    const extension = this.getFileExtension(filePath);
    const language = this.getLanguageByExtension(extension);
    
    return {
      language,
      confidence: language !== 'unknown' ? 0.9 : 0.1,
      detectionMethod: 'extension',
      metadata: { extension }
    };
  }

  /**
   * 基于内容检测语言
   */
  private detectLanguageByContent(content: string): LanguageDetectionInfo {
    const lines = content.split('\n').slice(0, 50); // 只检查前50行
    let bestMatch = { language: 'unknown', confidence: 0, pattern: '' };

    for (const [language, patterns] of this.contentPatterns) {
      for (const pattern of patterns) {
        const matches = lines.filter(line => pattern.test(line)).length;
        const confidence = matches / lines.length;
        
        if (confidence > bestMatch.confidence) {
          bestMatch = { language, confidence, pattern: pattern.source };
        }
      }
    }

    return {
      language: bestMatch.language,
      confidence: bestMatch.confidence,
      detectionMethod: 'content',
      metadata: { pattern: bestMatch.pattern }
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
          contentDetection: contentResult.language
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
    
    // 基本特征
    const isCodeFile = this.isCodeLanguage(language);
    const isTextFile = this.isTextLanguage(language);
    const isMarkdownFile = language === 'markdown';
    const isXMLFile = this.isXMLLanguage(language);
    
    // 结构特征
    const hasImports = this.hasImports(content, language);
    const hasExports = this.hasExports(content, language);
    const hasFunctions = this.hasFunctions(content, language);
    const hasClasses = this.hasClasses(content, language);
    
    // 复杂度分析
    const complexity = this.calculateComplexity(content, language);
    const isStructuredFile = hasFunctions || hasClasses || hasImports;
    const isHighlyStructured = (hasFunctions && hasClasses) || complexity > 100;

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
      return 'universal_line';
    }

    // 备份文件使用保守策略
    if (detection.detectionMethod === 'backup') {
      return 'universal_line';
    }

    // 小文件使用简单策略
    if (features.size < 1000) {
      return 'universal_line';
    }

    // 大文件使用语义策略
    if (features.size > 50000) {
      return 'universal_semantic';
    }

    // 结构化文件使用语法感知策略
    if (features.isHighlyStructured) {
      return 'treesitter_ast';
    }

    // 代码文件使用语义策略
    if (features.isCodeFile && features.isStructuredFile) {
      return 'universal_semantic';
    }

    // Markdown文件使用专门策略
    if (features.isMarkdownFile) {
      return 'markdown_specialized';
    }

    // XML文件使用专门策略
    if (features.isXMLFile) {
      return 'xml_specialized';
    }

    // 默认使用语义策略
    return 'universal_semantic';
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

  /**
   * 初始化语言映射
   */
  private initializeLanguageMap(): void {
    this.languageMap.set('typescript', ['.ts', '.tsx']);
    this.languageMap.set('javascript', ['.js', '.jsx']);
    this.languageMap.set('python', ['.py']);
    this.languageMap.set('java', ['.java']);
    this.languageMap.set('c', ['.c', '.h']);
    this.languageMap.set('cpp', ['.cpp', '.cxx', '.cc', '.hpp', '.hxx']);
    this.languageMap.set('csharp', ['.cs']);
    this.languageMap.set('go', ['.go']);
    this.languageMap.set('rust', ['.rs']);
    this.languageMap.set('php', ['.php']);
    this.languageMap.set('ruby', ['.rb']);
    this.languageMap.set('swift', ['.swift']);
    this.languageMap.set('kotlin', ['.kt', '.kts']);
    this.languageMap.set('scala', ['.scala']);
    this.languageMap.set('html', ['.html', '.htm']);
    this.languageMap.set('css', ['.css']);
    this.languageMap.set('json', ['.json']);
    this.languageMap.set('yaml', ['.yaml', '.yml']);
    this.languageMap.set('toml', ['.toml']);
    this.languageMap.set('xml', ['.xml']);
    this.languageMap.set('markdown', ['.md', '.markdown']);
    this.languageMap.set('text', ['.txt']);
  }

  /**
   * 初始化内容模式
   */
  private initializeContentPatterns(): void {
    this.contentPatterns.set('typescript', [
      /^import\s+.*from\s+['"][^'"]+['"];?$/,
      /^export\s+(interface|type|class|function|const|let|var)\s+/,
      /^interface\s+\w+/,
      /^type\s+\w+/,
      /^\s*\w+\s*:\s*\w+/,
      /<[^>]*>/g
    ]);

    this.contentPatterns.set('javascript', [
      /^import\s+.*from\s+['"][^'"]+['"];?$/,
      /^export\s+(class|function|const|let|var)\s+/,
      /^const\s+\w+\s*=\s*\(/,
      /^function\s+\w+/,
      /=>\s*\{/
    ]);

    this.contentPatterns.set('python', [
      /^import\s+/,
      /^from\s+.*\s+import\s+/,
      /^def\s+\w+/,
      /^class\s+\w+/,
      /^\s+\w+\s*:/,
      /f["'][^"']*["']/
    ]);

    this.contentPatterns.set('java', [
      /^import\s+/,
      /^package\s+/,
      /^public\s+(class|interface|enum)\s+\w+/,
      /^private|protected|public\s+\w+\s+\w+\s*\(/,
      /@\w+/
    ]);

    this.contentPatterns.set('go', [
      /^package\s+/,
      /^import\s+/,
      /^func\s+\w+/,
      /^type\s+\w+\s+struct/,
      /^var\s+\w+/,
      /^const\s+\w+/
    ]);

    this.contentPatterns.set('rust', [
      /^use\s+/,
      /^fn\s+\w+/,
      /^struct\s+\w+/,
      /^impl\s+\w+/,
      /^let\s+(mut\s+)?\w+/,
      /#\w+/
    ]);

    this.contentPatterns.set('html', [
      /^<!DOCTYPE\s+html>/i,
      /<html[^>]*>/i,
      /<head[^>]*>/i,
      /<body[^>]*>/i,
      /<div[^>]*>/i,
      /<script[^>]*>/i
    ]);

    this.contentPatterns.set('markdown', [
      /^#\s+/,
      /^\*\s+/,
      /^-\s+/,
      /^\d+\.\s+/,
      /```[\w]*$/,
      /\*\*[^*]+\*\*/,
      /\[([^\]]+)\]\(([^)]+)\)/
    ]);

    this.contentPatterns.set('json', [
      /^\s*\{/,
      /^\s*\[/,
      /"\w+"\s*:/,
      /^\s*"/,
      /true|false|null/
    ]);

    this.contentPatterns.set('yaml', [
      /^\w+\s*:/,
      /^\s*-\s+/,
      /^---/,
      /^\.\.\./,
      /true|false|null/
    ]);

    this.contentPatterns.set('xml', [
      /^<\?xml/,
      /<[^>]+>/,
      /<\/[^>]+>/,
      /<[^>]+\/>/
    ]);
  }

  /**
   * 辅助方法
   */
  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot !== -1 ? filePath.substring(lastDot).toLowerCase() : '';
  }

  private getLanguageByExtension(extension: string): string {
    for (const [language, extensions] of this.languageMap) {
      if (extensions.includes(extension)) {
        return language;
      }
    }
    return 'unknown';
  }

  private isCodeLanguage(language: string): boolean {
    const codeLanguages = [
      'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
    ];
    return codeLanguages.includes(language);
  }

  private isTextLanguage(language: string): boolean {
    const textLanguages = ['text', 'markdown', 'yaml', 'toml'];
    return textLanguages.includes(language);
  }

  private isXMLLanguage(language: string): boolean {
    const xmlLanguages = ['xml', 'html'];
    return xmlLanguages.includes(language);
  }

  private hasImports(content: string, language: string): boolean {
    const patterns: Record<string, RegExp> = {
      typescript: /import\s+|require\s*\(/,
      javascript: /import\s+|require\s*\(/,
      python: /import\s+|from\s+.*\s+import/,
      java: /import\s+/,
      go: /import\s+/,
      rust: /use\s+/,
      c: /#include/,
      cpp: /#include|using\s+namespace/
    };

    const pattern = patterns[language];
    return pattern ? pattern.test(content) : false;
  }

  private hasExports(content: string, language: string): boolean {
    const patterns: Record<string, RegExp> = {
      typescript: /export\s+/,
      javascript: /export\s+|module\.exports/,
      python: /__all__\s*=/
    };

    const pattern = patterns[language];
    return pattern ? pattern.test(content) : false;
  }

  private hasFunctions(content: string, language: string): boolean {
    const patterns: Record<string, RegExp> = {
      typescript: /function\s+\w+|=>\s*\{|const\s+\w+\s*=\s*\(/,
      javascript: /function\s+\w+|=>\s*\{|const\s+\w+\s*=\s*\(/,
      python: /def\s+\w+/,
      java: /\w+\s+\w+\s*\([^)]*\)\s*\{/,
      go: /func\s+\w+/,
      rust: /fn\s+\w+/
    };

    const pattern = patterns[language];
    return pattern ? pattern.test(content) : false;
  }

  private hasClasses(content: string, language: string): boolean {
    const patterns: Record<string, RegExp> = {
      typescript: /class\s+\w+/,
      javascript: /class\s+\w+/,
      python: /class\s+\w+/,
      java: /class\s+\w+/,
      go: /type\s+\w+\s+struct/,
      rust: /struct\s+\w+/
    };

    const pattern = patterns[language];
    return pattern ? pattern.test(content) : false;
  }

  private calculateComplexity(content: string, language: string): number {
    const lines = content.split('\n');
    const nestedStructures = (content.match(/\{[^{}]*\{/g) || []).length;
    const controlStructures = (content.match(/if|for|while|switch|case/g) || []).length;
    
    return lines.length + nestedStructures * 2 + controlStructures;
  }
}