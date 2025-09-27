import { PathUtils } from './PathUtils.js';
import fs from 'fs/promises';
import path from 'path';

// Mock fs
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('PathUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', async () => {
      // First call to access throws ENOENT, second call succeeds
      mockFs.access.mockRejectedValueOnce({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValue(undefined);
      
      await PathUtils.ensureDirectoryExists('/test/new-directory');
      
      expect(mockFs.access).toHaveBeenCalledWith('/test/new-directory');
      expect(mockFs.mkdir).toHaveBeenCalledWith('/test/new-directory', { recursive: true });
    });

    it('should not create directory if it already exists', async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      await PathUtils.ensureDirectoryExists('/test/existing-directory');
      
      expect(mockFs.access).toHaveBeenCalledWith('/test/existing-directory');
      expect(mockFs.mkdir).not.toHaveBeenCalled();
    });
  });

  describe('getFileSize', () => {
    it('should return file size when file exists', async () => {
      const mockStats = { size: 1024 };
      mockFs.stat.mockResolvedValue(mockStats as any);
      
      const size = await PathUtils.getFileSize('/test/file.txt');
      
      expect(size).toBe(1024);
      expect(mockFs.stat).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should return 0 when file does not exist', async () => {
      mockFs.stat.mockRejectedValue(new Error('File not found'));
      
      const size = await PathUtils.getFileSize('/test/nonexistent.txt');
      
      expect(size).toBe(0);
    });
  });

  describe('isDirectory', () => {
    it('should return true for directories', async () => {
      const mockStats = { isDirectory: jest.fn().mockReturnValue(true) };
      mockFs.stat.mockResolvedValue(mockStats as any);
      
      const isDir = await PathUtils.isDirectory('/test/directory');
      
      expect(isDir).toBe(true);
      expect(mockStats.isDirectory).toHaveBeenCalled();
    });

    it('should return false for files', async () => {
      const mockStats = { isDirectory: jest.fn().mockReturnValue(false) };
      mockFs.stat.mockResolvedValue(mockStats as any);
      
      const isDir = await PathUtils.isDirectory('/test/file.txt');
      
      expect(isDir).toBe(false);
    });

    it('should return false when path does not exist', async () => {
      mockFs.stat.mockRejectedValue(new Error('Path not found'));
      
      const isDir = await PathUtils.isDirectory('/test/nonexistent');
      
      expect(isDir).toBe(false);
    });
  });

  describe('isFile', () => {
    it('should return true for files', async () => {
      const mockStats = { isFile: jest.fn().mockReturnValue(true) };
      mockFs.stat.mockResolvedValue(mockStats as any);
      
      const isFile = await PathUtils.isFile('/test/file.txt');
      
      expect(isFile).toBe(true);
      expect(mockStats.isFile).toHaveBeenCalled();
    });

    it('should return false for directories', async () => {
      const mockStats = { isFile: jest.fn().mockReturnValue(false) };
      mockFs.stat.mockResolvedValue(mockStats as any);
      
      const isFile = await PathUtils.isFile('/test/directory');
      
      expect(isFile).toBe(false);
    });

    it('should return false when path does not exist', async () => {
      mockFs.stat.mockRejectedValue(new Error('Path not found'));
      
      const isFile = await PathUtils.isFile('/test/nonexistent');
      
      expect(isFile).toBe(false);
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      mockFs.access.mockResolvedValue(undefined);
      
      const exists = await PathUtils.fileExists('/test/file.txt');
      
      expect(exists).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should return false when file does not exist', async () => {
      mockFs.access.mockRejectedValue({ code: 'ENOENT' });
      
      const exists = await PathUtils.fileExists('/test/nonexistent.txt');
      
      expect(exists).toBe(false);
    });
  });

  describe('joinPaths', () => {
    it('should join paths and normalize separators', async () => {
      const joined = await PathUtils.joinPaths('src', 'utils', 'test.ts');
      const expected = path.join('src', 'utils', 'test.ts').replace(/\\/g, '/');
      
      expect(joined).toBe(expected);
    });
  });

  describe('deleteFile', () => {
    it('should return true when file is deleted successfully', async () => {
      mockFs.unlink.mockResolvedValue(undefined);
      
      const result = await PathUtils.deleteFile('/test/file.txt');
      
      expect(result).toBe(true);
      expect(mockFs.unlink).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should return false when file deletion fails', async () => {
      mockFs.unlink.mockRejectedValue(new Error('Permission denied'));
      
      const result = await PathUtils.deleteFile('/test/file.txt');
      
      expect(result).toBe(false);
    });
  });

  describe('deleteDirectory', () => {
    it('should return true when directory is deleted successfully', async () => {
      mockFs.rm.mockResolvedValue(undefined);
      
      const result = await PathUtils.deleteDirectory('/test/directory');
      
      expect(result).toBe(true);
      expect(mockFs.rm).toHaveBeenCalledWith('/test/directory', { recursive: true, force: true });
    });

    it('should return false when directory deletion fails', async () => {
      mockFs.rm.mockRejectedValue(new Error('Permission denied'));
      
      const result = await PathUtils.deleteDirectory('/test/directory');
      
      expect(result).toBe(false);
    });
  });
});