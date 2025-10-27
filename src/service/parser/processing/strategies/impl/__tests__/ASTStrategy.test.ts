import { ASTStrategy } from '../ASTStrategy';
import { LoggerService } from '../../../../../../utils/LoggerService';
import { TreeSitterService } from '../../../../core/parse/TreeSitterService';
import { DetectionResult } from '../../../detection/UnifiedDetectionCenter';

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
    features: ['ast'],
    detectedBy: 'test'
  });

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    mockTreeSitterService = new MockTreeSitterService() as jest.Mocked<TreeSitterService>;
    mockTreeSitterService.detectLanguage = jest.fn();
    mockTreeSitterService.parseCode = jest.fn();
    mockTreeSitterService.extractFunctions = jest.fn();
    mockTreeSitterService.extractClasses = jest.fn();
    mockTreeSitterService.getNodeLocation = jest.fn();
    mockTreeSitterService.getNodeText = jest.fn();

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
      const detectedLanguage = { name: 'javascript' };
      mockTreeSitterService.detectLanguage.mockResolvedValue(detectedLanguage);
      mockTreeSitterService.parseCode.mockResolvedValue({
        success: false,
        ast: null,
        error: 'Parse failed'
      });

      await expect(strategy.execute(filePath, content, detection)).rejects.toThrow('TreeSitter parsing failed for test.js');
      expect(mockLogger.warn).toHaveBeenCalledWith('TreeSitter parsing failed for test.js');
    });

    it('should extract functions and classes successfully', async () => {
      const detectedLanguage = { name: 'javascript' };
      const mockAst = {};
      const mockFunction = {};
      const mockClass = {};

      mockTreeSitterService.detectLanguage.mockResolvedValue(detectedLanguage);
      mockTreeSitterService.parseCode.mockResolvedValue({
        success: true,
        ast: mockAst,
        error: null
      });
      mockTreeSitterService.extractFunctions.mockResolvedValue([mockFunction]);
      mockTreeSitterService.extractClasses.mockResolvedValue([mockClass]);
      mockTreeSitterService.getNodeLocation.mockReturnValue({ startLine: 2, endLine: 4 });
      mockTreeSitterService.getNodeText.mockReturnValue("function testFunction() {\n  return 'test';\n}");

      const result = await strategy.execute(filePath, content, detection);

      expect(result.chunks).toHaveLength(2);
      expect(result.chunks[0].metadata.type).toBe('function');
      expect(result.chunks[1].metadata.type).toBe('class');
      expect(result.metadata.strategy).toBe('ASTStrategy');
      expect(result.metadata.language).toBe('javascript');
      expect(mockLogger.info).toHaveBeenCalledWith('Using TreeSitter AST parsing for javascript');
      expect(mockLogger.debug).toHaveBeenCalledWith('TreeSitter extracted 1 functions and 1 classes');
    });

    it('should return fallback chunk when no functions or classes found', async () => {
      const detectedLanguage = { name: 'javascript' };
      const mockAst = {};

      mockTreeSitterService.detectLanguage.mockResolvedValue(detectedLanguage);
      mockTreeSitterService.parseCode.mockResolvedValue({
        success: true,
        ast: mockAst,
        error: null
      });
      mockTreeSitterService.extractFunctions.mockResolvedValue([]);
      mockTreeSitterService.extractClasses.mockResolvedValue([]);

      const result = await strategy.execute(filePath, content, detection);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].metadata.fallback).toBe(true);
      expect(result.metadata.error).toBe('No functions or classes found by TreeSitter');
    });

    it('should handle parsing errors gracefully', async () => {
      const detectedLanguage = { name: 'javascript' };

      mockTreeSitterService.detectLanguage.mockResolvedValue(detectedLanguage);
      mockTreeSitterService.parseCode.mockRejectedValue(new Error('Parse error'));

      const result = await strategy.execute(filePath, content, detection);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe(content);
      expect(result.metadata.error).toBe('Parse error');
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
