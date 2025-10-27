import { StandardizationSegmentationStrategy } from '../StandardizationSegmentationStrategy';
import { LoggerService } from '../../../../../../utils/LoggerService';
import { DetectionResult } from '../../../detection/UnifiedDetectionCenter';
import { CodeChunk } from '../../../types';
import { IQueryResultNormalizer, StandardizedQueryResult } from '../../../../core/normalization/types';
import { TreeSitterCoreService } from '../../../../core/parse/TreeSitterCoreService';

// Mock LoggerService
jest.mock('../../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock TreeSitterCoreService
const mockTreeSitterService = {
  parseCode: jest.fn()
} as unknown as jest.Mocked<TreeSitterCoreService>;

// Mock QueryResultNormalizer
const mockQueryNormalizer = {
  normalize: jest.fn()
} as unknown as jest.Mocked<IQueryResultNormalizer>;

describe('StandardizationSegmentationStrategy', () => {
  let strategy: StandardizationSegmentationStrategy;
  let mockLogger: jest.Mocked<LoggerService>;

  const createMockDetectionResult = (language: string = 'javascript'): DetectionResult => ({
    language,
    confidence: 0.9,
    fileType: 'normal'
  });

  // Create mock standardized results
  const createMockStandardizedResults = (language: string): StandardizedQueryResult[] => [
    {
      type: 'function',
      name: 'testFunction',
      startLine: 1,
      endLine: 5,
      content: 'function testFunction() { return "test"; }',
      metadata: {
        language,
        complexity: 1,
        dependencies: [],
        modifiers: []
      }
    },
    {
      type: 'class',
      name: 'TestClass',
      startLine: 7,
      endLine: 15,
      content: 'class TestClass { constructor() {} }',
      metadata: {
        language,
        complexity: 2,
        dependencies: [],
        modifiers: ['export']
      }
    }
  ];

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    strategy = new StandardizationSegmentationStrategy(
      mockLogger,
      mockQueryNormalizer,
      mockTreeSitterService
    );

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getName', () => {
    it('should return the strategy name', () => {
      expect(strategy.getName()).toBe('StandardizationSegmentationStrategy');
    });
  });

  describe('getDescription', () => {
    it('should return the strategy description', () => {
      expect(strategy.getDescription()).toBe('Uses standardized query results for code structure-aware segmentation');
    });
  });

  describe('execute', () => {
    const filePath = 'test.js';

    it('should segment JavaScript code using standardization', async () => {
      const content = `
        function testFunction() {
          return "test";
        }

        class TestClass {
          constructor() {
            this.value = 42;
          }
        }
      `;
      const detection = createMockDetectionResult('javascript');

      // Mock TreeSitter parsing
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock query normalization
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue(
        createMockStandardizedResults('javascript')
      );

      const result = await strategy.execute(filePath, content, detection);

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks[0].metadata.type).toBe('standardization');
      expect(result.chunks[0].metadata.language).toBe('javascript');
      expect(result.chunks[0].metadata.filePath).toBe('test.js');
      expect(result.metadata.strategy).toBe('StandardizationSegmentationStrategy');
      expect(mockTreeSitterService.parseCode).toHaveBeenCalledWith(content, 'javascript');
      expect(mockQueryNormalizer.normalize).toHaveBeenCalled();
    });

    it('should segment Python code using standardization', async () => {
      const content = `
        def test_function():
            return "test"

        class TestClass:
            def __init__(self):
                self.value = 42
      `;
      const detection = createMockDetectionResult('python');

      // Mock TreeSitter parsing
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'module', children: [] }
      });

      // Mock query normalization
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue(
        createMockStandardizedResults('python')
      );

      const result = await strategy.execute('test.py', content, detection);

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks.every(chunk => chunk.metadata.type === 'standardization')).toBe(true);
      expect(result.chunks.every(chunk => chunk.metadata.language === 'python')).toBe(true);
      expect(mockTreeSitterService.parseCode).toHaveBeenCalledWith(content, 'python');
      expect(mockQueryNormalizer.normalize).toHaveBeenCalled();
    });

    it('should segment TypeScript code using standardization', async () => {
      const content = `
        function testFunction(): string {
          return "test";
        }

        class TestClass {
          constructor() {
            this.value = 42;
          }
        }
      `;
      const detection = createMockDetectionResult('typescript');

      // Mock TreeSitter parsing
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock query normalization
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue(
        createMockStandardizedResults('typescript')
      );

      const result = await strategy.execute('test.ts', content, detection);

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks.every(chunk => chunk.metadata.language === 'typescript')).toBe(true);
      expect(mockTreeSitterService.parseCode).toHaveBeenCalledWith(content, 'typescript');
    });

    it('should handle parsing errors gracefully', async () => {
      const content = 'function test() { return 1; }';
      const detection = createMockDetectionResult('javascript');

      // Mock TreeSitter parsing failure
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: false,
        error: new Error('Parsing failed')
      });

      const result = await strategy.execute(filePath, content, detection);

      // Should return fallback chunk when parsing fails
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].metadata.fallback).toBe(true);
      expect(result.chunks[0].metadata.type).toBe('code');
      expect('fallback' in result.metadata && result.metadata.fallback).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith('Error in standardization-based chunking:', expect.any(Error));
    });

    it('should handle normalization errors gracefully', async () => {
      const content = 'function test() { return 1; }';
      const detection = createMockDetectionResult('javascript');

      // Mock TreeSitter parsing success
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock query normalization failure
      (mockQueryNormalizer.normalize as jest.Mock).mockRejectedValue(
        new Error('Normalization failed')
      );

      const result = await strategy.execute(filePath, content, detection);

      // Should return fallback chunk when normalization fails
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].metadata.fallback).toBe(true);
      expect('fallback' in result.metadata && result.metadata.fallback).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith('Error in standardization-based chunking:', expect.any(Error));
    });

    it('should handle empty standardized results', async () => {
      const content = 'function test() { return 1; }';
      const detection = createMockDetectionResult('javascript');

      // Mock TreeSitter parsing success
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock empty query normalization results
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue([]);

      const result = await strategy.execute(filePath, content, detection);

      // Should return fallback chunk when no standardized results
      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].metadata.fallback).toBe(true);
      expect('fallback' in result.metadata && result.metadata.fallback).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('No standardized results found, falling back to simple segmentation');
    });

    it('should handle empty content', async () => {
      const content = '';
      const detection = createMockDetectionResult('javascript');

      const result = await strategy.execute(filePath, content, detection);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe('');
      expect(result.chunks[0].metadata.startLine).toBe(1);
      expect(result.chunks[0].metadata.endLine).toBe(0);
      expect(result.chunks[0].metadata.type).toBe('code');
      expect(result.chunks[0].metadata.fallback).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Empty content provided for test.js');
    });

    it('should fallback when services are not available', async () => {
      const content = 'function test() { return 1; }';
      const detection = createMockDetectionResult('javascript');

      // Create strategy with null services
      const strategyWithoutServices = new StandardizationSegmentationStrategy(
        mockLogger,
        null as any, // queryNormalizer is null
        mockTreeSitterService
      );

      const result = await strategyWithoutServices.execute(filePath, content, detection);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].metadata.fallback).toBe(true);
      expect('fallback' in result.metadata && result.metadata.fallback).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('Required services not available for standardization, falling back to simple segmentation');
    });

    it('should fallback when language is not detected', async () => {
      const content = 'function test() { return 1; }';
      const detection = createMockDetectionResult();
      // No language detected - using default undefined

      const result = await strategy.execute(filePath, content, detection);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].metadata.fallback).toBe(true);
      expect(result.chunks[0].metadata.language).toBe('unknown');
      expect('fallback' in result.metadata && result.metadata.fallback).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith('Required services not available for standardization, falling back to simple segmentation');
    });

    it('should handle complex JavaScript code with multiple functions and classes', async () => {
      const content = `
        import React from 'react';

        function Component() {
          const [count, setCount] = React.useState(0);

          const handleClick = () => {
            setCount(prevCount => prevCount + 1);
          };

          return (
            <div>
              <h1>Count: {count}</h1>
              <button onClick={handleClick}>
                Click me
              </button>
            </div>
          );
        }

        class DataService {
          constructor() {
            this.data = [];
          }

          async fetchData() {
            return fetch('/api/data').then(res => res.json());
          }
        }

        export default Component;
      `;
      const detection = createMockDetectionResult('javascript');

      // Mock TreeSitter parsing
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock complex query normalization results
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue([
        {
          type: 'import',
          name: 'React',
          startLine: 1,
          endLine: 1,
          content: 'import React from \'react\';',
          metadata: {
            language: 'javascript',
            complexity: 1,
            dependencies: ['react'],
            modifiers: []
          }
        },
        {
          type: 'function',
          name: 'Component',
          startLine: 3,
          endLine: 17,
          content: 'function Component() { /* ... */ }',
          metadata: {
            language: 'javascript',
            complexity: 3,
            dependencies: ['React'],
            modifiers: ['export']
          }
        },
        {
          type: 'class',
          name: 'DataService',
          startLine: 19,
          endLine: 27,
          content: 'class DataService { /* ... */ }',
          metadata: {
            language: 'javascript',
            complexity: 2,
            dependencies: [],
            modifiers: []
          }
        }
      ]);

      const result = await strategy.execute('Component.jsx', content, detection);

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.chunks.every(chunk => chunk.metadata.type === 'standardization')).toBe(true);
      expect(result.chunks.every(chunk => chunk.metadata.language === 'javascript')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('Using Standardization segmentation strategy for Component.jsx');
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Standardization segmentation created'));
    });

    it('should log segmentation progress correctly', async () => {
      const content = 'function test() { return 1; }';
      const detection = createMockDetectionResult('javascript');

      // Mock TreeSitter parsing success
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock query normalization
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue(
        createMockStandardizedResults('javascript')
      );

      await strategy.execute(filePath, content, detection);

      expect(mockLogger.debug).toHaveBeenCalledWith('Using Standardization segmentation strategy for test.js');
      expect(mockLogger.debug).toHaveBeenCalledWith('No standardized results found, falling back to simple segmentation');
    });

    it('should handle different file extensions', async () => {
      const testCases = [
        { filePath: 'script.js', language: 'javascript' },
        { filePath: 'module.ts', language: 'typescript' },
        { filePath: 'app.py', language: 'python' },
        { filePath: 'Main.java', language: 'java' },
        { filePath: 'program.go', language: 'go' }
      ];

      for (const testCase of testCases) {
        const content = 'function test() { return 1; }';
        const detection = createMockDetectionResult(testCase.language);

        // Mock services
        (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
          success: true,
          ast: { type: 'program', children: [] }
        });
        (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue(
          createMockStandardizedResults(testCase.language)
        );

        const result = await strategy.execute(testCase.filePath, content, detection);

        expect(result.chunks[0].metadata.filePath).toBe(testCase.filePath);
        expect(result.chunks[0].metadata.language).toBe(testCase.language);
      }
    });

    it('should handle single line content', async () => {
      const content = 'console.log("test");';
      const detection = createMockDetectionResult('javascript');

      const result = await strategy.execute(filePath, content, detection);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe(content);
      expect(result.chunks[0].metadata.startLine).toBe(1);
      expect(result.chunks[0].metadata.endLine).toBe(1);
      expect(result.chunks[0].metadata.fallback).toBe(true);
    });

    it('should handle content with special characters', async () => {
      const content = 'const regex = /test\\d+/; const str = "hello \\"world\\"!";';
      const detection = createMockDetectionResult('javascript');

      const result = await strategy.execute(filePath, content, detection);

      expect(result.chunks).toHaveLength(1);
      expect(result.chunks[0].content).toBe(content);
      expect(result.chunks[0].metadata.fallback).toBe(true);
    });
  });
});
