# 测试指南

本文档说明如何为代码库索引MCP项目运行各种测试。

## 测试结构

项目包含以下测试类型：

1. **单元测试** - 针对独立模块的测试
2. **集成测试** - 针对模块间交互的测试
3. **API测试** - 针对REST API端点的测试
4. **MCP测试** - 针对MCP协议实现的测试
5. **前端测试** - 针对前端界面的测试

## 运行测试

### 运行所有测试

```bash
# 运行所有测试
npm run test:all
```

### 运行特定模块测试

```bash
# 运行工具类测试
npm run test:utils

# 运行API测试
npm run test:api

# 运行MCP测试
npm run test:mcp

# 运行前端测试
npm run test:frontend
```

### 运行单个测试文件

```bash
# 运行特定测试文件
npm test -- src/utils/HashUtils.test.ts

# 运行特定测试套件
npm test -- src/utils
```

### 监视模式运行测试

```bash
# 在监视模式下运行所有测试
npm run test:watch

# 在监视模式下运行特定测试
npm test -- --watch src/utils
```

### 生成测试覆盖率报告

```bash
# 生成测试覆盖率报告
npm run test:coverage
```

## 测试文件结构

```
codebase-index-mcp/
├── src/
│   ├── utils/
│   │   ├── HashUtils.ts
│   │   ├── HashUtils.test.ts
│   │   ├── PathUtils.ts
│   │   └── PathUtils.test.ts
│   ├── api/
│   │   ├── ApiServer.ts
│   │   └── __tests__/
│   │       └── ApiServer.test.ts
│   ├── mcp/
│   │   ├── MCPServer.ts
│   │   └── __tests__/
│   │       └── MCPServer.test.ts
├── frontend/
│   ├── src/
│   │   └── __tests__/
│   │       └── frontend.test.ts
│   └── jest.config.js
├── scripts/
│   └── run-tests.ts
└── package.json
```

## 测试环境配置

### 后端测试

后端测试使用Jest作为测试框架，配置如下：

- 测试环境: Node.js
- 模拟文件系统操作
- 模拟外部依赖（如MCP SDK、文件系统等）

### 前端测试

前端测试使用Jest和JSDOM，配置如下：

- 测试环境: jsdom（模拟浏览器环境）
- 支持DOM操作测试
- 支持异步操作测试

## 编写测试

### 测试最佳实践

1. **每个测试应该独立** - 测试之间不应有依赖关系
2. **使用描述性测试名称** - 测试名称应清楚描述测试的内容
3. **测试一个关注点** - 每个测试应只验证一个功能点
4. **使用适当的断言** - 使用明确的断言来验证预期结果
5. **模拟外部依赖** - 使用模拟对象替代真实的外部依赖

### 测试示例

```typescript
// HashUtils.test.ts
describe('HashUtils', () => {
  describe('calculateStringHash', () => {
    it('should calculate consistent hash for the same string', () => {
      const testString = 'Hello, World!';
      const hash1 = HashUtils.calculateStringHash(testString);
      const hash2 = HashUtils.calculateStringHash(testString);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
```

## 故障排除

### 常见问题

1. **测试失败但代码看起来正确**
   - 检查模拟对象是否正确配置
   - 确认测试数据是否符合预期

2. **测试运行缓慢**
   - 检查是否有未完成的异步操作
   - 确认没有不必要的外部依赖调用

3. **覆盖率报告不完整**
   - 确认所有代码路径都有对应的测试
   - 检查是否有未测试的边界条件

### 调试测试

```bash
# 运行单个测试文件并显示详细输出
npm test -- src/utils/HashUtils.test.ts --verbose

# 运行测试并启用调试模式
npm test -- --inspect-brk
```

## 持续集成

测试配置已集成到CI/CD流程中，每次代码提交都会自动运行所有测试以确保代码质量。