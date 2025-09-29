import Parser from 'tree-sitter';
import { ChunkingStrategy, StrategyExecutionResult } from './ChunkingStrategy';
import { ChunkingStrategyManager, StrategyExecutionContext } from './ChunkingStrategyManager';
import { FunctionChunkingStrategy } from './FunctionChunkingStrategy';
import { ClassChunkingStrategy } from './ClassChunkingStrategy';
import { ModuleChunkingStrategy } from './ModuleChunkingStrategy';
import { LanguageConfigManager } from '../config/LanguageConfigManager';
import { CodeChunk } from '../types';

/**
 * 分层分段策略
 * 按照优先级和层级关系执行多种分段策略，确保代码结构的完整性
 */
export class HierarchicalChunkingStrategy implements ChunkingStrategy {
  readonly name = 'hierarchical_chunking';
  readonly priority = 0; // 最高优先级
  readonly description = 'Execute multiple chunking strategies in hierarchical order';
  readonly supportedLanguages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'c', 'cpp'];

  private strategyManager: ChunkingStrategyManager;
  private configManager: LanguageConfigManager;
  private strategies: ChunkingStrategy[];

  constructor() {
    this.strategyManager = new ChunkingStrategyManager();
    this.configManager = new LanguageConfigManager();
    this.strategies = [];
    this.initializeStrategies();
  }

  /**
   * 初始化策略
   */
  private initializeStrategies(): void {
    // 按优先级顺序初始化策略
    const moduleStrategy = new ModuleChunkingStrategy();
    const classStrategy = new ClassChunkingStrategy();
    const functionStrategy = new FunctionChunkingStrategy();

    this.strategies = [moduleStrategy, classStrategy, functionStrategy];

    // 注册到策略管理器
    this.strategies.forEach(strategy => {
      this.strategyManager.registerStrategy(strategy);
    });
  }

  canHandle(language: string, node: Parser.SyntaxNode): boolean {
    // 分层策略可以处理所有支持的语言
    return this.supportedLanguages.includes(language);
  }

  chunk(node: Parser.SyntaxNode, content: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    if (this.canHandle(this.detectLanguage(node), node)) {
      // 创建执行上下文
      const context: StrategyExecutionContext = {
        language: this.detectLanguage(node),
        sourceCode: content,
        ast: node
      };

      // 执行分层分段（同步方式）
      const hierarchicalChunks = this.executeHierarchicalChunkingSync(context);
      chunks.push(...hierarchicalChunks);
    }

    return chunks;
  }

  getSupportedNodeTypes(language: string): Set<string> {
    // 返回所有支持的节点类型
    const allTypes = new Set<string>();

    for (const strategy of this.strategies) {
      const types = strategy.getSupportedNodeTypes(language);
      types.forEach(type => allTypes.add(type));
    }

    return allTypes;
  }

  validateChunks(chunks: CodeChunk[]): boolean {
    if (!chunks || chunks.length === 0) {
      return false;
    }

    // 验证所有分段
    for (const chunk of chunks) {
      if (!this.validateSingleChunk(chunk)) {
        return false;
      }
    }

    // 验证分段之间的关系
    return this.validateChunkRelationships(chunks);
  }

  getConfiguration() {
    // 返回默认配置
    return {
      maxChunkSize: 2000,
      minChunkSize: 100,
      preserveComments: true,
      preserveEmptyLines: false,
      maxNestingLevel: 10
    };
  }

  /**
   * 执行分层分段（异步版本）
   */
  private async executeHierarchicalChunking(context: StrategyExecutionContext): Promise<CodeChunk[]> {
    const allChunks: CodeChunk[] = [];
    const processedNodes = new Set<string>();

    // 按优先级执行策略
    for (const strategy of this.strategies) {
      if (strategy.canHandle(context.language, context.ast)) {
        const result = await this.strategyManager.executeStrategy(strategy.name, context);

        if (result.success) {
          // 过滤掉已处理的节点
          const newChunks = this.filterProcessedNodes(result.chunks, processedNodes);
          allChunks.push(...newChunks);

          // 标记已处理的节点
          this.markProcessedNodes(newChunks, processedNodes);
        }
      }
    }

    // 合并和优化分段
    const optimizedChunks = this.optimizeHierarchicalChunks(allChunks, context);

    return optimizedChunks;
  }

  /**
   * 执行分层分段（同步版本）
   */
  private executeHierarchicalChunkingSync(context: StrategyExecutionContext): CodeChunk[] {
    const allChunks: CodeChunk[] = [];
    const processedNodes = new Set<string>();

    // 按优先级执行策略
    for (const strategy of this.strategies) {
      if (strategy.canHandle(context.language, context.ast)) {
        // 直接使用策略的chunk方法，而不是通过策略管理器
        const strategyChunks = strategy.chunk(context.ast, context.sourceCode);

        // 过滤掉已处理的节点
        const newChunks = this.filterProcessedNodes(strategyChunks, processedNodes);
        allChunks.push(...newChunks);

        // 标记已处理的节点
        this.markProcessedNodes(newChunks, processedNodes);
      }
    }

    // 合并和优化分段
    const optimizedChunks = this.optimizeHierarchicalChunks(allChunks, context);

    return optimizedChunks;
  }

  /**
   * 过滤已处理的节点
   */
  private filterProcessedNodes(chunks: CodeChunk[], processedNodes: Set<string>): CodeChunk[] {
    return chunks.filter(chunk => {
      const nodeKey = this.generateNodeKey(chunk);
      return !processedNodes.has(nodeKey);
    });
  }

  /**
   * 标记已处理的节点
   */
  private markProcessedNodes(chunks: CodeChunk[], processedNodes: Set<string>): void {
    for (const chunk of chunks) {
      const nodeKey = this.generateNodeKey(chunk);
      processedNodes.add(nodeKey);
    }
  }

  /**
   * 生成节点键
   */
  private generateNodeKey(chunk: CodeChunk): string {
    return `${chunk.metadata.startLine}:${chunk.metadata.endLine}:${chunk.content.length}`;
  }

  /**
   * 优化分层分段
   */
  private optimizeHierarchicalChunks(chunks: CodeChunk[], context: StrategyExecutionContext): CodeChunk[] {
    // 按类型分组
    const groupedChunks = this.groupChunksByType(chunks);

    // 按优先级排序
    const sortedChunks = this.sortChunksByPriority(groupedChunks);

    // 合并相关分段
    const mergedChunks = this.mergeRelatedChunks(sortedChunks, context);

    // 添加重叠
    const overlappedChunks = this.addOverlap(mergedChunks, context);

    return overlappedChunks;
  }

  /**
   * 按类型分组分段
   */
  private groupChunksByType(chunks: CodeChunk[]): Map<string, CodeChunk[]> {
    const grouped = new Map<string, CodeChunk[]>();

    for (const chunk of chunks) {
      const type = chunk.metadata.type || 'unknown';
      if (!grouped.has(type)) {
        grouped.set(type, []);
      }
      grouped.get(type)!.push(chunk);
    }

    return grouped;
  }

  /**
   * 按优先级排序分段
   */
  private sortChunksByPriority(groupedChunks: Map<string, CodeChunk[]>): CodeChunk[] {
    const typePriority: Record<string, number> = {
      'module': 0,
      'class': 1,
      'function': 2,
      'method': 3,
      'property': 4,
      'declaration': 5
    };

    const sortedChunks: CodeChunk[] = [];

    // 按优先级顺序添加分段
    const sortedTypes = Object.keys(typePriority).sort((a, b) => typePriority[a] - typePriority[b]);

    for (const type of sortedTypes) {
      const chunks = groupedChunks.get(type) || [];
      // 在同一类型内，按开始位置排序
      chunks.sort((a, b) => a.metadata.startLine - b.metadata.startLine);
      sortedChunks.push(...chunks);
    }

    // 添加未分组的分段
    const ungrouped = Array.from(groupedChunks.values())
      .flat()
      .filter(chunk => !typePriority.hasOwnProperty(chunk.metadata.type || ''));

    ungrouped.sort((a, b) => a.metadata.startLine - b.metadata.startLine);
    sortedChunks.push(...ungrouped);

    return sortedChunks;
  }

  /**
   * 合并相关分段
   */
  private mergeRelatedChunks(chunks: CodeChunk[], context: StrategyExecutionContext): CodeChunk[] {
    const merged: CodeChunk[] = [];
    let currentGroup: CodeChunk[] = [];

    for (const chunk of chunks) {
      if (currentGroup.length === 0) {
        currentGroup.push(chunk);
      } else {
        // 检查是否可以合并
        if (this.canMergeWithGroup(chunk, currentGroup, context)) {
          currentGroup.push(chunk);
        } else {
          // 合并当前组
          if (currentGroup.length > 0) {
            const mergedChunk = this.mergeChunkGroup(currentGroup);
            merged.push(mergedChunk);
          }
          currentGroup = [chunk];
        }
      }
    }

    // 合并最后一组
    if (currentGroup.length > 0) {
      const mergedChunk = this.mergeChunkGroup(currentGroup);
      merged.push(mergedChunk);
    }

    return merged;
  }

  /**
   * 检查是否可以与组合并
   */
  private canMergeWithGroup(chunk: CodeChunk, group: CodeChunk[], context: StrategyExecutionContext): boolean {
    const config = this.configManager.getDefaultConfiguration(context.language);

    // 检查大小限制
    const totalSize = group.reduce((sum, c) => sum + c.content.length, 0) + chunk.content.length;
    if (totalSize > config.maxChunkSize) {
      return false;
    }

    // 检查类型兼容性
    const lastChunk = group[group.length - 1];
    if (!this.areTypesCompatible(lastChunk, chunk)) {
      return false;
    }

    // 检查位置相邻性
    const lineGap = chunk.metadata.startLine - lastChunk.metadata.endLine;
    if (lineGap > 10) {
      return false;
    }

    return true;
  }

  /**
   * 检查类型兼容性
   */
  private areTypesCompatible(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    const type1 = chunk1.metadata.type || 'unknown';
    const type2 = chunk2.metadata.type || 'unknown';

    // 相同类型总是兼容
    if (type1 === type2) {
      return true;
    }

    // 类型兼容性规则
    const compatibilityRules: Record<string, string[]> = {
      'function': ['method'],
      'method': ['function'],
      'class': ['declaration'],
      'module': ['declaration']
    };

    return compatibilityRules[type1]?.includes(type2) || false;
  }

  /**
   * 合并分段组
   */
  private mergeChunkGroup(group: CodeChunk[]): CodeChunk {
    if (group.length === 1) {
      return group[0];
    }

    // 按开始位置排序
    group.sort((a, b) => a.metadata.startLine - b.metadata.startLine);

    const mergedContent = group.map(chunk => chunk.content).join('\n\n');
    const firstChunk = group[0];
    const lastChunk = group[group.length - 1];

    // 合并元数据
    const mergedMetadata = {
      ...firstChunk.metadata,
      endLine: lastChunk.metadata.endLine,
      complexity: Math.max(...group.map(chunk => chunk.metadata.complexity || 0)),
      chunkCount: group.length,
      mergedTypes: group.map(chunk => chunk.metadata.type || 'unknown')
    };

    return {
      content: mergedContent,
      metadata: mergedMetadata
    };
  }

  /**
   * 添加重叠
   */
  private addOverlap(chunks: CodeChunk[], context: StrategyExecutionContext): CodeChunk[] {
    if (chunks.length <= 1) {
      return chunks;
    }

    const config = this.configManager.getDefaultConfiguration(context.language);
    const overlapSize = Math.min(100, config.maxChunkSize * 0.1); // 10%的重叠

    const overlapped: CodeChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const overlapContent = this.extractOverlapContent(chunk, nextChunk, overlapSize);

        if (overlapContent) {
          const overlappedChunk: CodeChunk = {
            ...chunk,
            content: chunk.content + '\n' + overlapContent,
            metadata: {
              ...chunk.metadata,
              hasOverlap: true,
              overlapSize: overlapContent.length
            }
          };

          overlapped.push(overlappedChunk);
        } else {
          overlapped.push(chunk);
        }
      } else {
        overlapped.push(chunk);
      }
    }

    return overlapped;
  }

  /**
   * 提取重叠内容
   */
  private extractOverlapContent(chunk: CodeChunk, nextChunk: CodeChunk, overlapSize: number): string | null {
    const lines = nextChunk.content.split('\n');
    const overlapLines: string[] = [];
    let currentSize = 0;

    for (const line of lines) {
      if (currentSize + line.length + 1 > overlapSize) {
        break;
      }
      overlapLines.push(line);
      currentSize += line.length + 1;
    }

    return overlapLines.length > 0 ? overlapLines.join('\n') : null;
  }

  /**
   * 检测语言
   */
  private detectLanguage(node: Parser.SyntaxNode): string {
    // 简化的语言检测逻辑
    // 实际实现中应该从上下文或其他方式获取语言信息
    return 'typescript'; // 默认值
  }

  /**
   * 验证单个分段
   */
  private validateSingleChunk(chunk: CodeChunk): boolean {
    // 检查基本属性
    if (!chunk.content || chunk.content.length === 0) {
      return false;
    }

    if (!chunk.metadata || !chunk.metadata.startLine || !chunk.metadata.endLine) {
      return false;
    }

    // 检查行号合理性
    if (chunk.metadata.startLine > chunk.metadata.endLine) {
      return false;
    }

    // 检查内容长度
    if (chunk.content.length < 100) { // 过小的分段
      return false;
    }

    if (chunk.content.length > 2000) { // 过大的分段
      return false;
    }

    return true;
  }

  /**
   * 验证分段关系
   */
  private validateChunkRelationships(chunks: CodeChunk[]): boolean {
    // 按开始位置排序
    const sortedChunks = [...chunks].sort((a, b) => a.metadata.startLine - b.metadata.startLine);

    // 检查重叠和间隙
    for (let i = 0; i < sortedChunks.length - 1; i++) {
      const current = sortedChunks[i];
      const next = sortedChunks[i + 1];

      // 检查严重重叠
      const overlap = current.metadata.endLine - next.metadata.startLine;
      if (overlap > 50) { // 超过50行的重叠可能不合理
        return false;
      }

      // 检查过大间隙
      const gap = next.metadata.startLine - current.metadata.endLine;
      if (gap > 100) { // 超过100行的间隙可能不合理
        return false;
      }
    }

    return true;
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return this.strategyManager.getPerformanceStats();
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats(): void {
    this.strategyManager.resetPerformanceStats();
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.strategyManager.clearCache();
  }
}