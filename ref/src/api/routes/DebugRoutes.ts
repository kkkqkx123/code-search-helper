import { Router, Request, Response, NextFunction } from 'express';
import { DIContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import { DebugController } from '../../controllers/DebugController';

export class DebugRoutes {
  private router: Router;
  private debugController: DebugController | null = null;

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private getDebugController(): DebugController {
    if (!this.debugController) {
      const container = DIContainer.getInstance();
      this.debugController = container.get<DebugController>(TYPES.DebugController);
    }
    return this.debugController;
  }

 private setupRoutes(): void {
    /**
     * @route GET /api/v1/debug/api-logs
     * @desc Get API request/response logs
     * @returns {object} 200 - API logs data
     */
    this.router.get('/api-logs', this.getApiLogs.bind(this));

    /**
     * @route GET /api/v1/debug/component-states
     * @desc Get frontend component states
     * @returns {object} 200 - Component states data
     */
    this.router.get('/component-states', this.getComponentStates.bind(this));

    /**
     * @route GET /api/v1/debug/error-logs
     * @desc Get error logs
     * @returns {object} 200 - Error logs data
     */
    this.router.get('/error-logs', this.getErrorLogs.bind(this));

    /**
     * @route GET /api/v1/debug/profiling-data
     * @desc Get performance profiling data
     * @returns {object} 200 - Profiling data
     */
    this.router.get('/profiling-data', this.getProfilingData.bind(this));

    /**
     * @route POST /api/v1/debug/start-profiling
     * @desc Start performance profiling
     * @returns {object} 200 - Profiling started status
     */
    this.router.post('/start-profiling', this.startProfiling.bind(this));

    /**
     * @route POST /api/v1/debug/stop-profiling
     * @desc Stop performance profiling
     * @returns {object} 200 - Profiling stopped status
     */
    this.router.post('/stop-profiling', this.stopProfiling.bind(this));
  }
private async getApiLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await this.getDebugController().getApiLogs();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}


  private async getComponentStates(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getDebugController().getComponentStates();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async getErrorLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getDebugController().getErrorLogs();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async getProfilingData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getDebugController().getProfilingData();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async startProfiling(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getDebugController().startProfiling();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  private async stopProfiling(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.getDebugController().stopProfiling();
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
 }

  getRouter(): Router {
    return this.router;
  }
}