
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
      expect(result.confidence).toBe(0.95); // High confidence for special pattern
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


    it('should infer language with high confidence for files with extension.backup pattern', () => {
      const result = processor.inferOriginalType('script.py.bak');
      
      expect(result.originalExtension).toBe('.py');
      expect(result.originalLanguage).toBe('python');
      expect(result.originalFileName).toBe('script.py');
      expect(result.confidence).toBe(0.95); // High confidence for this pattern
    });
    
    it('should infer language with high confidence for standard backup files', () => {
      const result = processor.inferOriginalType('script.py.backup');
      
      expect(result.originalExtension).toBe('.py');
      expect(result.originalLanguage).toBe('python');
      expect(result.originalFileName).toBe('script.py');
      expect(result.confidence).toBe(0.95); // High confidence for special pattern
    });
    
    it('should infer language with high confidence for files with extension only', () => {
      const result = processor.inferOriginalType('unknown.py.temp');
      
      expect(result.originalExtension).toBe('.py');
      expect(result.originalLanguage).toBe('python');
      expect(result.originalFileName).toBe('unknown.py');
      expect(result.confidence).toBe(0.95); // High confidence for special pattern
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
    
    it('should infer language with low confidence for standard backup files without extension pattern', () => {
      // 创建一个不匹配特殊模式的备份文件
      const result = processor.inferOriginalType('data.bak');
      
      expect(result.originalExtension).toBe('.bak'); // From extension pattern matching
      expect(result.originalLanguage).toBe('unknown'); // .bak is not a valid language extension
      expect(result.originalFileName).toBe('data');
      expect(result.confidence).toBe(0.6); // Low confidence from extension pattern matching
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