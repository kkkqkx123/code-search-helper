import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { Vector, VectorTypeConverter, CodeToTextResult } from '../types/VectorTypes';
import { CodeChunk } from '../../parser/types';
import { VectorPoint } from '../../../database/qdrant/IVectorStore';
import { LoggerService } from '../../../utils/LoggerService';

@injectable()
export class VectorConversionService {
  constructor(
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  async convertChunksToVectors(
    chunks: CodeChunk[],
    embeddings: number[][],
    projectPath: string
  ): Promise<Vector[]> {
    if (chunks.length !== embeddings.length) {
      throw new Error('Chunks and embeddings length mismatch');
    }

    const projectId = this.projectIdManager.getProjectId(projectPath) || '';

    return chunks.map((chunk, index) => ({
      id: this.generateVectorId(chunk, projectPath, index),
      vector: embeddings[index],
      content: chunk.content,
      metadata: {
        // 基础信息
        projectId,
        filePath: chunk.metadata.filePath,
        language: chunk.metadata.language,
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine,
        
        // 类型信息 - 使用原始类型而不是硬编码
        chunkType: chunk.metadata.type ? [chunk.metadata.type as string] : ['unknown'],
        
        // 保留上游模块提供的丰富信息
        complexity: chunk.metadata.complexity,
        complexityAnalysis: chunk.metadata.complexityAnalysis,
        nestingLevel: chunk.metadata.nestingLevel,
        strategy: chunk.metadata.strategy,
        isSignatureOnly: chunk.metadata.isSignatureOnly,
        originalStructure: chunk.metadata.originalStructure,
        
        // 函数和类信息
        functionName: chunk.metadata.functionName,
        className: chunk.metadata.className,
        
        // AST和语义信息
        astNodes: chunk.metadata.astNodes,
        semanticBoundary: chunk.metadata.semanticBoundary,
        
        // 其他有价值的元数据
        size: chunk.metadata.size,
        lineCount: chunk.metadata.lineCount,
        timestamp: chunk.metadata.timestamp,
        hash: chunk.metadata.hash,
        
        // 重叠和上下文信息
        overlapInfo: chunk.metadata.overlapInfo,
        contextLines: chunk.metadata.contextLines,
        
        // 自定义字段
        customFields: this.extractCustomFields(chunk.metadata)
      },
      timestamp: new Date()
    }));
  }

  convertVectorToPoint(vector: Vector): VectorPoint {
    return VectorTypeConverter.toVectorPoint(vector);
  }

  convertPointToVector(point: VectorPoint): Vector {
    return VectorTypeConverter.fromVectorPoint(point);
  }

  /**
   * 使用代码转文本结果进行元数据enrichment
   */
  enrichVectorWithCodeToText(vector: Vector, textResult: CodeToTextResult): Vector {
    return {
      ...vector,
      metadata: VectorTypeConverter.enrichMetadataWithCodeToText(vector.metadata, textResult)
    };
  }

  /**
   * 提取自定义字段，排除已知的标准字段
   */
  private extractCustomFields(metadata: any): Record<string, any> {
    const customFields: Record<string, any> = {};
    const excludedFields = new Set([
      'filePath', 'language', 'startLine', 'endLine', 'type',
      'complexity', 'complexityAnalysis', 'nestingLevel', 'strategy',
      'isSignatureOnly', 'originalStructure', 'functionName', 'className',
      'astNodes', 'semanticBoundary', 'size', 'lineCount', 'timestamp', 'hash',
      'overlapInfo', 'contextLines'
    ]);
    
    for (const [key, value] of Object.entries(metadata)) {
      if (!excludedFields.has(key) && value !== undefined && value !== null) {
        customFields[key] = value;
      }
    }
    
    return customFields;
  }

  /**
   * 验证和过滤元数据
   */
  private validateAndFilterMetadata(metadata: any): any {
    const filtered: any = {};
    
    // 验证必需字段
    const requiredFields = ['filePath', 'language', 'startLine', 'endLine'];
    for (const field of requiredFields) {
      if (metadata[field] !== undefined && metadata[field] !== null) {
        filtered[field] = metadata[field];
      }
    }
    
    // 处理可选字段
    const optionalFields = [
      'complexity', 'complexityAnalysis', 'nestingLevel', 'strategy',
      'isSignatureOnly', 'originalStructure', 'functionName', 'className',
      'astNodes', 'semanticBoundary', 'size', 'lineCount', 'timestamp', 'hash',
      'overlapInfo', 'contextLines'
    ];
    
    for (const field of optionalFields) {
      if (metadata[field] !== undefined && metadata[field] !== null) {
        // 对于大型对象（如AST节点），考虑压缩或简化
        if (field === 'astNodes' && metadata[field] && typeof metadata[field] === 'object') {
          filtered[field] = this.compressAstNodes(metadata[field]);
        } else {
          filtered[field] = metadata[field];
        }
      }
    }
    
    return filtered;
  }

  /**
   * 压缩AST节点信息，保留关键数据
   */
  private compressAstNodes(astNodes: any): any {
    if (!astNodes || !Array.isArray(astNodes)) {
      return astNodes;
    }
    
    // 只保留关键信息，减少存储空间
    return astNodes.map(node => ({
      type: node.type,
      startPosition: node.startPosition,
      endPosition: node.endPosition,
      text: node.text ? node.text.substring(0, 100) + (node.text.length > 100 ? '...' : '') : undefined
    }));
  }

  private generateVectorId(chunk: CodeChunk, projectPath: string, index: number): string {
    const projectId = this.projectIdManager.getProjectId(projectPath) || '';
    const fileHash = this.hashFilePath(chunk.metadata.filePath || '');
    return `${projectId}_${fileHash}_${chunk.metadata.startLine}_${index}`;
  }

  private hashFilePath(filePath: string): string {
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}