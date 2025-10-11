import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { FileSystemTraversal, FileInfo } from '../../filesystem/FileSystemTraversal';
import * as path from 'path';

export interface FileTraversalOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
}

@injectable()
export class FileTraversalService {
  // 简单的缓存机制，缓存项目路径到文件列表的映射
  private fileCache: Map<string, { files: string[]; timestamp: number }> = new Map();
  // 缓存过期时间（5分钟）
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.FileSystemTraversal) private fileSystemTraversal: FileSystemTraversal
  ) {}

  /**
   * 获取项目中的所有文件
   */
  async getProjectFiles(projectPath: string, options?: FileTraversalOptions): Promise<string[]> {
    try {
      // 生成缓存键
      const cacheKey = this.generateCacheKey(projectPath, options);
      
      // 检查缓存
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        this.logger.debug(`[DEBUG] Returning cached file list for project: ${projectPath}`);
        return cachedResult;
      }

      this.logger.debug(`[DEBUG] Starting file traversal for project: ${projectPath}`, { projectPath });

      const traversalResult = await this.fileSystemTraversal.traverseDirectory(projectPath, {
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns
      });

      const files = traversalResult.files.map(file => file.path);
      this.logger.info(`Found ${files.length} files to process in project: ${projectPath}`);

      // Debug: Log traversal details
      this.logger.debug(`[DEBUG] Traversal completed for project: ${projectPath}`, {
        filesFound: files.length
      });

      // 缓存结果
      this.cacheResult(cacheKey, files);

      return files;
    } catch (error) {
      this.logger.error(`Failed to get project files for path: ${projectPath}`, { error });
      throw error;
    }
  }

  /**
   * 检查是否为代码文件
   * 复用 FileSystemTraversal 中的默认支持扩展名配置
   */
  isCodeFile(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    // 使用 FileSystemTraversal 的默认配置来判断是否为支持的代码文件
    return this.fileSystemTraversal.getSupportedExtensions().includes(ext);
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(projectPath: string, options?: FileTraversalOptions): string {
    // 创建一个包含项目路径和选项的字符串表示
    const optionsString = options ? JSON.stringify(options) : '';
    return `${projectPath}:${optionsString}`;
  }

  /**
   * 从缓存中获取结果
   */
  private getCachedResult(cacheKey: string): string[] | null {
    const cached = this.fileCache.get(cacheKey);
    
    // 检查缓存是否过期
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.files;
    }
    
    // 如果过期，删除缓存项
    if (cached) {
      this.fileCache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * 缓存结果
   */
  private cacheResult(cacheKey: string, files: string[]): void {
    this.fileCache.set(cacheKey, {
      files,
      timestamp: Date.now()
    });
    
    // 简单的缓存清理，避免内存泄漏
    if (this.fileCache.size > 100) {
      const firstKey = this.fileCache.keys().next().value;
      if (firstKey) {
        this.fileCache.delete(firstKey);
      }
    }
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.fileCache.clear();
  }
}