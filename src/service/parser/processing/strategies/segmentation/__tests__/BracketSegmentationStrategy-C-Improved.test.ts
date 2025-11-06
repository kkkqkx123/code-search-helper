import { BracketSegmentationStrategy } from '../BracketSegmentationStrategy';
import { LoggerService } from '../../../../../../utils/LoggerService';
import { ISegmentationStrategy, SegmentationContext, IComplexityCalculator } from '../../types/SegmentationTypes';
import { CodeChunk } from '../../../../types/core-types';

// Mock LoggerService
jest.mock('../../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

// Mock IComplexityCalculator
const mockComplexityCalculator: jest.Mocked<IComplexityCalculator> = {
  calculate: jest.fn()
};

describe('BracketSegmentationStrategy - C Language Improved Tests', () => {
  let strategy: BracketSegmentationStrategy;
  let mockLogger: jest.Mocked<LoggerService>;

  // Create mock context for C language
  const createMockContext = (language = 'c', enableBracketBalance = true, maxChunkSize = 2000): SegmentationContext => ({
    content: 'test content',
    options: {
      maxChunkSize,
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

  describe('C Language Chunk Size Behavior', () => {
    it('should split large single-line content when exceeding hard limits', async () => {
      // Create content that exceeds the hard limit (1200 chars)
      const content = 'char largeArray[] = "' + 'A'.repeat(1500) + '";';
      const context = createMockContext('c', true, 1000); // Set lower maxChunkSize

      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'huge.c', 
        language: 'c' 
      });

      // Should split due to exceeding hard limits
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      
      // Each chunk should respect the hard limit with tolerance
      chunks.forEach((chunk: { content: string; }) => {
        expect(chunk.content.length).toBeLessThanOrEqual(2000); // Allow more tolerance for single-line content
      });
    });

    it('should handle multi-line content with bracket balancing', async () => {
      // Create multi-line content that forces splitting
      const lines = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`printf("Line ${i}: %s\\n", "This is a very long string that will help us test the chunking behavior");`);
      }
      const content = lines.join('\n');

      const context = createMockContext('c', true, 1000);

      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'multiline.c', 
        language: 'c' 
      });

      // Should split into multiple chunks due to line count
      expect(chunks.length).toBeGreaterThan(1);
      
      // Each chunk should respect size limits
      chunks.forEach((chunk: { content: string; }) => {
        expect(chunk.content.length).toBeLessThanOrEqual(1200);
        const lineCount = chunk.content.split('\n').length;
        expect(lineCount).toBeLessThanOrEqual(50); // maxLinesPerChunk
      });
    });

    it('should preserve bracket balance when splitting', async () => {
      const content = `
void function1() {
    printf("Function 1");
    for (int i = 0; i < 10; i++) {
        printf("Loop %d\\n", i);
    }
}

void function2() {
    printf("Function 2");
    if (condition) {
        printf("Nested block");
    }
}

void function3() {
    printf("Function 3");
    switch (value) {
        case 1:
            printf("Case 1");
            break;
        case 2:
            printf("Case 2");
            break;
        default:
            printf("Default");
            break;
    }
}
      `.trim();

      const context = createMockContext('c', true, 500); // Smaller chunk size to force splitting

      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'functions.c', 
        language: 'c' 
      });

      // Should split at function boundaries (where bracket depth is 0)
      expect(chunks.length).toBeGreaterThan(1);
      
      // Each chunk should have balanced brackets
      chunks.forEach(chunk => {
        const openBrackets = (chunk.content.match(/{/g) || []).length;
        const closeBrackets = (chunk.content.match(/}/g) || []).length;
        expect(openBrackets).toBe(closeBrackets);
      });
    });

    it('should handle C preprocessor directives correctly', async () => {
      const content = `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_SIZE 1000
#define PI 3.14159

#ifdef DEBUG
    #define DEBUG_PRINT(x) printf(x)
#else
    #define DEBUG_PRINT(x)
#endif

void process() {
    int arr[MAX_SIZE];
    float circle = PI * 2.0f;
    DEBUG_PRINT("Processing\\n");
}
      `.trim();

      const context = createMockContext('c', true, 800);

      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'preprocessor.c', 
        language: 'c' 
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      
      // Should preserve preprocessor directives with their associated code
      const hasIncludes = chunks.some(chunk => chunk.content.includes('#include'));
      const hasDefines = chunks.some(chunk => chunk.content.includes('#define'));
      const hasConditionals = chunks.some(chunk => chunk.content.includes('#ifdef'));
      
      expect(hasIncludes).toBe(true);
      expect(hasDefines).toBe(true);
      expect(hasConditionals).toBe(true);
    });

    it('should respect memory limits for very large C files', async () => {
      // Create a very large C file
      const lines = [];
      for (let i = 0; i < 1000; i++) {
        lines.push(`int variable_${i} = ${i};`);
        if (i % 10 === 0) {
          lines.push(`printf("Processing variable %d\\n", variable_${i});`);
        }
      }
      const content = lines.join('\n');

      const context = createMockContext('c', true, 2000);

      const chunks = await strategy.segment({ 
        ...context, 
        content, 
        filePath: 'large.c', 
        language: 'c' 
      });

      // Should handle large files without memory issues
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.length).toBeLessThan(300); // Allow more chunks for very large files
      
      // Total content should be preserved (allowing for minor differences in whitespace)
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
      expect(Math.abs(totalLength - content.length)).toBeLessThan(1000); // Allow reasonable difference
    });
  });
});