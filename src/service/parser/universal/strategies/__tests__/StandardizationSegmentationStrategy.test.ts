import { StandardizationSegmentationStrategy } from '../StandardizationSegmentationStrategy';
import { LoggerService } from '../../../../../utils/LoggerService';
import { ISegmentationStrategy, SegmentationContext } from '../../types/SegmentationTypes';
import { CodeChunk } from '../../../splitting';
import { IQueryResultNormalizer, StandardizedQueryResult } from '../../../core/normalization/types';
import { TreeSitterCoreService } from '../../../core/parse/TreeSitterCoreService';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
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

  // Create mock chunks for testing
  const createMockChunk = (content: string, startLine: number, endLine: number, type: 'function' | 'class' | 'interface' | 'method' | 'code' | 'import' | 'generic' | 'semantic' | 'bracket' | 'line' | 'overlap' | 'merged' | 'sub_function' | 'heading' | 'paragraph' | 'table' | 'list' | 'blockquote' | 'code_block' | 'markdown' | 'standardization' | 'section' | 'content' = 'standardization'): CodeChunk => ({
    content,
    metadata: {
      startLine,
      endLine,
      language: 'javascript',
      filePath: 'test.js',
      type,
      complexity: 1
    }
  });

  // Create mock context
  const createMockContext = (language = 'javascript', enableStandardization = true): SegmentationContext => ({
    content: 'test content',
    options: {
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLinesPerChunk: 50,
      enableBracketBalance: true,
      enableSemanticDetection: true,
      enableCodeOverlap: false,
      enableStandardization,
      standardizationFallback: true,
      maxOverlapRatio: 0.3,
      errorThreshold: 5,
      memoryLimitMB: 500,
      strategyPriorities: {
        'markdown': 1,
        'standardization': 2,
        'semantic': 3,
        'bracket': 4,
        'line': 5
      },
      filterConfig: {
        enableSmallChunkFilter: true,
        enableChunkRebalancing: true,
        minChunkSize: 50,
        maxChunkSize: 1000
      },
      protectionConfig: {
        enableProtection: true,
        protectionLevel: 'medium'
      }
    },
    metadata: {
      contentLength: 12,
      lineCount: 1,
      isSmallFile: true,
      isCodeFile: true,
      isMarkdownFile: false
    }
  });
  // Helper function to create context with content and file info
  const createSegmentationContext = (
    content: string, 
    filePath: string, 
    language: string, 
    baseContext?: SegmentationContext
  ): SegmentationContext => {
    const context = baseContext || createMockContext(language);
    context.content = content;
    context.filePath = filePath;
    context.language = language;
    return context;
  };

  // Create mock standardized results
  const createMockStandardizedResults = (language: string): StandardizedQueryResult[] => [
    {
      type: 'function',
      name: 'testFunction',
      startLine: 1,
      endLine: 5,
      content: 'function testFunction() { return "test"; }',
      metadata: {
        language: 'javascript',
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
        language: 'javascript',
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

    // Create a mock complexity calculator
    const mockComplexityCalculator = {
      calculate: jest.fn().mockReturnValue(1)
    };

    strategy = new StandardizationSegmentationStrategy(
      mockComplexityCalculator,
      mockLogger,
      mockQueryNormalizer,
      mockTreeSitterService
    );

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getName', () => {
    it('should return the strategy name', () => {
      expect(strategy.getName()).toBe('standardization');
    });
  });

  describe('getPriority', () => {
    it('should return the strategy priority', () => {
      expect(strategy.getPriority()).toBe(2);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages', () => {
      const languages = strategy.getSupportedLanguages();
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain('javascript');
      expect(languages).toContain('typescript');
      expect(languages).toContain('python');
      expect(languages).toContain('java');
      expect(languages).toContain('cpp');
      expect(languages).toContain('go');
      expect(languages).toContain('rust');
    });
  });

  describe('canHandle', () => {
    it('should return true for code files with standardization enabled', () => {
      const context = createMockContext('javascript', true);
      expect(strategy.canHandle(context)).toBe(true);
    });

    it('should return false when standardization is disabled', () => {
      const context = createMockContext('javascript', false);
      expect(strategy.canHandle(context)).toBe(false);
    });

    it('should return false for markdown files', () => {
      const context = createMockContext('markdown', true);
      expect(strategy.canHandle(context)).toBe(false);
    });

    it('should return true for supported programming languages', () => {
      const jsContext = createMockContext('javascript', true);
      const pyContext = createMockContext('python', true);
      const javaContext = createMockContext('java', true);

      expect(strategy.canHandle(jsContext)).toBe(true);
      expect(strategy.canHandle(pyContext)).toBe(true);
      expect(strategy.canHandle(javaContext)).toBe(true);
    });
  });

  describe('segment', () => {
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

      // Mock TreeSitter parsing
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock query normalization
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue(
        createMockStandardizedResults('javascript')
      );

      const context = createMockContext('javascript', true);
      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.type).toBe('standardization');
      expect(chunks[0].metadata.language).toBe('javascript');
      expect(chunks[0].metadata.filePath).toBe('test.js');
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

      // Mock TreeSitter parsing
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'module', children: [] }
      });

      // Mock query normalization
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue(
        createMockStandardizedResults('python')
      );

      const context = createMockContext('python', true);
      const chunks = await strategy.segment(createSegmentationContext(content, 'test.py', 'python', context));

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'standardization')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'python'));
      expect(mockTreeSitterService.parseCode).toHaveBeenCalledWith(content, 'python');
      expect(mockQueryNormalizer.normalize).toHaveBeenCalled();
    });

    it('should handle parsing errors gracefully', async () => {
      const content = 'function test() { return 1; }';

      // Mock TreeSitter parsing failure
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: false,
        error: new Error('Parsing failed')
      });

      const context = createMockContext('javascript', true);
      context.options.standardizationFallback = true;

      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      // Should return empty chunks when parsing fails and fallback is enabled
      expect(chunks).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('TreeSitter parsing failed, falling back to other strategies');
    });

    it('should throw error when parsing fails and fallback is disabled', async () => {
      const content = 'function test() { return 1; }';

      // Mock TreeSitter parsing failure
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: false,
        error: new Error('Parsing failed')
      });

      const context = createMockContext('javascript', true);
      context.options.standardizationFallback = false;

      await expect(strategy.segment(createSegmentationContext(content, 'test.js', 'javascript', context))).rejects.toThrow('Parsing failed');
    });

    it('should handle normalization errors gracefully', async () => {
      const content = 'function test() { return 1; }';

      // Mock TreeSitter parsing success
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock query normalization failure
      (mockQueryNormalizer.normalize as jest.Mock).mockRejectedValue(
        new Error('Normalization failed')
      );

      const context = createMockContext('javascript', true);
      context.options.standardizationFallback = true;

      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      // Should return empty chunks when normalization fails and fallback is enabled
      expect(chunks).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('Query normalization failed, falling back to other strategies');
    });

    it('should throw error when normalization fails and fallback is disabled', async () => {
      const content = 'function test() { return 1; }';

      // Mock TreeSitter parsing success
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock query normalization failure
      (mockQueryNormalizer.normalize as jest.Mock).mockRejectedValue(
        new Error('Normalization failed')
      );

      const context = createMockContext('javascript', true);
      context.options.standardizationFallback = false;

      await expect(strategy.segment(createSegmentationContext(content, 'test.js', 'javascript', context))).rejects.toThrow('Normalization failed');
    });

    it('should handle empty standardized results', async () => {
      const content = 'function test() { return 1; }';

      // Mock TreeSitter parsing success
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock empty query normalization results
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue([]);

      const context = createMockContext('javascript', true);

      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      // Should return empty chunks when no standardized results are found
      expect(chunks).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('No standardized results found for test.js');
    });

    it('should handle empty content', async () => {
      const content = '';
      const context = createMockContext('javascript', true);

      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      expect(chunks).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Empty content provided for test.js');
    });

    it('should log segmentation progress', async () => {
      const content = 'function test() { return 1; }';

      // Mock TreeSitter parsing success
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock query normalization
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue(
        createMockStandardizedResults('javascript')
      );

      const context = createMockContext('javascript', true);

      await strategy.segment(createSegmentationContext(content, 'test.js', 'javascript', context));

      expect(mockLogger.debug).toHaveBeenCalledWith('Starting standardization-based segmentation for test.js');
    });

    it('should validate context when available', async () => {
      const content = 'function test() { return 1; }';

      // Mock TreeSitter parsing success
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock query normalization
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue(
        createMockStandardizedResults('javascript')
      );

      const context = createMockContext('javascript', true);

      // Mock validateContext method
      (strategy as any).validateContext = jest.fn().mockReturnValue(true);

      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Context validation passed for standardization strategy');
    });

    it('should skip validation when not available', async () => {
      const content = 'function test() { return 1; }';

      // Mock TreeSitter parsing success
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock query normalization
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue(
        createMockStandardizedResults('javascript')
      );

      const context = createMockContext('javascript', true);

      // Mock validateContext method to return false
      (strategy as any).validateContext = jest.fn().mockReturnValue(false);

      context.content = content;
      context.filePath = 'test.js';
      context.language = 'javascript';
      const chunks = await strategy.segment(context);

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('Context validation failed for standardization strategy, proceeding anyway');
    });
  });

  describe('Integration Tests', () => {
    it('should work with complex JavaScript code', async () => {
      const jsCode = `
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
        
        export default Component;
      `;

      // Mock TreeSitter parsing success
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock query normalization with complex results
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue([
        {
          type: 'import',
          name: 'React',
          startLine: 1,
          endLine: 1,
          content: 'import React from \'react\';',
          metadata: {
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
          content: `function Component() {
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
        }`,
          metadata: {
            complexity: 3,
            dependencies: ['React'],
            modifiers: ['export']
          }
        }
      ]);

      const context = createMockContext('javascript', true);
      const chunks = await strategy.segment(createSegmentationContext(jsCode, 'Component.jsx', 'javascript', context));

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'standardization')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'javascript'));
      expect(mockTreeSitterService.parseCode).toHaveBeenCalledWith(jsCode, 'javascript');
      expect(mockQueryNormalizer.normalize).toHaveBeenCalled();
    });

    it('should work with complex Python code', async () => {
      const pythonCode = `
        import os
        import sys
        from typing import List, Dict
        
        class DataProcessor:
            def __init__(self, config: Dict[str, Any]):
                self.config = config
                self.data = []
                
            def process_data(self, input_data: List[str]) -> List[Dict[str, Any]]:
                processed = []
                for item in input_data:
                    if self._validate_item(item):
                        processed_item = self._transform_item(item)
                        processed.append(processed_item)
                    else:
                        self._log_error(f"Invalid item: {item}")
                
                return processed
                
            def _validate_item(self, item: str) -> bool:
                return len(item) > 0 and item.strip() != ""
                
            def _transform_item(self, item: str) -> Dict[str, Any]:
                return {
                    'original': item,
                    'processed': item.upper(),
                    'length': len(item)
                }
                
            def _log_error(self, message: str) -> None:
                print(f"ERROR: {message}")
      `;

      // Mock TreeSitter parsing success
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'module', children: [] }
      });

      // Mock query normalization with complex results
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue([
        {
          type: 'import',
          name: 'os',
          startLine: 1,
          endLine: 1,
          content: 'import os',
          metadata: {
            complexity: 1,
            dependencies: ['os'],
            modifiers: []
          }
        },
        {
          type: 'import',
          name: 'sys',
          startLine: 2,
          endLine: 2,
          content: 'import sys',
          metadata: {
            complexity: 1,
            dependencies: ['sys'],
            modifiers: []
          }
        },
        {
          type: 'import',
          name: 'List, Dict',
          startLine: 3,
          endLine: 3,
          content: 'from typing import List, Dict',
          metadata: {
            complexity: 1,
            dependencies: ['typing'],
            modifiers: []
          }
        },
        {
          type: 'class',
          name: 'DataProcessor',
          startLine: 5,
          endLine: 35,
          content: `class DataProcessor:
            def __init__(self, config: Dict[str, Any]):
                self.config = config
                self.data = []
                
            def process_data(self, input_data: List[str]) -> List[Dict[str, Any]]:
                processed = []
                for item in input_data:
                    if self._validate_item(item):
                        processed_item = self._transform_item(item)
                        processed.append(processed_item)
                    else:
                        self._log_error(f"Invalid item: {item}")
                
                return processed
                
            def _validate_item(self, item: str) -> bool:
                return len(item) > 0 and item.strip() != ""
                
            def _transform_item(self, item: str) -> Dict[str, Any]:
                return {
                    'original': item,
                    'processed': item.upper(),
                    'length': len(item)
                }
                
            def _log_error(self, message: str) -> None:
                print(f"ERROR: {message}")`,
          metadata: {
            complexity: 5,
            dependencies: ['typing'],
            modifiers: []
          }
        }
      ]);

      const context = createMockContext('python', true);
      const chunks = await strategy.segment(createSegmentationContext(pythonCode, 'data_processor.py', 'python', context));

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'standardization')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'python'));
      expect(mockTreeSitterService.parseCode).toHaveBeenCalledWith(pythonCode, 'python');
      expect(mockQueryNormalizer.normalize).toHaveBeenCalled();
    });

    it('should handle edge cases', async () => {
      // Empty content
      const emptyResult = await strategy.segment(createSegmentationContext('', 'test.js', 'javascript', createMockContext('javascript', true)));
      expect(emptyResult).toHaveLength(0);

      // Single line content
      const singleLineContent = 'console.log("test");';
      
      // Mock TreeSitter parsing success
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue({
        success: true,
        ast: { type: 'program', children: [] }
      });

      // Mock query normalization
      (mockQueryNormalizer.normalize as jest.Mock).mockResolvedValue([
        {
          type: 'expression',
          name: 'console.log',
          startLine: 1,
          endLine: 1,
          content: 'console.log("test")',
          metadata: {
            complexity: 1,
            dependencies: [],
            modifiers: []
          }
        }
      ]);

      const singleLineResult = await strategy.segment(createSegmentationContext(singleLineContent, 'test.js', 'javascript', createMockContext('javascript', true)));
      expect(singleLineResult).toHaveLength(1);
      expect(singleLineResult[0].content).toBe('console.log("test")');
    });
  });
});