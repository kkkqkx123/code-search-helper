# BaseLanguageAdapter 深度计算优化方案

## 📋 问题概述

当前 [`BaseLanguageAdapter`](src/service/parser/core/normalization/BaseLanguageAdapter.ts:291-306) 中的 [`calculateBaseComplexity`](src/service/parser/core/normalization/BaseLanguageAdapter.ts:291) 方法存在严重的性能问题：

### 核心问题
1. **递归深度计算**：使用深度优先递归遍历，大文件可能导致栈溢出
2. **重复计算**：相同节点可能被多次遍历
3. **缓存机制缺失**：缺少专门的复杂度缓存

## 🎯 优化目标

### 主要目标
- 消除栈溢出风险
- 提高计算效率
- 保持结果准确性

## 🔧 技术实现方案

### 1. 迭代式深度计算算法

```typescript
/**
 * 使用广度优先迭代算法计算嵌套深度
 * 替代原有的递归实现，避免栈溢出
 */
protected calculateNestingDepthIterative(startNode: any): number {
  if (!startNode || !startNode.children) {
    return 0;
  }

  let maxDepth = 0;
  const queue: Array<{ node: any, depth: number }> = [];
  queue.push({ node: startNode, depth: 0 });

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;
    maxDepth = Math.max(maxDepth, depth);

    if (node.children && depth < 15) { // 设置合理的深度上限
      for (const child of node.children) {
        if (this.isBlockNode(child)) {
          queue.push({ node: child, depth: depth + 1 });
        }
      }
    }
  }

  return maxDepth;
}
```

### 2. 智能复杂度评估策略

#### 多维度因素分析

```typescript
/**
 * 增强的复杂度计算策略
 * 结合代码结构、语言特性、模式复杂度
 */
protected calculateBaseComplexityOptimized(result: any): number {
  const mainNode = result.captures?.[0]?.node;
  if (!mainNode) return 1;

  // 基础复杂度
  let complexity = 1;
  
  // 1. 基于代码结构
  const structuralComplexity = this.calculateStructuralComplexity(mainNode);
  complexity += structuralComplexity;

  // 2. 基于语言特性
  const languageSpecificComplexity = this.calculateLanguageSpecificComplexity(result);
  complexity += languageSpecificComplexity;

  // 3. 基于模式复杂度
  const patternComplexity = this.calculatePatternComplexity(result);
  complexity += patternComplexity;

  return Math.max(1, Math.min(complexity, 20)); // 限制复杂度范围
}
```

## 🛠️ 实施步骤

### 第一阶段：核心算法重构
1. 实现 `calculateNestingDepthIterative` 方法
2. 替换原有的递归实现
3. 添加深度限制保护

### 第二阶段：智能评估集成
1. 实现多维度复杂度评估
2. 添加语言特定因素
3. 优化计算边界条件

### 第三阶段：性能验证
1. 创建基准测试用例
2. 验证优化效果
3. 性能回归测试

## 📊 预期效果

### 性能提升
- **栈溢出风险消除**：通过迭代算法替代递归
- **计算效率提升**：避免重复遍历
- **内存使用优化**：减少递归调用栈

### 风险控制
- 保持向后兼容性
- 逐步替换，避免破坏性变更