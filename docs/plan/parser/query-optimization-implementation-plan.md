# Tree-sitter 查询规则优化实施计划

## 1. 项目概述

本计划详细说明如何将当前的混合解析架构优化为基于查询规则的轻量级架构，移除具体语言解析器依赖，仅保留 `tree-sitter` 核心依赖。

## 2. 实施目标

### 2.1 主要目标
- ✅ 移除所有具体语言解析器依赖（cpp, go, java, javascript, python, rust, typescript）
- ✅ 保持现有功能完整性
- ✅ 提高系统性能和可维护性
- ✅ 实现按需解析器加载

### 2.2 成功标准
- 包体积减少 50% 以上
- 启动时间减少 30% 以上
- 所有现有测试通过
- 向后兼容现有 API

## 3. 详细实施步骤

### 3.1 第一阶段：准备和验证（第1周）

#### 3.1.1 创建测试基准
```typescript
// 创建性能基准测试
describe('Parser Performance Benchmark', () => {
  test('函数提取性能对比', async () => {
    // 测试查询规则 vs 硬编码解析的性能
  });
  
  test('类提取性能对比', async () => {
    // 测试不同规模代码的解析性能
  });
});
```

#### 3.1.2 验证查询规则覆盖率
- 验证所有25种语言的查询规则完整性
- 测试边缘情况和特殊语法结构
- 确保查询规则与 tree-sitter 语法兼容

#### 3.1.3 依赖分析
```bash
# 分析当前依赖大小
npm ls --depth=0 | grep tree-sitter
du -sh node_modules/tree-sitter-*
```

### 3.2 第二阶段：核心架构重构（第2-3周）

#### 3.2.1 重构 TreeSitterCoreService

**当前问题：**
```typescript
// 硬编码的语言解析器初始化
private initializeParsers(): void {
  const tsParser = new Parser();
  tsParser.setLanguage(TypeScript.typescript as any);
  // ... 其他语言类似代码
}
```

**重构方案：**
```typescript
class DynamicParserManager {
  private parsers = new Map<string, Parser>();
  private languageLoaders = new Map<string, () => Promise<any>>();
  
  constructor() {
    this.initializeLanguageLoaders();
  }
  
  async getParser(language: string): Promise<Parser> {
    if (!this.parsers.has(language)) {
      const parser = await this.loadParser(language);
      this.parsers.set(language, parser);
    }
    return this.parsers.get(language)!;
  }
  
  private async loadParser(language: string): Promise<Parser> {
    const loader = this.languageLoaders.get(language);
    if (!loader) {
      throw new Error(`Unsupported language: ${language}`);
    }
    
    const languageModule = await loader();
    const parser = new Parser();
    parser.setLanguage(languageModule);
    return parser;
  }
}
```

#### 3.2.2 实现按需加载机制

**语言加载器配置：**
```typescript
private initializeLanguageLoaders(): void {
  // 配置动态导入
  this.languageLoaders.set('javascript', () => 
    import('tree-sitter-javascript').then(m => m.default)
  );
  this.languageLoaders.set('typescript', () => 
    import('tree-sitter-typescript').then(m => m.typescript)
  );
  // ... 其他语言
}
```

#### 3.2.3 优化查询执行流程

**改进的查询执行：**
```typescript
async executeOptimizedQuery(
  ast: Parser.SyntaxNode, 
  language: string, 
  queryType: string
): Promise<QueryResult[]> {
  // 1. 尝试使用查询规则
  try {
    const queryPattern = await QueryManager.getQueryString(language, queryType);
    return this.queryTree(ast, queryPattern);
  } catch (error) {
    // 2. 查询失败时使用回退机制
    console.warn(`查询失败，使用回退机制: ${error.message}`);
    return this.fallbackExtraction(ast, queryType, language);
  }
}
```

### 3.3 第三阶段：依赖管理和构建优化（第4周）

#### 3.3.1 更新 package.json

**移除具体语言依赖：**
```json
{
  "dependencies": {
    "tree-sitter": "^0.25.0",
    // 移除以下依赖：
    // "tree-sitter-cpp": "^0.23.4",
    // "tree-sitter-go": "^0.25.0",
    // "tree-sitter-java": "^0.23.5",
    // "tree-sitter-javascript": "0.25.0",
    // "tree-sitter-python": "0.25.0",
    // "tree-sitter-rust": "^0.24.0",
    // "tree-sitter-typescript": "^0.23.2"
  }
}
```

#### 3.3.2 配置动态导入

**Webpack/Vite 配置（如需要）：**
```javascript
// 确保动态导入正常工作
module.exports = {
  experiments: {
    topLevelAwait: true
  }
};
```

#### 3.3.3 构建脚本优化

**添加构建时验证：**
```json
{
  "scripts": {
    "build:validate": "tsc && node scripts/validate-queries.js",
    "prebuild": "npm run validate:queries"
  }
}
```

### 3.4 第四阶段：测试和部署（第5周）

#### 3.4.1 全面测试

**功能测试：**
```typescript
describe('优化后解析器功能测试', () => {
  test('所有支持语言的解析功能', async () => {
    const languages = ['javascript', 'typescript', 'python', 'java', 'go', 'rust'];
    for (const lang of languages) {
      const result = await parser.parseCode(sampleCode[lang], lang);
      expect(result.success).toBe(true);
    }
  });
});
```

**性能测试：**
```typescript
test('解析性能基准', async () => {
  const startTime = Date.now();
  // 执行批量解析测试
  const results = await Promise.all(
    testFiles.map(file => parser.parseFile(file.path, file.content))
  );
  const duration = Date.now() - startTime;
  expect(duration).toBeLessThan(performanceThreshold);
});
```

#### 3.4.2 部署策略

**渐进式部署：**
1. 先在开发环境测试
2. 然后部署到测试环境
3. 最后生产环境部署

**回滚计划：**
- 保持旧版本代码分支
- 准备快速回滚脚本
- 监控关键指标

## 4. 风险管理和缓解措施

### 4.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 查询性能下降 | 中 | 中 | 保持回退机制，优化查询缓存 |
| 语法覆盖不全 | 低 | 高 | 完善测试用例，逐步验证 |
| 动态导入失败 | 低 | 中 | 提供静态回退方案 |

### 4.2 依赖风险

**依赖兼容性检查：**
```typescript
// 检查 tree-sitter 版本兼容性
const requiredVersion = '^0.25.0';
const actualVersion = require('tree-sitter/package.json').version;
```

## 5. 质量保证

### 5.1 代码质量

**代码审查清单：**
- [ ] 所有公共 API 保持兼容
- [ ] 错误处理完善
- [ ] 性能优化到位
- [ ] 测试覆盖率达到 90%+

### 5.2 性能监控

**关键指标监控：**
- 解析时间分布
- 内存使用情况
- 缓存命中率
- 错误率统计

## 6. 文档更新

### 6.1 技术文档
- 更新架构设计文档
- 编写新的使用指南
- 添加故障排除指南

### 6.2 API 文档
- 更新 TypeScript 类型定义
- 完善 JSDoc 注释
- 提供迁移指南

## 7. 时间线

### 7.1 详细时间安排

| 阶段 | 时间 | 主要任务 | 交付物 |
|------|------|----------|--------|
| 准备阶段 | 第1周 | 测试基准、验证覆盖率 | 测试报告、性能基准 |
| 架构重构 | 第2-3周 | 核心服务重构、按需加载 | 重构后的代码、单元测试 |
| 依赖优化 | 第4周 | 包管理、构建配置 | 更新的 package.json、构建脚本 |
| 测试部署 | 第5周 | 全面测试、部署监控 | 测试报告、部署文档 |

### 7.2 里程碑

- **M1**（第1周末）：完成测试基准和验证
- **M2**（第3周末）：完成核心架构重构
- **M3**（第4周末）：完成依赖优化和构建
- **M4**（第5周末）：完成测试和部署

## 8. 成功度量

### 8.1 技术指标
- ✅ 包体积减少 ≥ 50%
- ✅ 启动时间减少 ≥ 30%
- ✅ 测试通过率 100%
- ✅ 性能回归 ≤ 5%

### 8.2 业务指标
- ✅ 开发体验改善
- ✅ 维护成本降低
- ✅ 扩展性提升

## 9. 结论

本实施计划提供了一个系统性的方法来优化 tree-sitter 查询规则架构。通过分阶段实施、充分测试和风险控制，可以确保优化过程的平稳进行，最终实现更轻量、更高效的代码解析系统。

**关键成功因素：**
1. 充分的测试验证
2. 渐进式的重构策略
3. 完善的回退机制
4. 持续的监控和优化

通过此优化，系统将获得显著的性能提升和维护性改善，为未来的功能扩展奠定坚实基础。