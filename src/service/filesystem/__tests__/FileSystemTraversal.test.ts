import { FileSystemTraversal, TraversalOptions, TraversalResult, FileInfo } from '../FileSystemTraversal';
import { GitignoreParser } from '../../ignore/GitignoreParser';
import { LoggerService } from '../../../utils/LoggerService';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';

// Mock fs module
jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock GitignoreParser
jest.mock('../../../utils/GitignoreParser');
const mockedGitignoreParser = GitignoreParser as jest.Mocked<typeof GitignoreParser>;

// Mock LoggerService
jest.mock('../../../utils/LoggerService');
const MockedLoggerService = LoggerService as jest.Mocked<typeof LoggerService>;

// Mock fsSync for realpathSync
jest.mock('fs');
const fsSync = require('fs') as jest.Mocked<typeof import('fs')>;

describe('FileSystemTraversal', () => {
  let fileSystemTraversal: FileSystemTraversal;
  let mockOptions: TraversalOptions;
  let mockLogger: LoggerService;
  let originalCreateReadStream: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOptions = {
      includePatterns: ['**/*.ts', '**/*.js'],
      excludePatterns: ['**/node_modules/**', '**/.git/**'],
      maxFileSize: 10 * 1024 * 1024, // 10MB
      supportedExtensions: ['.ts', '.js', '.tsx', '.jsx'],
      followSymlinks: false,
      ignoreHiddenFiles: true,
      ignoreDirectories: ['node_modules', '.git', 'dist', 'build'],
      respectGitignore: true,
    };

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      getLogFilePath: jest.fn(),
      markAsNormalExit: jest.fn(),
    } as any;

    // Store original createReadStream
    originalCreateReadStream = require('fs').createReadStream;

    // Mock realpathSync to prevent circular reference issues
    (fsSync.realpathSync as unknown as jest.Mock).mockImplementation((p: string) => {
      // Return a unique path for each input to prevent circular references
      return p.replace(/\\/g, '/');
    });

    // Mock GitignoreParser.parseGitignore to return empty array by default
    mockedGitignoreParser.parseGitignore.mockResolvedValue([]);

    // Create a new instance for each test
    fileSystemTraversal = new FileSystemTraversal(mockLogger, mockOptions as any);
  });

  afterEach(() => {
    // Restore original createReadStream
    if (originalCreateReadStream) {
      require('fs').createReadStream = originalCreateReadStream;
    }
    jest.restoreAllMocks();
  });

  describe('traverseDirectory', () => {
    it('should successfully traverse a directory and return results', async () => {
      // Setup mock data
      const testPath = '/test/path';
      const mockStats = {
        isDirectory: () => true,
        isFile: () => false,
        size: 1024,
        mtime: new Date(),
      };

      const mockFileStats = {
        isDirectory: () => false,
        isFile: () => true,
        size: 1024,
        mtime: new Date(),
      };

      // Mock fs calls
      (mockedFs.stat as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath === path.join(testPath, 'file1.ts')) {
          return Promise.resolve(mockFileStats as any);
        }
        return Promise.resolve(mockStats as any);
      });

      // Mock readdir to return only files, no subdirectories to prevent recursion
      mockedFs.readdir.mockResolvedValue([
        { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
      ] as any);

      // Mock the calculateFileHash method directly
      const originalCalculateFileHash = (fileSystemTraversal as any).calculateFileHash;
      (fileSystemTraversal as any).calculateFileHash = jest.fn().mockResolvedValue('testhash123');

      // Mock isBinaryFile to return false
      const originalIsBinaryFile = (fileSystemTraversal as any).isBinaryFile;
      (fileSystemTraversal as any).isBinaryFile = jest.fn().mockResolvedValue(false);

      // Execute the method
      const result: TraversalResult = await fileSystemTraversal.traverseDirectory(testPath);

      // Restore original methods
      (fileSystemTraversal as any).isBinaryFile = originalIsBinaryFile;

      // Verify the result
      expect(result).toBeDefined();
      expect(result.files).toHaveLength(1);
      expect(result.directories).toHaveLength(0); // No subdirectories now
      expect(result.errors).toHaveLength(0);
      expect(result.totalSize).toBe(1024);
      expect(result.processingTime).toBeGreaterThan(0);

      // Restore original method
      (fileSystemTraversal as any).calculateFileHash = originalCalculateFileHash;
    });

    it('should handle errors when directory does not exist', async () => {
      const testPath = '/nonexistent/path';
      mockedFs.stat.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result: TraversalResult = await fileSystemTraversal.traverseDirectory(testPath);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to traverse directory');
    });

    it('should respect gitignore patterns when respectGitignore is true', async () => {
      const testPath = '/test/path';
      const mockStats = {
        isDirectory: () => true,
        isFile: () => false,
        size: 1024,
        mtime: new Date(),
      };

      mockedFs.stat.mockResolvedValue(mockStats as any);
      mockedFs.readdir.mockResolvedValue([] as any);
      mockedGitignoreParser.getAllGitignorePatterns.mockResolvedValue(['**/*.test.ts']);

      const optionsWithGitignore = { ...mockOptions, respectGitignore: true };
      const traversalWithGitignore = new FileSystemTraversal(mockLogger, optionsWithGitignore as any);

      await traversalWithGitignore.traverseDirectory(testPath);

      expect(mockedGitignoreParser.getAllGitignorePatterns).toHaveBeenCalledWith(testPath);
    });
  });

  describe('getFileContent', () => {
    it('should read file content successfully', async () => {
      const testPath = '/test/file.ts';
      const mockContent = 'export const test = true;';
      mockedFs.readFile.mockResolvedValue(mockContent);

      const content = await fileSystemTraversal.getFileContent(testPath);

      expect(content).toBe(mockContent);
      expect(mockedFs.readFile).toHaveBeenCalledWith(testPath, 'utf-8');
    });

    it('should throw error when file cannot be read', async () => {
      const testPath = '/test/nonexistent.ts';
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(fileSystemTraversal.getFileContent(testPath)).rejects.toThrow(
        `Failed to read file ${testPath}`
      );
    });
  });

  describe('getDirectoryStats', () => {
    it('should return correct directory statistics', async () => {
      const testPath = '/test/path';
      const mockStats = {
        isDirectory: () => true,
        isFile: () => false,
        size: 1024,
        mtime: new Date(),
      };

      const mockFileStats = {
        isDirectory: () => false,
        isFile: () => true,
        size: 1024,
        mtime: new Date(),
      };

      (mockedFs.stat as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath === path.join(testPath, 'file1.ts') || filePath === path.join(testPath, 'file2.js')) {
          return Promise.resolve(mockFileStats as any);
        }
        return Promise.resolve(mockStats as any);
      });

      mockedFs.readdir.mockResolvedValue([
        { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
        { name: 'file2.js', isDirectory: () => false, isFile: () => true },
      ] as any);

      // Mock fs.open for isBinaryFile
      const mockFileHandle = {
        read: jest.fn().mockResolvedValue({ bytesRead: 12, buffer: Buffer.from('test content') }),
        close: jest.fn().mockResolvedValue(undefined),
      };
      jest.spyOn(mockedFs, 'open').mockResolvedValue(mockFileHandle as any);

      mockedGitignoreParser.parseGitignore.mockResolvedValue([]);

      // Mock the calculateFileHash method directly
      const originalCalculateFileHash = (fileSystemTraversal as any).calculateFileHash;
      (fileSystemTraversal as any).calculateFileHash = jest.fn().mockResolvedValue('testhash123');

      // Mock isBinaryFile to return false
      const originalIsBinaryFile = (fileSystemTraversal as any).isBinaryFile;
      (fileSystemTraversal as any).isBinaryFile = jest.fn().mockResolvedValue(false);

      const stats = await fileSystemTraversal.getDirectoryStats(testPath);

      // Restore original methods
      (fileSystemTraversal as any).isBinaryFile = originalIsBinaryFile;

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBe(2048);
      expect(stats.filesByLanguage).toEqual({
        typescript: 1,
        javascript: 1,
      });
      expect(stats.largestFiles).toHaveLength(2);

      // Restore original method
      (fileSystemTraversal as any).calculateFileHash = originalCalculateFileHash;
    });
  });

  describe('Enhanced Ignore Rule Integration', () => {
    it('should integrate default, gitignore, indexignore, and custom ignore patterns', async () => {
      const testPath = '/test/path';

      // Mock GitignoreParser methods
      mockedGitignoreParser.getAllGitignorePatterns.mockResolvedValue([
        '**/node_modules/**',
        '**/dist/**',
        'src/**/build/**'  // Subdirectory gitignore pattern
      ]);

      mockedGitignoreParser.parseIndexignore.mockResolvedValue([
        '**/*.tmp',
        '**/temp/**'
      ]);

      // Mock directory structure - simpler to avoid recursion
      const mockStats = {
        isDirectory: () => true,
        isFile: () => false,
        size: 1024,
        mtime: new Date(),
      };

      const mockFileStats = {
        isDirectory: () => false,
        isFile: () => true,
        size: 1024,
        mtime: new Date(),
      };

      // Mock fs.realpathSync to prevent infinite recursion
      fsSync.realpathSync.mockImplementation((path: any) => String(path));

      // Mock stat to return different results based on path
      (mockedFs.stat as jest.Mock).mockImplementation((filePath: string) => {
        // Only process the root directory and one file
        if (filePath === testPath) {
          return Promise.resolve(mockStats as any);
        }
        if (filePath === path.join(testPath, 'file.ts')) {
          return Promise.resolve(mockFileStats as any);
        }
        // Everything else should be treated as non-existent to avoid recursion
        const error = new Error('File not found') as any;
        error.code = 'ENOENT';
        return Promise.reject(error);
      });

      // Mock readdir to return only simple files, no directories to prevent recursion
      mockedFs.readdir.mockResolvedValue([
        { name: 'file.ts', isDirectory: () => false, isFile: () => true },      // Should be included
        { name: 'file.tmp', isDirectory: () => false, isFile: () => true },     // Should be excluded by .indexignore
        { name: 'node_modules', isDirectory: () => true, isFile: () => false }, // Should be excluded by default patterns
      ] as any);

      // Mock helper methods
      const originalCalculateFileHash = (fileSystemTraversal as any).calculateFileHash;
      const originalIsBinaryFile = (fileSystemTraversal as any).isBinaryFile;

      (fileSystemTraversal as any).calculateFileHash = jest.fn().mockResolvedValue('testhash123');
      (fileSystemTraversal as any).isBinaryFile = jest.fn().mockResolvedValue(false);

      // Execute with custom exclude patterns
      const result = await fileSystemTraversal.traverseDirectory(testPath, {
        excludePatterns: ['**/custom-exclude/**']  // Custom pattern
      });

      // Restore original methods
      (fileSystemTraversal as any).calculateFileHash = originalCalculateFileHash;
      (fileSystemTraversal as any).isBinaryFile = originalIsBinaryFile;

      // Verify that all ignore patterns were applied
      expect(mockedGitignoreParser.getAllGitignorePatterns).toHaveBeenCalledWith(testPath);
      expect(mockedGitignoreParser.parseIndexignore).toHaveBeenCalledWith(testPath);

      // Should only include the .ts file, excluding .tmp and node_modules
      expect(result.files).toHaveLength(1);
      expect(result.files[0].name).toBe('file.ts');

      // Verify debug logging was called with pattern counts
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Final ignore patterns for'),
        expect.objectContaining({
          defaultPatterns: expect.any(Number),
          gitignorePatterns: expect.any(Number),
          indexignorePatterns: expect.any(Number),
          customPatterns: expect.any(Number),
          totalPatterns: expect.any(Number)
        })
      );
    });

    it('should handle respectGitignore=false correctly', async () => {
      const testPath = '/test/path';

      // Mock only indexignore (should still be processed even when respectGitignore=false)
      mockedGitignoreParser.parseIndexignore.mockResolvedValue(['**/*.tmp']);

      // Mock directory structure
      const mockStats = { isDirectory: () => true, isFile: () => false, size: 1024, mtime: new Date() };
      const mockFileStats = { isDirectory: () => false, isFile: () => true, size: 1024, mtime: new Date() };

      (mockedFs.stat as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('file.ts')) {
          return Promise.resolve(mockFileStats as any);
        }
        return Promise.resolve(mockStats as any);
      });

      mockedFs.readdir.mockResolvedValue([
        { name: 'file.ts', isDirectory: () => false, isFile: () => true }
      ] as any);

      // Mock helper methods
      const originalCalculateFileHash = (fileSystemTraversal as any).calculateFileHash;
      const originalIsBinaryFile = (fileSystemTraversal as any).isBinaryFile;

      (fileSystemTraversal as any).calculateFileHash = jest.fn().mockResolvedValue('testhash123');
      (fileSystemTraversal as any).isBinaryFile = jest.fn().mockResolvedValue(false);

      // Execute with respectGitignore=false
      const result = await fileSystemTraversal.traverseDirectory(testPath, {
        respectGitignore: false
      });

      // Restore original methods
      (fileSystemTraversal as any).calculateFileHash = originalCalculateFileHash;
      (fileSystemTraversal as any).isBinaryFile = originalIsBinaryFile;

      // Verify getAllGitignorePatterns was NOT called
      expect(mockedGitignoreParser.getAllGitignorePatterns).not.toHaveBeenCalled();

      // But parseIndexignore should still be called
      expect(mockedGitignoreParser.parseIndexignore).toHaveBeenCalledWith(testPath);

      // Should still have default patterns applied
      expect(result.files).toHaveLength(1);
    });
  });
});