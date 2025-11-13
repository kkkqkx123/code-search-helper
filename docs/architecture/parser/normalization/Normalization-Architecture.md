# Normalization 模块架构设计文档

## 1. 概述

Normalization 模块是代码搜索助手解析系统中的标准化层，负责将不同编程语言的 tree-sitter 查询结果转换为统一的数据格式。该模块采用分层架构和策略模式，确保系统能够处理多种编程语言，同时提供高性能和可扩展性。

## 2. 架构设计

### 2.1 核心架构模式
- **策略模式**: 通过 LanguageAdapter 接口为不同编程语言提供特定的标准化策略
- **模板方法模式**: BaseLanguageAdapter 提供标准化流程的骨架，具体实现由子类完成
- **组合模式**: ContentAnalyzer 作为高层协调器，组合多个分析组件
- **缓存模式**: 各组件均内置缓存机制以提高性能

### 2.2 架构层次
1. **高层协调层** (ContentAnalyzer)
2. **标准化协调层** (QueryResultNormalizer) 
3. **语言特定处理层** (Language Adapters)
4. **结构提取层** (ASTStructureExtractor, RelationshipAnalyzer, TextPatternAnalyzer)
5. **基础工具层** (Utils, Types)

## 3. 模块职能划分

### 3.1 QueryResultNormalizer
- **职责**: 协调整个标准化过程，管理缓存和性能监控
- **功能**: 
  - 调用 tree-sitter 执行查询
  - 根据语言类型选择相应的语言适配器
  - 处理并行查询执行
  - 统计信息收集
  - 降级处理机制

### 3.2 语言适配器 (Language Adapters)
- **职责**: 提供特定编程语言的标准化逻辑
- **功能**:
  - 将语言特定的查询结果转换为统一格式
  - 提取节点名称、类型映射
  - 计算复杂度、提取依赖关系
  - 处理语言特定的元数据
- **代表实现**: JavaScriptLanguageAdapter, TypeScriptLanguageAdapter, JavaLanguageAdapter, PythonLanguageAdapter 等

### 3.3 BaseLanguageAdapter
- **职责**: 提供标准化的框架和通用逻辑
- **功能**:
  - 模板方法实现标准化流程
  - 缓存管理
  - 错误处理和恢复
  - 预处理和后处理
  - 提供通用工具方法

### 3.4 ASTStructureExtractor
- **职责**: 从标准化结果中提取代码结构
- **功能**:
  - 提取顶级结构（类、函数、接口等）
  - 提取嵌套结构（方法、内部类等）
  - 提取内部结构（变量、表达式等）
  - 与 QueryResultNormalizer 集成获取标准化结果

### 3.5 RelationshipAnalyzer
- **职责**: 分析代码结构间的关系
- **功能**:
  - 嵌套关系分析（包含、继承、实现）
  - 引用关系分析（函数调用、变量引用）
  - 依赖关系分析（导入、依赖）
  - 构建调用图、继承图、依赖图

### 3.6 TextPatternAnalyzer
- **职责**: 基于文本模式的降级分析
- **功能**:
  - 当 AST 分析失败时提供备选方案
  - 基于正则表达式的结构提取
  - 语言检测和复杂度分析

### 3.7 ContentAnalyzer
- **职责**: 高层协调器，提供统一接口
- **功能**:
  - 组合 ASTStructureExtractor、RelationshipAnalyzer、TextPatternAnalyzer
  - 提供一次性提取所有结构的接口
  - 管理缓存和性能监控
  - 错误处理和降级策略

### 3.8 通用工具和类型
- **Types**: 定义标准化数据格式和接口
- **Utils**: 提供辅助功能（如 MetadataBuilder、NodeIdGenerator）
- **Config**: 配置管理
- **Adapters**: 语言适配器实现

## 4. 整体工作流程

### 4.1 标准化流程 (标准路径)
```
1. ContentAnalyzer.extractAllStructures() (高层入口)
2. → ASTStructureExtractor.extractTopLevelStructuresFromAST() 等
3. → QueryResultNormalizer.normalize() 
4. → LanguageAdapterFactory.getAdapter() (获取语言适配器)
5. → JavaScriptLanguageAdapter.normalize() (具体语言适配器)
6. → BaseLanguageAdapter.normalize() (基础标准化流程)
7. → 生成 StandardizedQueryResult[]
8. → 返回给 ContentAnalyzer
9. → ContentAnalyzer 返回统一格式结果
```

### 4.2 查询执行流程
```
1. QueryResultNormalizer.normalize(ast, language)
2. → QueryManager.getQueryString() (获取语言特定查询)
3. → TreeSitterCoreService.getParser() (获取解析器)
4. → QueryManager.executeQuery() (执行 tree-sitter 查询)
5. → 获取原始查询结果
6. → 调用相应语言适配器的 normalize() 方法
7. → 适配器进行语言特定标准化
8. → 返回标准化结果
```

### 4.3 降级处理流程
当某个环节失败时:
```
1. 首选: QueryResultNormalizer + LanguageAdapter
2. 降级1: TextPatternAnalyzer (基于文本模式)
3. 降级2: Basic AST traversal (简单遍历)
4. 降级3: Fallback results (返回基本结果)
```

### 4.4 缓存流程
```
1. ContentAnalyzer.generateCacheKey()
2. → 检查缓存是否存在
3. → 如果存在，直接返回缓存结果
4. → 如果不存在，执行分析流程
5. → 分析完成后，将结果存入缓存
6. → 同时各子模块也有自己的缓存机制
```

### 4.5 性能监控流程
```
1. 各模块记录执行时间
2. 性能监控器收集指标
3. 缓存命中率统计
4. 错误率和恢复统计
5. 内存使用情况
6. 统一报告给上层模块
```

## 5. 设计优势

1. **可扩展性**: 通过语言适配器模式轻松支持新语言
2. **性能**: 多层缓存机制和并行处理
3. **可靠性**: 完善的降级处理和错误恢复机制
4. **可维护性**: 清晰的职责分离和模块化设计
5. **一致性**: 统一的标准化输出格式

## 6. 依赖关系

```
ContentAnalyzer 
├── ASTStructureExtractor
├── RelationshipAnalyzer  
├── TextPatternAnalyzer
└── QueryResultNormalizer
    ├── Language Adapters
    └── BaseLanguageAdapter
```

这种分层架构确保了各组件职责清晰，协作高效，为系统提供了坚实的基础。