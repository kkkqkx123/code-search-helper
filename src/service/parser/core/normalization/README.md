# 查询结果标准化转换系统

## 概述

查询结果标准化转换系统解决了当前查询规则类型常量与tree-sitter解析结果之间的匹配问题。该系统将不同语言的tree-sitter查询结果转换为统一格式，使分割模块能够充分利用tree-sitter的精确语法分析能力。

## 核心组件

### 1. QueryResultNormalizer
查询结果标准化器，负责将tree-sitter查询结果转换为统一格式。

```typescript
import { QueryResultNormalizer } from './QueryResultNormalizer';

const normalizer = new QueryResultNormalizer({
  enableCache: true,
  debug: true
});

const results = await normalizer.normalize(ast, 'typescript');
```

### 2. LanguageAdapter
语言适配器，处理特定语言的查询结果标准化。

```typescript
import { TypeScriptLanguageAdapter } from './adapters/TypeScriptLanguageAdapter';
import { PythonLanguageAdapter } from './adapters/PythonLanguageAdapter';

const tsAdapter = new TypeScriptLanguageAdapter();
const results = tsAdapter.normalize(queryResults, 'functions', 'typescript');
```

### 3. StructureAwareSplitter
结构感知分割器，基于标准化查询结果进行智能分割。

```typescript
import { StructureAwareSplitter } from '../../splitting/strategies/StructureAwareSplitter';

const splitter = new StructureAwareSplitter();
splitter.setQueryNormalizer(normalizer);
splitter.setTreeSitterService(treeSitterService);

const chunks = await splitter.split(code, 'typescript');
```

## 使用方法

### 基本使用

```typescript
import { 
  createQueryResultNormalizer, 
  getLanguageAdapter 
} from './index';

// 创建标准化器
const normalizer = createQueryResultNormalizer({
  enableCache: true,
  debug: false
});

// 获取语言适配器
const adapter = await getLanguageAdapter('typescript');

// 标准化查询结果
const results = await normalizer.normalize(ast, 'typescript');
```

### 完整的分割流程

```typescript
import { QueryResultNormalizer } from './QueryResultNormalizer';
import { StructureAwareSplitter } from '../../splitting/strategies/StructureAwareSplitter';
import { TreeSitterCoreService } from '../parse/TreeSitterCoreService';

// 初始化组件
const normalizer = new QueryResultNormalizer();
const splitter = new StructureAwareSplitter();
const treeSitterService = new TreeSitterCoreService();

// 设置依赖关系
splitter.setQueryNormalizer(normalizer);
splitter.setTreeSitterService(treeSitterService);

// 处理代码
const code = `
import { Component } from 'react';

class MyComponent extends Component {
  render() {
    return <div>Hello World</div>;
  }
}
`;

const chunks = await splitter.split(code, 'typescript');
console.log(`Generated ${chunks.length} chunks`);
```

## 支持的语言

### TypeScript/JavaScript
- 函数定义（包括箭头函数、异步函数）
- 类定义（包括抽象类、泛型类）
- 接口和类型定义
- 导入和导出语句
- 方法和属性定义
- 变量声明

### Python
- 函数定义（包括异步函数、生成器）
- 类定义
- 装饰器
- 导入语句
- 变量赋值
- 控制流语句

### 其他语言
通过DefaultLanguageAdapter提供基础支持，包括：
- 通用函数定义
- 类和结构体定义
- 变量声明
- 导入语句

## 配置选项

### NormalizationOptions

```typescript
interface NormalizationOptions {
  enableCache?: boolean;        // 启用缓存（默认：true）
  cacheSize?: number;          // 缓存大小（默认：100）
  enablePerformanceMonitoring?: boolean; // 启用性能监控（默认：false）
  customTypeMappings?: QueryTypeMapping[]; // 自定义类型映射
  debug?: boolean;             // 调试模式（默认：false）
}
```

### ChunkingOptions

```typescript
interface ChunkingOptions {
  maxChunkSize?: number;       // 最大块大小（默认：1000）
  minChunkSize?: number;       // 最小块大小（默认：10）
  overlapSize?: number;        // 重叠大小（默认：3）
}
```

## 扩展支持

### 添加新语言适配器

```typescript
import { ILanguageAdapter, StandardizedQueryResult } from './types';

class CustomLanguageAdapter implements ILanguageAdapter {
  normalize(queryResults: any[], queryType: string, language: string): StandardizedQueryResult[] {
    // 实现自定义标准化逻辑
  }

  getSupportedQueryTypes(): string[] {
    return ['functions', 'classes', 'imports'];
  }

  // 实现其他必需方法...
}

// 注册新适配器
import { registerLanguageAdapter } from './index';
registerLanguageAdapter('custom', () => new CustomLanguageAdapter());
```

### 自定义查询类型映射

```typescript
const normalizer = new QueryResultNormalizer({
  customTypeMappings: [
    {
      standardType: 'custom_function',
      nodeTypes: ['custom_func_def'],
      languages: ['custom'],
      priority: 1
    }
  ]
});
```

## 性能优化

### 缓存机制
- 查询结果缓存
- 标准化结果缓存
- 语言适配器实例缓存

### 懒加载
- 按需加载查询类型
- 延迟初始化语言适配器
- 动态导入查询模块

## 测试

运行测试：

```bash
# 运行所有测试
npm test -- --testPathPattern=normalization

# 运行特定测试
npm test -- QueryResultNormalizer.test.ts
npm test -- StructureAwareSplitter.test.ts
```

## 示例

查看完整示例：

```typescript
import { runStructureAwareSplittingExample } from './examples/StructureAwareSplittingExample';

// 运行示例
await runStructureAwareSplittingExample();
```

## 故障排除

### 常见问题

1. **查询类型发现失败**
   - 检查查询文件目录结构
   - 验证文件命名约定
   - 查看调试日志

2. **标准化结果为空**
   - 确认查询语法正确
   - 检查AST解析结果
   - 验证语言适配器配置

3. **分割质量不佳**
   - 调整最小/最大块大小
   - 检查查询类型覆盖范围
   - 优化语言适配器逻辑

### 调试模式

```typescript
const normalizer = new QueryResultNormalizer({
  debug: true,
  enablePerformanceMonitoring: true
});

// 查看统计信息
const stats = normalizer.getStats();
console.log('Normalization stats:', stats);
```

## API参考

详细的API文档请参考各个组件的TypeScript接口定义。

## 贡献

欢迎提交Issue和Pull Request来改进这个系统。在提交代码前，请确保：

1. 所有测试通过
2. 添加适当的类型定义
3. 更新相关文档
4. 遵循现有的代码风格

## 许可证

本项目采用MIT许可证。