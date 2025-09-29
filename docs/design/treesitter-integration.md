# Tree-sitter 集成设计文档

## 概述

本文档详细说明了代码搜索助手项目中Tree-sitter集成的设计和实现。Tree-sitter是一个解析器生成器工具和增量解析库，能够为源代码提供准确的语法分析。

## 架构设计

### 核心组件

1. **TreeSitterCoreService**: 核心解析服务，负责加载和管理不同语言的解析器
2. **TreeSitterService**: 对外提供的服务接口，封装核心功能
3. **ASTCodeSplitter**: 基于AST的代码分段器，使用Tree-sitter进行语法感知的代码分割

### 依赖关系

```
ASTCodeSplitter -> TreeSitterService -> TreeSitterCoreService
```

## 配置说明

### 环境变量配置

Tree-sitter集成支持通过环境变量进行配置：

```env
# 启用/禁用Tree-sitter功能
TREE_SITTER_ENABLED=true

# 缓存大小
TREE_SITTER_CACHE_SIZE=1000

# 解析超时时间（毫秒）
TREE_SITTER_TIMEOUT=30000

# 支持的语言列表
TREE_SITTER_SUPPORTED_LANGUAGES=typescript,javascript,python,java,go,rust,cpp,c
```

### 代码配置

在配置文件中也可以进行配置：

```typescript
{
  treeSitter: {
    enabled: true,
    cacheSize: 1000,
    timeout: 30000,
    supportedLanguages: ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp', 'c']
  }
}
```

## 支持的语言

当前版本支持以下编程语言：

- TypeScript
- JavaScript
- Python
- Java
- Go
- Rust
- C++
- C

## 功能特性

### 1. 语法感知代码分段

ASTCodeSplitter使用Tree-sitter的语法树来识别代码中的函数、类和其他结构，确保分段不会切断重要的代码结构。

### 2. 缓存机制

为了提高性能，Tree-sitter集成实现了LRU缓存机制，缓存解析结果以避免重复解析相同的代码。

### 3. 错误处理和回退

当Tree-sitter解析失败时，系统会自动回退到简单的行分割策略，确保服务的稳定性。

### 4. 性能监控

集成了性能统计功能，可以监控解析时间、缓存命中率等关键指标。

## 使用示例

### 基本用法

```typescript
import { diContainer } from './core/DIContainer';
import { TYPES } from './types';
import { ASTCodeSplitter } from './service/parser/splitting/ASTCodeSplitter';

// 获取ASTCodeSplitter实例
const astSplitter = diContainer.get<ASTCodeSplitter>(TYPES.ASTCodeSplitter);

// 分割代码
const code = `
function hello(name: string): string {
  return "Hello, " + name;
}
`;

const chunks = await astSplitter.split(code, 'typescript');
```

### 配置自定义分段大小

```typescript
// 设置分段大小和重叠
astSplitter.setChunkSize(2000);
astSplitter.setChunkOverlap(200);
```

## 性能优化

### 缓存策略

Tree-sitter集成使用LRU缓存来存储解析结果，默认缓存大小为1000个条目，缓存时间1小时。

### 批量处理

对于大量代码的处理，建议使用批量处理模式以提高效率。

## 监控和日志

### 性能统计

可以通过以下方法获取性能统计信息：

```typescript
const performanceStats = treeSitterService.getPerformanceStats();
console.log('Parse time stats:', performanceStats);
```

### 缓存统计

```typescript
const cacheStats = treeSitterService.getCacheStats();
console.log('Cache stats:', cacheStats);
```

## 故障排除

### 常见问题

1. **语言不支持**: 确保请求的语言在支持列表中
2. **解析超时**: 增加超时配置或检查代码复杂度
3. **内存不足**: 调整缓存大小或增加系统内存

### 日志信息

系统会记录详细的日志信息，包括：
- 解析成功/失败
- 缓存命中/未命中
- 性能统计
- 错误信息

## 未来扩展

### 计划支持的语言

- C#
- Scala
- PHP
- Ruby

### 功能增强

- 更精细的代码结构识别
- 跨文件引用分析
- 代码质量度量