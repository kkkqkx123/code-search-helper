# 测试数据工厂 (TestDataFactory)

## 概述

测试数据工厂是一个用于为tree-sitter规则测试提供标准化测试用例的工具类。它通过结构化的方式生成各种类型的代码片段，用于验证代码分析规则的正确性和性能。

## 主要功能

### 1. 测试用例生成

为以下代码类型提供标准化的测试用例：

- **控制结构 (control_structure)**: if语句、for循环、while循环等
- **错误处理 (error_handling)**: try-catch、throw语句等
- **函数调用链 (function_call_chain)**: 方法链式调用、Promise链等
- **算术逻辑表达式 (arithmetic_logical_expression)**: 复杂表达式、条件运算等
- **对象数组字面量 (object_array_literal)**: 对象字面量、数组字面量等
- **模板字面量 (template_literal)**: 模板字符串及其插值
- **注释标记 (comment_marked)**: 包含注释的代码块
- **逻辑块 (logic_block)**: 复合语句块

### 2. 测试用例分类

每个规则类型都包含三类测试用例：

- **validCases**: 预期为有效的代码片段
- **invalidCases**: 预期为无效的代码片段
- **boundaryCases**: 边界情况的测试用例

### 3. 性能测试数据

提供不同规模的数据集用于性能测试：

- **small**: 小型代码片段（1-2行）
- **medium**: 中型代码片段（3-5行）
- **large**: 大型代码片段（10+行）

### 4. 边界测试数据

包含各种边界情况的测试用例：

- 最小长度有效代码
- 最大长度边界代码
- 特殊字符处理
- 空代码块
- 无效语法

## 使用示例

### 基本使用

```typescript
import { TestDataFactory } from './TestDataFactory';

// 获取特定规则类型的测试用例
const controlStructureTests = TestDataFactory.getTestCasesForRule('control_structure');

// 遍历有效测试用例
controlStructureTests.validCases.forEach(testCase => {
  console.log(`测试: ${testCase.name}`);
  console.log(`代码: ${testCase.code}`);
  console.log(`预期: ${testCase.expectedValid}`);
});
```

### 性能测试

```typescript
// 获取性能测试数据
const perfData = TestDataFactory.createPerformanceTestData();

// 测试小型代码片段
perfData.small.forEach(code => {
  // 执行性能测试
  measureParsingTime(code);
});
```

### 边界测试

```typescript
// 获取边界测试数据
const boundaryTests = TestDataFactory.createBoundaryTestData();

// 测试边界情况
boundaryTests.forEach(testCase => {
  const result = validateCode(testCase.code);
  assert.strictEqual(result.isValid, testCase.expectedValid);
});
```

## 数据结构

### TestCase接口

```typescript
interface TestCase {
  name: string;           // 测试用例名称
  code: string;           // 代码片段
  expectedValid: boolean; // 预期验证结果
  snippetType: string;    // 代码片段类型
  expectedMetadata?: {   // 预期元数据（可选）
    complexity: number;   // 复杂度评分
    hasSideEffects: boolean; // 是否有副作用
    isStandalone: boolean;   // 是否独立可执行
  };
}
```

### RuleTestCases接口

```typescript
interface RuleTestCases {
  validCases: TestCase[];    // 有效测试用例
  invalidCases: TestCase[];  // 无效测试用例
  boundaryCases: TestCase[]; // 边界测试用例
}
```

## 扩展指南

### 添加新的规则类型

1. 在 `getAllRuleTestCases()` 方法中添加新的规则类型映射
2. 创建对应的测试用例生成方法
3. 确保snippetType值与类型定义保持一致

### 添加新的测试用例

1. 在对应的规则类型方法中添加测试用例
2. 确保测试用例覆盖有效、无效和边界三种情况
3. 为复杂用例提供expectedMetadata以提高测试精度

## 最佳实践

1. **测试用例命名**: 使用描述性的中文名称，清晰表达测试目的
2. **代码格式**: 保持代码片段的格式一致性，使用适当的缩进
3. **边界情况**: 确保每个规则类型都包含边界情况的测试
4. **性能考虑**: 为性能测试提供不同规模的数据集
5. **类型安全**: 确保snippetType值与类型定义严格匹配