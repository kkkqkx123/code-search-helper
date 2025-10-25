import { Router, Request, Response, NextFunction } from 'express';
import { ProjectPathMappingService } from '../../database/ProjectPathMappingService';
import { Logger } from '../../utils/logger.js';

export const createProjectMappingRouter = (mappingService: ProjectPathMappingService): Router => {
  const router = Router();
  const logger = new Logger('ProjectMappingRoutes');

  // 获取所有映射关系
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Getting all project path mappings');
      const mappings = await mappingService.getAllMappings();
      res.json({
        success: true,
        data: mappings,
        count: mappings.length
      });
    } catch (error) {
      logger.error('Failed to retrieve project path mappings', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve project path mappings',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 根据哈希值获取原始路径
  router.get('/:hash', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hash } = req.params;
      logger.info(`Getting original path for hash: ${hash}`);
      
      const originalPath = await mappingService.getOriginalPath(hash);
      
      if (originalPath) {
        res.json({
          success: true,
          data: {
            hash,
            originalPath
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Mapping not found',
          message: `No mapping found for hash: ${hash}`
        });
      }
    } catch (error) {
      logger.error(`Failed to get original path for hash: ${req.params.hash}`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve mapping',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 根据原始路径获取哈希值
  router.get('/by-path/:originalPath', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { originalPath } = req.params;
      logger.info(`Getting hash for original path: ${originalPath}`);
      
      const hash = await mappingService.getHashByPath(originalPath);
      
      if (hash) {
        res.json({
          success: true,
          data: {
            hash,
            originalPath
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Mapping not found',
          message: `No mapping found for path: ${originalPath}`
        });
      }
    } catch (error) {
      logger.error(`Failed to get hash for path: ${req.params.originalPath}`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve mapping',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 保存映射关系
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hash, originalPath } = req.body;
      
      if (!hash || !originalPath) {
        return res.status(400).json({
          success: false,
          error: 'Bad request',
          message: 'Both hash and originalPath are required'
        });
      }
      
      logger.info(`Saving mapping: ${hash} -> ${originalPath}`);
      await mappingService.saveMapping(hash, originalPath);
      
      res.status(201).json({
        success: true,
        message: 'Mapping saved successfully',
        data: {
          hash,
          originalPath
        }
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
  router.delete('/:hash', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hash } = req.params;
      logger.info(`Deleting mapping for hash: ${hash}`);
      
      await mappingService.deleteMapping(hash);
      
      res.json({
        success: true,
        message: 'Mapping deleted successfully'
      });
    } catch (error) {
      logger.error(`Failed to delete mapping for hash: ${req.params.hash}`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete mapping',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 根据原始路径删除映射关系
  router.delete('/by-path/:originalPath', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { originalPath } = req.params;
      logger.info(`Deleting mapping for path: ${originalPath}`);
      
      await mappingService.deleteMappingByPath(originalPath);
      
      res.json({
        success: true,
        message: 'Mapping deleted successfully'
      });
    } catch (error) {
      logger.error(`Failed to delete mapping for path: ${req.params.originalPath}`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete mapping',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 检查映射关系是否存在
  router.get('/:hash/exists', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { hash } = req.params;
      logger.info(`Checking if mapping exists for hash: ${hash}`);
      
      const exists = await mappingService.mappingExists(hash);
      
      res.json({
        success: true,
        data: {
          hash,
          exists
        }
      });
    } catch (error) {
      logger.error(`Failed to check mapping existence for hash: ${req.params.hash}`, error);
      res.status(500).json({
        success: false,
        error: 'Failed to check mapping existence',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取映射关系统计信息
  router.get('/stats/summary', async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Getting mapping statistics');
      
      const stats = await mappingService.getMappingStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get mapping statistics', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get mapping statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
};