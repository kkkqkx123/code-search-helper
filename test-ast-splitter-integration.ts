import { ASTCodeSplitter } from './src/service/parser/processing/strategies/implementations/ASTCodeSplitter';
import { Container } from 'inversify';
import { TYPES } from './src/types';

// 创建一个简单的测试容器
const testContainer = new Container();

// 模拟服务
const mockTreeSitterService = {
  parseCode: async (content: string, language: string) => {
    console.log(`Mock parsing ${language} code`);
    return { ast: { rootNode: { type: 'program', children: [] } } };
  }
};

const mockDetectionService = {
  detectLanguage: (content: string, filePath?: string) => {
    return filePath?.split('.').pop() || 'javascript';
  }
};

const mockLoggerService = {
  debug: (msg: string) => console.log(`DEBUG: ${msg}`),
  info: (msg: string) => console.log(`INFO: ${msg}`),
  warn: (msg: string) => console.log(`WARN: ${msg}`),
  error: (msg: string) => console.log(`ERROR: ${msg}`),
  log: (level: string, msg: string) => console.log(`${level}: ${msg}`)
};

const mockCacheService = {
  getFromCache: (key: string) => undefined,
  setCache: (key: string, value: any, ttl?: number) => { },
  clearAllCache: () => { },
  getCacheStats: () => ({ totalEntries: 0, hitCount: 0, missCount: 0, hitRate: 0 })
};

const mockPerformanceMonitor = {
  recordQueryExecution: (executionTimeMs: number) => { },
  updateBatchSize: (batchSize: number) => { },
  recordBatchResult: (success: boolean) => { }
};

// 绑定服务
testContainer.bind(TYPES.TreeSitterService).toConstantValue(mockTreeSitterService as any);
testContainer.bind(TYPES.DetectionService).toConstantValue(mockDetectionService as any);
testContainer.bind(TYPES.LoggerService).toConstantValue(mockLoggerService as any);
testContainer.bind(TYPES.CacheService).toConstantValue(mockCacheService as any);
testContainer.bind(TYPES.PerformanceMonitor).toConstantValue(mockPerformanceMonitor as any);

// 创建ASTCodeSplitter实例
const astSplitter = new ASTCodeSplitter(
  testContainer.get(TYPES.TreeSitterService),
  testContainer.get(TYPES.DetectionService),
  testContainer.get(TYPES.LoggerService),
  testContainer.get(TYPES.CacheService),
  testContainer.get(TYPES.PerformanceMonitor)
);

// 测试代码
const testCode = `
function exampleFunction() {
  console.log("Hello, world!");
  if (true) {
    return 42;
  }
}

class ExampleClass {
  constructor() {
    this.value = 100;
  }
  
  getValue() {
    return this.value;
  }
}
`;

async function testIntegration() {
  console.log('Testing ASTCodeSplitter integration...');

  try {
    const chunks = await astSplitter.split(testCode, 'test.js', 'javascript');
    console.log(`Generated ${chunks.length} chunks`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Chunk ${i + 1}:`);
      console.log(`  Type: ${chunk.metadata.type}`);
      console.log(`  Complexity: ${chunk.metadata.complexity}`);
      console.log(`  Lines: ${chunk.metadata.startLine}-${chunk.metadata.endLine}`);
      console.log(`  Size: ${chunk.metadata.size} chars`);
      console.log(`  Content preview: ${chunk.content.substring(0, 50)}...`);
      console.log('---');
    }
  } catch (error) {
    console.error('Error during AST splitting:', error);
  }
}

// 运行测试
testIntegration();