import { Router, Request, Response, NextFunction } from 'express';
import { HotReloadConfigService } from '../../service/filesystem/HotReloadConfigService';
import { Logger } from '../../utils/logger.js';

export class HotReloadRoutes {
  private router: Router;
  private configService: HotReloadConfigService;
  private logger: Logger;

  constructor(configService: HotReloadConfigService, logger: Logger) {
    this.configService = configService;
    this.logger = logger;
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    /**
     * @route GET /api/v1/hot-reload/global
     * @desc Get global hot reload configuration
     * @returns {object} 200 - Global configuration
     */
    this.router.get('/global', this.getGlobalConfig.bind(this));

    /**
     * @route PUT /api/v1/hot-reload/global
     * @desc Update global hot reload configuration
     * @param {object} body - Configuration updates
     * @returns {object} 200 - Updated configuration
     */
    this.router.put('/global', this.updateGlobalConfig.bind(this));

    /**
     * @route GET /api/v1/hot-reload/projects
     * @desc Get all project hot reload configurations
     * @returns {object} 200 - Project configurations map
     */
    this.router.get('/projects', this.getAllProjectConfigs.bind(this));

    /**
     * @route POST /api/v1/hot-reload/projects/batch-enable
     * @desc Batch enable hot reload for multiple projects
     * @param {string[]} body.projectPaths - Array of project paths
     * @param {object} body.config - Configuration to apply
     * @returns {object} 200 - Batch operation result
     */
    this.router.post('/projects/batch-enable', this.batchEnableProjects.bind(this));

    /**
     * @route POST /api/v1/hot-reload/projects/batch-disable
     * @desc Batch disable hot reload for multiple projects
     * @param {string[]} body.projectPaths - Array of project paths
     * @returns {object} 200 - Batch operation result
     */
    this.router.post('/projects/batch-disable', this.batchDisableProjects.bind(this));

    /**
     * @route POST /api/v1/hot-reload/reset
     * @desc Reset all hot reload configurations to defaults
     * @returns {object} 200 - Reset result
     */
    this.router.post('/reset', this.resetToDefaults.bind(this));

    /**
     * @route GET /api/v1/hot-reload/status
     * @desc Get hot reload service status and statistics
     * @returns {object} 200 - Service status and statistics
     */
    this.router.get('/status', this.getServiceStatus.bind(this));
  }

  /**
   * 获取全局热更新配置
   */
  private async getGlobalConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = this.configService.getGlobalConfig();
      
      res.status(200).json({
        success: true,
        data: config,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新全局热更新配置
   */
  private async updateGlobalConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const configUpdate = req.body;

      // 验证配置
      const validation = this.configService.validateConfig(configUpdate);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: 'Invalid configuration',
          details: validation.errors,
        });
        return;
      }

      // 更新全局配置
      this.configService.updateGlobalConfig(configUpdate);

      // 获取更新后的配置
      const updatedConfig = this.configService.getGlobalConfig();

      this.logger.info('Global hot reload configuration updated', { config: updatedConfig });

      res.status(200).json({
        success: true,
        data: updatedConfig,
        message: 'Global hot reload configuration updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取所有项目热更新配置
   */
  private async getAllProjectConfigs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const projectConfigs = this.configService.getAllProjectConfigs();
      
      // 转换为对象格式以便JSON序列化
      const configsObject = Object.fromEntries(projectConfigs);

      res.status(200).json({
        success: true,
        data: {
          projects: configsObject,
          count: projectConfigs.size,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 批量启用项目热更新
   */
  private async batchEnableProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectPaths, config } = req.body;

      if (!Array.isArray(projectPaths) || projectPaths.length === 0) {
        res.status(400).json({
          success: false,
          error: 'projectPaths must be a non-empty array',
        });
        return;
      }

      if (config) {
        // 验证配置
        const validation = this.configService.validateConfig(config);
        if (!validation.isValid) {
          res.status(400).json({
            success: false,
            error: 'Invalid configuration',
            details: validation.errors,
          });
          return;
        }
      }

      const results: Array<{ projectPath: string; success: boolean; error?: string }> = [];
      
      for (const projectPath of projectPaths) {
        try {
          // 设置项目配置
          const enableConfig = { enabled: true, ...(config || {}) };
          this.configService.setProjectConfig(projectPath, enableConfig);
          
          results.push({
            projectPath,
            success: true,
          });
        } catch (error) {
          results.push({
            projectPath,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.info('Batch enable hot reload completed', { 
        total: projectPaths.length, 
        successful, 
        failed,
        projectPaths 
      });

      res.status(200).json({
        success: failed === 0,
        data: {
          results,
          summary: {
            total: projectPaths.length,
            successful,
            failed,
          },
        },
        message: `Batch operation completed: ${successful} successful, ${failed} failed`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 批量禁用项目热更新
   */
  private async batchDisableProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectPaths } = req.body;

      if (!Array.isArray(projectPaths) || projectPaths.length === 0) {
        res.status(400).json({
          success: false,
          error: 'projectPaths must be a non-empty array',
        });
        return;
      }

      const results: Array<{ projectPath: string; success: boolean; error?: string }> = [];
      
      for (const projectPath of projectPaths) {
        try {
          // 禁用项目热更新
          this.configService.setProjectConfig(projectPath, { enabled: false });
          
          results.push({
            projectPath,
            success: true,
          });
        } catch (error) {
          results.push({
            projectPath,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      this.logger.info('Batch disable hot reload completed', { 
        total: projectPaths.length, 
        successful, 
        failed,
        projectPaths 
      });

      res.status(200).json({
        success: failed === 0,
        data: {
          results,
          summary: {
            total: projectPaths.length,
            successful,
            failed,
          },
        },
        message: `Batch operation completed: ${successful} successful, ${failed} failed`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 重置所有配置为默认值
   */
  private async resetToDefaults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.configService.resetToDefaults();
      
      this.logger.info('Hot reload configuration reset to defaults');

      res.status(200).json({
        success: true,
        message: 'All hot reload configurations have been reset to defaults',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取热更新服务状态和统计信息
   */
  private async getServiceStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const globalConfig = this.configService.getGlobalConfig();
      const projectConfigs = this.configService.getAllProjectConfigs();
      
      // 统计信息
      const totalProjects = projectConfigs.size;
      const enabledProjects = Array.from(projectConfigs.values()).filter(config => config.enabled).length;
      const disabledProjects = totalProjects - enabledProjects;

      const status = {
        global: {
          enabled: globalConfig.enabled,
          maxConcurrentProjects: globalConfig.maxConcurrentProjects,
          enableDetailedLogging: globalConfig.enableDetailedLogging,
        },
        projects: {
          total: totalProjects,
          enabled: enabledProjects,
          disabled: disabledProjects,
        },
        service: {
          timestamp: new Date(),
          version: '1.0.0', // 可以从package.json获取
        },
      };

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }

  getRouter(): Router {
    return this.router;
  }
}