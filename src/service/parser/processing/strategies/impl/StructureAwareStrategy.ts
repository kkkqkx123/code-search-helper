import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/CoreISplitStrategy';
import { CodeChunk, DEFAULT_CHUNKING_OPTIONS, ChunkingPreset, ChunkingPresetFactory } from '../../types/splitting-types';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { IQueryResultNormalizer, StandardizedQueryResult } from '../../../core/normalization/types';
import { IntelligentStrategy } from './IntelligentStrategy';

/**
 * 结构感知分割器
 * 基于标准化查询结果进行智能分割
 */
@injectable()
export class StructureAwareStrategy implements ISplitStrategy {
  private queryNormalizer?: IQueryResultNormalizer;
  private treeSitterService?: TreeSitterService;
  private logger?: LoggerService;
  private options: Required<ChunkingOptions>;
  private intelligentStrategy: IntelligentStrategy;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.TreeSitterService) treeSitterService?: TreeSitterService
  ) {
    this.logger = logger;
    this.treeSitterService = treeSitterService;
    this.intelligentStrategy = new IntelligentStrategy();
    // 使用预设工厂创建默认配置
    this.options = DEFAULT_CHUNKING_OPTIONS as Required<ChunkingOptions>;
  }

  /**
  * 设置查询结果标准化器
  */
  setQueryNormalizer(normalizer: IQueryResultNormalizer): void {
    this.queryNormalizer = normalizer;
  }

  /**
    * 设置日志器
    */
  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    // 合并选项
    const mergedOptions = { ...this.options, ...options };

    // 如果没有设置标准化器，回退到基础分割器
    if (!this.queryNormalizer || !this.treeSitterService) {
      this.logger?.warn('QueryNormalizer or TreeSitterService not set, falling back to intelligent Strategy');
      return this.intelligentStrategy.split(content, language, filePath, mergedOptions, nodeTracker);
    }

    try {
      // 1. 获取tree-sitter解析结果
      const parseResult = ast || await this.treeSitterService.parseCode(content, language);

      if (!parseResult.success || !parseResult.ast) {
        this.logger?.warn(`Failed to parse ${language} code, falling back to intelligent Strategy`);
        return this.intelligentStrategy.split(content, language, filePath, mergedOptions, nodeTracker);
      }

      // 2. 执行标准化查询
      const standardizedResults = await this.queryNormalizer.normalize(parseResult.ast, language);

      if (standardizedResults.length === 0) {
        this.logger?.debug(`No structures found in ${language} code, falling back to intelligent Strategy`);
        return this.intelligentStrategy.split(content, language, filePath, mergedOptions, nodeTracker);
      }

      // 3. 基于标准化结果进行智能分割
      return this.splitByStructure(standardizedResults, content, language, filePath, mergedOptions);

    } catch (error) {
      this.logger?.error(`Structure-aware splitting failed for ${language}:`, error);
      return this.intelligentStrategy.split(content, language, filePath, mergedOptions, nodeTracker);
    }
  }

  getName(): string {
    return 'StructureAwareStrategy';
  }

  getDescription(): string {
    return 'Structure-aware Strategy that uses standardized query results for intelligent code splitting';
  }

  supportsLanguage(language: string): boolean {
    // 检查是否有对应的语言适配器
    if (this.queryNormalizer) {
      return true; // 标准化器会处理语言适配
    }
    return this.intelligentStrategy.supportsLanguage(language);
  }



  /**
   * 基于结构进行分割
   */
  private splitByStructure(
    structures: StandardizedQueryResult[],
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions
  ): CodeChunk[] {
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];
    let currentPosition = 1; // 1-based line number

    // 按结构重要性排序
    const sortedStructures = this.sortStructuresByImportance(structures);

    for (const structure of sortedStructures) {
      // 处理结构之间的间隙
      if (structure.startLine > currentPosition) {
        const gapContent = lines.slice(currentPosition - 1, structure.startLine - 1).join('\n');
        if (gapContent.trim()) {
          chunks.push(this.createChunk(
            gapContent,
            currentPosition,
            structure.startLine - 1,
            language,
            filePath,
            'gap'
          ));
        }
      }

      // 添加结构本身作为代码块
      chunks.push(this.createChunk(
        structure.content,
        structure.startLine,
        structure.endLine,
        language,
        filePath,
        structure.type,
        structure
      ));

      currentPosition = structure.endLine + 1;
    }

    // 处理剩余内容
    if (currentPosition <= lines.length) {
      const remainingContent = lines.slice(currentPosition - 1).join('\n');
      if (remainingContent.trim()) {
        chunks.push(this.createChunk(
          remainingContent,
          currentPosition,
          lines.length,
          language,
          filePath,
          'remaining'
        ));
      }
    }

    // 合并过小的块
    return this.mergeSmallChunks(chunks, options);
  }

  /**
   * 按结构重要性排序
   */
  private sortStructuresByImportance(structures: StandardizedQueryResult[]): StandardizedQueryResult[] {
    const importanceOrder = {
      'import': 1,
      'export': 2,
      'class': 3,
      'interface': 4,
      'type': 5,
      'function': 6,
      'method': 7,
      'variable': 8,
      'control-flow': 9,
      'expression': 10,
      // 配置语言类型
      'config-item': 11,
      'section': 12,
      'key': 13,
      'value': 14,
      'array': 15,
      'table': 16,
      'dependency': 17,
      'type-def': 18
    };

    return structures.sort((a, b) => {
      const aImportance = importanceOrder[a.type] || 999;
      const bImportance = importanceOrder[b.type] || 999;

      if (aImportance !== bImportance) {
        return aImportance - bImportance;
      }

      // 如果重要性相同，按行号排序
      return a.startLine - b.startLine;
    });
  }

  /**
   * 创建代码块
   */
  private createChunk(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    filePath?: string,
    type: string = 'unknown',
    structure?: StandardizedQueryResult
  ): CodeChunk {
    const metadata: any = {
      startLine,
      endLine,
      language,
      filePath,
      type,
      complexity: structure?.metadata.complexity || 0
    };

    // 如果有结构信息，添加更多元数据
    if (structure) {
      metadata.name = structure.name;
      metadata.dependencies = structure.metadata.dependencies;
      metadata.modifiers = structure.metadata.modifiers;
      metadata.extra = structure.metadata.extra;
    }

    return {
      content,
      metadata
    };
  }

  /**
   * 合并过小的块
   */
  private mergeSmallChunks(chunks: CodeChunk[], options?: ChunkingOptions): CodeChunk[] {
    const minChunkSize = options?.basic?.minChunkSize || 10;
    const mergedChunks: CodeChunk[] = [];
    let currentMerge: CodeChunk[] = [];

    for (const chunk of chunks) {
      currentMerge.push(chunk);

      const totalLines = chunk.metadata.endLine - chunk.metadata.startLine + 1;

      // 如果当前块足够大，或者是最后一个块，则执行合并
      if (totalLines >= minChunkSize || chunk === chunks[chunks.length - 1]) {
        if (currentMerge.length === 1) {
          mergedChunks.push(currentMerge[0]);
        } else {
          // 合并多个小块
          const merged = this.mergeChunks(currentMerge);
          mergedChunks.push(merged);
        }
        currentMerge = [];
      }
    }

    // 处理剩余的小块
    if (currentMerge.length > 0) {
      const merged = this.mergeChunks(currentMerge);
      mergedChunks.push(merged);
    }

    return mergedChunks;
  }

  /**
   * 合并多个代码块
   */
  private mergeChunks(chunks: CodeChunk[]): CodeChunk {
    if (chunks.length === 1) {
      return chunks[0];
    }

    const contents = chunks.map(chunk => chunk.content);
    const mergedContent = contents.join('\n\n');

    const firstChunk = chunks[0];
    const lastChunk = chunks[chunks.length - 1];

    // 合并元数据
    const mergedMetadata = {
      ...firstChunk.metadata,
      endLine: lastChunk.metadata.endLine,
      type: 'merged' as const,
      complexity: chunks.reduce((sum, chunk) => sum + (chunk.metadata.complexity || 0), 0),
      mergedTypes: chunks.map(chunk => chunk.metadata.type || 'code'),
      mergedCount: chunks.length
    };

    return {
      content: mergedContent,
      metadata: mergedMetadata
    };
  }
}

/**
 * 结构感知策略提供者
 */
@injectable()
export class StructureAwareStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService
  ) { }

  getName(): string {
    return 'StructureAwareStrategyProvider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new StructureAwareStrategy(this.logger, this.treeSitterService);
  }

  getDependencies(): string[] {
    return ['TreeSitterService', 'QueryResultNormalizer'];
  }

  supportsLanguage(language: string): boolean {
    const strategy = this.createStrategy();
    return strategy.supportsLanguage(language);
  }

  getDescription(): string {
    return 'Provides structure-aware code splitting strategy';
  }
}