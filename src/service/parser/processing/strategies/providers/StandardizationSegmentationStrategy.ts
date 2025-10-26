import { injectable, inject } from 'inversify';
import { ISegmentationStrategy, SegmentationContext, IComplexityCalculator } from '../types/SegmentationTypes';
import { CodeChunk, CodeChunkMetadata } from '../../../splitting';
import { IQueryResultNormalizer, StandardizedQueryResult } from '../../../core/normalization/types';
import { TreeSitterCoreService } from '../../../core/parse/TreeSitterCoreService';
import { TYPES } from '../../../../../types';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * 标准化分段策略
 * 职责：基于标准化结果的分段
 */
@injectable()
export class StandardizationSegmentationStrategy implements ISegmentationStrategy {
  private complexityCalculator: IComplexityCalculator;
  private queryNormalizer?: IQueryResultNormalizer;
  private treeSitterService?: TreeSitterCoreService;
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.ComplexityCalculator) complexityCalculator: IComplexityCalculator,
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.QueryResultNormalizer) queryNormalizer?: IQueryResultNormalizer,
    @inject(TYPES.TreeSitterService) treeSitterService?: TreeSitterCoreService
  ) {
    this.complexityCalculator = complexityCalculator;
    this.logger = logger;
    this.queryNormalizer = queryNormalizer;
    this.treeSitterService = treeSitterService;
  }

  canHandle(context: SegmentationContext): boolean {
    // 需要启用标准化集成
    if (!context.options.enableStandardization) {
      return false;
    }

    // 需要可用的服务
    if (!this.queryNormalizer || !this.treeSitterService) {
      return false;
    }

    // 需要有语言信息
    if (!context.language) {
      return false;
    }

    // 小文件不使用标准化分段
    if (context.metadata.isSmallFile) {
      return false;
    }

    // Markdown文件不使用标准化分段
    if (context.metadata.isMarkdownFile) {
      return false;
    }

    // 检查是否支持该语言
    return this.isLanguageSupported(context.language);
  }

  async segment(context: SegmentationContext): Promise<CodeChunk[]> {
    const { content, filePath, language } = context;

    if (!this.queryNormalizer || !this.treeSitterService || !language) {
      throw new Error('Required services not available for standardization');
    }

    try {
      // 解析代码
      const parseResult = await this.treeSitterService.parseCode(content, language);
      if (!parseResult.success || !parseResult.ast) {
        throw new Error('Failed to parse code for standardization');
      }

      // 标准化查询结果
      const standardizedResults = await this.queryNormalizer.normalize(parseResult.ast, language);
      if (standardizedResults.length === 0) {
        this.logger?.debug('No standardized results found, falling back to text analysis');
        return [];
      }

      // 基于标准化结果创建分块
      const chunks = this.chunkByStandardizedResults(standardizedResults, content, language, filePath);

      this.logger?.debug(`Standardization segmentation created ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger?.error('Error in standardization-based chunking:', error);
      throw error;
    }
  }

  getName(): string {
    return 'standardization';
  }

  getPriority(): number {
    return 2; // 高优先级，仅次于Markdown
  }

  getSupportedLanguages(): string[] {
    return ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp', 'go', 'rust'];
  }

  validateContext(context: SegmentationContext): boolean {
    // 验证上下文是否适合标准化分段
    if (!context.content || context.content.trim().length === 0) {
      return false;
    }

    if (!context.language) {
      return false;
    }

    if (!this.queryNormalizer || !this.treeSitterService) {
      return false;
    }

    return this.isLanguageSupported(context.language);
  }

  /**
   * 基于标准化结果的分段
   */
  private chunkByStandardizedResults(
    standardizedResults: StandardizedQueryResult[],
    content: string,
    language: string,
    filePath?: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    // 按行号排序标准化结果
    const sortedResults = standardizedResults.sort((a, b) => a.startLine - b.startLine);

    // 合并相邻的小块
    const mergedResults = this.mergeAdjacentResults(sortedResults);

    for (const result of mergedResults) {
      const chunkContent = lines.slice(result.startLine - 1, result.endLine).join('\n');

      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: result.startLine,
          endLine: result.endLine,
          language: language || 'unknown',
          filePath,
          type: this.mapStandardizedTypeToChunkType(result.type),
          complexity: result.metadata.complexity || this.complexityCalculator.calculate(chunkContent),
          functionName: result.type === 'function' ? result.name : undefined,
          className: result.type === 'class' ? result.name : undefined,
          // 添加标准化元数据
          standardized: true,
          dependencies: result.metadata.dependencies,
          modifiers: result.metadata.modifiers
        }
      });
    }

    return chunks;
  }

  /**
   * 将标准化结果类型映射到分块类型
   */
  private mapStandardizedTypeToChunkType(standardizedType: StandardizedQueryResult['type']): CodeChunkMetadata['type'] {
    const typeMap: Record<StandardizedQueryResult['type'], CodeChunkMetadata['type']> = {
      'function': 'function',
      'class': 'class',
      'method': 'method',
      'import': 'import',
      'variable': 'code',
      'interface': 'interface',
      'type': 'code',
      'export': 'import',
      'control-flow': 'code',
      'expression': 'code',
      // 配置语言类型映射
      'config-item': 'code',
      'section': 'code',
      'key': 'code',
      'value': 'code',
      'array': 'code',
      'table': 'code',
      'dependency': 'code',
      'type-def': 'code'
    };

    return typeMap[standardizedType] || 'semantic';
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
      return totalLines <= 20;
    }

    // 如果是同一类的小块，且总大小不大，则合并
    if (result1.type === result2.type) {
      const totalLines = (result1.endLine - result1.startLine + 1) + (result2.endLine - result2.startLine + 1);
      return totalLines <= 30;
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
   * 检查是否支持该语言
   */
  private isLanguageSupported(language: string): boolean {
    const supportedLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp', 'go', 'rust'];
    return supportedLanguages.includes(language);
  }

  /**
   * 设置查询标准化器
   */
  setQueryNormalizer(normalizer: IQueryResultNormalizer): void {
    this.queryNormalizer = normalizer;
    this.logger?.debug('Query normalizer set for StandardizationSegmentationStrategy');
  }

  /**
   * 设置Tree-sitter服务
   */
  setTreeSitterService(service: TreeSitterCoreService): void {
    this.treeSitterService = service;
    this.logger?.debug('Tree-sitter service set for StandardizationSegmentationStrategy');
  }
}