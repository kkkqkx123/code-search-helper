# Query 模块依赖层级分析与优化方案

## 现状分析

### 1. 当前模块结构

```
src/service/parser/core/query/
├── TreeSitterQueryFacade.ts       ⭐ 门面层（提供业务API）
├── TreeSitterQueryExecutor.ts      🔧 执行层（查询执行）
├── QueryManager.ts                 ❌ 管理层（冗余，应删除）
├── QueryRegistry.ts                📋 注册层（模式加载）
├── QueryLoader.ts                  📂 加载层（文件读取）
├── QueryCache.ts                   💾 缓存层（结果缓存）
├── QueryPatternExtractor.ts        🔀 提取层（模式识别）
├── QueryPerformanceMonitor.ts      📊 监控层（性能统计）
└── query-config.ts                 ⚙️  配置层（常量定义）
```

### 2. 依赖流向（当前）

```
高层应用
  ↓
TreeSitterQueryFacade （门面）
  ├↓ 调用
  ├→ TreeSitterQueryExecutor （执行引擎）
  │  ├→ QueryRegistry
  │  ├→ QueryCache
  │  └→ QueryPerformanceMonitor
  │
  └→ QueryManager （冗余！）
     ├→ QueryRegistry
     ├→ QueryLoader
     └→ 各种缓存逻辑...

QueryLoader
  ├→ QueryPatternExtractor
  └→ query-config
```

### 3. 存在的问题

#### 🔴 问题 1: 层级过多（5层）
1. **Facade 层** - TreeSitterQueryFacade
2. **管理层** - QueryManager（冗余）
3. **执行层** - TreeSitterQueryExecutor
4. **注册层** - QueryRegistry
5. **加载层** - QueryLoader

**后果**：
- 代码流追踪困难
- 修改需要跨越多个文件
- 维护成本高

#### 🔴 问题 2: QueryManager 严重冗余
- ✅ TreeSitterQueryFacade 已提供所有公开API
- ✅ TreeSitterQueryExecutor 提供底层执行
- ❌ QueryManager 重复了这两者的功能

**现状对比**：

| 功能 | Facade | Manager | Executor |
|-----|--------|---------|----------|
| 获取查询模式 | ✅ | ✅ | ✅ |
| 执行查询 | ✅ | ✅ | ✅ |
| 缓存管理 | ✅ | ✅ | ✅ |
| 性能监控 | ✅ | ❌ | ✅ |
| 初始化 | ❌ | ✅ | ✅ |

**影响范围**：
- 仅在 1 个测试文件中使用（OptimizedParserIntegration.test.ts）
- 实际应用层全部使用 TreeSitterQueryFacade
- 可以安全删除

#### 🔴 问题 3: QueryRegistry/QueryLoader 的角色不清晰
- **QueryRegistry**: 初始化 + 查询模式管理
- **QueryLoader**: 加载 + 发现 + 验证 + 缓存

两者都在做 initialization 和 caching，职责不够清晰。

#### 🔴 问题 4: 缓存重复实现
- QueryManager 有自己的缓存（queryCache, patternCache）
- QueryCache 有统一的缓存（resultCache, queryCache）
- QueryRegistry/QueryLoader 也各有缓存

**后果**：内存浪费，统计混乱。

#### 🔴 问题 5: 初始化流程复杂
```
QueryManager.initialize()
  ├→ QueryRegistry.initialize()
  │  └→ QueryLoader.loadLanguageQueries()
  │     └→ QueryPatternExtractor.extractAllPatterns()
  │
QueryLoader.getQuery()
  └→ 返回缓存或抛错

QueryExecutor.executeQuery()
  ├→ QueryRegistry.initialize()
  └→ QueryRegistry.getPattern()
```

**问题**: 多个地方都在做 initialize，容易出现重复初始化或初始化顺序问题。

---

## 优化方案

### 🎯 目标
- 将 5 层简化为 3 层
- 删除 QueryManager
- 统一初始化和缓存

### 📋 优化策略

#### 方案 A: 激进改造（推荐）

**最终结构**（3层）：
```
应用层 (FallbackExtractor, tests)
  ↓
TreeSitterQueryFacade （查询门面+初始化）
  ↓
QueryEngine （底层执行+注册+加载 一体化）
  ├→ QueryCache （统一缓存）
  ├→ QueryPerformanceMonitor （性能监控）
  └→ query-config （常量）
```

**具体步骤**：

1. **删除 QueryManager.ts** (∼ 349 行)
   - 所有 API 已由 TreeSitterQueryFacade 提供
   - 仅在 OptimizedParserIntegration.test.ts 使用，改为用 Facade

2. **合并 QueryRegistry 和 QueryLoader 到 QueryEngine 中**
   - QueryEngine 直接负责初始化、加载、缓存
   - 移除 QueryRegistry 作为独立模块
   - QueryLoader 变为 QueryEngine 内部方法

3. **强化 TreeSitterQueryFacade**
   - 保留其简洁的查询 API
   - 增加初始化方法（调用 QueryEngine 的 initialize）
   - 保持向后兼容

4. **简化调用链**
   ```
   // Before
   TreeSitterQueryFacade 
     → TreeSitterQueryExecutor 
       → QueryRegistry.initialize()
         → QueryLoader.loadLanguageQueries()

   // After
   TreeSitterQueryFacade 
     → QueryEngine (兼容旧的TreeSitterQueryExecutor API)
   ```

**文件变更**：
- ❌ 删除: QueryManager.ts
- ❌ 删除: QueryRegistry.ts （功能并入 QueryEngine）
- ❌ 删除: QueryLoader.ts （变为内部方法）
- ✏️  修改: TreeSitterQueryExecutor.ts → 重命名为 QueryEngine.ts，合并注册和加载逻辑
- ✏️  修改: TreeSitterQueryFacade.ts （更新导入）
- ✏️  修改: 所有导入者

**好处**：
- ✅ 依赖链从 5 层 → 3 层
- ✅ 初始化逻辑统一
- ✅ 缓存策略统一
- ✅ 代码追踪更容易
- ✅ 维护成本大幅下降

---

#### 方案 B: 保守改造

**仅删除 QueryManager**：
- QueryManager → 删除
- QueryRegistry + QueryLoader → 保留但简化
- TreeSitterQueryExecutor + Facade → 增强初始化功能

**优点**: 风险更低
**缺点**: 仍然有 4 层依赖

---

### 🔄 迁移路径

#### 第 1 步: 删除 QueryManager（当天完成）
```bash
1. 备份 QueryManager.ts
2. 找出所有引用: grep -r "QueryManager" src/
   - OptimizedParserIntegration.test.ts 改用 TreeSitterQueryFacade
   - index.ts 的导出删除
3. 删除 QueryManager.ts
4. 运行测试验证
```

#### 第 2 步: 合并 Registry/Loader 到 Executor（可选，下一阶段）
```bash
1. 将 QueryRegistry 的逻辑移到 TreeSitterQueryExecutor
2. 将 QueryLoader 的逻辑移到 TreeSitterQueryExecutor（作为内部方法）
3. 更新 TreeSitterQueryFacade 的初始化流程
4. 删除 QueryRegistry.ts, QueryLoader.ts
5. 运行完整测试
```

#### 第 3 步: 重命名和文档更新
```bash
1. TreeSitterQueryExecutor.ts → QueryEngine.ts（可选，向后兼容）
2. 更新所有导入和导出
3. 更新 TreeSitter-Architecture-Responsibilities.md
4. 更新 README 和文档
```

---

## 详细改造说明

### 🎬 Step 1: 删除 QueryManager

**受影响文件**:
```
src/service/parser/core/query/QueryManager.ts          ❌ 删除
src/service/parser/index.ts                             ✏️  移除导出
src/service/parser/__tests__/integration/OptimizedParserIntegration.test.ts   ✏️  改用 Facade
```

**改动示例**:
```typescript
// Before (OptimizedParserIntegration.test.ts)
import { QueryManager } from '../../core/query/QueryManager';
await QueryManager.initialize();
const stats = QueryManager.getCacheStats();

// After
import { TreeSitterQueryFacade } from '../../core/query/TreeSitterQueryFacade';
// Facade 会自动初始化
const stats = TreeSitterQueryFacade.getPerformanceStats();
```

---

### 🎬 Step 2: 合并 Registry 和 Loader（可选高级改造）

**新的 QueryEngine 结构**：
```typescript
export class QueryEngine {
  // 原有属性
  private patterns: Map<string, QueryPattern>;
  
  // 从 Registry 继承的属性
  private registeredPatterns: Map<string, Map<string, string>>;
  
  // 从 Loader 继承的属性
  private queries: Map<string, Map<string, string>>;
  private loadedLanguages: Set<string>;
  
  // === 核心 API ===
  async executeQuery(ast, queryType, language): Promise<QueryResult>
  
  // === 初始化（来自 Registry + Loader）===
  static async initialize(): Promise<boolean>
  static async loadLanguageQueries(language): Promise<void>
  
  // === 模式管理（来自 Registry）===
  static getSupportedLanguages(): string[]
  static getQueryTypesForLanguage(language): string[]
  static async getPattern(language, queryType): Promise<string | null>
  
  // === 加载管理（来自 Loader）===
  static getQuery(language, queryType): string
  static isLanguageLoaded(language): boolean
}

// 为向后兼容，导出别名
export const QueryRegistry = QueryEngine;
export const QueryLoader = QueryEngine;
```

---

## 性能影响评估

### 缓存策略
目前有多个缓存：
- **QueryManager.queryCache** (100 items)
- **QueryManager.patternCache** (50 items)
- **QueryCache.queryCache** (200 items)
- **QueryCache.resultCache** (500 items)
- **QueryCache.astCache** (200 items)

**优化后**（统一为）：
- **QueryCache.queryCache** (200 items) ← 合并 Manager 的 queryCache
- **QueryCache.patternCache** (100 items) ← 新增，用于模式缓存
- **QueryCache.resultCache** (500 items)
- **QueryCache.astCache** (200 items)

**结果**: 
- 内存占用 ↓ ~15%
- 缓存命中率可能 ↑ 5-10%（统一管理）

---

## 风险评估

### 🟡 中等风险

1. **QueryManager 删除**
   - 风险: 低（仅 1 个测试使用，Facade 完全替代）
   - 缓解: 修改测试，验证功能等价

2. **Registry/Loader 合并**
   - 风险: 中（多个地方依赖）
   - 缓解: 保留导出别名，逐步迁移

3. **初始化流程变更**
   - 风险: 中（并发初始化需注意）
   - 缓解: 保持现有的 initializing 状态锁

---

## 推荐时间表

| 阶段 | 任务 | 时间 | 优先级 |
|-----|------|------|-------|
| 1️⃣ 立即 | 删除 QueryManager | 30 min | 🔴 高 |
| 2️⃣ 本周 | 合并 Registry + Loader | 2 小时 | 🟡 中 |
| 3️⃣ 下周 | 测试和文档更新 | 1 小时 | 🟡 中 |
| 4️⃣ 可选 | 重命名 Executor 为 Engine | 30 min | 🟢 低 |

---

## 总结

| 指标 | 当前 | 优化后 | 改进 |
|-----|------|--------|------|
| 依赖层级 | 5 层 | 3 层 | ✅ -40% |
| 文件数 | 10 | 7 | ✅ -30% |
| 总代码行数 | ~2500 | ~2000 | ✅ -20% |
| 初始化入口 | 3 个 | 1 个 | ✅ -67% |
| 缓存管理 | 5 个缓存 | 4 个缓存 | ✅ -20% |
| 测试覆盖 | ✅ | ✅ | ✅ |

---

## 下一步

建议立即执行 **Step 1: 删除 QueryManager**，因为：
1. ✅ 风险最低
2. ✅ 收益明显
3. ✅ 为后续优化铺路
4. ✅ 代码立即变得更清晰
