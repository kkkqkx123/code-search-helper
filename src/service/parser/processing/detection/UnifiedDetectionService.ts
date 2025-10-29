import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { UnifiedConfigManager } from '../../config/UnifiedConfigManager';
import { TreeSitterService } from '../../core/parse/TreeSitterService';

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
  private detectionCache: Map<string, DetectionResult> = new Map();
  private readonly cacheSizeLimit = 1000; // 限制缓存大小

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.UnifiedConfigManager) configManager?: UnifiedConfigManager,
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService
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
    
    // 基本特征
    const isCodeFile = this.isCodeLanguage(language);
    const isTextFile = this.isTextLanguage(language);
    const isMarkdownFile = this.isMarkdown(language);
    const isXMLFile = this.isXML(language);
    
    // 结构特征
    const hasImports = this.hasImports(content, language);
    const hasExports = this.hasExports(content, language);
    const hasFunctions = this.hasFunctions(content, language);
    const hasClasses = this.hasClasses(content, language);
    
    // 复杂度分析
    const complexity = this.calculateComplexity(content, language);
    const isStructuredFile = hasFunctions || hasClasses || hasImports;
    
    // 使用与FileFeatureDetector一致的isHighlyStructured逻辑
    const isHighlyStructured = this.isHighlyStructured(content, language);

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
   * 检查是否可以使用TreeSitter
   */
  private canUseTreeSitter(language: string): boolean {
    const treeSitterLanguages = [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby'
    ];
    return treeSitterLanguages.includes(language.toLowerCase());
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

  /**
   * 检查是否为Markdown（与FileFeatureDetector保持一致）
   */
  private isMarkdown(language: string): boolean {
    return ['markdown', 'md'].includes(language.toLowerCase());
  }

  /**
   * 检查是否为XML类语言（与FileFeatureDetector保持一致）
   */
  private isXML(language: string): boolean {
    return ['xml', 'html', 'svg', 'xhtml'].includes(language.toLowerCase());
  }

  /**
   * 检查是否为高度结构化文件（与FileFeatureDetector保持一致）
   */
  private isHighlyStructured(content: string, language: string): boolean {
    // 如果是已知结构化语言，直接返回true
    const structuredLanguages = ['json', 'xml', 'html', 'yaml', 'css', 'sql'];
    if (structuredLanguages.includes(language.toLowerCase())) {
      return true;
    }

    // 检查内容是否包含大量括号或标签
    const bracketCount = (content.match(/[{}()\[\]]/g) || []).length;
    const tagCount = (content.match(/<[^>]+>/g) || []).length;
    const totalLength = content.length;

    const isStructured = (bracketCount / totalLength > 0.01) || (tagCount / totalLength > 0.005);
    
    if (isStructured) {
      this.logger?.debug(`Detected structured content: brackets=${bracketCount}, tags=${tagCount}, ratio=${(bracketCount / totalLength).toFixed(3)}`);
    }

    return isStructured;
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