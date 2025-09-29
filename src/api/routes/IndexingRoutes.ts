import { Router, Request, Response, NextFunction } from 'express';
import { Logger } from '../../utils/logger.js';
import { IndexSyncService } from '../../service/index/IndexSyncService';
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
  private indexSyncService: IndexSyncService;
  private projectIdManager: ProjectIdManager;
  private embedderFactory: EmbedderFactory;
  private logger: Logger;
  private projectStateManager: ProjectStateManager;

  constructor(
    indexSyncService: IndexSyncService,
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

      // 为项目创建初始状态
      await this.projectStateManager.createOrUpdateProjectState(projectPath, {
        name: projectPath.split('/').pop() || projectPath.split('\\').pop() || projectPath
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
      next(error);
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
      next(error);
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
      next(error);
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
      next(error);
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

      // 删除项目映射
      const projectPath = this.projectIdManager.getProjectPath(projectId);
      if (projectPath) {
        this.projectIdManager.removeProject(projectPath);
        await this.projectIdManager.saveMapping();
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
      next(error);
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
      next(error);
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
      next(error);
    }
  }

  getRouter(): Router {
    return this.router;
  }
}