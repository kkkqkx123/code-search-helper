import { FileProcessingCoordinator } from '../FileProcessingCoordinator';
import { LoggerService } from '../../../../../utils/LoggerService';
import { UniversalTextSplitter } from '../UniversalTextSplitter';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { IFileProcessingContext, IStrategySelectionResult } from '../interfaces/IFileProcessingCoordinator';
import { ProcessingStrategyType } from '../interfaces/IProcessingStrategySelector';
import { CodeChunk } from '../../../splitting';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock UniversalTextSplitter
jest.mock('../UniversalTextSplitter');
const MockUniversalTextSplitter = UniversalTextSplitter as jest.MockedClass<typeof UniversalTextSplitter>;

// Mock TreeSitterService
jest.mock('../../core/parse/TreeSitterService');
const MockTreeSitterService = TreeSitterService as jest.MockedClass<typeof TreeSitterService>;

describe('FileProcessingCoordinator', () => {
  let coordinator: FileProcessingCoordinator;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockTextSplitter: jest.Mocked<UniversalTextSplitter>;
  let mockTreeSitterService: jest.Mocked<TreeSitterService>;

  // Create mock chunks for testing
  const createMockChunks = (count: number): CodeChunk[] => {
    return Array.from({ length: count }, (_, i) => ({
      content: `Chunk ${i + 1}`,
      metadata: {
        startLine: i + 1,
        endLine: i + 1,
        language: 'javascript',
        type: 'code' as const,
        complexity: 1
      }
    }));
  };

  // Create mock strategy for testing
  const createMockStrategy = (type: ProcessingStrategyType, shouldFallback = false): IStrategySelectionResult => ({
    strategy: type,
    reason: `Test strategy: ${type}`,
    shouldFallback,
    parameters: { test: true }
  });

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    mockTextSplitter = new MockUniversalTextSplitter() as jest.Mocked<UniversalTextSplitter>;
    mockTextSplitter.chunkBySemanticBoundaries = jest.fn().mockResolvedValue(createMockChunks(3));
    mockTextSplitter.chunkByBracketsAndLines = jest.fn().mockResolvedValue(createMockChunks(2));
    mockTextSplitter.chunkByLines = jest.fn().mockResolvedValue(createMockChunks(5));
    mockTextSplitter.getOptions = jest.fn().mockReturnValue({
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLinesPerChunk: 50
    });
    mockTextSplitter.setOptions = jest.fn();

    mockTreeSitterService = new MockTreeSitterService() as jest.Mocked<TreeSitterService>;
    mockTreeSitterService.detectLanguage = jest.fn().mockResolvedValue({ name: 'javascript' });
    mockTreeSitterService.parseCode = jest.fn().mockResolvedValue({
      success: true,
      ast: { type: 'program', children: [] }
    });
    mockTreeSitterService.extractFunctions = jest.fn().mockResolvedValue([
      { type: 'function_definition', name: 'test' }
    ]);
    mockTreeSitterService.extractClasses = jest.fn().mockResolvedValue([]);
    mockTreeSitterService.getNodeLocation = jest.fn().mockReturnValue({ startLine: 1, endLine: 5 });
    mockTreeSitterService.getNodeText = jest.fn().mockReturnValue('function test() {}');

    coordinator = new FileProcessingCoordinator(mockLogger, mockTextSplitter, mockTreeSitterService);
  });

  describe('Constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(coordinator.name).toBe('FileProcessingCoordinator');
      expect(coordinator.description).toBe('Coordinates file processing workflows including strategy execution and fallback handling');
    });

    it('should throw error if UniversalTextSplitter is not provided', () => {
      expect(() => new FileProcessingCoordinator(mockLogger)).toThrow('UniversalTextSplitter is required and must be provided through DI container');
    });

    it('should work without TreeSitterService', () => {
      const coordinatorWithoutTreeSitter = new FileProcessingCoordinator(mockLogger, mockTextSplitter);
      expect(coordinatorWithoutTreeSitter).toBeDefined();
    });
  });

  describe('processFile', () => {
    it('should process file successfully with semantic strategy', async () => {
      const context: IFileProcessingContext = {
        filePath: 'test.js',
        content: 'function test() { return 1; }',
        strategy: createMockStrategy(ProcessingStrategyType.UNIVERSAL_SEMANTIC),
        language: 'javascript',
        timestamp: new Date()
      };

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(true);
      expect(result.chunks).toHaveLength(3);
      expect(result.processingStrategy).toBe(ProcessingStrategyType.UNIVERSAL_SEMANTIC);
      expect(result.metadata?.chunkCount).toBe(3);
      expect(mockTextSplitter.chunkBySemanticBoundaries).toHaveBeenCalledWith(
        context.content,
        context.filePath,
        context.language
      );
    });

    it('should process file successfully with bracket strategy', async () => {
      const context: IFileProcessingContext = {
        filePath: 'test.js',
        content: 'function test() { return 1; }',
        strategy: createMockStrategy(ProcessingStrategyType.UNIVERSAL_BRACKET),
        language: 'javascript',
        timestamp: new Date()
      };

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(true);
      expect(result.chunks).toHaveLength(2);
      expect(result.processingStrategy).toBe(ProcessingStrategyType.UNIVERSAL_BRACKET);
      expect(mockTextSplitter.chunkByBracketsAndLines).toHaveBeenCalledWith(
        context.content,
        context.filePath,
        context.language
      );
    });

    it('should process file successfully with line strategy', async () => {
      const context: IFileProcessingContext = {
        filePath: 'test.js',
        content: 'function test() { return 1; }',
        strategy: createMockStrategy(ProcessingStrategyType.UNIVERSAL_LINE),
        language: 'javascript',
        timestamp: new Date()
      };

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(true);
      expect(result.chunks).toHaveLength(5);
      expect(result.processingStrategy).toBe(ProcessingStrategyType.UNIVERSAL_LINE);
      expect(mockTextSplitter.chunkByLines).toHaveBeenCalledWith(
        context.content,
        context.filePath,
        context.language
      );
    });

    it('should use fallback when strategy indicates fallback is needed', async () => {
      const context: IFileProcessingContext = {
        filePath: 'test.js',
        content: 'function test() { return 1; }',
        strategy: createMockStrategy(ProcessingStrategyType.UNIVERSAL_SEMANTIC, true),
        language: 'javascript',
        timestamp: new Date()
      };

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(true);
      expect(result.chunks).toHaveLength(5); // Fallback uses line-based chunking
      expect(result.processingStrategy).toBe('fallback-line');
      expect(result.metadata?.fallbackReason).toBeTruthy();
      expect(result.metadata?.originalStrategy).toBe(ProcessingStrategyType.UNIVERSAL_SEMANTIC);
    });

    it('should handle processing errors with fallback', async () => {
      const context: IFileProcessingContext = {
        filePath: 'test.js',
        content: 'function test() { return 1; }',
        strategy: createMockStrategy(ProcessingStrategyType.UNIVERSAL_SEMANTIC),
        language: 'javascript',
        timestamp: new Date()
      };

      // Mock semantic chunking to fail
      mockTextSplitter.chunkBySemanticBoundaries.mockRejectedValue(new Error('Processing failed'));

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(true);
      expect(result.chunks).toHaveLength(5); // Fallback uses line-based chunking
      expect(result.processingStrategy).toBe('fallback-line');
      expect(result.metadata?.fallbackReason).toContain('Processing failed');
      expect(result.metadata?.originalError).toBe('Processing failed');
      expect(result.metadata?.recoverySuccessful).toBe(true);
    });

    it('should handle complete failure when fallback also fails', async () => {
      const context: IFileProcessingContext = {
        filePath: 'test.js',
        content: 'function test() { return 1; }',
        strategy: createMockStrategy(ProcessingStrategyType.UNIVERSAL_SEMANTIC),
        language: 'javascript',
        timestamp: new Date()
      };

      // Mock both semantic and line chunking to fail
      mockTextSplitter.chunkBySemanticBoundaries.mockRejectedValue(new Error('Semantic failed'));
      mockTextSplitter.chunkByLines.mockRejectedValue(new Error('Line failed'));

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(false);
      expect(result.chunks).toEqual([]);
      expect(result.processingStrategy).toBe(ProcessingStrategyType.UNIVERSAL_SEMANTIC);
      expect(result.error?.message).toBe('Semantic failed');
      expect(result.metadata?.fallbackAttempted).toBe(true);
      expect(result.metadata?.fallbackError).toBe('Line failed');
    });
  });

  describe('executeProcessingStrategy', () => {
    it('should execute TreeSitter AST strategy', async () => {
      const strategy = createMockStrategy(ProcessingStrategyType.TREESITTER_AST);
      const filePath = 'test.js';
      const content = 'function test() { return 1; }';
      const language = 'javascript';

      const chunks = await coordinator.executeProcessingStrategy(strategy, filePath, content, language);

      expect(chunks).toHaveLength(1); // One function extracted
      expect(chunks[0].metadata.type).toBe('function');
      expect(mockTreeSitterService.detectLanguage).toHaveBeenCalledWith(filePath);
      expect(mockTreeSitterService.parseCode).toHaveBeenCalledWith(content, 'javascript');
      expect(mockTreeSitterService.extractFunctions).toHaveBeenCalled();
    });

    it('should execute fine semantic strategy', async () => {
      const strategy = createMockStrategy(ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE);
      const filePath = 'test.js';
      const content = 'function test() { return 1; }';
      const language = 'javascript';

      const chunks = await coordinator.executeProcessingStrategy(strategy, filePath, content, language);

      expect(chunks).toHaveLength(3);
      expect(mockTextSplitter.setOptions).toHaveBeenCalledWith({
        maxChunkSize: 800,
        maxLinesPerChunk: 20,
        overlapSize: expect.any(Number),
        enableSemanticDetection: true
      });
      expect(mockTextSplitter.chunkBySemanticBoundaries).toHaveBeenCalledWith(content, filePath, language);
    });

    it('should fallback to fine semantic when TreeSitter is not available', async () => {
      const coordinatorWithoutTreeSitter = new FileProcessingCoordinator(mockLogger, mockTextSplitter);
      const strategy = createMockStrategy(ProcessingStrategyType.TREESITTER_AST);
      const filePath = 'test.js';
      const content = 'function test() { return 1; }';
      const language = 'javascript';

      const chunks = await coordinatorWithoutTreeSitter.executeProcessingStrategy(strategy, filePath, content, language);

      expect(chunks).toHaveLength(3);
      expect(mockTextSplitter.chunkBySemanticBoundaries).toHaveBeenCalledWith(content, filePath, language);
    });

    it('should fallback to fine semantic when TreeSitter language detection fails', async () => {
      mockTreeSitterService.detectLanguage.mockResolvedValue(null);
      const strategy = createMockStrategy(ProcessingStrategyType.TREESITTER_AST);
      const filePath = 'test.js';
      const content = 'function test() { return 1; }';
      const language = 'javascript';

      const chunks = await coordinator.executeProcessingStrategy(strategy, filePath, content, language);

      expect(chunks).toHaveLength(3);
      expect(mockTextSplitter.chunkBySemanticBoundaries).toHaveBeenCalledWith(content, filePath, language);
    });

    it('should fallback to fine semantic when TreeSitter parsing fails', async () => {
      mockTreeSitterService.parseCode.mockResolvedValue({
        success: false,
        ast: null
      });
      const strategy = createMockStrategy(ProcessingStrategyType.TREESITTER_AST);
      const filePath = 'test.js';
      const content = 'function test() { return 1; }';
      const language = 'javascript';

      const chunks = await coordinator.executeProcessingStrategy(strategy, filePath, content, language);

      expect(chunks).toHaveLength(3);
      expect(mockTextSplitter.chunkBySemanticBoundaries).toHaveBeenCalledWith(content, filePath, language);
    });

    it('should fallback to fine semantic when no functions or classes found', async () => {
      mockTreeSitterService.extractFunctions.mockResolvedValue([]);
      mockTreeSitterService.extractClasses.mockResolvedValue([]);
      const strategy = createMockStrategy(ProcessingStrategyType.TREESITTER_AST);
      const filePath = 'test.js';
      const content = 'function test() { return 1; }';
      const language = 'javascript';

      const chunks = await coordinator.executeProcessingStrategy(strategy, filePath, content, language);

      expect(chunks).toHaveLength(3);
      expect(mockTextSplitter.chunkBySemanticBoundaries).toHaveBeenCalledWith(content, filePath, language);
    });

    it('should fallback to line-based for unknown strategy', async () => {
      const strategy = {
        strategy: 'unknown' as ProcessingStrategyType,
        reason: 'Unknown strategy',
        shouldFallback: false,
        parameters: {}
      };
      const filePath = 'test.js';
      const content = 'function test() { return 1; }';
      const language = 'javascript';

      const chunks = await coordinator.executeProcessingStrategy(strategy, filePath, content, language);

      expect(chunks).toHaveLength(5);
      expect(mockTextSplitter.chunkByLines).toHaveBeenCalledWith(content, filePath, language);
      expect(mockLogger.warn).toHaveBeenCalledWith('Unknown processing strategy: unknown, falling back to line-based');
    });
  });

  describe('processWithFallback', () => {
    it('should process with fallback successfully', async () => {
      const filePath = 'test.js';
      const content = 'function test() { return 1; }';
      const reason = 'Test fallback';

      const result = await coordinator.processWithFallback(filePath, content, reason);

      expect(result.chunks).toHaveLength(5);
      expect(result.reason).toBe(reason);
      expect(result.fallbackStrategy).toBe('fallback-line');
      expect(mockTextSplitter.chunkByLines).toHaveBeenCalledWith(content, filePath, 'text');
    });

    it('should handle fallback failure with emergency single chunk', async () => {
      const filePath = 'test.js';
      const content = 'function test() { return 1; }';
      const reason = 'Test fallback';
      const originalError = new Error('Original error');

      // Mock line chunking to fail
      mockTextSplitter.chunkByLines.mockRejectedValue(new Error('Fallback failed'));

      const result = await coordinator.processWithFallback(filePath, content, reason, originalError);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe(content);
      expect(result.chunks[0].metadata.fallback).toBe(true);
      expect(result.chunks[0].metadata.reason).toBe(reason);
      expect(result.chunks[0].metadata.error).toBe('Fallback failed');
      expect(result.reason).toContain('fallback also failed');
      expect(result.fallbackStrategy).toBe('emergency-single-chunk');
      expect(result.originalError).toBe(originalError);
    });
  });

  describe('chunkByTreeSitter', () => {
    it('should chunk using TreeSitter successfully', async () => {
      const content = 'function test() { return 1; }';
      const filePath = 'test.js';
      const language = 'javascript';

      const chunks = await coordinator.chunkByTreeSitter(content, filePath, language);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].metadata.type).toBe('function');
      expect(chunks[0].metadata.language).toBe('javascript');
      expect(mockTreeSitterService.detectLanguage).toHaveBeenCalledWith(filePath);
      expect(mockTreeSitterService.parseCode).toHaveBeenCalledWith(content, 'javascript');
    });

    it('should handle multiple functions and classes', async () => {
      mockTreeSitterService.extractFunctions.mockResolvedValue([
        { type: 'function_definition', name: 'func1' },
        { type: 'function_definition', name: 'func2' }
      ]);
      mockTreeSitterService.extractClasses.mockResolvedValue([
        { type: 'class_definition', name: 'Class1' }
      ]);
      mockTreeSitterService.getNodeLocation
        .mockReturnValueOnce({ startLine: 1, endLine: 5 })
        .mockReturnValueOnce({ startLine: 6, endLine: 10 })
        .mockReturnValueOnce({ startLine: 11, endLine: 15 });
      mockTreeSitterService.getNodeText
        .mockReturnValueOnce('function func1() {}')
        .mockReturnValueOnce('function func2() {}')
        .mockReturnValueOnce('class Class1 {}');

      const content = 'function func1() {} function func2() {} class Class1 {}';
      const filePath = 'test.js';
      const language = 'javascript';

      const chunks = await coordinator.chunkByTreeSitter(content, filePath, language);

      expect(chunks).toHaveLength(3);
      expect(chunks[0].metadata.type).toBe('function');
      expect(chunks[1].metadata.type).toBe('function');
      expect(chunks[2].metadata.type).toBe('class');
    });
  });

  describe('chunkByFineSemantic', () => {
    it('should chunk using fine semantic with adjusted parameters', async () => {
      const content = 'function test() { return 1; }';
      const filePath = 'test.js';
      const language = 'javascript';

      const chunks = await coordinator.chunkByFineSemantic(content, filePath, language);

      expect(chunks).toHaveLength(3);
      expect(mockTextSplitter.setOptions).toHaveBeenCalledWith({
        maxChunkSize: 800,
        maxLinesPerChunk: 20,
        overlapSize: expect.any(Number),
        enableSemanticDetection: true
      });
      expect(mockTextSplitter.chunkBySemanticBoundaries).toHaveBeenCalledWith(content, filePath, language);
    });

    it('should restore original options after fine semantic processing', async () => {
      const content = 'function test() { return 1; }';
      const filePath = 'test.js';
      const language = 'javascript';

      await coordinator.chunkByFineSemantic(content, filePath, language);

      // Check that setOptions was called twice: once for fine semantic, once for restoration
      expect(mockTextSplitter.setOptions).toHaveBeenCalledTimes(2);
      
      // First call should be for fine semantic
      expect(mockTextSplitter.setOptions).toHaveBeenNthCalledWith(1, {
        maxChunkSize: 800,
        maxLinesPerChunk: 20,
        overlapSize: expect.any(Number),
        enableSemanticDetection: true
      });
      
      // Second call should be for restoration
      expect(mockTextSplitter.setOptions).toHaveBeenNthCalledWith(2, {
        maxChunkSize: 2000,
        overlapSize: 200,
        maxLinesPerChunk: 50,
        enableSemanticDetection: true
      });
    });

    it('should handle fine semantic errors gracefully', async () => {
      mockTextSplitter.chunkBySemanticBoundaries.mockRejectedValue(new Error('Fine semantic failed'));
      const content = 'function test() { return 1; }';
      const filePath = 'test.js';
      const language = 'javascript';

      await expect(coordinator.chunkByFineSemantic(content, filePath, language)).rejects.toThrow('Fine semantic failed');
      
      // Should still restore original options even after error
      expect(mockTextSplitter.setOptions).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow with TreeSitter', async () => {
      const context: IFileProcessingContext = {
        filePath: 'test.js',
        content: 'function test() { return 1; }',
        strategy: createMockStrategy(ProcessingStrategyType.TREESITTER_AST),
        language: 'javascript',
        timestamp: new Date()
      };

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(true);
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].metadata.type).toBe('function');
      expect(result.processingStrategy).toBe(ProcessingStrategyType.TREESITTER_AST);
    });

    it('should handle complete workflow with fallback chain', async () => {
      const context: IFileProcessingContext = {
        filePath: 'test.js',
        content: 'function test() { return 1; }',
        strategy: createMockStrategy(ProcessingStrategyType.TREESITTER_AST),
        language: 'javascript',
        timestamp: new Date()
      };

      // Mock TreeSitter to fail
      mockTreeSitterService.parseCode.mockRejectedValue(new Error('TreeSitter failed'));
      // Mock fine semantic to fail
      mockTextSplitter.chunkBySemanticBoundaries.mockRejectedValue(new Error('Semantic failed'));

      const result = await coordinator.processFile(context);

      expect(result.success).toBe(true);
      expect(result.chunks).toHaveLength(5); // Fallback to line-based
      expect(result.processingStrategy).toBe('fallback-line');
      expect(result.metadata?.fallbackReason).toContain('TreeSitter failed');
      expect(result.metadata?.originalError).toBe('TreeSitter failed');
    });
  });
});