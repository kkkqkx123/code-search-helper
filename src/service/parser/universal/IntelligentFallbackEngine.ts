import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';
import { DetectionResult, ProcessingStrategyType } from './UnifiedDetectionCenter';

export interface FallbackStrategy {
  strategy: string;
  reason: string;
 parameters?: any;
}

export interface ErrorPattern {
  errorType: string;
 filePath: string;
  timestamp: Date;
  message: string;
}

export interface PerformanceMetrics {
  processingTime: number;
 memoryUsage: number;
  successRate: number;
}

@injectable()
export class IntelligentFallbackEngine {
  private errorHistory: Map<string, ErrorPattern[]> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics[]> = new Map();
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.logger = logger;
  }

  /**
   * 智能确定降级策略
   */
  async determineFallbackStrategy(
    filePath: string, 
    error: Error, 
    detection: DetectionResult
  ): Promise<FallbackStrategy> {
    
    // 基于错误类型选择降级策略
    const errorType = this.classifyError(error);
    
    this.logger?.debug(`Classified error type: ${errorType} for file: ${filePath}`);
    
    switch (errorType) {
      case 'memory_error':
        return { 
          strategy: ProcessingStrategyType.UNIVERSAL_LINE, 
          reason: 'Memory constraint - using fastest segmentation' 
        };
        
      case 'parse_error':
        // AST解析失败，尝试语义分段
        if (this.isCodeLanguage(detection.language)) {
          return { 
            strategy: ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE, 
            reason: 'AST parsing failed - using semantic segmentation' 
          };
        }
        return { 
          strategy: ProcessingStrategyType.UNIVERSAL_BRACKET, 
          reason: 'AST parsing failed - using bracket balancing' 
        };
        
      case 'timeout_error':
        // 超时错误，使用最快的分段策略
        return { 
          strategy: ProcessingStrategyType.UNIVERSAL_LINE, 
          reason: 'Processing timeout - using fastest segmentation' 
        };
        
      case 'syntax_error':
        // 语法错误，使用保守策略
        return { 
          strategy: ProcessingStrategyType.UNIVERSAL_LINE, 
          reason: 'Syntax error detected - using conservative line-based segmentation' 
        };
        
      case 'io_error':
        // IO错误，返回单块处理
        return { 
          strategy: ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK, 
          reason: 'IO error - returning single chunk as emergency fallback' 
        };
        
      default:
        // 基于文件特征选择
        return this.determineStrategyByFileCharacteristics(detection, error);
    }
  }

 /**
   * 根据文件特征确定降级策略
   */
  private determineStrategyByFileCharacteristics(detection: DetectionResult, error?: Error): FallbackStrategy {
    this.logger?.debug(`Determining strategy by file characteristics for language: ${detection.language}`);
    
    // 基于文件大小
    if (detection.contentLength && detection.contentLength < 1000) {
      return { 
        strategy: ProcessingStrategyType.UNIVERSAL_SEMANTIC, 
        reason: 'Small file - using semantic segmentation' 
      };
    }
    
    // 基于语言类型
    if (this.isMarkdown(detection.language)) {
      return { 
        strategy: ProcessingStrategyType.MARKDOWN_SPECIALIZED, 
        reason: 'Markdown file - using specialized processing' 
      };
    }
    
    if (this.isXML(detection.language)) {
      return { 
        strategy: ProcessingStrategyType.XML_SPECIALIZED, 
        reason: 'XML file - using specialized processing' 
      };
    }
    
    // 基于结构化程度
    if (detection.isHighlyStructured) {
      return { 
        strategy: ProcessingStrategyType.UNIVERSAL_BRACKET, 
        reason: 'Highly structured file - using bracket balancing' 
      };
    }
    
    // 默认策略
    return { 
      strategy: ProcessingStrategyType.UNIVERSAL_LINE, 
      reason: 'Default fallback strategy' 
    };
  }

  /**
   * 分类错误类型
   */
  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('memory') || message.includes('heap') || message.includes('allocation')) {
      return 'memory_error';
    }
    
    if (message.includes('parse') || message.includes('syntax') || message.includes('tree-sitter')) {
      return 'parse_error';
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout_error';
    }
    
    if (message.includes('syntax')) {
      return 'syntax_error';
    }
    
    if (message.includes('file') || message.includes('read') || message.includes('access')) {
      return 'io_error';
    }
    
    return 'unknown_error';
  }

  /**
   * 检查是否为代码语言
   */
  private isCodeLanguage(language: string): boolean {
    const codeLanguages = [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby', 'css', 'html', 'json', 'yaml', 'xml'
    ];
    return codeLanguages.includes(language.toLowerCase());
  }

  /**
   * 检查是否为Markdown
   */
  private isMarkdown(language: string): boolean {
    return ['markdown', 'md'].includes(language.toLowerCase());
  }

  /**
   * 检查是否为XML类语言
   */
  private isXML(language: string): boolean {
    return ['xml', 'html', 'svg', 'xhtml'].includes(language.toLowerCase());
  }

  /**
   * 记录错误模式
   */
  recordErrorPattern(filePath: string, error: Error): void {
    const errorPattern: ErrorPattern = {
      errorType: this.classifyError(error),
      filePath,
      timestamp: new Date(),
      message: error.message
    };
    
    if (!this.errorHistory.has(filePath)) {
      this.errorHistory.set(filePath, []);
    }
    
    const patterns = this.errorHistory.get(filePath)!;
    patterns.push(errorPattern);
    
    // 限制历史记录大小
    if (patterns.length > 100) {
      patterns.shift(); // 移除最旧的记录
    }
    
    this.logger?.debug(`Recorded error pattern for ${filePath}: ${errorPattern.errorType}`);
  }

  /**
   * 记录性能指标
   */
  recordPerformanceMetrics(filePath: string, metrics: PerformanceMetrics): void {
    if (!this.performanceMetrics.has(filePath)) {
      this.performanceMetrics.set(filePath, []);
    }
    
    const metricsList = this.performanceMetrics.get(filePath)!;
    metricsList.push(metrics);
    
    // 限制性能指标记录大小
    if (metricsList.length > 50) {
      metricsList.shift(); // 移除最旧的记录
    }
    
    this.logger?.debug(`Recorded performance metrics for ${filePath}`);
  }

 /**
   * 获取错误历史
   */
  getErrorHistory(filePath: string): ErrorPattern[] {
    return this.errorHistory.get(filePath) || [];
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(filePath: string): PerformanceMetrics[] {
    return this.performanceMetrics.get(filePath) || [];
  }

  /**
   * 清除错误历史
   */
  clearErrorHistory(): void {
    this.errorHistory.clear();
    this.logger?.info('Cleared error history');
  }

  /**
   * 清除性能指标
   */
  clearPerformanceMetrics(): void {
    this.performanceMetrics.clear();
    this.logger?.info('Cleared performance metrics');
  }
}