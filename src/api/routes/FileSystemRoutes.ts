import { Router, Request, Response, NextFunction } from 'express';
import { DIContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import {
  FileSystemTraversal,
  FileInfo,
  TraversalOptions,
  TraversalResult,
} from '../../services/filesystem/FileSystemTraversal';
import {
  FileWatcherService,
  FileWatcherOptions,
} from '../../services/filesystem/FileWatcherService';
import { LoggerService } from '../../core/LoggerService';
import path from 'path';

export interface FileSystemTraversalRequest {
  rootPath: string;
  options?: TraversalOptions;
}

export interface FileWatcherRequest {
  projectId: string;
  options: FileWatcherOptions;
}

export interface FileContentRequest {
  filePath: string;
  projectId?: string;
  encoding?: string;
}

export interface FileSearchRequest {
  rootPath: string;
  pattern: string;
  options?: {
    caseSensitive?: boolean;
    includeFiles?: boolean;
    includeDirectories?: boolean;
    maxResults?: number;
  };
}

export interface DirectoryAnalysisRequest {
  rootPath: string;
  options?: {
    includeStats?: boolean;
    includeStructure?: boolean;
    includeLargeFiles?: boolean;
    largeFileThreshold?: number;
  };
}

export class FileSystemRoutes {
  private router: Router;
  private fileSystemTraversal: FileSystemTraversal;
  private fileWatcherService: FileWatcherService;
  private logger: LoggerService;
  private activeWatchers: Map<string, string[]> = new Map();

  constructor() {
    const container = DIContainer.getInstance();
    this.fileSystemTraversal = container.get<FileSystemTraversal>(TYPES.FileSystemTraversal);
    this.fileWatcherService = container.get<FileWatcherService>(TYPES.FileWatcherService);
    this.logger = container.get<LoggerService>(TYPES.LoggerService);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Traverse directory
    this.router.post('/traverse', this.traverseDirectory.bind(this));

    // Get file content
    this.router.post('/content', this.getFileContent.bind(this));

    // Start file watcher
    this.router.post('/watch/start', this.startFileWatcher.bind(this));

    // Stop file watcher
    this.router.post('/watch/stop', this.stopFileWatcher.bind(this));

    // Get file watcher status
    this.router.get('/watch/status/:projectId', this.getWatcherStatus.bind(this));

    // Search files
    this.router.post('/search', this.searchFiles.bind(this));

    // Analyze directory structure
    this.router.post('/analyze', this.analyzeDirectory.bind(this));

    // Get file info - path-to-regexp 8.x 语法: /*filePath
    this.router.get('/info/*filePath', this.getFileInfo.bind(this));

    // List directory contents - path-to-regexp 8.x 语法: /*dirPath
    this.router.get('/list/*dirPath', this.listDirectory.bind(this));

    // Check if path exists - path-to-regexp 8.x 语法: /*path
    this.router.get('/exists/*path', this.pathExists.bind(this));
  }

  private async traverseDirectory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rootPath, options } = req.body as FileSystemTraversalRequest;

      if (!rootPath) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Root path is required',
        });
        return;
      }

      const result: TraversalResult = await this.fileSystemTraversal.traverseDirectory(
        rootPath,
        options
      );

      res.status(200).json({
        success: true,
        data: result,
        metadata: {
          rootPath,
          processingTime: result.processingTime,
          totalFiles: result.files.length,
          totalDirectories: result.directories.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async getFileContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath, projectId, encoding = 'utf8' } = req.body as FileContentRequest;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'File path is required',
        });
        return;
      }

      const fs = require('fs').promises;
      const content = await fs.readFile(filePath, encoding);

      const stats = await fs.stat(filePath);

      res.status(200).json({
        success: true,
        data: {
          content,
          metadata: {
            filePath,
            projectId,
            encoding,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'File not found',
        });
      } else {
        next(error);
      }
    }
  }

  private async startFileWatcher(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId, options } = req.body as FileWatcherRequest;

      if (!projectId || !options || !options.watchPaths) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID and options with watchPaths are required',
        });
        return;
      }

      // Check if watcher already exists for this project
      if (this.activeWatchers.has(projectId)) {
        res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'File watcher already exists for this project',
        });
        return;
      }

      // Start watching with the provided options
      await this.fileWatcherService.startWatching(options);
      this.activeWatchers.set(projectId, options.watchPaths);

      res.status(200).json({
        success: true,
        data: {
          projectId,
          watchPaths: options.watchPaths,
          status: 'started',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async stopFileWatcher(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.body;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required',
        });
        return;
      }

      const watcherPaths = this.activeWatchers.get(projectId);
      if (!watcherPaths) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'No active watcher found for this project',
        });
        return;
      }

      // Stop watching
      await this.fileWatcherService.stopWatching();
      this.activeWatchers.delete(projectId);

      res.status(200).json({
        success: true,
        data: {
          projectId,
          status: 'stopped',
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async getWatcherStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { projectId } = req.params;

      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Project ID is required',
        });
        return;
      }

      const watcherPaths = this.activeWatchers.get(projectId);

      if (!watcherPaths) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'No active watcher found for this project',
        });
        return;
      }

      // Basic status - we can check if service is active
      const status = {
        projectId,
        isWatching: true,
        watchPaths: watcherPaths,
        activeWatchers: this.activeWatchers.size,
      };

      res.status(200).json({
        success: true,
        data: status,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async searchFiles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rootPath, pattern, options = {} } = req.body as FileSearchRequest;

      if (!rootPath || !pattern) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Root path and search pattern are required',
        });
        return;
      }

      const {
        caseSensitive = false,
        includeFiles = true,
        includeDirectories = false,
        maxResults = 100,
      } = options;

      const fs = require('fs');
      const path = require('path');
      const results: string[] = [];

      const searchRecursive = (currentPath: string) => {
        try {
          const items = fs.readdirSync(currentPath);

          for (const item of items) {
            if (results.length >= maxResults) break;

            const itemPath = path.join(currentPath, item);
            const stats = fs.statSync(itemPath);

            const itemMatches = caseSensitive
              ? item.includes(pattern)
              : item.toLowerCase().includes(pattern.toLowerCase());

            if (itemMatches) {
              if ((includeFiles && stats.isFile()) || (includeDirectories && stats.isDirectory())) {
                results.push(itemPath);
              }
            }

            if (stats.isDirectory()) {
              searchRecursive(itemPath);
            }
          }
        } catch (error) {
          // Skip directories we can't access
        }
      };

      searchRecursive(rootPath);

      res.status(200).json({
        success: true,
        data: {
          results,
          total: results.length,
          searchOptions: options,
          truncated: results.length >= maxResults,
        },
        metadata: {
          rootPath,
          pattern,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async analyzeDirectory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { rootPath, options = {} } = req.body as DirectoryAnalysisRequest;

      if (!rootPath) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Root path is required',
        });
        return;
      }

      const {
        includeStats = true,
        includeStructure = true,
        includeLargeFiles = true,
        largeFileThreshold = 10 * 1024 * 1024,
      } = options;

      const traversalResult = await this.fileSystemTraversal.traverseDirectory(rootPath);

      const analysis = {
        rootPath,
        files: traversalResult.files.length,
        directories: traversalResult.directories.length,
        totalSize: traversalResult.totalSize,
        errors: traversalResult.errors,
        ...(includeStats && {
          stats: {
            averageFileSize:
              traversalResult.files.length > 0
                ? traversalResult.totalSize / traversalResult.files.length
                : 0,
            largestFile: traversalResult.files.reduce(
              (largest, file) => (file.size > largest.size ? file : largest),
              { size: 0, path: '' }
            ),
            extensions: traversalResult.files.reduce(
              (acc, file) => {
                acc[file.extension] = (acc[file.extension] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            ),
          },
        }),
        ...(includeLargeFiles && {
          largeFiles: traversalResult.files.filter(file => file.size > largeFileThreshold),
        }),
        ...(includeStructure && {
          structure: {
            depth: this.calculateDirectoryDepth(traversalResult.directories),
            fileTypes: traversalResult.files.reduce(
              (acc, file) => {
                const type = this.getFileType(file.extension);
                acc[type] = (acc[type] || 0) + 1;
                return acc;
              },
              {} as Record<string, number>
            ),
          },
        }),
      };

      res.status(200).json({
        success: true,
        data: analysis,
        metadata: {
          rootPath,
          processingTime: traversalResult.processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  private async getFileInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filePath } = req.params;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'File path is required',
        });
        return;
      }

      const fs = require('fs').promises;
      const path = require('path');
      const stats = await fs.stat(filePath);

      const fileInfo = {
        path: filePath,
        name: path.basename(filePath),
        extension: path.extname(filePath),
        size: stats.size,
        lastModified: stats.mtime,
        created: stats.birthtime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        isSymbolicLink: stats.isSymbolicLink(),
      };

      res.status(200).json({
        success: true,
        data: fileInfo,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Path not found',
        });
      } else {
        next(error);
      }
    }
  }

  private async listDirectory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { dirPath } = req.params;

      if (!dirPath) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Directory path is required',
        });
        return;
      }

      const fs = require('fs').promises;
      const path = require('path');

      const items = await fs.readdir(dirPath);
      const result = [];

      for (const item of items) {
        try {
          const itemPath = path.join(dirPath, item);
          const stats = await fs.stat(itemPath);

          result.push({
            name: item,
            path: itemPath,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            size: stats.size,
            lastModified: stats.mtime,
          });
        } catch (error) {
          // Skip items we can't access
          result.push({
            name: item,
            path: path.join(dirPath, item),
            error: 'Access denied',
          });
        }
      }

      res.status(200).json({
        success: true,
        data: {
          path: dirPath,
          items,
          total: result.length,
        },
        metadata: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Directory not found',
        });
      } else {
        next(error);
      }
    }
  }

  private async pathExists(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { path: checkPath } = req.params;

      if (!checkPath) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Path is required',
        });
        return;
      }

      const fs = require('fs').promises;

      try {
        const stats = await fs.stat(checkPath);

        res.status(200).json({
          success: true,
          data: {
            path: checkPath,
            exists: true,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            isSymbolicLink: stats.isSymbolicLink(),
          },
          metadata: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        if ((error as any).code === 'ENOENT') {
          res.status(200).json({
            success: true,
            data: {
              path: checkPath,
              exists: false,
            },
            metadata: {
              timestamp: new Date().toISOString(),
            },
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      next(error);
    }
  }

  private calculateDirectoryDepth(directories: string[]): number {
    const depths = directories.map(dir => dir.split(path.sep).length);
    return Math.max(...depths, 0);
  }

  private getFileType(extension: string): string {
    const codeExtensions = [
      '.ts',
      '.js',
      '.tsx',
      '.jsx',
      '.py',
      '.java',
      '.go',
      '.rs',
      '.cpp',
      '.c',
      '.h',
      '.hpp',
    ];
    const docExtensions = ['.md', '.txt', '.doc', '.docx', '.pdf'];
    const configExtensions = ['.json', '.yaml', '.yml', '.xml', '.ini', '.conf'];
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
    const archiveExtensions = ['.zip', '.tar', '.gz', '.7z', '.rar'];

    if (codeExtensions.includes(extension)) return 'code';
    if (docExtensions.includes(extension)) return 'document';
    if (configExtensions.includes(extension)) return 'config';
    if (imageExtensions.includes(extension)) return 'image';
    if (archiveExtensions.includes(extension)) return 'archive';
    return 'other';
  }

  public getRouter(): Router {
    return this.router;
  }
}
