import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from '../impl/base/IProcessingStrategy';
import { DetectionResult } from '../../detection/UnifiedDetectionService';
import { CodeChunk, CodeChunkMetadata } from '../../../types/core-types';
import { IQueryResultNormalizer, StandardizedQueryResult } from '../../../core/normalization/types';
import { TreeSitterCoreService } from '../../../core/parse/TreeSitterCoreService';

/**
 * 标准化分段策略
 * 职责：基于标准化结果的分段
 */
@injectable()
export class StandardizationSegmentationStrategy implements IProcessingStrategy {
  private queryNormalizer?: IQueryResultNormalizer;
  private treeSitterService?: TreeSitterCoreService;
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.QueryResultNormalizer) queryNormalizer?: IQueryResultNormalizer,
    @inject(TYPES.TreeSitterService) treeSitterService?: TreeSitterCoreService
  ) {
    this.logger = logger;
    this.queryNormalizer = queryNormalizer;
    this.treeSitterService = treeSitterService;
  }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Standardization segmentation strategy for ${filePath}`);

    if (!this.queryNormalizer || !this.treeSitterService || !detection.language) {
      this.logger?.warn('Required services not available for standardization, falling back to simple segmentation');
      return this.fallbackSegmentation(filePath, content, detection);
    }

    try {
      // 解析代码
      const parseResult = await this.treeSitterService.parseCode(content, detection.language);
      if (!parseResult.success || !parseResult.ast) {
        throw new Error('Failed to parse code for standardization');
      }

      // 标准化查询结果
      const standardizedResults = await this.queryNormalizer.normalize(parseResult.ast, detection.language);
      if (standardizedResults.length === 0) {
        this.logger?.debug('No standardized results found, falling back to simple segmentation');
        return this.fallbackSegmentation(filePath, content, detection);
      }

      // 基于标准化结果创建分块
      const chunks = this.chunkByStandardizedResults(standardizedResults, content, detection.language, filePath);

      this.logger?.debug(`Standardization segmentation created ${chunks.length} chunks`);
      return { chunks, metadata: { strategy: 'StandardizationSegmentationStrategy' } };
    } catch (error) {
      this.logger?.error('Error in standardization-based chunking:', error);
      return this.fallbackSegmentation(filePath, content, detection);
    }
  }

  getName(): string {
    return 'StandardizationSegmentationStrategy';
  }

  getDescription(): string {
    return 'Uses standardized query results for code structure-aware segmentation';
  }

  /**
   * 降级分段方法
   */
  private fallbackSegmentation(filePath: string, content: string, detection: DetectionResult) {
    const chunks: CodeChunk[] = [{
      content,
      metadata: {
        startLine: 1,
        endLine: content.split('\n').length,
        language: detection.language || 'unknown',
        filePath,
        type: 'code',
        complexity: this.calculateComplexity(content),
        fallback: true
      }
    }];

    return { chunks, metadata: { strategy: 'StandardizationSegmentationStrategy', fallback: true } };
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
          complexity: result.metadata.complexity || this.calculateComplexity(chunkContent),
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
      // 高级关系类型映射
      'data-flow': 'code',
      'parameter-flow': 'code',
      'return-flow': 'code',
      'exception-flow': 'code',
      'callback-flow': 'code',
      'semantic-relationship': 'code',
      'lifecycle-event': 'code',
      'concurrency-primitive': 'code',
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
   * 计算复杂度
   */
  private calculateComplexity(content: string): number {
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
}