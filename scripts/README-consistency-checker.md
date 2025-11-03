# 适配器、查询规则和图映射一致性检查脚本

## 概述

这个脚本用于检查项目中三个关键组件之间的一致性：

1. **语言适配器** (`src/service/parser/core/normalization/adapters`)
2. **查询规则** (`src/service/parser/constants/queries`)
3. **图映射定义** (`src/service/graph/mapping/LanguageNodeTypes.ts`)

## 功能

脚本会检查以下类型的一致性问题：

- **缺失组件**: 某种语言缺少适配器、查询规则或图映射定义
- **查询类型不匹配**: 适配器支持的查询类型与查询规则中的类型不一致
- **节点类型不匹配**: 查询规则中使用的节点类型在图映射中未定义
- **映射类别不匹配**: 适配器中的节点类型映射到不存在的图映射类别

## 使用方法

### 检查所有语言

```bash
npx ts-node scripts/check-adapter-query-mapping-consistency.ts
```

### 检查特定语言

```bash
# 使用长选项
npx ts-node scripts/check-adapter-query-mapping-consistency.ts --language=javascript

# 使用短选项
npx ts-node scripts/check-adapter-query-mapping-consistency.ts -l=typescript
```

### 显示帮助信息

```bash
npx ts-node scripts/check-adapter-query-mapping-consistency.ts --help
```

## 支持的语言

目前支持检查以下编程语言：

- `javascript` - JavaScript
- `typescript` - TypeScript
- `python` - Python
- `java` - Java
- `go` - Go
- `rust` - Rust
- `c` - C
- `cpp` - C++
- `csharp` - C#
- `kotlin` - Kotlin
- `html` - HTML
- `css` - CSS
- `vue` - Vue

## 输出说明

脚本会输出详细的检查报告，包括：

### 问题类型

- ❌ **错误**: 需要立即修复的严重问题
- ⚠️ **警告**: 建议检查的问题

### 报告结构

```
=== 一致性检查报告 ===

发现 X 个问题 (Y 个错误, Z 个警告)

📝 语言名:
  ❌/⚠️ 问题描述

=== 总结 ===
❌ 发现 Y 个错误，需要修复
⚠️ 发现 Z 个警告，建议检查
```

### 常见问题示例

1. **缺少适配器**
   ```
   ❌ 缺少 rust 语言的适配器
   ```

2. **查询类型不匹配**
   ```
   ⚠️ 适配器支持的查询类型 'functions' 在查询规则中未找到
   ```

3. **节点类型未定义**
   ```
   ⚠️ 查询规则中使用的节点类型 'class_declaration' 在图映射中未定义
   ```

4. **映射类别不匹配**
   ```
   ⚠️ 适配器中的节点类型 'function_declaration' 映射到类别 'function'，但该类别在图映射中未定义
   ```

## 退出码

- `0`: 没有发现错误（可能有警告）
- `1`: 发现错误或脚本执行失败

## 集成到CI/CD

可以将此脚本集成到CI/CD流水线中，确保代码变更不会破坏组件间的一致性：

```yaml
# GitHub Actions 示例
- name: Check consistency
  run: |
    npx ts-node scripts/check-adapter-query-mapping-consistency.ts
```

## 故障排除

### 找不到语言

如果检查特定语言时显示"未找到语言"，请确认：

1. 语言名称拼写正确（使用小写）
2. 该语言确实存在于项目中
3. 使用 `--help` 查看支持的语言列表

### 权限问题

如果遇到权限问题，请确保：

1. 有读取项目文件的权限
2. 有执行脚本的权限
3. Node.js 和 ts-node 已正确安装

## 开发指南

### 添加新语言支持

要为新语言添加一致性检查：

1. 在 `adapters` 目录创建语言适配器
2. 在 `queries` 目录创建查询规则文件
3. 在 `LanguageNodeTypes.ts` 中添加图映射定义
4. 脚本会自动检测新语言

### 扩展检查规则

要添加新的检查规则，修改 `ConsistencyChecker` 类中的相应方法：

- `checkMissingComponents()` - 检查缺失组件
- `checkAdapterQueryConsistency()` - 检查适配器与查询规则一致性
- `checkQueryMappingConsistency()` - 检查查询规则与图映射一致性
- `checkAdapterMappingConsistency()` - 检查适配器与图映射一致性

## 相关文件

- `src/service/parser/core/normalization/adapters/` - 语言适配器目录
- `src/service/parser/constants/queries/` - 查询规则目录
- `src/service/graph/mapping/LanguageNodeTypes.ts` - 图映射定义文件