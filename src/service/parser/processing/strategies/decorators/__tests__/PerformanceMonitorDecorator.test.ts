import { PerformanceMonitorDecorator } from '../PerformanceMonitorDecorator';
import { ISplitStrategy } from '../../../interfaces/ISplitStrategy';
import { CodeChunk, ChunkingOptions } from '../../../types';

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
  
  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 10));
    
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

// Mock strategy that throws error
class ErrorStrategy implements ISplitStrategy {
  getName(): string {
    return 'error_strategy';
  }
  
  supportsLanguage(language: string): boolean {
    return true;
  }
  
  getPriority(): number {
    return 1;
  }
  
  async split(): Promise<CodeChunk[]> {
    throw new Error('Test error');
  }
}

// Mock logger
class MockLogger {
  public debugMessages: string[] = [];
  public errorMessages: string[] = [];
  
  debug(message: string): void {
    this.debugMessages.push(message);
  }
  
  error(message: string, error?: any): void {
    this.errorMessages.push(message);
  }
}

describe('PerformanceMonitorDecorator', () => {
  let mockStrategy: MockStrategy;
  let mockLogger: MockLogger;
  let decorator: PerformanceMonitorDecorator;
  
  beforeEach(() => {
    mockStrategy = new MockStrategy('test_strategy');
    mockLogger = new MockLogger();
    decorator = new PerformanceMonitorDecorator(mockStrategy, mockLogger);
  });
  
  describe('split', () => {
    it('should monitor successful split operations', async () => {
      const content = 'line1\nline2\nline3';
      const language = 'javascript';
      const filePath = 'test.js';
      
      const result = await decorator.split(content, language, filePath);
      
      expect(result).toHaveLength(3);
      expect(result[0].content).toBe('line1');
      
      const stats = decorator.getPerformanceStats();
      expect(stats.splitCount).toBe(1);
      expect(stats.totalChunks).toBe(3);
      expect(stats.totalTime).toBeGreaterThan(0);
      expect(stats.averageTime).toBeGreaterThan(0);
      expect(stats.averageChunksPerSplit).toBe(3);
    });
    
    it('should monitor multiple split operations', async () => {
      const content = 'line1\nline2';
      const language = 'javascript';
      
      // First split
      await decorator.split(content, language);
      
      // Second split
      await decorator.split(content + '\nline3', language);
      
      const stats = decorator.getPerformanceStats();
      expect(stats.splitCount).toBe(2);
      expect(stats.totalChunks).toBe(5); // 2 + 3
      expect(stats.averageChunksPerSplit).toBe(2.5);
    });
    
    it('should handle errors and log them', async () => {
      const errorStrategy = new ErrorStrategy();
      const errorDecorator = new PerformanceMonitorDecorator(errorStrategy, mockLogger);
      
      try {
        await errorDecorator.split('content', 'javascript');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toBe('Test error');
      }
      
      const stats = errorDecorator.getPerformanceStats();
      expect(stats.splitCount).toBe(1);
      expect(stats.totalChunks).toBe(0);
      
      expect(mockLogger.errorMessages).toHaveLength(1);
      expect(mockLogger.errorMessages[0]).toContain('error_strategy failed after');
    });
    
    it('should log performance information', async () => {
      const content = 'line1\nline2\nline3';
      const language = 'javascript';
      
      await decorator.split(content, language);
      
      expect(mockLogger.debugMessages).toHaveLength(1);
      expect(mockLogger.debugMessages[0]).toContain('test_strategy split javascript file');
      expect(mockLogger.debugMessages[0]).toContain('into 3 chunks');
      expect(mockLogger.debugMessages[0]).toContain('ms');
    });
    
    it('should work without logger', async () => {
      const decoratorWithoutLogger = new PerformanceMonitorDecorator(mockStrategy);
      
      const content = 'line1\nline2';
      const result = await decoratorWithoutLogger.split(content, 'javascript');
      
      expect(result).toHaveLength(2);
      
      const stats = decoratorWithoutLogger.getPerformanceStats();
      expect(stats.splitCount).toBe(1);
    });
  });
  
  describe('performance statistics', () => {
    it('should calculate average time correctly', async () => {
      // First split
      await decorator.split('line1', 'javascript');
      
      let stats = decorator.getPerformanceStats();
      expect(stats.averageTime).toBe(stats.totalTime);
      
      // Second split
      await decorator.split('line2', 'javascript');
      
      stats = decorator.getPerformanceStats();
      expect(stats.averageTime).toBe(stats.totalTime / 2);
    });
    
    it('should calculate average chunks per split correctly', async () => {
      // First split (2 chunks)
      await decorator.split('line1\nline2', 'javascript');
      
      // Second split (3 chunks)
      await decorator.split('line1\nline2\nline3', 'javascript');
      
      const stats = decorator.getPerformanceStats();
      expect(stats.averageChunksPerSplit).toBe(2.5); // (2 + 3) / 2
    });
    
    it('should handle zero divisions gracefully', async () => {
      const stats = decorator.getPerformanceStats();
      expect(stats.splitCount).toBe(0);
      expect(stats.averageTime).toBe(0);
      expect(stats.averageChunksPerSplit).toBe(0);
    });
  });
  
  describe('reset functionality', () => {
    it('should reset performance statistics', async () => {
      await decorator.split('line1\nline2', 'javascript');
      
      let stats = decorator.getPerformanceStats();
      expect(stats.splitCount).toBe(1);
      expect(stats.totalChunks).toBe(2);
      
      decorator.resetPerformanceStats();
      
      stats = decorator.getPerformanceStats();
      expect(stats.splitCount).toBe(0);
      expect(stats.totalChunks).toBe(0);
      expect(stats.totalTime).toBe(0);
    });
  });
  
  describe('interface methods', () => {
    it('should return decorated name', () => {
      expect(decorator.getName()).toBe('test_strategy_monitored');
    });
    
    it('should delegate supportsLanguage', () => {
      expect(decorator.supportsLanguage('javascript')).toBe(true);
    });
    
    it('should delegate getPriority', () => {
      expect(decorator.getPriority()).toBe(1);
    });
  });
  
  describe('performance logging', () => {
    it('should include average time per chunk in log', async () => {
      const content = 'line1\nline2\nline3';
      const language = 'javascript';
      
      await decorator.split(content, language);
      
      const logMessage = mockLogger.debugMessages[0];
      expect(logMessage).toMatch(/avg: \d+\.\d+ms per chunk/);
    });
    
    it('should handle division by zero for average time per chunk', async () => {
      // Create a strategy that returns empty chunks
      const emptyStrategy = new MockStrategy('empty_strategy');
      const emptyDecorator = new PerformanceMonitorDecorator(emptyStrategy, mockLogger);
      
      await emptyDecorator.split('', 'javascript');
      
      const logMessage = mockLogger.debugMessages[0];
      expect(logMessage).toContain('0.00ms per chunk');
    });
  });
});