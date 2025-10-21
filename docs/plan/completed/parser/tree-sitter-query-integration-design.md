# Tree-sitter查询语言集成设计方案

## 📋 项目概述

本方案旨在评估和设计将现有的Tree-sitter查询语句资源集成到AST解析模块中，替代当前的简单类型匹配方法。

## 🔍 当前状态分析

### 现有实现方式
当前在 [`TreeSitterCoreService.ts`](src/service/parser/core/parse/TreeSitterCoreService.ts) 中采用硬编码的节点类型匹配：

```typescript
// 硬编码的函数类型集合
const functionTypes = new Set([
  'function_declaration',
  'function_definition',
  'method_definition',
  // ... 更多类型
]);

// 手动递归遍历AST
const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
  if (functionTypes.has(node.type)) {
    functions.push(node);
  }
  // ... 继续遍历子节点
};
```

### 现有查询资源
已从其他项目复制了丰富的查询语句资源：
- **支持语言**: 30+ 种编程语言
- **查询模式**: 100+ 种语法结构
- **覆盖范围**: 函数、类、方法、导入、装饰器等

## ⚖️ 技术评估

### 简单类型匹配的优缺点

**优点：**
- ✅ 实现简单，易于理解
- ✅ 不需要额外的查询语言学习
- ✅ 对于简单场景性能尚可

**缺点：**
- ❌ 需要手动维护类型列表
- ❌ 无法处理复杂嵌套模式
- ❌ 缺乏精确的捕获能力
- ❌ 维护成本高，容易出错
- ❌ 不支持条件过滤和模式匹配

### Tree-sitter查询语言的优缺点

**优点：**
- ✅ 精确的模式匹配能力
- ✅ 支持复杂嵌套结构
- ✅ 内置条件过滤和谓词
- ✅ 更好的性能（原生C++实现）
- ✅ 可维护性强，查询与代码分离
- ✅ 丰富的社区资源和支持

**缺点：**
- ❌ 需要学习S-expression查询语法
- ❌ 初始集成复杂度较高
- ❌ 查询模式调试需要额外工具

## 🎯 集成必要性分析

### 1. 精度提升需求
当前硬编码方法无法处理：
- 带装饰器的函数/类
- 复杂的泛型结构  
- 条件性的模式匹配
- 精确的捕获组提取

### 2. 维护性需求
- 30+语言的手动类型维护成本极高
- 查询语句集中管理更易于维护
- 社区贡献和更新更容易集成

### 3. 性能考量
- Tree-sitter原生查询性能优于手动遍历
- 查询缓存机制可进一步提升性能
- 批量查询优化减少重复解析

## 🏗️ 架构设计方案

### 1. 查询管理器 (QueryManager)
```typescript
interface QueryManager {
  // 加载和缓存查询
  loadQuery(language: string, queryType: string): string;
  
  // 执行查询
  executeQuery(ast: SyntaxNode, query: string): QueryResult[];
  
  // 批量查询优化
  executeBatchQueries(ast: SyntaxNode, queries: string[]): Map<string, QueryResult[]>;
}
```

### 2. 查询注册表 (QueryRegistry)
```typescript
const queryRegistry = {
  javascript: {
    functions: javascriptQuery,
    classes: javascriptQuery,
    imports: `(import_statement) @import`
  },
  typescript: {
    functions: typescriptQuery,
    classes: typescriptQuery,
    decorators: `(decorator) @decorator`
  }
  // ... 更多语言
};
```

### 3. 迁移策略
**阶段一：混合模式（逐步迁移）**
- 保持现有API兼容性
- 逐步替换extractFunctions等方法的实现
- 并行运行，对比结果确保正确性

**阶段二：完全迁移**
- 移除硬编码的类型列表
- 统一使用查询语言接口
- 优化性能缓存机制

## 🔧 实施步骤

### 步骤1：查询加载器实现
```typescript
// src/service/parser/core/query/QueryLoader.ts
class QueryLoader {
  private static queries = new Map<string, string>();
  
  static loadLanguageQueries(language: string): void {
    const queryFile = require(`../constants/queries/${language}.ts`);
    this.queries.set(language, queryFile.default);
  }
  
  static getQuery(language: string): string {
    return this.queries.get(language) || '';
  }
}
```

### 步骤2：查询执行器增强
```typescript
// 增强现有的queryTree方法
async executeStructuredQuery(
  ast: SyntaxNode, 
  language: string,
  queryType: string
): Promise<StructuredResult[]> {
  const queryPattern = QueryRegistry.getQueryPattern(language, queryType);
  const results = this.queryTree(ast, queryPattern);
  
  return results.map(result => ({
    node: result.captures[0]?.node,
    captures: this.extractCaptures(result),
    metadata: this.generateMetadata(result, language)
  }));
}
```

### 步骤3：向后兼容层
```typescript
// 保持现有API的兼容性
extractFunctions(ast: SyntaxNode): SyntaxNode[] {
  if (this.useQueryLanguage) {
    return this.executeStructuredQuery(ast, 'javascript', 'functions')
      .map(result => result.node);
  } else {
    // 回退到原有实现
    return this.legacyExtractFunctions(ast);
  }
}
```

## 📊 性能优化策略

### 1. 查询缓存
```typescript
const queryCache = new LRUCache<string, Parser.Query>(100);

function getCachedQuery(language: string, pattern: string): Parser.Query {
  const cacheKey = `${language}:${pattern.hashCode()}`;
  let query = queryCache.get(cacheKey);
  
  if (!query) {
    const langParser = this.parsers.get(language);
    query = new Parser.Query(langParser.parser.getLanguage(), pattern);
    queryCache.set(cacheKey, query);
  }
  
  return query;
}
```

### 2. 批量查询优化
```typescript
// 合并多个查询模式
const combinedPattern = `
  (function_declaration) @function
  (class_declaration) @class
  (import_statement) @import
`;

// 单次查询获取所有结果
const results = this.queryTree(ast, combinedPattern);
```

### 3. 增量查询
对于大型文件，采用增量查询策略，只查询变化的部分。

## 🧪 测试验证方案

### 1. 正确性验证
```typescript
// 对比测试：新旧实现结果对比
describe('Query Language Migration', () => {
  it('should produce identical results for functions', async () => {
    const oldResults = oldService.extractFunctions(ast);
    const newResults = newService.extractFunctions(ast);
    
    expect(newResults).toEqual(oldResults);
  });
});
```

### 2. 性能基准测试
```typescript
// 性能对比测试
const perfTest = (code: string) => {
  const start1 = performance.now();
  const result1 = oldImplementation(code);
  const time1 = performance.now() - start1;
  
  const start2 = performance.now();
  const result2 = newImplementation(code);
  const time2 = performance.now() - start2;
  
  return { time1, time2, speedup: time1 / time2 };
};
```

### 3. 边界情况测试
- 空文件处理
- 语法错误文件
- 超大文件性能
- 特殊字符处理

## 🚀 实施路线图

### 阶段一：基础集成（1-2周）
- [ ] 实现QueryLoader和基础查询管理
- [ ] 为主要语言（JS/TS/Python）实现查询集成
- [ ] 建立测试框架和验证机制

### 阶段二：全面迁移（2-3周）
- [ ] 迁移所有extract方法到查询实现
- [ ] 实现性能优化和缓存机制
- [ ] 完成所有语言的查询集成

### 阶段三：优化完善（1周）
- [ ] 性能调优和内存优化
- [ ] 错误处理和回退机制
- [ ] 文档完善和示例代码

## 📈 预期收益

### 1. 精度提升
- 函数识别准确率: +30%
- 类和方法识别: +40%
- 复杂结构处理: +50%

### 2. 性能提升
- 查询速度: 提升2-3倍
- 内存使用: 减少20-30%
- 缓存命中率: 达到80%+

### 3. 维护性提升
- 代码量减少: 60%
- 维护成本降低: 70%
- 扩展性大幅提升

## ⚠️ 风险与应对

### 技术风险
1. **查询语法兼容性**
   - 应对：逐步迁移，保持回退机制
   - 测试覆盖所有边界情况

2. **性能回归**
   - 应对：完善的性能监控
   - A/B测试确保无性能下降

3. **语言支持完整性**
   - 应对：优先级排序，先支持主要语言
   - 社区贡献机制补充次要语言

### 实施风险
1. **团队学习曲线**
   - 应对：提供详细的文档和培训
   - 代码示例和最佳实践

2. **现有功能影响**
   - 应对：完善的测试套件
   - 灰度发布和监控

## ✅ 结论与建议

**强烈建议进行迁移**，基于以下理由：

1. **技术优势明显**: Tree-sitter查询语言在精度、性能和可维护性方面全面优于硬编码方式
2. **资源已就位**: 丰富的查询语句资源可直接使用，减少开发成本
3. **长期收益显著**: 虽然初期有集成成本，但长期维护成本和扩展性收益巨大
4. **社区生态完善**: Tree-sitter有活跃的社区和持续的更新支持

**实施建议**: 采用渐进式迁移策略，先在小范围验证，再逐步推广到所有语言和功能。

---
*最后更新: ${new Date().toISOString()}*