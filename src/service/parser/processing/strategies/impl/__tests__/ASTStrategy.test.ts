import { ASTStrategy } from '../ASTStrategy';
import { LoggerService } from '../../../../../../utils/LoggerService';
import { TreeSitterService } from '../../../../core/parse/TreeSitterService';
import { DetectionResult } from '../../../detection/UnifiedDetectionService';

// Mock LoggerService
jest.mock('../../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock TreeSitterService
jest.mock('../../../../core/parse/TreeSitterService');
const MockTreeSitterService = TreeSitterService as jest.MockedClass<typeof TreeSitterService>;

describe('ASTStrategy', () => {
  let strategy: ASTStrategy;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockTreeSitterService: jest.Mocked<TreeSitterService>;

  const createMockDetectionResult = (language: string = 'javascript'): DetectionResult => ({
    language,
    confidence: 0.9,
    detectionMethod: 'extension',
    fileType: 'normal',
    metadata: {
      originalExtension: '.js',
      fileFeatures: {
        isCodeFile: true,
        isTextFile: false,
        isMarkdownFile: false,
        isXMLFile: false,
        isStructuredFile: true,
        isHighlyStructured: true,
        complexity: 10,
        lineCount: 100,
        size: 1024,
        hasImports: true,
        hasExports: true,
        hasFunctions: true,
        hasClasses: true
      }
    }
  });

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    // 创建一个空的mock对象，而不是实例化
    mockTreeSitterService = {
      detectLanguage: jest.fn(),
      parseCode: jest.fn(),
      extractFunctions: jest.fn(),
      extractClasses: jest.fn(),
      getNodeLocation: jest.fn(),
      getNodeText: jest.fn(),
    } as any;

    strategy = new ASTStrategy(mockTreeSitterService, mockLogger);
  });

  describe('getName', () => {
    it('should return the strategy name', () => {
      expect(strategy.getName()).toBe('ASTStrategy');
    });
  });

  describe('getDescription', () => {
    it('should return the strategy description', () => {
      expect(strategy.getDescription()).toBe('Uses TreeSitter AST parsing to extract functions and classes');
    });
  });

  describe('execute', () => {
    const filePath = 'test.js';
    const content = `
      function testFunction() {
        return 'test';
      }

      class TestClass {
        constructor() {
          this.value = 42;
        }
      }
    `;
    const detection = createMockDetectionResult('javascript');

    it('should throw error when TreeSitterService is not available', async () => {
      strategy = new ASTStrategy(undefined, mockLogger);

      await expect(strategy.execute(filePath, content, detection)).rejects.toThrow('TreeSitterService not available');
      expect(mockLogger.warn).toHaveBeenCalledWith('TreeSitterService not available, falling back to semantic strategy');
    });

    it('should throw error when language is not supported', async () => {
      mockTreeSitterService.detectLanguage.mockResolvedValue(null);

      await expect(strategy.execute(filePath, content, detection)).rejects.toThrow('Language not supported by TreeSitter for test.js');
      expect(mockLogger.warn).toHaveBeenCalledWith('Language not supported by TreeSitter for test.js');
    });

    it('should throw error when parsing fails', async () => {
      const detectedLanguage = { name: 'javascript', fileExtensions: ['.js'], supported: true };
      mockTreeSitterService.detectLanguage.mockResolvedValue(detectedLanguage);
      
      // 创建一个mock的SyntaxNode对象
      const mockAstNode = {
        type: 'program',
        id: 1,
        typeId: 1,
        grammarId: 1,
        text: content,
        startByte: 0,
        endByte: content.length,
        startLine: 1,
        endLine: 10,
        parent: null,
        children: [],
        tree: null,
        grammarType: 'program',
        isNamed: true,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 10, column: 0 },
        startIndex: 0,
        endIndex: content.length,
        parse: jest.fn(),
        edit: jest.fn(),
        walk: jest.fn(),
        equals: jest.fn(),
        hasChanges: jest.fn(),
        isMissing: false,
        isExtra: false,
        isError: false,
        toString: jest.fn().mockReturnValue(content),
      } as any;

      mockTreeSitterService.parseCode.mockResolvedValue({
        success: false,
        ast: mockAstNode,
        language: detectedLanguage,
        parseTime: 10,
        error: 'Parse failed'
      } as any);

      await expect(strategy.execute(filePath, content, detection)).rejects.toThrow('TreeSitter parsing failed for test.js');
      expect(mockLogger.warn).toHaveBeenCalledWith('TreeSitter parsing failed for test.js');
    });

    it('should extract functions and classes successfully', async () => {
      const detectedLanguage = { name: 'javascript', fileExtensions: ['.js'], supported: true };
      
      // 创建一个mock的SyntaxNode对象
      const mockAstNode = {
        type: 'program',
        id: 1,
        typeId: 1,
        grammarId: 1,
        text: content,
        startByte: 0,
        endByte: content.length,
        startLine: 1,
        endLine: 10,
        parent: null,
        children: [],
        tree: null,
        grammarType: 'program',
        isNamed: true,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 10, column: 0 },
        startIndex: 0,
        endIndex: content.length,
        parse: jest.fn(),
        edit: jest.fn(),
        walk: jest.fn(),
        equals: jest.fn(),
        hasChanges: jest.fn(),
        isMissing: false,
        isExtra: false,
        isError: false,
        toString: jest.fn().mockReturnValue(content),
      } as any;

      const mockFunctionNode = {
        type: 'function_declaration',
        id: 2,
        typeId: 2,
        grammarId: 2,
        text: "function testFunction() {\n        return 'test';\n      }",
        startByte: 7,
        endByte: 44,
        startLine: 2,
        endLine: 4,
        parent: mockAstNode,
        children: [],
        tree: mockAstNode.tree,
        grammarType: 'function_declaration',
        isNamed: true,
        startPosition: { row: 2, column: 0 },
        endPosition: { row: 4, column: 0 },
        startIndex: 7,
        endIndex: 44,
        parse: jest.fn(),
        edit: jest.fn(),
        walk: jest.fn(),
        equals: jest.fn(),
        hasChanges: jest.fn(),
        isMissing: false,
        isExtra: false,
        isError: false,
        toString: jest.fn().mockReturnValue("function testFunction() {\n  return 'test';\n}"),
      } as any;

      const mockClassNode = {
        type: 'class_declaration',
        id: 3,
        typeId: 3,
        grammarId: 3,
        text: "class TestClass {\n        constructor() {\n          this.value = 42;\n        }\n      }",
        startByte: 47,
        endByte: 111,
        startLine: 6,
        endLine: 10,
        parent: mockAstNode,
        children: [],
        tree: mockAstNode.tree,
        grammarType: 'class_declaration',
        isNamed: true,
        startPosition: { row: 6, column: 0 },
        endPosition: { row: 10, column: 0 },
        startIndex: 47,
        endIndex: 111,
        parse: jest.fn(),
        edit: jest.fn(),
        walk: jest.fn(),
        equals: jest.fn(),
        hasChanges: jest.fn(),
        isMissing: false,
        isExtra: false,
        isError: false,
        toString: jest.fn().mockReturnValue("class TestClass {\n        constructor() {\n          this.value = 42;\n        }\n      }"),
      } as any;

      mockTreeSitterService.detectLanguage.mockResolvedValue(detectedLanguage);
      mockTreeSitterService.parseCode.mockResolvedValue({
        success: true,
        ast: mockAstNode,
        language: detectedLanguage,
        parseTime: 10,
      } as any);
      mockTreeSitterService.extractFunctions.mockResolvedValue([mockFunctionNode]);
      mockTreeSitterService.extractClasses.mockResolvedValue([mockClassNode]);
      mockTreeSitterService.getNodeLocation.mockReturnValue({ startLine: 2, endLine: 4, startColumn: 0, endColumn: 0 });
      mockTreeSitterService.getNodeText.mockReturnValue("function testFunction() {\n  return 'test';\n}");

      const result = await strategy.execute(filePath, content, detection);

      expect(result).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith('Using TreeSitter AST parsing for javascript');
      expect(mockLogger.debug).toHaveBeenCalledWith('TreeSitter extracted 1 functions and 1 classes');
    });

    it('should handle case when no functions or classes found', async () => {
      const detectedLanguage = { name: 'javascript', fileExtensions: ['.js'], supported: true };
      
      // 创建一个mock的SyntaxNode对象
      const mockAstNode = {
        type: 'program',
        id: 1,
        typeId: 1,
        grammarId: 1,
        text: content,
        startByte: 0,
        endByte: content.length,
        startLine: 1,
        endLine: 10,
        parent: null,
        children: [],
        tree: null,
        grammarType: 'program',
        isNamed: true,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 10, column: 0 },
        startIndex: 0,
        endIndex: content.length,
        parse: jest.fn(),
        edit: jest.fn(),
        walk: jest.fn(),
        equals: jest.fn(),
        hasChanges: jest.fn(),
        isMissing: false,
        isExtra: false,
        isError: false,
        toString: jest.fn().mockReturnValue(content),
      } as any;

      mockTreeSitterService.detectLanguage.mockResolvedValue(detectedLanguage);
      mockTreeSitterService.parseCode.mockResolvedValue({
        success: true,
        ast: mockAstNode,
        language: detectedLanguage,
        parseTime: 10,
      } as any);
      mockTreeSitterService.extractFunctions.mockResolvedValue([]);
      mockTreeSitterService.extractClasses.mockResolvedValue([]);

      const result = await strategy.execute(filePath, content, detection);

      expect(result).toBeDefined();
    });

    it('should handle parsing errors gracefully', async () => {
      const detectedLanguage = { name: 'javascript', fileExtensions: ['.js'], supported: true };

      mockTreeSitterService.detectLanguage.mockResolvedValue(detectedLanguage);
      mockTreeSitterService.parseCode.mockRejectedValue(new Error('Parse error'));

      const result = await strategy.execute(filePath, content, detection);

      expect(result).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith('AST strategy failed: Parse error');
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate complexity correctly', () => {
      const content = `
        if (condition) {
          for (let i = 0; i < 10; i++) {
            function test() {
              return i;
            }
          }
        }
      `;

      // Access private method for testing
      const complexity = (strategy as any).calculateComplexity(content);

      expect(typeof complexity).toBe('number');
      expect(complexity).toBeGreaterThan(0);
    });

    it('should handle empty content', () => {
      const complexity = (strategy as any).calculateComplexity('');
      expect(complexity).toBeGreaterThan(0); // Due to length and line calculations
    });
  });
});
