import { Router, Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger.js';
import { HybridIndexService } from '../../service/index/HybridIndexService.js';
import { ProjectIdManager } from '../../database/ProjectIdManager';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { ProjectStateManager } from '../../service/project/ProjectStateManager';

export interface IndexingRequestBody {
  projectPath: string;
  options?: {
    embedder?: string;
    batchSize?: number;
    maxFiles?: number;
    recursive?: boolean;
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFileSize?: number;
    chunkSize?: number;
    overlapSize?: number;
  };
}

export interface EmbedderValidationError {
  type: 'UNSUPPORTED_PROVIDER' | 'UNAVAILABLE_PROVIDER' | 'CONFIGURATION_ERROR';
  message: string;
  provider?: string;
  suggestedActions?: string[];
}

export interface EmbedderInfo {
  name: string;
  displayName: string;
  available: boolean;
  model: string;
  dimensions: number;
  requiresApiKey: boolean;
}

export interface SearchQuery {
  query: string;
  projectId: string;
  limit?: number;
  threshold?: number;
  filters?: {
    language?: string[];
    fileType?: string[];
    path?: string[];
    chunkType?: string[];
    snippetType?: string[];
  };
  searchType?: 'semantic' | 'keyword' | 'hybrid' | 'snippet';
}

export class IndexingRoutes {
  private router: Router;
  private indexSyncService: HybridIndexService;
  private projectIdManager: ProjectIdManager;
  private embedderFactory: EmbedderFactory;
  private logger: Logger;
  private projectStateManager: ProjectStateManager;

  constructor(
    indexSyncService: HybridIndexService,
    projectIdManager: ProjectIdManager,
    embedderFactory: EmbedderFactory,
    logger: Logger,
    projectStateManager: ProjectStateManager
  ) {
    this.indexSyncService = indexSyncService;
    this.projectIdManager = projectIdManager;
    this.embedderFactory = embedderFactory;
    this.logger = logger;
    this.projectStateManager = projectStateManager;
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    /**
     * @route POST /api/v1/indexing/create
     * @desc Create new codebase index
     * @param {string} body.projectPath - Project path to index
     * @param {object} body.options - Indexing options
     * @returns {object} 200 - Index result
     */
    this.router.post('/create', this.createIndex.bind(this));

    /**
     * @route POST /api/v1/indexing/:projectId
     * @desc Index specific project
     * @param {string} params.projectId - Project ID
     * @param {object} body - Indexing options
     * @returns {object} 200 - Index result
     */
    this.router.post('/:projectId', this.indexProject.bind(this));

    /**
     * @route GET /api/v1/indexing/status/:projectId
     * @desc Get indexing status
     * @param {string} params.projectId - Project ID
     * @returns {object} 200 - Index status
     */
    this.router.get('/status/:projectId', this.getIndexStatus.bind(this));

    /**
     * @route GET /api/v1/indexing/projects
     * @desc List all indexed projects
     * @returns {object} 200 - Projects list
     */
    this.router.get('/projects', this.listProjects.bind(this));

    /**
     * @route DELETE /api/v1/indexing/:projectId
     * @desc Remove project index
     * @param {string} params.projectId - Project ID
     * @returns {object} 200 - Deletion result
     */
    this.router.delete('/:projectId', this.removeIndex.bind(this));

    /**
     * @route POST /api/v1/indexing/search
     * @desc Search indexed codebase
     * @param {object} body - Search query
     * @returns {object} 200 - Search results
     */
    this.router.post('/search', this.search.bind(this));

    /**
     * @route GET /api/v1/indexing/embedders
     * @desc Get available embedder providers
     * @returns {object} 200 - Available embedders list
     */
    /**
     * @route POST /api/v1/indexing/:projectId/update
     * @desc Manually update project index (incremental)
     * @param {string} params.projectId - Project ID
     * @param {object} body - Update options
     * @returns {object} 200 - Update result
     */
    // this.router.post('/:projectId/update', this.updateIndex.bind(this));

    /**
     * @route GET /api/v1/indexing/:projectId/update/progress
     * @desc Get update progress
     * @param {string} params.projectId - Project ID
     * @returns {object} 200 - Update progress
     */
    // this.router.get('/:projectId/update/progress', this.getUpdateProgress.bind(this));

    /**
     * @route DELETE /api/v1/indexing/:projectId/update
     * @desc Cancel update operation
     * @param {string} params.projectId - Project ID
     * @returns {object} 200 - Cancel result
     */
    // this.router.delete('/:projectId/update', this.cancelUpdate.bind(this));
    this.router.get('/embedders', this.getAvailableEmbedders.bind(this));
  }

  private async createIndex(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectPath, options }: IndexingRequestBody = req.body;

      if (!projectPath) {
        res.status(400).json({
          success: false,
          error: 'projectPath is required',
        });
        return;
      }

      // 验证嵌入器参数
      const embedderValidation = await this.validateEmbedder(options?.embedder);
      if (!embedderValidation.isValid) {
        res.status(400).json({
          success: false,
          error: embedderValidation.error,
          availableProviders: await this.getAvailableProvidersInfo()
        });
        return;
      }

      // 转换前端选项为IndexSyncService需要的格式
      const syncOptions = {
        embedder: options?.embedder,
        batchSize: options?.batchSize,
        maxConcurrency: 3,
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns,
        chunkSize: options?.chunkSize,
        chunkOverlap: options?.overlapSize
      };

      // 为项目创建初始状态，允许重新索引
      await this.projectStateManager.createOrUpdateProjectState(projectPath, {
        name: projectPath.split('/').pop() || projectPath.split('\\').pop() || projectPath,
        allowReindex: true  // 在options对象中设置allowReindex
      });

      // 开始索引
      const projectId = await this.indexSyncService.startIndexing(projectPath, syncOptions);

      res.status(200).json({
        success: true,
        data: {
          projectId,
          projectPath,
          message: 'Indexing started successfully'
        },
      });
    } catch (error) {
      this.logger.error('Failed to create index:', { error, projectPath: req.body.projectPath });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'Failed to create index'
      });
    }
  }

  private async indexProject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const options = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      const projectPath = this.projectIdManager.getProjectPath(projectId);
      if (!projectPath) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }

      // 转换选项格式
      const syncOptions = {
        batchSize: options?.batchSize,
        maxConcurrency: 3,
        includePatterns: options?.includePatterns,
        excludePatterns: options?.excludePatterns,
        chunkSize: options?.chunkSize,
        chunkOverlap: options?.overlapSize
      };

      // 开始索引
      await this.indexSyncService.startIndexing(projectPath, syncOptions);

      res.status(200).json({
        success: true,
        data: {
          projectId,
          projectPath,
          message: 'Project indexing started successfully'
        },
      });
    } catch (error) {
      this.logger.error('Failed to index project:', { error, projectId: req.params.projectId });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'Failed to index project'
      });
    }
  }

  private async getIndexStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      const status = this.indexSyncService.getIndexStatus(projectId);

      if (!status) {
        res.status(404).json({
          success: false,
          error: 'Project not found or not indexed',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      this.logger.error('Failed to get index status:', { error, projectId: req.params.projectId });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'Failed to get index status'
      });
    }
  }

  private async listProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // 获取所有项目ID
      const projectIds = this.projectIdManager.listAllProjects();
      const projects = [];

      for (const projectId of projectIds) {
        const projectPath = this.projectIdManager.getProjectPath(projectId);
        if (projectPath) {
          const status = this.indexSyncService.getIndexStatus(projectId);
          projects.push({
            projectId,
            projectPath,
            status: status || {
              projectId,
              projectPath,
              isIndexing: false,
              lastIndexed: null,
              totalFiles: 0,
              indexedFiles: 0,
              failedFiles: 0,
              progress: 0
            }
          });
        }
      }

      res.status(200).json({
        success: true,
        data: projects,
      });
    } catch (error) {
      this.logger.error('Failed to list projects:', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'Failed to list projects'
      });
    }
  }

  private async removeIndex(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      // 停止索引（如果正在进行）
      await this.indexSyncService.stopIndexing(projectId);

      // 在删除项目状态之前，先获取项目路径信息
      let projectPath = this.projectIdManager.getProjectPath(projectId);

      // 如果无法从ProjectIdManager获取，尝试从ProjectStateManager获取
      if (!projectPath) {
        const projectState = this.projectStateManager.getProjectState(projectId);
        if (projectState) {
          projectPath = projectState.projectPath;
        }
      }

      // 删除项目状态和相关数据库资源
      await this.projectStateManager.deleteProjectState(projectId);

      // 删除项目映射
      // 使用获取到的项目路径进行删除
      if (projectPath) {
        this.projectIdManager.removeProject(projectPath);
        await this.projectIdManager.saveMapping();
        this.logger.info(`Successfully removed mapping for projectId ${projectId} at path ${projectPath}`);
      } else {
        // 如果两种方式都无法获取项目路径，尝试通过遍历所有映射来删除
        this.logger.warn(`Project path not found for projectId: ${projectId}, attempting to remove mapping by iteration`);

        // 直接使用removeProjectById方法，这是最可靠的方式
        const directRemovalResult = this.projectIdManager.removeProjectById(projectId);
        if (directRemovalResult) {
          await this.projectIdManager.saveMapping();
          this.logger.info(`Removed mapping directly for projectId ${projectId}, success: ${directRemovalResult}`);
        } else {
          this.logger.warn(`Failed to remove mapping for projectId ${projectId} using removeProjectById`);
        }

      }

      res.status(200).json({
        success: true,
        data: {
          projectId,
          message: 'Project index removed successfully'
        },
      });
    } catch (error) {
      this.logger.error('Failed to remove index:', { error, projectId: req.params.projectId });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'Failed to remove index'
      });
    }
  }

  private async search(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const searchQuery: SearchQuery = req.body;

      if (!searchQuery.query || !searchQuery.projectId) {
        res.status(400).json({
          success: false,
          error: 'query and projectId are required',
        });
        return;
      }

      // 检查项目是否存在
      const projectPath = this.projectIdManager.getProjectPath(searchQuery.projectId);
      if (!projectPath) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }

      // 暂时返回模拟搜索结果
      // 在实际实现中，这里应该调用搜索服务
      const results = {
        query: searchQuery.query,
        projectId: searchQuery.projectId,
        results: [],
        total: 0,
        searchType: searchQuery.searchType || 'semantic'
      };

      res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      this.logger.error('Failed to search:', { error, query: req.body.query });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'Failed to search'
      });
    }
  }

  /**
   * 验证嵌入器参数
   */
  private async validateEmbedder(embedderName?: string): Promise<{
    isValid: boolean;
    error?: EmbedderValidationError;
    providerInfo?: any;
  }> {
    try {
      if (!embedderName) {
        return { isValid: true }; // 使用默认配置
      }

      // 检查是否支持该嵌入器
      const isRegistered = this.embedderFactory.isProviderRegistered(embedderName);
      if (!isRegistered) {
        return {
          isValid: false,
          error: {
            type: 'UNSUPPORTED_PROVIDER',
            message: `Unsupported embedder provider: ${embedderName}`,
            provider: embedderName,
            suggestedActions: [
              'Please select a valid embedder provider from the available options',
              'Check the embedder name spelling'
            ]
          }
        };
      }

      // 检查嵌入器是否可用
      const embedder = await this.embedderFactory.getEmbedder(embedderName);
      const isAvailable = await embedder.isAvailable();

      if (!isAvailable) {
        return {
          isValid: false,
          error: {
            type: 'UNAVAILABLE_PROVIDER',
            message: `Embedder provider ${embedderName} is not available`,
            provider: embedderName,
            suggestedActions: this.getSuggestedActions(embedderName)
          }
        };
      }

      // 获取提供者信息
      const providerInfo = await this.embedderFactory.getProviderInfo(embedderName);

      return {
        isValid: true,
        providerInfo
      };
    } catch (error) {
      return {
        isValid: false,
        error: {
          type: 'CONFIGURATION_ERROR',
          message: `Failed to validate embedder: ${error instanceof Error ? error.message : String(error)}`,
          provider: embedderName,
          suggestedActions: [
            'Check the server logs for more details',
            'Verify your environment configuration'
          ]
        }
      };
    }
  }

  /**
   * 获取建议的解决步骤
   */
  private getSuggestedActions(provider: string): string[] {
    const actions: { [key: string]: string[] } = {
      openai: [
        'Check if OPENAI_API_KEY is configured in environment variables',
        'Verify the API key is valid and has sufficient permissions',
        'Check network connectivity to OpenAI API'
      ],
      siliconflow: [
        'Check if SILICONFLOW_API_KEY is configured in environment variables',
        'Verify the API key is valid and has sufficient permissions',
        'Check network connectivity to SiliconFlow API'
      ],
      gemini: [
        'Check if GEMINI_API_KEY is configured in environment variables',
        'Verify the API key is valid and has sufficient permissions',
        'Check network connectivity to Gemini API'
      ],
      mistral: [
        'Check if MISTRAL_API_KEY is configured in environment variables',
        'Verify the API key is valid and has sufficient permissions',
        'Check network connectivity to Mistral API'
      ],
      ollama: [
        'Check if Ollama service is running',
        'Verify the Ollama base URL configuration',
        'Check if the required model is available in Ollama'
      ]
    };

    return actions[provider] || [
      'Check if the required API key is configured in environment variables',
      'Verify the API key is valid and has sufficient permissions',
      'Check network connectivity to the provider API'
    ];
  }

  /**
   * 获取可用的嵌入器提供者列表
   * 使用缓存机制，避免对所有提供商进行实时可用性检查
   */
  private async getAvailableProvidersInfo(): Promise<EmbedderInfo[]> {
    const providers = this.embedderFactory.getRegisteredProviders();
    const availableProviders: EmbedderInfo[] = [];

    for (const provider of providers) {
      try {
        // 使用缓存的提供商信息，避免频繁检查
        const providerInfo = await this.embedderFactory.getProviderInfo(provider);

        availableProviders.push({
          name: provider,
          displayName: this.getDisplayName(provider),
          available: providerInfo.available,
          model: providerInfo.model,
          dimensions: providerInfo.dimensions,
          requiresApiKey: this.requiresApiKey(provider)
        });
      } catch (error) {
        // 记录错误但继续处理其他提供者
        this.logger.warn(`Failed to get info for provider ${provider}:`, { error });
      }
    }

    return availableProviders;
  }

  /**
   * 获取显示名称
   */
  private getDisplayName(provider: string): string {
    const displayNames: { [key: string]: string } = {
      openai: 'OpenAI',
      ollama: 'Ollama',
      siliconflow: 'SiliconFlow',
      gemini: 'Gemini',
      mistral: 'Mistral',
      custom1: 'Custom 1',
      custom2: 'Custom 2',
      custom3: 'Custom 3'
    };
    return displayNames[provider] || provider;
  }

  /**
   * 检查是否需要API密钥
   */
  private requiresApiKey(provider: string): boolean {
    const keyRequiredProviders = ['openai', 'siliconflow', 'gemini', 'mistral'];
    return keyRequiredProviders.includes(provider);
  }

  /**
   * 手动更新项目索引
   */
  /*private async updateIndex(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;
      const { options } = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      const projectPath = this.projectIdManager.getProjectPath(projectId);
      if (!projectPath) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }

      // 开始手动更新
      // 注释掉不存在的方法调用
      // const result = await this.indexSyncService.updateIndex(projectPath, options);

      res.status(200).json({
        success: true,
        data: {},
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('already in progress')) {
        res.status(409).json({
          success: false,
          error: 'Update operation already in progress',
        });
      } else {
        this.logger.error('Failed to update index:', { error, projectId: req.params.projectId });
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : 'An unknown error occurred',
          message: 'Failed to update index'
        });
      }
    }
  }*/

  /**
   * 获取更新进度
   */
  /*private async getUpdateProgress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      // 注释掉不存在的方法调用
      // const progress = this.indexSyncService.getUpdateProgress(projectId);
      const progress = null;
      if (!progress) {
        res.status(404).json({
          success: false,
          error: 'No active update operation found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: progress,
      });
    } catch (error) {
      this.logger.error('Failed to get update progress:', { error, projectId: req.params.projectId });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'Failed to get update progress'
      });
    }
  }*/

  /**
   * 取消更新操作
   */
  /*private async cancelUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'projectId is required',
        });
        return;
      }

      // 注释掉不存在的方法调用
      // const cancelled = await this.indexSyncService.cancelUpdate(projectId);
      const cancelled = false;
      if (!cancelled) {
        res.status(404).json({
          success: false,
          error: 'No active update operation found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          projectId,
          message: 'Update operation cancelled successfully'
        },
      });
    } catch (error) {
      this.logger.error('Failed to cancel update:', { error, projectId: req.params.projectId });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'Failed to cancel update'
      });
    }
  }*/

  /**
   * 获取可用嵌入器列表
   */
  private async getAvailableEmbedders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const availableProviders = await this.getAvailableProvidersInfo();

      res.status(200).json({
        success: true,
        data: availableProviders
      });
    } catch (error) {
      this.logger.error('Failed to get available embedders:', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'Failed to get available embedders'
      });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}