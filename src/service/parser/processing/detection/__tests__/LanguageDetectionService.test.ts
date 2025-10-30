import { LanguageDetectionService, LanguageDetectionResult } from '../LanguageDetectionService';
import { BackupFileProcessor } from '../BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../ExtensionlessFileProcessor';
import { FileFeatureDetector } from '../FileFeatureDetector';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';

// Mock the utils
jest.mock('../../utils', () => ({
  languageExtensionMap: {
    getLanguageFromPath: jest.fn(),
    getLanguageByExtension: jest.fn(),
    getAllSupportedLanguages: jest.fn()
  },
  fileUtils: {
    extractFileExtension: jest.fn()
  },
  languageFeatureDetector: {
    isLanguageSupportedForAST: jest.fn(),
    validateLanguageDetection: jest.fn(),
    detectLanguageByContent: jest.fn()
  }
}));

// Import the mocked modules
// @ts-ignore
import { languageExtensionMap, fileUtils, languageFeatureDetector } from '../../utils';

describe('LanguageDetectionService', () => {
  let service: LanguageDetectionService;
  let mockLogger: LoggerService;
  let mockBackupProcessor: jest.Mocked<BackupFileProcessor>;
  let mockExtensionlessProcessor: jest.Mocked<ExtensionlessFileProcessor>;
  let mockFileFeatureDetector: jest.Mocked<FileFeatureDetector>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    // Create mock backup processor
    mockBackupProcessor = {
      isBackupFile: jest.fn(),
      getBackupFileMetadata: jest.fn(),
      inferOriginalType: jest.fn(),
      detectLanguageByExtension: jest.fn(),
      getOriginalFilePath: jest.fn(),
      isLikelyCodeFile: jest.fn(),
      addBackupPattern: jest.fn(),
      removeBackupPattern: jest.fn(),
      getBackupPatterns: jest.fn()
    } as any;

    // Create mock extensionless processor
    mockExtensionlessProcessor = {
      detectLanguageByContent: jest.fn(),
      isLikelyCodeFile: jest.fn(),
      addSyntaxPattern: jest.fn(),
      addShebangPattern: jest.fn(),
      addFileStructurePattern: jest.fn()
    } as any;

    // Create mock file feature detector
    mockFileFeatureDetector = {
      isCodeLanguage: jest.fn(),
      isTextLanguage: jest.fn(),
      isMarkdown: jest.fn(),
      isXML: jest.fn(),
      canUseTreeSitter: jest.fn(),
      isStructuredFile: jest.fn(),
      isHighlyStructured: jest.fn(),
      detectLanguageByExtension: jest.fn(),
      calculateComplexity: jest.fn(),
      isSmallFile: jest.fn(),
      hasImports: jest.fn(),
      hasExports: jest.fn(),
      hasFunctions: jest.fn(),
      hasClasses: jest.fn(),
      getFileStats: jest.fn()
    } as any;

    // Mock FileFeatureDetector.getInstance
    (FileFeatureDetector.getInstance as jest.Mock) = jest.fn().mockReturnValue(mockFileFeatureDetector);

    // Create service instance
    service = new LanguageDetectionService(
      mockLogger,
      mockBackupProcessor,
      mockExtensionlessProcessor
    );
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(service).toBeDefined();
      expect(FileFeatureDetector.getInstance).toHaveBeenCalledWith(mockLogger);
    });

    it('should create default dependencies if not provided', () => {
      const serviceWithoutDeps = new LanguageDetectionService();
      expect(serviceWithoutDeps).toBeDefined();
    });
  });

  describe('detectLanguage', () => {
    it('should detect language from backup file', async () => {
      const filePath = 'test.js.bak';
      const backupMetadata = {
        isBackup: true,
        originalInfo: {
          fileName: 'test.js',
          extension: '.js',
          language: 'javascript',
          confidence: 0.9
        },
        isLikelyCode: true
      };

      mockBackupProcessor.getBackupFileMetadata.mockReturnValue(backupMetadata);

      const result = await service.detectLanguage(filePath);

      expect(result.language).toBe('javascript');
      expect(result.confidence).toBe(0.9);
      expect(result.method).toBe('backup');
      expect(result.metadata?.originalExtension).toBe('.js');
    });

    it('should detect language by extension', async () => {
      const filePath = 'test.js';
      
      mockBackupProcessor.getBackupFileMetadata.mockReturnValue({ isBackup: false, isLikelyCode: false });
      (languageExtensionMap.getLanguageFromPath as jest.Mock).mockReturnValue('javascript');
      (fileUtils.extractFileExtension as jest.Mock).mockReturnValue('.js');

      const result = await service.detectLanguage(filePath);

      expect(result.language).toBe('javascript');
      expect(result.confidence).toBe(0.9);
      expect(result.method).toBe('extension');
      expect(result.metadata?.originalExtension).toBe('.js');
    });

    it('should detect language by content', async () => {
      const filePath = 'testfile';
      const content = '#!/usr/bin/env python\nprint("Hello")';
      
      mockBackupProcessor.getBackupFileMetadata.mockReturnValue({ isBackup: false, isLikelyCode: false });
      (languageExtensionMap.getLanguageFromPath as jest.Mock).mockReturnValue('unknown');
      mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue({
        language: 'python',
        confidence: 0.8,
        indicators: ['shebang: #!/usr/bin/env python']
      });

      const result = await service.detectLanguage(filePath, content);

      expect(result.language).toBe('python');
      expect(result.confidence).toBe(0.8);
      expect(result.method).toBe('content');
      expect(result.metadata?.indicators).toEqual(['shebang: #!/usr/bin/env python']);
    });

    it('should use fallback detection when other methods fail', async () => {
      const filePath = 'testfile';
      
      mockBackupProcessor.getBackupFileMetadata.mockReturnValue({ isBackup: false, isLikelyCode: false });
      (languageExtensionMap.getLanguageFromPath as jest.Mock)
        .mockReturnValueOnce('unknown')
        .mockReturnValueOnce('text');
      mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue({
        language: 'unknown',
        confidence: 0.3,
        indicators: []
      });

      const result = await service.detectLanguage(filePath);

      expect(result.language).toBe('text');
      expect(result.confidence).toBe(0.3);
      expect(result.method).toBe('fallback');
    });

    it('should return unknown when all detection methods fail', async () => {
      const filePath = 'testfile';
      
      mockBackupProcessor.getBackupFileMetadata.mockReturnValue({ isBackup: false, isLikelyCode: false });
      (languageExtensionMap.getLanguageFromPath as jest.Mock).mockReturnValue('unknown');
      mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue({
        language: 'unknown',
        confidence: 0.3,
        indicators: []
      });

      const result = await service.detectLanguage(filePath);

      expect(result.language).toBe('unknown');
      expect(result.confidence).toBe(0.0);
      expect(result.method).toBe('fallback');
    });

    it('should handle errors gracefully', async () => {
      const filePath = 'testfile';
      const error = new Error('Test error');
      
      mockBackupProcessor.getBackupFileMetadata.mockImplementation(() => {
        throw error;
      });
      (languageExtensionMap.getLanguageFromPath as jest.Mock).mockReturnValue('text');

      const result = await service.detectLanguage(filePath);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Language detection failed for testfile:'),
        error
      );
      expect(result.language).toBe('text');
      expect(result.confidence).toBe(0.3);
      expect(result.method).toBe('fallback');
    });

    it('should log debug information', async () => {
      const filePath = 'test.js';
      
      mockBackupProcessor.getBackupFileMetadata.mockReturnValue({ isBackup: false, isLikelyCode: false });
      (languageExtensionMap.getLanguageFromPath as jest.Mock).mockReturnValue('javascript');

      await service.detectLanguage(filePath);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        `Detecting language for: ${filePath}`
      );
    });
  });

  describe('detectLanguageSync', () => {
    it('should detect language synchronously by extension', () => {
      const filePath = 'test.js';
      const expectedLanguage = 'javascript';
      
      (languageExtensionMap.getLanguageFromPath as jest.Mock).mockReturnValue(expectedLanguage);

      const result = service.detectLanguageSync(filePath);

      expect(result).toBe(expectedLanguage);
      expect(languageExtensionMap.getLanguageFromPath).toHaveBeenCalledWith(filePath);
    });

    it('should return undefined for unknown language', () => {
      const filePath = 'test.unknown';
      
      (languageExtensionMap.getLanguageFromPath as jest.Mock).mockReturnValue(undefined);

      const result = service.detectLanguageSync(filePath);

      expect(result).toBeUndefined();
    });
  });

  describe('detectLanguageByExtensionAsync', () => {
    it('should detect language by extension asynchronously', async () => {
      const filePath = 'test.js';
      const expectedLanguage = 'javascript';
      const expectedExtension = '.js';
      
      (languageExtensionMap.getLanguageFromPath as jest.Mock).mockReturnValue(expectedLanguage);
      (fileUtils.extractFileExtension as jest.Mock).mockReturnValue(expectedExtension);

      const result = await service.detectLanguageByExtensionAsync(filePath);

      expect(result.language).toBe(expectedLanguage);
      expect(result.confidence).toBe(0.9);
      expect(result.method).toBe('extension');
      expect(result.metadata?.originalExtension).toBe(expectedExtension);
    });

    it('should handle unknown language', async () => {
      const filePath = 'test.unknown';
      const expectedExtension = '.unknown';
      
      (languageExtensionMap.getLanguageFromPath as jest.Mock).mockReturnValue(undefined);
      (fileUtils.extractFileExtension as jest.Mock).mockReturnValue(expectedExtension);

      const result = await service.detectLanguageByExtensionAsync(filePath);

      expect(result.language).toBeUndefined();
      expect(result.confidence).toBe(0.1);
      expect(result.method).toBe('extension');
      expect(result.metadata?.originalExtension).toBe(expectedExtension);
    });
  });

  describe('detectLanguageByContent', () => {
    it('should detect language by content with high confidence', () => {
      const content = '#!/usr/bin/env python\nprint("Hello")';
      const expectedResult = {
        language: 'python',
        confidence: 0.8,
        indicators: ['shebang: #!/usr/bin/env python']
      };
      
      mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue(expectedResult);

      const result = service.detectLanguageByContent(content);

      expect(result.language).toBe('python');
      expect(result.confidence).toBe(0.8);
      expect(result.method).toBe('content');
      expect(result.metadata?.indicators).toEqual(['shebang: #!/usr/bin/env python']);
    });

    it('should use language feature detector for low confidence results', () => {
      const content = 'some content';
      const lowConfidenceResult = {
        language: 'unknown',
        confidence: 0.3,
        indicators: []
      };
      const featureDetectorResult = {
        language: 'text',
        confidence: 0.6,
        method: 'content' as const,
        metadata: {}
      };
      
      mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue(lowConfidenceResult);
      (languageFeatureDetector.detectLanguageByContent as jest.Mock).mockReturnValue(featureDetectorResult);

      const result = service.detectLanguageByContent(content);

      expect(result).toEqual(featureDetectorResult);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages', () => {
      const expectedLanguages = ['javascript', 'python', 'java'];
      
      (languageExtensionMap.getAllSupportedLanguages as jest.Mock).mockReturnValue(expectedLanguages);

      const result = service.getSupportedLanguages();

      expect(result).toEqual(expectedLanguages);
      expect(languageExtensionMap.getAllSupportedLanguages).toHaveBeenCalled();
    });
  });

  describe('isLanguageSupportedForAST', () => {
    it('should check if language is supported for AST', () => {
      const language = 'javascript';
      const expectedResult = true;
      
      (languageFeatureDetector.isLanguageSupportedForAST as jest.Mock).mockReturnValue(expectedResult);

      const result = service.isLanguageSupportedForAST(language);

      expect(result).toBe(expectedResult);
      expect(languageFeatureDetector.isLanguageSupportedForAST).toHaveBeenCalledWith(language);
    });
  });

  describe('validateLanguageDetection', () => {
    it('should validate language detection', () => {
      const content = 'function test() {}';
      const detectedLanguage = 'javascript';
      const expectedResult = true;
      
      (languageFeatureDetector.validateLanguageDetection as jest.Mock).mockReturnValue(expectedResult);

      const result = service.validateLanguageDetection(content, detectedLanguage);

      expect(result).toBe(expectedResult);
      expect(languageFeatureDetector.validateLanguageDetection).toHaveBeenCalledWith(content, detectedLanguage);
    });
  });

  describe('detectLanguageByExtension', () => {
    it('should detect language by extension', () => {
      const extension = '.js';
      const expectedLanguage = 'javascript';
      
      (languageExtensionMap.getLanguageByExtension as jest.Mock).mockReturnValue(expectedLanguage);

      const result = service.detectLanguageByExtension(extension);

      expect(result).toBe(expectedLanguage);
      expect(languageExtensionMap.getLanguageByExtension).toHaveBeenCalledWith(extension);
    });

    it('should return undefined for unknown extension', () => {
      const extension = '.unknown';
      
      (languageExtensionMap.getLanguageByExtension as jest.Mock).mockReturnValue(undefined);

      const result = service.detectLanguageByExtension(extension);

      expect(result).toBeUndefined();
    });
  });

  describe('getFileExtension', () => {
    it('should extract file extension', () => {
      const filePath = 'test.js';
      const expectedExtension = '.js';
      
      (fileUtils.extractFileExtension as jest.Mock).mockReturnValue(expectedExtension);

      const result = service.getFileExtension(filePath);

      expect(result).toBe(expectedExtension);
      expect(fileUtils.extractFileExtension).toHaveBeenCalledWith(filePath);
    });
  });

  describe('detectLanguageByParserConfig', () => {
    it('should detect language by parser config for backup files', () => {
      const filePath = 'test.js.bak';
      const parsers = new Map([
        ['javascript', { supported: true }]
      ]);
      const backupMetadata = {
        isBackup: true,
        originalInfo: {
          fileName: 'test.js',
          extension: '.js',
          language: 'javascript',
          confidence: 0.9
        },
        isLikelyCode: true
      };
      
      mockBackupProcessor.getBackupFileMetadata.mockReturnValue(backupMetadata);

      const result = service.detectLanguageByParserConfig(filePath, parsers);

      expect(result).toEqual({ supported: true });
    });

    it('should detect language by parser config for normal files', () => {
      const filePath = 'test.js';
      const parsers = new Map([
        ['javascript', { supported: true }]
      ]);
      
      mockBackupProcessor.getBackupFileMetadata.mockReturnValue({ isBackup: false, isLikelyCode: false });
      (fileUtils.extractFileExtension as jest.Mock).mockReturnValue('.js');
      (languageExtensionMap.getLanguageByExtension as jest.Mock).mockReturnValue('javascript');

      const result = service.detectLanguageByParserConfig(filePath, parsers);

      expect(result).toEqual({ supported: true });
    });

    it('should detect language by content for extensionless files', () => {
      const filePath = 'testfile';
      const content = '#!/usr/bin/env python\nprint("Hello")';
      const parsers = new Map([
        ['python', { supported: true }]
      ]);
      
      mockBackupProcessor.getBackupFileMetadata.mockReturnValue({ isBackup: false, isLikelyCode: false });
      (fileUtils.extractFileExtension as jest.Mock).mockReturnValue('');
      mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue({
        language: 'python',
        confidence: 0.8,
        indicators: []
      });

      const result = service.detectLanguageByParserConfig(filePath, parsers, content);

      expect(result).toEqual({ supported: true });
    });

    it('should return null for unsupported languages', () => {
      const filePath = 'test.unknown';
      const parsers = new Map([
        ['javascript', { supported: true }]
      ]);
      
      mockBackupProcessor.getBackupFileMetadata.mockReturnValue({ isBackup: false, isLikelyCode: false });
      (fileUtils.extractFileExtension as jest.Mock).mockReturnValue('.unknown');
      (languageExtensionMap.getLanguageByExtension as jest.Mock).mockReturnValue('unknown');

      const result = service.detectLanguageByParserConfig(filePath, parsers);

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', () => {
      const filePath = 'test.js';
      const parsers = new Map();
      const error = new Error('Test error');
      
      mockBackupProcessor.getBackupFileMetadata.mockImplementation(() => {
        throw error;
      });

      const result = service.detectLanguageByParserConfig(filePath, parsers);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Language detection failed for test.js:'),
        error
      );
      expect(result).toBeNull();
    });
  });
});