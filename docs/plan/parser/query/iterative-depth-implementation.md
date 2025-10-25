# 迭代式深度计算算法实现计划

## 📋 实施概览

本计划专注于重构 [`BaseLanguageAdapter`](src/service/parser/core/normalization/BaseLanguageAdapter.ts:308-323) 中的 [`calculateNestingDepth`](src/service/parser/core/normalization/BaseLanguageAdapter.ts:308) 方法，使用迭代算法替代递归实现。

## 🎯 核心实现方案

### 1. 迭代深度计算算法

```typescript
/**
 * 使用广度优先迭代算法计算嵌套深度
 * 替代原有的递归实现，避免栈溢出风险
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

/**
 * 增强的复杂度计算策略
 * 结合多维度因素进行精确评估
 */
protected calculateBaseComplexityOptimized(result: any): number {
  const mainNode = result.captures?.[0]?.node;
  if (!mainNode) return 1;

  // 基础复杂度
  let complexity = 1;

  // 1. 代码行数因素（优化计算）
  const lineCount = Math.max(1, this.extractEndLine(result) - this.extractStartLine(result) + 1);
  complexity += Math.min(Math.floor(lineCount / 15), 5); // 每15行增加1点复杂度，最多5点
  
  // 2. 嵌套深度因素（使用迭代算法）
  const nestingDepth = this.calculateNestingDepthIterative(mainNode);
  complexity += Math.min(nestingDepth, 8); // 限制深度贡献，最多8点
  
  // 3. 节点复杂度因素
  const nodeComplexity = this.calculateNodeComplexity(mainNode);
  complexity += Math.min(nodeComplexity, 6); // 限制节点复杂度贡献
  
  return Math.max(1, Math.min(complexity, 25)); // 总体复杂度限制在1-25之间
}
```

### 2. 智能复杂度评估实现

```typescript
/**
 * 计算节点结构复杂度
 * 考虑：块节点数量、嵌套模式复杂度
 */
private calculateNodeComplexity(node: any): number {
  let nodeScore = 0;
  let blockNodeCount = 0;
  
  // 使用迭代方式统计块节点数量
  const nodeQueue: any[] = [node];
  const visited = new Set<any>();

  while (nodeQueue.length > 0) {
    const currentNode = nodeQueue.shift()!;
    
    if (visited.has(currentNode)) {
      continue;
    }
    visited.add(currentNode);

    if (this.isBlockNode(currentNode)) {
      blockNodeCount++;
    }

    if (currentNode.children) {
      for (const child of currentNode.children) {
        if (!visited.has(child)) {
          nodeQueue.push(child);
        }
      }
    }
  }

  // 基于块节点数量的复杂度加成
 if (blockNodeCount > 20) {
    nodeScore += 3;
  } else if (blockNodeCount > 10) {
    nodeScore += 2;
  } else if (blockNodeCount > 5) {
    nodeScore += 1;
  }
  
  return nodeScore;
}

/**
 * 优化的块节点识别方法
 * 支持多种编程语言的块节点类型
 */
protected isBlockNode(node: any): boolean {
  const blockTypes = [
    'block', 'statement_block', 'class_body', 'interface_body', 'suite',
    'function_definition', 'method_definition', 'class_definition',
    'if_statement', 'for_statement', 'while_statement',
    'switch_statement', 'try_statement', 'catch_clause',
    'object_expression', 'array_expression'
  ];

  return blockTypes.includes(node.type);
}
```

## 🛠️ 具体实施步骤

### 阶段一：基础迭代算法 (1-2天)
1. 实现 `calculateNestingDepthIterative` 方法
2. 创建对应的单元测试
3. 验证算法正确性

### 阶段二：复杂度评估集成 (2-3天)
1. 实现多维度评估因素
2. 集成到现有的复杂度计算流程

### 阶段三：性能优化验证 (1天)
1. 运行基准测试
2. 分析性能提升效果
3. 优化参数调优

## 📊 性能预期

### 计算效率
- **时间复杂度**: O(n) - 线性遍历
- **空间复杂度**: O(w) - 队列宽度

## 🔍 验证方法

### 1. 单元测试验证
```typescript
describe('calculateNestingDepthIterative', () => {
  it('should handle deep nesting correctly', () => {
    // 测试深度嵌套场景
    const deepNode = createDeepNestedNode(12); // 12层嵌套
    const depth = adapter.calculateNestingDepthIterative(deepNode);
    expect(depth).toBe(12);
  });
}
```

### 2. 基准测试
- 对比递归 vs 迭代算法性能
- 验证栈溢出防护效果

## 🚨 风险控制

### 1. 兼容性风险
- 保持原有方法签名
- 逐步替换，避免破坏性变更

## 📝 代码迁移策略

### 渐进式替换
1. 保持原有 [`calculateNestingDepth`](src/service/parser/core/normalization/BaseLanguageAdapter.ts:308) 方法
2. 新增优化方法，通过配置开关控制

### 2. 回滚机制
- 保留原有实现作为备选
- 通过性能监控动态切换算法

## 🎯 成功标准

### 技术指标
- ✅ 消除栈溢出风险
- ✅ 计算时间减少 30%+
- ✅ 内存使用稳定
- ✅ 结果准确性保持

## 🔄 后续优化方向

### 1. 并行计算
- 对大型AST树使用并行遍历算法

### 2. 智能缓存
- 基于节点特征进行缓存优化