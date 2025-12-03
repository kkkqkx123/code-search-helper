/**
 * 保护协调器
 * 负责协调各种保护机制
 */

import { injectable } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { IMemoryMonitorService } from '../../memory/interfaces/IMemoryMonitorService';
import { ErrorThresholdInterceptor } from '../processing/utils/protection/ErrorThresholdInterceptor';
import { CleanupManager } from '../../../infrastructure/cleanup/CleanupManager';
import { LanguageDetector } from '../detection/LanguageDetector';
import { StrategyFactory } from '../processing/StrategyFactory';
import { IntelligentFallbackEngine } from './IntelligentFallbackEngine';
import {
  IGuardCoordinator,
  MemoryStatus,
  MemoryStats,
  MemoryHistory,
  FileProcessingResult,
  ProcessingStats,
  GuardStatus
} from './IGuardCoordinator';

/**
 * 保护协调器类
 */
@injectable()
export class GuardCoordinator implements IGuardCoordinator {
  private static instance: GuardCoordinator;
  private logger?: LoggerService;
  private memoryMonitorService: IMemoryMonitorService;
  private errorThresholdInterceptor: ErrorThresholdInterceptor;
  private cleanupManager: CleanupManager;
  private languageDetector: LanguageDetector;
  private strategyFactory: StrategyFactory;
  private intelligentFallbackEngine: IntelligentFallbackEngine;
  private memoryLimitMB: number;
  private memoryCheckIntervalMs: number;

  constructor(
    memoryMonitorService: IMemoryMonitorService,
    errorThresholdInterceptor: ErrorThresholdInterceptor,
    cleanupManager: CleanupManager,
    languageDetector: LanguageDetector,
    strategyFactory: StrategyFactory,
    intelligentFallbackEngine: IntelligentFallbackEngine,
    memoryLimitMB: number,
    memoryCheckIntervalMs: number,
    logger?: LoggerService
  ) {
    this.memoryMonitorService = memoryMonitorService;
    this.errorThresholdInterceptor = errorThresholdInterceptor;
    this.cleanupManager = cleanupManager;
    this.languageDetector = languageDetector;
    this.strategyFactory = strategyFactory;
    this.intelligentFallbackEngine = intelligentFallbackEngine;
    this.memoryLimitMB = memoryLimitMB;
    this.memoryCheckIntervalMs = memoryCheckIntervalMs;
    this.logger = logger;
  }

  /**
   * 获取单例实例
   */
  static getInstance(
    memoryMonitorService: IMemoryMonitorService,
    errorThresholdInterceptor: ErrorThresholdInterceptor,
    cleanupManager: CleanupManager,
    languageDetector: LanguageDetector,
    strategyFactory: StrategyFactory,
    intelligentFallbackEngine: IntelligentFallbackEngine,
    memoryLimitMB: number,
    memoryCheckIntervalMs: number,
    logger?: LoggerService
  ): GuardCoordinator {
    if (!GuardCoordinator.instance) {
      GuardCoordinator.instance = new GuardCoordinator(
        memoryMonitorService,
        errorThresholdInterceptor,
        cleanupManager,
        languageDetector,
        strategyFactory,
        intelligentFallbackEngine,
        memoryLimitMB,
        memoryCheckIntervalMs,
        logger
      );
    }
    return GuardCoordinator.instance;
  }

  // 实现 IGuardCoordinator 接口

  /**
   * 初始化协调器
   */
  initialize(): void {
    this.logger?.info('GuardCoordinator initialized');
  }

  /**
   * 销毁协调器
   */
  destroy(): void {
    this.logger?.info('GuardCoordinator destroyed');
  }

  /**
   * 重置协调器状态
   */
  reset(): void {
    this.logger?.info('GuardCoordinator reset');
  }

  /**
   * 开始监控
   */
  startMonitoring(): void {
    this.memoryMonitorService.startMonitoring();
    this.logger?.info('Memory monitoring started');
  }

  /**
   * 停止监控
   */
  stopMonitoring(): void {
    this.memoryMonitorService.stopMonitoring();
    this.logger?.info('Memory monitoring stopped');
  }

  /**
   * 检查内存使用情况
   */
  checkMemoryUsage(): MemoryStatus {
    // 使用 MemoryMonitorService 获取内存状态
    const memoryStatus = this.memoryMonitorService.getMemoryStatus();
    const memUsage = process.memoryUsage(); // 获取 arrayBuffers
    
    return {
      isWithinLimit: memoryStatus.heapUsedPercent < 0.8,
      usagePercent: memoryStatus.heapUsedPercent * 100,
      heapUsed: memoryStatus.heapUsed,
      heapTotal: memoryStatus.heapTotal,
      external: memoryStatus.external,
      arrayBuffers: memUsage.arrayBuffers || 0
    };
  }

  /**
   * 强制清理
   */
  async forceCleanup(): Promise<void> {
    this.logger?.info('Force cleanup triggered');
    this.memoryMonitorService.triggerCleanup('lightweight');
  }

  /**
   * 优雅降级
   */
  gracefulDegradation(): void {
    this.logger?.info('Graceful degradation activated');
    // 触发深度清理
    this.memoryMonitorService.triggerCleanup('deep');
  }

  /**
   * 获取内存统计
   */
  getMemoryStats(): MemoryStats {
    // 使用 MemoryMonitorService 的统计功能
    const memoryStats = this.memoryMonitorService.getMemoryStats();
    const memUsage = process.memoryUsage(); // 获取 arrayBuffers
    
    return {
      current: {
        heapUsed: memoryStats.current.heapUsed,
        heapTotal: memoryStats.current.heapTotal,
        external: memoryStats.current.external,
        rss: memoryStats.current.rss,
        arrayBuffers: memUsage.arrayBuffers || 0
      },
      limit: this.memoryLimitMB * 1024 * 1024,
      usagePercent: memoryStats.current.heapUsedPercent * 100,
      isWithinLimit: memoryStats.current.heapUsedPercent < 0.8,
      trend: memoryStats.current.trend,
      averageUsage: memoryStats.current.averageUsage
    };
  }

  /**
   * 获取内存历史
   */
  getMemoryHistory(): MemoryHistory[] {
    // 使用 MemoryMonitorService 获取历史记录
    const history = this.memoryMonitorService.getMemoryHistory();
    return history.map(item => ({
      timestamp: item.timestamp.getTime(),
      heapUsed: item.heapUsed,
      heapTotal: item.heapTotal,
      external: item.external,
      rss: item.rss,
      arrayBuffers: 0 // MemoryMonitorService 历史记录中没有 arrayBuffers
    }));
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.memoryMonitorService.clearHistory();
    this.logger?.info('Memory history cleared');
  }

  /**
   * 设置内存限制
   */
  setMemoryLimit(limitMB: number): void {
    this.memoryLimitMB = limitMB;
    this.memoryMonitorService.setMemoryLimit?.(limitMB);
    this.logger?.info(`Memory limit set to ${limitMB}MB`);
  }

  /**
   * 强制垃圾回收
   */
  forceGarbageCollection(): void {
    this.memoryMonitorService.forceGarbageCollection();
  }

  /**
   * 检查是否应该使用降级方案
   */
  shouldUseFallback(): boolean {
    return this.errorThresholdInterceptor.shouldUseFallback();
  }

  /**
   * 记录错误
   */
  recordError(error: Error, context?: string): void {
    this.errorThresholdInterceptor.recordError(error, context);
  }

  /**
   * 处理文件
   */
  async processFile(filePath: string, content: string): Promise<FileProcessingResult> {
    const result = await this.processFileWithDetection(filePath, content);
    return {
      chunks: result.chunks,
      language: result.language,
      processingStrategy: result.processingStrategy,
      fallbackReason: result.fallbackReason
    };
  }

  /**
   * 带检测的文件处理
   * @param filePath 文件路径
   * @param content 内容
   * @returns 处理结果
   */
  async processFileWithDetection(filePath: string, content: string): Promise<any> {
    try {
      const detectionResult = await this.languageDetector.detectFile(filePath, content);
      
      // 使用detectFile返回的DetectionResult格式
      const detection = {
        language: detectionResult.language || 'text',
        detectionMethod: detectionResult.detectionMethod,
        fileType: detectionResult.fileType || 'normal' as const,
        processingStrategy: detectionResult.processingStrategy || 'line',
        metadata: {
          fileFeatures: {
            isCodeFile: this.isCodeFile(detectionResult.language),
            isTextFile: true,
            isMarkdownFile: this.isMarkdownFile(filePath),
            isXMLFile: this.isXMLFile(filePath),
            isStructuredFile: this.isStructuredFile(content, detectionResult.language),
            isHighlyStructured: this.isHighlyStructured(content, detectionResult.language),
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
      
      const strategy = this.strategyFactory.createStrategy(detection.processingStrategy || 'text');
      
      // 创建上下文对象
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
      
      return {
        success: true,
        chunks: result.chunks,
        language: detection.language,
        processingStrategy: detection.processingStrategy,
        metadata: result.metadata
      };
    } catch (error) {
      this.logger?.error(`Processing failed: ${error}`);
      
      // 使用降级引擎
      const fallbackStrategy = await this.intelligentFallbackEngine.determineFallbackStrategy(
        filePath, 
        error as Error, 
        {
          language: 'text',
          confidence: 0.1,
          detectionMethod: 'hybrid' as const,
          fileType: 'normal' as const,
          processingStrategy: 'line',
          metadata: {
            fileFeatures: {
              isCodeFile: false,
              isTextFile: true,
              isMarkdownFile: false,
              isXMLFile: false,
              isStructuredFile: false,
              isHighlyStructured: false,
              complexity: 0,
              lineCount: content.split('\n').length,
              size: content.length,
              hasImports: false,
              hasExports: false,
              hasFunctions: false,
              hasClasses: false
            }
          }
        }
      );
      
      return {
        success: true,
        chunks: [{
          content: content,
          metadata: {
            startLine: 1,
            endLine: content.split('\n').length,
            language: 'text',
            strategy: fallbackStrategy.strategy,
            timestamp: Date.now(),
            type: 'generic',
            size: content.length,
            lineCount: content.split('\n').length
          }
        }],
        language: 'text',
        processingStrategy: fallbackStrategy.strategy,
        fallbackReason: fallbackStrategy.reason
      };
    }
  }


  private createDefaultProcessingConfig(detection: any): any {
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

  /**
   * 获取处理统计信息
   */
  getProcessingStats(): ProcessingStats {
    // 简化实现，返回默认值
    return {
      totalProcessed: 0,
      successfulProcessed: 0,
      fallbackUsed: 0,
      averageProcessingTime: 0,
      errorRate: 0
    };
  }

  /**
   * 清除检测缓存
   */
  clearDetectionCache(): void {
    this.logger?.info('Detection cache cleared');
  }

  /**
   * 获取保护状态
   */
  getStatus(): GuardStatus {
    return {
      errorThreshold: {
        errorCount: this.errorThresholdInterceptor.getStatus().errorCount,
        maxErrors: this.errorThresholdInterceptor.getStatus().maxErrors,
        shouldUseFallback: this.shouldUseFallback(),
        resetInterval: this.errorThresholdInterceptor.getStatus().timeUntilReset
      },
      memoryGuard: this.getMemoryStats(),
      isInitialized: true,
      isMonitoring: false
    };
  }
}