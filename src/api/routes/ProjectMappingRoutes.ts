import { Router, Request, Response, NextFunction } from 'express';
import { ProjectMappingService } from '../../database/ProjectMappingService';
import { Logger } from '../../utils/logger.js';

export const createProjectMappingRouter = (mappingService: ProjectMappingService): Router => {
  const router = Router();
  const logger = Logger.getInstance('ProjectMappingRoutes');

  // 获取所有映射关系
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Getting all project mappings');
      const mappings = mappingService.getAllMappings();
      res.json({
        success: true,
        data: mappings,
        count: mappings.length
      });
    } catch (error) {
      logger.error('Failed to retrieve project mappings', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve project mappings',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 根据项目ID获取映射
  router.get('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      logger.info(`Getting mapping for project ID: ${projectId}`);

      const mapping = mappingService.getMappingById(projectId);

      if (mapping) {
        res.json({
          success: true,
          data: mapping
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Mapping not found',
          message: `No mapping found for project ID: ${projectId}`
        });
      }
    } catch (error) {
      logger.error(`Failed to get mapping for project ID: ${req.params.projectId}`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve mapping',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 根据项目路径获取映射
  router.get('/by-path/:projectPath', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectPath } = req.params;
      logger.info(`Getting mapping for project path: ${projectPath}`);

      const mapping = mappingService.getMappingByPath(projectPath);

      if (mapping) {
        res.json({
          success: true,
          data: mapping
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Mapping not found',
          message: `No mapping found for path: ${projectPath}`
        });
      }
    } catch (error) {
      logger.error(`Failed to get mapping for path: ${req.params.projectPath}`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve mapping',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 创建或更新映射关系
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectPath, collectionName, spaceName } = req.body;

      if (!projectPath || !collectionName || !spaceName) {
        return res.status(400).json({
          success: false,
          error: 'Bad request',
          message: 'projectPath, collectionName, and spaceName are required'
        });
      }

      logger.info(`Creating or updating mapping for project: ${projectPath}`);
      const mapping = await mappingService.createOrUpdateMapping(projectPath, collectionName, spaceName);

      res.status(201).json({
        success: true,
        message: 'Mapping saved successfully',
        data: mapping
      });
    } catch (error) {
      logger.error('Failed to save mapping', error);
      res.status(500).json({
        success: false,
        error: 'Failed to save mapping',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 删除映射关系
  router.delete('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId } = req.params;
      logger.info(`Deleting mapping for project ID: ${projectId}`);

      const deleted = await mappingService.deleteMapping(projectId);

      if (deleted) {
        res.json({
          success: true,
          message: 'Mapping deleted successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Mapping not found',
          message: `No mapping found for project ID: ${projectId}`
        });
      }
    } catch (error) {
      logger.error(`Failed to delete mapping for project ID: ${req.params.projectId}`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete mapping',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
};
