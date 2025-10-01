import { injectable, inject } from 'inversify';
import { QdrantService } from '../../database/qdrant/QdrantService';
import { BaseEmbedder } from '../../embedders/BaseEmbedder';
import { FileVectorIndex, IndexingOptions } from './types';
import { LoggerService } from '../../utils/LoggerService';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { TYPES } from '../../types';
import path from 'path';
import { promises as fs } from 'fs';

/**
 * 文件向量索引器
 * 负责将文件信息转换为向量并存储到Qdrant中
 */
@injectable()
export class FileVectorIndexer {
  private readonly COLLECTION_NAME = 'file_vectors';

  constructor(
    @inject(TYPES.QdrantService) private qdrantService: QdrantService,
    @inject(TYPES.EmbedderFactory) private embedderFactory: EmbedderFactory,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) { }

  /**
   * 索引单个文件
   */
  async indexFile(filePath: string, projectId: string): Promise<void> {
    try {
      this.logger.debug(`开始索引文件: ${filePath}`);

      const fileName = path.basename(filePath);
      const directory = path.dirname(filePath);
      const extension = path.extname(fileName);

      // 获取文件状态
      const stats = await fs.stat(filePath);

      // 获取嵌入器实例
      const embedder = await this.embedderFactory.getEmbedder();

      // 生成向量
      const nameVectorResult = await embedder.embed({ text: fileName });
      const pathVectorResult = await embedder.embed({ text: filePath });
      const combinedVectorResult = await embedder.embed({ text: `${directory} ${fileName}` });

      // 提取向量数组
      const nameVector = Array.isArray(nameVectorResult) ? nameVectorResult[0].vector : nameVectorResult.vector;
      const pathVector = Array.isArray(pathVectorResult) ? pathVectorResult[0].vector : pathVectorResult.vector;
      const combinedVector = Array.isArray(combinedVectorResult) ? combinedVectorResult[0].vector : combinedVectorResult.vector;

      // 生成语义描述
      const semanticDescription = await this.generateSemanticDescription(fileName, directory);

      // 构建文件向量索引
      const fileIndex: FileVectorIndex = {
        id: this.generateFileId(filePath, projectId),
        projectId,
        filePath,
        fileName,
        directory,
        extension,
        nameVector,
        pathVector,
        combinedVector,
        semanticDescription,
        lastModified: stats.mtime,
        fileSize: stats.size,
        fileType: stats.isDirectory() ? 'directory' : 'file'
      };

      // 存储到Qdrant
      await this.qdrantService.upsertVectorsWithOptions(this.COLLECTION_NAME, [{
        id: fileIndex.id,
        vector: combinedVector,
        payload: {
          content: fileIndex.semanticDescription,
          filePath: fileIndex.filePath,
          language: fileIndex.fileType,
          chunkType: ['file'],
          startLine: 0,
          endLine: 0,
          metadata: {
            projectId: fileIndex.projectId,
            fileName: fileIndex.fileName,
            directory: fileIndex.directory,
            extension: fileIndex.extension,
            lastModified: fileIndex.lastModified.toISOString(),
            fileSize: fileIndex.fileSize
          },
          timestamp: fileIndex.lastModified
        }
      }]);

      this.logger.debug(`文件索引完成: ${filePath}`);
    } catch (error) {
      this.logger.error(`索引文件失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 批量索引文件
   */
  async indexFiles(filePaths: string[], projectId: string, options: IndexingOptions = {}): Promise<void> {
    const { batchSize = 100 } = options;

    this.logger.info(`开始批量索引 ${filePaths.length} 个文件`);

    // 分批处理
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      this.logger.debug(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(filePaths.length / batchSize)}`);

      // 并行处理每个批次
      const promises = batch.map(filePath =>
        this.indexFile(filePath, projectId).catch(error => {
          this.logger.warn(`索引文件失败，跳过: ${filePath}`, error);
          return null;
        })
      );

      await Promise.all(promises);
    }

    this.logger.info(`批量索引完成，共处理 ${filePaths.length} 个文件`);
  }

  /**
   * 删除文件索引
   */
  async deleteFileIndex(filePath: string, projectId: string): Promise<void> {
    try {
      const fileId = this.generateFileId(filePath, projectId);
      await this.qdrantService.deletePoints(this.COLLECTION_NAME, [fileId]);
      this.logger.debug(`删除文件索引: ${filePath}`);
    } catch (error) {
      this.logger.error(`删除文件索引失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 更新文件索引
   */
  async updateFileIndex(filePath: string, projectId: string): Promise<void> {
    await this.deleteFileIndex(filePath, projectId);
    await this.indexFile(filePath, projectId);
  }

  /**
   * 检查文件是否需要重新索引
   */
  async shouldReindex(filePath: string, projectId: string): Promise<boolean> {
    try {
      const fileId = this.generateFileId(filePath, projectId);
      const existingPoints = await this.qdrantService.scrollPoints(this.COLLECTION_NAME, {
        must: [
          {
            key: 'id',
            match: {
              value: fileId
            }
          }
        ]
      }, 1);
      const existing = existingPoints.length > 0 ? existingPoints[0] : null;

      if (!existing) {
        return true;
      }

      const stats = await fs.stat(filePath);
      const existingModified = new Date(existing.payload.lastModified as string);

      return stats.mtime.getTime() > existingModified.getTime();
    } catch (error) {
      // 如果获取失败，认为需要重新索引
      return true;
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
   * 生成语义描述
   */
  private async generateSemanticDescription(fileName: string, directory: string): Promise<string> {
    // 基于文件名和目录路径生成简单的语义描述
    // 在实际应用中，这里可以调用LLM生成更智能的描述

    const nameWithoutExt = path.basename(fileName, path.extname(fileName));
    const dirParts = directory.split(path.sep).filter(part => part && part !== '.');

    let description = `文件: ${fileName}`;

    // 基于目录结构添加语义信息
    if (dirParts.length > 0) {
      const lastDir = dirParts[dirParts.length - 1];
      description += `，位于${lastDir}目录`;
    }

    // 基于文件扩展名添加类型信息
    const ext = path.extname(fileName).toLowerCase();
    const fileTypeMap: Record<string, string> = {
      '.ts': 'TypeScript代码文件',
      '.js': 'JavaScript代码文件',
      '.py': 'Python代码文件',
      '.java': 'Java代码文件',
      '.cpp': 'C++代码文件',
      '.c': 'C代码文件',
      '.json': 'JSON配置文件',
      '.yaml': 'YAML配置文件',
      '.yml': 'YAML配置文件',
      '.xml': 'XML配置文件',
      '.md': 'Markdown文档',
      '.txt': '文本文件',
      '.config': '配置文件',
      '.env': '环境配置文件',
      '.dockerfile': 'Docker配置文件',
      '.gitignore': 'Git忽略文件',
      '.test.ts': 'TypeScript测试文件',
      '.spec.ts': 'TypeScript测试文件',
      '.test.js': 'JavaScript测试文件',
      '.spec.js': 'JavaScript测试文件'
    };

    if (fileTypeMap[ext]) {
      description += `，${fileTypeMap[ext]}`;
    } else if (ext) {
      description += `，${ext.substring(1).toUpperCase()}文件`;
    }

    // 基于文件名模式添加功能信息
    if (nameWithoutExt.toLowerCase().includes('config')) {
      description += '，可能是配置文件';
    } else if (nameWithoutExt.toLowerCase().includes('service')) {
      description += '，可能是服务类文件';
    } else if (nameWithoutExt.toLowerCase().includes('controller')) {
      description += '，可能是控制器文件';
    } else if (nameWithoutExt.toLowerCase().includes('model')) {
      description += '，可能是数据模型文件';
    } else if (nameWithoutExt.toLowerCase().includes('util')) {
      description += '，可能是工具类文件';
    } else if (nameWithoutExt.toLowerCase().includes('helper')) {
      description += '，可能是辅助类文件';
    } else if (nameWithoutExt.toLowerCase().includes('test')) {
      description += '，可能是测试文件';
    } else if (nameWithoutExt.toLowerCase().includes('spec')) {
      description += '，可能是测试文件';
    }

    return description;
  }

  /**
   * 初始化文件向量集合
   */
  async initializeCollection(): Promise<void> {
    try {
      // 检查集合是否存在
      const exists = await this.qdrantService.collectionExists(this.COLLECTION_NAME);

      if (!exists) {
        this.logger.info(`创建文件向量集合: ${this.COLLECTION_NAME}`);

        // 获取嵌入器实例
        const embedder = await this.embedderFactory.getEmbedder();

        // 创建集合，支持多向量搜索
        const vectorSize = await embedder.getDimensions();
        await this.qdrantService.createCollection(this.COLLECTION_NAME, vectorSize, 'Cosine');

        this.logger.info(`文件向量集合创建成功: ${this.COLLECTION_NAME}`);
      } else {
        this.logger.debug(`文件向量集合已存在: ${this.COLLECTION_NAME}`);
      }
    } catch (error) {
      this.logger.error(`初始化文件向量集合失败: ${this.COLLECTION_NAME}`, error);
      throw error;
    }
  }
}