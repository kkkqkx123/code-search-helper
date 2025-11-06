# 语言映射维护指南

## 概述

本项目使用统一的语言映射管理系统来管理所有编程语言的映射关系。该系统通过 `LanguageMappingConfig.ts` 和 `LanguageMappingManager.ts` 实现集中化管理，避免了多处硬编码语言映射带来的维护困难和不一致问题。

## 核心组件

### 1. LanguageMappingConfig.ts

位于 `src/service/parser/config/LanguageMappingConfig.ts`，定义了系统中所有支持语言的完整配置信息。

**主要内容：**
- `LanguageMapping` 接口定义了语言映射的所有属性
- `LANGUAGE_MAPPINGS` 对象包含所有语言的详细配置
- 查询类型、策略类型和语言分类的常量定义

**配置项说明：**
- `name`: 语言的标准名称（内部使用）
- `displayName`: 语言的显示名称
- `extensions`: 该语言支持的文件扩展名数组
- `aliases`: 该语言的别名数组（如 'c#', 'csharp' 都指向 'csharp'）
- `treeSitterModule`: 对应的 Tree-sitter 模块名称
- `treeSitterImport`: Tree-sitter 模块的导入方式
- `treeSitterLanguageName`: Tree-sitter 中的语言名称（可选，用于特殊映射）
- `queryDir`: 查询文件所在的目录名
- `supportedQueryTypes`: 该语言支持的查询类型
- `supported`: 是否支持该语言
- `priority`: 优先级（1-3，1为最高优先级）
- `maxChunkSize`: 最大分块大小
- `maxLinesPerChunk`: 每块最大行数
- `enableSemanticDetection`: 是否启用语义检测
- `enableBracketBalance`: 是否启用括号平衡检测
- `supportedStrategies`: 支持的分段策略数组
- `category`: 语言分类（programming, markup, data, config）

### 2. LanguageMappingManager.ts

位于 `src/service/parser/config/LanguageMappingManager.ts`，提供语言映射的管理和服务功能。

**主要功能：**
- 单例模式管理语言映射
- 提供多种语言查询方法
- 配置验证和统计功能

## 使用语言映射的文件

### 核心查询模块
- **QueryLoader.ts** - 使用 `languageMappingManager.getQueryDir()` 获取查询目录
- **QueryRegistry.ts** - 通过映射管理器获取支持的语言列表
- **query-config.ts** - 使用 `languageMappingManager.getCommonLanguages()` 获取常用语言

### 解析器管理模块
- **DynamicParserManager.ts** - 使用 `languageMappingManager.getTreeSitterLoader()` 获取解析器加载器
- **TreeSitterCoreService.ts** - 使用映射管理器获取 Tree-sitter 语言名称

### 语言检测模块
- **LanguageExtensionMap.ts** - 完全委托给统一映射管理器
- **LanguageDetectionService.ts** - 使用映射管理器进行语言检测

### 分段策略模块
- **StructureAwareStrategyProvider.ts** - 使用 `languageMappingManager.getLanguagesByStrategy()` 获取支持的语言
- **BracketStrategyProvider.ts** - 使用映射管理器获取支持的语言
- **ASTStrategyProvider.ts** - 使用映射管理器获取支持的语言

### 处理协调模块
- **UnifiedProcessingCoordinator.ts** - 使用映射管理器获取支持的语言列表
- **SegmentationContextFactory.ts** - 使用映射管理器进行语言映射

### 配置管理模块
- **ConfigurationManager.ts** - 使用映射管理器获取语言特定配置

## 维护指南

### 添加新语言

1. **在 `LanguageMappingConfig.ts` 中添加语言配置：**
   ```typescript
   newlang: {
     name: 'newlang',
     displayName: 'New Language',
     extensions: ['.new'],
     aliases: ['new', 'newlang'],
     treeSitterModule: 'tree-sitter-newlang',
     treeSitterImport: 'default',
     queryDir: 'newlang',  // 创建对应的查询文件目录
     supportedQueryTypes: ['functions', 'classes', 'imports'],
     supported: true,
     priority: 3,
     maxChunkSize: 1800,
     maxLinesPerChunk: 90,
     enableSemanticDetection: true,
     enableBracketBalance: true,
     supportedStrategies: ['ast', 'bracket'],
     category: 'programming'
   }
   ```

2. **创建查询文件目录：**
   在 `src/service/parser/constants/queries/` 下创建 `newlang` 目录，并添加相应的查询文件

3. **创建 `index.ts` 文件：**
   ```typescript
   import functions from './functions';
   import classes from './classes';
   import imports from './imports';
   
   export default `
   ${functions}
   
   ${classes}
   
   ${imports}
   `;
   ```

4. **添加具体的查询文件：**
   根据需要创建 `functions.ts`、`classes.ts` 等文件

### 修改现有语言配置

直接在 `LanguageMappingConfig.ts` 的 `LANGUAGE_MAPPINGS` 对象中修改对应语言的配置。

### 删除语言

从 `LanguageMappingConfig.ts` 的 `LANGUAGE_MAPPINGS` 对象中移除对应语言的配置。

## 常见问题

### 1. 语言映射不一致
**问题：** 系统中出现语言名称不一致
**解决方案：** 检查是否所有模块都使用统一映射管理器，避免硬编码语言名称

### 2. 查询文件加载失败
**问题：** 语言查询文件无法加载
**解决方案：** 检查 `queryDir` 配置是否正确，确认查询文件目录是否存在

### 3. Tree-sitter 模块加载失败
**问题：** Tree-sitter 解析器无法加载
**解决方案：** 检查 `treeSitterModule` 和 `treeSitterImport` 配置是否正确

### 4. 语言检测失败
**问题：** 文件扩展名无法正确映射到语言
**解决方案：** 检查 `extensions` 数组是否包含对应的文件扩展名

## 最佳实践

1. **始终使用统一映射管理器**：避免在代码中硬编码语言名称
2. **合理设置优先级**：常用语言设置为 1，一般语言设置为 2，较少使用设置为 3
3. **保持别名一致性**：为常见的语言别名提供映射（如 'js' -> 'javascript'）
4. **定期验证配置**：使用 `languageMappingManager.validateConfiguration()` 验证配置完整性
5. **测试新语言**：添加新语言后进行全面测试，确保查询、解析、分段等功能正常

## 验证配置

使用以下代码验证语言映射配置的完整性：

```typescript
const validation = languageMappingManager.validateConfiguration();
if (!validation.valid) {
  console.error('配置验证失败:', validation.errors);
}
```

## 监控和统计

使用以下代码获取语言映射的统计信息：

```typescript
const stats = languageMappingManager.getStats();
console.log('语言统计:', stats);