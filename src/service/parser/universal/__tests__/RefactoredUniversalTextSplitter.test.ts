import { UniversalTextSplitter } from '../UniversalTextSplitter';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { ProtectionCoordinator } from '../protection/ProtectionCoordinator';
import { SegmentationContextManager } from '../context/SegmentationContextManager';
import { ComplexityCalculator } from '../processors/ComplexityCalculator';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 重构后的UniversalTextSplitter测试
 */
describe('RefactoredUniversalTextSplitter', () => {
  let universalTextSplitter: UniversalTextSplitter;
  let logger: LoggerService;
  let configManager: ConfigurationManager;
  let protectionCoordinator: ProtectionCoordinator;
  
  beforeEach(() => {
    logger = new LoggerService();
    configManager = new ConfigurationManager();
    protectionCoordinator = new ProtectionCoordinator(logger);
    
    // 创建上下文管理器
    const contextManager = new SegmentationContextManager(logger, configManager);
    
    // 创建复杂度计算器
    const complexityCalculator = new ComplexityCalculator();
    
    // 创建UniversalTextSplitter实例
    universalTextSplitter = new UniversalTextSplitter(logger, configManager, protectionCoordinator);
    
    // 添加策略到上下文管理器
    // 注意：这里简化了测试，实际使用中应该通过依赖注入容器
  });
  
  describe('基本分段功能', () => {
    test('应该能够分段小文件', async () => {
      const content = 'console.log("Hello, World!");';
      const chunks = await universalTextSplitter.chunkByLines(content);
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(content);
      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(1);
    });
    
    test('应该能够分段大文件', async () => {
      const content = `
function test1() {
  console.log("test1");
}

function test2() {
  console.log("test2");
}

function test3() {
  console.log("test3");
}
      `.trim();
      
      const chunks = await universalTextSplitter.chunkBySemanticBoundaries(content, 'test.js', 'javascript');
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata.startLine).toBeGreaterThan(0);
        expect(chunk.metadata.endLine).toBeGreaterThanOrEqual(chunk.metadata.startLine);
      });
    });
  });
  
  describe('配置管理', () => {
    test('应该能够设置和获取选项', () => {
      const newOptions = {
        maxChunkSize: 1500,
        overlapSize: 150,
        maxLinesPerChunk: 75
      };
      
      universalTextSplitter.setOptions(newOptions);
      const currentOptions = universalTextSplitter.getOptions();
      
      expect(currentOptions.maxChunkSize).toBe(1500);
      expect(currentOptions.overlapSize).toBe(150);
      expect(currentOptions.maxLinesPerChunk).toBe(75);
    });
    
    test('应该验证配置', () => {
      const validation = universalTextSplitter.validateConfiguration();
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
  
  describe('策略选择', () => {
    test('应该能够获取可用的策略', () => {
      const strategies = universalTextSplitter.getAvailableStrategies();
      
      expect(strategies.length).toBeGreaterThan(0);
      strategies.forEach(strategy => {
        expect(strategy.name).toBeTruthy();
        expect(strategy.priority).toBeGreaterThan(0);
      });
    });
    
    test('应该能够获取支持的语言', () => {
      const languages = universalTextSplitter.getSupportedLanguages();
      
      expect(languages.length).toBeGreaterThan(0);
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
    });
  });
  
  describe('性能测试', () => {
    test('应该能够执行性能测试', async () => {
      const content = `
// Test content for performance testing
const test = () => {
  console.log("This is a test");
  return true;
};

class TestClass {
  constructor() {
    this.value = 42;
  }
  
  getValue() {
    return this.value;
  }
}

const instance = new TestClass();
console.log(instance.getValue());
      `.trim();
      
      const results = await universalTextSplitter.performanceTest(content, 'test.js', 'javascript');
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.strategy).toBeTruthy();
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(result.chunkCount).toBeGreaterThan(0);
        expect(result.averageChunkSize).toBeGreaterThanOrEqual(0);
      });
    });
  });
  
  describe('健康检查', () => {
    test('应该能够执行健康检查', async () => {
      const health = await universalTextSplitter.healthCheck();
      
      expect(health.isHealthy).toBe(true);
      expect(health.issues).toHaveLength(0);
      expect(health.components.contextManager).toBe(true);
      expect(health.components.configManager).toBe(true);
      expect(health.components.protectionCoordinator).toBe(true);
      expect(health.components.processors).toBe(true);
    });
  });
  
  describe('批量处理', () => {
    test('应该能够处理多个文件', async () => {
      const files = [
        {
          content: 'console.log("File 1");',
          filePath: 'file1.js',
          language: 'javascript'
        },
        {
          content: 'print("File 2")',
          filePath: 'file2.py',
          language: 'python'
        },
        {
          content: '<h1>File 3</h1>',
          filePath: 'file3.html',
          language: 'html'
        }
      ];
      
      const results = await universalTextSplitter.batchChunk(files);
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.chunks.length).toBeGreaterThan(0);
        expect(result.error).toBeUndefined();
        
        const expectedFile = files[index];
        expect(result.chunks[0].metadata.filePath).toBe(expectedFile.filePath);
        expect(result.chunks[0].metadata.language).toBe(expectedFile.language);
      });
    });
  });
  
  describe('统计信息', () => {
    test('应该能够获取分段统计', () => {
      const stats = universalTextSplitter.getSegmentationStats();
      
      expect(stats.totalSegmentations).toBe(0);
      expect(stats.averageChunkCount).toBe(0);
      expect(stats.strategyUsage).toEqual({});
      expect(stats.processorUsage).toEqual({});
    });
    
    test('应该能够重置统计', () => {
      universalTextSplitter.resetSegmentationStats();
      
      const stats = universalTextSplitter.getSegmentationStats();
      expect(stats.totalSegmentations).toBe(0);
    });
  });
  
  describe('Markdown处理', () => {
    test('应该能够处理Markdown文件', async () => {
      const markdownContent = `
# Test Document

This is a test document with **bold** and *italic* text.

## Code Example

\`\`\`javascript
function test() {
  return "Hello, World!";
}
\`\`\`

## List

- Item 1
- Item 2
- Item 3

## Table

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
      `.trim();
      
      const chunks = await universalTextSplitter.chunkBySemanticBoundaries(
        markdownContent, 
        'test.md', 
        'markdown'
      );
      
      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata.language).toBe('markdown');
        expect(chunk.metadata.type).toBe('section' || 'content');
      });
    });
  });
  
  describe('错误处理', () => {
    test('应该能够处理空内容', async () => {
      const chunks = await universalTextSplitter.chunkByLines('');
      
      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('');
    });
    
    test('应该能够处理无效语言', async () => {
      const content = 'test content';
      const chunks = await universalTextSplitter.chunkByLines(content, 'test.txt', 'invalid-language');
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata.language).toBe('invalid-language');
    });
  });
});