import { TreeSitterCoreService } from '../../core/parse/TreeSitterCoreService';
import { DynamicParserManager } from '../../core/parse/DynamicParserManager';
import { QueryRegistryImpl } from '../../core/query/QueryRegistry';
import { TreeSitterQueryFacade } from '../../core/query/TreeSitterQueryFacade';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { CodeStructureService } from '../../core/structure/CodeStructureService';
import { ICacheService } from '../../../../infrastructure/caching/types';

/**
 * 优化后的解析器集成测试
 * 验证整个优化方案的功能完整性和性能
 */
describe('Optimized Parser Integration Tests', () => {
  let coreService: TreeSitterCoreService;
  let dynamicManager: DynamicParserManager;
  let treeSitterService: TreeSitterService;
  let structureService: CodeStructureService;
  let mockCacheService: ICacheService;

  beforeAll(async () => {
    // 创建模拟缓存服务
    mockCacheService = {
      getFromCache: jest.fn(),
      setCache: jest.fn(),
      deleteFromCache: jest.fn(),
      clearAllCache: jest.fn(),
      getCacheStats: jest.fn(() => ({ totalEntries: 0, hitCount: 0, missCount: 0, hitRate: 0 })),
      cleanupExpiredEntries: jest.fn(),
      isGraphCacheHealthy: jest.fn(() => true),
      deleteByPattern: jest.fn(() => 0),
      getKeysByPattern: jest.fn(() => []),
      getDatabaseSpecificCache: jest.fn(() => Promise.resolve(null)),
      setDatabaseSpecificCache: jest.fn(() => Promise.resolve()),
      invalidateDatabaseCache: jest.fn(() => Promise.resolve())
    };

    // 初始化服务
    coreService = new TreeSitterCoreService(mockCacheService);
    dynamicManager = new DynamicParserManager(mockCacheService);
    treeSitterService = new TreeSitterService(coreService);
    structureService = new CodeStructureService(coreService);
    
    // 等待初始化完成
    await new Promise(resolve => setTimeout(resolve, 2000));
  }, 30000);

  describe('基础功能验证', () => {
    test('服务初始化验证', () => {
      expect(coreService.isInitialized()).toBe(true);
      expect(dynamicManager.isInitialized()).toBe(true);
    });

    test('支持的语言列表验证', () => {
      const supportedLanguages = coreService.getSupportedLanguages();
      const dynamicLanguages = dynamicManager.getSupportedLanguages();
      
      expect(supportedLanguages.length).toBeGreaterThan(0);
      expect(dynamicLanguages.length).toBeGreaterThan(0);
      
      // 验证核心语言支持
      const coreLanguageNames = supportedLanguages.map(lang => lang.name.toLowerCase());
      const dynamicLanguageNames = dynamicLanguages.map(lang => lang.name.toLowerCase());
      
      const coreLanguages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust'];
      for (const lang of coreLanguages) {
        expect(coreLanguageNames).toContain(lang);
        expect(dynamicLanguageNames).toContain(lang);
      }
    });

    test('语言检测功能验证', async () => {
      const testCases = [
        { filePath: 'test.js', expected: 'javascript' },
        { filePath: 'test.ts', expected: 'typescript' },
        { filePath: 'test.py', expected: 'python' },
        { filePath: 'test.java', expected: 'java' },
        { filePath: 'test.go', expected: 'go' },
        { filePath: 'test.rs', expected: 'rust' },
      ];

      for (const testCase of testCases) {
        const detected = await coreService.detectLanguage(testCase.filePath);
        expect(detected).toBeTruthy();
        expect(detected!.name.toLowerCase()).toBe(testCase.expected);
      }
    });
  });

  describe('解析功能验证', () => {
    const testCodeSamples = {
      javascript: `
function calculateSum(a, b) {
  return a + b;
}

class Calculator {
  constructor() {
    this.result = 0;
  }
  
  add(value) {
    this.result += value;
    return this;
  }
}

export { Calculator };
      `,
      typescript: `
interface User {
  id: number;
  name: string;
}

class UserService {
  private users: User[] = [];
  
  addUser(user: User): void {
    this.users.push(user);
  }
  
  findUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }
}

export { UserService };
      `,
      python: `
def calculate_sum(a, b):
    return a + b

class Calculator:
    def __init__(self):
        self.result = 0
    
    def add(self, value):
        self.result += value
        return self
      `,
      java: `
public class Calculator {
    private int result = 0;
    
    public Calculator add(int value) {
        this.result += value;
        return this;
    }
    
    public int getResult() {
        return this.result;
    }
}
      `
    };

    test.each(Object.keys(testCodeSamples))('解析 %s 代码', async (language) => {
      const code = testCodeSamples[language as keyof typeof testCodeSamples];
      
      // 测试核心服务解析
      const coreResult = await coreService.parseCode(code, language);
      expect(coreResult.success).toBe(true);
      expect(coreResult.ast).toBeTruthy();
      
      // 测试动态管理器解析
      const dynamicResult = await dynamicManager.parseCode(code, language);
      expect(dynamicResult.success).toBe(true);
      expect(dynamicResult.ast).toBeTruthy();
      
      // 验证结果一致性
      expect(coreResult.language.name.toLowerCase()).toBe(language);
      expect(dynamicResult.language.name.toLowerCase()).toBe(language);
    });

    test.each(Object.keys(testCodeSamples))('提取 %s 函数', async (language) => {
      const code = testCodeSamples[language as keyof typeof testCodeSamples];
      
      // 解析代码
      const coreParse = await coreService.parseCode(code, language);
      const dynamicParse = await dynamicManager.parseCode(code, language);
      
      // 提取函数
      const coreFunctions = await structureService.extractFunctions(coreParse.ast, language);
      const dynamicFunctions = await dynamicManager.extractFunctions(dynamicParse.ast, language);
      
      // 验证结果
      expect(coreFunctions.length).toBeGreaterThan(0);
      expect(dynamicFunctions.length).toBeGreaterThan(0);
      expect(coreFunctions.length).toBe(dynamicFunctions.length);
    });

    test.each(Object.keys(testCodeSamples))('提取 %s 类', async (language) => {
      const code = testCodeSamples[language as keyof typeof testCodeSamples];
      
      // 解析代码
      const coreParse = await coreService.parseCode(code, language);
      const dynamicParse = await dynamicManager.parseCode(code, language);
      
      // 提取类
      const coreClasses = await structureService.extractClasses(coreParse.ast, language);
      const dynamicClasses = await dynamicManager.extractClasses(dynamicParse.ast, language);
      
      // 验证结果
      expect(coreClasses.length).toBeGreaterThan(0);
      expect(dynamicClasses.length).toBeGreaterThan(0);
      expect(coreClasses.length).toBe(dynamicClasses.length);
    });
  });

  describe('查询系统验证', () => {
    test('查询系统初始化验证', async () => {
      await QueryRegistryImpl.initialize();
      
      const queryStats = TreeSitterQueryFacade.getPerformanceStats();
      const registryStats = QueryRegistryImpl.getStats();
      
      expect(queryStats).toBeTruthy();
      expect(registryStats.initialized).toBe(true);
      expect(registryStats.totalLanguages).toBeGreaterThan(0);
    });

    test('查询模式验证', async () => {
      const languages = ['javascript', 'typescript', 'python'];
      const queryTypes = ['functions', 'classes', 'imports', 'exports'];
      
      for (const language of languages) {
        for (const queryType of queryTypes) {
          const pattern = await QueryRegistryImpl.getPattern(language, queryType);
          if (pattern) {
            expect(typeof pattern).toBe('string');
            expect(pattern.trim().length).toBeGreaterThan(0);
          }
        }
      }
    });

    test('查询执行验证', async () => {
      const code = `
function test() {
  return 'test';
}
class TestClass {
  constructor() {}
}
      `;
      
      const parseResult = await coreService.parseCode(code, 'javascript');
      expect(parseResult.success).toBe(true);
      
      // 执行函数查询
      const functions = await structureService.extractFunctions(parseResult.ast, 'javascript');
      expect(functions.length).toBeGreaterThan(0);
      
      // 执行类查询
      const classes = await structureService.extractClasses(parseResult.ast, 'javascript');
      expect(classes.length).toBeGreaterThan(0);
    });
  });

  describe('性能验证', () => {
    test('解析性能基准', async () => {
      const code = `
function testFunction() {
  for (let i = 0; i < 1000; i++) {
    console.log(i);
  }
}

class TestClass {
  constructor() {
    this.data = new Array(1000).fill(0);
  }
  
  processData() {
    return this.data.map(x => x * 2);
  }
}
      `;
      
      const iterations = 10;
      const coreTimes: number[] = [];
      const dynamicTimes: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        // 测试核心服务性能
        const coreStart = performance.now();
        await coreService.parseCode(code, 'javascript');
        const coreTime = performance.now() - coreStart;
        coreTimes.push(coreTime);
        
        // 测试动态管理器性能
        const dynamicStart = performance.now();
        await dynamicManager.parseCode(code, 'javascript');
        const dynamicTime = performance.now() - dynamicStart;
        dynamicTimes.push(dynamicTime);
      }
      
      const coreAvg = coreTimes.reduce((a, b) => a + b, 0) / coreTimes.length;
      const dynamicAvg = dynamicTimes.reduce((a, b) => a + b, 0) / dynamicTimes.length;
      
      console.log(`核心服务平均解析时间: ${coreAvg.toFixed(2)}ms`);
      console.log(`动态管理器平均解析时间: ${dynamicAvg.toFixed(2)}ms`);
      
      // 性能差异应该在可接受范围内
      const performanceDiff = Math.abs(coreAvg - dynamicAvg) / coreAvg;
      expect(performanceDiff).toBeLessThan(1.0); // 允许100%的性能差异
    });

    test('内存使用验证', async () => {
      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }
      
      const initialMemory = process.memoryUsage();
      
      // 创建多个解析实例
      const instances = [];
      for (let i = 0; i < 5; i++) {
        instances.push(new DynamicParserManager(mockCacheService));
      }
      
      // 执行解析操作
      for (const instance of instances) {
        await instance.parseCode('function test() {}', 'javascript');
      }
      
      const afterMemory = process.memoryUsage();
      const memoryIncrease = afterMemory.heapUsed - initialMemory.heapUsed;
      
      console.log(`内存使用增加: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      
      // 内存使用应该在合理范围内
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
    });

    test('缓存性能验证', async () => {
      const code = 'function test() { return "test"; }';
      const iterations = 20;
      
      // 第一次解析（缓存未命中）
      const firstStart = performance.now();
      await coreService.parseCode(code, 'javascript');
      const firstTime = performance.now() - firstStart;
      
      // 后续解析（缓存命中）
      const cacheStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await coreService.parseCode(code, 'javascript');
      }
      const cacheTime = performance.now() - cacheStart;
      
      const avgCacheTime = cacheTime / iterations;
      const speedup = firstTime / avgCacheTime;
      
      console.log(`首次解析时间: ${firstTime.toFixed(2)}ms`);
      console.log(`缓存解析平均时间: ${avgCacheTime.toFixed(4)}ms`);
      console.log(`缓存性能提升: ${speedup.toFixed(1)}x`);
      
      // 缓存应该提供显著的性能提升
      expect(speedup).toBeGreaterThan(2.0);
    });
  });

  describe('错误处理验证', () => {
    test('无效代码处理', async () => {
      const invalidCode = 'function invalid( {';
      
      const coreResult = await coreService.parseCode(invalidCode, 'javascript');
      const dynamicResult = await dynamicManager.parseCode(invalidCode, 'javascript');
      
      // 即使代码无效，解析器也应该能够处理
      expect(coreResult.ast).toBeTruthy();
      expect(dynamicResult.ast).toBeTruthy();
    });

    test('不支持的语言处理', async () => {
      const code = 'some code';
      const unsupportedLanguage = 'unsupported_language';
      
      const coreResult = await coreService.parseCode(code, unsupportedLanguage);
      const dynamicResult = await dynamicManager.parseCode(code, unsupportedLanguage);
      
      expect(coreResult.success).toBe(false);
      expect(dynamicResult.success).toBe(false);
      expect(coreResult.error).toBeTruthy();
      expect(dynamicResult.error).toBeTruthy();
    });

    test('空代码处理', async () => {
      const emptyCode = '';
      
      const coreResult = await coreService.parseCode(emptyCode, 'javascript');
      const dynamicResult = await dynamicManager.parseCode(emptyCode, 'javascript');
      
      expect(coreResult.success).toBe(true);
      expect(dynamicResult.success).toBe(true);
      expect(coreResult.ast).toBeTruthy();
      expect(dynamicResult.ast).toBeTruthy();
    });
  });

  describe('并发处理验证', () => {
    test('并发解析性能', async () => {
      const code = `
function test() {
  return Math.random() > 0.5 ? 'success' : 'failure';
}
      `;
      
      const concurrency = 10;
      const iterations = 5;
      
      const promises = [];
      const startTime = performance.now();
      
      for (let i = 0; i < concurrency; i++) {
        for (let j = 0; j < iterations; j++) {
          promises.push(coreService.parseCode(code, 'javascript'));
          promises.push(dynamicManager.parseCode(code, 'javascript'));
        }
      }
      
      const results = await Promise.all(promises);
      const totalTime = performance.now() - startTime;
      
      // 验证所有解析都成功
      expect(results.every(result => result.success)).toBe(true);
      
      const totalOperations = concurrency * iterations * 2;
      const avgTime = totalTime / totalOperations;
      
      console.log(`并发解析总时间: ${totalTime.toFixed(2)}ms`);
      console.log(`总操作数: ${totalOperations}`);
      console.log(`平均每操作时间: ${avgTime.toFixed(4)}ms`);
      
      // 并发性能应该合理
      expect(avgTime).toBeLessThan(10); // 每操作不超过10ms
    });
  });

  describe('向后兼容性验证', () => {
    test('API接口兼容性', () => {
      // 验证所有公共方法都存在
      expect(typeof coreService.parseCode).toBe('function');
      expect(typeof coreService.parseFile).toBe('function');
      expect(typeof structureService.extractFunctions).toBe('function');
      expect(typeof structureService.extractClasses).toBe('function');
      expect(typeof structureService.extractImports).toBe('function');
      expect(typeof structureService.extractExports).toBe('function');
      expect(typeof coreService.getSupportedLanguages).toBe('function');
      expect(typeof coreService.detectLanguage).toBe('function');
      expect(typeof coreService.isInitialized).toBe('function');
      expect(typeof coreService.getCacheStats).toBe('function');
      expect(typeof coreService.getPerformanceStats).toBe('function');
      expect(typeof coreService.clearCache).toBe('function');
    });

    test('返回值格式兼容性', async () => {
      const code = 'function test() { return "test"; }';
      const result = await coreService.parseCode(code, 'javascript');
      
      // 验证返回值结构
      expect(result).toHaveProperty('ast');
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('parseTime');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('fromCache');
      
      expect(result.language).toHaveProperty('name');
      expect(result.language).toHaveProperty('fileExtensions');
      expect(result.language).toHaveProperty('supported');
    });
  });

  afterAll(() => {
    // 清理资源
    coreService.clearCache();
    dynamicManager.clearCache();
    TreeSitterQueryFacade.clearCache();
  });
});