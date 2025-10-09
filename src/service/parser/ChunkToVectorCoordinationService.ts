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
import { ProcessingGuard } from './universal/ProcessingGuard';
import { UniversalTextSplitter } from './universal/UniversalTextSplitter';
import { BackupFileProcessor } from './universal/BackupFileProcessor';
import { ExtensionlessFileProcessor } from './universal/ExtensionlessFileProcessor';

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
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.ProcessingGuard) private processingGuard: ProcessingGuard,
    @inject(TYPES.UniversalTextSplitter) private universalTextSplitter: UniversalTextSplitter,
    @inject(TYPES.BackupFileProcessor) private backupFileProcessor: BackupFileProcessor,
    @inject(TYPES.ExtensionlessFileProcessor) private extensionlessFileProcessor: ExtensionlessFileProcessor
  ) { }

  async processFileForEmbedding(filePath: string, projectPath: string, options?: ProcessingOptions): Promise<VectorPoint[]> {
    try {
      // 检查错误阈值
      if (this.processingGuard.shouldUseFallback()) {
        this.logger.info(`Using fallback processing for ${filePath} due to error threshold`);
        return this.processWithFallback(filePath, projectPath, options);
      }
      
      // 1. 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8');
      
      // 2. 智能处理文件（集成备份文件、无扩展名文件等处理）
      const processingResult = await this.processingGuard.processFile(filePath, content);
      
      // 3. 如果需要降级处理，使用通用分段
      if (processingResult.fallbackReason) {
        this.logger.info(`File ${filePath} processed with fallback: ${processingResult.fallbackReason}`);
        return this.processWithUniversalSplitter(filePath, content, projectPath, options);
      }
      
      // 4. 转换为向量点
      const vectorPoints = await this.convertToVectorPoints(processingResult.chunks, projectPath, options);
      
      return vectorPoints;
    } catch (error) {
      // 记录错误并清理
      this.processingGuard.recordError(error as Error, `processFileForEmbedding: ${filePath}`);
      
      // 使用降级方案
      try {
        return this.processWithFallback(filePath, projectPath, options);
      } catch (fallbackError) {
        this.errorHandler.handleError(
          new Error(`Failed to process file for embedding: ${error instanceof Error ? error.message : String(error)}, fallback also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`),
          { component: 'ChunkToVectorCoordinationService', operation: 'processFileForEmbedding', filePath, projectPath }
        );
        throw error;
      }
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
    // 语言检测逻辑 - 改进版本，考虑文件内容
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

  /**
   * 智能语言检测 - 根据文件内容推断语言
   * @param filePath 文件路径
   * @param content 文件内容
   * @returns 检测到的语言
   */
  private async detectLanguageByContent(filePath: string, content: string): Promise<string> {
    // 首先尝试通过文件扩展名检测
    const ext = path.extname(filePath).toLowerCase();
    const languageByExt = this.detectLanguage(filePath);

    // 如果是通用扩展名（如.md）或未知类型，尝试基于内容检测
    if (languageByExt === 'markdown' || languageByExt === 'unknown') {
      // 检查内容是否包含特定语言的特征
      const firstFewLines = content.substring(0, Math.min(200, content.length)).toLowerCase();

      // 检查是否包含typescript/javascript特征
      if (firstFewLines.includes('import') || firstFewLines.includes('export') ||
        firstFewLines.includes('function') || firstFewLines.includes('const') ||
        firstFewLines.includes('let') || firstFewLines.includes('var') ||
        firstFewLines.includes('interface') || firstFewLines.includes('type ') ||
        firstFewLines.includes('declare') || firstFewLines.includes('enum ')) {
        return 'typescript';
      }

      // 检查是否包含python特征
      if (firstFewLines.includes('import ') || firstFewLines.includes('from ') ||
        firstFewLines.includes('def ') || firstFewLines.includes('class ')) {
        return 'python';
      }

      // 检查是否包含java特征
      if (firstFewLines.includes('public ') || firstFewLines.includes('private ') ||
        firstFewLines.includes('class ') || firstFewLines.includes('import ') ||
        firstFewLines.includes('package ')) {
        return 'java';
      }
    }

    return languageByExt;
  }

  private processWithFallback(filePath: string, projectPath: string, options?: ProcessingOptions): Promise<VectorPoint[]> {
    return this.processWithUniversalSplitter(filePath, null, projectPath, options);
  }

  private async processWithUniversalSplitter(
    filePath: string,
    content: string | null,
    projectPath: string,
    options?: ProcessingOptions
  ): Promise<VectorPoint[]> {
    try {
      // 如果内容为空，读取文件
      if (content === null) {
        content = await fs.readFile(filePath, 'utf-8');
      }

      // 使用通用分段器进行分段
      let chunks: CodeChunk[];
      if (this.backupFileProcessor.isBackupFile(filePath)) {
        // 对备份文件使用括号平衡分段
        chunks = this.universalTextSplitter.chunkByBracketsAndLines(content, filePath);
      } else {
        // 对其他文件使用行分段（最安全的降级方案）
        chunks = this.universalTextSplitter.chunkByLines(content, filePath);
      }

      return await this.convertToVectorPoints(chunks, projectPath, options);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Fallback processing failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'ChunkToVectorCoordinationService', operation: 'processWithFallback', filePath, projectPath }
      );
      throw error;
    }
  }

  setProjectEmbedder(projectId: string, embedder: string): void {
    this.projectEmbedders.set(projectId, embedder);
  }
}