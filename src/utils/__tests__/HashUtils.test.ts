import { HashUtils } from '../HashUtils';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock fs
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('HashUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateStringHash', () => {
    it('should calculate consistent hash for the same string', () => {
      const testString = 'Hello, World!';
      const hash1 = HashUtils.calculateStringHash(testString);
      const hash2 = HashUtils.calculateStringHash(testString);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hash format
    });

    it('should calculate different hashes for different strings', () => {
      const hash1 = HashUtils.calculateStringHash('Hello, World!');
      const hash2 = HashUtils.calculateStringHash('Hello, Universe!');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('calculateFileHash', () => {
    it('should calculate hash for file content', async () => {
      const fileContent = 'Test file content';
      mockFs.readFile.mockResolvedValue(Buffer.from(fileContent));

      const hash = await HashUtils.calculateFileHash('/test/file.txt');

      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(mockFs.readFile).toHaveBeenCalledWith('/test/file.txt');
    });

    it('should throw error when file reading fails', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(HashUtils.calculateFileHash('/test/nonexistent.txt'))
        .rejects.toThrow('Failed to calculate hash for /test/nonexistent.txt');
    });
  });

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = HashUtils.generateId('test');
      const id2 = HashUtils.generateId('test');

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test_[a-z0-9]+_[a-z0-9]+$/);
    });

    it('should generate ID with default prefix when none provided', () => {
      const id = HashUtils.generateId();
      expect(id).toMatch(/^id_[a-z0-9]+_[a-z0-9]+$/);
    });
  });

  describe('normalizePath', () => {
    it('should normalize path separators to forward slashes', () => {
      const normalized = HashUtils.normalizePath('src\\utils\\test.ts');
      expect(normalized).toBe('src/utils/test.ts');
    });

    it('should handle already normalized paths', () => {
      const normalized = HashUtils.normalizePath('src/utils/test.ts');
      expect(normalized).toBe('src/utils/test.ts');
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension correctly', () => {
      expect(HashUtils.getFileExtension('src/index.ts')).toBe('ts');
      expect(HashUtils.getFileExtension('README.md')).toBe('md');
      expect(HashUtils.getFileExtension('file')).toBe('');
      expect(HashUtils.getFileExtension('archive.tar.gz')).toBe('gz');
    });

    it('should return lowercase extension', () => {
      expect(HashUtils.getFileExtension('IMAGE.PNG')).toBe('png');
    });
  });

  describe('isValidCodeFile', () => {
    it('should identify valid code files', () => {
      expect(HashUtils.isValidCodeFile('src/main.ts')).toBe(true);
      expect(HashUtils.isValidCodeFile('app.js')).toBe(true);
      expect(HashUtils.isValidCodeFile('script.py')).toBe(true);
      expect(HashUtils.isValidCodeFile('component.jsx')).toBe(true);
    });

    it('should identify invalid code files', () => {
      expect(HashUtils.isValidCodeFile('README.md')).toBe(false);
      expect(HashUtils.isValidCodeFile('image.png')).toBe(false);
      expect(HashUtils.isValidCodeFile('document.txt')).toBe(false);
    });

    it('should support custom allowed extensions', () => {
      expect(HashUtils.isValidCodeFile('config.xml', ['xml', 'json'])).toBe(true);
      expect(HashUtils.isValidCodeFile('data.csv', ['xml', 'json'])).toBe(false);
    });
  });
});