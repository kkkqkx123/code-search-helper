import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';
import { ErrorThresholdInterceptor } from '../processing/utils/protection/ErrorThresholdInterceptor';
import { MemoryGuard } from './MemoryGuard';
import { LanguageDetector, ProcessingStrategyType } from '../detection/LanguageDetector';
import { DetectionResult } from '../detection/IFileFeatureDetector';
import { LanguageDetectionResult } from '../utils/syntax/SyntaxPatternMatcher';
import { IntelligentFallbackEngine } from './IntelligentFallbackEngine';
import { createStrategy } from '../processing/strategies/index';

export interface ProcessingResult {
  chunks: any[];
  language: string;
  processingStrategy: string;
  fallbackReason?: string;
  success: boolean;
  duration: number;
  metadata?: any;
}

@injectable()
export class ProcessingGuard {
   private static instance: ProcessingGuard;
   private errorManager: ErrorThresholdInterceptor;
   private memoryGuard: MemoryGuard;
   private logger?: LoggerService;
   private detectionService: LanguageDetector;
   private fallbackEngine: IntelligentFallbackEngine;
   private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.ErrorThresholdManager) errorManager?: ErrorThresholdInterceptor,
    @inject(TYPES.MemoryGuard) memoryGuard?: MemoryGuard,
    @inject(TYPES.LanguageDetector) detectionService?: LanguageDetector,
    @inject(TYPES.IntelligentFallbackEngine) fallbackEngine?: IntelligentFallbackEngine
  ) {
    this.logger = logger;
    this.errorManager = errorManager || new ErrorThresholdInterceptor({ maxErrorCount: 5 }, logger);
    this.memoryGuard = memoryGuard || new MemoryGuard(
      // 创建默认内存监控器
      {
        getMemoryStatus: () => ({
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          heapUsedPercent: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
          rss: process.memoryUsage().rss,
          external: process.memoryUsage().external || 0,
          isWarning: false,
          isCritical: false,
          isEmergency: false,
          trend: 'stable',
          averageUsage: process.memoryUsage().heapUsed,
          timestamp: new Date()
        }),
        forceGarbageCollection: () => {
          if (typeof global !== 'undefined' && global.gc) {
            global.gc();
          }
        },
        triggerCleanup: () => { },
        isWithinLimit: () => true,
        setMemoryLimit: () => { },
        getMemoryHistory: () => [],
        clearHistory: () => { }
      } as any,
      100, logger || new LoggerService()
    );
    this.detectionService = detectionService || new LanguageDetector(logger);
    this.fallbackEngine = fallbackEngine || new IntelligentFallbackEngine(logger);
  }


  /**
   * 获取单例实例
   */
  static getInstance(
    logger?: LoggerService,
    errorManager?: ErrorThresholdInterceptor,
    memoryGuard?: MemoryGuard,
    detectionService?: LanguageDetector
  ): ProcessingGuard {
    if (!ProcessingGuard.instance) {
      ProcessingGuard.instance = new ProcessingGuard(
        logger,
        errorManager,
        memoryGuard,
        detectionService
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
      this.memoryGuard?.destroy();

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
    return this.errorManager.shouldUseFallback();
  }

  /**
    * 记录错误并清理资源
    */
  recordError(error: Error, context?: string): void {
    this.errorManager.recordError(error, context);
  }

  /**
   * 优化的文件处理方法（使用统一检测中心和策略模式）
   */
  async processFile(filePath: string, content: string): Promise<ProcessingResult> {
    const startTime = Date.now();

    // 1. 快速预检查（内存、错误阈值）
    if (this.shouldUseImmediateFallback()) {
      this.logger?.warn('Using immediate fallback due to system constraints');
      const fallbackResult = await this.executeFallback(filePath, content, 'System constraints');
      return {
        ...fallbackResult,
        success: true,
        duration: Date.now() - startTime
      };
    }

    // 2. 统一检测（一次性完成所有检测）
    let detection;
    try {
      const languageDetection = await this.detectionService.detectFile(filePath, content);
      detection = {
        language: languageDetection.language || 'text',
        detectionMethod: languageDetection.detectionMethod || 'extension',
        fileType: languageDetection.fileType || 'normal' as const,
        processingStrategy: this.selectProcessingStrategy(languageDetection),
        metadata: {
          fileFeatures: {
            isCodeFile: this.isCodeFile(languageDetection.language),
            isTextFile: true,
            isMarkdownFile: this.isMarkdownFile(filePath),
            isXMLFile: this.isXMLFile(filePath),
            isStructuredFile: this.isStructuredFile(content, languageDetection.language),
            isHighlyStructured: this.isHighlyStructured(content, languageDetection.language),
            complexity: this.calculateComplexity(content),
            lineCount: content.split('\n').length,
            size: content.length,
            hasImports: this.hasImports(content),
            hasExports: this.hasExports(content),
            hasFunctions: this.hasFunctions(content),
            hasClasses: this.hasClasses(content)
          }
        }
      };
    } catch (detectionError) {
      // 如果检测失败，直接进入fallback
      const duration = Date.now() - startTime;
      this.logger?.error(`Detection failed: ${detectionError}`);
      this.errorManager.recordError(detectionError as Error, `detection: ${filePath}`);

      try {
        // 不需要再次检测，因为检测已经失败了
        const fallbackResult = await this.executeFallback(filePath, content, `Detection error: ${(detectionError as Error).message}`);
        return {
          ...fallbackResult,
          success: true,
          duration,
          metadata: {
            detectionError: (detectionError as Error).message
          }
        };
      } catch (fallbackError) {
        this.logger?.error(`Fallback processing also failed: ${fallbackError}`);
        return {
          chunks: [],
          language: 'text',
          processingStrategy: 'none',
          success: false,
          duration,
          metadata: {
            detectionError: detectionError as Error,
            fallbackError: fallbackError as Error
          }
        };
      }
    }

    try {
      // 3. 策略选择（基于检测结果）
      const strategy = createStrategy(detection.processingStrategy || 'text');

      // 4. 执行处理
      const context = {
        content,
        language: detection.language,
        filePath,
        config: this.createDefaultProcessingConfig(detection),
        features: {
          size: detection.metadata?.fileFeatures?.size || content.length,
          lineCount: detection.metadata?.fileFeatures?.lineCount || content.split('\n').length,
          isSmallFile: (content.length < 1000),
          isCodeFile: detection.metadata?.fileFeatures?.isCodeFile || false,
          isStructuredFile: detection.metadata?.fileFeatures?.isStructuredFile || false,
          complexity: detection.metadata?.fileFeatures?.complexity || 0,
          hasImports: detection.metadata?.fileFeatures?.hasImports || false,
          hasExports: detection.metadata?.fileFeatures?.hasExports || false,
          hasFunctions: detection.metadata?.fileFeatures?.hasFunctions || false,
          hasClasses: detection.metadata?.fileFeatures?.hasClasses || false
        },
        metadata: {
          contentLength: content.length,
          lineCount: content.split('\n').length,
          size: content.length,
          isSmallFile: content.length < 1000,
          isCodeFile: detection.metadata?.fileFeatures?.isCodeFile || false,
          isStructuredFile: detection.metadata?.fileFeatures?.isStructuredFile || false,
          complexity: detection.metadata?.fileFeatures?.complexity || 0,
          hasImports: detection.metadata?.fileFeatures?.hasImports || false,
          hasExports: detection.metadata?.fileFeatures?.hasExports || false,
          hasFunctions: detection.metadata?.fileFeatures?.hasFunctions || false,
          hasClasses: detection.metadata?.fileFeatures?.hasClasses || false,
          timestamp: Date.now()
        }
      };
      const result = await strategy.execute(context);

      const duration = Date.now() - startTime;
      this.logger?.info(`File processing completed in ${duration}ms, generated ${result.chunks.length} chunks`);

      return {
        chunks: result.chunks,
        language: detection.language,
        processingStrategy: detection.processingStrategy || 'unknown',
        success: true,
        duration,
        metadata: result.metadata
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error(`Error in optimized file processing: ${error}`);

      // 统一异常处理
      this.errorManager.recordError(error as Error, `processFile: ${filePath}`);

      try {
        // 使用已检测的结果避免重复检测
        const fallbackResult = await this.executeFallback(filePath, content, `Processing error: ${(error as Error).message}`, detection);
        return {
          ...fallbackResult,
          success: true,
          duration,
          metadata: {
            originalError: (error as Error).message
          }
        };
      } catch (fallbackError) {
        this.logger?.error(`Fallback processing also failed: ${fallbackError}`);
        return {
          chunks: [],
          language: 'text',
          processingStrategy: 'none',
          success: false,
          duration,
          metadata: {
            error: error as Error,
            fallbackError: fallbackError as Error
          }
        };
      }
    }
  }

  /**
   * 检查是否需要立即降级
   */
  private shouldUseImmediateFallback(): boolean {
    // 检查内存状态
    const memoryStatus = this.memoryGuard.checkMemoryUsage();
    if (!memoryStatus.isWithinLimit) {
      return true;
    }

    // 检查错误阈值
    if (this.errorManager.shouldUseFallback()) {
      return true;
    }

    return false;
  }

  /**
    * 执行降级处理
    */
  private async executeFallback(filePath: string, content: string, reason: string, cachedDetection?: DetectionResult): Promise<Omit<ProcessingResult, 'success' | 'duration'>> {
    this.logger?.info(`Executing fallback processing for ${filePath}: ${reason}`);

    try {
      // 使用智能降级引擎确定最佳降级策略
      // 如果已经有检测结果，则避免重复检测
      let detection: DetectionResult;
      
      if (cachedDetection) {
        detection = cachedDetection;
      } else {
        const languageDetection = await this.detectionService.detectFile(filePath, content);
        detection = {
          language: languageDetection.language || 'text',
          detectionMethod: languageDetection.detectionMethod || 'extension',
          fileType: languageDetection.fileType || 'normal',
          processingStrategy: this.selectProcessingStrategy(languageDetection),
          metadata: {
            fileFeatures: {
              isCodeFile: this.isCodeFile(languageDetection.language),
              isTextFile: true,
              isMarkdownFile: this.isMarkdownFile(filePath),
              isXMLFile: this.isXMLFile(filePath),
              isStructuredFile: this.isStructuredFile(content, languageDetection.language),
              isHighlyStructured: this.isHighlyStructured(content, languageDetection.language),
              complexity: this.calculateComplexity(content),
              lineCount: content.split('\n').length,
              size: content.length,
              hasImports: this.hasImports(content),
              hasExports: this.hasExports(content),
              hasFunctions: this.hasFunctions(content),
              hasClasses: this.hasClasses(content)
            }
          }
        };
      }
      const fallbackStrategy = await this.fallbackEngine.determineFallbackStrategy(filePath, new Error(reason), detection);

      this.logger?.info(`Using intelligent fallback strategy: ${fallbackStrategy.strategy} for ${filePath}`);

      // 创建对应策略并执行
      const strategy = createStrategy(fallbackStrategy.strategy || 'text');

      const context = {
        content,
        language: detection.language,
        filePath,
        config: this.createDefaultProcessingConfig({
          ...detection,
          processingStrategy: fallbackStrategy.strategy
        }),
        features: {
          size: detection.metadata?.fileFeatures?.size || content.length,
          lineCount: detection.metadata?.fileFeatures?.lineCount || content.split('\n').length,
          isSmallFile: (content.length < 1000),
          isCodeFile: detection.metadata?.fileFeatures?.isCodeFile || false,
          isStructuredFile: detection.metadata?.fileFeatures?.isStructuredFile || false,
          complexity: detection.metadata?.fileFeatures?.complexity || 0,
          hasImports: detection.metadata?.fileFeatures?.hasImports || false,
          hasExports: detection.metadata?.fileFeatures?.hasExports || false,
          hasFunctions: detection.metadata?.fileFeatures?.hasFunctions || false,
          hasClasses: detection.metadata?.fileFeatures?.hasClasses || false
        },
        metadata: {
          contentLength: content.length,
          lineCount: content.split('\n').length,
          size: content.length,
          isSmallFile: content.length < 1000,
          isCodeFile: detection.metadata?.fileFeatures?.isCodeFile || false,
          isStructuredFile: detection.metadata?.fileFeatures?.isStructuredFile || false,
          complexity: detection.metadata?.fileFeatures?.complexity || 0,
          hasImports: detection.metadata?.fileFeatures?.hasImports || false,
          hasExports: detection.metadata?.fileFeatures?.hasExports || false,
          hasFunctions: detection.metadata?.fileFeatures?.hasFunctions || false,
          hasClasses: detection.metadata?.fileFeatures?.hasClasses || false,
          timestamp: Date.now()
        }
      };
      const result = await strategy.execute(context);

      return {
        chunks: result.chunks,
        language: detection.language,
        processingStrategy: fallbackStrategy.strategy,
        fallbackReason: `${reason} (${fallbackStrategy.reason})`,
        metadata: {
          ...result.metadata,
          intelligentFallback: true,
          originalReason: reason
        }
      };
    } catch (fallbackError) {
      this.logger?.error(`Fallback processing failed: ${fallbackError}`);

      // 如果连降级处理都失败，返回一个包含整个内容的单一块
      return {
        chunks: [{
          content: content,
          metadata: {
            startLine: 1,
            endLine: content.split('\n').length,
            language: 'text',
            filePath: filePath,
            fallback: true,
            reason: reason,
            error: (fallbackError as Error).message
          }
        }],
        language: 'text',
        processingStrategy: 'emergency-single-chunk',
        fallbackReason: `${reason} (fallback also failed: ${(fallbackError as Error).message})`
      };
    }
  }

  /**
   * 处理内存压力事件
   */
  private handleMemoryPressure(event: any): void {
    this.logger?.warn('Memory pressure detected', event);

    // 强制清理
    this.memoryGuard.forceCleanup();

    // 记录错误
    this.errorManager.recordError(
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
      errorThreshold: this.errorManager.getStatus(),
      memoryGuard: this.memoryGuard.getMemoryStats(),
      isInitialized: this.isInitialized
    };
  }

  /**
   * 重置所有状态
   */
  reset(): void {
    this.errorManager.resetCounter();
    this.memoryGuard.clearHistory();
    // LanguageDetectionService doesn't have clearCache method, but we can add it if needed
    // this.detectionService.clearCache();
    this.logger?.info('ProcessingGuard reset completed');
  }

  // 辅助方法
  private createDefaultProcessingConfig(detection: DetectionResult): any {
    return {
      chunking: {
        maxChunkSize: 2000,
        minChunkSize: 100,
        overlapSize: 50,
        strategy: detection.processingStrategy || 'text'
      },
      features: {
        enableSyntaxAnalysis: true,
        enableSemanticAnalysis: true,
        enableStructureAnalysis: true
      },
      performance: {
        enableCaching: true,
        enableParallelProcessing: false,
        maxConcurrency: 1
      },
      languages: {
        [detection.language]: {
          enabled: true,
          priority: 1
        }
      },
      postProcessing: {
        enableMerging: true,
        enableFiltering: true,
        enableBalancing: true
      },
      global: {
        debug: false,
        verbose: false
      },
      version: '1.0.0',
      createdAt: Date.now()
    };
  }

  private mapDetectionMethod(method: 'extension' | 'content' | 'backup' | 'hybrid' | 'fallback' | 'query_analysis'): 'extension' | 'content' | 'backup' | 'hybrid' {
    switch (method) {
      case 'fallback':
      case 'query_analysis':
        return 'hybrid';
      default:
        return method;
    }
  }

  private selectProcessingStrategy(languageDetection: DetectionResult): ProcessingStrategyType {
    if (!languageDetection.language || languageDetection.language === 'text') {
      return ProcessingStrategyType.TEXT;
    }
    
    // 对于纯文本格式文件，直接使用文本策略，跳过复杂处理
    const textFormatLanguages = ['text', 'ini', 'csv', 'log', 'env', 'properties', 'dockerfile', 'gitignore', 'makefile', 'readme'];
    if (textFormatLanguages.includes(languageDetection.language.toLowerCase())) {
      return ProcessingStrategyType.TEXT;
    }
    
    if (this.isCodeFile(languageDetection.language)) {
      return ProcessingStrategyType.AST;
    }
    
    return ProcessingStrategyType.TEXT;
  }

  private isCodeFile(language?: string): boolean {
    if (!language) return false;
    const codeLanguages = ['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby'];
    return codeLanguages.includes(language.toLowerCase());
  }

  private isMarkdownFile(filePath: string): boolean {
    return filePath.endsWith('.md');
  }

  private isXMLFile(filePath: string): boolean {
    const xmlExtensions = ['.xml', '.html', '.xhtml', '.svg'];
    return xmlExtensions.some(ext => filePath.endsWith(ext));
  }

  private isStructuredFile(content: string, language?: string): boolean {
    if (!language) return false;
    return this.isCodeFile(language) || this.isXMLFile('') || content.includes('{') || content.includes('}');
  }

  private isHighlyStructured(content: string, language?: string): boolean {
    if (!language) return false;
    const structuredLanguages = ['typescript', 'java', 'csharp', 'python'];
    return structuredLanguages.includes(language.toLowerCase()) &&
           content.split('\n').length > 10 &&
           (content.includes('class ') || content.includes('function ') || content.includes('import '));
  }

  private calculateComplexity(content: string): number {
    let complexity = 0;
    complexity += (content.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/g) || []).length * 2;
    complexity += (content.match(/\b(function|method|class|interface)\b/g) || []).length * 3;
    complexity += (content.match(/[{}]/g) || []).length;
    return Math.min(complexity, 10); // 限制在0-10范围内
  }

  private hasImports(content: string): boolean {
    return /\b(import|require|include)\b/.test(content);
  }

  private hasExports(content: string): boolean {
    return /\b(export|module\.exports)\b/.test(content);
  }

  private hasFunctions(content: string): boolean {
    return /\b(function|def|func|fn)\b/.test(content);
  }

  private hasClasses(content: string): boolean {
    return /\b(class|struct|interface)\b/.test(content);
  }
}