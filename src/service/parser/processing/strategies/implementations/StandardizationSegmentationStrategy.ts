import { BaseStrategy } from '../base/BaseStrategy';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { ProcessingResult } from '../../core/types/ResultTypes';
import { CodeChunk, ChunkType } from '../../types/CodeChunk';
import { StrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../utils/logger';

/**
 * 标准化查询结果
 */
export interface StandardizedQueryResult {
  nodeId: string;
  startLine: number;
  endLine: number;
  name: string;
  type: 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' |
  'control-flow' | 'expression' | 'data-flow' | 'parameter-flow' | 'call' | 'inheritance' |
  'implements' | 'concurrency' | 'lifecycle' | 'semantic' | 'annotation' | 'union' | 'enum' |
  'config-item' | 'section' | 'key' | 'value' | 'array' | 'table' | 'dependency' | 'type-def';
  content: string;
  metadata: {
    language: string;
    complexity?: number;
    dependencies?: string[];
    modifiers?: string[];
  };
}

/**
 * 标准化分段策略配置
 */
export interface StandardizationStrategyConfig extends StrategyConfig {
  /** 是否启用降级处理 */
  enableFallback?: boolean;
  /** 合并相邻块的最大行数 */
  maxAdjacentLines?: number;
  /** 合并同类型块的最大行数 */
  maxSameTypeLines?: number;
}

/**
 * 标准化分段策略
 * 基于标准化结果的分段
 */
export class StandardizationSegmentationStrategy extends BaseStrategy {
  protected config: StandardizationStrategyConfig;
  private logger: Logger;

  constructor(config: StandardizationStrategyConfig) {
    const defaultConfig: StrategyConfig = {
      name: 'standardization-segmentation',
      priority: 50,
      supportedLanguages: [
        'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
        'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
      ],
      enabled: true,
      description: 'Standardization Segmentation Strategy',
    };
    super({ ...defaultConfig, ...config });
    this.config = {
      enableFallback: true,
      maxAdjacentLines: 20,
      maxSameTypeLines: 30,
      ...config
    };
    this.logger = Logger.getInstance();
  }

  /**
   * 检查是否可以处理指定的上下文
   */
  canHandle(context: IProcessingContext): boolean {
    // 标准化策略需要特定的服务支持，这里简化为总是返回true
    // 实际实现中应该检查是否有必要的标准化服务
    return true;
  }

  /**
   * 执行策略
   */
  async execute(context: IProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();
    try {
      const chunks = await this.process(context);
      return this.createSuccessResult(chunks, Date.now() - startTime);
    } catch (error) {
      return this.createFailureResult(Date.now() - startTime, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 执行分段处理
   */
  async process(context: IProcessingContext): Promise<CodeChunk[]> {
    const startTime = Date.now();
    this.logger.debug(`Using Standardization segmentation strategy for ${context.filePath}`);

    try {
      // 检查是否有必要的标准化服务（模拟）
      const hasStandardizationService = this.hasStandardizationService();

      if (!hasStandardizationService || !context.language) {
        this.logger.warn('Required services not available for standardization, falling back to simple segmentation');
        return this.fallbackSegmentation(context);
      }

      // 模拟解析代码
      const parseResult = await this.simulateParse(context.content, context.language);
      if (!parseResult.success) {
        throw new Error('Failed to parse code for standardization');
      }

      // 模拟标准化查询结果
      const standardizedResults = await this.simulateStandardization(parseResult.ast, context.language);
      if (standardizedResults.length === 0) {
        this.logger.debug('No standardized results found, falling back to simple segmentation');
        return this.fallbackSegmentation(context);
      }

      // 基于标准化结果创建分块
      const chunks = this.chunkByStandardizedResults(standardizedResults, context);

      this.updatePerformanceStats(Date.now() - startTime, true, chunks.length);
      this.logger.debug(`Standardization segmentation created ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger.error('Error in standardization-based chunking:', error);
      if (this.config.enableFallback) {
        return this.fallbackSegmentation(context);
      }
      throw error;
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    // 标准化策略支持大多数编程语言
    return [
      'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
    ];
  }

  /**
   * 检查是否有标准化服务
   */
  private hasStandardizationService(): boolean {
    // 模拟检查，实际应该检查是否有标准化服务
    return true;
  }

  /**
   * 模拟解析代码
   */
  private async simulateParse(content: string, language: string): Promise<{
    success: boolean;
    ast: any;
  }> {
    // 模拟解析，实际应该调用TreeSitter服务
    return {
      success: true,
      ast: { type: 'program', children: [] }
    };
  }

  /**
   * 模拟标准化查询结果
   */
  private async simulateStandardization(ast: any, language: string): Promise<StandardizedQueryResult[]> {
    // 模拟标准化结果，实际应该调用标准化服务
    const results: StandardizedQueryResult[] = [];

    // 这里可以根据语言和内容生成一些模拟的标准化结果
    // 实际实现中应该使用真实的标准化服务

    return results;
  }

  /**
   * 降级分段方法
   */
  private fallbackSegmentation(context: IProcessingContext): CodeChunk[] {
    return [this.createChunk(
      context.content,
      1,
      context.content.split('\n').length,
      context.language || 'unknown',
      ChunkType.GENERIC,
      {
        filePath: context.filePath,
        complexity: this.calculateComplexity(context.content),
        fallback: true
      }
    )];
  }

  /**
   * 基于标准化结果的分段
   */
  private chunkByStandardizedResults(
    standardizedResults: StandardizedQueryResult[],
    context: IProcessingContext
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = context.content.split('\n');

    // 按行号排序标准化结果
    const sortedResults = standardizedResults.sort((a, b) => a.startLine - b.startLine);

    // 合并相邻的小块
    const mergedResults = this.mergeAdjacentResults(sortedResults);

    for (const result of mergedResults) {
      const chunkContent = lines.slice(result.startLine - 1, result.endLine).join('\n');

      chunks.push(this.createChunk(
        chunkContent,
        result.startLine,
        result.endLine,
        context.language || 'unknown',
        this.mapStandardizedTypeToChunkType(result.type),
        {
          filePath: context.filePath,
          complexity: result.metadata.complexity || this.calculateComplexity(chunkContent),
          functionName: result.type === 'function' ? result.name : undefined,
          className: result.type === 'class' ? result.name : undefined,
          // 添加标准化元数据
          standardized: true,
          dependencies: result.metadata.dependencies,
          modifiers: result.metadata.modifiers
        }
      ));
    }

    return chunks;
  }

  /**
   * 将标准化结果类型映射到分块类型
   */
  private mapStandardizedTypeToChunkType(standardizedType: StandardizedQueryResult['type']): ChunkType {
    const typeMap: Record<StandardizedQueryResult['type'], ChunkType> = {
      'function': ChunkType.FUNCTION,
      'class': ChunkType.CLASS,
      'method': ChunkType.FUNCTION,
      'import': ChunkType.IMPORT,
      'variable': ChunkType.VARIABLE,
      'interface': ChunkType.INTERFACE,
      'type': ChunkType.TYPE,
      'export': ChunkType.EXPORT,
      'control-flow': ChunkType.GENERIC,
      'expression': ChunkType.GENERIC,
      // 高级关系类型映射
      'data-flow': ChunkType.GENERIC,
      'parameter-flow': ChunkType.GENERIC,
      'call': ChunkType.GENERIC,
      'inheritance': ChunkType.GENERIC,
      'implements': ChunkType.GENERIC,
      'concurrency': ChunkType.GENERIC,
      'lifecycle': ChunkType.GENERIC,
      'semantic': ChunkType.GENERIC,
      'annotation': ChunkType.COMMENT,
      'union': ChunkType.TYPE,
      'enum': ChunkType.ENUM,
      // 配置语言类型映射
      'config-item': ChunkType.GENERIC,
      'section': ChunkType.GENERIC,
      'key': ChunkType.GENERIC,
      'value': ChunkType.GENERIC,
      'array': ChunkType.GENERIC,
      'table': ChunkType.GENERIC,
      'dependency': ChunkType.GENERIC,
      'type-def': ChunkType.TYPE
    };

    return typeMap[standardizedType] || ChunkType.GENERIC;
  }

  /**
   * 合并相邻的小块
   */
  private mergeAdjacentResults(results: StandardizedQueryResult[]): StandardizedQueryResult[] {
    if (results.length <= 1) return results;

    const merged: StandardizedQueryResult[] = [];
    let currentMerge: StandardizedQueryResult[] = [results[0]];

    for (let i = 1; i < results.length; i++) {
      const current = results[i];
      const last = currentMerge[currentMerge.length - 1];

      // 检查是否应该合并
      const shouldMerge = this.shouldMergeResults(last, current);

      if (shouldMerge) {
        currentMerge.push(current);
      } else {
        // 完成当前合并，开始新的合并组
        merged.push(this.mergeResultGroup(currentMerge));
        currentMerge = [current];
      }
    }

    // 处理最后的合并组
    if (currentMerge.length > 0) {
      merged.push(this.mergeResultGroup(currentMerge));
    }

    return merged;
  }

  /**
   * 判断是否应该合并两个标准化结果
   */
  private shouldMergeResults(result1: StandardizedQueryResult, result2: StandardizedQueryResult): boolean {
    // 检查是否相邻
    const isAdjacent = result2.startLine <= result1.endLine + 3;
    if (!isAdjacent) return false;

    // 如果都是小的导入/变量声明，且总大小不大，则合并
    if ((result1.type === 'import' || result1.type === 'variable' || result1.type === 'export') &&
      (result2.type === 'import' || result2.type === 'variable' || result2.type === 'export')) {
      const totalLines = (result1.endLine - result1.startLine + 1) + (result2.endLine - result2.startLine + 1);
      return totalLines <= this.config.maxAdjacentLines!;
    }

    // 如果是同一类的小块，且总大小不大，则合并
    if (result1.type === result2.type) {
      const totalLines = (result1.endLine - result1.startLine + 1) + (result2.endLine - result2.startLine + 1);
      return totalLines <= this.config.maxSameTypeLines!;
    }

    return false;
  }

  /**
   * 合并标准化结果组
   */
  private mergeResultGroup(results: StandardizedQueryResult[]): StandardizedQueryResult {
    if (results.length === 1) return results[0];

    const first = results[0];
    const last = results[results.length - 1];

    // 计算合并后的复杂度
    const totalComplexity = results.reduce((sum, r) => sum + (r.metadata.complexity || 0), 0);

    // 合并依赖关系
    const allDependencies = new Set<string>();
    const allModifiers = new Set<string>();

    for (const result of results) {
      if (result.metadata.dependencies) {
        result.metadata.dependencies.forEach(dep => allDependencies.add(dep));
      }
      if (result.metadata.modifiers) {
        result.metadata.modifiers.forEach(mod => allModifiers.add(mod));
      }
    }

    return {
      nodeId: first.nodeId, // 使用第一个结果的节点ID
      startLine: first.startLine,
      endLine: last.endLine,
      name: first.name, // 使用第一个结果的名称
      type: first.type, // 使用第一个结果的类型
      content: first.content, // 使用第一个结果的内容
      metadata: {
        language: first.metadata.language, // 使用第一个结果的语言
        complexity: totalComplexity,
        dependencies: Array.from(allDependencies),
        modifiers: Array.from(allModifiers)
      }
    };
  }

  /**
   * 计算复杂度
   */
  protected calculateComplexity(content: string): number {
    let complexity = 0;

    // 基于代码结构计算复杂度
    complexity += (content.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/g) || []).length * 2;
    complexity += (content.match(/\b(function|method|class|interface)\b/g) || []).length * 3;
    complexity += (content.match(/[{}]/g) || []).length;
    complexity += (content.match(/[()]/g) || []).length * 0.5;

    // 基于代码长度调整
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1) * 2;

    return Math.round(complexity);
  }

  /**
   * 获取策略配置
   */
  getConfig(): StandardizationStrategyConfig {
    return { ...this.config };
  }

  /**
   * 更新策略配置
   */
  updateConfig(config: Partial<StandardizationStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }
}