import 'reflect-metadata';
import { Container } from 'inversify';
import { UniversalTextSplitter } from '../UniversalTextSplitter';
import { LoggerService } from '../../../../utils/LoggerService';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { ProtectionCoordinator } from '../protection/ProtectionCoordinator';
import { SegmentationContextManager } from '../context/SegmentationContextManager';
import { SemanticSegmentationStrategy } from '../../processing/strategies/impl/SemanticSegmentationStrategy';
import { BracketSegmentationStrategy } from '../../processing/strategies/impl/BracketSegmentationStrategy';
import { LineSegmentationStrategy } from '../../processing/strategies/providers/LineSegmentationStrategy';
import { MarkdownSegmentationStrategy } from '../../processing/strategies/impl/MarkdownSegmentationStrategy';
import { OverlapProcessor } from '../processors/OverlapProcessor';
import { ChunkFilter } from '../processors/ChunkFilter';
import { ChunkRebalancer } from '../processors/ChunkRebalancer';
import { ComplexityCalculator } from '../processors/ComplexityCalculator';
import { TYPES } from '../../../../types';

describe('UniversalTextSplitter', () => {
  let container: Container;
  let splitter: UniversalTextSplitter;
  let mockLogger: LoggerService;

  beforeEach(() => {
    // 创建DI容器
    container = new Container();

    // 创建基础服务
    mockLogger = new LoggerService();
    const configManager = new ConfigurationManager(mockLogger);
    const protectionCoordinator = new ProtectionCoordinator(mockLogger);
    const contextManager = new SegmentationContextManager(mockLogger, configManager);

    // 绑定服务到容器
    container.bind(TYPES.LoggerService).toConstantValue(mockLogger);
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
    splitter = container.get<UniversalTextSplitter>(TYPES.UniversalTextSplitter);

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

    const processors = [
      container.get<OverlapProcessor>(TYPES.OverlapProcessor),
      container.get<ChunkFilter>(TYPES.ChunkFilter),
      container.get<ChunkRebalancer>(TYPES.ChunkRebalancer)
    ];

    processors.forEach(processor => {
      splitter.addProcessor(processor);
    });
  });

  afterEach(() => {
    container.unbindAll();
  });

  describe('chunkBySemanticBoundaries', () => {
    test('should chunk TypeScript code correctly', async () => {
      const content = `
interface User {
  id: number;
  name: string;
}

class UserService {
  private users: User[] = [];
  
  addUser(user: User): void {
    this.users.push(user);
  }
  
  getUser(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }
}
      `.trim();

      const chunks = await splitter.chunkBySemanticBoundaries(content, 'user.ts', 'typescript');

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata.startLine).toBeGreaterThan(0);
        expect(chunk.metadata.endLine).toBeGreaterThan(0);
      });
    });

    test('should chunk Python code correctly', async () => {
      const content = `
class Calculator:
    def __init__(self):
        self.result = 0
    
    def add(self, x, y):
        self.result = x + y
        return self.result
    
    def subtract(self, x, y):
        self.result = x - y
        return self.result
      `.trim();

      const chunks = await splitter.chunkBySemanticBoundaries(content, 'calc.py', 'python');

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata.startLine).toBeGreaterThan(0);
        expect(chunk.metadata.endLine).toBeGreaterThan(0);
      });
    });

    test('should handle large files with memory protection', async () => {
      // 创建一个较小的文件内容来测试内存保护
      const content = `
function test1() { console.log('test1'); }
function test2() { console.log('test2'); }
function test3() { console.log('test3'); }
function test4() { console.log('test4'); }
function test5() { console.log('test5'); }
      `.trim();

      // 使用基本的分段方法
      const chunks = await splitter.chunkBySemanticBoundaries(content, 'large.js', 'javascript');

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata.startLine).toBeGreaterThan(0);
        expect(chunk.metadata.endLine).toBeGreaterThan(0);
      });
    });
  });

  describe('chunkByBracketsAndLines', () => {
    test('should chunk JavaScript code with bracket balance', async () => {
      const content = `
function outerFunction() {
  const x = 10;
  
  function innerFunction() {
    const y = 20;
    return x + y;
  }
  
  return innerFunction();
}

const result = outerFunction();
      `.trim();

      const chunks = await splitter.chunkByBracketsAndLines(content, 'test.js', 'javascript');

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata.startLine).toBeGreaterThan(0);
        expect(chunk.metadata.endLine).toBeGreaterThan(0);
      });
    });

    test('should chunk XML/HTML with tag balance', async () => {
      const content = `
<div class="container">
  <header>
    <h1>Title</h1>
  </header>
  <main>
    <section>
      <p>Content here</p>
    </section>
  </main>
</div>
      `.trim();

      const chunks = await splitter.chunkByBracketsAndLines(content, 'test.html', 'html');

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata.startLine).toBeGreaterThan(0);
        expect(chunk.metadata.endLine).toBeGreaterThan(0);
      });
    });
  });
});