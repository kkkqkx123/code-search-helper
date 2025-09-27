import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import express, { Application, Request, Response, NextFunction } from 'express';
import { DIContainer } from '../core/DIContainer';
import { TYPES } from '../types';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { ConfigService } from '../config/ConfigService';
import { SnippetRoutes } from './routes/SnippetRoutes';
import { MonitoringRoutes } from './routes/MonitoringRoutes';
import { StaticAnalysisRoutes } from './routes/StaticAnalysisRoutes';
import { IndexingRoutes } from './routes/IndexingRoutes';
import { SearchRoutes } from './routes/SearchRoutes';
import { GraphAnalysisRoutes } from './routes/GraphAnalysisRoutes';
import { FileSystemRoutes } from './routes/FileSystemRoutes';
import { CacheRoutes } from './routes/CacheRoutes';
import { ParserRoutes } from './routes/ParserRoutes';
import { ProjectRoutes } from './routes/ProjectRoutes';
import { DebugRoutes } from './routes/DebugRoutes';

@injectable()
export class HttpServer {
  private app: Application;
  private server: any; // Store the server instance
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private monitoringController: any; // We'll fix the type later
  private port: number;
  private rateLimitMap: Map<string, { count: number; resetTime: number }>;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.port = this.configService.get('port') || 3000;
    this.rateLimitMap = new Map();
    this.app = express();
  }

  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    
    this.initialized = true;
  }

  private setupMiddleware(): void {
    // Parse JSON bodies with error handling
    this.app.use(express.json({ 
      limit: '10mb',
      // 自定义错误处理
      verify: (req: any, res: any, buf: Buffer, encoding: string) => {
        try {
          JSON.parse(buf.toString());
        } catch (e) {
          // 存储解析错误，将在错误处理中间件中使用
          req._jsonParseError = e;
        }
      }
    }));

    // Parse URL-encoded bodies
    this.app.use(express.urlencoded({ extended: true }));

    // Rate limiting middleware
    this.app.use(this.rateLimitingMiddleware.bind(this));

    // CORS middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const origin = req.get('Origin');
      
      // 允许的前端域名列表
      const allowedOrigins = [
        'http://localhost:3011',
        'http://localhost:3012',
        'http://127.0.0.1:3011',
        'http://127.0.0.1:3012'
      ];

      // 检查来源是否在允许列表中
      if (origin && allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
      } else if (!origin) {
        // 如果没有origin头，允许所有来源（开发环境）
        res.header('Access-Control-Allow-Origin', '*');
      }

      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-CSRF-Token'
      );

      if (req.method === 'OPTIONS') {
        return res.status(204).send();
      }

      return next();
    });

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      try {
        this.logger.info(`Request ${req.method} ${req.path}`, {
          method: req.method,
          url: req.path,
          query: req.query,
          body: req.body,
          ip: req.ip,
        });
      } catch (error) {
        console.error('Error in request logging middleware:', error);
      }
      return next();
    });
  }

  private rateLimitingMiddleware(req: Request, res: Response, next: NextFunction): void {
    // 开发环境下简化速率限制配置
    const windowMs = 15 * 60 * 1000; // 默认15分钟
    const max = 1000; // 默认1000个请求（开发环境放宽限制）
    const enabled = true; // 默认启用

    // Use IP as key for rate limiting
    const key = req.ip || 'unknown';
    const now = Date.now();

    // Get or create rate limit info for this IP
    let rateLimitInfo = this.rateLimitMap.get(key);

    // Reset count if window has expired
    if (!rateLimitInfo || rateLimitInfo.resetTime <= now) {
      rateLimitInfo = {
        count: 0,
        resetTime: now + windowMs,
      };
      this.rateLimitMap.set(key, rateLimitInfo);
    }

    // Increment count
    rateLimitInfo.count++;

    // Check if limit exceeded
    if (rateLimitInfo.count > max) {
      res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
      });
      return;
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - rateLimitInfo.count));
    res.setHeader('X-RateLimit-Reset', new Date(rateLimitInfo.resetTime).toUTCString());

    return next();
  }

  private setupRoutes(): void {
    // Health check endpoint - moved to MonitoringRoutes
    // Metrics endpoint - moved to MonitoringRoutes

    // API routes
    this.app.use('/api/v1/snippets', new SnippetRoutes().getRouter());
    this.app.use('/api/v1/monitoring', new MonitoringRoutes().getRouter());
    this.app.use('/api/v1/analysis', new StaticAnalysisRoutes().getRouter());
    this.app.use('/api/v1/indexing', new IndexingRoutes().getRouter());
    this.app.use('/api/v1/search', new SearchRoutes().getRouter());
    this.app.use('/api/v1/graph', new GraphAnalysisRoutes().getRouter());
    this.app.use('/api/v1/filesystem', new FileSystemRoutes().getRouter());
    this.app.use('/api/v1/cache', new CacheRoutes().getRouter());
    this.app.use('/api/v1/parser', new ParserRoutes().getRouter());
    this.app.use('/api/v1/projects', new ProjectRoutes().getRouter());
    this.app.use('/api/v1/debug', new DebugRoutes().getRouter());

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.status(200).json({
        message: 'Codebase Index API Service',
        version: '1.0.0',
        documentation: '/api-docs',
      });
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
      });
    });

    // Global error handler
  this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
    // 检查是否是JSON解析错误
    if ((req as any)._jsonParseError || error.name === 'SyntaxError' && error.message.includes('JSON')) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid JSON format'
      });
    }

    this.errorHandler.handleError(error, {
      component: 'HttpServer',
      operation: 'globalErrorHandler',
      metadata: {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
      },
    });

    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message:
        process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
    });
  });
  }

  async start(): Promise<any> {
    return new Promise((resolve, reject) => {
      this.server = this.app
        .listen(this.port, () => {
          this.logger.info(`HTTP server started`, {
            port: this.port,
            host: 'localhost',
            environment: this.configService.get('nodeEnv'),
          });
          resolve(this.server);
        })
        .on('error', error => {
          this.logger.error('Failed to start HTTP Server', error);
          reject(error);
        });
    });
  }

  // Add a method to close the server
  async close(): Promise<void> {
    if (this.server && this.server.listening) {
      return new Promise((resolve, reject) => {
        this.server.close((err: any) => {
          if (err) {
            // Ignore "Server is not running" errors as this is expected during graceful shutdown
            if (err.code === 'ERR_SERVER_NOT_RUNNING') {
              resolve();
            } else {
              reject(err);
            }
          } else {
            resolve();
          }
        });
      });
    }
  }

  getApp(): Application {
    return this.app;
  }
}
