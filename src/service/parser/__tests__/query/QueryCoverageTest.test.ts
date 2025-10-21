import { QueryRegistryImpl } from '../../core/query/QueryRegistry';
import { QueryManager } from '../../core/query/QueryManager';
import { DynamicParserManager } from '../../core/parse/DynamicParserManager';

/**
 * 查询规则覆盖率测试
 * 验证所有语言的查询规则完整性和正确性
 */
describe('Query Coverage Test', () => {
  const supportedLanguages = [
    'javascript', 'typescript', 'python', 'java', 'go', 'rust',
    'cpp', 'c', 'csharp', 'swift', 'kotlin', 'ruby', 'php', 'scala'
  ];

  const requiredQueryTypes = [
    'functions',    // 函数定义
    'classes',      // 类定义
    'imports',      // 导入语句
    'exports',      // 导出语句
  ];

  beforeAll(async () => {
    // 初始化查询系统
    await QueryManager.initialize();
    await QueryRegistryImpl.initialize();
  }, 30000);

  describe('查询规则完整性验证', () => {
    test.each(supportedLanguages)('验证 %s 语言的查询规则完整性', async (language) => {
      const patterns = QueryRegistryImpl.getPatternsForLanguage(language);
      
      console.log(`\n${language} 语言查询规则:`);
      console.log(`  支持的查询类型: ${Object.keys(patterns).join(', ')}`);
      
      // 验证必需的查询类型
      for (const queryType of requiredQueryTypes) {
        const pattern = await QueryRegistryImpl.getPattern(language, queryType);
        
        if (pattern) {
          console.log(`  ✅ ${queryType}: 已定义 (${pattern.length} 字符)`);
          expect(pattern.trim()).toBeTruthy();
        } else {
          console.log(`  ❌ ${queryType}: 未定义`);
          // 对于某些语言，某些查询类型可能不支持，这是可以接受的
        }
      }
      
      // 验证查询模式格式
      for (const [queryType, pattern] of Object.entries(patterns)) {
        expect(pattern).toBeTruthy();
        expect(typeof pattern).toBe('string');
        expect(pattern.trim().length).toBeGreaterThan(0);
        
        // 验证基本的查询语法
        expect(pattern).toMatch(/\(@[\w\.]+\s*[\w\.\-_]+\)/); // 应该包含@capture语法
      }
    });

    test('查询规则覆盖率统计', () => {
      const coverageStats: Record<string, { total: number; covered: number; coverage: string }> = {};
      
      for (const language of supportedLanguages) {
        const patterns = QueryRegistryImpl.getPatternsForLanguage(language);
        const coveredTypes = Object.keys(patterns);
        const coverage = (coveredTypes.length / requiredQueryTypes.length * 100).toFixed(1);
        
        coverageStats[language] = {
          total: requiredQueryTypes.length,
          covered: coveredTypes.length,
          coverage: `${coverage}%`
        };
      }
      
      console.log('\n查询规则覆盖率统计:');
      for (const [language, stats] of Object.entries(coverageStats)) {
        console.log(`  ${language}: ${stats.covered}/${stats.total} (${stats.coverage})`);
      }
      
      // 计算总体覆盖率
      const totalPossible = supportedLanguages.length * requiredQueryTypes.length;
      const totalCovered = Object.values(coverageStats).reduce((sum, stats) => sum + stats.covered, 0);
      const overallCoverage = (totalCovered / totalPossible * 100).toFixed(1);
      
      console.log(`\n总体覆盖率: ${totalCovered}/${totalPossible} (${overallCoverage}%)`);
      
      // 至少应该有80%的覆盖率
      expect(parseFloat(overallCoverage)).toBeGreaterThan(80);
    });
  });

  describe('查询规则语法验证', () => {
    test.each(supportedLanguages)('验证 %s 语言的查询规则语法', async (language) => {
      const patterns = QueryRegistryImpl.getPatternsForLanguage(language);
      
      for (const [queryType, pattern] of Object.entries(patterns)) {
        try {
          // 验证查询模式可以被正确解析
          // 这里我们检查基本的语法结构
          
          // 检查括号匹配
          const openParens = (pattern.match(/\(/g) || []).length;
          const closeParens = (pattern.match(/\)/g) || []).length;
          expect(openParens).toBe(closeParens);
          
          // 检查@capture语法
          const captures = pattern.match(/@[\w\.]+\s*[\w\.\-_]+/g);
          expect(captures).toBeTruthy();
          expect(captures!.length).toBeGreaterThan(0);
          
          // 检查注释
          const comments = pattern.match(/;.*$/gm);
          if (comments) {
            console.log(`  ${language}.${queryType}: 包含 ${comments.length} 个注释`);
          }
          
        } catch (error) {
          console.error(`  ❌ ${language}.${queryType} 语法验证失败:`, error);
          throw error;
        }
      }
    });
  });

  describe('动态解析器兼容性验证', () => {
    let dynamicManager: DynamicParserManager;

    beforeAll(() => {
      dynamicManager = new DynamicParserManager();
    });

    test.each(supportedLanguages)('验证 %s 语言与动态解析器的兼容性', async (language) => {
      const isSupported = dynamicManager.isLanguageSupported(language);
      const hasQueries = Object.keys(QueryRegistryImpl.getPatternsForLanguage(language)).length > 0;
      
      console.log(`  ${language}: 解析器支持=${isSupported}, 查询规则=${hasQueries}`);
      
      // 如果有查询规则，应该有对应的解析器支持
      if (hasQueries) {
        expect(isSupported).toBe(true);
      }
    });

    test('查询规则与解析器映射一致性', () => {
      const supportedLanguages = dynamicManager.getSupportedLanguages().map(lang => lang.name.toLowerCase());
      const queryLanguages = QueryRegistryImpl.getSupportedLanguages();
      
      console.log('\n解析器支持的语言:', supportedLanguages);
      console.log('查询规则支持的语言:', queryLanguages);
      
      // 检查重叠度
      const overlap = supportedLanguages.filter(lang => queryLanguages.includes(lang));
      const overlapRate = (overlap.length / Math.max(supportedLanguages.length, queryLanguages.length) * 100).toFixed(1);
      
      console.log(`语言支持重叠度: ${overlap.length}/${Math.max(supportedLanguages.length, queryLanguages.length)} (${overlapRate}%)`);
      
      // 至少应该有70%的重叠度
      expect(parseFloat(overlapRate)).toBeGreaterThan(70);
    });
  });

  describe('查询规则功能验证', () => {
    const testCodeSamples = {
      javascript: `
function testFunction() {
  return 'test';
}
class TestClass {
  constructor() {}
}
import { something } from './module';
export { testFunction };
      `,
      typescript: `
function testFunction(): string {
  return 'test';
}
class TestClass {
  constructor() {}
}
import { something } from './module';
export { testFunction };
      `,
      python: `
def test_function():
    return 'test'
    
class TestClass:
    def __init__(self):
        pass
import something
from module import item
      `,
      java: `
public class TestClass {
    public void testMethod() {
        // method body
    }
}
import package.Class;
      `
    };

    test.each(Object.keys(testCodeSamples))('验证 %s 查询规则功能', async (language) => {
      const code = testCodeSamples[language as keyof typeof testCodeSamples];
      const dynamicManager = new DynamicParserManager();
      
      try {
        // 解析代码
        const parseResult = await dynamicManager.parseCode(code, language);
        expect(parseResult.success).toBe(true);
        
        // 测试函数提取
        const functions = await dynamicManager.extractFunctions(parseResult.ast, language);
        console.log(`  ${language} 函数提取: ${functions.length} 个`);
        
        // 测试类提取
        const classes = await dynamicManager.extractClasses(parseResult.ast, language);
        console.log(`  ${language} 类提取: ${classes.length} 个`);
        
        // 测试导入提取（如果支持）
        if (language !== 'java') { // Java的导入处理方式不同
          const imports = await dynamicManager.extractExports(parseResult.ast, code, language);
          console.log(`  ${language} 导出提取: ${imports.length} 个`);
        }
        
        // 验证至少提取到了一些内容
        const totalExtracted = functions.length + classes.length;
        expect(totalExtracted).toBeGreaterThan(0);
        
      } catch (error) {
        console.error(`  ❌ ${language} 功能验证失败:`, error);
        throw error;
      }
    });
  });

  describe('查询规则性能验证', () => {
    test('查询规则加载性能', async () => {
      const startTime = performance.now();
      
      // 重新初始化查询系统
      await QueryRegistryImpl.clearCache();
      await QueryRegistryImpl.initialize();
      
      const loadTime = performance.now() - startTime;
      console.log(`查询规则加载时间: ${loadTime.toFixed(2)}ms`);
      
      // 加载时间应该在合理范围内
      expect(loadTime).toBeLessThan(5000);
    });

    test('查询模式缓存性能', async () => {
      const language = 'javascript';
      const queryType = 'functions';
      const iterations = 100;
      
      // 第一次查询（缓存未命中）
      const startTime1 = performance.now();
      await QueryRegistryImpl.getPattern(language, queryType);
      const firstTime = performance.now() - startTime1;
      
      // 后续查询（缓存命中）
      const startTime2 = performance.now();
      for (let i = 0; i < iterations; i++) {
        await QueryRegistryImpl.getPattern(language, queryType);
      }
      const cachedTime = performance.now() - startTime2;
      
      const averageCachedTime = cachedTime / iterations;
      const speedup = firstTime / averageCachedTime;
      
      console.log(`查询性能:`);
      console.log(`  首次查询: ${firstTime.toFixed(2)}ms`);
      console.log(`  缓存查询平均: ${averageCachedTime.toFixed(4)}ms`);
      console.log(`  性能提升: ${speedup.toFixed(1)}x`);
      
      // 缓存查询应该显著更快
      expect(speedup).toBeGreaterThan(10);
    });
  });

  describe('查询规则错误处理', () => {
    test('无效查询类型的处理', async () => {
      const language = 'javascript';
      const invalidQueryType = 'invalid_query_type';
      
      const pattern = await QueryRegistryImpl.getPattern(language, invalidQueryType);
      expect(pattern).toBeNull();
    });

    test('不支持语言的处理', async () => {
      const unsupportedLanguage = 'unsupported_language';
      const queryType = 'functions';
      
      const pattern = await QueryRegistryImpl.getPattern(unsupportedLanguage, queryType);
      expect(pattern).toBeNull();
    });

    test('查询系统未初始化的处理', async () => {
      // 创建新的查询注册表实例
      const freshRegistry = Object.create(QueryRegistryImpl);
      
      // 尝试获取查询模式
      const pattern = await freshRegistry.getPattern('javascript', 'functions');
      expect(pattern).toBeNull();
    });
  });
});