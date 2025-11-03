# 图索引实现计划概述

## 概述

本文档提供了图索引功能的高层次实现计划概述。详细的实现指南请参考 [实现指南](./implementation-guide.md)。

## 实现目标

基于现有项目结构，实现代码图索引功能，将代码结构转换为图数据库中的节点和边，支持代码关系分析和可视化。

## 核心设计要点

### 1. 图数据库 Schema

设计了以下节点类型和边类型来表示代码结构：

**节点类型**:
- `File`: 源代码文件
- `Class`: 类定义
- `Function`: 函数或方法
- `Interface`: 接口定义
- `Import`: 导入语句
- `Export`: 导出语句

**边类型**:
- `CONTAINS`: 包含关系
- `IMPORTS_FROM`: 导入关系
- `CALLS`: 调用关系
- `INHERITS_FROM`: 继承关系
- `IMPLEMENTS`: 实现关系

### 2. 架构设计

充分利用现有组件：
- `IndexService`: 索引流程编排
- `TreeSitterService`: AST 解析
- `TreeSitterQueryEngine`: 查询执行
- `NebulaService`: 图数据库操作

新增组件：
- `GraphMapperService`: 查询结果到图元素的映射

### 3. 查询规则扩展

基于现有的 `QueryTypeMappings.ts` 和查询模式，添加图索引特定的查询类型：
- `graph-classes`: 类和接口
- `graph-functions`: 函数和方法
- `graph-calls`: 函数调用
- `graph-imports`: 导入语句
- `graph-exports`: 导出语句

## 实现阶段

### 阶段一：核心服务实现
- 创建 `GraphMapperService`
- 实现查询结果到图元素的映射逻辑

### 阶段二：服务扩展
- 扩展 `TreeSitterQueryEngine` 支持图索引查询
- 扩展 `IndexingLogicService` 集成图索引流程
- 扩展 `NebulaService` 支持批量操作

### 阶段三：集成与协调
- 扩展 `IndexService` 集成图索引
- 扩展 `GraphIndexService` 优化性能

## 关键实现细节

详细的代码实现和配置请参考 [实现指南](./implementation-guide.md)，该文档包含：
- 完整的 Schema 设计
- 详细的架构图和数据流
- 具体的查询规则示例
- 完整的代码实现示例
- 性能优化策略
- 错误处理和恢复机制

## 下一步行动

1. 阅读 [实现指南](./implementation-guide.md) 了解完整实现细节
2. 运行 `scripts/setup-graph-schema.ts` 初始化图数据库 Schema
3. 按照实现指南中的步骤逐步实现各个组件
4. 进行测试和优化

## 相关文档

- [实现指南](./implementation-guide.md) - 综合性实现指南
- [架构设计](./index-design.md) - 详细架构设计
- [查询规则设计](./rule-design.md) - 查询规则详细设计
- [代码设计](./code-design.md) - 具体代码实现设计