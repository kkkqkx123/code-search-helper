# 类型定义重构计划

## 问题分析

### 当前问题
1. **循环依赖**：`types.ts` ↔ `splitting-types.ts` 形成循环导入
2. **类型冗余**：多个文件定义了相似的接口（ASTNode、ChunkingOptions等）
3. **架构混乱**：类型定义分散，缺乏清晰的层次结构

### 循环依赖路径
```
src/service/parser/types.ts 
  → imports from ./processing/types/splitting-types (CodeChunk, CodeChunkMetadata)
  → re-exports splitting-types.ts 中的所有类型

src/service/parser/processing/types/splitting-types.ts
  → imports from ../../types (CodeChunk, CodeChunkMetadata, ChunkingOptions)
```

## 重构方案

### 1. 删除冗余文件
- `src/service/parser/types/processing-types.ts` - 内容过时且重复
- `src/service/parser/processing/types/index.ts` - 过于复杂且重复

### 2. 统一类型定义
将核心类型定义整合到 `src/service/parser/types/core-types.ts` 中：
- 包含所有基础接口定义
- 消除循环依赖
- 建立清晰的导入层次

### 3. 重构导入结构
- `splitting-types.ts` 从 `core-types.ts` 导入基础类型
- `types.ts` 作为统一的导出入口
- 避免任何形式的循环导入

## 实施步骤

### 阶段一：删除冗余文件
1. 删除 `src/service/parser/types/processing-types.ts`
2. 删除 `src/service/parser/processing/types/index.ts`

### 阶段二：重构核心类型
1. 在 `core-types.ts` 中整合所有必要的类型定义
2. 确保 `ChunkingOptions` 等关键接口定义完整

### 阶段三：修复导入关系
1. 修改 `splitting-types.ts` 的导入路径
2. 更新 `types.ts` 的导出结构
3. 修复所有依赖这些类型的文件

### 阶段四：验证和测试
1. 检查 TypeScript 编译是否通过
2. 验证循环依赖是否消除
3. 确保功能不受影响

## 预期结果

- ✅ 消除所有循环依赖错误
- ✅ 类型定义结构清晰
- ✅ 导入关系简单明了
- ✅ 代码维护性提升
- ✅ 编译时错误消除

## 风险控制

- 保留原有接口定义，确保向后兼容
- 分阶段实施，便于问题排查
- 充分测试确保功能完整性