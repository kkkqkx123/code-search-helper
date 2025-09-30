import { Router, Request, Response } from 'express';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../types';
import { FileSearchService } from '../../service/filesearch/FileSearchService';
import { LoggerService } from '../../utils/LoggerService';
import { FileSearchRequest, FileSearchResponse } from '../../service/filesearch/types';

/**
 * 文件搜索路由
 */
@injectable()
export class FileSearchRoutes {
  private router: Router;

  constructor(
    @inject(TYPES.FileSearchService) private fileSearchService: FileSearchService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {
    this.router = Router();
    this.setupRoutes();
  }

  /**
   * 获取路由器实例
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 文件搜索
    this.router.post('/search', this.searchFiles.bind(this));
    
    // 智能文件搜索（推荐）
    this.router.post('/smart-search', this.smartSearchFiles.bind(this));
    
    // 获取搜索建议
    this.router.get('/suggestions', this.getSearchSuggestions.bind(this));
    
    // 获取缓存统计
    this.router.get('/cache-stats', this.getCacheStats.bind(this));
    
    // 清空缓存
    this.router.delete('/cache', this.clearCache.bind(this));
    
    // 文件索引操作
    this.router.post('/index', this.indexFile.bind(this));
    this.router.post('/index-batch', this.indexFiles.bind(this));
    this.router.delete('/index/:filePath(*)', this.deleteFileIndex.bind(this));
    
    this.logger.info('文件搜索路由已设置');
  }

  /**
   * 文件搜索
   */
  private async searchFiles(req: Request, res: Response): Promise<void> {
    try {
      const request: FileSearchRequest = {
        query: req.body.query,
        projectId: req.body.projectId,
        options: req.body.options || {}
      };

      if (!request.query || typeof request.query !== 'string') {
        res.status(400).json({
          success: false,
          error: '查询参数不能为空'
        });
        return;
      }

      this.logger.info(`文件搜索请求: ${request.query}`);
      
      const response: FileSearchResponse = await this.fileSearchService.search(request);
      
      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      this.logger.error('文件搜索失败', error);
      res.status(500).json({
        success: false,
        error: '文件搜索失败',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 智能文件搜索（推荐）
   */
  private async smartSearchFiles(req: Request, res: Response): Promise<void> {
    try {
      const request: FileSearchRequest = {
        query: req.body.query,
        projectId: req.body.projectId,
        options: {
          ...req.body.options,
          // 智能搜索的默认选项
          maxResults: req.body.options?.maxResults || 20,
          minScore: req.body.options?.minScore || 0.8,
          includeDirectories: req.body.options?.includeDirectories !== false
        }
      };

      if (!request.query || typeof request.query !== 'string') {
        res.status(400).json({
          success: false,
          error: '查询参数不能为空'
        });
        return;
      }

      this.logger.info(`智能文件搜索请求: ${request.query}`);
      
      const response: FileSearchResponse = await this.fileSearchService.search(request);
      
      // 添加智能搜索的额外信息
      const enhancedResponse = {
        ...response,
        smartSearch: true,
        recommendations: this.generateRecommendations(response.results)
      };
      
      res.json({
        success: true,
        data: enhancedResponse
      });
    } catch (error) {
      this.logger.error('智能文件搜索失败', error);
      res.status(500).json({
        success: false,
        error: '智能文件搜索失败',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 获取搜索建议
   */
  private async getSearchSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const limit = parseInt(req.query.limit as string) || 5;

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: '查询参数不能为空'
        });
        return;
      }

      this.logger.debug(`搜索建议请求: ${query}`);
      
      // 基于常见文件类型和模式生成建议
      const suggestions = this.generateSearchSuggestions(query, limit);
      
      res.json({
        success: true,
        data: {
          query,
          suggestions,
          count: suggestions.length
        }
      });
    } catch (error) {
      this.logger.error('获取搜索建议失败', error);
      res.status(500).json({
        success: false,
        error: '获取搜索建议失败',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 获取缓存统计
   */
  private async getCacheStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.fileSearchService.getCacheStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      this.logger.error('获取缓存统计失败', error);
      res.status(500).json({
        success: false,
        error: '获取缓存统计失败',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 清空缓存
   */
  private async clearCache(req: Request, res: Response): Promise<void> {
    try {
      await this.fileSearchService.clearCache();
      
      res.json({
        success: true,
        message: '缓存已清空'
      });
    } catch (error) {
      this.logger.error('清空缓存失败', error);
      res.status(500).json({
        success: false,
        error: '清空缓存失败',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 索引文件
   */
  private async indexFile(req: Request, res: Response): Promise<void> {
    try {
      const { filePath, content } = req.body;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'filePath 参数不能为空'
        });
        return;
      }

      this.logger.info(`索引文件请求: ${filePath}`);
      
      await this.fileSearchService.indexFile(filePath, req.body.projectId || 'default');
      
      res.json({
        success: true,
        message: '文件索引创建成功'
      });
    } catch (error) {
      this.logger.error('文件索引失败', error);
      res.status(500).json({
        success: false,
        error: '文件索引失败',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 批量索引文件
   */
  private async indexFiles(req: Request, res: Response): Promise<void> {
    try {
      const files = req.body.files;

      if (!Array.isArray(files) || files.length === 0) {
        res.status(400).json({
          success: false,
          error: 'files 参数必须是包含文件信息的数组'
        });
        return;
      }

      // 验证文件格式
      const validFiles = files.filter(file => 
        file && 
        typeof file.path === 'string' && 
        typeof file.content === 'string'
      );

      if (validFiles.length === 0) {
        res.status(400).json({
          success: false,
          error: '没有有效的文件信息'
        });
        return;
      }

      this.logger.info(`批量索引文件请求: ${validFiles.length} 个文件`);
      
      await this.fileSearchService.indexFiles(validFiles, req.body.projectId || 'default');
      
      res.json({
        success: true,
        message: `批量索引成功，共 ${validFiles.length} 个文件`
      });
    } catch (error) {
      this.logger.error('批量文件索引失败', error);
      res.status(500).json({
        success: false,
        error: '批量文件索引失败',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * 删除文件索引
   */
  private async deleteFileIndex(req: Request, res: Response): Promise<void> {
    try {
      const filePath = req.params.filePath;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'filePath 参数不能为空'
        });
        return;
      }

      this.logger.info(`删除文件索引请求: ${filePath}`);
      
      await this.fileSearchService.deleteFileIndex(filePath, req.body.projectId || 'default');
      
      res.json({
        success: true,
        message: '文件索引删除成功'
      });
    } catch (error) {
      this.logger.error('删除文件索引失败', error);
      res.status(500).json({
        success: false,
        error: '删除文件索引失败',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // 辅助方法

  /**
   * 生成搜索建议
   */
  private generateSearchSuggestions(query: string, limit: number): string[] {
    const suggestions = [];
    const lowerQuery = query.toLowerCase();
    
    // 基于常见文件扩展名的建议
    const commonExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
      '.html', '.css', '.scss', '.json', '.xml', '.yaml', '.yml',
      '.md', '.txt', '.log', '.conf', '.config', '.env'
    ];
    
    // 基于常见文件名的建议
    const commonFilenames = [
      'index', 'main', 'app', 'config', 'package', 'readme',
      'dockerfile', 'makefile', 'gitignore', 'env'
    ];
    
    // 基于常见目录的建议
    const commonDirectories = [
      'src', 'lib', 'bin', 'test', 'tests', 'docs', 'config',
      'assets', 'public', 'private', 'node_modules', 'venv'
    ];
    
    // 生成扩展名建议
    for (const ext of commonExtensions) {
      if (ext.includes(lowerQuery) || lowerQuery.includes(ext.replace('.', ''))) {
        suggestions.push(`*${ext}`);
        if (suggestions.length >= limit) break;
      }
    }
    
    // 生成文件名建议
    for (const filename of commonFilenames) {
      if (filename.includes(lowerQuery)) {
        suggestions.push(filename);
        if (suggestions.length >= limit) break;
      }
    }
    
    // 生成目录建议
    for (const dir of commonDirectories) {
      if (dir.includes(lowerQuery)) {
        suggestions.push(`${dir}/`);
        if (suggestions.length >= limit) break;
      }
    }
    
    return suggestions.slice(0, limit);
  }

  /**
   * 生成推荐结果
   */
  private generateRecommendations(results: any[]): any[] {
    if (!results || results.length === 0) {
      return [];
    }
    
    // 基于结果生成推荐
    const recommendations = [];
    const seenPaths = new Set(results.map(r => r.filePath));
    
    // 推荐相同目录下的其他文件
    const directories = [...new Set(results.map(r => r.directory))];
    for (const dir of directories.slice(0, 2)) {
      recommendations.push({
        type: 'same_directory',
        directory: dir,
        message: `查看目录 "${dir}" 中的其他文件`
      });
    }
    
    // 推荐相同扩展名的文件
    const extensions = [...new Set(results.map(r => r.extension).filter(Boolean))];
    for (const ext of extensions.slice(0, 2)) {
      recommendations.push({
        type: 'same_extension',
        extension: ext,
        message: `查看更多 ${ext} 文件`
      });
    }
    
    return recommendations;
  }
}