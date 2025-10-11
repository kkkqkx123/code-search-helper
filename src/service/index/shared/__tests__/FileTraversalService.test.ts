import { FileTraversalService, FileTraversalOptions } from '../FileTraversalService';
import { FileSystemTraversal, TraversalResult } from '../../../filesystem/FileSystemTraversal';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';

// Mock FileSystemTraversal
const mockFileSystemTraversal = {
  traverseDirectory: jest.fn(),
  getSupportedExtensions: jest.fn(),
} as unknown as jest.Mocked<FileSystemTraversal>;

// Mock LoggerService
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  getLogFilePath: jest.fn(),
  markAsNormalExit: jest.fn(),
} as unknown as jest.Mocked<LoggerService>;

describe('FileTraversalService', () => {
  let fileTraversalService: FileTraversalService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the service instance for each test
    fileTraversalService = new FileTraversalService(mockLogger, mockFileSystemTraversal);
    
    // Mock getSupportedExtensions to return a known set of extensions
    mockFileSystemTraversal.getSupportedExtensions.mockReturnValue([
      '.ts', '.js', '.tsx', '.jsx', '.py', '.java'
    ]);
  });

  describe('getProjectFiles', () => {
    it('should return file paths from FileSystemTraversal', async () => {
      const projectPath = '/test/project';
      const mockTraversalResult: TraversalResult = {
        files: [
          { path: '/test/project/file1.ts', relativePath: 'file1.ts', name: 'file1.ts', extension: '.ts', size: 100, hash: 'hash1', lastModified: new Date(), language: 'typescript', isBinary: false },
          { path: '/test/project/file2.js', relativePath: 'file2.js', name: 'file2.js', extension: '.js', size: 200, hash: 'hash2', lastModified: new Date(), language: 'javascript', isBinary: false }
        ],
        directories: ['subdir'],
        errors: [],
        totalSize: 300,
        processingTime: 10
      };

      mockFileSystemTraversal.traverseDirectory.mockResolvedValue(mockTraversalResult);

      const result = await fileTraversalService.getProjectFiles(projectPath);

      expect(result).toEqual(['/test/project/file1.ts', '/test/project/file2.js']);
      expect(mockFileSystemTraversal.traverseDirectory).toHaveBeenCalledWith(projectPath, {
        includePatterns: undefined,
        excludePatterns: undefined
      });
    });

    it('should pass options to FileSystemTraversal', async () => {
      const projectPath = '/test/project';
      const options: FileTraversalOptions = {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/node_modules/**']
      };
      
      const mockTraversalResult: TraversalResult = {
        files: [
          { path: '/test/project/file1.ts', relativePath: 'file1.ts', name: 'file1.ts', extension: '.ts', size: 100, hash: 'hash1', lastModified: new Date(), language: 'typescript', isBinary: false }
        ],
        directories: [],
        errors: [],
        totalSize: 100,
        processingTime: 5
      };

      mockFileSystemTraversal.traverseDirectory.mockResolvedValue(mockTraversalResult);

      const result = await fileTraversalService.getProjectFiles(projectPath, options);

      expect(result).toEqual(['/test/project/file1.ts']);
      expect(mockFileSystemTraversal.traverseDirectory).toHaveBeenCalledWith(projectPath, {
        includePatterns: ['**/*.ts'],
        excludePatterns: ['**/node_modules/**']
      });
    });

    it('should handle errors from FileSystemTraversal', async () => {
      const projectPath = '/test/project';
      const error = new Error('Traversal failed');
      
      mockFileSystemTraversal.traverseDirectory.mockRejectedValue(error);

      await expect(fileTraversalService.getProjectFiles(projectPath))
        .rejects
        .toThrow('Traversal failed');
        
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should use caching for repeated calls with same parameters', async () => {
      const projectPath = '/test/project';
      const mockTraversalResult: TraversalResult = {
        files: [
          { path: '/test/project/file1.ts', relativePath: 'file1.ts', name: 'file1.ts', extension: '.ts', size: 100, hash: 'hash1', lastModified: new Date(), language: 'typescript', isBinary: false }
        ],
        directories: [],
        errors: [],
        totalSize: 100,
        processingTime: 5
      };

      mockFileSystemTraversal.traverseDirectory.mockResolvedValue(mockTraversalResult);

      // First call
      const result1 = await fileTraversalService.getProjectFiles(projectPath);
      
      // Second call with same parameters
      const result2 = await fileTraversalService.getProjectFiles(projectPath);

      // Should only call traverseDirectory once
      expect(mockFileSystemTraversal.traverseDirectory).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
      expect(mockLogger.debug).toHaveBeenCalledWith('[DEBUG] Returning cached file list for project: /test/project');
    });

    it('should not use cache for different parameters', async () => {
      const projectPath = '/test/project';
      const options1: FileTraversalOptions = { includePatterns: ['**/*.ts'] };
      const options2: FileTraversalOptions = { includePatterns: ['**/*.js'] };
      
      const mockTraversalResult1: TraversalResult = {
        files: [
          { path: '/test/project/file1.ts', relativePath: 'file1.ts', name: 'file1.ts', extension: '.ts', size: 100, hash: 'hash1', lastModified: new Date(), language: 'typescript', isBinary: false }
        ],
        directories: [],
        errors: [],
        totalSize: 100,
        processingTime: 5
      };
      
      const mockTraversalResult2: TraversalResult = {
        files: [
          { path: '/test/project/file1.js', relativePath: 'file1.js', name: 'file1.js', extension: '.js', size: 100, hash: 'hash2', lastModified: new Date(), language: 'javascript', isBinary: false }
        ],
        directories: [],
        errors: [],
        totalSize: 100,
        processingTime: 5
      };

      mockFileSystemTraversal.traverseDirectory
        .mockResolvedValueOnce(mockTraversalResult1)
        .mockResolvedValueOnce(mockTraversalResult2);

      // First call
      const result1 = await fileTraversalService.getProjectFiles(projectPath, options1);
      
      // Second call with different options
      const result2 = await fileTraversalService.getProjectFiles(projectPath, options2);

      // Should call traverseDirectory twice
      expect(mockFileSystemTraversal.traverseDirectory).toHaveBeenCalledTimes(2);
      expect(result1).not.toEqual(result2);
    });
  });

  describe('isCodeFile', () => {
    it('should return true for supported file extensions', () => {
      expect(fileTraversalService.isCodeFile('file.ts')).toBe(true);
      expect(fileTraversalService.isCodeFile('file.js')).toBe(true);
      expect(fileTraversalService.isCodeFile('file.py')).toBe(true);
    });

    it('should return false for unsupported file extensions', () => {
      expect(fileTraversalService.isCodeFile('file.txt')).toBe(false);
      expect(fileTraversalService.isCodeFile('file.md')).toBe(false);
      expect(fileTraversalService.isCodeFile('file.exe')).toBe(false);
    });

    it('should handle case insensitive file extensions', () => {
      expect(fileTraversalService.isCodeFile('FILE.TS')).toBe(true);
      expect(fileTraversalService.isCodeFile('File.Js')).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      const projectPath = '/test/project';
      const mockTraversalResult: TraversalResult = {
        files: [
          { path: '/test/project/file1.ts', relativePath: 'file1.ts', name: 'file1.ts', extension: '.ts', size: 100, hash: 'hash1', lastModified: new Date(), language: 'typescript', isBinary: false }
        ],
        directories: [],
        errors: [],
        totalSize: 100,
        processingTime: 5
      };

      mockFileSystemTraversal.traverseDirectory.mockResolvedValue(mockTraversalResult);

      // First call
      await fileTraversalService.getProjectFiles(projectPath);
      
      // Clear cache
      fileTraversalService.clearCache();
      
      // Second call - should call traverseDirectory again
      await fileTraversalService.getProjectFiles(projectPath);

      // Should call traverseDirectory twice because cache was cleared
      expect(mockFileSystemTraversal.traverseDirectory).toHaveBeenCalledTimes(2);
    });
  });
});