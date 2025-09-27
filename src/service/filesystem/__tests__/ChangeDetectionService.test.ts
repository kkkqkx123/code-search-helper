import { ChangeDetectionService, ChangeDetectionOptions, ChangeDetectionCallbacks, FileChangeEvent } from '../ChangeDetectionService';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { FileWatcherService, FileWatcherOptions, FileWatcherCallbacks } from '../FileWatcherService';
import { FileSystemTraversal, FileInfo, TraversalResult } from '../FileSystemTraversal';
import { TYPES } from '../../../types';
import { Container } from 'inversify';
import path from 'path';

// Mock modules
jest.mock('../../../utils/LoggerService');
jest.mock('../../../utils/ErrorHandlerService');
jest.mock('../FileWatcherService');
jest.mock('../FileSystemTraversal');

const MockedLoggerService = LoggerService as jest.Mocked<typeof LoggerService>;
const MockedErrorHandlerService = ErrorHandlerService as jest.Mocked<typeof ErrorHandlerService>;
const MockedFileWatcherService = FileWatcherService as jest.Mocked<typeof FileWatcherService>;
const MockedFileSystemTraversal = FileSystemTraversal as jest.Mocked<typeof FileSystemTraversal>;

describe('ChangeDetectionService', () => {
  let changeDetectionService: ChangeDetectionService;
  let mockLogger: LoggerService;
  let mockErrorHandler: ErrorHandlerService;
  let mockFileWatcherService: FileWatcherService;
  let mockFileSystemTraversal: FileSystemTraversal;
  let container: Container;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Create a container for dependency injection
    container = new Container();

    // Create mock services
    mockLogger = new MockedLoggerService();
    mockErrorHandler = new MockedErrorHandlerService();
    mockFileWatcherService = new MockedFileWatcherService();
    mockFileSystemTraversal = new MockedFileSystemTraversal();

    // Bind services to container
    container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLogger);
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandler);
    container.bind<FileWatcherService>(TYPES.FileWatcherService).toConstantValue(mockFileWatcherService);
    container.bind<FileSystemTraversal>(TYPES.FileSystemTraversal).toConstantValue(mockFileSystemTraversal);

    // Create ChangeDetectionService instance
    changeDetectionService = container.resolve(ChangeDetectionService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialize', () => {
    it('should initialize with root paths and set up file watcher', async () => {
      const rootPaths = ['/test/path1', '/test/path2'];
      const mockTraversalResult: TraversalResult = {
        files: [
          {
            path: '/test/path1/file1.ts',
            relativePath: 'file1.ts',
            name: 'file1.ts',
            extension: '.ts',
            size: 1024,
            hash: 'hash1',
            lastModified: new Date(),
            language: 'typescript',
            isBinary: false,
          },
        ],
        directories: [],
        errors: [],
        totalSize: 1024,
        processingTime: 100,
      };

      mockFileSystemTraversal.traverseDirectory.mockResolvedValue(mockTraversalResult);
      mockFileWatcherService.setCallbacks = jest.fn();
      mockFileWatcherService.startWatching = jest.fn().mockResolvedValue(undefined);

      await changeDetectionService.initialize(rootPaths);

      expect(mockFileSystemTraversal.traverseDirectory).toHaveBeenCalledTimes(2);
      expect(mockFileWatcherService.setCallbacks).toHaveBeenCalledWith(
        expect.objectContaining({
          onFileAdded: expect.any(Function),
          onFileChanged: expect.any(Function),
          onFileDeleted: expect.any(Function),
          onError: expect.any(Function),
          onReady: expect.any(Function),
        })
      );
      expect(mockFileWatcherService.startWatching).toHaveBeenCalledWith(
        expect.objectContaining({
          watchPaths: rootPaths,
          ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
          ignoreInitial: true,
          awaitWriteFinish: true,
        })
      );
      expect((changeDetectionService as any).isRunning).toBe(true);
    });

    it('should not initialize if already running', async () => {
      (changeDetectionService as any).isRunning = true;

      await changeDetectionService.initialize(['/test/path']);

      expect(mockLogger.warn).toHaveBeenCalledWith('ChangeDetectionService is already initialized');
      expect(mockFileSystemTraversal.traverseDirectory).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should stop the service and clear pending changes', async () => {
      // Set up initial state
      (changeDetectionService as any).isRunning = true;
      (changeDetectionService as any).pendingChanges.set('file.ts', setTimeout(() => {}, 100));
      mockFileWatcherService.stopWatching = jest.fn().mockResolvedValue(undefined);

      await changeDetectionService.stop();

      expect(mockFileWatcherService.stopWatching).toHaveBeenCalled();
      expect((changeDetectionService as any).pendingChanges.size).toBe(0);
      expect((changeDetectionService as any).isRunning).toBe(false);
    });

    it('should warn if not running when stop is called', async () => {
      await changeDetectionService.stop();

      expect(mockLogger.warn).toHaveBeenCalledWith('ChangeDetectionService is not running');
    });
  });

  describe('file event handling', () => {
    let mockFileInfo: FileInfo;
    let callbacks: ChangeDetectionCallbacks;

    beforeEach(() => {
      mockFileInfo = {
        path: '/test/file.ts',
        relativePath: 'file.ts',
        name: 'file.ts',
        extension: '.ts',
        size: 1024,
        hash: 'hash1',
        lastModified: new Date(),
        language: 'typescript',
        isBinary: false,
      };

      callbacks = {
        onFileCreated: jest.fn(),
        onFileModified: jest.fn(),
        onFileDeleted: jest.fn(),
      };

      changeDetectionService.setCallbacks(callbacks);
    });

    it('should handle file added event', async () => {
      await (changeDetectionService as any).handleFileAdded(mockFileInfo);

      const expectedEvent: FileChangeEvent = {
        type: 'created',
        path: mockFileInfo.path,
        relativePath: mockFileInfo.relativePath,
        currentHash: mockFileInfo.hash,
        timestamp: expect.any(Date),
        size: mockFileInfo.size,
        language: mockFileInfo.language,
      };

      expect(callbacks.onFileCreated).toHaveBeenCalledWith(expectedEvent);
      expect((changeDetectionService as any).fileHashes.get(mockFileInfo.relativePath)).toBe(mockFileInfo.hash);
    });

    it('should handle file changed event with debounce', async () => {
      // Set up initial hash
      (changeDetectionService as any).fileHashes.set(mockFileInfo.relativePath, 'oldhash');
      mockFileSystemTraversal['calculateFileHash'] = jest.fn().mockResolvedValue('newhash');

      await (changeDetectionService as any).handleFileChanged(mockFileInfo);

      // Should not trigger callback immediately due to debounce
      expect(callbacks.onFileModified).not.toHaveBeenCalled();

      // Fast-forward timers to trigger debounce
      jest.advanceTimersByTime(500);

      const expectedEvent: FileChangeEvent = {
        type: 'modified',
        path: mockFileInfo.path,
        relativePath: mockFileInfo.relativePath,
        previousHash: 'oldhash',
        currentHash: 'newhash',
        timestamp: expect.any(Date),
        size: mockFileInfo.size,
        language: mockFileInfo.language,
      };

      expect(callbacks.onFileModified).toHaveBeenCalledWith(expectedEvent);
      expect((changeDetectionService as any).fileHashes.get(mockFileInfo.relativePath)).toBe('newhash');
    });

    it('should handle file deleted event', () => {
      // Set up initial hash
      (changeDetectionService as any).fileHashes.set('file.ts', 'hash1');

      (changeDetectionService as any).handleFileDeleted('/test/file.ts');

      const expectedEvent: FileChangeEvent = {
        type: 'deleted',
        path: '/test/file.ts',
        relativePath: 'file.ts',
        previousHash: 'hash1',
        timestamp: expect.any(Date),
      };

      expect(callbacks.onFileDeleted).toHaveBeenCalledWith(expectedEvent);
      expect((changeDetectionService as any).fileHashes.has('file.ts')).toBe(false);
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      // Set up some initial data
      (changeDetectionService as any).fileHashes.set('file1.ts', 'hash1');
      (changeDetectionService as any).fileHashes.set('file2.js', 'hash2');
      (changeDetectionService as any).fileHistory.set('file1.ts', [
        {
          path: '/test/file1.ts',
          hash: 'oldhash1',
          timestamp: new Date(Date.now() - 1000),
          size: 512,
          language: 'typescript',
        },
      ]);
      (changeDetectionService as any).isRunning = true;
    });

    it('should get file hash', () => {
      const hash = changeDetectionService.getFileHash('file1.ts');
      expect(hash).toBe('hash1');
    });

    it('should return undefined for non-existent file hash', () => {
      const hash = changeDetectionService.getFileHash('nonexistent.ts');
      expect(hash).toBeUndefined();
    });

    it('should get file history', () => {
      const history = changeDetectionService.getFileHistory('file1.ts');
      expect(history).toHaveLength(1);
      expect(history[0].hash).toBe('oldhash1');
    });

    it('should return empty array for non-existent file history', () => {
      const history = changeDetectionService.getFileHistory('nonexistent.ts');
      expect(history).toEqual([]);
    });

    it('should get all file hashes', () => {
      const allHashes = changeDetectionService.getAllFileHashes();
      expect(allHashes.size).toBe(2);
      expect(allHashes.get('file1.ts')).toBe('hash1');
      expect(allHashes.get('file2.js')).toBe('hash2');
    });

    it('should check if file is tracked', () => {
      expect(changeDetectionService.isFileTracked('file1.ts')).toBe(true);
      expect(changeDetectionService.isFileTracked('nonexistent.ts')).toBe(false);
    });

    it('should get tracked files count', () => {
      expect(changeDetectionService.getTrackedFilesCount()).toBe(2);
    });

    it('should check if service is running', () => {
      expect(changeDetectionService.isServiceRunning()).toBe(true);
    });
  });

  describe('test mode helpers', () => {
    beforeEach(() => {
      // Set test mode
      (changeDetectionService as any).testMode = true;
    });

    it('should detect test mode', () => {
      expect(changeDetectionService.isTestMode()).toBe(true);
    });

    it('should wait for file processing', async () => {
      // Set up a file with pending changes
      (changeDetectionService as any).pendingChanges.set('file.ts', setTimeout(() => {}, 100));

      // Should return false immediately
      let result = await changeDetectionService.waitForFileProcessing('file.ts', 100);
      expect(result).toBe(false);

      // Clear pending changes
      (changeDetectionService as any).pendingChanges.clear();

      // Should return true now
      result = await changeDetectionService.waitForFileProcessing('file.ts', 100);
      expect(result).toBe(true);
    });

    it('should wait for all processing', async () => {
      // Set up pending changes
      (changeDetectionService as any).pendingChanges.set('file1.ts', setTimeout(() => {}, 100));
      (changeDetectionService as any).pendingChanges.set('file2.ts', setTimeout(() => {}, 100));

      // Should return false immediately
      let result = await changeDetectionService.waitForAllProcessing(100);
      expect(result).toBe(false);

      // Clear pending changes
      (changeDetectionService as any).pendingChanges.clear();

      // Should return true now
      result = await changeDetectionService.waitForAllProcessing(100);
      expect(result).toBe(true);
    });

    it('should flush pending changes', async () => {
      // Mock waitForAllProcessing
      (changeDetectionService as any).waitForAllProcessing = jest.fn().mockResolvedValue(true);

      await changeDetectionService.flushPendingChanges();

      expect((changeDetectionService as any).waitForAllProcessing).toHaveBeenCalled();
    });
  });
});