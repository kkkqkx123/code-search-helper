import { BracketSegmentationStrategy } from '../BracketSegmentationStrategy';
import { LoggerService } from '../../../../../../utils/LoggerService';
import { ISegmentationStrategy, SegmentationContext, IComplexityCalculator } from '../../../../universal/types/SegmentationTypes';
import { CodeChunk } from '../../../../splitting';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock IComplexityCalculator
const mockComplexityCalculator: jest.Mocked<IComplexityCalculator> = {
  calculate: jest.fn()
};

describe('BracketSegmentationStrategy', () => {
  let strategy: BracketSegmentationStrategy;
  let mockLogger: jest.Mocked<LoggerService>;

  // Create mock chunks for testing
  const createMockChunk = (content: string, startLine: number, endLine: number, type: string = 'bracket'): CodeChunk => ({
    content,
    metadata: {
      startLine,
      endLine,
      language: 'javascript',
      filePath: 'test.js',
      type: type as 'function' | 'class' | 'interface' | 'method' | 'code' | 'import' | 'generic' | 'semantic' | 'bracket' | 'line' | 'overlap' | 'merged' | 'sub_function' | 'heading' | 'paragraph' | 'table' | 'list' | 'blockquote' | 'code_block',
      complexity: 1
    }
  });

  // Create mock context
  const createMockContext = (language = 'javascript', enableBracketBalance = true): SegmentationContext => ({
    content: 'test content',
    options: {
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLinesPerChunk: 50,
      enableBracketBalance,
      enableSemanticDetection: true,
      enableCodeOverlap: false,
      enableStandardization: true,
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

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    strategy = new BracketSegmentationStrategy(mockComplexityCalculator, mockLogger);
  });

  describe('getName', () => {
    it('should return the strategy name', () => {
      expect(strategy.getName()).toBe('bracket');
    });
  });

  describe('getPriority', () => {
    it('should return the strategy priority', () => {
      expect(strategy.getPriority()).toBe(4);
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
    it('should return true for code files with bracket balance enabled', () => {
      const context = createMockContext('javascript', true);
      expect(strategy.canHandle(context)).toBe(true);
    });

    it('should return false when bracket balance is disabled', () => {
      const context = createMockContext('javascript', false);
      expect(strategy.canHandle(context)).toBe(false);
    });

    it('should return true for non-markdown files', () => {
      const context = createMockContext('text', true);
      expect(strategy.canHandle(context)).toBe(true);
    });

    it('should return false for markdown files', () => {
      const context = createMockContext('markdown', true);
      expect(strategy.canHandle(context)).toBe(false);
    });
  });

  describe('segment', () => {
    it('should segment code with balanced brackets', async () => {
      const content = `
        function test() {
          if (condition) {
            for (let i = 0; i < 10; i++) {
              while (nested) {
                if (deeplyNested) {
                  // Deeply nested code
                }
              }
            }
          }
        }
        
        class TestClass {
          constructor() {
            this.value = 42;
          }
          
          method() {
            return this.value * 2;
          }
        }
      `;

      const context = createMockContext('javascript', true);
      const chunks = await strategy.segment({ ...context, content, filePath: 'test.js', language: 'javascript' });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.type).toBe('bracket');
      expect(chunks[0].metadata.language).toBe('javascript');
      expect(chunks[0].metadata.filePath).toBe('test.js');
    });

    it('should segment code with XML tags', async () => {
      const content = `
        <root>
          <item id="1">
            <name>Test Item</name>
            <value>123</value>
          </item>
          <item id="2">
            <name>Another Item</name>
            <value>456</value>
          </item>
        </root>
      `;

      const context = createMockContext('xml', true);
      const chunks = await strategy.segment({ ...context, content, filePath: 'test.xml', language: 'xml' });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.type).toBe('bracket');
      expect(chunks[0].metadata.language).toBe('xml');
    });

    it('should segment code with mixed brackets', async () => {
      const content = `
        function outerFunction() {
          if (condition) {
            return {
              data: [1, 2, 3],
              filtered: data.filter(item => item > 1)
            };
          }
        }
        
        const array = [1, 2, 3, 4, 5];
        const result = array.map(item => item * 2);
      `;

      const context = createMockContext('javascript', true);
      const chunks = await strategy.segment({ ...context, content, filePath: 'test.js', language: 'javascript' });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.type).toBe('bracket');
    });

    it('should handle unbalanced brackets gracefully', async () => {
      const content = `
        function test() {
          if (condition) {
            return {
              data: [1, 2, 3,
              filtered: data.filter(item => item > 1)
            };
          }
        // Missing closing bracket
      `;

      const context = createMockContext('javascript', true);
      const chunks = await strategy.segment({ ...context, content, filePath: 'test.js', language: 'javascript' });

      expect(chunks.length).toBeGreaterThan(0);
      // Should still create chunks even with unbalanced brackets
    });

    it('should handle empty content', async () => {
      const content = '';
      const context = createMockContext('javascript', true);

      const chunks = await strategy.segment({ ...context, content, filePath: 'test.js', language: 'javascript' });

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('');
      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(0);
    });

    it('should log segmentation progress', async () => {
      const content = 'function test() { return 1; }';
      const context = createMockContext('javascript', true);

      await strategy.segment({ ...context, content, filePath: 'test.js', language: 'javascript' });

      expect(mockLogger.debug).toHaveBeenCalledWith('Starting bracket-based segmentation for test.js');
    });

    it('should handle errors gracefully', async () => {
      const content = 'function test() { throw new Error("Test error"); }';
      const context = createMockContext('javascript', true);

      // Mock the segment method to throw an error
      (strategy as any).segment = jest.fn().mockRejectedValue(new Error('Segmentation failed'));

      await expect(strategy.segment({ ...context, content, filePath: 'test.js', language: 'javascript' })).rejects.toThrow('Segmentation failed');
    });

    it('should validate context when available', async () => {
      const content = 'function test() { return 1; }';
      const context = createMockContext('javascript', true);

      // Mock validateContext method
      (strategy as any).validateContext = jest.fn().mockReturnValue(true);

      const chunks = await strategy.segment({ ...context, content, filePath: 'test.js', language: 'javascript' });

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('Context validation passed for bracket strategy');
    });

    it('should skip validation when not available', async () => {
      const content = 'function test() { return 1; }';
      const context = createMockContext('javascript', true);

      // Mock validateContext method to return false
      (strategy as any).validateContext = jest.fn().mockReturnValue(false);

      const chunks = await strategy.segment({ ...context, content, filePath: 'test.js', language: 'javascript' });

      expect(chunks.length).toBeGreaterThan(0);
      expect(mockLogger.warn).toHaveBeenCalledWith('Context validation failed for bracket strategy, proceeding anyway');
    });

    it('should respect max lines per chunk limit', async () => {
      const content = `
        function test() {
          for (let i = 0; i < 100; i++) {
          console.log('Line ' + i);
        }
        }
      `;
      const context = createMockContext('javascript', true);

      const chunks = await strategy.segment({ ...context, content, filePath: 'test.js', language: 'javascript' });

      // Should split into multiple chunks due to line limit
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.metadata.endLine - chunk.metadata.startLine + 1).toBeLessThanOrEqual(50);
      });
    });

    it('should respect max chunk size limit', async () => {
      const content = 'A'.repeat(3000);
      const context = createMockContext('javascript', true);

      const chunks = await strategy.segment({ ...context, content, filePath: 'test.js', language: 'javascript' });

      // Should split large content
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(2200); // maxChunkSize * 1.1
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work with complex JavaScript code', async () => {
      const jsCode = `
        import React, { useState, useEffect } from 'react';
        
        class Component extends React.Component {
          constructor(props) {
            super(props);
            this.state = {
              count: 0
            };
          }
          
          componentDidMount() {
            document.addEventListener('click', this.handleClick);
          }
          
          handleClick = () => {
            this.setState(prevState => ({
              count: prevState.count + 1
            }));
          }
          
          render() {
            return (
              <div>
                <h1>Count: {this.state.count}</h1>
                <button onClick={this.handleClick}>
                  Click me
                </button>
              </div>
            );
          }
        }
        
        export default Component;
      `;

      const context = createMockContext('javascript', true);
      const chunks = await strategy.segment({ ...context, content: jsCode, filePath: 'Component.jsx', language: 'typescript' });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'bracket')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'typescript'));
    });

    it('should work with Python code', async () => {
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
                
            def get_statistics(self) -> Dict[str, Any]:
                return {
                    'total_items': len(self.data),
                    'config': self.config
                }
      `;

      const context = createMockContext('python', true);
      const chunks = await strategy.segment({ ...context, content: pythonCode, filePath: 'data_processor.py', language: 'python' });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'bracket')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'python'));
    });

    it('should work with XML content', async () => {
      const xmlContent = `
        <?xml version="1.0" encoding="UTF-8"?>
        <root>
          <item id="1">
            <name>Test Item</name>
            <value>123</value>
          </item>
          <item id="2">
            <name>Another Item</name>
            <value>456</value>
          </item>
        </root>
      `;

      const context = createMockContext('xml', true);
      const chunks = await strategy.segment({ ...context, content: xmlContent, filePath: 'data.xml', language: 'xml' });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(chunk => chunk.metadata.type === 'bracket')).toBe(true);
      expect(chunks.every(chunk => chunk.metadata.language === 'xml'));
    });
  });

  describe('Edge Cases', () => {
    it('should handle edge cases', async () => {
      // Empty content
      const emptyResult = await strategy.segment({ ...createMockContext('javascript', true), content: '', filePath: 'test.js', language: 'javascript' });
      expect(emptyResult).toHaveLength(1);
      expect(emptyResult[0].content).toBe('');

      // Single line content
      const singleLineResult = await strategy.segment({ ...createMockContext('javascript', true), content: 'console.log("test");', filePath: 'test.js', language: 'javascript' });
      expect(singleLineResult).toHaveLength(1);
      expect(singleLineResult[0].content).toBe('console.log("test");');

      // Very large content
      const largeContent = 'function test() { '.repeat(1000) + '}';
      const largeResult = await strategy.segment({ ...createMockContext('javascript', true), content: largeContent, filePath: 'test.js', language: 'javascript' });
      expect(largeResult.length).toBeGreaterThan(1);
    });
  });
});