import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { Vector } from '../types/VectorTypes';
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
        projectId,
        filePath: chunk.metadata.filePath,
        language: chunk.metadata.language,
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine,
        chunkType: ['code']
      },
      timestamp: new Date()
    }));
  }

  convertVectorToPoint(vector: Vector): VectorPoint {
    return {
      id: vector.id,
      vector: vector.vector,
      payload: {
        content: vector.content,
        filePath: vector.metadata.filePath || '',
        language: vector.metadata.language || '',
        chunkType: vector.metadata.chunkType || [],
        startLine: vector.metadata.startLine || 0,
        endLine: vector.metadata.endLine || 0,
        functionName: vector.metadata.functionName,
        className: vector.metadata.className,
        snippetMetadata: vector.metadata.snippetMetadata,
        metadata: vector.metadata.customFields || {},
        timestamp: vector.timestamp,
        projectId: vector.metadata.projectId
      }
    };
  }

  convertPointToVector(point: VectorPoint): Vector {
    return {
      id: point.id as string,
      vector: point.vector,
      content: point.payload.content,
      metadata: {
        projectId: point.payload.projectId || '',
        filePath: point.payload.filePath,
        language: point.payload.language,
        chunkType: point.payload.chunkType,
        startLine: point.payload.startLine,
        endLine: point.payload.endLine,
        functionName: point.payload.functionName,
        className: point.payload.className,
        snippetMetadata: point.payload.snippetMetadata,
        customFields: point.payload.metadata
      },
      timestamp: point.payload.timestamp
    };
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