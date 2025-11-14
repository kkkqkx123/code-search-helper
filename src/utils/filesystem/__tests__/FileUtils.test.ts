import * as fs from 'fs/promises';
import { FileUtils } from '../FileUtils';
import { LoggerService } from '../../LoggerService';
import { HashUtils } from '../../cache/HashUtils';
import { FileContentDetector } from '../../FileContentDetector';
import { LANGUAGE_MAP } from '../../../service/parser/constants/language-constants';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('../../cache/HashUtils');
jest.mock('../../FileContentDetector');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockHashUtils = HashUtils as jest.Mocked<typeof HashUtils>;
const mockFileContentDetector = FileContentDetector as jest.Mocked<typeof FileContentDetector>;

describe('FileUtils', () => {
  const mockLogger: LoggerService = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectLanguage', () => {
    it('should detect language based on extension', () => {
      const supportedExtensions = ['.js', '.ts', '.py'];
      
      expect(FileUtils.detectLanguage('.js', supportedExtensions)).toBe('javascript');
      expect(FileUtils.detectLanguage('.ts', supportedExtensions)).toBe('typescript');
      expect(FileUtils.detectLanguage('.py', supportedExtensions)).toBe('python');
    });

    it('should return null for unsupported extensions', () => {
      const supportedExtensions = ['.js', '.ts'];
      
      expect(FileUtils.detectLanguage('.py', supportedExtensions)).toBeNull();
      expect(FileUtils.detectLanguage('.unknown', supportedExtensions)).toBeNull();
    });

    it('should return null for extension not in supported list', () => {
      const supportedExtensions = ['.js'];
      
      // Even if .ts is in LANGUAGE_MAP, it should return null if not in supportedExtensions
      expect(FileUtils.detectLanguage('.ts', supportedExtensions)).toBeNull();
    });
  });

  describe('isBinaryFile', () => {
    it('should detect binary files correctly', async () => {
      const filePath = '/path/to/file';
      const mockBuffer = Buffer.from([0x00, 0x01, 0x02]);
      
      mockFs.readFile.mockResolvedValue(mockBuffer);
      mockFileContentDetector.isBinaryContent.mockReturnValue(true);
      
      const result = await FileUtils.isBinaryFile(filePath, mockLogger);
      
      expect(result).toBe(true);
      expect(mockFs.readFile).toHaveBeenCalledWith(filePath, { encoding: null });
      expect(mockFileContentDetector.isBinaryContent).toHaveBeenCalledWith(mockBuffer);
    });

    it('should detect text files correctly', async () => {
      const filePath = '/path/to/file';
      const mockBuffer = Buffer.from('text content');
      
      mockFs.readFile.mockResolvedValue(mockBuffer);
      mockFileContentDetector.isBinaryContent.mockReturnValue(false);
      
      const result = await FileUtils.isBinaryFile(filePath, mockLogger);
      
      expect(result).toBe(false);
    });

    it('should return true when file read fails', async () => {
      const filePath = '/path/to/nonexistent';
      const error = new Error('File not found');
      
      mockFs.readFile.mockRejectedValue(error);
      
      const result = await FileUtils.isBinaryFile(filePath, mockLogger);
      
      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[DEBUG] Error checking if file is binary: ${filePath}`,
        { error: error.message }
      );
    });

    it('should work without logger', async () => {
      const filePath = '/path/to/file';
      const mockBuffer = Buffer.from('text content');
      
      mockFs.readFile.mockResolvedValue(mockBuffer);
      mockFileContentDetector.isBinaryContent.mockReturnValue(false);
      
      const result = await FileUtils.isBinaryFile(filePath);
      
      expect(result).toBe(false);
    });
  });

  describe('calculateFileHash', () => {
    it('should calculate file hash successfully', async () => {
      const filePath = '/path/to/file';
      const expectedHash = 'abc123';
      
      mockHashUtils.calculateFileHash.mockResolvedValue(expectedHash);
      
      const result = await FileUtils.calculateFileHash(filePath, mockLogger);
      
      expect(result).toBe(expectedHash);
      expect(mockHashUtils.calculateFileHash).toHaveBeenCalledWith(filePath);
    });

    it('should throw error when hash calculation fails', async () => {
      const filePath = '/path/to/file';
      const error = new Error('Hash calculation failed');
      
      mockHashUtils.calculateFileHash.mockRejectedValue(error);
      
      await expect(FileUtils.calculateFileHash(filePath, mockLogger)).rejects.toThrow(
        `Failed to calculate hash for ${filePath}: ${error.message}`
      );
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[DEBUG] Error calculating file hash: ${filePath}`,
        { error: error.message }
      );
    });

    it('should work without logger', async () => {
      const filePath = '/path/to/file';
      const expectedHash = 'abc123';
      
      mockHashUtils.calculateFileHash.mockResolvedValue(expectedHash);
      
      const result = await FileUtils.calculateFileHash(filePath);
      
      expect(result).toBe(expectedHash);
    });
  });

  describe('getFileContent', () => {
    it('should read file content successfully', async () => {
      const filePath = '/path/to/file';
      const expectedContent = 'file content';
      
      mockFs.readFile.mockResolvedValue(expectedContent);
      
      const result = await FileUtils.getFileContent(filePath);
      
      expect(result).toBe(expectedContent);
      expect(mockFs.readFile).toHaveBeenCalledWith(filePath, 'utf-8');
    });

    it('should throw error when file read fails', async () => {
      const filePath = '/path/to/nonexistent';
      const error = new Error('File not found');
      
      mockFs.readFile.mockRejectedValue(error);
      
      await expect(FileUtils.getFileContent(filePath)).rejects.toThrow(
        `Failed to read file ${filePath}: ${error.message}`
      );
    });
  });

  describe('utility methods', () => {
    it('should get file extension in lowercase', () => {
      expect(FileUtils.getFileExtension('app.JS')).toBe('.js');
      expect(FileUtils.getFileExtension('app.ts')).toBe('.ts');
      expect(FileUtils.getFileExtension('/path/to/app.py')).toBe('.py');
    });

    it('should get file name with extension', () => {
      expect(FileUtils.getFileName('app.js')).toBe('app');
      expect(FileUtils.getFileName('/path/to/app.ts')).toBe('app');
    });

    it('should get relative path', () => {
      expect(FileUtils.getRelativePath('/path/to', '/path/to/file.js')).toBe('file.js');
      // Handle both Unix and Windows path separators
      const relativePath = FileUtils.getRelativePath('/path/to', '/path/to/sub/file.js');
      expect(relativePath).toMatch(/^(sub\/file\.js|sub\\file\.js)$/);
    });
  });

  describe('fileExists', () => {
    it('should return true when file exists', async () => {
      const filePath = '/path/to/file';
      
      mockFs.access.mockResolvedValue(undefined);
      
      const result = await FileUtils.fileExists(filePath);
      
      expect(result).toBe(true);
      expect(mockFs.access).toHaveBeenCalledWith(filePath);
    });

    it('should return false when file does not exist', async () => {
      const filePath = '/path/to/nonexistent';
      
      mockFs.access.mockRejectedValue(new Error('File not found'));
      
      const result = await FileUtils.fileExists(filePath);
      
      expect(result).toBe(false);
    });
  });

  describe('getFileStats', () => {
    it('should return file stats when file exists', async () => {
      const filePath = '/path/to/file';
      const mockStats = {
        isFile: () => true,
        isDirectory: () => false,
        size: 1024,
        mtime: new Date()
      } as any;
      
      mockFs.stat.mockResolvedValue(mockStats);
      
      const result = await FileUtils.getFileStats(filePath);
      
      expect(result).toBe(mockStats);
      expect(mockFs.stat).toHaveBeenCalledWith(filePath);
    });

    it('should return null when file does not exist', async () => {
      const filePath = '/path/to/nonexistent';
      
      mockFs.stat.mockRejectedValue(new Error('File not found'));
      
      const result = await FileUtils.getFileStats(filePath);
      
      expect(result).toBeNull();
    });
  });
});