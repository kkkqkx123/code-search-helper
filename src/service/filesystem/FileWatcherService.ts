import { injectable, inject, optional } from 'inversify';
import chokidar, { FSWatcher, ChokidarOptions } from 'chokidar';
import * as path from 'path';
import * as fs from 'fs/promises';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { GitignoreParser } from '../ignore/GitignoreParser';
import { DEFAULT_IGNORE_PATTERNS } from './defaultIgnorePatterns';
import { LANGUAGE_MAP, DEFAULT_SUPPORTED_EXTENSIONS } from './languageConstants';

// 定义错误上下文接口
interface ErrorContext {
  component: string;
  operation: string;
 metadata?: Record<string, any>;
}

// 定义 CodebaseIndexError 类
class CodebaseIndexError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'CodebaseIndexError';
  }
}
import { FileSystemTraversal, FileInfo, TraversalOptions } from './FileSystemTraversal';
import { TYPES } from '../../types';

export interface FileWatcherOptions {
  watchPaths: string[];
  ignored?: string[];
  ignoreInitial?: boolean;
  followSymlinks?: boolean;
  cwd?: string;
  usePolling?: boolean;
  interval?: number;
  binaryInterval?: number;
  alwaysStat?: boolean;
  depth?: number;
 awaitWriteFinish?: boolean;
  awaitWriteFinishOptions?: {
    stabilityThreshold?: number;
    pollInterval?: number;
  };
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  stats?: any;
}

export interface FileWatcherCallbacks {
 onFileAdded?: (fileInfo: FileInfo) => void;
 onFileChanged?: (fileInfo: FileInfo) => void;
 onFileDeleted?: (filePath: string) => void;
 onDirectoryAdded?: (dirPath: string) => void;
  onDirectoryDeleted?: (dirPath: string) => void;
  onError?: (error: Error) => void;
  onReady?: () => void;
}

@injectable()
export class FileWatcherService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private fileSystemTraversal: FileSystemTraversal;
 private watchers: Map<string, FSWatcher> = new Map();
  private callbacks: FileWatcherCallbacks = {};
  private isWatching: boolean = false;
  private traversalOptions: TraversalOptions;
  private eventQueue: Map<string, FileChangeEvent[]> = new Map();
 private processingQueue: boolean = false;
 private eventProcessingTimer: NodeJS.Timeout | null = null;
 private retryAttempts: Map<string, number> = new Map();
  private maxRetries: number = 3;
  private retryDelay: number = 50;
  private testMode: boolean = false;
  private maxEventQueueSize: number = 1000; // 最大事件队列大小
  private allIgnorePatterns: string[] = [];
  private gitignorePatterns: string[] = [];
  private indexignorePatterns: string[] = [];

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.FileSystemTraversal) fileSystemTraversal: FileSystemTraversal,
    @inject('TraversalOptions') @optional() traversalOptions?: TraversalOptions
 ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.fileSystemTraversal = fileSystemTraversal;
    this.traversalOptions = traversalOptions || {};

    // Detect test environment
    this.testMode = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

    if (this.testMode) {
      this.logger.info('FileWatcherService running in test mode - using optimized settings');
    }

    // Initialize ignore patterns
    this.initializeIgnorePatterns();
  }

 private async initializeIgnorePatterns(): Promise<void> {
    // Initialize with default patterns
    this.allIgnorePatterns = [...DEFAULT_IGNORE_PATTERNS];
    
    // Add custom exclude patterns from traversal options
    if (this.traversalOptions.excludePatterns) {
      this.allIgnorePatterns.push(...this.traversalOptions.excludePatterns);
    }
 }

  async refreshIgnoreRules(watchPath: string): Promise<void> {
    try {
      // Clear previous gitignore and indexignore patterns
      this.gitignorePatterns = [];
      this.indexignorePatterns = [];

      // Load .gitignore patterns if enabled
      if (this.traversalOptions.respectGitignore !== false) {
        this.gitignorePatterns = await GitignoreParser.getAllGitignorePatterns(watchPath);
        this.allIgnorePatterns.push(...this.gitignorePatterns);
      }

      // Load .indexignore patterns
      this.indexignorePatterns = await GitignoreParser.parseIndexignore(watchPath);
      this.allIgnorePatterns.push(...this.indexignorePatterns);

      // Add custom exclude patterns
      if (this.traversalOptions.excludePatterns) {
        this.allIgnorePatterns = [
          ...DEFAULT_IGNORE_PATTERNS,
          ...this.gitignorePatterns,
          ...this.indexignorePatterns,
          ...this.traversalOptions.excludePatterns
        ];
      } else {
        this.allIgnorePatterns = [
          ...DEFAULT_IGNORE_PATTERNS,
          ...this.gitignorePatterns,
          ...this.indexignorePatterns
        ];
      }

      // Remove duplicates
      this.allIgnorePatterns = [...new Set(this.allIgnorePatterns)];

      this.logger.debug(`Refreshed ignore rules for ${watchPath}`, {
        defaultPatterns: DEFAULT_IGNORE_PATTERNS.length,
        gitignorePatterns: this.gitignorePatterns.length,
        indexignorePatterns: this.indexignorePatterns.length,
        customPatterns: this.traversalOptions.excludePatterns?.length || 0,
        totalPatterns: this.allIgnorePatterns.length
      });
    } catch (error) {
      this.logger.error('Error refreshing ignore rules', error);
    }
 }

  setCallbacks(callbacks: FileWatcherCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  async startWatching(options: FileWatcherOptions): Promise<void> {
    if (this.isWatching) {
      this.logger.warn('FileWatcherService is already watching');
      return;
    }

    try {
      this.logger.info('Starting file watcher', { options });

      for (const watchPath of options.watchPaths) {
        // Refresh ignore rules for this watch path
        await this.refreshIgnoreRules(watchPath);
        await this.watchPath(watchPath, options);
      }

      this.isWatching = true;
      this.logger.info('File watcher started successfully');
    } catch (error) {
      const errorContext: ErrorContext = {
        component: 'FileWatcherService',
        operation: 'startWatching',
        metadata: { options },
      };

      const report = this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      this.logger.error('Failed to start file watcher', { errorId: report.id });
      throw error;
    }
  }

  private async watchPath(watchPath: string, options: FileWatcherOptions): Promise<void> {
    try {
      // Check if path exists
      try {
        await fs.access(watchPath);
      } catch (error) {
        this.logger.warn(`Watch path does not exist: ${watchPath}`);
        return;
      }

      const chokidarOptions: ChokidarOptions = {
        ignored: options.ignored || [],
        ignoreInitial: options.ignoreInitial ?? true,
        followSymlinks: options.followSymlinks ?? false,
        // Test-specific optimizations
        usePolling: this.testMode ? true : (options.usePolling ?? false),
        alwaysStat: this.testMode ? true : (options.alwaysStat ?? true),
        // More aggressive polling for test environments
        interval: this.testMode ? 50 : (options.interval ?? 100),
        binaryInterval: this.testMode ? 100 : (options.binaryInterval ?? 300),
        // Test-specific stability settings
        awaitWriteFinish: this.testMode ? true : (options.awaitWriteFinish ?? true),
        ...(options.cwd !== undefined && { cwd: options.cwd }),
        ...(options.depth !== undefined && { depth: options.depth }),
        ...(options.interval !== undefined && { interval: options.interval }),
        ...(options.binaryInterval !== undefined && { binaryInterval: options.binaryInterval }),
        ...(options.awaitWriteFinish !== undefined && {
          awaitWriteFinish: options.awaitWriteFinish
            ? {
                stabilityThreshold:
                  options.awaitWriteFinishOptions?.stabilityThreshold ??
                  (this.testMode ? 100 : 200),
                pollInterval:
                  options.awaitWriteFinishOptions?.pollInterval ?? (this.testMode ? 25 : 100),
              }
            : false,
        }),
      };

      const watcher = chokidar.watch(watchPath, chokidarOptions);

      watcher
        .on('ready', () => this.handleWatcherReady(watchPath))
        .on('add', (filePath, stats) => this.queueFileEvent('add', filePath, stats, watchPath))
        .on('change', (filePath, stats) =>
          this.queueFileEvent('change', filePath, stats, watchPath)
        )
        .on('unlink', filePath => this.queueFileEvent('unlink', filePath, undefined, watchPath))
        .on('addDir', dirPath => this.queueFileEvent('addDir', dirPath, undefined, watchPath))
        .on('unlinkDir', dirPath => this.queueFileEvent('unlinkDir', dirPath, undefined, watchPath))
        .on('error', (error: unknown) => this.handleWatcherError(error as Error, watchPath));

      this.watchers.set(watchPath, watcher);
      this.logger.info(`Started watching path: ${watchPath}`);
    } catch (error) {
      const errorContext: ErrorContext = {
        component: 'FileWatcherService',
        operation: 'watchPath',
        metadata: { watchPath, options },
      };

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      throw error;
    }
  }

  private handleWatcherReady(watchPath: string): void {
    this.logger.info(`File watcher ready for path: ${watchPath}`);

    if (this.callbacks.onReady) {
      try {
        this.callbacks.onReady();
      } catch (error) {
        this.logger.error('Error in onReady callback', error);
      }
    }
  }

  private async handleFileAdd(filePath: string, stats: any, watchPath: string): Promise<void> {
    try {
      this.logger.debug(`File added: ${filePath}`, { size: stats?.size });

      // Get file info using FileSystemTraversal
      const fileInfo = await this.getFileInfo(filePath, watchPath);

      if (fileInfo && this.callbacks.onFileAdded) {
        try {
          this.callbacks.onFileAdded(fileInfo);
        } catch (error) {
          this.logger.error('Error in onFileAdded callback', error);
        }
      }
    } catch (error) {
      this.handleFileEventError('add', filePath, error);
    }
  }

  private async handleFileChange(filePath: string, stats: any, watchPath: string): Promise<void> {
    try {
      this.logger.debug(`File changed: ${filePath}`, { size: stats?.size });

      // Get file info using FileSystemTraversal
      const fileInfo = await this.getFileInfo(filePath, watchPath);

      if (fileInfo && this.callbacks.onFileChanged) {
        try {
          this.callbacks.onFileChanged(fileInfo);
        } catch (error) {
          this.logger.error('Error in onFileChanged callback', error);
        }
      }
    } catch (error) {
      this.handleFileEventError('change', filePath, error);
    }
  }

  private handleFileDelete(filePath: string, watchPath: string): void {
    try {
      this.logger.debug(`File deleted: ${filePath}`);

      if (this.callbacks.onFileDeleted) {
        try {
          this.callbacks.onFileDeleted(filePath);
        } catch (error) {
          this.logger.error('Error in onFileDeleted callback', error);
        }
      }
    } catch (error) {
      this.handleFileEventError('delete', filePath, error);
    }
  }

  private handleDirectoryAdd(dirPath: string, watchPath: string): void {
    try {
      this.logger.debug(`Directory added: ${dirPath}`);

      if (this.callbacks.onDirectoryAdded) {
        try {
          this.callbacks.onDirectoryAdded(dirPath);
        } catch (error) {
          this.logger.error('Error in onDirectoryAdded callback', error);
        }
      }
    } catch (error) {
      this.handleFileEventError('addDir', dirPath, error);
    }
  }

  private handleDirectoryDelete(dirPath: string, watchPath: string): void {
    try {
      this.logger.debug(`Directory deleted: ${dirPath}`);

      if (this.callbacks.onDirectoryDeleted) {
        try {
          this.callbacks.onDirectoryDeleted(dirPath);
        } catch (error) {
          this.logger.error('Error in onDirectoryDeleted callback', error);
        }
      }
    } catch (error) {
      this.handleFileEventError('unlinkDir', dirPath, error);
    }
  }

 private handleWatcherError(error: Error, watchPath: string): void {
    const errorContext: ErrorContext = {
      component: 'FileWatcherService',
      operation: 'watcher',
      metadata: { watchPath },
    };

    this.errorHandler.handleError(error, errorContext);
    this.logger.error(`File watcher error for path ${watchPath}`, error);

    if (this.callbacks.onError) {
      try {
        this.callbacks.onError(error);
      } catch (callbackError) {
        this.logger.error('Error in onError callback', callbackError);
      }
    }
  }

  private handleFileEventError(eventType: string, filePath: string, error: any): void {
    const errorContext: ErrorContext = {
      component: 'FileWatcherService',
      operation: `fileEvent:${eventType}`,
      metadata: { filePath },
    };

    this.errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      errorContext
    );

    this.logger.error(`Error handling ${eventType} event for file ${filePath}`, error);
  }

  private queueFileEvent(type: string, filePath: string, stats: any, watchPath: string): void {
    const event: FileChangeEvent = {
      type: type as FileChangeEvent['type'],
      path: filePath,
      stats,
    };

    // Queue the event for processing
    if (!this.eventQueue.has(watchPath)) {
      this.eventQueue.set(watchPath, []);
    }

    const queue = this.eventQueue.get(watchPath)!;

    // 检查队列大小限制，防止内存泄漏
    if (queue.length >= this.maxEventQueueSize) {
      // 删除最旧的事件
      queue.shift();
      this.logger.warn(`Event queue for ${watchPath} exceeded limit, removed oldest event`);
    }

    queue.push(event);

    // Reset retry counter for this path
    this.retryAttempts.delete(filePath);

    // Schedule processing
    this.scheduleEventProcessing();
  }

  private scheduleEventProcessing(): void {
    if (this.eventProcessingTimer) {
      clearTimeout(this.eventProcessingTimer);
    }

    // Use shorter delay in test mode for faster processing
    const delay = this.testMode ? 10 : 50;

    this.eventProcessingTimer = setTimeout(() => {
      this.processEventQueue();
    }, delay);
  }

  private async processEventQueue(): Promise<void> {
    if (this.processingQueue) {
      return;
    }

    this.processingQueue = true;

    try {
      for (const [watchPath, events] of this.eventQueue.entries()) {
        for (const event of events) {
          await this.processFileEvent(event, watchPath);
        }
      }

      // Clear processed events
      this.eventQueue.clear();
    } catch (error) {
      this.logger.error('Error processing event queue', error);
    } finally {
      this.processingQueue = false;
    }
  }

  private async processFileEvent(event: FileChangeEvent, watchPath: string): Promise<void> {
    const maxRetries = this.testMode ? 5 : this.maxRetries;
    const retryDelay = this.testMode ? 20 : this.retryDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        switch (event.type) {
          case 'add':
            await this.handleFileAdd(event.path, event.stats, watchPath);
            break;
          case 'change':
            await this.handleFileChange(event.path, event.stats, watchPath);
            break;
          case 'unlink':
            this.handleFileDelete(event.path, watchPath);
            break;
          case 'addDir':
            this.handleDirectoryAdd(event.path, watchPath);
            break;
          case 'unlinkDir':
            this.handleDirectoryDelete(event.path, watchPath);
            break;
        }

        // Success - clear retry counter
        this.retryAttempts.delete(event.path);
        break;
      } catch (error) {
        const currentAttempt = this.retryAttempts.get(event.path) || 0;
        this.retryAttempts.set(event.path, currentAttempt + 1);

        if (attempt === maxRetries) {
          this.logger.error(
            `Failed to process ${event.type} event for ${event.path} after ${maxRetries} attempts`,
            error
          );
          this.handleFileEventError(event.type, event.path, error);
          break;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }

  // Helper method for test environments
  async waitForEvents(processedCallback: () => boolean, timeout: number = 5000): Promise<boolean> {
    if (!this.testMode) {
      return true;
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (processedCallback()) {
        return true;
      }

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return false;
 }

  // Helper method for test environments
  async flushEventQueue(): Promise<void> {
    if (!this.testMode) {
      return;
    }

    // Process any remaining events
    await this.processEventQueue();

    // Wait a bit more to ensure all events are processed
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  isTestMode(): boolean {
    return this.testMode;
  }

 private async getFileInfo(filePath: string, watchPath: string): Promise<FileInfo | null> {
    try {
      const rootPath = path.resolve(watchPath);
      const fullPath = path.resolve(filePath);

      // Check if file is within the watch path
      if (!fullPath.startsWith(rootPath)) {
        this.logger.warn(`File path is outside watch path: ${filePath}`);
        return null;
      }

      const relativePath = path.relative(rootPath, fullPath);
      const stats = await fs.stat(fullPath);

      // Check file size
      const maxFileSize = this.traversalOptions.maxFileSize || 10 * 1024 * 1024; // 10MB default
      if (stats.size > maxFileSize) {
        this.logger.warn(`File too large: ${relativePath} (${stats.size} bytes)`);
        return null;
      }

      // Check if file should be ignored
      if (this.shouldIgnoreFile(relativePath)) {
        return null;
      }

      const extension = path.extname(fullPath).toLowerCase();
      const language = this.detectLanguage(extension);

      if (!language) {
        return null;
      }

      const isBinary = await this.fileSystemTraversal['isBinaryFile'](fullPath);
      if (isBinary) {
        return null;
      }

      const hash = await this.fileSystemTraversal['calculateFileHash'](fullPath);

      return {
        path: fullPath,
        relativePath,
        name: path.basename(fullPath),
        extension,
        size: stats.size,
        hash,
        lastModified: stats.mtime,
        language,
        isBinary,
      };
    } catch (error) {
      this.logger.error(`Error getting file info for ${filePath}`, error);
      return null;
    }
  }

  private shouldIgnoreFile(relativePath: string): boolean {
    const fileName = path.basename(relativePath).toLowerCase();

    // Check hidden files
    if (this.traversalOptions.ignoreHiddenFiles !== false && fileName.startsWith('.')) {
      return true;
    }

    // Check ignore patterns
    for (const pattern of this.allIgnorePatterns) {
      if (this.fileSystemTraversal['matchesPattern'](relativePath, pattern)) {
        return true;
      }
    }

    return false;
 }
private detectLanguage(extension: string): string | null {
  const supportedExtensions = this.traversalOptions.supportedExtensions || DEFAULT_SUPPORTED_EXTENSIONS;

  const language = LANGUAGE_MAP[extension];
  return language && supportedExtensions.includes(extension) ? language : null;
}


  async stopWatching(): Promise<void> {
    if (!this.isWatching) {
      this.logger.warn('FileWatcherService is not watching');
      return;
    }

    try {
      this.logger.info('Stopping file watcher');

      // Clear the event processing timer if it exists
      if (this.eventProcessingTimer) {
        clearTimeout(this.eventProcessingTimer);
        this.eventProcessingTimer = null;
      }

      const closePromises: Promise<void>[] = [];

      for (const [watchPath, watcher] of this.watchers) {
        closePromises.push(
          new Promise<void>(resolve => {
            watcher
              .close()
              .then(() => {
                this.logger.info(`Stopped watching path: ${watchPath}`);
                resolve();
              })
              .catch(error => {
                this.logger.error(`Error stopping watcher for path ${watchPath}`, error);
                resolve();
              });
          })
        );
      }

      await Promise.all(closePromises);

      this.watchers.clear();
      this.isWatching = false;
      this.logger.info('File watcher stopped successfully');
    } catch (error) {
      const errorContext: ErrorContext = {
        component: 'FileWatcherService',
        operation: 'stopWatching',
      };

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      throw error;
    }
  }

  isWatchingPath(watchPath: string): boolean {
    return this.watchers.has(watchPath);
  }

  getWatchedPaths(): string[] {
    return Array.from(this.watchers.keys());
  }
}