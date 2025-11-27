# 查询系统快速参考卡

## 🎯 系统概览 (30秒理解)

**职责**: 使用 Tree-sitter 从 AST 中提取代码结构 (函数、类、导入等)

**核心流程**:
```
AST 输入 → 选择查询类型 → 执行查询 → 返回节点列表
```

**主要入口**:
```typescript
const nodes = await TreeSitterQueryFacade.findFunctions(ast, 'typescript');
```

---

## 📦 15个文件快速查询

| # | 文件 | 职责 | 必要性 | 状态 |
|---|------|------|--------|------|
| 1 | TreeSitterQueryFacade | 用户接口 | ✅ YES | 保留 |
| 2 | TreeSitterQueryExecutor | 执行引擎 | ✅ YES | 保留 |
| 3 | QueryRegistry | 模式注册表 | ✅ YES | 保留 |
| 4 | QueryLoader | 加载查询文件 | ✅ YES | 保留 |
| 5 | QueryManager | 查询管理 | ⚠️ PARTIAL | 简化 |
| 6 | QueryCache | 三层缓存 | ✅ YES | 保留 |
| 7 | CacheKeyGenerator | 键生成 | ⚠️ OPTIONAL | 可内嵌 |
| 8 | QueryEngineFactory | 单例工厂 | ❌ NO | **删除** |
| 9 | GlobalQueryInitializer | 初始化协调 | ⚠️ PARTIAL | **合并到 Registry** |
| 10 | QueryPerformanceMonitor | 性能监控 | ✅ YES | 保留 |
| 11 | query-config | 配置系统 | ✅ YES | 保留 |
| 12 | QueryPatternExtractor | 模式提取工具 | ✅ YES | 保留 |
| 13 | QueryTransformer | 模式转换 | ❌ NO | **删除** (废弃) |
| 14 | QueryRegistryCompatibility | 兼容性包装 | ❌ NO | **删除** (废弃) |
| 15 | GlobalQueryInitializer.md | 文档 | ✅ YES | 保留 |

---

## 🔄 优化方案速览

### 方案对比

```
┌─────────────┬──────────┬──────────┬──────────┐
│ 方案        │ 文件数   │ 工作量   │ 风险    │
├─────────────┼──────────┼──────────┼──────────┤
│ 当前        │ 15       │ -        │ -       │
│ 优先级 1    │ 13       │ 2-4h     │ 🟢 无   │
│ 优先级 1+2  │ 12       │ 6-10h    │ 🟢 低   │
│ 优先级 1+2+3│ 11       │ 12-18h   │ 🟡 中   │
│ 全部        │ 10       │ 24-34h   │ 🔴 高   │
└─────────────┴──────────┴──────────┴──────────┘
```

### 推荐方案: **优先级 1+2+3** (3 周内完成)

```
删除:
  ✓ QueryEngineFactory (35 行)
  ✓ GlobalQueryInitializer (86 行)
  ✓ QueryTransformer (367 行, 已废弃)
  ✓ QueryRegistryCompatibility (76 行, 已废弃)

合并:
  ✓ 工厂逻辑 → TreeSitterQueryFacade
  ✓ 初始化逻辑 → QueryRegistry

结果: 11 文件, 2050 行, 高可维护性
```

---

## 🎯 文件依赖关系 (5秒理解)

### 执行路径
```
用户代码
   ↓
TreeSitterQueryFacade (门面)
   ↓
TreeSitterQueryEngine (引擎)
   ├─ QueryRegistry (查询注册表)
   ├─ QueryCache (缓存)
   └─ CacheKeyGenerator (键生成)
```

### 初始化路径
```
应用启动
   ↓
GlobalQueryInitializer.initialize() [应该合并到 QueryRegistry]
   ↓
QueryRegistry.initialize()
   ├─ QueryLoader.loadLanguageQueries()
   └─ QueryPatternExtractor.extractPatterns()
```

---

## 🚀 快速使用示例

### 基础查询
```typescript
import { TreeSitterQueryFacade } from './TreeSitterQueryFacade';

// 查找函数
const functions = await TreeSitterQueryFacade.findFunctions(ast, 'typescript');

// 查找多种类型
const results = await TreeSitterQueryFacade.findMultiple(ast, 'typescript', 
  ['functions', 'classes', 'imports']);
```

### 初始化 (当前)
```typescript
// 初始化系统
await GlobalQueryInitializer.initialize();

// 或者使用 QueryManager
await QueryManager.initialize();
```

### 初始化 (优化后)
```typescript
// 直接初始化注册表
await QueryRegistry.initialize();
```

### 获取性能统计
```typescript
const stats = TreeSitterQueryFacade.getPerformanceStats();
console.log(stats.cacheStats);      // 缓存命中率
console.log(stats.queryMetrics);    // 查询统计
```

---

## 📊 关键指标

### 当前状态
```
文件数:        15 个
代码行:        ~2500 行
依赖关系:      28 个 import
最深依赖链:    4 层
```

### 优化后
```
文件数:        11 个 (-27%)
代码行:        ~2050 行 (-18%)
依赖关系:      24 个 (-14%)
最深依赖链:    3 层 (-25%)
```

---

## ⚠️ 层次冗余清单

| 冗余项 | 原因 | 合并方案 | 优先级 |
|-------|------|--------|--------|
| QueryEngineFactory | 仅包装单例 | 合并到门面层 | 1️⃣ |
| GlobalQueryInitializer | 仅协调初始化 | 合并到注册表 | 1️⃣ |
| 查询缓存 (Manager) | 重复的 LRU | 统一到 QueryCache | 2️⃣ |
| CacheKeyGenerator | 仅被 Cache 使用 | 内嵌到 Cache | 3️⃣ |
| QueryTransformer | 已废弃 | 删除 | 0️⃣ |
| QueryRegistryCompatibility | 已废弃 | 删除 | 0️⃣ |

---

## 📋 立即行动清单

### 本周 (立即)
- [ ] 删除 QueryTransformer.ts
- [ ] 删除 QueryRegistryCompatibility.ts
- [ ] 运行测试确认无影响

### 下周
- [ ] 合并 QueryEngineFactory 到 TreeSitterQueryFacade
- [ ] 删除 QueryEngineFactory.ts
- [ ] 更新所有导入 (预计 2-3 处)
- [ ] 运行测试

### 2-3 周后
- [ ] 移动初始化逻辑到 QueryRegistry
- [ ] 删除 GlobalQueryInitializer.ts
- [ ] 更新初始化调用点 (预计 5-10 处)
- [ ] 完整集成测试

### 长期 (可选)
- [ ] 评估 QueryManager 简化的必要性
- [ ] 如有时间，执行简化

---

## 🔗 文档地图

```
README.md                           ← 完整系统说明
QUICK_REFERENCE.md (本文件)        ← 30秒快速理解
OPTIMIZATION_EXECUTIVE_SUMMARY.md  ← 优化方案摘要
LAYER_OPTIMIZATION_ANALYSIS.md     ← 详细分析
DEPENDENCY_ANALYSIS.md             ← 依赖关系图
GlobalQueryInitializer.md          ← 初始化设计
```

**推荐阅读顺序**:
1. 本文件 (5 分钟)
2. OPTIMIZATION_EXECUTIVE_SUMMARY.md (10 分钟)
3. LAYER_OPTIMIZATION_ANALYSIS.md (20 分钟)
4. DEPENDENCY_ANALYSIS.md (按需参考)

---

## 💾 代码大小影响

```
优先级 1 (删除废弃)
  ✓ -443 行 (第一时间可见收益)

优先级 2 (合并工厂)
  ✓ -35 行

优先级 3 (合并初始化)
  ✓ -86 行
  ⚠️ +80 行 (转移到 QueryRegistry)
  = -6 行

总计: -484 行 (-19%)
```

---

## 🎓 设计模式分析

### 当前使用的模式

| 模式 | 位置 | 评价 |
|------|------|------|
| **单例** | QueryEngineFactory | ⚠️ 冗余 (纯包装) |
| **门面** | TreeSitterQueryFacade | ✅ 良好 (简化 API) |
| **工厂** | QueryEngineFactory | ⚠️ 过度设计 |
| **初始化器** | GlobalQueryInitializer | ⚠️ 职责模糊 |
| **缓存** | QueryCache | ✅ 良好 (统一管理) |
| **注册表** | QueryRegistry | ✅ 良好 (查询存储) |

---

## ❓ FAQ

### Q1: 合并会影响性能吗?
**A**: 不会。合并仅涉及代码组织，不改变执行逻辑。

### Q2: 是否会影响现有 API?
**A**: TreeSitterQueryFacade 的公开 API 保持不变。内部优化不影响使用者。

### Q3: 需要多久完成?
**A**: 按优先级：
- 优先级 1+2: 6-10 小时
- 优先级 1+2+3: 12-18 小时
- 分阶段执行: 3-4 周

### Q4: 有什么风险?
**A**: 
- 优先级 1: 无风险
- 优先级 2: 低风险 (仅 2 个导入点)
- 优先级 3: 中风险 (多个初始化点)

### Q5: 是否必须做?
**A**: 不是。当前系统可正常工作。优化是为了：
- 简化代码维护
- 提升可读性
- 降低学习成本

---

## 🔗 相关文件

- **执行摘要**: OPTIMIZATION_EXECUTIVE_SUMMARY.md (推荐首先阅读)
- **详细分析**: LAYER_OPTIMIZATION_ANALYSIS.md
- **依赖分析**: DEPENDENCY_ANALYSIS.md
- **完整指南**: README.md

---

**版本**: 1.0  
**最后更新**: 2025-11-27

