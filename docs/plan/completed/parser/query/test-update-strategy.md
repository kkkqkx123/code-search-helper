# 测试文件更新策略

## 概述

为了确保重构后的查询系统能够正常工作，需要更新所有相关的测试文件。测试更新策略包括：

1. **保持现有测试的向后兼容性**
2. **添加新的测试用例验证重构功能**
3. **确保性能不受影响**
4. **验证查询结果的正确性**

## 需要更新的测试文件

### 1. SimpleQueryTest.test.ts

```typescript
// src/service/parser/core/__tests__/query/SimpleQueryTest.test.ts (更新后)
import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';
import { QueryRegistry } from '../../query/QueryRegistry';

describe('Simple Query Test (重构后)', () => {
  let treeSitterService: TreeSitterCoreService;

  beforeAll(async () => {
    treeSitterService = new TreeSitterCoreService();
    // 确保查询注册表已初始化
    await QueryRegistry.initialize();
  });

  test('should test JavaScript queries from constants', async () => {
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
}

export const constant = "value";
export function namedFunction() {
  return "named";
}
`;

    const parseResult = await treeSitterService.parseCode(jsCode, 'javascript');
    expect(parseResult.success).toBe(true);

    // 使用新的查询系统
    const functionQuery = await QueryRegistry.getPattern('javascript', 'functions');
    console.log('JavaScript function query:', functionQuery);
    
    if (!functionQuery) {
      throw new Error('Function query pattern is null');
    }
    
    const functionResults = treeSitterService.queryTree(parseResult.ast, functionQuery);
    console.log('Function query results:', functionResults);
    
    const functionCaptures = functionResults.flatMap(r => r.captures).filter(c => c.name === 'function');
    console.log('Function captures count:', functionCaptures.length);
    
    // 测试类查询
    const classQuery = await QueryRegistry.getPattern('javascript', 'classes');
    console.log('JavaScript class query:', classQuery);
    
    if (!classQuery) {
      throw new Error('Class query pattern is null');
    }
    
    const classResults = treeSitterService.queryTree(parseResult.ast, classQuery);
    console.log('Class query results:', classResults);
    
    const classCaptures = classResults.flatMap(r => r.captures).filter(c => c.name === 'class');
    console.log('Class captures count:', classCaptures.length);
    
    // 测试导出查询
    const exportQuery = await QueryRegistry.getPattern('javascript', 'exports');
    console.log('JavaScript export query:', exportQuery);
    
    if (!exportQuery) {
      throw new Error('Export query pattern is null');
    }
    
    const exportResults = treeSitterService.queryTree(parseResult.ast, exportQuery);
    console.log('Export query results:', exportResults);
    
    const exportCaptures = exportResults.flatMap(r => r.captures).filter(c => c.name === 'export');
    console.log('Export captures count:', exportCaptures.length);
    
    expect(functionCaptures.length).toBeGreaterThan(0);
    expect(classCaptures.length).toBeGreaterThan(0);
    expect(exportCaptures.length).toBeGreaterThan(0);
  });

  test('should test TypeScript queries from constants', async () => {
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

    const parseResult = await treeSitterService.parseCode(tsCode, 'typescript');
    expect(parseResult.success).toBe(true);

    // 测试函数查询
    const functionQuery = await QueryRegistry.getPattern('typescript', 'functions');
    console.log('TypeScript function query:', functionQuery);
    
    if (!functionQuery) {
      throw new Error('TypeScript function query pattern is null');
    }
    
    const functionResults = treeSitterService.queryTree(parseResult.ast, functionQuery);
    console.log('Function query results:', functionResults);
    
    const functionCaptures = functionResults.flatMap(r => r.captures).filter(c => c.name === 'function');
    console.log('Function captures count:', functionCaptures.length);
    
    // 测试类查询
    const classQuery = await QueryRegistry.getPattern('typescript', 'classes');
    console.log('TypeScript class query:', classQuery);
    
    if (!classQuery) {
      throw new Error('TypeScript class query pattern is null');
    }
    
    const classResults = treeSitterService.queryTree(parseResult.ast, classQuery);
    console.log('Class query results:', classResults);
    
    const classCaptures = classResults.flatMap(r => r.captures).filter(c => 
      c.name === 'class' || c.name === 'interface'
    );
    console.log('Class/Interface captures count:', classCaptures.length);
    
    expect(functionCaptures.length).toBeGreaterThan(0);
    expect(classCaptures.length).toBeGreaterThan(0);
  });

  // 添加新的测试：验证查询转换的正确性
  test('should validate query transformation correctness', async () => {
    const jsCode = `function test() { return "test"; }`;
    const parseResult = await treeSitterService.parseCode(jsCode, 'javascript');
    
    // 使用新的查询系统
    const newFunctionQuery = await QueryRegistry.getPattern('javascript', 'functions');
    const newResults = treeSitterService.queryTree(parseResult.ast, newFunctionQuery!);
    
    // 验证结果包含预期的捕获
    const functionCaptures = newResults.flatMap(r => r.captures).filter(c => c.name === 'function');
    expect(functionCaptures.length).toBe(1);
    
    // 验证捕获的节点类型正确
    const functionNode = functionCaptures[0].node;
    expect(functionNode.type).toBe('function_declaration');
  });
});
```

### 2. QueryMigration.test.ts

```typescript
// src/service/parser/core/__tests__/query/QueryMigration.test.ts (更新后)
import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';
import { QueryRegistry } from '../../query/QueryRegistry';
import { QueryTransformer } from '../../query/QueryTransformer';

describe('Query Migration Compatibility Tests (重构后)', () => {
  let treeSitterService: TreeSitterCoreService;

  beforeAll(async () => {
    treeSitterService = new TreeSitterCoreService();
    // 确保查询注册表已初始化
    await QueryRegistry.initialize();
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

    test('should produce identical results with new query system', async () => {
      const parseResult = await treeSitterService.parseCode(jsCode, 'javascript');
      expect(parseResult.success).toBe(true);

      // 使用新的查询系统
      const functionQuery = await QueryRegistry.getPattern('javascript', 'functions');
      expect(functionQuery).toBeTruthy();
      
      const queryResults = treeSitterService.queryTree(parseResult.ast, functionQuery!);
      
      // 验证结果包含预期的函数
      const functionCaptures = queryResults.flatMap(r => r.captures).filter(c => c.name === 'function');
      expect(functionCaptures.length).toBeGreaterThan(0);
      
      // 验证捕获的节点类型
      const functionTypes = new Set(functionCaptures.map(c => c.node.type));
      expect(functionTypes).toContain('function_declaration');
    });

    test('should extract classes correctly', async () => {
      const parseResult = await treeSitterService.parseCode(jsCode, 'javascript');
      expect(parseResult.success).toBe(true);

      const classQuery = await QueryRegistry.getPattern('javascript', 'classes');
      expect(classQuery).toBeTruthy();
      
      const queryResults = treeSitterService.queryTree(parseResult.ast, classQuery!);
      
      const classCaptures = queryResults.flatMap(r => r.captures).filter(c => c.name === 'class');
      expect(classCaptures.length).toBeGreaterThan(0);
      
      const classTypes = new Set(classCaptures.map(c => c.node.type));
      expect(classTypes).toContain('class_declaration');
    });
  });

  describe('Query Transformer Validation', () => {
    test('should extract function patterns from full query', async () => {
      const fullQuery = await QueryRegistry.getPattern('javascript', 'functions');
      expect(fullQuery).toBeTruthy();
      
      // 验证查询包含必要的模式
      expect(fullQuery).toContain('function_declaration');
      expect(fullQuery).toContain('arrow_function');
      expect(fullQuery).toContain('function_expression');
    });

    test('should extract class patterns from full query', async () => {
      const fullQuery = await QueryRegistry.getPattern('javascript', 'classes');
      expect(fullQuery).toBeTruthy();
      
      expect(fullQuery).toContain('class_declaration');
    });

    test('should support all required pattern types', async () => {
      const patternTypes = QueryTransformer.getSupportedPatternTypesForLanguage('javascript');
      expect(patternTypes).toContain('functions');
      expect(patternTypes).toContain('classes');
      expect(patternTypes).toContain('imports');
      expect(patternTypes).toContain('exports');
      expect(patternTypes).toContain('methods');
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

    test('new query system should perform reasonably', async () => {
      const parseResult = await treeSitterService.parseCode(largeJsCode, 'javascript');
      expect(parseResult.success).toBe(true);

      // 测试新查询系统性能
      const functionQuery = await QueryRegistry.getPattern('javascript', 'functions');
      expect(functionQuery).toBeTruthy();
      
      const startTime = performance.now();
      const queryResults = treeSitterService.queryTree(parseResult.ast, functionQuery!);
      const queryTime = performance.now() - startTime;

      // 验证性能在合理范围内
      expect(queryTime).toBeLessThan(1000); // 应该在1秒内完成
      expect(queryResults.length).toBeGreaterThan(0);
      
      console.log(`New query system execution time: ${queryTime.toFixed(2)}ms`);
    });
  });
});
```

### 3. 新增 QueryTransformer 测试

```typescript
// src/service/parser/core/__tests__/query/QueryTransformer.test.ts
import { QueryTransformer } from '../../query/QueryTransformer';
import { QueryLoader } from '../../query/QueryLoader';

describe('QueryTransformer', () => {
  beforeAll(async () => {
    QueryTransformer.initialize();
    // 预加载JavaScript查询用于测试
    await QueryLoader.loadLanguageQueries('javascript');
  });

  beforeEach(() => {
    QueryTransformer.clearCache();
  });

  test('should extract function patterns from JavaScript query', async () => {
    const fullQuery = QueryLoader.getQuery('javascript');
    const functionPattern = QueryTransformer.extractPatternType(fullQuery, 'functions', 'javascript');
    
    expect(functionPattern).toBeTruthy();
    expect(functionPattern).toContain('function_declaration');
    expect(functionPattern).toContain('arrow_function');
    expect(functionPattern).toContain('function_expression');
    expect(functionPattern).not.toContain('class_declaration');
  });

  test('should extract class patterns from JavaScript query', async () => {
    const fullQuery = QueryLoader.getQuery('javascript');
    const classPattern = QueryTransformer.extractPatternType(fullQuery, 'classes', 'javascript');
    
    expect(classPattern).toBeTruthy();
    expect(classPattern).toContain('class_declaration');
    expect(classPattern).not.toContain('function_declaration');
  });

  test('should cache extracted patterns', async () => {
    const fullQuery = QueryLoader.getQuery('javascript');
    
    const result1 = QueryTransformer.extractPatternType(fullQuery, 'functions', 'javascript');
    const result2 = QueryTransformer.extractPatternType(fullQuery, 'functions', 'javascript');
    
    // 应该返回相同的引用（缓存）
    expect(result1).toBe(result2);
    
    const stats = QueryTransformer.getCacheStats();
    expect(stats.languageStats.javascript).toBe(1);
  });

  test('should return empty string for unsupported pattern type', async () => {
    const fullQuery = QueryLoader.getQuery('javascript');
    const result = QueryTransformer.extractPatternType(fullQuery, 'nonexistent', 'javascript');
    
    expect(result).toBe('');
  });

  test('should get supported pattern types for language', () => {
    const types = QueryTransformer.getSupportedPatternTypesForLanguage('javascript');
    
    expect(types).toContain('functions');
    expect(types).toContain('classes');
    expect(types).toContain('imports');
    expect(types).toContain('exports');
  });

  test('should clear cache correctly', async () => {
    const fullQuery = QueryLoader.getQuery('javascript');
    
    QueryTransformer.extractPatternType(fullQuery, 'functions', 'javascript');
    
    let stats = QueryTransformer.getCacheStats();
    expect(stats.totalQueries).toBe(1);
    
    QueryTransformer.clearCache();
    
    stats = QueryTransformer.getCacheStats();
    expect(stats.totalQueries).toBe(0);
  });
});
```

### 4. 新增 QueryRegistry 测试

```typescript
// src/service/parser/core/__tests__/query/QueryRegistry.test.ts
import { QueryRegistry } from '../../query/QueryRegistry';

describe('QueryRegistry (重构后)', () => {
  beforeAll(async () => {
    await QueryRegistry.initialize();
  });

  test('should initialize successfully', async () => {
    const stats = QueryRegistry.getStats();
    expect(stats.initialized).toBe(true);
    expect(stats.totalLanguages).toBeGreaterThan(0);
  });

  test('should load queries for JavaScript', async () => {
    const functionQuery = await QueryRegistry.getPattern('javascript', 'functions');
    expect(functionQuery).toBeTruthy();
    expect(functionQuery).toContain('function_declaration');
    
    const classQuery = await QueryRegistry.getPattern('javascript', 'classes');
    expect(classQuery).toBeTruthy();
    expect(classQuery).toContain('class_declaration');
  });

  test('should support sync pattern retrieval', () => {
    const functionQuery = QueryRegistry.getPatternSync('javascript', 'functions');
    expect(functionQuery).toBeTruthy();
  });

  test('should return null for unsupported language', async () => {
    const query = await QueryRegistry.getPattern('nonexistent', 'functions');
    expect(query).toBeNull();
  });

  test('should return null for unsupported pattern type', async () => {
    const query = await QueryRegistry.getPattern('javascript', 'nonexistent');
    expect(query).toBeNull();
  });

  test('should get patterns for language', () => {
    const patterns = QueryRegistry.getPatternsForLanguage('javascript');
    expect(patterns).toHaveProperty('functions');
    expect(patterns).toHaveProperty('classes');
    expect(patterns.functions).toContain('function_declaration');
  });

  test('should get supported languages', () => {
    const languages = QueryRegistry.getSupportedLanguages();
    expect(languages).toContain('javascript');
    expect(languages).toContain('typescript');
    expect(languages).toContain('python');
  });

  test('should get query types for language', () => {
    const queryTypes = QueryRegistry.getQueryTypesForLanguage('javascript');
    expect(queryTypes).toContain('functions');
    expect(queryTypes).toContain('classes');
  });

  test('should check if language and pattern are supported', () => {
    expect(QueryRegistry.isSupported('javascript')).toBe(true);
    expect(QueryRegistry.isSupported('javascript', 'functions')).toBe(true);
    expect(QueryRegistry.isSupported('nonexistent')).toBe(false);
    expect(QueryRegistry.isSupported('javascript', 'nonexistent')).toBe(false);
  });

  test('should reload language queries', async () => {
    const originalQuery = await QueryRegistry.getPattern('javascript', 'functions');
    await QueryRegistry.reloadLanguageQueries('javascript');
    const reloadedQuery = await QueryRegistry.getPattern('javascript', 'functions');
    
    expect(reloadedQuery).toBeTruthy();
    // 查询内容应该相同（除非文件被修改）
    expect(reloadedQuery).toBe(originalQuery);
  });
});
```

## 测试执行策略

### 1. 分阶段测试

1. **单元测试**：首先运行 QueryTransformer 和 QueryRegistry 的单元测试
2. **集成测试**：然后运行查询迁移和兼容性测试
3. **端到端测试**：最后运行完整的解析流程测试

### 2. 性能基准测试

```typescript
// src/service/parser/core/__tests__/query/QueryPerformance.test.ts
describe('Query Performance Tests', () => {
  test('should maintain performance with new query system', async () => {
    // 性能基准测试代码
  });
});
```

### 3. 回归测试

确保所有现有测试仍然通过，特别是：

- [`BasicQueryTest.test.ts`](src/service/parser/core/__tests__/query/BasicQueryTest.test.ts)
- [`TreeSitterQueryEngine.test.ts`](src/service/parser/core/__tests__/query/TreeSitterQueryEngine.test.ts)
- [`ExportQueryTest.test.ts`](src/service/parser/core/__tests__/query/ExportQueryTest.test.ts)

## 测试覆盖率目标

- QueryTransformer: 90%+
- QueryRegistry: 95%+
- 集成测试: 85%+
- 端到端测试: 80%+

## 测试数据准备

为测试准备各种语言的代码样本：

- JavaScript/TypeScript 函数、类、接口
- Python 函数、类、装饰器
- Java 类、接口、方法
- 其他支持的语言样本

通过这种全面的测试策略，可以确保重构后的查询系统在功能、性能和兼容性方面都达到预期标准。