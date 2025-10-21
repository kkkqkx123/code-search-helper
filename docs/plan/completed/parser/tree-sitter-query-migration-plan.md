# Tree-sitter查询语言迁移实施计划

## 📋 实施概述

本计划详细描述了将现有硬编码类型匹配迁移到Tree-sitter查询语言的具体步骤、时间安排和资源需求。

## 🎯 迁移目标

1. **功能完整性**: 100%覆盖现有extract功能
2. **性能提升**: 查询速度提升2倍以上
3. **代码精简**: 减少60%的相关代码量
4. **零回归**: 确保现有功能不受影响

## 📅 阶段划分

### 阶段一：基础设施准备（3-5天）

#### 任务1.1：创建查询管理器
```typescript
// src/service/parser/core/query/QueryManager.ts
export class QueryManager {
  private static queryCache = new Map<string, Parser.Query>();
  private static patternCache = new Map<string, string>();
  
  static async initialize(): Promise<void> {
    // 预加载主要语言的查询
    await this.loadLanguageQueries(['javascript', 'typescript', 'python', 'java']);
  }
  
  static getQuery(language: string, queryType: string): Parser.Query {
    const cacheKey = `${language}:${queryType}`;
    // ... 实现查询获取和缓存
  }
}
```

#### 任务1.2：建立查询注册表
```typescript
// src/service/parser/core/query/QueryRegistry.ts
export const QueryRegistry = {
  javascript: {
    functions: `
      (function_declaration) @function
      (method_definition) @method
      (arrow_function) @arrow_function
    `,
    classes: `(class_declaration) @class`,
    imports: `(import_statement) @import`
  },
  // ... 其他语言
};
```

#### 任务1.3：测试框架搭建
```typescript
// src/service/parser/__tests__/query/QueryMigration.test.ts
describe('Query Migration Compatibility', () => {
  test('should produce identical results for JavaScript functions', async () => {
    const code = `function test() {}; class Test {}`;
    const oldResults = oldExtractFunctions(parse(code));
    const newResults = await newQueryManager.extract('functions', code, 'javascript');
    expect(newResults).toEqual(oldResults);
  });
});
```

### 阶段二：核心功能迁移（5-7天）

#### 任务2.1：迁移extractFunctions方法
```typescript
// 修改 TreeSitterCoreService.ts
extractFunctions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
  // 使用查询语言实现
  const language = this.detectLanguageFromAST(ast);
  const query = QueryManager.getQuery(language, 'functions');
  const results = query.matches(ast);
  
  return results.map(match => 
    match.captures.find(cap => cap.name === 'function')?.node
  ).filter(Boolean);
}
```

#### 任务2.2：迁移extractClasses方法
```typescript
extractClasses(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
  const language = this.detectLanguageFromAST(ast);
  const query = QueryManager.getQuery(language, 'classes');
  const results = query.matches(ast);
  
  return results.map(match => 
    match.captures.find(cap => cap.name === 'class')?.node
  ).filter(Boolean);
}
```

#### 任务2.3：实现混合模式运行
```typescript
private useQueryLanguage: boolean = true;

extractFunctions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
  if (this.useQueryLanguage) {
    try {
      return this.extractWithQuery(ast, 'functions');
    } catch (error) {
      // 查询失败时回退到旧实现
      this.logger.warn('Query failed, falling back to legacy implementation');
      this.useQueryLanguage = false;
      return this.legacyExtractFunctions(ast);
    }
  } else {
    return this.legacyExtractFunctions(ast);
  }
}
```

### 阶段三：性能优化（3-4天）

#### 任务3.1：查询缓存优化
```typescript
// 增强的缓存策略
static getQuery(language: string, queryType: string): Parser.Query {
  const cacheKey = `${language}:${queryType}`;
  
  if (this.queryCache.has(cacheKey)) {
    this.cacheStats.hits++;
    return this.queryCache.get(cacheKey)!;
  }
  
  const pattern = this.getQueryPattern(language, queryType);
  const parser = this.getParserForLanguage(language);
  const query = new Parser.Query(parser.getLanguage(), pattern);
  
  this.queryCache.set(cacheKey, query);
  this.cacheStats.misses++;
  
  return query;
}
```

#### 任务3.2：批量查询支持
```typescript
async extractMultiple(
  ast: Parser.SyntaxNode, 
  types: string[]
): Promise<Map<string, Parser.SyntaxNode[]>> {
  const language = this.detectLanguageFromAST(ast);
  const combinedPattern = this.combinePatterns(language, types);
  
  const results = new Map<string, Parser.SyntaxNode[]>();
  const queryResults = this.queryTree(ast, combinedPattern);
  
  for (const match of queryResults) {
    for (const capture of match.captures) {
      const nodes = results.get(capture.name) || [];
      nodes.push(capture.node);
      results.set(capture.name, nodes);
    }
  }
  
  return results;
}
```

#### 任务3.3：内存使用优化
```typescript
// 实现LRU缓存和内存监控
private static cleanupCache(): void {
  if (this.queryCache.size > this.maxCacheSize) {
    // 移除最久未使用的查询
    const oldestKey = this.usageQueue.shift();
    if (oldestKey) {
      this.queryCache.delete(oldestKey);
    }
  }
}
```

### 阶段四：全面测试和验证（2-3天）

#### 任务4.1：正确性测试套件
```typescript
// 测试所有支持的语言和结构
const testCases = [
  { language: 'javascript', code: 'function test() {}', expected: 1 },
  { language: 'typescript', code: 'class Test {}', expected: 1 },
  // ... 更多测试用例
];

testCases.forEach(({ language, code, expected }) => {
  test(`should extract ${expected} items from ${language}`, async () => {
    const result = await extractor.extractFunctions(parse(code, language));
    expect(result.length).toBe(expected);
  });
});
```

#### 任务4.2：性能基准测试
```typescript
// 性能对比测试
const performanceTest = async (code: string, iterations: number = 100) => {
  const oldTimes: number[] = [];
  const newTimes: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    // 测试旧实现
    const start1 = performance.now();
    oldExtractFunctions(code);
    oldTimes.push(performance.now() - start1);
    
    // 测试新实现
    const start2 = performance.now();
    await newExtractFunctions(code);
    newTimes.push(performance.now() - start2);
  }
  
  return {
    oldAvg: oldTimes.reduce((a, b) => a + b, 0) / iterations,
    newAvg: newTimes.reduce((a, b) => a + b, 0) / iterations,
    speedup: oldTimes.reduce((a, b) => a + b, 0) / newTimes.reduce((a, b) => a + b, 0)
  };
};
```

#### 任务4.3：边界情况测试
```typescript
// 测试边界情况
describe('Edge Cases', () => {
  test('should handle empty code', () => {
    expect(extractFunctions('')).toEqual([]);
  });
  
  test('should handle syntax errors gracefully', () => {
    expect(() => extractFunctions('function {')).not.toThrow();
  });
  
  test('should handle very large files', async () => {
    const largeCode = generateLargeCode(10000); // 生成10000行代码
    const result = await extractFunctions(largeCode);
    expect(result.length).toBeGreaterThan(0);
  });
});
```

```

## 👥 资源分配

### 开发资源
- **高级开发工程师**: 1人（全程）
- **中级开发工程师**: 1人（阶段2-4）
- **测试工程师**: 1人（阶段4）

### 时间预估
| 阶段 | 时长 | 开始日期 | 结束日期 |
|------|------|----------|----------|
| 基础设施准备 | 5天 | 2025-01-15 | 2025-01-19 |
| 核心功能迁移 | 7天 | 2025-01-20 | 2025-01-26 |
| 性能优化 | 4天 | 2025-01-27 | 2025-01-30 |
| 全面测试 | 3天 | 2025-01-31 | 2025-02-02 |
| 部署监控 | 2天 | 2025-02-03 | 2025-02-04 |
| **总计** | **21天** | | |

## 📊 成功指标

### 技术指标
1. **性能**: 查询速度提升 ≥ 2倍
2. **精度**: 识别准确率提升 ≥ 30%
3. **内存**: 内存使用减少 ≥ 20%
4. **缓存**: 缓存命中率 ≥ 80%

### 业务指标
1. **零故障**: 生产环境零故障运行7天
2. **用户满意度**: 功能准确性提升用户体验
3. **维护成本**: 后续维护工作量减少60%

## ⚠️ 风险应对计划

### 技术风险
1. **查询性能不佳**
   - 应对：查询优化、缓存策略、批量处理
   - 监控：实时性能监控，自动降级

2. **内存泄漏**
   - 应对：严格的内存管理，定期清理
   - 监控：内存使用监控，自动告警

3. **兼容性问题**
   - 应对：完善的测试覆盖，灰度发布
   - 监控：错误率监控，快速回滚

### 组织风险
1. **团队技能不足**
   - 应对：培训文档，代码审查，专家支持
   - 缓解：渐进式迁移，降低学习曲线

2. **时间压力**
   - 应对：优先级排序，最小可行产品
   - 缓解：灵活的发布计划，功能开关

## 🔄 迭代改进计划

### 第一次迭代（MVP）
- ✅ 支持JavaScript和TypeScript
- ✅ 基本函数和类提取
- ✅ 性能基准测试

### 第二次迭代
- 🔄 支持Python和Java
- 🔄 增强的查询模式
- 🔄 性能优化

### 第三次迭代
- 🔄 支持所有剩余语言
- 🔄 高级查询功能
- 🔄 生产环境部署

## 📋 验收标准

1. [ ] 所有现有测试通过
2. [ ] 性能提升达到2倍以上
3. [ ] 内存使用减少20%以上
4. [ ] 生产环境运行稳定7天
5. [ ] 用户反馈积极
6. [ ] 文档完整且更新

---
*最后更新: ${new Date().toISOString()}*
*版本: 1.0.0*