import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { FileSystemTraversal, FileInfo } from '../filesystem/FileSystemTraversal';
import { QdrantService } from '../../database/qdrant/QdrantService';
import { NebulaClient } from '../../database/nebula/client/NebulaClient';
import { INebulaProjectManager } from '../../database/nebula/NebulaProjectManager';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../embedders/EmbeddingCacheService';
import { BatchProcessingService } from '../../infrastructure/batching/BatchProcessingService';
import { PerformanceOptimizerService } from '../../infrastructure/batching/PerformanceOptimizerService';
import { VectorPoint } from '../../database/qdrant/IVectorStore';
import { EmbeddingInput } from '../../embedders/BaseEmbedder';
// Tree-sitter AST分段支持
import { ASTCodeSplitter } from '../parser/processing/strategies/implementations/ASTCodeSplitter';
import { CodeChunk } from '../parser/types';
import { ChunkToVectorCoordinationService } from '../parser/ChunkToVectorCoordinationService';
import { ConcurrencyService } from './shared/ConcurrencyService';
import * as fs from 'fs/promises';
import { IndexSyncOptions, BatchProcessingResult } from './IndexService';
import { IGraphConstructionService } from '../graph/construction/IGraphConstructionService';
import { GraphPersistenceResult } from '../graph/core/types';
import { PerformanceDashboard } from '../monitoring/PerformanceDashboard';
import { AutoOptimizationAdvisor } from '../optimization/AutoOptimizationAdvisor';
import { BatchProcessingOptimizer } from '../optimization/BatchProcessingOptimizer';
import { TreeSitterService } from '../parser/core/parse/TreeSitterService';
import { TreeSitterQueryEngine } from '../parser/core/query/TreeSitterQueryExecutor';
import { NebulaNode, NebulaRelationship } from '../../database/nebula/NebulaTypes';
import { StandardizedQueryResult } from '../parser/core/normalization/types';
import { MetadataBuilder, MetadataFactory } from '../parser/core/normalization/utils/MetadataBuilder';

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
  @inject(TYPES.GraphConstructionService) private graphConstructionService!: IGraphConstructionService; // 新增
  @inject(TYPES.PerformanceDashboard) private performanceDashboard!: PerformanceDashboard; // 新增
  @inject(TYPES.AutoOptimizationAdvisor) private optimizationAdvisor!: AutoOptimizationAdvisor; // 暂时禁用
  @inject(TYPES.BatchProcessingOptimizer) private batchProcessingOptimizer!: BatchProcessingOptimizer;
  @inject(TYPES.ProjectIdManager) private projectIdManager!: ProjectIdManager;
  @inject(TYPES.EmbedderFactory) private embedderFactory!: EmbedderFactory;
  @inject(TYPES.EmbeddingCacheService) private embeddingCacheService!: EmbeddingCacheService;
  @inject(TYPES.PerformanceOptimizerService) private performanceOptimizer!: PerformanceOptimizerService;
  @inject(TYPES.ASTCodeSplitter) private astSplitter!: ASTCodeSplitter;
  @inject(TYPES.ChunkToVectorCoordinationService) private coordinationService!: ChunkToVectorCoordinationService;
  @inject(TYPES.ConcurrencyService) private concurrencyService!: ConcurrencyService;
  @inject(TYPES.TreeSitterService) private treeSitterService!: TreeSitterService;
  @inject(TYPES.TreeSitterQueryEngine) private treeSitterQueryEngine!: TreeSitterQueryEngine;

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
        async (batch: any[]) => {
          const results: BatchProcessingResult[] = [];
          const promises = batch.map(async (file: { path: string; }) => {
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
                error: undefined,
                chunks: []
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              this.logger.error(`Failed to index file: ${file.path}`, { error });

              // 记录失败结果
              results.push({
                filePath: file.path,
                success: false,
                processingTime: Date.now() - startTime,
                error: errorMessage,
                chunks: []
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
   * 存储文件数据到图数据库（使用新的 GraphConstructionService）
   */
  private async storeFileToGraph(
    projectPath: string,
    filePath: string,
    fileContent: string,
    chunks: CodeChunk[]
  ): Promise<GraphPersistenceResult> {
    this.logger.debug('Storing file to graph database', { projectPath, filePath });

    try {
      // 使用 GraphConstructionService 构建图结构
      const graphData = await this.graphConstructionService.buildGraphStructure([filePath], projectPath);

      this.logger.debug('Successfully built graph structure', {
        filePath,
        nodesCreated: graphData.nodes.length,
        relationshipsCreated: graphData.relationships.length
      });

      // 记录性能指标到仪表板
      await this.performanceDashboard.recordMetric({
        timestamp: Date.now(),
        metricName: 'graph.store_time',
        value: 0, // GraphConstructionService 内部已经记录了时间
        unit: 'milliseconds',
        tags: { filePath, projectPath }
      });

      return {
        success: true,
        nodesCreated: graphData.nodes.length,
        relationshipsCreated: graphData.relationships.length,
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
   * 索引文件到图数据库（使用新的 GraphConstructionService）
   */
  async indexFileToGraph(projectPath: string, filePath: string): Promise<void> {
    try {
      // 使用 GraphConstructionService 构建图结构
      const graphData = await this.graphConstructionService.buildGraphStructure([filePath], projectPath);

      this.logger.info(`Successfully indexed file to graph: ${filePath}`, {
        nodeCount: graphData.nodes.length,
        edgeCount: graphData.relationships.length
      });

    } catch (error) {
      this.logger.error(`Failed to index file to graph: ${filePath}`, error);
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
   * 将查询结果转换为标准化格式
   * @param queryResults 查询结果
   * @returns 标准化查询结果
   */
  private convertQueryResultsToStandardized(queryResults: any[]): StandardizedQueryResult[] {
    return queryResults.map(result => {
      const builder = MetadataFactory.createBasic(
        result.language || 'unknown',
        result.complexity || 0
      );

      return {
        nodeId: result.id || `node_${Date.now()}_${Math.random()}`,
        name: result.name || result.type || 'unknown',
        type: this.mapQueryResultTypeToStandardized(result.type),
        startLine: result.startLine || 0,
        endLine: result.endLine || 0,
        content: result.content || '',
        metadata: builder
          .addDependencies(result.dependencies || [])
          .addModifiers(result.modifiers || [])
          .addCustomField('extra', result.extra || result.properties || {})
          .build()
      };
    });
  }

  /**
   * 将查询结果类型映射到标准化类型
   * @param queryType 查询结果类型
   * @returns 标准化类型
   */
  private mapQueryResultTypeToStandardized(queryType: string): StandardizedQueryResult['type'] {
    const typeMapping: Record<string, StandardizedQueryResult['type']> = {
      'function': 'function',
      'method': 'method',
      'class': 'class',
      'interface': 'interface',
      'variable': 'variable',
      'import': 'import',
      'export': 'export',
      'call': 'call',
      'call_expression': 'call',
      'method_invocation': 'call',
      'inheritance': 'inheritance',
      'extends': 'inheritance',
      'implements': 'implements',
      'dependency': 'dependency',
      'data-flow': 'data-flow',
      'control-flow': 'control-flow',
      'semantic': 'semantic',
      'lifecycle': 'lifecycle',
      'concurrency': 'concurrency',
      'reference': 'dependency',
      'creation': 'dependency',
      'annotation': 'dependency'
    };

    return typeMapping[queryType] || 'variable';
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