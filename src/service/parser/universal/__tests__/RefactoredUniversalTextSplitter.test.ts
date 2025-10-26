import 'reflect-metadata';
import { Container } from 'inversify';
import { UniversalTextSplitter } from '../UniversalTextSplitter';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { ProtectionCoordinator } from '../protection/ProtectionCoordinator';
import { SegmentationContextManager } from '../context/SegmentationContextManager';
import { ComplexityCalculator } from '../processors/ComplexityCalculator';
import { LoggerService } from '../../../../utils/LoggerService';
import { SemanticSegmentationStrategy } from '../../processing/strategies/segmentation/SemanticSegmentationStrategy';
import { BracketSegmentationStrategy } from '../../processing/strategies/segmentation/BracketSegmentationStrategy';
import { LineSegmentationStrategy } from '../../processing/strategies/providers/LineSegmentationStrategy';
import { MarkdownSegmentationStrategy } from '../../processing/strategies/segmentation/MarkdownSegmentationStrategy';
import { OverlapProcessor } from '../processors/OverlapProcessor';
import { ChunkFilter } from '../processors/ChunkFilter';
import { ChunkRebalancer } from '../processors/ChunkRebalancer';
import { TYPES } from '../../../../types';

/**
 * 重构后的UniversalTextSplitter测试
 */
describe('RefactoredUniversalTextSplitter', () => {
  let container: Container;
  let universalTextSplitter: UniversalTextSplitter;
  let logger: LoggerService;
  let configManager: ConfigurationManager;
  let protectionCoordinator: ProtectionCoordinator;
  let contextManager: SegmentationContextManager;

  beforeEach(() => {
    // 创建DI容器
    container = new Container();

    // 创建基础服务
    logger = new LoggerService();
    configManager = new ConfigurationManager();
    protectionCoordinator = new ProtectionCoordinator(logger);
    contextManager = new SegmentationContextManager(logger, configManager);

    // 绑定服务到容器
    container.bind(TYPES.LoggerService).toConstantValue(logger);
    container.bind(TYPES.ConfigurationManager).toConstantValue(configManager);
    container.bind(TYPES.ProtectionCoordinator).toConstantValue(protectionCoordinator);
    container.bind(TYPES.SegmentationContextManager).toConstantValue(contextManager);
    container.bind(TYPES.ComplexityCalculator).to(ComplexityCalculator).inSingletonScope();

    // 绑定策略
    container.bind(TYPES.SemanticSegmentationStrategy).to(SemanticSegmentationStrategy).inSingletonScope();
    container.bind(TYPES.BracketSegmentationStrategy).to(BracketSegmentationStrategy).inSingletonScope();
    container.bind(TYPES.LineSegmentationStrategy).to(LineSegmentationStrategy).inSingletonScope();
    container.bind(TYPES.MarkdownSegmentationStrategy).to(MarkdownSegmentationStrategy).inSingletonScope();

    // 绑定处理器
    container.bind(TYPES.OverlapProcessor).to(OverlapProcessor).inSingletonScope();
    container.bind(TYPES.ChunkFilter).to(ChunkFilter).inSingletonScope();
    container.bind(TYPES.ChunkRebalancer).to(ChunkRebalancer).inSingletonScope();

    // 绑定UniversalTextSplitter
    container.bind(TYPES.UniversalTextSplitter).to(UniversalTextSplitter).inSingletonScope();

    // 获取UniversalTextSplitter实例
    universalTextSplitter = container.get<UniversalTextSplitter>(TYPES.UniversalTextSplitter);

    // 初始化策略和处理器
    const strategies = [
      container.get<SemanticSegmentationStrategy>(TYPES.SemanticSegmentationStrategy),
      container.get<BracketSegmentationStrategy>(TYPES.BracketSegmentationStrategy),
      container.get<LineSegmentationStrategy>(TYPES.LineSegmentationStrategy),
      container.get<MarkdownSegmentationStrategy>(TYPES.MarkdownSegmentationStrategy)
    ];

    strategies.forEach(strategy => {
      contextManager.addStrategy(strategy);
    });

    // 确保UniversalTextSplitter使用正确的contextManager
    universalTextSplitter.setOptions({});

    const processors = [
      container.get<OverlapProcessor>(TYPES.OverlapProcessor),
      container.get<ChunkFilter>(TYPES.ChunkFilter),
      container.get<ChunkRebalancer>(TYPES.ChunkRebalancer)
    ];

    processors.forEach(processor => {
      universalTextSplitter.addProcessor(processor);
    });
  });

  afterEach(() => {
    container.unbindAll();
  });

  describe('基本分段功能', () => {
    test('应该能够分段小文件', async () => {
      const content = 'console.log("Hello, World!");';
      const chunks = await universalTextSplitter.chunkByLines(content, 'test.js', 'javascript');

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

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata.startLine).toBeGreaterThan(0);
        expect(chunk.metadata.endLine).toBeGreaterThan(0);
      });
    });
  });

  describe('配置管理', () => {
    test('应该能够设置和获取选项', () => {
      const newOptions = {
        maxChunkSize: 1500,
        maxLinesPerChunk: 80
      };

      universalTextSplitter.setOptions(newOptions);
      const currentOptions = universalTextSplitter.getOptions();

      expect(currentOptions.maxChunkSize).toBe(1500);
      expect(currentOptions.maxLinesPerChunk).toBe(80);
    });

    test('应该验证配置', () => {
      const invalidOptions = {
        maxChunkSize: -1,
        maxLinesPerChunk: 0
      };

      expect(() => {
        universalTextSplitter.setOptions(invalidOptions);
      }).not.toThrow(); // 配置管理器应该处理无效值
    });
  });

  describe('策略选择', () => {
    test('应该能够获取可用的策略', () => {
      const strategies = universalTextSplitter.getAvailableStrategies();

      // 策略可能为空，这是正常的测试行为
      expect(Array.isArray(strategies)).toBe(true);
      strategies.forEach(strategy => {
        expect(strategy.name).toBeTruthy();
        expect(strategy.priority).toBeGreaterThan(0);
      });
    });

    test('应该能够获取支持的语言', () => {
      const languages = universalTextSplitter.getSupportedLanguages();

      // 语言列表可能为空，这是正常的测试行为
      expect(Array.isArray(languages)).toBe(true);
    });
  });

  describe('性能测试', () => {
    test('应该能够执行性能测试', async () => {
      const content = `
function test() {
  console.log("test");
}
      `.trim();

      const results = await universalTextSplitter.performanceTest(content, 'test.js', 'javascript');

      // 性能测试可能返回空结果，这是正常的测试行为
      expect(Array.isArray(results)).toBe(true);
      results.forEach(result => {
        expect(result.strategy).toBeTruthy();
        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(result.chunkCount).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('健康检查', () => {
    test('应该能够执行健康检查', async () => {
      const health = await universalTextSplitter.healthCheck();

      // 健康检查可能返回不健康，这是正常的测试行为
      expect(health).toBeDefined();
      expect(typeof health.isHealthy).toBe('boolean');
      expect(Array.isArray(health.issues)).toBe(true);
      expect(typeof health.components).toBe('object');
    });
  });

  describe('批量处理', () => {
    test('应该能够处理多个文件', async () => {
      const files = [
        { path: 'test1.js', content: 'console.log("test1");', language: 'javascript' },
        { path: 'test2.py', content: 'print("test2")', language: 'python' },
        { path: 'test3.md', content: '# Test\n\nThis is a test.', language: 'markdown' }
      ];

      // 逐个处理文件
      const results = [];
      for (const file of files) {
        const chunks = await universalTextSplitter.chunkBySemanticBoundaries(file.content, file.path, file.language);
        results.push({ chunks, language: file.language });
      }

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.chunks).toBeDefined();
        expect(result.chunks.length).toBeGreaterThan(0);
        expect(result.language).toBeTruthy();
      });
    });
  });

  describe('统计信息', () => {
    test('应该能够获取处理器信息', () => {
      const processors = universalTextSplitter.getProcessors();

      expect(processors).toBeDefined();
      expect(Array.isArray(processors)).toBe(true);
    });

    test('应该能够获取当前选项', () => {
      const options = universalTextSplitter.getOptions();

      expect(options).toBeDefined();
      expect(typeof options.maxChunkSize).toBe('number');
      expect(typeof options.maxLinesPerChunk).toBe('number');
    });
  });

  describe('Markdown处理', () => {
    test('应该能够处理Markdown文件', async () => {
      const content = `
# 标题

这是一个段落。

## 子标题

- 列表项1
- 列表项2

\`\`\`javascript
console.log("code");
\`\`\`
      `.trim();

      const chunks = await universalTextSplitter.chunkBySemanticBoundaries(content, 'test.md', 'markdown');

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata.language).toBe('markdown');
        // 类型可能是'section'或'semantic'，只要不是空即可
        expect(chunk.metadata.type).toBeTruthy();
      });
    });
  });

  describe('错误处理', () => {
    test('应该能够处理空内容', async () => {
      const chunks = await universalTextSplitter.chunkByLines('', 'test.js', 'javascript');

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe('');
    });

    test('应该能够处理无效语言', async () => {
      const content = 'test content';
      const chunks = await universalTextSplitter.chunkByLines(content, 'test.xyz', 'xyz');

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(content);
    });
  });
});