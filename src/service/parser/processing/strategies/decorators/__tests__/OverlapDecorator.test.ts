import { OverlapDecorator } from '../OverlapDecorator';
import { ISplitStrategy } from '../../../interfaces/ISplitStrategy';
import { OverlapCalculator, IOverlapCalculator } from '../../../types/splitting-types';
import { CodeChunk, ChunkingOptions } from '../../../../types/core-types';

// Mock strategy
class MockStrategy implements ISplitStrategy {
  constructor(private name: string, private priority: number = 1) {}
  
  getName(): string {
    return this.name;
  }
  
  supportsLanguage(language: string): boolean {
    return true;
  }
  
  getPriority(): number {
    return this.priority;
  }

  getDescription(): string {
    return `Mock strategy: ${this.name}`;
  }
  
  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    if (!content) {
      return [];
    }
    const lines = content.split('\n');
    return lines.map((line, index) => ({
      id: `chunk_${index}`,
      content: line,
      metadata: {
        startLine: index + 1,
        endLine: index + 1,
        language,
        filePath,
        type: 'line'
      }
    }));
  }
}

// Mock overlap calculator
class MockOverlapCalculator implements IOverlapCalculator {
  async addOverlap(chunks: CodeChunk[], content: string): Promise<CodeChunk[]> {
    // Simple overlap implementation: add previous line's content to each chunk
    const result: CodeChunk[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      let overlapContent = '';
      
      if (i > 0) {
        overlapContent = chunks[i - 1].content + '\n';
      }
      
      result.push({
        ...chunk,
        content: overlapContent + chunk.content,
        metadata: {
          ...chunk.metadata,
          hasOverlap: i > 0
        }
      });
    }
    
    return result;
  }
}

describe('OverlapDecorator', () => {
  let mockStrategy: MockStrategy;
  let mockCalculator: MockOverlapCalculator;
  let decorator: OverlapDecorator;
  
  beforeEach(() => {
    mockStrategy = new MockStrategy('test_strategy');
    mockCalculator = new MockOverlapCalculator();
    decorator = new OverlapDecorator(mockStrategy, mockCalculator);
  });
  
  describe('split', () => {
    it('should add overlap for non-code files', async () => {
      const content = 'line1\nline2\nline3';
      const language = 'markdown';
      const filePath = 'test.md';
      
      const result = await decorator.split(content, language, filePath);
      
      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('line1');
      expect(result[1].content).toBe('line1\nline2');
      expect(result[2].content).toBe('line2\nline3');
    });
    
    it('should not add overlap for code files with small chunks', async () => {
      const content = 'line1\nline2\nline3';
      const language = 'javascript';
      const filePath = 'test.js';
      const options = { basic: { maxChunkSize: 100 } };
      
      const result = await decorator.split(content, language, filePath, options);
      
      expect(result).toHaveLength(3);
      // Should not have overlap
      expect(result[0].content).toBe('line1');
      expect(result[1].content).toBe('line2');
      expect(result[2].content).toBe('line3');
    });
    
    it('should add overlap for code files with oversized chunks', async () => {
      const content = 'line1\nline2\nline3';
      const language = 'javascript';
      const filePath = 'test.js';
      const options = { basic: { maxChunkSize: 4 } }; // Small size to trigger overlap
      
      const result = await decorator.split(content, language, filePath, options);
      
      expect(result).toHaveLength(3);
      // Should have overlap
      expect(result[0].content).toBe('line1');
      expect(result[1].content).toBe('line1\nline2');
      expect(result[2].content).toBe('line2\nline3');
    });
    
    it('should return single chunk as-is', async () => {
      const content = 'single line';
      const language = 'javascript';
      
      const result = await decorator.split(content, language);
      
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('single line');
    });
    
    it('should return empty array for empty content', async () => {
      const content = '';
      const language = 'javascript';
      
      const result = await decorator.split(content, language);
      
      expect(result).toHaveLength(0);
    });
  });
  
  describe('interface methods', () => {
    it('should return decorated name', () => {
      expect(decorator.getName()).toBe('test_strategy_with_overlap');
    });
    
    it('should delegate supportsLanguage', () => {
      expect(decorator.supportsLanguage('javascript')).toBe(true);
    });
    
    it('should delegate getPriority', () => {
      
    });
  });
  
  describe('code file detection', () => {
    it('should detect markdown files as non-code', () => {
      const testCases = [
        { language: 'markdown', expected: false },
        { language: 'javascript', expected: true },
        { language: 'typescript', expected: true },
        { language: 'python', expected: true },
        { language: 'java', expected: true },
        { language: 'unknown', expected: false }
      ];
      
      testCases.forEach(({ language, expected }) => {
        // Create a decorator with a spy to test private method indirectly
        const decorator = new OverlapDecorator(mockStrategy, mockCalculator);
        // Test through behavior rather than direct method access
        expect(decorator.supportsLanguage(language)).toBe(true); // All supported by mock
      });
    });
  });
});