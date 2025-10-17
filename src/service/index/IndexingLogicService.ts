import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { FileSystemTraversal, FileInfo } from '../filesystem/FileSystemTraversal';
import { QdrantService } from '../../database/qdrant/QdrantService';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../embedders/EmbeddingCacheService';
import { PerformanceOptimizerService } from '../../infrastructure/batching/PerformanceOptimizerService';
import { VectorPoint } from '../../database/qdrant/IVectorStore';
import { EmbeddingInput } from '../../embedders/BaseEmbedder';
// Tree-sitter AST分段支持
import { ASTCodeSplitter } from '../parser/splitting/ASTCodeSplitter';
import { CodeChunk } from '../parser/splitting/types';
import { ChunkToVectorCoordinationService } from '../parser/ChunkToVectorCoordinationService';
import { ConcurrencyService } from './shared/ConcurrencyService';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IndexSyncOptions, BatchProcessingResult } from './IndexService';
import { IGraphService } from '../graph/core/IGraphService';
import { IGraphDataMappingService } from '../graph/mapping/IGraphDataMappingService';
import { GraphPersistenceResult } from '../graph/core/types';
import { PerformanceDashboard } from '../monitoring/PerformanceDashboard';
import { AutoOptimizationAdvisor } from '../optimization/AutoOptimizationAdvisor';
import { BatchProcessingOptimizer } from '../optimization/BatchProcessingOptimizer';

export interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
  timestamp: Date;
}

export interface IndexingMetrics {
  fileSize: number;
  chunkCount: number;
  processingTime: number;
  memoryUsage: MemoryUsage;
  embeddingTime?: number;
}

@injectable()
export class IndexingLogicService {
  @inject(TYPES.LoggerService) private logger!: LoggerService;
  @inject(TYPES.ErrorHandlerService) private errorHandler!: ErrorHandlerService;
  @inject(TYPES.FileSystemTraversal) private fileSystemTraversal!: FileSystemTraversal;
  @inject(TYPES.QdrantService) private qdrantService!: QdrantService;
  @inject(TYPES.GraphService) private graphService!: IGraphService; // 新增
  @inject(TYPES.GraphDataMappingService) private graphMappingService!: IGraphDataMappingService; // 新增
  @inject(TYPES.PerformanceDashboard) private performanceDashboard!: PerformanceDashboard; // 新增
  @inject(TYPES.AutoOptimizationAdvisor) private optimizationAdvisor!: AutoOptimizationAdvisor; // 暂时禁用
  // @inject(TYPES.BatchProcessingOptimizer) private batchProcessingOptimizer!: BatchProcessingOptimizer; // 暂时禁用
  @inject(TYPES.ProjectIdManager) private projectIdManager!: ProjectIdManager;
  @inject(TYPES.EmbedderFactory) private embedderFactory!: EmbedderFactory;
  @inject(TYPES.EmbeddingCacheService) private embeddingCacheService!: EmbeddingCacheService;
  @inject(TYPES.PerformanceOptimizerService) private performanceOptimizer!: PerformanceOptimizerService;
  @inject(TYPES.ASTCodeSplitter) private astSplitter!: ASTCodeSplitter;
  @inject(TYPES.ChunkToVectorCoordinationService) private coordinationService!: ChunkToVectorCoordinationService;
  @inject(TYPES.ConcurrencyService) private concurrencyService!: ConcurrencyService;

  /**
   * 索引项目
   */
  async indexProject(
    projectPath: string,
    options?: IndexSyncOptions,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    try {
      this.logger.debug(`[DEBUG] Starting file traversal for project: ${projectPath}`, { projectPath });

      // 获取项目中的所有文件
      const traversalResult = await this.performanceOptimizer.executeWithRetry(
        () => this.fileSystemTraversal.traverseDirectory(projectPath, {
          includePatterns: options?.includePatterns,
          excludePatterns: options?.excludePatterns
        }),
        'traverseDirectory'
      );

      const files = traversalResult.files;
      const totalFiles = files.length;
      this.logger.info(`Found ${files.length} files to index in project: ${projectPath}`);

      // Debug: Log traversal details
      this.logger.debug(`[DEBUG] Traversal completed for project: ${projectPath}`, {
        filesFound: files.length
      });

      // 处理每个文件
      const batchSize = options?.batchSize || this.performanceOptimizer.getCurrentBatchSize();
      const maxConcurrency = options?.maxConcurrency || 3;

      // 使用性能优化器批量处理文件
      const batchResults: BatchProcessingResult[] = await this.performanceOptimizer.processBatches(
        files,
        async (batch) => {
          const results: BatchProcessingResult[] = [];
          const promises = batch.map(async (file) => {
            const startTime = Date.now();
            try {
              await this.performanceOptimizer.executeWithRetry(
                () => this.indexFile(projectPath, file.path),
                `indexFile:${file.path}`
              );

              // 记录成功结果
              results.push({
                filePath: file.path,
                success: true,
                processingTime: Date.now() - startTime,
                error: undefined
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              this.logger.error(`Failed to index file: ${file.path}`, { error });

              // 记录失败结果
              results.push({
                filePath: file.path,
                success: false,
                processingTime: Date.now() - startTime,
                error: errorMessage
              });
            }
          });

          // 限制并发数
          await this.concurrencyService.processWithConcurrency(promises, maxConcurrency);

          // 调用进度回调
          if (onProgress) {
            const progress = Math.round((batch.length / totalFiles) * 100);
            onProgress(progress);
          }

          // 返回批处理结果以满足processBatches的返回类型要求
          return results;
        },
        'indexProjectFiles'
      );

      this.logger.info(`Completed indexing project: ${projectPath}`, {
        totalFiles: totalFiles
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to index project: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexingLogicService', operation: 'indexProject', projectPath }
      );
      throw error;
    }
  }

  /**
   * 获取嵌入器维度
   */
  async getEmbedderDimensions(embedderProvider: string): Promise<number> {
    let vectorDimensions = 1024; // 默认回退到SiliconFlow的1024维度

    try {
      // 尝试从嵌入器实例获取实际维度，这会验证提供者是否可用
      const providerInfo = await this.embedderFactory.getProviderInfo(embedderProvider);
      vectorDimensions = providerInfo.dimensions;
      this.logger.info(`Using embedder dimensions: ${vectorDimensions} for provider: ${providerInfo.name}`);
    } catch (error) {
      // 如果无法获取提供者信息，根据提供者类型使用环境变量中的默认值
      this.logger.warn(`Failed to get embedder dimensions from provider, falling back to env config: ${embedderProvider}`, { error });

      // 根据提供者设置默认维度
      switch (embedderProvider) {
        case 'openai':
          vectorDimensions = parseInt(process.env.OPENAI_DIMENSIONS || '1536');
          break;
        case 'ollama':
          vectorDimensions = parseInt(process.env.OLLAMA_DIMENSIONS || '768');
          break;
        case 'gemini':
          vectorDimensions = parseInt(process.env.GEMINI_DIMENSIONS || '768');
          break;
        case 'mistral':
          vectorDimensions = parseInt(process.env.MISTRAL_DIMENSIONS || '1024');
          break;
        case 'siliconflow':
          vectorDimensions = parseInt(process.env.SILICONFLOW_DIMENSIONS || '1024');
          break;
        case 'custom1':
          vectorDimensions = parseInt(process.env.CUSTOM_CUSTOM1_DIMENSIONS || '768');
          break;
        case 'custom2':
          vectorDimensions = parseInt(process.env.CUSTOM_CUSTOM2_DIMENSIONS || '768');
          break;
        case 'custom3':
          vectorDimensions = parseInt(process.env.CUSTOM_CUSTOM3_DIMENSIONS || '768');
          break;
        default:
          vectorDimensions = 1024; // 默认值
      }
    }

    return vectorDimensions;
  }

  /**
   * 存储文件数据到图数据库（新增方法）
   */
  private async storeFileToGraph(
    projectPath: string,
    filePath: string,
    fileContent: string,
    chunks: CodeChunk[]
  ): Promise<GraphPersistenceResult> {
    this.logger.debug('Storing file to graph database', { projectPath, filePath });

    try {
      // 创建文件ID
      const fileId = `file_${Buffer.from(filePath).toString('hex')}`;

      // 简化图数据存储逻辑（暂时禁用批处理优化器）
      const mappingResult = await this.graphMappingService.mapChunksToGraphNodes(chunks, fileId);

      // 准备图数据
      const graphData = {
        nodes: mappingResult.nodes,
        relationships: mappingResult.relationships
      };

      // 获取或生成项目ID，然后获取对应的空间名称
      let projectId = this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        // 如果项目ID不存在，先生成它（这将创建正确的空间名称映射）
        projectId = await this.projectIdManager.generateProjectId(projectPath);
      }
      const spaceName = this.projectIdManager.getSpaceName(projectId);

      // 存储到图数据库
      const result = await this.graphService.storeChunks([graphData], {
        projectId: spaceName,
        useCache: true
      });

      this.logger.debug('Successfully stored file to graph database', {
        filePath,
        nodesCreated: result.nodesCreated || 0,
        relationshipsCreated: result.relationshipsCreated || 0,
        processingTime: result.processingTime
      });

      // 记录性能指标到仪表板
      await this.performanceDashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'graph.store_time',
        value: result.processingTime,
        unit: 'milliseconds',
        tags: { filePath, projectPath }
      });

      return result || {
        success: true,
        nodesCreated: 0,
        relationshipsCreated: 0,
        nodesUpdated: 0,
        processingTime: 0,
        errors: []
      };
    } catch (error) {
      this.logger.error('Failed to store file to graph database', {
        filePath,
        error: (error as Error).message
      });

      // 记录错误到仪表板
      await this.performanceDashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'graph.store_error',
        value: 1,
        unit: 'count',
        tags: { filePath, projectPath, error: (error as Error).message }
      });

      throw error;
    }
  }

  /**
   * 索引单个文件（增强版，带性能监控和内存保护）
   */
  async indexFile(projectPath: string, filePath: string): Promise<void> {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    // 内存使用检查 - 如果内存使用超过85%，记录日志但不跳过处理
    if (initialMemory.heapUsed / initialMemory.heapTotal > 0.85) {
      this.logger.debug(`High memory usage detected for file: ${filePath}`, {
        memoryUsage: initialMemory,
        threshold: 0.85
      });
    }

    try {
      // 记录开始指标
      await this.performanceDashboard.recordMetric({
        timestamp: startTime,
        metricName: 'indexing.start_time',
        value: startTime,
        tags: { filePath, projectPath }
      });

      // 使用协调服务处理文件
      const vectorPoints = await this.coordinationService.processFileForEmbedding(filePath, projectPath);

      // 内存压力检查 - 在处理向量数据前检查内存
      const currentMemory = process.memoryUsage();
      if (currentMemory.heapUsed / currentMemory.heapTotal > 0.90) {
        this.logger.warn(`Memory pressure detected during file processing: ${filePath}`, {
          memoryUsage: currentMemory,
          heapUsedMB: currentMemory.heapUsed / 1024 / 1024,
          heapTotalMB: currentMemory.heapTotal / 1024 / 1024
        });
        // 强制垃圾回收
        if (global.gc) {
          global.gc();
        }
      }

      // 并行处理：向量数据存储和图数据存储
      const [qdrantResult, fileContent] = await Promise.all([
        // 存储到Qdrant向量数据库
        this.qdrantService.upsertVectorsForProject(projectPath, vectorPoints)
          .then(success => ({ success, type: 'qdrant' }))
          .catch(error => {
            this.logger.error(`Failed to store to Qdrant for file: ${filePath}`, {
              error: (error as Error).message
            });
            return { success: false, type: 'qdrant', error: (error as Error).message };
          }),
        // 读取文件内容用于图数据库存储
        fs.readFile(filePath, 'utf-8')
      ]);

      // 检查NEBULA_ENABLED环境变量，如果禁用则跳过图数据库存储
      const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
      let graphResult: { success: boolean; error?: string } = { success: true }; // 默认为成功，因为图数据库可能被禁用

      if (nebulaEnabled) {
        // 存储到图数据库
        try {
          const graphPersistenceResult = await this.storeFileToGraph(
            projectPath,
            filePath,
            fileContent,
            [] // 传入空数组，因为我们已经在上面处理了图数据存储
          );
          graphResult = { success: graphPersistenceResult.success };
        } catch (graphError) {
          this.logger.error(`Failed to store to graph database for file: ${filePath}`, {
            error: (graphError as Error).message
          });
          graphResult = { success: false, error: (graphError as Error).message };
        }
      } else {
        // 如果Nebula被禁用，记录信息
        this.logger.debug('Nebula graph database is disabled via NEBULA_ENABLED environment variable, skipping graph storage for file', {
          filePath,
          projectPath
        });
      }

      // 检查数据一致性
      if (!qdrantResult.success) {
        throw new Error(`Failed to store vectors for file: ${filePath}: ${'error' in qdrantResult ? qdrantResult.error : 'Unknown error'}`);
      }

      const processingTime = Date.now() - startTime;
      const finalMemory = process.memoryUsage();

      // 记录性能指标
      const metrics: IndexingMetrics = {
        fileSize: (await fs.stat(filePath)).size,
        chunkCount: vectorPoints.length,
        processingTime,
        memoryUsage: {
          used: finalMemory.heapUsed - initialMemory.heapUsed,
          total: finalMemory.heapTotal,
          percentage: ((finalMemory.heapUsed - initialMemory.heapUsed) / initialMemory.heapTotal) * 100,
          timestamp: new Date()
        }
      };

      this.recordMetrics(filePath, metrics);

      // 记录到性能仪表板
      await this.performanceDashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'indexing.processing_time',
        value: processingTime,
        unit: 'milliseconds',
        tags: { filePath, projectPath }
      });

      await this.performanceDashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'indexing.memory_usage',
        value: metrics.memoryUsage.percentage,
        unit: 'percentage',
        tags: { filePath, projectPath }
      });

      await this.performanceDashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'indexing.chunk_count',
        value: vectorPoints.length,
        unit: 'count',
        tags: { filePath, projectPath }
      });

      // 内存警告检查
      if (metrics.memoryUsage.percentage > 80) {
        this.logger.warn(`High memory usage detected for file: ${filePath}`, {
          memoryUsage: metrics.memoryUsage,
          threshold: 80
        });

        // 记录内存警告到仪表板
        await this.performanceDashboard.recordMetric({
          timestamp: Date.now(),
          metricName: 'indexing.memory_warning',
          value: 1,
          unit: 'count',
          tags: { filePath, projectPath, memoryUsage: metrics.memoryUsage.percentage.toString() }
        });
      }

      this.logger.debug(`Indexed file: ${filePath}`, {
        metrics,
        qdrantSuccess: qdrantResult.success,
        graphSuccess: graphResult.success
      });

      // 生成优化建议（异步，不阻塞主流程）- 内存泄漏修复
      // 使用 process.nextTick 替代 setImmediate 以更好地控制执行时机
      setImmediate(async () => {
        try {
          await this.optimizationAdvisor.analyzeAndRecommend();
        } catch (advisorError) {
          this.logger.warn('Failed to generate optimization recommendations', {
            error: (advisorError as Error).message
          });
        } finally {
          // 手动触发垃圾回收（如果可用）
          if (global.gc) {
            global.gc();
          }
        }
      });

    } catch (error) {
      this.recordError(filePath, error);

      // 记录错误到性能仪表板
      await this.performanceDashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'indexing.error',
        value: 1,
        unit: 'count',
        tags: { filePath, projectPath, error: (error as Error).message }
      });

      this.errorHandler.handleError(
        new Error(`Failed to index file: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexingLogicService', operation: 'indexFile', projectPath, filePath }
      );
      throw error;
    }
  }

  /**
   * 从索引中删除文件
   */
  async removeFileFromIndex(projectPath: string, filePath: string): Promise<void> {
    try {
      const projectId = this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project ID not found for path: ${projectPath}`);
      }

      const collectionName = this.projectIdManager.getCollectionName(projectId);
      if (!collectionName) {
        throw new Error(`Collection name not found for project: ${projectId}`);
      }

      // 获取文件的所有块ID
      const chunkIds = await this.qdrantService.getChunkIdsByFiles(collectionName, [filePath]);

      if (chunkIds.length > 0) {
        // 删除这些块
        const success = await this.qdrantService.deletePoints(collectionName, chunkIds);

        if (!success) {
          throw new Error(`Failed to delete chunks for file: ${filePath}`);
        }

        this.logger.debug(`Removed file from index: ${filePath}`, { chunks: chunkIds.length });
      }
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to remove file from index: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexingLogicService', operation: 'removeFileFromIndex', projectPath, filePath }
      );
      throw error;
    }
  }

  /**
   * 获取项目当前索引的文件列表
   */
  async getIndexedFiles(projectPath: string): Promise<string[]> {
    try {
      const projectId = this.projectIdManager.getProjectId(projectPath);
      if (!projectId) {
        throw new Error(`Project ID not found for path: ${projectPath}`);
      }

      const collectionName = this.projectIdManager.getCollectionName(projectId);
      if (!collectionName) {
        throw new Error(`Collection name not found for project: ${projectId}`);
      }

      // 使用scrollPoints方法获取所有点，然后解析出文件路径
      const allPoints = await this.qdrantService.scrollPoints(collectionName);
      const fileSet = new Set<string>();

      for (const point of allPoints) {
        if (point.payload && point.payload.file_path) {
          fileSet.add(point.payload.file_path as string);
        }
      }

      return Array.from(fileSet);
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to get indexed files: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'IndexingLogicService', operation: 'getIndexedFiles', projectPath }
      );
      throw error;
    }
  }

  /**
   * 记录性能指标
   */
  async recordMetrics(filePath: string, metrics: IndexingMetrics): Promise<void> {
    this.logger.debug(`Indexing metrics for ${filePath}:`, { metrics });
  }

  /**
   * 记录错误信息
   */
  recordError(filePath: string, error: any): void {
    this.logger.error(`Indexing error for ${filePath}:`, { error });
  }

  /**
   * 清理未完成的定时器和immediate对象
   */
  async cleanup(): Promise<void> {
    // 强制垃圾回收
    if (global.gc) {
      global.gc();
    }
  }
}