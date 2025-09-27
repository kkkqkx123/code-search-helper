import { FileSystemTraversal, TraversalOptions, TraversalResult, FileInfo } from '../FileSystemTraversal';
import { GitignoreParser } from '../../../utils/GitignoreParser';
import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

// Mock fs module
jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

// Mock GitignoreParser
jest.mock('../../../utils/GitignoreParser');
const mockedGitignoreParser = GitignoreParser as jest.Mocked<typeof GitignoreParser>;

describe('FileSystemTraversal', () => {
  let fileSystemTraversal: FileSystemTraversal;
  let mockOptions: TraversalOptions;

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

    // Create a new instance for each test
    fileSystemTraversal = new FileSystemTraversal(mockOptions);
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

      const mockFileContent = Buffer.from('test content');
      const mockFileHash = createHash('sha256').update(mockFileContent).digest('hex');

      // Mock fs calls
      mockedFs.stat.mockImplementation((filePath: string) => {
        if (filePath === path.join(testPath, 'file1.ts')) {
          return Promise.resolve(mockFileStats as any);
        }
        return Promise.resolve(mockStats as any);
      });

      mockedFs.readdir.mockResolvedValue([
        { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
        { name: 'subdir', isDirectory: () => true, isFile: () => false },
      ] as any);

      mockedFs.readFile.mockResolvedValue(mockFileContent);
      mockedGitignoreParser.parseGitignore.mockResolvedValue([]);

      // Execute the method
      const result: TraversalResult = await fileSystemTraversal.traverseDirectory(testPath);

      // Verify the result
      expect(result).toBeDefined();
      expect(result.files).toHaveLength(1);
      expect(result.directories).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.totalSize).toBe(1024);
      expect(result.processingTime).toBeGreaterThan(0);

      // Verify the file info
      const fileInfo = result.files[0];
      expect(fileInfo.path).toBe(path.join(testPath, 'file1.ts'));
      expect(fileInfo.name).toBe('file1.ts');
      expect(fileInfo.extension).toBe('.ts');
      expect(fileInfo.size).toBe(1024);
      expect(fileInfo.hash).toBe(mockFileHash);
      expect(fileInfo.language).toBe('typescript');
      expect(fileInfo.isBinary).toBe(false);
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
      mockedGitignoreParser.parseGitignore.mockResolvedValue(['**/*.test.ts']);

      const optionsWithGitignore = { ...mockOptions, respectGitignore: true };
      const traversalWithGitignore = new FileSystemTraversal(optionsWithGitignore);

      await traversalWithGitignore.traverseDirectory(testPath);

      expect(mockedGitignoreParser.parseGitignore).toHaveBeenCalledWith(path.join(testPath, '.gitignore'));
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

      const mockFileContent = Buffer.from('test content');

      mockedFs.stat.mockImplementation((filePath: string) => {
        if (filePath === path.join(testPath, 'file1.ts') || filePath === path.join(testPath, 'file2.js')) {
          return Promise.resolve(mockFileStats as any);
        }
        return Promise.resolve(mockStats as any);
      });

      mockedFs.readdir.mockResolvedValue([
        { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
        { name: 'file2.js', isDirectory: () => false, isFile: () => true },
      ] as any);

      mockedFs.readFile.mockResolvedValue(mockFileContent);
      mockedGitignoreParser.parseGitignore.mockResolvedValue([]);

      const stats = await fileSystemTraversal.getDirectoryStats(testPath);

      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBe(2048);
      expect(stats.filesByLanguage).toEqual({
        typescript: 1,
        javascript: 1,
      });
      expect(stats.largestFiles).toHaveLength(2);
    });
  });
});