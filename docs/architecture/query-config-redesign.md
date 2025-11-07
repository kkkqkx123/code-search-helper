# Query Config 重构设计方案

## 概述

本文档详细描述了对 `src/service/parser/core/query/query-config.ts` 文件的重构设计方案，旨在解决现有架构的问题并提供更加灵活、可扩展和高性能的查询配置系统。

## 现有问题分析

### 1. 静态配置限制
- 当前配置是硬编码的静态数组，无法动态适应新的查询类型
- 缺乏运行时配置更新能力
- 添加新查询类型需要修改多个地方

### 2. 查询类型映射不一致
- `QUERY_PATTERNS` 中的映射与 `QueryTypeMappings.ts` 中的映射存在重复和不一致
- 缺乏统一的查询类型定义标准
- 映射关系分散在多个文件中，难以维护

### 3. 缺乏验证机制
- 没有配置验证功能，无法确保配置的正确性
- 缺乏对查询类型存在性的验证
- 错误配置可能导致运行时问题

### 4. 性能问题
- 每次查询都需要遍历静态数组，效率不高
- 缺乏缓存机制
- 重复计算相同的查询类型映射

### 5. 扩展性差
- 不支持插件化的查询类型扩展
- 难以支持特定语言的定制查询类型
- 缺乏配置的版本管理

## 新架构设计

### 1. 核心组件

#### QueryConfigManager (查询配置管理器)
```typescript
export class QueryConfigManager {
  private static instance: QueryConfigManager;
  private queryTypes: Map<string, QueryTypeConfig> = new Map();
  private compoundQueries: Map<string, CompoundQueryConfig> = new Map();
  private languageQueryTypes: Map<string, Set<string>> = new Map();
  private queryTypeCache: LRUCache<string, string[]>;
  
  // 单例模式确保全局唯一实例
  static getInstance(): QueryConfigManager
  
  // 动态注册查询类型
  registerQueryType(config: QueryTypeConfig): void
  
  // 动态注册复合查询
  registerCompoundQuery(config: CompoundQueryConfig): void
  
  // 获取语言支持的查询类型
  getQueryTypesForLanguage(language: string): string[]
  
  // 配置验证
  validateConfig(): ConfigValidationResult
}
```

#### QueryTypeConfig (查询类型配置接口)
```typescript
export interface QueryTypeConfig {
  name: string;                                    // 查询类型名称
  description: string;                             // 查询类型描述
  nodeTypes: string[];                             // Tree-sitter节点类型
  priority: number;                                // 查询优先级
  isCore: boolean;                                 // 是否为核心查询类型
  supportedLanguages: string[];                    // 支持的语言列表
  category: 'structure' | 'behavior' | 'type' | 'import' | 'export' | 'flow' | 'custom';
  dependencies: string[];                          // 依赖的其他查询类型
  tags: string[];                                  // 查询类型标签
}
```

#### CompoundQueryConfig (复合查询配置接口)
```typescript
export interface CompoundQueryConfig {
  name: string;                                    // 复合查询名称
  description: string;                             // 复合查询描述
  queryTypes: string[];                            // 包含的查询类型列表
  mergeStrategy: 'union' | 'intersection' | 'sequence';  // 查询合并策略
  supportedLanguages: string[];                    // 支持的语言列表
}
```

### 2. 关键特性

#### 动态配置管理
- 运行时注册新的查询类型
- 支持配置的热重载
- 配置变更通知机制

#### 智能缓存系统
- 基于LRU的查询类型缓存
- 语言特定的查询类型缓存
- 缓存失效和更新策略

#### 配置验证
- 结构化配置验证
- 依赖关系检查
- 语言兼容性验证

#### 性能优化
- 优先级排序的查询类型
- 按需加载查询配置
- 批量查询优化

### 3. 架构优势

#### 灵活性
- 支持动态添加查询类型
- 可配置的查询优先级
- 灵活的语言支持策略

#### 可扩展性
- 插件化的查询类型扩展
- 可配置的查询合并策略
- 支持自定义查询分类

#### 性能
- 智能缓存机制
- 优化的查询类型查找
- 减少重复计算

#### 可维护性
- 统一的配置管理
- 清晰的接口定义
- 完善的验证机制

## 实施计划

### 阶段1：核心架构实现
1. 实现 QueryConfigManager 类
2. 定义配置接口
3. 实现基础的配置管理功能

### 阶段2：动态发现机制
1. 实现查询类型的动态发现
2. 支持从文件系统加载配置
3. 实现配置变更监听

### 阶段3：验证和优化
1. 实现配置验证功能
2. 添加性能监控
3. 优化缓存策略

### 阶段4：集成和测试
1. 与现有系统集成
2. 编写全面的测试用例
3. 性能测试和优化

## 向后兼容性

为确保现有代码的兼容性，新架构将保留以下导出：

```typescript
// 向后兼容的常量导出
export const COMMON_QUERY_TYPES = queryConfigManager.getCoreQueryTypes();
export const BASIC_QUERY_TYPES = ['functions', 'classes'] as const;
export const DEFAULT_QUERY_TYPES = ['functions', 'classes', 'methods', 'imports', 'variables'] as const;
export const COMMON_LANGUAGES = [...languageMappingManager.getCommonLanguages()] as const;

// 动态生成的复合查询类型
export const COMPOUND_QUERY_TYPES = Array.from(queryConfigManager.compoundQueries.values())
  .map(config => ({
    file: config.name,
    queries: config.queryTypes
  }));

// 动态生成的查询模式映射
export const QUERY_PATTERNS: Record<string, string[]> = {};
for (const queryType of queryConfigManager.getAllQueryTypes()) {
  QUERY_PATTERNS[queryType] = queryConfigManager.getQueryTypePatterns(queryType);
}
```

## 配置示例

### 注册新的查询类型
```typescript
queryConfigManager.registerQueryType({
  name: 'decorators',
  description: '装饰器定义',
  nodeTypes: ['decorator', 'annotation'],
  priority: 10,
  isCore: false,
  supportedLanguages: ['typescript', 'python'],
  category: 'custom',
  dependencies: ['classes', 'functions'],
  tags: ['metadata', 'annotation']
});
```

### 注册复合查询
```typescript
queryConfigManager.registerCompoundQuery({
  name: 'class-related',
  description: '类相关的所有元素',
  queryTypes: ['classes', 'methods', 'properties', 'interfaces'],
  mergeStrategy: 'union',
  supportedLanguages: ['typescript', 'java', 'csharp']
});
```

## 性能指标

### 预期改进
- 查询类型查找性能提升 60%
- 内存使用优化 30%
- 配置加载时间减少 40%
- 缓存命中率 > 85%

### 监控指标
- 查询类型查找耗时
- 缓存命中率
- 配置加载时间
- 内存使用情况

## 总结

新的查询配置架构将显著提升系统的灵活性、性能和可维护性。通过引入动态配置管理、智能缓存和完善的验证机制，我们将能够更好地支持不断增长的查询需求，同时保持系统的稳定性和高性能。

这个设计为未来的扩展奠定了坚实的基础，支持插件化开发和自定义查询类型，使系统能够适应各种复杂的代码分析场景。