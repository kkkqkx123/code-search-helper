# Parser 重构 - 快速参考

## 🎯 核心变化

```
旧架构：TreeSitterCoreService → 复杂、职责混杂
新架构：ParserFacade → 清晰、单一职责
```

---

## 📝 代码迁移速查表

### 导入
```typescript
// ❌ 旧
import { TreeSitterCoreService } from './parse/TreeSitterCoreService'
import { TreeSitterService } from './parse/TreeSitterService'

// ✅ 新
import { ParserFacade } from './parse/ParserFacade'
```

### 注入
```typescript
// ❌ 旧
constructor(@inject(TYPES.TreeSitterCoreService) private service: TreeSitterCoreService)

// ✅ 新
constructor(@inject(TYPES.ParserFacade) private facade: ParserFacade)
```

### 初始化
```typescript
// ❌ 旧
const service = new TreeSitterCoreService(cacheService)
const result = await service.parseCode(code, language)

// ✅ 新
const facade = new ParserFacade(cacheService)
await facade.waitForInitialization()
const ast = await facade.parseCode(code, language)
```

### 解析
```typescript
// ❌ 旧
const result = await this.service.parseCode(code, language)
const ast = result.ast

// ✅ 新
const ast = await this.facade.parseCode(code, language)
```

### 提取函数
```typescript
// ❌ 旧
const functions: SyntaxNode[] = await this.service.extractFunctions(ast, language)

// ✅ 新 (有类型信息)
const results = await this.facade.findFunctions(ast, language)
const functions = results.map(r => r.node)

// ✅ 新 (推荐，使用类型信息)
const results = await this.facade.findFunctions(ast, language)
results.forEach(result => {
  console.log(result.node)
  console.log(result.metadata.priority)  // 有优先级！
})
```

### 提取类
```typescript
// ❌ 旧
const classes = await this.service.extractClasses(ast, language)

// ✅ 新
const results = await this.facade.findClasses(ast, language)
const classes = results.map(r => r.node)
```

### 批量操作
```typescript
// ❌ 旧（顺序）
const functions = await service.extractFunctions(ast, language)
const classes = await service.extractClasses(ast, language)
const exports = await service.extractExports(ast, language)

// ✅ 新（并行 + 简洁）
const results = await facade.analyzeCode(code, language)
// 包含：entities, relationships, totalResults, executionTime
```

---

## 🔍 查找受影响文件

```bash
# 找出所有使用旧 API 的文件
grep -r "TreeSitterCoreService\|TreeSitterService\|extractFunctions\|extractClasses" src/ --include="*.ts" | grep -v test | grep -v .bak

# 统计数量
grep -r "TreeSitterCoreService\|TreeSitterService" src/ --include="*.ts" | cut -d: -f1 | sort -u | wc -l
```

---

## 🛠️ 修改步骤

### 1. 更新 DI 配置
```bash
编辑: src/config/inversify.config.ts (或相关文件)
```

### 2. 逐个文件更新
```bash
对每个受影响文件：
1. 改 import
2. 改 constructor @inject
3. 改方法调用
4. npm run build 检查
```

### 3. 删除旧文件
```bash
rm src/service/parser/core/parse/TreeSitterCoreService.ts
rm src/service/parser/core/parse/TreeSitterService.ts
```

### 4. 验证
```bash
npm run build
npm test
npm run lint
```

---

## 📊 新 API 一览

### 解析
```typescript
await facade.parseCode(code, language): Promise<SyntaxNode>
await facade.parseFile(filePath, content): Promise<SyntaxNode>
await facade.detectLanguage(filePath, content?): Promise<string | null>
```

### 实体查询
```typescript
await facade.findMacros(ast, language)
await facade.findTypes(ast, language)
await facade.findFunctions(ast, language)
await facade.findClasses(ast, language)
await facade.findVariables(ast, language)
await facade.findExports(ast, language)
```

### 关系查询
```typescript
await facade.findCallRelationships(ast, language)
await facade.findDependencies(ast, language)
await facade.findInheritance(ast, language)
await facade.findControlFlow(ast, language)
await facade.findDataFlow(ast, language)
```

### 综合分析
```typescript
await facade.analyzeCode(code, language)
// 返回：{entities, relationships, prioritized, totalResults, executionTime}
```

### 工具方法
```typescript
facade.getSupportedLanguages()
facade.isLanguageSupported(language)
facade.getCacheStats()
facade.getPerformanceStats()
facade.clearAll()
```

---

## ⏱️ 执行时间估计

| 步骤 | 时间 | 说明 |
|------|------|------|
| 搜索和分析 | 15分钟 | 找出影响范围 |
| 更新 DI | 10分钟 | 修改配置文件 |
| 迁移代码 | 1-3小时 | 取决于受影响文件数 |
| 删除旧文件 | 5分钟 | 清理 |
| 测试验证 | 30分钟 | 编译、测试、手动验证 |
| **总计** | **2-4小时** | 中等工作量 |

---

## 💾 安全检查清单

- [ ] 已备份旧文件（可选）
- [ ] 已创建新分支
- [ ] 已运行搜索确认影响范围
- [ ] DI 配置已更新
- [ ] 所有 import 已更新
- [ ] 所有方法调用已更新
- [ ] 编译无错误 (`npm run build`)
- [ ] 测试通过 (`npm test`)
- [ ] Lint 通过 (`npm run lint`)
- [ ] 已删除旧文件
- [ ] 已提交到 git

---

## 🚨 常见错误

### 错误 1: "Cannot find module ParserFacade"
```
解决: 检查文件路径和 import 语句
```

### 错误 2: "Type X is not assignable to type Y"
```
解决: findXxx() 返回 EntityQueryResult[]，需要 .map(r => r.node)
```

### 错误 3: "TYPES.ParserFacade is undefined"
```
解决: 在 types.ts 中添加符号定义
```

### 错误 4: 初始化超时
```
解决: 在使用前调用 await facade.waitForInitialization()
```

---

## 📚 详细文档

| 文档 | 内容 |
|------|------|
| PARSE_COMPLETE_REFACTOR.md | 完整重构方案（当前方案） |
| PARSE_REFACTOR_USAGE.md | 新 API 使用指南 |
| PARSE_REFACTOR_ANALYSIS.md | 架构分析和设计思路 |

---

## 🎓 学习新 API

### 最简单的例子
```typescript
import { ParserFacade } from './parse/ParserFacade'

async function quickExample() {
  const facade = new ParserFacade(cacheService)
  await facade.waitForInitialization()
  
  const code = 'int main() { return 0; }'
  const ast = await facade.parseCode(code, 'c')
  
  const functions = await facade.findFunctions(ast, 'c')
  console.log(`找到 ${functions.length} 个函数`)
}
```

### 获取优先级信息
```typescript
const results = await facade.findFunctions(ast, 'c')

results.forEach(result => {
  // result 包含：
  // - node: 实际的 AST 节点
  // - metadata.priority: 优先级（0-5）
  // - metadata.category: 分类（'function', 'call'等）
  // - captures: Tree-Sitter 的命名捕获
  
  console.log(`函数优先级: ${result.metadata.priority}`)
})
```

### 按优先级过滤
```typescript
import { QueryPriority } from './parse/QueryPriority'

const results = await facade.analyzeCode(code, language)
const highPriority = results.prioritized[QueryPriority.HIGH]
const critical = results.prioritized[QueryPriority.CRITICAL]
```

---

## ✅ 完成标志

完成后应该看到：

```bash
✅ No TreeSitterCoreService imports
✅ No TreeSitterService imports  
✅ No extractFunctions/extractClasses calls
✅ npm run build 成功
✅ npm test 通过
✅ grep 搜索无结果
✅ 代码行数减少 ~600 行
✅ 编译和运行无警告
```

---

**时间成本**: 2-4小时  
**收益**: 代码行数 -600, 复杂度 -40%, 性能 +2-3x, 可维护性 +显著
