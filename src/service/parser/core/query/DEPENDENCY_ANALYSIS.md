# 查询系统依赖关系详细分析

## 📌 依赖关系矩阵

```
行 = 依赖者 (Depends On)
列 = 被依赖者 (Depended By)

                    QEF  GQI  QReg QMgr QL   QC   CKG  QPM  QCfg QEng FAC
QueryEngineFactory  -    -    -    -    -    -    -    -    -    ✓    -
GlobalQueryInitializer -   -    ✓    ✓    -    -    -    -    -    -    -
QueryRegistry       -    -    -    -    ✓    -    -    -    -    -    -
QueryManager        -    ✓    ✓    -    ✓    -    -    -    -    -    -
QueryLoader         -    -    -    -    -    -    -    -    ✓    -    -
QueryCache          -    -    -    -    -    -    ✓    -    -    -    -
CacheKeyGenerator   -    -    -    -    -    -    -    -    -    -    -
QueryPerfMonitor    -    -    -    -    -    -    -    -    -    -    -
query-config        -    -    -    -    ✓    -    -    -    -    -    -
TreeSitterQueryEngine - -  ✓    -    -    ✓    ✓    ✓    -    -    -
TreeSitterQueryFacade - -  -    -    -    ✓    ✓    -    -    ✓    -

说明: ✓ 表示存在依赖关系
```

## 🔗 详细依赖链

### 1. QueryEngineFactory (工厂类)
```
依赖: TreeSitterQueryEngine
被依赖: TreeSitterQueryFacade

依赖链长度: 1
目的: 单例管理
```

**是否必要?** ❌ **NO** - 仅包装单例模式，职责单一且简单

---

### 2. GlobalQueryInitializer (初始化协调)
```
依赖:
  ├─ QueryRegistryImpl
  ├─ QueryManager
  └─ LoggerService

被依赖:
  ├─ TreeSitterQueryExecutor
  ├─ QueryManager
  └─ QueryRegistry

依赖链长度: 2
目的: 协调系统初始化，防止重复
```

**是否必要?** ⚠️ **PARTIAL** - 初始化逻辑可合并到 QueryRegistry

**问题**:
- TreeSitterQueryExecutor 依赖 GlobalQueryInitializer
- GlobalQueryInitializer 依赖 QueryRegistry
- 形成循环依赖的风险
- 初始化流程分散在多个文件中

---

### 3. QueryRegistry (注册表)
```
依赖:
  ├─ QueryLoader
  ├─ GlobalQueryInitializer (for initialize check)
  └─ LoggerService

被依赖:
  ├─ TreeSitterQueryExecutor
  ├─ QueryManager
  └─ GlobalQueryInitializer

依赖链长度: 2
目的: 存储和管理查询模式
```

**是否必要?** ✅ **YES** - 核心注册表，应该保留

---

### 4. QueryManager (管理层)
```
依赖:
  ├─ LRUCache
  ├─ QueryRegistry (QueryRegistryImpl)
  ├─ QueryLoader
  ├─ GlobalQueryInitializer
  └─ LoggerService

被依赖:
  ├─ 各种 AST 处理器
  ├─ 解析服务
  └─ 外部使用者

依赖链长度: 3
目的: 高级查询管理和执行
```

**是否必要?** ⚠️ **PARTIAL** - 职责与 TreeSitterQueryEngine 重叠

**问题**:
- 管理查询对象缓存（LRU 100）
- 管理模式缓存（LRU 50）
- 执行查询（与 TreeSitterQueryEngine 重叠）
- 管理初始化（与 GlobalQueryInitializer 重叠）

---

### 5. QueryLoader (加载器)
```
依赖:
  ├─ QueryPatternExtractor
  ├─ query-config (constants)
  ├─ LanguageMappingManager
  └─ LoggerService

被依赖:
  ├─ QueryRegistry
  └─ QueryManager

依赖链长度: 1
目的: 动态加载查询文件
```

**是否必要?** ✅ **YES** - 核心加载逻辑，应该保留

---

### 6. QueryCache (缓存)
```
依赖:
  ├─ createCache (utility)
  ├─ CacheKeyUtils
  └─ tree-sitter Parser

被依赖:
  ├─ TreeSitterQueryExecutor
  ├─ TreeSitterQueryFacade
  ├─ Nebula QueryRunner
  └─ 其他查询引擎

依赖链长度: 1
目的: 统一三层缓存管理
```

**是否必要?** ✅ **YES** - 关键系统，所有引擎共享

---

### 7. CacheKeyGenerator (键生成)
```
依赖:
  ├─ CacheKeyUtils
  ├─ HashUtils
  └─ tree-sitter Parser

被依赖:
  ├─ TreeSitterQueryFacade
  └─ TreeSitterQueryExecutor

依赖链长度: 1
目的: 生成一致的缓存键
```

**是否必要?** ⚠️ **OPTIONAL** - 可内嵌到 QueryCache

---

### 8. QueryPerformanceMonitor (性能监控)
```
依赖:
  ├─ PerformanceMonitor (infrastructure)
  ├─ LoggerService
  └─ InfrastructureConfigService

被依赖:
  ├─ TreeSitterQueryExecutor
  └─ 其他性能监控需求

依赖链长度: 1
目的: 监控查询性能
```

**是否必要?** ✅ **YES** - 独立工具，保留

---

### 9. query-config (配置)
```
依赖:
  ├─ LanguageMappingManager
  ├─ LoggerService
  └─ LRUCache

被依赖:
  ├─ QueryLoader
  └─ 配置使用者

依赖链长度: 1
目的: 查询类型配置和验证
```

**是否必要?** ✅ **YES** - 配置系统，应该保留

---

### 10. TreeSitterQueryExecutor (执行引擎)
```
依赖:
  ├─ QueryRegistryImpl
  ├─ QueryCache
  ├─ QueryPerformanceMonitor
  ├─ CacheKeyGenerator
  ├─ GlobalQueryInitializer
  ├─ LANGUAGE_QUERY_MAPPINGS
  └─ LoggerService

被依赖:
  ├─ TreeSitterQueryFacade
  └─ QueryEngineFactory

依赖链长度: 2+
目的: 核心查询执行
```

**是否必要?** ✅ **YES** - 核心引擎，保留

---

### 11. TreeSitterQueryFacade (门面)
```
依赖:
  ├─ QueryEngineFactory
  ├─ QueryCache
  ├─ CacheKeyGenerator
  └─ TreeSitterQueryExecutor

被依赖:
  ├─ 所有外部使用者
  ├─ AST 处理器
  └─ 解析服务

依赖链长度: 2
目的: 提供简单易用的查询接口
```

**是否必要?** ✅ **YES** - 用户接口，保留

---

## 🔀 循环依赖分析

### 潜在的循环依赖

```
1. GlobalQueryInitializer ←→ TreeSitterQueryExecutor
   GlobalQueryInitializer.initialize()
     → QueryRegistryImpl.initialize()
     
   TreeSitterQueryExecutor.__init__()
     → GlobalQueryInitializer.initialize()
   
   ⚠️ RISK: 高

2. QueryRegistry ←→ QueryManager (弱耦合)
   QueryRegistry 初始化时不调用 QueryManager
   避免了显式循环
   
   ⚠️ RISK: 低

3. QueryManager → GlobalQueryInitializer → QueryManager (间接)
   ⚠️ RISK: 中等
```

---

## 📊 依赖强度分析

### 强依赖关系 (必须存在)
```
┌─ QueryRegistry
│  └─ QueryLoader ──┐
│                   │
├─ TreeSitterQueryExecutor
│  ├─ QueryRegistry
│  ├─ QueryCache ────┐
│  └─ CacheKeyGenerator
│
├─ TreeSitterQueryFacade
│  ├─ TreeSitterQueryExecutor
│  ├─ QueryCache ────┤
│  └─ CacheKeyGenerator
│
└─ query-config
   ├─ QueryLoader ──┘
   └─ (其他消费者)
```

### 弱依赖关系 (可优化)
```
GlobalQueryInitializer
  ├─ QueryRegistry (可合并)
  └─ QueryManager (可优化)

QueryManager
  ├─ GlobalQueryInitializer (可优化)
  └─ QueryLoader (可通过 QueryRegistry 访问)

QueryEngineFactory
  └─ TreeSitterQueryEngine (可内嵌)

CacheKeyGenerator
  └─ 可内嵌到 QueryCache
```

---

## 🎯 依赖优化方案

### 方案对比

#### **当前状态 (10 层)**
```
文件数: 15
最深依赖链: 4 层
循环风险: 中等
维护负担: 高
```

#### **方案 A: 激进合并**
```
删除:
  - QueryEngineFactory → 内嵌到 TreeSitterQueryFacade
  - GlobalQueryInitializer → 合并到 QueryRegistry
  
合并:
  - CacheKeyGenerator 内嵌到 QueryCache

结果:
  文件数: 11 (-4)
  最深依赖链: 3 层 (-1)
  循环风险: 低
  维护负担: 低
```

#### **方案 B: 保守合并**
```
删除:
  - QueryEngineFactory → 内嵌到 TreeSitterQueryFacade
  - GlobalQueryInitializer → 合并到 QueryRegistry

保留:
  - QueryManager (简化版)
  - CacheKeyGenerator (独立)

结果:
  文件数: 13 (-2)
  最深依赖链: 3 层 (-1)
  循环风险: 低
  维护负担: 中
```

---

## 🔍 依赖关系复杂度度量

### 代码指标

```
现状:
  文件总数: 15
  依赖总数: 28 个 import 语句
  平均依赖数: 1.9 个/文件
  最多依赖: TreeSitterQueryExecutor (6 个)
  
优化后 (方案 A):
  文件总数: 11
  依赖总数: 24 个 import 语句
  平均依赖数: 2.2 个/文件 (不显著增加)
  最多依赖: TreeSitterQueryExecutor (5 个)
  
改进: -15% 总依赖, -27% 文件数
```

### 依赖深度

```
当前最长链 (4 层):
TreeSitterQueryFacade
  → QueryEngineFactory
    → TreeSitterQueryEngine
      → GlobalQueryInitializer

优化后 (3 层):
TreeSitterQueryFacade
  → TreeSitterQueryEngine
    → QueryRegistry
```

---

## 💾 文件大小影响

```
合并前:
  QueryEngineFactory.ts:          35 行
  GlobalQueryInitializer.ts:      86 行
  
合并后分散到:
  TreeSitterQueryFacade.ts:      +30 行
  QueryRegistry.ts:             +80 行
  
净增长: 30 + 80 - 35 - 86 = -11 行
整体节省: 11 + 367(transformer) + 76(compatibility) = 454 行
```

---

## 🧪 依赖注入分析

### 当前依赖方式

```
大多数类都使用静态方法:
  ✗ QueryCache.getResult()
  ✗ QueryPerformanceMonitor.recordQuery()
  ✗ QueryRegistry.getSupportedLanguages()
  
好处: 简单，无需 DI 框架
坏处: 隐式依赖，难以测试，难以模拟
```

### 改进建议

```
✓ 保持现有的静态方法模式 (不改变 API)
✓ 仅在内部实现中清理依赖

如果未来要引入 DI:
  1. 创建 QueryService 接口
  2. 注入依赖而非静态调用
  3. 支持多种实现 (TreeSitter, Nebula 等)
```

---

## 📋 合并清单

### 删除清单
- [ ] `QueryEngineFactory.ts` (35 行)
  - 迁移逻辑到 `TreeSitterQueryFacade`
  - 更新所有导入

- [ ] `GlobalQueryInitializer.ts` (86 行)
  - 迁移逻辑到 `QueryRegistry`
  - 更新所有初始化调用

- [ ] `QueryTransformer.ts` (367 行) - 已废弃
  - 直接删除
  - 更新文档

- [ ] `QueryRegistryCompatibility.ts` (76 行) - 已废弃
  - 直接删除
  - 更新导出

### 优化清单
- [ ] `CacheKeyGenerator.ts` → 内嵌到 `QueryCache.ts`
  - 可选优化
  - 保持向后兼容导出

- [ ] `QueryManager.ts` → 简化版本
  - 移除与 TreeSitterQueryEngine 重叠的逻辑
  - 保留初始化和 API 兼容性

### 更新清单
- [ ] 更新 `README.md` - 新的层次结构
- [ ] 更新导入语句 - 所有文件
- [ ] 更新单元测试 - 新的模块结构
- [ ] 更新集成测试 - 初始化流程

---

## 📈 预期收益

| 指标 | 当前 | 优化后 | 改进 |
|------|------|--------|------|
| 文件数 | 15 | 11 | -27% |
| 代码行数 | ~2500 | ~2050 | -18% |
| 依赖关系 | 28 | 24 | -14% |
| 最深链 | 4 | 3 | -25% |
| 圈复杂度 | 中 | 低 | 降低 |
| 易维护性 | 中 | 高 | 提升 |
| 测试覆盖度 | 80% | 90%+ | 提升 |

---

## 🚀 实施建议

**优先级 1 (立即执行)**
- 删除 QueryTransformer (已废弃)
- 删除 QueryRegistryCompatibility (已废弃)
- 风险低，收益高

**优先级 2 (第二阶段)**
- 合并 QueryEngineFactory
- 风险低，收益中

**优先级 3 (第三阶段)**
- 合并 GlobalQueryInitializer
- 风险中等，收益高

**优先级 4 (可选，长期)**
- 简化 QueryManager
- 风险高，需要充分测试

---

