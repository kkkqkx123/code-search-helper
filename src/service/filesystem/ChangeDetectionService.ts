import { injectable, inject, optional } from 'inversify';
import { EventEmitter } from 'events';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService, ErrorContext } from '../../core/ErrorHandlerService';
import { FileWatcherService, FileWatcherOptions, FileWatcherCallbacks } from './FileWatcherService';
import { FileSystemTraversal, FileInfo } from './FileSystemTraversal';
import { TYPES } from '../../types';
import path from 'path';

export interface ChangeDetectionOptions {
  debounceInterval?: number;
  maxConcurrentOperations?: number;
  enableHashComparison?: boolean;
  trackFileHistory?: boolean;
  historySize?: number;
  enableDetailedLogging?: boolean;
  permissionRetryAttempts?: number;
  permissionRetryDelay?: number;
  maxFileSizeBytes?: number;
  excludedExtensions?: string[];
  excludedDirectories?: string[];
}

export interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted';
  path: string;
  relativePath: string;
  previousHash?: string;
  currentHash?: string;
  timestamp: Date;
  size?: number;
  language?: string;
}

export interface ChangeDetectionCallbacks {
  onFileCreated?: (event: FileChangeEvent) => void;
  onFileModified?: (event: FileChangeEvent) => void;
  onFileDeleted?: (event: FileChangeEvent) => void;
  onError?: (error: Error) => void;
}

export interface FileHistoryEntry {
  path: string;
  hash: string;
  timestamp: Date;
  size: number;
  language: string;
}

@injectable()
export class ChangeDetectionService extends EventEmitter {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private fileWatcherService: FileWatcherService;
  private fileSystemTraversal: FileSystemTraversal;
  private fileHashes: Map<string, string> = new Map();
  private fileHistory: Map<string, FileHistoryEntry[]> = new Map();
  private pendingChanges: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;
  private options: Required<ChangeDetectionOptions>;
  private callbacks: ChangeDetectionCallbacks = {};
  private stats = {
    filesProcessed: 0,
    changesDetected: 0,
    errorsEncountered: 0,
    permissionErrors: 0,
    averageProcessingTime: 0,
  };
  private testMode: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.FileWatcherService) fileWatcherService: FileWatcherService,
    @inject(TYPES.FileSystemTraversal) fileSystemTraversal: FileSystemTraversal,
    @inject('ChangeDetectionOptions') @optional() options?: ChangeDetectionOptions
  ) {
    super();
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.fileWatcherService = fileWatcherService;
    this.fileSystemTraversal = fileSystemTraversal;

    // Detect test environment
    this.testMode = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;

    this.options = {
      debounceInterval: this.testMode ? 100 : (options?.debounceInterval ?? 500),
      maxConcurrentOperations: options?.maxConcurrentOperations ?? 10,
      enableHashComparison: options?.enableHashComparison ?? true,
      trackFileHistory: options?.trackFileHistory ?? true,
      historySize: options?.historySize ?? 10,
      enableDetailedLogging: options?.enableDetailedLogging ?? false,
      permissionRetryAttempts: options?.permissionRetryAttempts ?? 3,
      permissionRetryDelay: this.testMode ? 100 : (options?.permissionRetryDelay ?? 1000),
      maxFileSizeBytes: options?.maxFileSizeBytes ?? 10 * 1024 * 1024, // 10MB
      excludedExtensions: options?.excludedExtensions ?? ['.log', '.tmp', '.bak'],
      excludedDirectories: options?.excludedDirectories ?? [
        'node_modules',
        '.git',
        'dist',
        'build',
      ],
    };

    if (this.testMode) {
      this.logger.info('ChangeDetectionService running in test mode - using optimized settings');
    }
  }

  setCallbacks(callbacks: ChangeDetectionCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  async initialize(rootPaths: string[], watcherOptions?: FileWatcherOptions): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('ChangeDetectionService is already initialized');
      return;
    }

    try {
      this.logger.info('Initializing ChangeDetectionService', { rootPaths, options: this.options });

      // Initialize file hashes for existing files
      await this.initializeFileHashes(rootPaths);

      // Set up file watcher callbacks
      const fileWatcherCallbacks: FileWatcherCallbacks = {
        onFileAdded: fileInfo => this.handleFileAdded(fileInfo),
        onFileChanged: fileInfo => this.handleFileChanged(fileInfo),
        onFileDeleted: filePath => this.handleFileDeleted(filePath),
        onError: error => this.handleWatcherError(error),
        onReady: () => this.handleWatcherReady(),
      };

      this.fileWatcherService.setCallbacks(fileWatcherCallbacks);

      // Start watching files
      const watchOptions: FileWatcherOptions = {
        watchPaths: rootPaths,
        ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
        ignoreInitial: true,
        awaitWriteFinish: true,
        awaitWriteFinishOptions: {
          stabilityThreshold: this.options.debounceInterval,
          pollInterval: this.testMode ? 25 : 100,
        },
        // Test-specific optimizations
        usePolling: this.testMode,
        interval: this.testMode ? 50 : undefined,
        ...watcherOptions,
      };

      await this.fileWatcherService.startWatching(watchOptions);
      this.isRunning = true;

      this.logger.info('ChangeDetectionService initialized successfully');
    } catch (error) {
      const errorContext: ErrorContext = {
        component: 'ChangeDetectionService',
        operation: 'initialize',
        metadata: { rootPaths, options: this.options },
      };

      const report = this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      this.logger.error('Failed to initialize ChangeDetectionService', { errorId: report.id });
      throw error;
    }
  }

  private async initializeFileHashes(rootPaths: string[]): Promise<void> {
    try {
      for (const rootPath of rootPaths) {
        const result = await this.fileSystemTraversal.traverseDirectory(rootPath);

        for (const file of result.files) {
          this.fileHashes.set(file.relativePath, file.hash);

          if (this.options.trackFileHistory) {
            this.addFileHistoryEntry(file);
          }
        }
      }

      this.logger.info(`Initialized file hashes for ${this.fileHashes.size} files`);
    } catch (error) {
      const errorContext: ErrorContext = {
        component: 'ChangeDetectionService',
        operation: 'initializeFileHashes',
        metadata: { rootPaths },
      };

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      throw error;
    }
  }

  private addFileHistoryEntry(file: FileInfo): void {
    if (!this.options.trackFileHistory) return;

    const history = this.fileHistory.get(file.relativePath) || [];
    const entry: FileHistoryEntry = {
      path: file.path,
      hash: file.hash,
      timestamp: new Date(),
      size: file.size,
      language: file.language,
    };

    history.push(entry);

    // Keep only the most recent entries
    if (history.length > this.options.historySize) {
      history.shift();
    }

    this.fileHistory.set(file.relativePath, history);
  }

  private async handleFileAdded(fileInfo: FileInfo): Promise<void> {
    try {
      this.logger.debug(`File added: ${fileInfo.relativePath}`);

      const previousHash = this.fileHashes.get(fileInfo.relativePath);

      if (previousHash === undefined) {
        // New file
        this.fileHashes.set(fileInfo.relativePath, fileInfo.hash);

        if (this.options.trackFileHistory) {
          this.addFileHistoryEntry(fileInfo);
        }

        const event: FileChangeEvent = {
          type: 'created',
          path: fileInfo.path,
          relativePath: fileInfo.relativePath,
          currentHash: fileInfo.hash,
          timestamp: new Date(),
          size: fileInfo.size,
          language: fileInfo.language,
        };

        this.emit('fileCreated', event);

        if (this.callbacks.onFileCreated) {
          try {
            this.callbacks.onFileCreated(event);
          } catch (error) {
            this.logger.error('Error in onFileCreated callback', error);
          }
        }
      }
    } catch (error) {
      this.handleFileEventError('add', fileInfo.relativePath, error);
    }
  }

  private async handleFileChanged(fileInfo: FileInfo): Promise<void> {
    try {
      this.logger.debug(`File changed: ${fileInfo.relativePath}`);

      const previousHash = this.fileHashes.get(fileInfo.relativePath);

      if (previousHash === undefined) {
        // File not tracked yet, treat as new
        await this.handleFileAdded(fileInfo);
        return;
      }

      // Debounce rapid changes
      if (this.pendingChanges.has(fileInfo.relativePath)) {
        clearTimeout(this.pendingChanges.get(fileInfo.relativePath)!);
      }

      const timeoutId = setTimeout(async () => {
        try {
          const currentHash = this.options.enableHashComparison
            ? await this.fileSystemTraversal['calculateFileHash'](fileInfo.path)
            : fileInfo.hash;

          if (previousHash !== currentHash) {
            // Actual content change
            this.fileHashes.set(fileInfo.relativePath, currentHash);

            if (this.options.trackFileHistory) {
              this.addFileHistoryEntry({
                ...fileInfo,
                hash: currentHash,
              });
            }

            const event: FileChangeEvent = {
              type: 'modified',
              path: fileInfo.path,
              relativePath: fileInfo.relativePath,
              previousHash,
              currentHash,
              timestamp: new Date(),
              size: fileInfo.size,
              language: fileInfo.language,
            };

            this.emit('fileModified', event);

            if (this.callbacks.onFileModified) {
              try {
                this.callbacks.onFileModified(event);
              } catch (error) {
                this.logger.error('Error in onFileModified callback', error);
              }
            }
          }
        } catch (error) {
          this.handleFileEventError('change', fileInfo.relativePath, error);
        } finally {
          this.pendingChanges.delete(fileInfo.relativePath);
        }
      }, this.options.debounceInterval);

      this.pendingChanges.set(fileInfo.relativePath, timeoutId);
    } catch (error) {
      this.handleFileEventError('change', fileInfo.relativePath, error);
    }
  }

  private handleFileDeleted(filePath: string): void {
    try {
      this.logger.debug(`File deleted: ${filePath}`);

      // Convert to relative path for consistency
      const relativePath = path.relative(process.cwd(), filePath);
      const previousHash = this.fileHashes.get(relativePath);

      if (previousHash !== undefined) {
        this.fileHashes.delete(relativePath);

        const event: FileChangeEvent = {
          type: 'deleted',
          path: filePath,
          relativePath,
          previousHash,
          timestamp: new Date(),
        };

        this.emit('fileDeleted', event);

        if (this.callbacks.onFileDeleted) {
          try {
            this.callbacks.onFileDeleted(event);
          } catch (error) {
            this.logger.error('Error in onFileDeleted callback', error);
          }
        }
      }
    } catch (error) {
      this.handleFileEventError('delete', filePath, error);
    }
  }

  private handleWatcherError(error: Error): void {
    const errorContext: ErrorContext = {
      component: 'ChangeDetectionService',
      operation: 'watcher',
      metadata: {},
    };

    this.errorHandler.handleError(error, errorContext);
    this.logger.error('File watcher error', error);

    if (this.callbacks.onError) {
      try {
        this.callbacks.onError(error);
      } catch (callbackError) {
        this.logger.error('Error in onError callback', callbackError);
      }
    }
  }

  private handleWatcherReady(): void {
    this.logger.info('File watcher is ready');
  }

  private handleFileEventError(eventType: string, filePath: string, error: any): void {
    const errorContext: ErrorContext = {
      component: 'ChangeDetectionService',
      operation: `fileEvent:${eventType}`,
      metadata: { filePath },
    };

    this.errorHandler.handleError(
      error instanceof Error ? error : new Error(String(error)),
      errorContext
    );

    this.logger.error(`Error handling ${eventType} event for file ${filePath}`, error);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('ChangeDetectionService is not running');
      return;
    }

    try {
      this.logger.info('Stopping ChangeDetectionService');

      // Clear any pending changes
      for (const timeoutId of this.pendingChanges.values()) {
        clearTimeout(timeoutId);
      }
      this.pendingChanges.clear();

      // Stop the file watcher
      await this.fileWatcherService.stopWatching();

      this.isRunning = false;
      this.logger.info('ChangeDetectionService stopped successfully');
    } catch (error) {
      const errorContext: ErrorContext = {
        component: 'ChangeDetectionService',
        operation: 'stop',
      };

      this.errorHandler.handleError(
        error instanceof Error ? error : new Error(String(error)),
        errorContext
      );

      throw error;
    }
  }

  getFileHash(relativePath: string): string | undefined {
    return this.fileHashes.get(relativePath);
  }

  getFileHistory(relativePath: string): FileHistoryEntry[] {
    return this.fileHistory.get(relativePath) || [];
  }

  getAllFileHashes(): Map<string, string> {
    return new Map(this.fileHashes);
  }

  isFileTracked(relativePath: string): boolean {
    return this.fileHashes.has(relativePath);
  }

  getTrackedFilesCount(): number {
    return this.fileHashes.size;
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }

  getStats() {
    return { ...this.stats };
  }

  resetStats(): void {
    this.stats = {
      filesProcessed: 0,
      changesDetected: 0,
      errorsEncountered: 0,
      permissionErrors: 0,
      averageProcessingTime: 0,
    };
  }

  // Test environment helper methods
  isTestMode(): boolean {
    return this.testMode;
  }

  async waitForFileProcessing(filePath: string, timeout: number = 3000): Promise<boolean> {
    if (!this.testMode) {
      return true;
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Check if file is being processed (has pending changes)
      if (!this.pendingChanges.has(filePath)) {
        return true;
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return false;
  }

  async waitForAllProcessing(timeout: number = 5000): Promise<boolean> {
    if (!this.testMode) {
      return true;
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // Check if all pending changes are processed
      if (this.pendingChanges.size === 0) {
        return true;
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return false;
  }

  async flushPendingChanges(): Promise<void> {
    if (!this.testMode) {
      return;
    }

    // Wait for all pending changes to be processed
    await this.waitForAllProcessing();

    // Additional wait to ensure stability
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
