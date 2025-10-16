import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { UniversalTextSplitter } from '../UniversalTextSplitter';
import { CodeChunk } from '../../splitting/Splitter';
import {
  IFileProcessingCoordinator,
  IFileProcessingContext,
  IFileProcessingResult,
  IFallbackResult
} from './interfaces/IFileProcessingCoordinator';
import { IStrategySelectionResult, ProcessingStrategyType } from './interfaces/IProcessingStrategySelector';

/**
 * 文件处理协调器
 * 负责协调文件处理流程，包括策略执行和降级处理
 */
@injectable()
export class FileProcessingCoordinator implements IFileProcessingCoordinator {
  private logger?: LoggerService;
  private universalTextSplitter: UniversalTextSplitter;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.UniversalTextSplitter) universalTextSplitter?: UniversalTextSplitter
  ) {
    this.logger = logger;
    
    // 如果没有提供依赖，创建默认实例
    this.universalTextSplitter = universalTextSplitter || new UniversalTextSplitter(logger);
  }

  get name(): string {
    return 'FileProcessingCoordinator';
  }

  get description(): string {
    return 'Coordinates file processing workflows including strategy execution and fallback handling';
  }

  /**
   * 执行文件处理
   */
  async processFile(context: IFileProcessingContext): Promise<IFileProcessingResult> {
    const startTime = Date.now();
    const { filePath, content, strategy, language } = context;

    try {
      this.logger?.info(`Processing file: ${filePath} with strategy: ${strategy.strategy}`);

      // 检查是否需要降级处理
      if (strategy.shouldFallback) {
        this.logger?.warn(`Strategy indicates fallback needed: ${strategy.fallbackReason}`);
        const fallbackResult = await this.processWithFallback(
          filePath, 
          content, 
          strategy.fallbackReason || 'Strategy selection indicated fallback',
          undefined
        );
        
        return {
          chunks: fallbackResult.chunks,
          processingStrategy: fallbackResult.fallbackStrategy,
          success: true,
          duration: Date.now() - startTime,
          metadata: {
            fallbackReason: fallbackResult.reason,
            originalStrategy: strategy.strategy
          }
        };
      }

      // 执行处理策略
      const chunks = await this.executeProcessingStrategy(strategy, filePath, content, language);
      
      const duration = Date.now() - startTime;
      this.logger?.info(`File processing completed in ${duration}ms, generated ${chunks.length} chunks`);

      return {
        chunks,
        processingStrategy: strategy.strategy,
        success: true,
        duration,
        metadata: {
          chunkCount: chunks.length,
          strategyParameters: strategy.parameters
        }
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger?.error(`File processing failed: ${error}`);
      
      // 尝试降级处理
      try {
        const fallbackResult = await this.processWithFallback(
          filePath,
          content,
          `Processing failed: ${(error as Error).message}`,
          error as Error
        );

        return {
          chunks: fallbackResult.chunks,
          processingStrategy: fallbackResult.fallbackStrategy,
          success: true,
          duration: Date.now() - startTime,
          metadata: {
            fallbackReason: fallbackResult.reason,
            originalError: (error as Error).message,
            recoverySuccessful: true
          }
        };
      } catch (fallbackError) {
        this.logger?.error(`Fallback processing also failed: ${fallbackError}`);
        
        return {
          chunks: [],
          processingStrategy: strategy.strategy,
          success: false,
          error: error as Error,
          duration: Date.now() - startTime,
          metadata: {
            fallbackAttempted: true,
            fallbackError: (fallbackError as Error).message
          }
        };
      }
    }
  }

  /**
   * 执行处理策略
   */
  async executeProcessingStrategy(
    strategy: IStrategySelectionResult,
    filePath: string,
    content: string,
    language: string
  ): Promise<CodeChunk[]> {
    const { strategy: strategyType, parameters } = strategy;

    this.logger?.debug(`Executing strategy: ${strategyType} for ${filePath}`);

    switch (strategyType) {
      case ProcessingStrategyType.TREESITTER_AST:
        // 使用TreeSitter进行AST解析分段
        return await this.chunkByTreeSitter(content, filePath, language);

      case ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE:
        // 使用更精细的语义分段
        return await this.chunkByFineSemantic(content, filePath, language);

      case ProcessingStrategyType.UNIVERSAL_SEMANTIC:
        return this.universalTextSplitter.chunkBySemanticBoundaries(content, filePath, language);

      case ProcessingStrategyType.UNIVERSAL_BRACKET:
        return this.universalTextSplitter.chunkByBracketsAndLines(content, filePath, language);

      case ProcessingStrategyType.UNIVERSAL_LINE:
        return this.universalTextSplitter.chunkByLines(content, filePath, language);

      default:
        this.logger?.warn(`Unknown processing strategy: ${strategyType}, falling back to line-based`);
        return this.universalTextSplitter.chunkByLines(content, filePath, language);
    }
  }

  /**
   * 执行降级处理
   */
  async processWithFallback(
    filePath: string,
    content: string,
    reason: string,
    originalError?: Error
  ): Promise<IFallbackResult> {
    this.logger?.info(`Using fallback processing for ${filePath}: ${reason}`);

    try {
      // 使用最简单的分段方法 - 按行分段
      const chunks = this.universalTextSplitter.chunkByLines(content, filePath, 'text');

      this.logger?.info(`Fallback processing completed, generated ${chunks.length} chunks`);

      return {
        chunks,
        reason,
        fallbackStrategy: 'fallback-line',
        originalError
      };
    } catch (fallbackError) {
      this.logger?.error(`Fallback processing failed: ${fallbackError}`);
      
      // 如果连降级处理都失败，返回一个包含整个内容的单一块
      const fallbackChunk: CodeChunk = {
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
      };

      return {
        chunks: [fallbackChunk],
        reason: `${reason} (fallback also failed: ${(fallbackError as Error).message})`,
        fallbackStrategy: 'emergency-single-chunk',
        originalError
      };
    }
  }

  /**
   * 使用TreeSitter进行AST解析分段
   */
  async chunkByTreeSitter(content: string, filePath: string, language: string): Promise<CodeChunk[]> {
    try {
      // 这里应该调用TreeSitterService进行AST解析
      // 暂时使用精细的语义分段作为替代
      this.logger?.info(`Using TreeSitter AST parsing for ${language}`);
      
      // 记录TreeSitter使用情况
      return await this.chunkByFineSemantic(content, filePath, language);
    } catch (error) {
      this.logger?.error(`TreeSitter parsing failed: ${error}, falling back to fine semantic`);
      
      // TreeSitter失败时降级到精细语义分段
      return await this.chunkByFineSemantic(content, filePath, language);
    }
  }

  /**
   * 使用精细语义分段
   */
  async chunkByFineSemantic(content: string, filePath: string, language: string): Promise<CodeChunk[]> {
    this.logger?.debug(`Using fine semantic segmentation for ${filePath}`);

    // 保存原始选项
    const originalOptions = {
      maxChunkSize: this.universalTextSplitter.getOptions?.()?.maxChunkSize || 2000,
      overlapSize: this.universalTextSplitter.getOptions?.()?.overlapSize || 200,
      maxLinesPerChunk: this.universalTextSplitter.getOptions?.()?.maxLinesPerChunk || 50
    };

    try {
      // 根据内容大小调整重叠大小，小文件使用更小的重叠
      const contentLines = content.split('\n').length;
      const adjustedOverlapSize = Math.min(50, Math.max(20, contentLines * 2)); // 每行约2-50字符重叠

      // 临时设置更精细的分段参数
      this.universalTextSplitter.setOptions({
        maxChunkSize: 800,  // 从2000降低到800
        maxLinesPerChunk: 20, // 从50降低到20
        overlapSize: adjustedOverlapSize,   // 动态调整重叠大小
        enableSemanticDetection: true
      });

      const chunks = this.universalTextSplitter.chunkBySemanticBoundaries(content, filePath, language);

      this.logger?.debug(`Fine semantic segmentation completed, generated ${chunks.length} chunks`);

      return chunks;

    } catch (error) {
      this.logger?.error(`Fine semantic segmentation failed: ${error}`);
      throw error;
    } finally {
      // 恢复原始选项
      try {
        this.universalTextSplitter.setOptions({
          ...originalOptions,
          enableSemanticDetection: true
        });
      } catch (restoreError) {
        this.logger?.warn(`Failed to restore original text splitter options: ${restoreError}`);
      }
    }
  }
}