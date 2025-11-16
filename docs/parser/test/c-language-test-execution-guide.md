# C语言查询规则与适配器测试执行指南

## 概述

本文档提供C语言查询规则与语言适配器协调关系测试的详细执行指南，包括测试环境准备、测试执行步骤、结果分析和问题排查。

## 1. 测试环境准备

### 1.1 环境要求

- **Node.js版本**: 18.0+ 
- **npm版本**: 8.0+
- **TypeScript版本**: 4.5+
- **Jest版本**: 28.0+
- **Tree-sitter**: 最新版本
- **操作系统**: Windows 10+, macOS 10.15+, Ubuntu 18.04+

### 1.2 依赖安装

```bash
# 安装项目依赖
npm install

# 安装Tree-sitter C语言解析器
npm install tree-sitter tree-sitter-c

# 安装测试相关依赖
npm install --save-dev jest @types/jest ts-jest
```

### 1.3 测试配置

#### 1.3.1 Jest配置

创建或更新 `jest.config.js`:

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/src/service/parser/__tests__/c-language/**/*.test.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/service/parser/core/normalization/adapters/CLanguageAdapter.ts',
    'src/service/parser/core/normalization/adapters/c-utils/*.ts',
    'src/service/parser/constants/queries/c/*.ts',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: [
    '<rootDir>/src/service/parser/__tests__/setup/c-parser-test-setup.ts'
  ],
  testTimeout: 30000,
  verbose: true
};
```

#### 1.3.2 测试环境设置

创建 `src/service/parser/__tests__/setup/c-parser-test-setup.ts`:

```typescript
import Parser from 'tree-sitter';
import C from 'tree-sitter-c';

// 全局测试设置
beforeAll(() => {
  // 初始化Tree-sitter
  const parser = new Parser();
  const language = new C();
  parser.setLanguage(language);
  
  // 设置全局变量
  (global as any).testParser = parser;
  (global as any).testLanguage = language;
});

afterAll(() => {
  // 清理资源
  (global as any).testParser = null;
  (global as any).testLanguage = null;
});
```

### 1.4 测试数据准备

#### 1.4.1 创建测试代码库

在 `src/service/parser/__tests__/fixtures/c-code-samples/` 目录下创建测试代码文件：

```
fixtures/c-code-samples/
├── basic/
│   ├── simple_functions.c
│   ├── basic_structs.c
│   └── control_flow.c
├── intermediate/
│   ├── pointers.c
│   ├── complex_structs.c
│   └── preprocessor.c
├── advanced/
│   ├── function_pointers.c
│   ├── memory_management.c
│   └── concurrency.c
└── edge_cases/
    ├── malformed_code.c
    ├── deep_nesting.c
    └── large_file.c
```

#### 1.4.2 示例测试代码

**simple_functions.c**:
```c
#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

void print_message(const char* message) {
    printf("%s\n", message);
}

int main() {
    int result = add(5, 3);
    print_message("Result calculated");
    return 0;
}
```

**basic_structs.c**:
```c
#include <stdlib.h>

typedef struct {
    int x;
    int y;
} Point;

typedef struct {
    Point top_left;
    Point bottom_right;
} Rectangle;

Point* create_point(int x, int y) {
    Point* p = (Point*)malloc(sizeof(Point));
    p->x = x;
    p->y = y;
    return p;
}
```

## 2. 测试执行步骤

### 2.1 单元测试执行

#### 2.1.1 查询规则测试

```bash
# 执行所有查询规则测试
npm test -- src/service/parser/__tests__/c-language/queries

# 执行特定查询规则测试
npm test -- src/service/parser/__tests__/c-language/queries/functions.test.ts
npm test -- src/service/parser/__tests__/c-language/queries/structs.test.ts
npm test -- src/service/parser/__tests__/c-language/queries/data-flow.test.ts
```

#### 2.1.2 适配器测试

```bash
# 执行适配器测试
npm test -- src/service/parser/__tests__/c-language/adapters/CLanguageAdapter.test.ts
```

#### 2.1.3 关系提取器测试

```bash
# 执行所有关系提取器测试
npm test -- src/service/parser/__tests__/c-language/extractors

# 执行特定关系提取器测试
npm test -- src/service/parser/__tests__/c-language/extractors/DataFlowRelationshipExtractor.test.ts
npm test -- src/service/parser/__tests__/c-language/extractors/ControlFlowRelationshipExtractor.test.ts
```

### 2.2 集成测试执行

```bash
# 执行集成测试
npm test -- src/service/parser/__tests__/c-language/integration

# 执行端到端协调测试
npm test -- src/service/parser/__tests__/c-language/integration/query-adapter-coordination.test.ts
```

### 2.3 覆盖率测试

```bash
# 执行测试并生成覆盖率报告
npm test -- --coverage

# 生成HTML覆盖率报告
npm test -- --coverage --coverageReporters=html

# 查看覆盖率报告
open coverage/lcov-report/index.html
```

### 2.4 性能测试

```bash
# 执行性能基准测试
npm run test:performance

# 执行内存使用测试
npm run test:memory
```

## 3. 测试结果分析

### 3.1 测试报告解读

#### 3.1.1 单元测试报告

```
PASS src/service/parser/__tests__/c-language/queries/functions.test.ts
  Functions Query Tests
    Function Definition Queries
      ✓ should correctly parse simple function definitions (15 ms)
      ✓ should correctly parse function prototypes (8 ms)
      ✓ should correctly parse function pointers (5 ms)
    Function Call Queries
      ✓ should correctly parse function calls (12 ms)
      ✓ should correctly parse recursive calls (7 ms)

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        2.345 s
```

#### 3.1.2 覆盖率报告

```
----------------------|---------|----------|---------|---------|-------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------------------|---------|----------|---------|---------|-------------------
All files             |   92.45 |    88.12 |   95.23 |   91.87 |                   
 CLanguageAdapter.ts  |   95.12 |    90.45 |   98.76 |   94.23 | 145,167,189       
 DataFlowExtractor.ts |   89.34 |    85.67 |   92.11 |   87.45 | 67,89,101,123      
----------------------|---------|----------|---------|---------|-------------------
```

### 3.2 性能指标分析

#### 3.2.1 解析性能

```typescript
// 性能测试结果示例
const performanceResults = {
  simpleFile: {
    fileSize: '10KB',
    parseTime: '15ms',
    memoryUsage: '2MB'
  },
  complexFile: {
    fileSize: '100KB',
    parseTime: '150ms',
    memoryUsage: '15MB'
  },
  largeFile: {
    fileSize: '1MB',
    parseTime: '1.5s',
    memoryUsage: '120MB'
  }
};
```

#### 3.2.2 查询性能

```typescript
// 查询性能基准
const queryBenchmarks = {
  functionsQuery: {
    avgExecutionTime: '5ms',
    avgResultCount: 25,
    cacheHitRate: '85%'
  },
  dataFlowQuery: {
    avgExecutionTime: '12ms',
    avgResultCount: 45,
    cacheHitRate: '78%'
  }
};
```

### 3.3 问题诊断

#### 3.3.1 常见测试失败

1. **查询规则语法错误**
   ```
   Error: Invalid query pattern at line 5, column 12
   ```
   **解决方案**: 检查查询规则语法，确保括号匹配和语法正确

2. **捕获名称不匹配**
   ```
   Expected: 'function.name'
   Received: 'func.name'
   ```
   **解决方案**: 更新适配器中的捕获名称列表或修改查询规则

3. **节点类型不识别**
   ```
   Node type 'unknown_type' not recognized
   ```
   **解决方案**: 更新节点类型映射或添加新的节点类型处理

#### 3.3.2 调试技巧

1. **启用详细日志**
   ```typescript
   // 在测试中启用调试日志
   process.env.DEBUG = 'parser:*';
   ```

2. **查看AST结构**
   ```typescript
   // 打印AST节点结构
   console.log(JSON.stringify(astNode, null, 2));
   ```

3. **检查查询结果**
   ```typescript
   // 打印查询结果
   console.log('Query results:', JSON.stringify(queryResults, null, 2));
   ```

## 4. 持续集成配置

### 4.1 GitHub Actions配置

创建 `.github/workflows/c-parser-tests.yml`:

```yaml
name: C Parser Tests

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'src/service/parser/**'
  pull_request:
    branches: [ main ]
    paths:
      - 'src/service/parser/**'

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run C parser tests
      run: npm test -- src/service/parser/__tests__/c-language
    
    - name: Generate coverage report
      run: npm test -- --coverage src/service/parser/__tests__/c-language
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info
        flags: c-parser
        name: c-parser-coverage
```

### 4.2 测试报告自动化

#### 4.2.1 测试结果通知

```typescript
// 测试结果通知脚本
const testResults = {
  passed: 145,
  failed: 3,
  coverage: 92.45
};

if (testResults.failed > 0) {
  // 发送失败通知
  notifyTeam('C Parser tests failed', {
    failed: testResults.failed,
    total: testResults.passed + testResults.failed
  });
}

if (testResults.coverage < 90) {
  // 发送覆盖率警告
  notifyTeam('C Parser coverage below threshold', {
    coverage: testResults.coverage,
    threshold: 90
  });
}
```

#### 4.2.2 性能回归检测

```typescript
// 性能回归检测
const currentPerformance = measurePerformance();
const baselinePerformance = loadBaselinePerformance();

if (currentPerformance.parseTime > baselinePerformance.parseTime * 1.2) {
  // 性能回归警告
  alertPerformanceRegression('Parse time increased by 20%');
}
```

## 5. 测试维护指南

### 5.1 测试用例维护

#### 5.1.1 添加新测试用例

1. **确定测试场景**
   - 分析新的C语言特性
   - 识别边界条件
   - 设计复杂场景

2. **编写测试代码**
   ```typescript
   it('should handle new C language feature', async () => {
     const testCode = 'new_feature_code_here';
     const expectedResults = [/* expected results */];
     
     const results = await executeTest(testCode);
     expect(results).toEqual(expectedResults);
   });
   ```

3. **更新验证清单**
   - 在验证清单中添加新的检查项
   - 更新覆盖率目标

#### 5.1.2 更新现有测试

1. **定期审查测试用例**
   - 检查测试用例的时效性
   - 更新过期的预期结果
   - 优化测试性能

2. **重构测试代码**
   - 提取重复的测试逻辑
   - 改进测试可读性
   - 增强错误处理

### 5.2 测试数据维护

#### 5.2.1 测试代码库更新

1. **添加新的测试代码**
   - 收集真实世界的C代码示例
   - 创建边界条件测试用例
   - 更新大型项目测试片段

2. **版本控制**
   - 使用Git管理测试代码库
   - 标记不同版本的测试数据
   - 维护测试数据变更日志

#### 5.2.2 测试环境同步

1. **依赖更新**
   - 定期更新Tree-sitter版本
   - 同步测试依赖版本
   - 验证兼容性

2. **环境一致性**
   - 使用Docker容器化测试环境
   - 维护环境配置文档
   - 定期验证环境一致性

### 5.3 测试文档维护

#### 5.3.1 文档更新

1. **测试计划更新**
   - 根据项目变化调整测试计划
   - 更新测试优先级
   - 修订测试策略

2. **技术文档同步**
   - 更新API文档
   - 同步架构变更
   - 维护故障排除指南

#### 5.3.2 知识分享

1. **团队培训**
   - 定期组织测试培训
   - 分享最佳实践
   - 交流测试经验

2. **经验总结**
   - 记录常见问题
   - 总结解决方案
   - 建立知识库

## 6. 故障排除指南

### 6.1 常见问题及解决方案

#### 6.1.1 测试环境问题

**问题**: Tree-sitter初始化失败
```
Error: Tree-sitter language initialization failed
```

**解决方案**:
```bash
# 重新安装Tree-sitter
npm uninstall tree-sitter tree-sitter-c
npm install tree-sitter tree-sitter-c

# 清理缓存
npm cache clean --force
```

**问题**: 测试超时
```
Error: Test timeout of 30000ms exceeded
```

**解决方案**:
```typescript
// 增加测试超时时间
jest.setTimeout(60000);

// 或者优化测试代码，减少执行时间
```

#### 6.1.2 测试逻辑问题

**问题**: 查询结果为空
```
Expected: non-empty array
Received: []
```

**解决方案**:
1. 检查查询规则语法
2. 验证测试代码格式
3. 确认Tree-sitter解析器版本

**问题**: 断言失败
```
Expected: 'function'
Received: 'expression'
```

**解决方案**:
1. 检查查询类型映射
2. 验证适配器逻辑
3. 更新预期结果

#### 6.1.3 性能问题

**问题**: 测试执行缓慢
```
Test execution time: 120s (expected: <30s)
```

**解决方案**:
1. 优化测试数据大小
2. 实现测试并行执行
3. 使用测试缓存

### 6.2 调试工具和技巧

#### 6.2.1 调试工具

1. **Node.js调试器**
   ```bash
   # 启动调试模式
   node --inspect-brk node_modules/.bin/jest --runInBand
   ```

2. **Chrome DevTools**
   - 打开Chrome DevTools
   - 连接到Node.js调试会话
   - 设置断点和监视

3. **VS Code调试**
   ```json
   // .vscode/launch.json
   {
     "type": "node",
     "request": "launch",
     "name": "Jest Tests",
     "program": "${workspaceFolder}/node_modules/.bin/jest",
     "args": ["--runInBand"],
     "console": "integratedTerminal",
     "internalConsoleOptions": "neverOpen"
   }
   ```

#### 6.2.2 调试技巧

1. **日志调试**
   ```typescript
   // 添加详细日志
   console.log('Debug: Query pattern:', queryPattern);
   console.log('Debug: AST structure:', JSON.stringify(astNode, null, 2));
   console.log('Debug: Query results:', JSON.stringify(results, null, 2));
   ```

2. **断言调试**
   ```typescript
   // 使用详细的断言信息
   expect(results).toEqual(expectedResults);
   expect(results.length).toBe(expectedResults.length);
   expect(results[0].type).toBe(expectedResults[0].type);
   ```

3. **分步调试**
   ```typescript
   // 分步执行测试
   const astNode = parseCode(testCode);
   console.log('AST parsed:', astNode.type);
   
   const queryResults = executeQuery(astNode, queryPattern);
   console.log('Query executed:', queryResults.length);
   
   const standardized = await adapter.normalize(queryResults, queryType, language);
   console.log('Normalization completed:', standardized.length);
   ```

## 7. 测试最佳实践

### 7.1 测试设计原则

1. **独立性**: 每个测试用例应该独立运行，不依赖其他测试
2. **可重复性**: 测试结果应该一致且可重复
3. **可读性**: 测试代码应该清晰易懂
4. **完整性**: 测试应该覆盖所有重要场景
5. **性能**: 测试应该快速执行

### 7.2 代码质量标准

1. **测试覆盖率**: 保持在90%以上
2. **分支覆盖率**: 保持在85%以上
3. **测试通过率**: 保持100%
4. **性能基准**: 解析时间不超过基准值的120%

### 7.3 团队协作规范

1. **代码审查**: 所有测试代码都需要经过审查
2. **文档更新**: 代码变更时同步更新测试文档
3. **知识分享**: 定期分享测试经验和最佳实践
4. **持续改进**: 根据测试结果持续改进代码质量

## 总结

本执行指南提供了C语言查询规则与语言适配器协调关系测试的完整执行流程。通过遵循这些指南，开发团队可以有效地执行测试、分析结果并维护测试质量。建议定期回顾和更新本指南，以适应项目需求的变化。