import { BackupFileProcessor } from '../BackupFileProcessor';
import { LoggerService } from '../../../../../utils/LoggerService';
import { BACKUP_FILE_PATTERNS, LANGUAGE_MAP, CODE_LANGUAGES } from '../../constants';

describe('BackupFileProcessor', () => {
  let processor: BackupFileProcessor;
  let mockLogger: LoggerService;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    processor = new BackupFileProcessor(mockLogger);
  });

  describe('constructor', () => {
    it('should initialize with default backup patterns', () => {
      const patterns = processor.getBackupPatterns();
      expect(patterns).toEqual(BACKUP_FILE_PATTERNS);
    });

    it('should initialize with custom logger', () => {
      const customLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      } as any;

      const customProcessor = new BackupFileProcessor(customLogger);
      expect(customProcessor).toBeDefined();
    });
  });

  describe('isBackupFile', () => {
    it('should identify backup files with standard patterns', () => {
      const backupFiles = [
        'test.js.bak',
        'config.json.backup',
        'script.py.old',
        'temp.tmp',
        'data.temp',
        'original.txt.orig',
        'saved.css.save'
      ];

      backupFiles.forEach(file => {
        expect(processor.isBackupFile(file)).toBe(true);
      });
    });

    it('should not identify non-backup files', () => {
      const normalFiles = [
        'test.js',
        'config.json',
        'script.py',
        'temp.txt',
        'data.csv',
        'original.md',
        'saved.css'
      ];

      normalFiles.forEach(file => {
        expect(processor.isBackupFile(file)).toBe(false);
      });
    });

    it('should handle file paths', () => {
      const backupPaths = [
        '/path/to/file.js.bak',
        'C:\\Users\\test\\script.py.backup',
        './relative/path/config.json.old'
      ];

      backupPaths.forEach(path => {
        expect(processor.isBackupFile(path)).toBe(true);
      });
    });
  });

  describe('inferOriginalType', () => {
    it('should infer original type from special pattern files', () => {
      const testCases = [
        {
          file: 'script.py.bak',
          expected: {
            originalExtension: '.py',
            originalLanguage: 'python',
            originalFileName: 'script.py',
            confidence: 0.95
          }
        },
        {
          file: 'config.json.backup',
          expected: {
            originalExtension: '.json',
            originalLanguage: 'json',
            originalFileName: 'config.json',
            confidence: 0.95
          }
        },
        {
          file: 'style.css.old',
          expected: {
            originalExtension: '.css',
            originalLanguage: 'css',
            originalFileName: 'style.css',
            confidence: 0.95
          }
        }
      ];

      testCases.forEach(({ file, expected }) => {
        const result = processor.inferOriginalType(file);
        expect(result.originalExtension).toBe(expected.originalExtension);
        expect(result.originalLanguage).toBe(expected.originalLanguage);
        expect(result.originalFileName).toBe(expected.originalFileName);
        expect(result.confidence).toBe(expected.confidence);
      });
    });

    it('should handle .bak.md and .bak.txt patterns', () => {
      const testCases = [
        {
          file: 'document.md.bak.md',
          expected: {
            originalExtension: '.md',
            originalLanguage: 'markdown',
            originalFileName: 'document.md',
            confidence: 0.95
          }
        },
        {
          file: 'notes.txt.bak.txt',
          expected: {
            originalExtension: '.txt',
            originalLanguage: 'text',
            originalFileName: 'notes.txt',
            confidence: 0.95
          }
        }
      ];

      testCases.forEach(({ file, expected }) => {
        const result = processor.inferOriginalType(file);
        expect(result.originalExtension).toBe(expected.originalExtension);
        expect(result.originalLanguage).toBe(expected.originalLanguage);
        expect(result.originalFileName).toBe(expected.originalFileName);
        expect(result.confidence).toBe(expected.confidence);
      });
    });

    it('should handle standard backup patterns', () => {
      const testCases = [
        {
          file: 'script.js.bak',
          expected: {
            originalExtension: '.js',
            originalLanguage: 'javascript',
            originalFileName: 'script.js',
            confidence: 0.8
          }
        },
        {
          file: 'config.xml.backup',
          expected: {
            originalExtension: '.xml',
            originalLanguage: 'xml',
            originalFileName: 'config.xml',
            confidence: 0.8
          }
        }
      ];

      testCases.forEach(({ file, expected }) => {
        const result = processor.inferOriginalType(file);
        expect(result.originalExtension).toBe(expected.originalExtension);
        expect(result.originalLanguage).toBe(expected.originalLanguage);
        expect(result.originalFileName).toBe(expected.originalFileName);
        expect(result.confidence).toBe(expected.confidence);
      });
    });

    it('should handle files without clear extensions', () => {
      const result = processor.inferOriginalType('file.bak');
      expect(result.originalExtension).toBe('');
      expect(result.originalLanguage).toBe('unknown');
      expect(result.originalFileName).toBe('file');
      expect(result.confidence).toBe(0.5);
    });

    it('should log debug information', () => {
      processor.inferOriginalType('test.js.bak');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Inferred original type for backup file: test.js.bak'),
        expect.any(Object)
      );
    });
  });

  describe('detectLanguageByExtension', () => {
    it('should detect language by extension', () => {
      const testCases = [
        { extension: '.js', expected: 'javascript' },
        { extension: '.py', expected: 'python' },
        { extension: '.java', expected: 'java' },
        { extension: '.cpp', expected: 'cpp' },
        { extension: '.md', expected: 'markdown' }
      ];

      testCases.forEach(({ extension, expected }) => {
        expect(processor.detectLanguageByExtension(extension)).toBe(expected);
      });
    });

    it('should return unknown for unrecognized extensions', () => {
      expect(processor.detectLanguageByExtension('.unknown')).toBe('unknown');
      expect(processor.detectLanguageByExtension('.xyz')).toBe('unknown');
    });
  });

  describe('getOriginalFilePath', () => {
    it('should return original file path', () => {
      const testCases = [
        {
          backupPath: '/path/to/script.js.bak',
          expected: '/path/to/script.js'
        },
        {
          backupPath: 'C:\\Users\\test\\config.json.backup',
          expected: 'C:\\Users\\test\\config.json'
        },
        {
          backupPath: './relative/file.py.old',
          expected: './relative/file.py'
        }
      ];

      testCases.forEach(({ backupPath, expected }) => {
        const result = processor.getOriginalFilePath(backupPath);
        expect(result).toBe(expected);
      });
    });
  });

  describe('isLikelyCodeFile', () => {
    it('should identify likely code files', () => {
      const codeFiles = [
        'script.js.bak',
        'program.py.backup',
        'app.java.old',
        'module.cpp.tmp'
      ];

      codeFiles.forEach(file => {
        expect(processor.isLikelyCodeFile(file)).toBe(true);
      });
    });

    it('should not identify non-code files', () => {
      const nonCodeFiles = [
        'document.txt.bak',
        'image.jpg.backup',
        'data.csv.old'
      ];

      nonCodeFiles.forEach(file => {
        expect(processor.isLikelyCodeFile(file)).toBe(false);
      });
    });
  });

  describe('getBackupFileMetadata', () => {
    it('should return metadata for backup files', () => {
      const metadata = processor.getBackupFileMetadata('script.js.bak');

      expect(metadata.isBackup).toBe(true);
      expect(metadata.backupType).toBe('standard-backup');
      expect(metadata.originalInfo).toBeDefined();
      expect(metadata.originalInfo?.fileName).toBe('script.js');
      expect(metadata.originalInfo?.extension).toBe('.js');
      expect(metadata.originalInfo?.language).toBe('javascript');
      expect(metadata.isLikelyCode).toBe(true);
    });

    it('should return metadata for non-backup files', () => {
      const metadata = processor.getBackupFileMetadata('script.js');

      expect(metadata.isBackup).toBe(false);
      expect(metadata.backupType).toBeUndefined();
      expect(metadata.originalInfo).toBeUndefined();
      expect(metadata.isLikelyCode).toBe(false);
    });

    it('should detect different backup types', () => {
      const testCases = [
        { file: 'test.js.bak', type: 'standard-backup' },
        { file: 'test.js.backup', type: 'full-backup' },
        { file: 'test.js.old', type: 'old-version' },
        { file: 'test.js.tmp', type: 'temporary' },
        { file: 'test.js.temp', type: 'temporary' },
        { file: 'test.js.orig', type: 'original' },
        { file: 'test.js.save', type: 'saved' }
      ];

      testCases.forEach(({ file, type }) => {
        const metadata = processor.getBackupFileMetadata(file);
        expect(metadata.backupType).toBe(type);
      });
    });
  });

  describe('addBackupPattern', () => {
    it('should add custom backup pattern', () => {
      const customPattern = '.custom';
      processor.addBackupPattern(customPattern);

      const patterns = processor.getBackupPatterns();
      expect(patterns).toContain(customPattern);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Added custom backup pattern: ${customPattern}`
      );
    });

    it('should not add duplicate patterns', () => {
      const originalPatterns = processor.getBackupPatterns();
      processor.addBackupPattern('.bak'); // Already exists

      const newPatterns = processor.getBackupPatterns();
      expect(newPatterns).toEqual(originalPatterns);
    });
  });

  describe('removeBackupPattern', () => {
    it('should remove backup pattern', () => {
      const patternToRemove = '.bak';
      processor.removeBackupPattern(patternToRemove);

      const patterns = processor.getBackupPatterns();
      expect(patterns).not.toContain(patternToRemove);
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Removed backup pattern: ${patternToRemove}`
      );
    });

    it('should handle removing non-existent patterns', () => {
      const originalPatterns = processor.getBackupPatterns();
      processor.removeBackupPattern('.nonexistent');

      const newPatterns = processor.getBackupPatterns();
      expect(newPatterns).toEqual(originalPatterns);
    });
  });

  describe('getBackupPatterns', () => {
    it('should return a copy of backup patterns', () => {
      const patterns1 = processor.getBackupPatterns();
      const patterns2 = processor.getBackupPatterns();

      expect(patterns1).toEqual(patterns2);
      expect(patterns1).not.toBe(patterns2); // Should be different objects
    });
  });
});