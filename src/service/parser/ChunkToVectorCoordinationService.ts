import { injectable, inject } from 'inversify';
import { ASTCodeSplitter } from './processing/strategies/implementations/ASTCodeSplitter';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { QdrantService } from '../../database/qdrant/QdrantService';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { VectorPoint } from '../../database/qdrant/IVectorStore';
import { EmbeddingInput } from '../../embedders/BaseEmbedder';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { CodeChunk } from './types';
import * as fs from 'fs/promises';
import { GuardCoordinator } from './guard/GuardCoordinator';
import { UniversalTextStrategy } from './processing/utils/UniversalTextStrategy';
import { BackupFileProcessor } from './detection/BackupFileProcessor';
import { VectorBatchOptimizer } from '../optimization/VectorBatchOptimizer';
import { LanguageDetectionService } from './detection/LanguageDetectionService';
import { DetectionService } from './detection/DetectionService';

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
  private languageDetectionService: LanguageDetectionService;

  constructor(
    @inject(TYPES.ASTCodeSplitter) private astSplitter: ASTCodeSplitter,
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectIdManager) private projectIdManager: ProjectIdManager,
    @inject(TYPES.ProcessingGuard) private processingGuard: GuardCoordinator,
    @inject(TYPES.UniversalTextStrategy) private universalTextSplitter: UniversalTextStrategy,
    @inject(TYPES.BackupFileProcessor) private backupFileProcessor: BackupFileProcessor,
    @inject(TYPES.VectorBatchOptimizer) private batchOptimizer: VectorBatchOptimizer,
    @inject(TYPES.DetectionService) private detectionService: DetectionService
  ) {
    this.languageDetectionService = new LanguageDetectionService(this.logger);
  }

  async processFileForEmbedding(filePath: string, projectPath: string, options?: ProcessingOptions): Promise<VectorPoint[]> {
    try {
      // 检查错误阈值
      if (this.processingGuard.shouldUseFallback()) {
        this.logger.info(`Using fallback processing for ${filePath} due to error threshold`);
        return this.processWithFallback(filePath, projectPath, options);
      }

      // 1. 读取文件内容
      const content = await fs.readFile(filePath, 'utf-8');

      // 2. 使用统一检测服务进行语言检测（一次性完成所有检测）
      const detectionResult = await this.detectionService.detectFile(filePath, content);
      const language = detectionResult.language;

      // 3. 优先尝试使用ASTCodeSplitter进行智能分段（防止重复）
      const astChunks = await this.splitWithASTCodeSplitter(content, filePath, language);
      if (astChunks.length > 0) {
        this.logger.info(`Using ASTCodeSplitter for ${filePath}, produced ${astChunks.length} chunks`);
        return await this.convertToVectorPoints(astChunks, projectPath, options);
      }

      // 4. 如果AST分段失败，使用优化的处理守卫（集成统一检测、策略选择和智能降级）
      const processingResult = await this.processingGuard.processFile(filePath, content);

      // 5. 如果需要降级处理，使用通用分段
      if (processingResult.fallbackReason) {
        this.logger.info(`File ${filePath} processed with fallback: ${processingResult.fallbackReason}`);
        return await this.processWithUniversalSplitter(filePath, content, projectPath, options);
      }

      // 6. 转换为向量点
      const vectorPoints = await this.convertToVectorPoints(processingResult.chunks, projectPath, options);

      return vectorPoints;
    } catch (error) {
      // 记录错误并清理
      this.processingGuard.recordError(error as Error, `processFileForEmbedding: ${filePath}`);

      // 使用降级方案
      try {
        return await this.processWithFallback(filePath, projectPath, options);
      } catch (fallbackError) {
        this.errorHandler.handleError(
          new Error(`Failed to process file for embedding: ${error instanceof Error ? error.message : String(error)}, fallback also failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`),
          { component: 'ChunkToVectorCoordinationService', operation: 'processFileForEmbedding', filePath, projectPath }
        );
        throw error;
      }
    }
  }

  /**
   * 使用ASTCodeSplitter进行智能代码分段
   */
  private async splitWithASTCodeSplitter(content: string, filePath: string, language: string | undefined): Promise<CodeChunk[]> {
    try {
      // 检查语言是否支持AST解析
      if (!language || !this.languageDetectionService.isLanguageSupportedForAST(language)) {
        return [];
      }

      // 使用ASTCodeSplitter进行分段
      const chunks = await this.astSplitter.split(content, filePath, language);

      this.logger.debug(`ASTCodeSplitter produced ${chunks.length} chunks for ${filePath}`);
      return chunks;
    } catch (error) {
      this.logger.warn(`ASTCodeSplitter failed for ${filePath}, falling back to universal splitter: ${error}`);
      return [];
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

    // 使用批处理优化器执行嵌入操作
    const projectId = this.projectIdManager.getProjectId(projectPath);
    const projectEmbedder = projectId ? this.projectEmbedders.get(projectId) || this.embedderFactory.getDefaultProvider() : this.embedderFactory.getDefaultProvider();

    const embeddingResults = await this.batchOptimizer.executeWithOptimalBatching(
      embeddingInputs,
      async (batch) => {
        return await this.embedderFactory.embed(batch, projectEmbedder);
      }
    );

    // 将多维数组结果展平
    const flattenedResults = embeddingResults.flat();

    return flattenedResults.map((result: any, index) => {
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
  /**
   * 智能语言检测 - 根据文件内容推断语言
   */
  private async detectLanguageByContent(filePath: string, content: string): Promise<string | undefined> {
    const detectionResult = await this.languageDetectionService.detectLanguage(filePath, content);
    return detectionResult.language;
  }

  private detectLanguage(filePath: string): string | undefined {
    return this.languageDetectionService.detectLanguageSync(filePath);
  }

  private async processWithFallback(filePath: string, projectPath: string, options?: ProcessingOptions): Promise<VectorPoint[]> {
    return await this.processWithUniversalSplitter(filePath, null, projectPath, options);
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
        chunks = await this.universalTextSplitter.chunkByBracketsAndLines(content, filePath);
      } else {
        // 对其他文件使用行分段（最安全的降级方案）
        chunks = await this.universalTextSplitter.chunkByLines(content, filePath);
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