import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';
import { ErrorThresholdManager } from './ErrorThresholdManager';
import { MemoryGuard } from './MemoryGuard';
import { BackupFileProcessor } from './BackupFileProcessor';
import { ExtensionlessFileProcessor } from './ExtensionlessFileProcessor';
import { UniversalTextSplitter } from './UniversalTextSplitter';
import { CodeChunk } from '../splitting/Splitter';
import * as path from 'path';

/**
 * 处理保护器
 * 整合所有保护机制，提供统一的文件处理接口
 */
@injectable()
export class ProcessingGuard {
  private static instance: ProcessingGuard;
  private errorThresholdManager: ErrorThresholdManager;
  private memoryGuard: MemoryGuard;
  private backupFileProcessor: BackupFileProcessor;
  private extensionlessFileProcessor: ExtensionlessFileProcessor;
  private universalTextSplitter: UniversalTextSplitter;
  private logger?: LoggerService;
  private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.ErrorThresholdManager) errorThresholdManager?: ErrorThresholdManager,
    @inject(TYPES.MemoryGuard) memoryGuard?: MemoryGuard,
    @inject(TYPES.BackupFileProcessor) backupFileProcessor?: BackupFileProcessor,
    @inject(TYPES.ExtensionlessFileProcessor) extensionlessFileProcessor?: ExtensionlessFileProcessor,
    @inject(TYPES.UniversalTextSplitter) universalTextSplitter?: UniversalTextSplitter
  ) {
    this.logger = logger;
    
    // 如果没有提供依赖，创建默认实例
    this.errorThresholdManager = errorThresholdManager || new ErrorThresholdManager(logger);
    this.memoryGuard = memoryGuard || new MemoryGuard(500, 5000, logger);
    this.backupFileProcessor = backupFileProcessor || new BackupFileProcessor(logger);
    this.extensionlessFileProcessor = extensionlessFileProcessor || new ExtensionlessFileProcessor(logger);
    this.universalTextSplitter = universalTextSplitter || new UniversalTextSplitter(logger);
  }

  /**
   * 获取单例实例
   */
  static getInstance(
    logger?: LoggerService,
    errorThresholdManager?: ErrorThresholdManager,
    memoryGuard?: MemoryGuard,
    backupFileProcessor?: BackupFileProcessor,
    extensionlessFileProcessor?: ExtensionlessFileProcessor,
    universalTextSplitter?: UniversalTextSplitter
  ): ProcessingGuard {
    if (!ProcessingGuard.instance) {
      ProcessingGuard.instance = new ProcessingGuard(
        logger,
        errorThresholdManager,
        memoryGuard,
        backupFileProcessor,
        extensionlessFileProcessor,
        universalTextSplitter
      );
    }
    return ProcessingGuard.instance;
  }

  /**
   * 初始化处理保护器
   */
  initialize(): void {
    if (this.isInitialized) {
      this.logger?.warn('ProcessingGuard is already initialized');
      return;
    }

    try {
      // 启动内存监控
      this.memoryGuard.startMonitoring();
      
      // 监听内存压力事件
      if (typeof process !== 'undefined' && process.on) {
        process.on('memoryPressure', this.handleMemoryPressure.bind(this));
      }

      this.isInitialized = true;
      this.logger?.info('ProcessingGuard initialized successfully');
    } catch (error) {
      this.logger?.error(`Failed to initialize ProcessingGuard: ${error}`);
      throw error;
    }
  }

  /**
   * 销毁处理保护器
   */
  destroy(): void {
    if (!this.isInitialized) {
      return;
    }

    try {
      // 停止内存监控
      this.memoryGuard.destroy();
      
      // 移除事件监听器
      if (typeof process !== 'undefined' && process.removeListener) {
        process.removeListener('memoryPressure', this.handleMemoryPressure.bind(this));
      }

      this.isInitialized = false;
      this.logger?.info('ProcessingGuard destroyed');
    } catch (error) {
      this.logger?.error(`Error during ProcessingGuard destruction: ${error}`);
    }
  }

  /**
   * 检查是否应该使用降级方案
   */
  shouldUseFallback(): boolean {
    return this.errorThresholdManager.shouldUseFallback();
  }

  /**
   * 记录错误并清理资源
   */
  recordError(error: Error, context?: string): void {
    this.errorThresholdManager.recordError(error, context);
  }

  /**
   * 智能文件处理
   */
  async processFile(filePath: string, content: string): Promise<{
    chunks: CodeChunk[];
    language: string;
    processingStrategy: string;
    fallbackReason?: string;
  }> {
    try {
      // 检查内存状态
      const memoryStatus = this.memoryGuard.checkMemoryUsage();
      if (!memoryStatus.isWithinLimit) {
        this.logger?.warn(`Memory limit exceeded before processing: ${memoryStatus.heapUsed} > ${this.memoryGuard}`);
        return this.processWithFallback(filePath, content, 'Memory limit exceeded');
      }

      // 检查错误阈值
      if (this.errorThresholdManager.shouldUseFallback()) {
        this.logger?.warn('Error threshold reached, using fallback processing');
        return this.processWithFallback(filePath, content, 'Error threshold exceeded');
      }

      // 智能语言检测
      const language = await this.detectLanguageIntelligently(filePath, content);
      
      // 选择处理策略
      const strategy = this.selectProcessingStrategy(filePath, content, language);
      
      // 执行处理
      const chunks = await this.executeProcessingStrategy(strategy, filePath, content, language);
      
      return {
        chunks,
        language,
        processingStrategy: strategy
      };
    } catch (error) {
      this.logger?.error(`Error in intelligent file processing: ${error}`);
      this.errorThresholdManager.recordError(error as Error, `processFile: ${filePath}`);
      
      return this.processWithFallback(filePath, content, `Processing error: ${(error as Error).message}`);
    }
  }

  /**
   * 智能语言检测
   */
  private async detectLanguageIntelligently(filePath: string, content: string): Promise<string> {
    // 1. 检查是否为备份文件
    if (this.backupFileProcessor.isBackupFile(filePath)) {
      const backupInfo = this.backupFileProcessor.inferOriginalType(filePath);
      return backupInfo.originalLanguage;
    }

    // 2. 检查文件扩展名
    const ext = path.extname(filePath).toLowerCase();
    if (ext) {
      const languageFromExt = this.detectLanguageByExtension(ext);
      if (languageFromExt !== 'unknown') {
        // 对于通用扩展名（如.md），进一步检查内容
        if (languageFromExt === 'markdown' || languageFromExt === 'text') {
          const contentDetection = this.extensionlessFileProcessor.detectLanguageByContent(content);
          if (contentDetection.confidence > 0.7) {
            return contentDetection.language;
          }
        }
        return languageFromExt;
      }
    }

    // 3. 基于内容检测
    const contentDetection = this.extensionlessFileProcessor.detectLanguageByContent(content);
    if (contentDetection.language !== 'unknown' && contentDetection.confidence > 0.05) {
      return contentDetection.language;
    }

    // 4. 默认返回text
    return 'text';
  }

  /**
   * 根据扩展名检测语言
   */
  private detectLanguageByExtension(extension: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'cpp',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.md': 'markdown',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.sql': 'sql',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.fish': 'shell',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.vue': 'vue',
      '.svelte': 'svelte',
      '.txt': 'text',
      '.log': 'log',
      '.ini': 'ini',
      '.cfg': 'ini',
      '.conf': 'ini',
      '.toml': 'toml',
      '.dockerfile': 'dockerfile',
      '.makefile': 'makefile',
      '.cmake': 'cmake',
      '.pl': 'perl',
      '.r': 'r',
      '.m': 'matlab',
      '.lua': 'lua',
      '.dart': 'dart',
      '.ex': 'elixir',
      '.exs': 'elixir',
      '.erl': 'erlang',
      '.hs': 'haskell',
      '.ml': 'ocaml',
      '.fs': 'fsharp',
      '.vb': 'visualbasic',
      '.ps1': 'powershell',
      '.bat': 'batch',
      '.cmd': 'batch'
    };

    return languageMap[extension] || 'unknown';
  }

  /**
   * 选择处理策略
   */
  private selectProcessingStrategy(filePath: string, content: string, language: string): string {
    // 如果是备份文件，使用通用处理
    if (this.backupFileProcessor.isBackupFile(filePath)) {
      return 'universal-bracket';
    }

    // 如果是代码文件，优先使用语义分段
    if (this.isCodeLanguage(language)) {
      return 'universal-semantic';
    }

    // 对于结构化文件，使用括号平衡分段
    if (this.isStructuredFile(content, language)) {
      return 'universal-bracket';
    }

    // 默认使用行分段
    return 'universal-line';
  }

  /**
   * 检查是否为代码语言
   */
  private isCodeLanguage(language: string): boolean {
    const codeLanguages = [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'shell',
      'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'dockerfile',
      'cmake', 'perl', 'lua', 'dart', 'elixir', 'erlang', 'haskell',
      'ocaml', 'fsharp', 'visualbasic', 'powershell', 'batch'
    ];

    return codeLanguages.includes(language);
  }

  /**
   * 检查是否为结构化文件
   */
  private isStructuredFile(content: string, language: string): boolean {
    const structuredLanguages = ['json', 'xml', 'yaml', 'html', 'css', 'scss', 'sass'];
    
    if (structuredLanguages.includes(language)) {
      return true;
    }

    // 检查内容是否包含大量括号或标签
    const bracketCount = (content.match(/[{}()\[\]]/g) || []).length;
    const tagCount = (content.match(/<[^>]+>/g) || []).length;
    const totalLength = content.length;

    return (bracketCount / totalLength > 0.01) || (tagCount / totalLength > 0.005);
  }

  /**
   * 执行处理策略
   */
  private async executeProcessingStrategy(
    strategy: string,
    filePath: string,
    content: string,
    language: string
  ): Promise<CodeChunk[]> {
    switch (strategy) {
      case 'universal-semantic':
        return this.universalTextSplitter.chunkBySemanticBoundaries(content, filePath, language);
      
      case 'universal-bracket':
        return this.universalTextSplitter.chunkByBracketsAndLines(content, filePath, language);
      
      case 'universal-line':
        return this.universalTextSplitter.chunkByLines(content, filePath, language);
      
      default:
        this.logger?.warn(`Unknown processing strategy: ${strategy}, falling back to line-based`);
        return this.universalTextSplitter.chunkByLines(content, filePath, language);
    }
  }

  /**
   * 降级处理
   */
  private processWithFallback(
    filePath: string,
    content: string,
    reason: string
  ): {
    chunks: CodeChunk[];
    language: string;
    processingStrategy: string;
    fallbackReason: string;
  } {
    this.logger?.info(`Using fallback processing for ${filePath}: ${reason}`);
    
    // 使用最简单的分段方法
    const chunks = this.universalTextSplitter.chunkByLines(content, filePath, 'text');
    
    return {
      chunks,
      language: 'text',
      processingStrategy: 'fallback-line',
      fallbackReason: reason
    };
  }

  /**
   * 处理内存压力事件
   */
  private handleMemoryPressure(event: any): void {
    this.logger?.warn('Memory pressure detected', event);
    
    // 强制清理
    this.memoryGuard.forceCleanup();
    
    // 记录错误
    this.errorThresholdManager.recordError(
      new Error('Memory pressure detected'),
      'memory-pressure'
    );
  }

  /**
   * 获取处理状态
   */
  getStatus(): {
    errorThreshold: any;
    memoryGuard: any;
    isInitialized: boolean;
  } {
    return {
      errorThreshold: this.errorThresholdManager.getStatus(),
      memoryGuard: this.memoryGuard.getMemoryStats(),
      isInitialized: this.isInitialized
    };
  }

  /**
   * 重置所有状态
   */
  reset(): void {
    this.errorThresholdManager.resetCounter();
    this.memoryGuard.clearHistory();
    this.logger?.info('ProcessingGuard reset completed');
  }
}