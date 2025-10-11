
import { BackupFileProcessor } from '../BackupFileProcessor';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock LoggerService
jest.mock('../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('BackupFileProcessor', () => {
  let processor: BackupFileProcessor;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();
    
    processor = new BackupFileProcessor(mockLogger);
  });

  describe('isBackupFile', () => {
    it('should identify .bak files as backup files', () => {
      expect(processor.isBackupFile('test.js.bak')).toBe(true);
      expect(processor.isBackupFile('config.json.bak')).toBe(true);
    });

    it('should identify .backup files as backup files', () => {
      expect(processor.isBackupFile('test.js.backup')).toBe(true);
      expect(processor.isBackupFile('config.json.backup')).toBe(true);
    });

    it('should identify .old files as backup files', () => {
      expect(processor.isBackupFile('test.js.old')).toBe(true);
      expect(processor.isBackupFile('config.json.old')).toBe(true);
    });

    it('should identify .tmp files as backup files', () => {
      expect(processor.isBackupFile('test.js.tmp')).toBe(true);
      expect(processor.isBackupFile('config.json.tmp')).toBe(true);
    });

    it('should identify Vim swap files as backup files', () => {
      expect(processor.isBackupFile('.test.js.swp')).toBe(true);
      expect(processor.isBackupFile('.test.js.swo')).toBe(true);
    });

    it('should identify Emacs backup files', () => {
      expect(processor.isBackupFile('test.js~')).toBe(true);
    });

    it('should identify temporary files with # markers', () => {
      expect(processor.isBackupFile('#test.js#')).toBe(true);
    });

    it('should not identify regular files as backup files', () => {
      expect(processor.isBackupFile('test.js')).toBe(false);
      expect(processor.isBackupFile('config.json')).toBe(false);
      expect(processor.isBackupFile('README.md')).toBe(false);
    });
  });

  describe('inferOriginalType', () => {
    it('should infer JavaScript from .js.bak files', () => {
      const result = processor.inferOriginalType('test.js.bak');
      
      expect(result.originalExtension).toBe('.js');
      expect(result.originalLanguage).toBe('javascript');
      expect(result.originalFileName).toBe('test.js');
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it('should infer TypeScript from .ts.backup files', () => {
      const result = processor.inferOriginalType('app.ts.backup');
      
      expect(result.originalExtension).toBe('.ts');
      expect(result.originalLanguage).toBe('typescript');
      expect(result.originalFileName).toBe('app.ts');
    });

    it('should infer Python from .py.old files', () => {
      const result = processor.inferOriginalType('script.py.old');
      
      expect(result.originalExtension).toBe('.py');
      expect(result.originalLanguage).toBe('python');
      expect(result.originalFileName).toBe('script.py');
    });

    it('should handle Vim swap files correctly', () => {
      const result = processor.inferOriginalType('.test.js.swp');
      
      expect(result.originalExtension).toBe('.js');
      expect(result.originalLanguage).toBe('javascript');
      expect(result.originalFileName).toBe('test.js');
    });

    it('should handle Emacs backup files correctly', () => {
      const result = processor.inferOriginalType('test.ts~');
      
      expect(result.originalExtension).toBe('.ts');
      expect(result.originalLanguage).toBe('typescript');
      expect(result.originalFileName).toBe('test.ts');
    });

    it('should handle temporary files with # markers', () => {
      const result = processor.inferOriginalType('#config.json#');
      
      expect(result.originalExtension).toBe('.json');
      expect(result.originalLanguage).toBe('json');
      expect(result.originalFileName).toBe('config.json');
    });

    it('should infer language with high confidence for files with extension.backup pattern', () => {
      const result = processor.inferOriginalType('script.py.bak');
      
      expect(result.originalExtension).toBe('.py');
      expect(result.originalLanguage).toBe('python');
      expect(result.originalFileName).toBe('script.py');
      expect(result.confidence).toBe(0.95); // High confidence for this pattern
    });

    it('should infer language with high confidence for files with extension.backup pattern - multiple examples', () => {
      const testCases = [
        { file: 'app.ts.backup', ext: '.ts', lang: 'typescript', name: 'app.ts', conf: 0.95 },
        { file: 'main.cpp.bak', ext: '.cpp', lang: 'cpp', name: 'main.cpp', conf: 0.95 },
        { file: 'config.json.old', ext: '.json', lang: 'json', name: 'config.json', conf: 0.95 },
        { file: 'styles.css.tmp', ext: '.css', lang: 'css', name: 'styles.css', conf: 0.95 },
      ];

      for (const testCase of testCases) {
        const result = processor.inferOriginalType(testCase.file);
        expect(result.originalExtension).toBe(testCase.ext);
        expect(result.originalLanguage).toBe(testCase.lang);
        expect(result.originalFileName).toBe(testCase.name);
        expect(result.confidence).toBe(testCase.conf);
      }
    });

    it('should not infer language from invalid extensions in extension.backup pattern', () => {
      const result = processor.inferOriginalType('readme.invalid.bak');
      
      // Should fallback to standard processing - special pattern should be skipped
      // since 'invalid' is not a valid language extension
      expect(result.originalExtension).toBe('');
      expect(result.originalLanguage).toBe('unknown');
      expect(result.originalFileName).toBe('readme.invalid.bak');
      expect(result.confidence).toBe(0.5); // Default confidence
    });
  });

  describe('isLikelyCodeFile', () => {
    it('should return true for code file backups', () => {
      expect(processor.isLikelyCodeFile('script.js.bak')).toBe(true);
      expect(processor.isLikelyCodeFile('app.ts.backup')).toBe(true);
      expect(processor.isLikelyCodeFile('style.css.old')).toBe(true);
    });

    it('should return false for non-code file backups', () => {
      expect(processor.isLikelyCodeFile('document.txt.bak')).toBe(false);
      expect(processor.isLikelyCodeFile('image.jpg.backup')).toBe(false);
    });
  });
});