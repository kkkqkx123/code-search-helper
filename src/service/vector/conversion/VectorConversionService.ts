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

    return chunks.map((chunk, index) => ({
      id: this.generateVectorId(chunk, projectPath, index),
      values: embeddings[index],
      metadata: {
        content: chunk.content,
        filePath: chunk.metadata.filePath,
        language: chunk.metadata.language,
        startLine: chunk.metadata.startLine,
        endLine: chunk.metadata.endLine,
        chunkType: ['code'],
        strategy: chunk.metadata.strategy,
        timestamp: new Date()
      }
    }));
  }

  convertVectorToPoint(vector: Vector): VectorPoint {
    return {
      id: vector.id,
      vector: vector.values,
      payload: vector.metadata
    };
  }

  convertPointToVector(point: VectorPoint): Vector {
    return {
      id: point.id,
      values: point.vector,
      metadata: point.payload
    };
  }

  private generateVectorId(chunk: CodeChunk, projectPath: string, index: number): string {
    const projectId = this.projectIdManager.getProjectId(projectPath);
    const fileHash = this.hashFilePath(chunk.metadata.filePath);
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