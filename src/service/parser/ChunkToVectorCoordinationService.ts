import { injectable, inject } from 'inversify';
import { ASTCodeSplitter } from './splitting/ASTCodeSplitter';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { QdrantService } from '../../database/qdrant/QdrantService';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { VectorPoint } from '../../database/qdrant/IVectorStore';
import { EmbeddingInput } from '../../embedders/BaseEmbedder';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { CodeChunk } from './splitting/Splitter';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProcessingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  preserveFunctionBoundaries?: boolean;
  preserveClassBoundaries?: boolean;
  includeComments?: boolean;
  minChunkSize?: number;
  extractSnippets?: boolean;
  addOverlap?: boolean;
}

/**
 * 专门协调代码分段到向量嵌入转换的服务
 */
@injectable()
export class ChunkToVectorCoordinationService {
  private projectEmbedders: Map<string, string> = new Map(); // 存储项目对应的embedder

 constructor(
    @inject(TYPES.ASTCodeSplitter) private astSplitter: ASTCodeSplitter,
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager
  ) {}

  async processFileForEmbedding(filePath: string, projectPath: string, options?: ProcessingOptions): Promise<VectorPoint[]> {
    try {
      // 1. 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8');
      
      // 2. 检测语言
      const language = this.detectLanguage(filePath);
      
      // 3. 使用AST进行分段
      const codeChunks = await this.astSplitter.split(content, language, filePath);
      
      // 4. 转换为向量点
      const vectorPoints = await this.convertToVectorPoints(codeChunks, projectPath, options);
      
      return vectorPoints;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to process file for embedding: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ChunkToVectorCoordinationService', operation: 'processFileForEmbedding', filePath, projectPath }
      );
      throw error;
    }
  }

  private async convertToVectorPoints(chunks: CodeChunk[], projectPath: string, options?: ProcessingOptions): Promise<VectorPoint[]> {
    // 准备嵌入输入
    const embeddingInputs: EmbeddingInput[] = chunks.map(chunk => ({
      text: chunk.content,
      metadata: {
        ...chunk.metadata,
        filePath: chunk.metadata.filePath,
        language: chunk.metadata.language,
      }
    }));

    const projectId = this.projectIdManager.getProjectId(projectPath);
    const projectEmbedder = projectId ? this.projectEmbedders.get(projectId) || this.embedderFactory.getDefaultProvider() : this.embedderFactory.getDefaultProvider();
    const embeddingResults = await this.embedderFactory.embed(embeddingInputs, projectEmbedder);
    const results = Array.isArray(embeddingResults) ? embeddingResults : [embeddingResults];

    return results.map((result, index) => {
      const chunk = chunks[index];
      const fileId = `${chunk.metadata.filePath}_${chunk.metadata.startLine}-${chunk.metadata.endLine}`;
      const safeId = fileId
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/[:]/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 255);

      return {
        id: safeId,
        vector: result.vector,
        payload: {
          content: chunk.content,
          filePath: chunk.metadata.filePath || '',
          language: chunk.metadata.language || 'unknown',
          chunkType: [chunk.metadata.type || 'code'],
          startLine: chunk.metadata.startLine,
          endLine: chunk.metadata.endLine,
          functionName: chunk.metadata.functionName,
          className: chunk.metadata.className,
          snippetMetadata: {
            snippetType: chunk.metadata.type || 'code'
          },
          metadata: {
            ...chunk.metadata,
            model: result.model,
            dimensions: result.dimensions,
            processingTime: result.processingTime
          },
          timestamp: new Date(),
          projectId
        }
      };
    });
  }

  private detectLanguage(filePath: string): string {
    // 语言检测逻辑
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'cpp',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.md': 'markdown',
      '.json': 'json',
      '.xml': 'xml',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.sql': 'sql',
      '.sh': 'shell',
      '.bash': 'shell',
      '.zsh': 'shell',
      '.fish': 'shell',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.vue': 'vue',
      '.svelte': 'svelte'
    };

    return languageMap[ext] || 'unknown';
  }

  setProjectEmbedder(projectId: string, embedder: string): void {
    this.projectEmbedders.set(projectId, embedder);
  }
}