import { UnifiedDetectionService, DetectionResult, ProcessingStrategyType } from '../UnifiedDetectionService';
import { UnifiedConfigManager } from '../../../config/UnifiedConfigManager';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { FileFeatureDetector } from '../FileFeatureDetector';
import { LanguageDetectionService } from '../LanguageDetectionService';
import { BackupFileProcessor } from '../BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../ExtensionlessFileProcessor';
import { LanguageDetector } from '../../../core/language-detection/LanguageDetector';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';

describe('UnifiedDetectionService', () => {
  let service: UnifiedDetectionService;
  let mockLogger: LoggerService;
  let mockConfigManager: jest.Mocked<UnifiedConfigManager>;
  let mockTreeSitterService: jest.Mocked<TreeSitterService>;
  let mockFileFeatureDetector: jest.Mocked<FileFeatureDetector>;
  let mockBackupFileProcessor: jest.Mocked<BackupFileProcessor>;
  let mockExtensionlessFileProcessor: jest.Mocked<ExtensionlessFileProcessor>;
  let mockLanguageDetector: jest.Mocked<LanguageDetector>;

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

    // Create mock config manager
    mockConfigManager = {
      get: jest.fn(),
      set: jest.fn(),
      getAll: jest.fn(),
      has: jest.fn(),
      clear: jest.fn()
    } as any;

    // Create mock TreeSitter service
    mockTreeSitterService = {
      getSupportedLanguages: jest.fn(),
      parseCode: jest.fn(),
      extractFunctions: jest.fn(),
      extractClasses: jest.fn()
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

    // Create mock backup file processor
    mockBackupFileProcessor = {
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

    // Create mock extensionless file processor
    mockExtensionlessFileProcessor = {
      detectLanguageByContent: jest.fn(),
      isLikelyCodeFile: jest.fn(),
      addSyntaxPattern: jest.fn(),
      addShebangPattern: jest.fn(),
      addFileStructurePattern: jest.fn()
    } as any;

    // Create mock language detector
    mockLanguageDetector = {
      detectLanguageByExtension: jest.fn()
    } as any;

    // Mock FileFeatureDetector.getInstance
    (FileFeatureDetector.getInstance as jest.Mock) = jest.fn().mockReturnValue(mockFileFeatureDetector);

    // Create service instance
    service = new UnifiedDetectionService(
      mockLogger,
      mockConfigManager,
      mockTreeSitterService,
      mockFileFeatureDetector,
      mockBackupFileProcessor,
      mockExtensionlessFileProcessor,
      mockLanguageDetector
    );
  });

  describe('constructor', () => {
    it('should initialize with provided dependencies', () => {
      expect(service).toBeDefined();
      // 当提供了fileFeatureDetector参数时，不会调用FileFeatureDetector.getInstance
      expect(mockLogger.debug).toHaveBeenCalledWith('UnifiedDetectionService initialized');
    });

    it('should create default dependencies if not provided', () => {
      const serviceWithoutDeps = new UnifiedDetectionService();
      expect(serviceWithoutDeps).toBeDefined();
    });
  });

  describe('detectFile', () => {
    it('should detect backup files', async () => {
      const filePath = 'test.js.bak';
      const content = 'console.log("Hello");';
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

      mockBackupFileProcessor.isBackupFile.mockReturnValue(true);
      mockBackupFileProcessor.getBackupFileMetadata.mockReturnValue(backupMetadata);
      mockFileFeatureDetector.isCodeLanguage.mockReturnValue(true);
      mockFileFeatureDetector.isTextLanguage.mockReturnValue(false);
      mockFileFeatureDetector.isMarkdown.mockReturnValue(false);
      mockFileFeatureDetector.isXML.mockReturnValue(false);
      mockFileFeatureDetector.isHighlyStructured.mockReturnValue(false);
      mockFileFeatureDetector.isStructuredFile.mockReturnValue(false);
      mockFileFeatureDetector.calculateComplexity.mockReturnValue(5);
      mockFileFeatureDetector.hasImports.mockReturnValue(false);
      mockFileFeatureDetector.hasExports.mockReturnValue(false);
      mockFileFeatureDetector.hasFunctions.mockReturnValue(true);
      mockFileFeatureDetector.hasClasses.mockReturnValue(false);

      const result = await service.detectFile(filePath, content);

      expect(result.language).toBe('javascript');
      expect(result.confidence).toBe(0.9);
      expect(result.detectionMethod).toBe('backup');
      expect(result.fileType).toBe('backup');
      expect(result.metadata.fileFeatures).toBeDefined();
    });

    it('should detect language by extension with high confidence', async () => {
      const filePath = 'test.js';
      const content = 'console.log("Hello");';

      mockBackupFileProcessor.isBackupFile.mockReturnValue(false);
      mockLanguageDetector.detectLanguageByExtension.mockReturnValue('javascript');
      mockExtensionlessFileProcessor.detectLanguageByContent.mockReturnValue({
        language: 'unknown',
        confidence: 0.3,
        indicators: []
      });
      mockFileFeatureDetector.isCodeLanguage.mockReturnValue(true);
      mockFileFeatureDetector.isTextLanguage.mockReturnValue(false);
      mockFileFeatureDetector.isMarkdown.mockReturnValue(false);
      mockFileFeatureDetector.isXML.mockReturnValue(false);
      mockFileFeatureDetector.isHighlyStructured.mockReturnValue(false);
      mockFileFeatureDetector.isStructuredFile.mockReturnValue(false);
      mockFileFeatureDetector.calculateComplexity.mockReturnValue(5);
      mockFileFeatureDetector.hasImports.mockReturnValue(false);
      mockFileFeatureDetector.hasExports.mockReturnValue(false);
      mockFileFeatureDetector.hasFunctions.mockReturnValue(true);
      mockFileFeatureDetector.hasClasses.mockReturnValue(false);

      const result = await service.detectFile(filePath, content);

      expect(result.language).toBe('javascript');
      expect(result.confidence).toBe(0.9);
      expect(result.detectionMethod).toBe('extension');
      expect(result.fileType).toBe('normal');
    });

    it('should detect language by content when extension detection is weak', async () => {
      const filePath = 'testfile';
      const content = '#!/usr/bin/env python\nprint("Hello");';

      mockBackupFileProcessor.isBackupFile.mockReturnValue(false);
      mockLanguageDetector.detectLanguageByExtension.mockReturnValue('unknown');
      mockExtensionlessFileProcessor.detectLanguageByContent.mockReturnValue({
        language: 'python',
        confidence: 0.8,
        indicators: ['shebang: #!/usr/bin/env python']
      });
      mockFileFeatureDetector.isCodeLanguage.mockReturnValue(true);
      mockFileFeatureDetector.isTextLanguage.mockReturnValue(false);
      mockFileFeatureDetector.isMarkdown.mockReturnValue(false);
      mockFileFeatureDetector.isXML.mockReturnValue(false);
      mockFileFeatureDetector.isHighlyStructured.mockReturnValue(false);
      mockFileFeatureDetector.isStructuredFile.mockReturnValue(false);
      mockFileFeatureDetector.calculateComplexity.mockReturnValue(5);
      mockFileFeatureDetector.hasImports.mockReturnValue(false);
      mockFileFeatureDetector.hasExports.mockReturnValue(false);
      mockFileFeatureDetector.hasFunctions.mockReturnValue(true);
      mockFileFeatureDetector.hasClasses.mockReturnValue(false);

      const result = await service.detectFile(filePath, content);

      expect(result.language).toBe('python');
      expect(result.confidence).toBe(0.8);
      expect(result.detectionMethod).toBe('content');
      expect(result.fileType).toBe('extensionless');
    });

    it('should use hybrid detection when both extension and content provide results', async () => {
      const filePath = 'test.py';
      const content = 'def hello():\n    print("Hello")';

      mockBackupFileProcessor.isBackupFile.mockReturnValue(false);
      mockLanguageDetector.detectLanguageByExtension.mockReturnValue('python');
      mockExtensionlessFileProcessor.detectLanguageByContent.mockReturnValue({
        language: 'python',
        confidence: 0.7,
        indicators: ['def keyword']
      });
      mockFileFeatureDetector.isCodeLanguage.mockReturnValue(true);
      mockFileFeatureDetector.isTextLanguage.mockReturnValue(false);
      mockFileFeatureDetector.isMarkdown.mockReturnValue(false);
      mockFileFeatureDetector.isXML.mockReturnValue(false);
      mockFileFeatureDetector.isHighlyStructured.mockReturnValue(false);
      mockFileFeatureDetector.isStructuredFile.mockReturnValue(false);
      mockFileFeatureDetector.calculateComplexity.mockReturnValue(5);
      mockFileFeatureDetector.hasImports.mockReturnValue(false);
      mockFileFeatureDetector.hasExports.mockReturnValue(false);
      mockFileFeatureDetector.hasFunctions.mockReturnValue(true);
      mockFileFeatureDetector.hasClasses.mockReturnValue(false);

      const result = await service.detectFile(filePath, content);

      expect(result.language).toBe('python');
      expect(result.detectionMethod).toBe('extension');
      expect(result.fileType).toBe('normal');
    });

    it('should generate AST for appropriate files', async () => {
      const filePath = 'test.js';
      const content = 'function test() { return 42; }';
      const supportedLanguages = [{ name: 'javascript', supported: true, fileExtensions: ['.js'] }];
      const parseResult = { success: true, ast: { type: 'Program' } as any, language: supportedLanguages[0], parseTime: 10 };
      const functions = [{ name: 'test', type: 'function' }] as any;
      const classes: never[] = [];

      mockBackupFileProcessor.isBackupFile.mockReturnValue(false);
      mockLanguageDetector.detectLanguageByExtension.mockReturnValue('javascript');
      mockExtensionlessFileProcessor.detectLanguageByContent.mockReturnValue({
        language: 'unknown',
        confidence: 0.3,
        indicators: []
      });
      mockFileFeatureDetector.isCodeLanguage.mockReturnValue(true);
      mockFileFeatureDetector.isTextLanguage.mockReturnValue(false);
      mockFileFeatureDetector.isMarkdown.mockReturnValue(false);
      mockFileFeatureDetector.isXML.mockReturnValue(false);
      mockFileFeatureDetector.isHighlyStructured.mockReturnValue(true);
      mockFileFeatureDetector.isStructuredFile.mockReturnValue(true);
      mockFileFeatureDetector.calculateComplexity.mockReturnValue(5);
      mockFileFeatureDetector.hasImports.mockReturnValue(false);
      mockFileFeatureDetector.hasExports.mockReturnValue(false);
      mockFileFeatureDetector.hasFunctions.mockReturnValue(true);
      mockFileFeatureDetector.hasClasses.mockReturnValue(false);
      mockTreeSitterService.getSupportedLanguages.mockReturnValue(supportedLanguages);
      mockTreeSitterService.parseCode.mockResolvedValue(parseResult);
      mockTreeSitterService.extractFunctions.mockResolvedValue(functions);
      mockTreeSitterService.extractClasses.mockResolvedValue(classes);

      const result = await service.detectFile(filePath, content);

      expect(result.metadata.astInfo).toBeDefined();
      expect(result.metadata.astInfo.language).toBe('javascript');
      expect(result.metadata.astInfo.functions).toBe(1);
      expect(result.metadata.astInfo.classes).toBe(0);
    });

    it('should handle AST generation failures gracefully', async () => {
      const filePath = 'test.js';
      const content = 'function test() { return 42; }';

      mockBackupFileProcessor.isBackupFile.mockReturnValue(false);
      mockLanguageDetector.detectLanguageByExtension.mockReturnValue('javascript');
      mockExtensionlessFileProcessor.detectLanguageByContent.mockReturnValue({
        language: 'unknown',
        confidence: 0.3,
        indicators: []
      });
      mockFileFeatureDetector.isCodeLanguage.mockReturnValue(true);
      mockFileFeatureDetector.isTextLanguage.mockReturnValue(false);
      mockFileFeatureDetector.isMarkdown.mockReturnValue(false);
      mockFileFeatureDetector.isXML.mockReturnValue(false);
      mockFileFeatureDetector.isHighlyStructured.mockReturnValue(true);
      mockFileFeatureDetector.isStructuredFile.mockReturnValue(true);
      mockFileFeatureDetector.calculateComplexity.mockReturnValue(5);
      mockFileFeatureDetector.hasImports.mockReturnValue(false);
      mockFileFeatureDetector.hasExports.mockReturnValue(false);
      mockFileFeatureDetector.hasFunctions.mockReturnValue(true);
      mockFileFeatureDetector.hasClasses.mockReturnValue(false);
      mockTreeSitterService.getSupportedLanguages.mockReturnValue([]);
      mockTreeSitterService.parseCode.mockResolvedValue({ success: false, ast: null as any, language: null as any, parseTime: 0 });

      const result = await service.detectFile(filePath, content);

      expect(result.metadata.astInfo).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TreeSitter does not support language: javascript'
      );
    });

    it('should use cache for repeated detections', async () => {
      const filePath = 'test.js';
      const content = 'console.log("Hello");';

      mockBackupFileProcessor.isBackupFile.mockReturnValue(false);
      mockLanguageDetector.detectLanguageByExtension.mockReturnValue('javascript');
      mockExtensionlessFileProcessor.detectLanguageByContent.mockReturnValue({
        language: 'unknown',
        confidence: 0.3,
        indicators: []
      });
      mockFileFeatureDetector.isCodeLanguage.mockReturnValue(true);
      mockFileFeatureDetector.isTextLanguage.mockReturnValue(false);
      mockFileFeatureDetector.isMarkdown.mockReturnValue(false);
      mockFileFeatureDetector.isXML.mockReturnValue(false);
      mockFileFeatureDetector.isHighlyStructured.mockReturnValue(false);
      mockFileFeatureDetector.isStructuredFile.mockReturnValue(false);
      mockFileFeatureDetector.calculateComplexity.mockReturnValue(5);
      mockFileFeatureDetector.hasImports.mockReturnValue(false);
      mockFileFeatureDetector.hasExports.mockReturnValue(false);
      mockFileFeatureDetector.hasFunctions.mockReturnValue(true);
      mockFileFeatureDetector.hasClasses.mockReturnValue(false);

      // First call
      const result1 = await service.detectFile(filePath, content);
      // Second call (should use cache)
      const result2 = await service.detectFile(filePath, content);

      expect(result1).toEqual(result2);
      expect(mockLogger.debug).toHaveBeenCalledWith('Cache hit for detection: test.js');
    });

    it('should handle errors and create fallback result', async () => {
      const filePath = 'test.js';
      const content = 'console.log("Hello");';
      const error = new Error('Test error');

      mockBackupFileProcessor.isBackupFile.mockImplementation(() => {
        throw error;
      });

      const result = await service.detectFile(filePath, content);

      expect(result.language).toBe('text');
      expect(result.confidence).toBe(0.1);
      expect(result.detectionMethod).toBe('hybrid');
      expect(result.fileType).toBe('unknown');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('File detection failed for test.js:'),
        error
      );
    });

    it('should log debug information', async () => {
      const filePath = 'test.js';
      const content = 'console.log("Hello");';

      mockBackupFileProcessor.isBackupFile.mockReturnValue(false);
      mockLanguageDetector.detectLanguageByExtension.mockReturnValue('javascript');
      mockExtensionlessFileProcessor.detectLanguageByContent.mockReturnValue({
        language: 'unknown',
        confidence: 0.3,
        indicators: []
      });
      mockFileFeatureDetector.isCodeLanguage.mockReturnValue(true);
      mockFileFeatureDetector.isTextLanguage.mockReturnValue(false);
      mockFileFeatureDetector.isMarkdown.mockReturnValue(false);
      mockFileFeatureDetector.isXML.mockReturnValue(false);
      mockFileFeatureDetector.isHighlyStructured.mockReturnValue(false);
      mockFileFeatureDetector.isStructuredFile.mockReturnValue(false);
      mockFileFeatureDetector.calculateComplexity.mockReturnValue(5);
      mockFileFeatureDetector.hasImports.mockReturnValue(false);
      mockFileFeatureDetector.hasExports.mockReturnValue(false);
      mockFileFeatureDetector.hasFunctions.mockReturnValue(true);
      mockFileFeatureDetector.hasClasses.mockReturnValue(false);

      await service.detectFile(filePath, content);

      expect(mockLogger.debug).toHaveBeenCalledWith(`Detecting file: ${filePath}`);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Final detection result: javascript')
      );
    });
  });

  describe('recommendProcessingStrategy', () => {
    it('should recommend universal-line for low confidence', () => {
      const detection = {
        language: 'unknown',
        confidence: 0.3,
        detectionMethod: 'content' as const,
        metadata: {}
      };
      const features = {
        isCodeFile: false,
        isTextFile: true,
        isMarkdownFile: false,
        isXMLFile: false,
        isStructuredFile: false,
        isHighlyStructured: false,
        complexity: 1,
        lineCount: 5,
        size: 100,
        hasImports: false,
        hasExports: false,
        hasFunctions: false,
        hasClasses: false
      };

      // Access private method through type assertion
      const strategy = (service as any).recommendProcessingStrategy(detection, features);
      expect(strategy).toBe('universal-line');
    });

    it('should recommend universal-bracket for backup files', () => {
      const detection = {
        language: 'javascript',
        confidence: 0.8,
        detectionMethod: 'backup' as const,
        metadata: {}
      };
      const features = {
        isCodeFile: true,
        isTextFile: false,
        isMarkdownFile: false,
        isXMLFile: false,
        isStructuredFile: true,
        isHighlyStructured: true,
        complexity: 10,
        lineCount: 50,
        size: 2000,
        hasImports: true,
        hasExports: true,
        hasFunctions: true,
        hasClasses: true
      };

      const strategy = (service as any).recommendProcessingStrategy(detection, features);
      expect(strategy).toBe('universal-bracket');
    });

    it('should recommend universal-line for small files', () => {
      const detection = {
        language: 'javascript',
        confidence: 0.8,
        detectionMethod: 'extension' as const,
        metadata: {}
      };
      const features = {
        isCodeFile: true,
        isTextFile: false,
        isMarkdownFile: false,
        isXMLFile: false,
        isStructuredFile: true,
        isHighlyStructured: true,
        complexity: 5,
        lineCount: 10,
        size: 500,
        hasImports: false,
        hasExports: false,
        hasFunctions: true,
        hasClasses: false
      };

      const strategy = (service as any).recommendProcessingStrategy(detection, features);
      expect(strategy).toBe('universal-line');
    });

    it('should recommend universal_semantic for large files', () => {
      const detection = {
        language: 'javascript',
        confidence: 0.8,
        detectionMethod: 'extension' as const,
        metadata: {}
      };
      const features = {
        isCodeFile: true,
        isTextFile: false,
        isMarkdownFile: false,
        isXMLFile: false,
        isStructuredFile: true,
        isHighlyStructured: true,
        complexity: 20,
        lineCount: 200,
        size: 60000,
        hasImports: true,
        hasExports: true,
        hasFunctions: true,
        hasClasses: true
      };

      const strategy = (service as any).recommendProcessingStrategy(detection, features);
      expect(strategy).toBe('universal_semantic');
    });

    it('should recommend treesitter_ast for highly structured code files', () => {
      const detection = {
        language: 'javascript',
        confidence: 0.8,
        detectionMethod: 'extension' as const,
        metadata: {}
      };
      const features = {
        isCodeFile: true,
        isTextFile: false,
        isMarkdownFile: false,
        isXMLFile: false,
        isStructuredFile: true,
        isHighlyStructured: true,
        complexity: 15,
        lineCount: 100,
        size: 5000,
        hasImports: true,
        hasExports: true,
        hasFunctions: true,
        hasClasses: true
      };

      mockFileFeatureDetector.canUseTreeSitter.mockReturnValue(true);

      const strategy = (service as any).recommendProcessingStrategy(detection, features);
      expect(strategy).toBe('treesitter_ast');
    });

    it('should recommend universal_bracket for structured files without TreeSitter', () => {
      const detection = {
        language: 'python',
        confidence: 0.8,
        detectionMethod: 'extension' as const,
        metadata: {}
      };
      const features = {
        isCodeFile: true,
        isTextFile: false,
        isMarkdownFile: false,
        isXMLFile: false,
        isStructuredFile: true,
        isHighlyStructured: true,
        complexity: 15,
        lineCount: 100,
        size: 5000,
        hasImports: true,
        hasExports: false,
        hasFunctions: true,
        hasClasses: true
      };

      mockFileFeatureDetector.canUseTreeSitter.mockReturnValue(false);

      const strategy = (service as any).recommendProcessingStrategy(detection, features);
      expect(strategy).toBe('universal_bracket');
    });

    it('should recommend universal_semantic_fine for structured code files', () => {
      const detection = {
        language: 'javascript',
        confidence: 0.8,
        detectionMethod: 'extension' as const,
        metadata: {}
      };
      const features = {
        isCodeFile: true,
        isTextFile: false,
        isMarkdownFile: false,
        isXMLFile: false,
        isStructuredFile: true,
        isHighlyStructured: false,
        complexity: 10,
        lineCount: 50,
        size: 2000,
        hasImports: true,
        hasExports: true,
        hasFunctions: true,
        hasClasses: true
      };

      const strategy = (service as any).recommendProcessingStrategy(detection, features);
      expect(strategy).toBe('universal_semantic_fine');
    });

    it('should recommend markdown-specialized for markdown files', () => {
      const detection = {
        language: 'markdown',
        confidence: 0.8,
        detectionMethod: 'extension' as const,
        metadata: {}
      };
      const features = {
        isCodeFile: false,
        isTextFile: true,
        isMarkdownFile: true,
        isXMLFile: false,
        isStructuredFile: false,
        isHighlyStructured: false,
        complexity: 5,
        lineCount: 30,
        size: 1500,
        hasImports: false,
        hasExports: false,
        hasFunctions: false,
        hasClasses: false
      };

      const strategy = (service as any).recommendProcessingStrategy(detection, features);
      expect(strategy).toBe('markdown-specialized');
    });

    it('should recommend xml-specialized for XML files', () => {
      const detection = {
        language: 'xml',
        confidence: 0.8,
        detectionMethod: 'extension' as const,
        metadata: {}
      };
      const features = {
        isCodeFile: false,
        isTextFile: false,
        isMarkdownFile: false,
        isXMLFile: true,
        isStructuredFile: true,
        isHighlyStructured: false, // XML文件通常不是高度结构化的代码文件
        complexity: 5,
        lineCount: 20,
        size: 1000,
        hasImports: false,
        hasExports: false,
        hasFunctions: false,
        hasClasses: false
      };

      const strategy = (service as any).recommendProcessingStrategy(detection, features);
      expect(strategy).toBe('xml-specialized');
    });

    it('should recommend universal_semantic as default', () => {
      const detection = {
        language: 'text',
        confidence: 0.8,
        detectionMethod: 'extension' as const,
        metadata: {}
      };
      const features = {
        isCodeFile: false,
        isTextFile: true,
        isMarkdownFile: false,
        isXMLFile: false,
        isStructuredFile: false,
        isHighlyStructured: false,
        complexity: 3,
        lineCount: 20,
        size: 2000,
        hasImports: false,
        hasExports: false,
        hasFunctions: false,
        hasClasses: false
      };

      const strategy = (service as any).recommendProcessingStrategy(detection, features);
      expect(strategy).toBe('universal_semantic');
    });
  });

  describe('clearCache', () => {
    it('should clear the detection cache', () => {
      service.clearCache();
      expect(mockLogger.info).toHaveBeenCalledWith('UnifiedDetectionService cache cleared');
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = service.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('limit');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.limit).toBe('number');
    });
  });

  describe('batchDetect', () => {
    it('should detect multiple files in parallel', async () => {
      const files = [
        { filePath: 'test1.js', content: 'console.log("test1");' },
        { filePath: 'test2.py', content: 'print("test2")' },
        { filePath: 'test3.md', content: '# Test 3' }
      ];

      mockBackupFileProcessor.isBackupFile.mockReturnValue(false);
      mockLanguageDetector.detectLanguageByExtension.mockImplementation((filePath: string) => {
        if (filePath.endsWith('.js')) return 'javascript';
        if (filePath.endsWith('.py')) return 'python';
        if (filePath.endsWith('.md')) return 'markdown';
        return 'unknown';
      });
      mockExtensionlessFileProcessor.detectLanguageByContent.mockReturnValue({
        language: 'unknown',
        confidence: 0.3,
        indicators: []
      });
      mockFileFeatureDetector.isCodeLanguage.mockImplementation((language: string) => {
        return language === 'javascript' || language === 'python';
      });
      mockFileFeatureDetector.isTextLanguage.mockReturnValue(false);
      mockFileFeatureDetector.isMarkdown.mockReturnValue(false);
      mockFileFeatureDetector.isXML.mockReturnValue(false);
      mockFileFeatureDetector.isHighlyStructured.mockReturnValue(false);
      mockFileFeatureDetector.isStructuredFile.mockReturnValue(false);
      mockFileFeatureDetector.calculateComplexity.mockReturnValue(5);
      mockFileFeatureDetector.hasImports.mockReturnValue(false);
      mockFileFeatureDetector.hasExports.mockReturnValue(false);
      mockFileFeatureDetector.hasFunctions.mockReturnValue(false);
      mockFileFeatureDetector.hasClasses.mockReturnValue(false);

      const results = await service.batchDetect(files);

      expect(results.size).toBe(3);
      expect(results.get('test1.js')?.language).toBe('javascript');
      expect(results.get('test2.py')?.language).toBe('python');
      expect(results.get('test3.md')?.language).toBe('markdown');
    });
  });
});