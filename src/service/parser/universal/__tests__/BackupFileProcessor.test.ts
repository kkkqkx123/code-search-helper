
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
  });

  describe('isLikelyCodeFile', () => {
    it('should return true for code file backups', () => {
      expect(processor.isLikelyCodeFile('