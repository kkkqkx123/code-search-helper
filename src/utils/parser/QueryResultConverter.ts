import { TypeMappingUtils, StructureType, HierarchicalStructure, NestingInfo } from './TypeMappingUtils';
import { TopLevelStructure, NestedStructure, InternalStructure } from '../types/ContentTypes';
import { CodeChunk } from '../../service/parser/types';

/**
 * 转换配置
 */
export interface ConversionConfig {
  includeMetadata?: boolean;
  filterByType?: StructureType[];
  minConfidence?: number;
  maxDepth?: number;
  preserveLocation?: boolean;
  addContextLines?: number;
}

/**
 * 查询结果转换器
 * 负责将不同类型的结构转换为代码块
 */
export class QueryResultConverter {

  /**
   * 转换顶级结构为代码块
   */
  static convertTopLevelStructures(
    structures: TopLevelStructure[],
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): CodeChunk[] {
    return structures.map(structure => {
      const hierarchicalStructure = TypeMappingUtils.convertTopLevelToHierarchical(structure);
      return this.convertSingleHierarchicalStructure(hierarchicalStructure, strategy, filePath, config);
    });
  }

  /**
   * 转换嵌套结构为代码块
   */
  static convertNestedStructures(
    structures: NestedStructure[],
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): CodeChunk[] {
    return structures.map(structure => {
      const hierarchicalStructure = TypeMappingUtils.convertNestedToHierarchical(structure);
      return this.convertSingleHierarchicalStructure(hierarchicalStructure, strategy, filePath, config);
    });
  }

  /**
   * 转换内部结构为代码块
   */
  static convertInternalStructures(
    structures: InternalStructure[],
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): CodeChunk[] {
    return structures.map(structure => {
      const hierarchicalStructure = TypeMappingUtils.convertInternalToHierarchical(structure);
      return this.convertSingleHierarchicalStructure(hierarchicalStructure, strategy, filePath, config);
    });
  }

  /**
   * 转换单个分层结构为代码块
   */
  static convertSingleHierarchicalStructure(
    structure: HierarchicalStructure,
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): CodeChunk {
    const chunkType = TypeMappingUtils.mapStructureTypeToChunkType(structure.type);

    // 应用过滤条件
    if (config.filterByType && !config.filterByType.includes(structure.type)) {
      return null as any; // 将在后续过滤中被移除
    }

    if (config.minConfidence && structure.metadata.confidence < config.minConfidence) {
      return null as any; // 将在后续过滤中被移除
    }

    if (config.maxDepth && structure.nestingInfo && structure.nestingInfo.level > config.maxDepth) {
      return null as any; // 将在后续过滤中被移除
    }

    const metadata: any = config.includeMetadata ? structure.metadata : {};
    metadata.id = this.generateChunkId(structure, filePath);
    metadata.type = chunkType;
    metadata.startLine = structure.location.startLine;
    metadata.endLine = structure.location.endLine;
    metadata.filePath = filePath || '';

    // 添加上下文行
    if (config.addContextLines && config.addContextLines > 0) {
      metadata.contextLines = this.extractContextLines(structure, config.addContextLines);
    }

    const chunk: CodeChunk = {
      content: this.processContent(structure.content, config),
      metadata
    };

    return chunk;
  }

  /**
   * 批量转换混合结构
   */
  static convertMixedStructures(
    topLevelStructures: TopLevelStructure[] = [],
    nestedStructures: NestedStructure[] = [],
    internalStructures: InternalStructure[] = [],
    strategy: string,
    filePath?: string,
    config: ConversionConfig = {}
  ): CodeChunk[] {
    const allChunks: CodeChunk[] = [];

    // 转换顶级结构
    if (topLevelStructures.length > 0) {
      allChunks.push(...this.convertTopLevelStructures(topLevelStructures, strategy, filePath, config));
    }

    // 转换嵌套结构
    if (nestedStructures.length > 0) {
      allChunks.push(...this.convertNestedStructures(nestedStructures, strategy, filePath, config));
    }

    // 转换内部结构
    if (internalStructures.length > 0) {
      allChunks.push(...this.convertInternalStructures(internalStructures, strategy, filePath, config));
    }

    // 过滤掉null值
    return allChunks.filter(chunk => chunk !== null);
  }

  /**
   * 生成代码块ID
   */
  private static generateChunkId(structure: HierarchicalStructure, filePath?: string): string {
    const baseId = `${structure.type}_${structure.name}_${structure.location.startLine}`;
    const filePrefix = filePath ? `${filePath.replace(/[^a-zA-Z0-9]/g, '_')}_` : '';
    return `${filePrefix}${baseId}`;
  }

  /**
   * 处理内容
   */
  private static processContent(content: string, config: ConversionConfig): string {
    if (!content) return '';

    let processedContent = content.trim();

    // 可以根据需要添加更多内容处理逻辑
    // 例如：去除多余空行、标准化缩进等

    return processedContent;
  }

  /**
   * 提取上下文行
   */
  private static extractContextLines(structure: HierarchicalStructure, contextLines: number): string[] {
    // 这里需要访问原始文件内容来提取上下文行
    // 由于当前设计限制，这里返回空数组
    // 在实际实现中，可能需要传入原始文件内容
    return [];
  }

  /**
   * 按策略过滤代码块
   */
  static filterChunksByStrategy(chunks: CodeChunk[], strategy: string): CodeChunk[] {
    switch (strategy) {
      case 'function-only':
        return chunks.filter(chunk => chunk.metadata.type === 'function');
      case 'class-only':
        return chunks.filter(chunk => chunk.metadata.type === 'class');
      case 'high-importance':
        return chunks.filter(chunk =>
          chunk.metadata.importance === 'high' ||
          ['function', 'class', 'interface'].includes(chunk.metadata.type as string)
        );
      case 'all':
      default:
        return chunks;
    }
  }

  /**
   * 按位置排序代码块
   */
  static sortChunksByLocation(chunks: CodeChunk[]): CodeChunk[] {
    return chunks.sort((a, b) => {
      if (a.metadata.startLine !== b.metadata.startLine) {
        return a.metadata.startLine - b.metadata.startLine;
      }
      return a.metadata.endLine - b.metadata.endLine;
    });
  }

  /**
   * 合并相邻的代码块
   */
  static mergeAdjacentChunks(chunks: CodeChunk[], maxGap: number = 1): CodeChunk[] {
    if (chunks.length === 0) return [];

    const sortedChunks = this.sortChunksByLocation(chunks);
    const mergedChunks: CodeChunk[] = [];
    let currentChunk = { ...sortedChunks[0], metadata: { ...sortedChunks[0].metadata } };

    for (let i = 1; i < sortedChunks.length; i++) {
      const nextChunk = sortedChunks[i];

      // 检查是否相邻（间隔不超过maxGap行）
      if (nextChunk.metadata.startLine - currentChunk.metadata.endLine <= maxGap) {
        // 合并代码块
        currentChunk.metadata.endLine = Math.max(currentChunk.metadata.endLine, nextChunk.metadata.endLine);
        currentChunk.content += '\n' + nextChunk.content;

        // 合并元数据
        currentChunk.metadata = {
          ...currentChunk.metadata,
          ...nextChunk.metadata,
          merged: true
        };
      } else {
        // 添加当前块并开始新块
        mergedChunks.push(currentChunk);
        currentChunk = { ...nextChunk, metadata: { ...nextChunk.metadata } };
      }
    }

    // 添加最后一个块
    mergedChunks.push(currentChunk);

    return mergedChunks;
  }

  /**
   * 验证代码块
   */
  static validateChunk(chunk: CodeChunk): boolean {
    return !!(
      chunk.metadata.id &&
      chunk.metadata.type &&
      chunk.content &&
      chunk.metadata.startLine > 0 &&
      chunk.metadata.endLine >= chunk.metadata.startLine
    );
  }

  /**
   * 清理和标准化代码块
   */
  static normalizeChunk(chunk: CodeChunk): CodeChunk {
    return {
      ...chunk,
      content: chunk.content.trim(),
      metadata: {
        ...chunk.metadata,
        confidence: Math.max(0, Math.min(1, chunk.metadata.confidence || 0))
      }
    };
  }

  /**
   * 获取代码块统计信息
   */
  static getChunkStatistics(chunks: CodeChunk[]): {
    total: number;
    byType: Record<string, number>;
    averageSize: number;
    totalLines: number;
  } {
    const stats = {
      total: chunks.length,
      byType: {} as Record<string, number>,
      averageSize: 0,
      totalLines: 0
    };

    let totalSize = 0;

    for (const chunk of chunks) {
      // 按类型统计
      const type = chunk.metadata.type as string;
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // 计算大小和行数
      const size = chunk.content.length;
      const lines = chunk.metadata.endLine - chunk.metadata.startLine + 1;

      totalSize += size;
      stats.totalLines += lines;
    }

    stats.averageSize = chunks.length > 0 ? totalSize / chunks.length : 0;

    return stats;
  }
}