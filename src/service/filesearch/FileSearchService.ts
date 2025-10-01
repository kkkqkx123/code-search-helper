import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { QdrantService } from '../../database/qdrant/QdrantService';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { LoggerService } from '../../utils/LoggerService';
import { FileVectorIndexer } from './FileVectorIndexer';
import { FileQueryProcessor } from './FileQueryProcessor';
import { FileSearchCache } from './FileSearchCache';
import {
  FileSearchRequest,
  FileSearchResponse,
  FileVectorIndex,
  FileSearchResult,
  FileSearchOptions,
  IndexingOptions
} from './types';
import { BaseEmbedder } from '../../embedders/BaseEmbedder';

/**
 * 文件搜索服务
 * 提供智能文件搜索功能
 */
@injectable()
export class FileSearchService {
  private queryProcessor: FileQueryProcessor;
  private cache: FileSearchCache;
  private isInitialized = false;

  constructor(
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {
    this.cache = new FileSearchCache({
      maxSize: 1000,
      defaultTTL: 5 * 60 * 1000, // 5分钟
      cleanupInterval: 60 * 1000 // 1分钟
    }, logger);

    this.queryProcessor = new FileQueryProcessor(this, this.embedderFactory, logger);
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('初始化文件搜索服务...');

      // 确保向量数据库连接
      await this.qdrantService.initialize();

      // 创建必要的集合
      await this.createCollections();

      this.isInitialized = true;
      this.logger.info('文件搜索服务初始化完成');
    } catch (error) {
      this.logger.error('文件搜索服务初始化失败', error);
      throw error;
    }
  }

  /**
   * 搜索文件
   */
  async search(request: FileSearchRequest): Promise<FileSearchResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info(`搜索文件: ${request.query}`);

      // 生成缓存键
      const cacheKey = this.cache.generateKey(request.query, request.options);

      // 检查缓存
      const cachedResults = await this.cache.get(cacheKey);
      if (cachedResults) {
        this.logger.debug(`缓存命中: ${request.query}`);
        return {
          results: cachedResults,
          total: cachedResults.length,
          queryType: 'HYBRID_QUERY', // 使用HYBRID_QUERY替代不存在的CACHED类型
          processingTime: 0,
          hasMore: false
        };
      }

      // 处理查询
      const response = await this.queryProcessor.processQuery(request);

      // 缓存结果
      if (response.results.length > 0) {
        await this.cache.set(cacheKey, response.results);
      }

      return response;
    } catch (error) {
      this.logger.error(`文件搜索失败: ${request.query}`, error);
      throw error;
    }
  }

  /**
   * 向量搜索
   */
  async vectorSearch(
    queryVector: number[],
    vectorField: string,
    options?: any
  ): Promise<FileSearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.debug(`执行向量搜索: ${vectorField}`);

      const searchResults = await this.qdrantService.searchVectors(
        'file_vectors',
        queryVector,
        {
          limit: options?.maxResults || 50,
          scoreThreshold: options?.minScore || 0.7,
          withPayload: true,
          withVector: false,
          filter: options?.filter
        }
      );

      // 转换结果为文件搜索结果格式
      return searchResults.map((result: any) => ({
        filePath: result.payload?.filePath || '',
        fileName: result.payload?.fileName || '',
        directory: result.payload?.directory || '',
        extension: result.payload?.extension || '',
        relevanceScore: result.score || 0,
        semanticDescription: result.payload?.semanticDescription || '',
        fileSize: result.payload?.size || 0,
        lastModified: result.payload?.lastModified || null
      }));
    } catch (error) {
      this.logger.error(`向量搜索失败`, error);
      throw error;
    }
  }

  /**
   * 索引文件
   */
  async indexFile(filePath: string, projectId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.debug(`索引文件: ${filePath}`);

      const embedder = await this.embedderFactory.getEmbedder() as BaseEmbedder;
      const indexer = new FileVectorIndexer(this.qdrantService, embedder, this.logger);
      await indexer.indexFile(filePath, projectId);

      // 清除相关缓存
      await this.clearRelatedCache(filePath);

    } catch (error) {
      this.logger.error(`文件索引失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 批量索引文件
   */
  async indexFiles(files: Array<{ path: string; content: string }>, projectId: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info(`批量索引文件: ${files.length} 个文件`);

      const embedder = await this.embedderFactory.getEmbedder() as BaseEmbedder;
      const indexer = new FileVectorIndexer(this.qdrantService, embedder, this.logger);
      const filePaths = files.map(file => file.path);
      await indexer.indexFiles(filePaths, projectId);

      // 清除相关缓存
      for (const file of files) {
        await this.clearRelatedCache(file.path);
      }

    } catch (error) {
      this.logger.error(`批量文件索引失败`, error);
      throw error;
    }
  }

  /**
   * 删除文件索引
   */
  async deleteFileIndex(filePath: string, projectId?: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.debug(`删除文件索引: ${filePath}`);

      // 生成文件ID
      const fileId = projectId ? this.generateFileId(filePath, projectId) : filePath;

      // 从向量数据库中删除
      await this.qdrantService.deletePoints('file_vectors', [fileId]);

      // 清除相关缓存
      await this.clearRelatedCache(filePath);

    } catch (error) {
      this.logger.error(`删除文件索引失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 更新文件索引
   */
  async updateFileIndex(filePath: string, projectId: string): Promise<void> {
    try {
      // 先删除旧索引，再创建新索引
      await this.deleteFileIndex(filePath, projectId);
      await this.indexFile(filePath, projectId);

      this.logger.debug(`更新文件索引: ${filePath}`);
    } catch (error) {
      this.logger.error(`更新文件索引失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * 清空缓存
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
    this.logger.info('文件搜索缓存已清空');
  }

  /**
   * 销毁服务
   */
  async destroy(): Promise<void> {
    try {
      this.logger.info('销毁文件搜索服务...');

      this.cache.destroy();
      this.isInitialized = false;

      this.logger.info('文件搜索服务已销毁');
    } catch (error) {
      this.logger.error('文件搜索服务销毁失败', error);
      throw error;
    }
  }

  // 私有方法

  /**
   * 创建必要的集合
   */
  private async createCollections(): Promise<void> {
    try {
      // 创建文件向量集合
      const fileVectorsCollection = {
        name: 'file_vectors',
        vectors: {
          size: 768, // 向量维度，根据嵌入模型调整
          distance: 'Cosine'
        }
      };

      await this.qdrantService.createCollection('file_vectors', 768);
      this.logger.debug('文件向量集合已创建');

    } catch (error) {
      // 如果集合已存在，忽略错误
      if (error instanceof Error && error.message?.includes('already exists')) {
        this.logger.debug('文件向量集合已存在');
      } else {
        throw error;
      }
    }
  }

  /**
   * 生成文件ID
   */
  private generateFileId(filePath: string, projectId: string): string {
    // 使用项目ID和文件路径的哈希值作为唯一ID
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(`${projectId}:${filePath}`).digest('hex');
  }

  /**
   * 清除相关缓存
   */
  private async clearRelatedCache(filePath: string): Promise<void> {
    try {
      // 这里可以实现更智能的缓存清除逻辑
      // 例如，清除包含该文件路径的搜索缓存
      this.logger.debug(`清除相关缓存: ${filePath}`);
    } catch (error) {
      this.logger.warn(`清除缓存失败: ${filePath}`, error);
    }
  }
}