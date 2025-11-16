# C语言查询规则与适配器协调测试执行指南

## 概述

本指南提供简化的测试方案，用于验证C语言查询规则与语言适配器的协调关系是否正确。测试重点在于通过实际代码解析来验证当前工作流的正确性。

## 测试目标

1. 验证查询规则能否正确解析C代码
2. 验证语言适配器能否正确标准化查询结果
3. 验证查询规则与适配器之间的协调关系
4. 识别潜在的协调问题

## 测试方法

### 1. 直接测试法

使用现有的Tree-sitter解析器和查询规则，直接测试C代码片段的解析和适配过程。

### 2. 测试流程

```
C代码片段 → Tree-sitter解析 → 查询规则匹配 → 适配器标准化 → 结果验证
```

## 测试实现

### 1. 创建测试文件

创建简单的测试文件来验证协调关系：

```typescript
// src/service/parser/__tests__/c-language-coordination.test.ts
import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import { CLanguageAdapter } from '../core/normalization/adapters/CLanguageAdapter';
import { QueryLoader } from '../core/query/QueryLoader';

// 初始化解析器
const parser = new Parser();
const language = new C();
parser.setLanguage(language);

// 创建适配器实例
const adapter = new CLanguageAdapter();

describe('C语言查询规则与适配器协调测试', () => {
  test('函数定义查询与适配器协调', async () => {
    const code = `
      int add(int a, int b) {
        return a + b;
      }
    `;
    
    // 1. 解析代码
    const tree = parser.parse(code);
    
    // 2. 获取查询规则
    const queryPattern = await QueryLoader.getQuery('c', 'functions');
    const query = new Parser.Query(language, queryPattern);
    
    // 3. 执行查询
    const captures = query.captures(tree.rootNode);
    
    // 4. 转换为查询结果格式
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    // 5. 适配器标准化
    const results = await adapter.normalize(queryResults, 'functions', 'c');
    
    // 6. 验证结果
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('function');
    expect(results[0].name).toBe('add');
    expect(results[0].nodeId).toBeDefined();
    
    console.log('函数定义测试通过:', results[0]);
  });

  test('结构体定义查询与适配器协调', async () => {
    const code = `
      struct Point {
        int x;
        int y;
      };
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'structs');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'structs', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('class'); // 结构体映射为类
    expect(results[0].name).toBe('Point');
    
    console.log('结构体定义测试通过:', results[0]);
  });

  test('数据流查询与适配器协调', async () => {
    const code = `
      int x = y;
      result = calculate(x);
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'data-flow');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'data-flow', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('data-flow');
    
    console.log('数据流测试通过:', results[0]);
  });
});
```

### 2. 简化的测试工具函数

```typescript
// src/service/parser/__tests__/utils/test-coordination.ts
import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import { CLanguageAdapter } from '../../core/normalization/adapters/CLanguageAdapter';
import { QueryLoader } from '../../core/query/QueryLoader';

export class CoordinationTester {
  private parser: Parser;
  private language: Parser.Language;
  private adapter: CLanguageAdapter;

  constructor() {
    this.parser = new Parser();
    this.language = new C();
    this.parser.setLanguage(this.language);
    this.adapter = new CLanguageAdapter();
  }

  async testCoordination(
    code: string, 
    queryType: string,
    expectedType: string,
    expectedName?: string
  ) {
    try {
      // 解析代码
      const tree = this.parser.parse(code);
      
      // 获取查询规则
      const queryPattern = await QueryLoader.getQuery('c', queryType);
      const query = new Parser.Query(this.language, queryPattern);
      
      // 执行查询
      const captures = query.captures(tree.rootNode);
      
      if (captures.length === 0) {
        console.warn(`警告: 查询类型 ${queryType} 未找到匹配项`);
        return null;
      }
      
      // 转换为查询结果格式
      const queryResults = captures.map(capture => ({
        captures: [{
          name: capture.name,
          node: capture.node
        }]
      }));
      
      // 适配器标准化
      const results = await this.adapter.normalize(queryResults, queryType, 'c');
      
      // 验证结果
      if (results.length > 0) {
        const result = results[0];
        console.log(`✓ ${queryType} 测试通过:`, {
          type: result.type,
          name: result.name,
          nodeId: result.nodeId,
          expectedType,
          expectedName,
          typeMatch: result.type === expectedType,
          nameMatch: expectedName ? result.name === expectedName : true
        });
        
        return result;
      } else {
        console.warn(`警告: ${queryType} 适配器返回空结果`);
        return null;
      }
    } catch (error) {
      console.error(`✗ ${queryType} 测试失败:`, error);
      return null;
    }
  }

  async runBasicTests() {
    console.log('开始基础协调测试...\n');
    
    // 测试用例
    const testCases = [
      {
        name: '简单函数',
        code: 'int add(int a, int b) { return a + b; }',
        queryType: 'functions',
        expectedType: 'function',
        expectedName: 'add'
      },
      {
        name: '结构体定义',
        code: 'struct Point { int x; int y; };',
        queryType: 'structs',
        expectedType: 'class',
        expectedName: 'Point'
      },
      {
        name: '变量声明',
        code: 'int x = 10;',
        queryType: 'variables',
        expectedType: 'variable',
        expectedName: 'x'
      },
      {
        name: '数据流赋值',
        code: 'x = y;',
        queryType: 'data-flow',
        expectedType: 'data-flow'
      },
      {
        name: '函数调用',
        code: 'result = calculate(x, y);',
        queryType: 'functions',
        expectedType: 'call'
      }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      console.log(`测试: ${testCase.name}`);
      const result = await this.testCoordination(
        testCase.code,
        testCase.queryType,
        testCase.expectedType,
        testCase.expectedName
      );
      results.push({
        ...testCase,
        result,
        success: result !== null
      });
      console.log('');
    }
    
    // 汇总结果
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`\n测试完成: ${successCount}/${totalCount} 通过`);
    
    if (successCount < totalCount) {
      console.log('\n失败的测试:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`- ${r.name}: ${r.queryType}`);
      });
    }
    
    return results;
  }
}
```

### 3. 快速验证脚本

```typescript
// src/service/parser/__tests__/quick-verification.ts
import { CoordinationTester } from './utils/test-coordination';

async function quickVerification() {
  console.log('C语言查询规则与适配器协调关系快速验证\n');
  
  const tester = new CoordinationTester();
  const results = await tester.runBasicTests();
  
  // 简单的问题检测
  const issues = [];
  
  results.forEach(result => {
    if (!result.success) {
      issues.push({
        type: 'coordination_failure',
        queryType: result.queryType,
        code: result.code,
        expected: result.expectedType
      });
    } else if (result.result) {
      // 检查类型映射是否正确
      if (result.result.type !== result.expectedType) {
        issues.push({
          type: 'type_mapping_mismatch',
          queryType: result.queryType,
          expected: result.expectedType,
          actual: result.result.type
        });
      }
      
      // 检查名称提取是否正确
      if (result.expectedName && result.result.name !== result.expectedName) {
        issues.push({
          type: 'name_extraction_mismatch',
          queryType: result.queryType,
          expected: result.expectedName,
          actual: result.result.name
        });
      }
    }
  });
  
  if (issues.length > 0) {
    console.log('\n发现的问题:');
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.type}:`);
      console.log(`   查询类型: ${issue.queryType}`);
      if (issue.code) console.log(`   代码: ${issue.code}`);
      if (issue.expected) console.log(`   期望: ${issue.expected}`);
      if (issue.actual) console.log(`   实际: ${issue.actual}`);
      console.log('');
    });
  } else {
    console.log('\n✓ 所有测试通过，未发现协调问题');
  }
  
  return issues;
}

// 如果直接运行此文件
if (require.main === module) {
  quickVerification().catch(console.error);
}

export { quickVerification };
```

## 执行测试

### 1. 运行基础协调测试

```bash
# 运行特定的协调测试
npm test src/service/parser/__tests__/c-language-coordination.test.ts

# 或者运行快速验证
npm test src/service/parser/__tests__/quick-verification.ts
```

### 2. 在代码中直接验证

```typescript
// 在任何地方导入并运行快速验证
import { quickVerification } from './src/service/parser/__tests__/quick-verification';

// 运行验证
quickVerification().then(issues => {
  if (issues.length === 0) {
    console.log('协调关系验证通过');
  } else {
    console.log('发现协调问题:', issues);
  }
});
```

## 测试重点

### 1. 查询规则验证

- 查询规则能否正确匹配目标代码结构
- 捕获名称是否与适配器期望一致
- 查询结果是否包含必要的信息

### 2. 适配器验证

- 查询类型映射是否正确
- 名称提取是否准确
- 标准化结果是否符合预期

### 3. 协调关系验证

- 查询规则与适配器是否无缝集成
- 数据流转是否正确
- 错误处理是否有效

## 常见问题排查

### 1. 查询规则未匹配

**症状**: 查询返回空结果
**排查**:
- 检查查询规则语法是否正确
- 验证代码片段是否符合查询模式
- 确认Tree-sitter解析器版本兼容性

### 2. 适配器标准化失败

**症状**: 适配器返回错误或空结果
**排查**:
- 检查查询类型映射是否存在
- 验证捕获名称是否在适配器中处理
- 确认名称提取逻辑是否正确

### 3. 类型映射不匹配

**症状**: 结果类型与期望不符
**排查**:
- 检查 `C_QUERY_TYPE_MAPPING` 配置
- 验证查询类型是否正确传递
- 确认映射逻辑是否正确

## 下一步

根据测试结果，可以：

1. **修复发现的问题**: 调整查询规则或适配器逻辑
2. **扩展测试用例**: 添加更多复杂的代码场景
3. **优化性能**: 如果测试发现性能问题，进行针对性优化
4. **完善文档**: 记录发现的问题和解决方案

这个简化的测试方案专注于核心协调关系的验证，避免了复杂的架构，便于快速执行和调整。