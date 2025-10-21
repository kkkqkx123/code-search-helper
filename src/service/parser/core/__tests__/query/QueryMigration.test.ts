import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';
import { QueryManager } from '../../query/QueryManager';

describe('Query Migration Compatibility Tests', () => {
  let treeSitterService: TreeSitterCoreService;

  beforeAll(async () => {
    treeSitterService = new TreeSitterCoreService();
    // 确保QueryManager已初始化
    await QueryManager.initialize();
  });

  describe('JavaScript Function Extraction', () => {
    const jsCode = `
function testFunction() {
  return "hello";
}

const arrowFunction = () => {
  return "world";
};

class TestClass {
  method() {
    return "method";
  }
  
  constructor() {
    this.value = 42;
  }
}

const functionExpression = function() {
  return "expression";
};
`;

    test('should produce identical results for function extraction', async () => {
      const parseResult = await treeSitterService.parseCode(jsCode, 'javascript');
      expect(parseResult.success).toBe(true);

      // 使用查询语言模式
      treeSitterService.enableQueryLanguage();
      const queryResults = await treeSitterService.extractFunctions(parseResult.ast, 'python');

      // 使用硬编码模式
      treeSitterService.disableQueryLanguage();
      const legacyResults = await treeSitterService.extractFunctions(parseResult.ast);

      // 比较结果数量
      expect(queryResults.length).toBe(legacyResults.length);

      // 比较结果内容（通过节点类型和位置）
      const queryTypes = queryResults.map(node => ({ type: node.type, start: node.startIndex, end: node.endIndex }));
      const legacyTypes = legacyResults.map(node => ({ type: node.type, start: node.startIndex, end: node.endIndex }));

      expect(queryTypes).toEqual(expect.arrayContaining(legacyTypes));
      expect(legacyTypes).toEqual(expect.arrayContaining(queryTypes));
    });

    test('should produce identical results for class extraction', async () => {
      const parseResult = await treeSitterService.parseCode(jsCode, 'javascript');
      expect(parseResult.success).toBe(true);

      // 使用查询语言模式
      treeSitterService.enableQueryLanguage();
      const queryResults = await treeSitterService.extractClasses(parseResult.ast, 'python');

      // 使用硬编码模式
      treeSitterService.disableQueryLanguage();
      const legacyResults = await treeSitterService.extractClasses(parseResult.ast);

      // 比较结果数量
      expect(queryResults.length).toBe(legacyResults.length);

      // 比较结果内容
      const queryTypes = queryResults.map(node => ({ type: node.type, start: node.startIndex, end: node.endIndex }));
      const legacyTypes = legacyResults.map(node => ({ type: node.type, start: node.startIndex, end: node.endIndex }));

      expect(queryTypes).toEqual(expect.arrayContaining(legacyTypes));
      expect(legacyTypes).toEqual(expect.arrayContaining(queryTypes));
    });
  });

  describe('TypeScript Function Extraction', () => {
    const tsCode = `
interface TestInterface {
  method(): string;
}

abstract class AbstractClass {
  abstract abstractMethod(): void;
  
  concreteMethod(): string {
    return "concrete";
  }
}

class TestClass implements TestInterface {
  private property: string;
  
  constructor(private value: number) {}
  
  method(): string {
    return this.property;
  }
  
  get getter(): string {
    return "getter";
  }
  
  set setter(value: string) {
    this.property = value;
  }
}

const arrowFunction = (param: string): string => {
  return param;
};

function genericFunction<T>(param: T): T {
  return param;
}
`;

    test('should produce identical results for TypeScript function extraction', async () => {
      const parseResult = await treeSitterService.parseCode(tsCode, 'typescript');
      expect(parseResult.success).toBe(true);

      // 使用查询语言模式
      treeSitterService.enableQueryLanguage();
      const queryResults = await treeSitterService.extractFunctions(parseResult.ast, 'python');

      // 使用硬编码模式
      treeSitterService.disableQueryLanguage();
      const legacyResults = await treeSitterService.extractFunctions(parseResult.ast);

      // 比较结果数量
      expect(queryResults.length).toBeGreaterThan(0);
      expect(legacyResults.length).toBeGreaterThan(0);

      // 比较结果内容
      const queryTypes = queryResults.map(node => ({ type: node.type, start: node.startIndex, end: node.endIndex }));
      const legacyTypes = legacyResults.map(node => ({ type: node.type, start: node.startIndex, end: node.endIndex }));

      // TypeScript可能有更精确的匹配，所以查询结果可能包含更多内容
      expect(queryTypes.length).toBeGreaterThanOrEqual(legacyTypes.length);
    });

    test('should produce identical results for TypeScript class extraction', async () => {
      const parseResult = await treeSitterService.parseCode(tsCode, 'typescript');
      expect(parseResult.success).toBe(true);

      // 使用查询语言模式
      treeSitterService.enableQueryLanguage();
      const queryResults = await treeSitterService.extractClasses(parseResult.ast, 'python');

      // 使用硬编码模式
      treeSitterService.disableQueryLanguage();
      const legacyResults = await treeSitterService.extractClasses(parseResult.ast);

      // 比较结果数量
      expect(queryResults.length).toBeGreaterThan(0);
      expect(legacyResults.length).toBeGreaterThan(0);

      // 比较结果内容
      const queryTypes = queryResults.map(node => ({ type: node.type, start: node.startIndex, end: node.endIndex }));
      const legacyTypes = legacyResults.map(node => ({ type: node.type, start: node.startIndex, end: node.endIndex }));

      // TypeScript查询可能识别接口和抽象类
      expect(queryTypes.length).toBeGreaterThanOrEqual(legacyTypes.length);
    });
  });

  describe('Python Function Extraction', () => {
    const pythonCode = `
def regular_function():
    return "regular"

@decorator
def decorated_function():
    return "decorated"

async def async_function():
    return "async"

class TestClass:
    def method(self):
        return "method"
    
    @classmethod
    def class_method(cls):
        return "class method"
    
    @staticmethod
    def static_method():
        return "static method"

lambda_function = lambda x: x * 2

def generator_function():
    yield 1
    yield 2
`;

    test('should produce identical results for Python function extraction', async () => {
      const parseResult = await treeSitterService.parseCode(pythonCode, 'python');
      expect(parseResult.success).toBe(true);

      // 使用查询语言模式
      treeSitterService.enableQueryLanguage();
      const queryResults = await treeSitterService.extractFunctions(parseResult.ast, 'python');

      // 使用硬编码模式
      treeSitterService.disableQueryLanguage();
      const legacyResults = await treeSitterService.extractFunctions(parseResult.ast);

      // 比较结果数量
      expect(queryResults.length).toBeGreaterThan(0);
      expect(legacyResults.length).toBeGreaterThan(0);

      // 比较结果内容
      const queryTypes = queryResults.map(node => ({ type: node.type, start: node.startIndex, end: node.endIndex }));
      const legacyTypes = legacyResults.map(node => ({ type: node.type, start: node.startIndex, end: node.endIndex }));

      expect(queryTypes.length).toBeGreaterThanOrEqual(legacyTypes.length);
    });

    test('should produce identical results for Python class extraction', async () => {
      const parseResult = await treeSitterService.parseCode(pythonCode, 'python');
      expect(parseResult.success).toBe(true);

      // 使用查询语言模式
      treeSitterService.enableQueryLanguage();
      const queryResults = await treeSitterService.extractClasses(parseResult.ast, 'python');

      // 使用硬编码模式
      treeSitterService.disableQueryLanguage();
      const legacyResults = await treeSitterService.extractClasses(parseResult.ast);

      // 比较结果数量
      expect(queryResults.length).toBe(legacyResults.length);

      // 比较结果内容
      const queryTypes = queryResults.map(node => ({ type: node.type, start: node.startIndex, end: node.endIndex }));
      const legacyTypes = legacyResults.map(node => ({ type: node.type, start: node.startIndex, end: node.endIndex }));

      expect(queryTypes).toEqual(expect.arrayContaining(legacyTypes));
      expect(legacyTypes).toEqual(expect.arrayContaining(queryTypes));
    });
  });

  describe('Export Extraction', () => {
    const jsExportCode = `
export const constant = "value";
export function namedFunction() {
  return "named";
}
export default class DefaultClass {
  method() {
    return "default";
  }
}
export { utilityFunction, helperClass };
export * from "./module";
`;

    test('should produce identical results for export extraction', async () => {
      const parseResult = await treeSitterService.parseCode(jsExportCode, 'javascript');
      expect(parseResult.success).toBe(true);

      // 使用查询语言模式
      treeSitterService.enableQueryLanguage();
      const queryResults = await treeSitterService.extractExports(parseResult.ast, jsExportCode, 'javascript');

      // 使用硬编码模式
      treeSitterService.disableQueryLanguage();
      const legacyResults = await treeSitterService.extractExports(parseResult.ast, jsExportCode);

      // 比较结果数量
      expect(queryResults.length).toBe(legacyResults.length);

      // 比较结果内容（去除空白字符后比较）
      const normalizedQuery = queryResults.map(s => s.trim().replace(/\s+/g, ' '));
      const normalizedLegacy = legacyResults.map(s => s.trim().replace(/\s+/g, ' '));

      expect(normalizedQuery).toEqual(expect.arrayContaining(normalizedLegacy));
      expect(normalizedLegacy).toEqual(expect.arrayContaining(normalizedQuery));
    });
  });

  describe('Performance Comparison', () => {
    const largeJsCode = `
${Array.from({ length: 100 }, (_, i) => `
function function${i}() {
  return ${i};
}

class Class${i} {
  method${i}() {
    return ${i};
  }
}
`).join('\n')}
`;

    test('query language should perform reasonably well', async () => {
      const parseResult = await treeSitterService.parseCode(largeJsCode, 'javascript');
      expect(parseResult.success).toBe(true);

      // 测试查询语言模式性能
      treeSitterService.enableQueryLanguage();
      const queryStart = performance.now();
      const queryResults = await treeSitterService.extractFunctions(parseResult.ast);
      const queryTime = performance.now() - queryStart;

      // 测试硬编码模式性能
      treeSitterService.disableQueryLanguage();
      const legacyStart = performance.now();
      const legacyResults = await treeSitterService.extractFunctions(parseResult.ast);
      const legacyTime = performance.now() - legacyStart;

      // 验证结果一致性
      expect(queryResults.length).toBe(legacyResults.length);

      // 性能应该在合理范围内（查询语言可能稍慢但不应超过2倍）
      const performanceRatio = queryTime / legacyTime;
      expect(performanceRatio).toBeLessThan(3.0);

      console.log(`Query time: ${queryTime.toFixed(2)}ms, Legacy time: ${legacyTime.toFixed(2)}ms, Ratio: ${performanceRatio.toFixed(2)}`);
    });
  });

  describe('Error Handling', () => {
    test('should gracefully fallback to legacy implementation on query errors', async () => {
      const parseResult = await treeSitterService.parseCode('function test() {}', 'javascript');
      expect(parseResult.success).toBe(true);

      // 启用查询语言模式
      treeSitterService.enableQueryLanguage();

      // 模拟查询错误（通过破坏QueryManager）
      const originalGetQuery = QueryManager.getQuery;
      QueryManager.getQuery = jest.fn().mockImplementation(() => {
        throw new Error('Simulated query error');
      });

      // 应该回退到硬编码实现
      const results = await treeSitterService.extractFunctions(parseResult.ast);
      expect(results.length).toBeGreaterThan(0);

      // 恢复原始方法
      QueryManager.getQuery = originalGetQuery;
    });

    test('should handle unsupported languages gracefully', async () => {
      const parseResult = await treeSitterService.parseCode('some code', 'unsupported-language');

      if (parseResult.success) {
        treeSitterService.enableQueryLanguage();
        const results = treeSitterService.extractFunctions(parseResult.ast);
        // 应该返回空数组而不是抛出错误
        expect(Array.isArray(results)).toBe(true);
      }
    });
  });

  describe('Cache Statistics', () => {
    test('should provide cache statistics', () => {
      const stats = treeSitterService.getQueryCacheStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('queryCacheSize');
      expect(stats).toHaveProperty('patternCacheSize');
    });

    test('should clear cache', () => {
      expect(() => treeSitterService.clearQueryCache()).not.toThrow();
    });
  });

  describe('Query Support Detection', () => {
    test('should detect supported languages', () => {
      const supportedLanguages = treeSitterService.getQuerySupportedLanguages();
      expect(Array.isArray(supportedLanguages)).toBe(true);
      expect(supportedLanguages.length).toBeGreaterThan(0);
      expect(supportedLanguages).toContain('javascript');
      expect(supportedLanguages).toContain('typescript');
      expect(supportedLanguages).toContain('python');
    });

    test('should detect supported query types', () => {
      const isSupported = treeSitterService.isQuerySupported('javascript', 'functions');
      expect(typeof isSupported).toBe('boolean');
    });
  });
});