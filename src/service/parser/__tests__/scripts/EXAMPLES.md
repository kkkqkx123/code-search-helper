# 测试脚本使用示例

## 🎯 最常见的用途

### 验证单个查询修改

**场景**: 你修改了 `lifecycle-relationships/tests/test-025/query.txt`，想快速验证是否生效

```bash
node process-test-cases.js c:lifecycle:025
```

**输出**：
```
处理1个测试指定

处理 c:lifecycle-relationships: 找到 30 个测试用例，处理 1 个
  ✓ lifecycle-025

============================================================
测试执行总结
============================================================

[c:lifecycle-relationships]
  总计: 1, 通过: 1, 失败: 0

✓ 处理完成!
```

### 验证整个类别

**场景**: 你修复了一个共同问题，想验证整个 `lifecycle` 类别是否都通过了

```bash
node process-test-cases.js c:lifecycle
```

**输出**：
```
处理1个测试指定

处理 c:lifecycle-relationships: 找到 30 个测试用例，处理 30 个
  ✓ lifecycle-001
  ✓ lifecycle-002
  ...
  ✗ 错误处理测试用例 lifecycle-025: Query executed successfully but found no matches

============================================================
测试执行总结
============================================================

[c:lifecycle-relationships]
  总计: 30, 通过: 29, 失败: 1
  ⚠️  空匹配: 1 (查询无结果)

✓ 处理完成!
```

### 验证多个相关类别

**场景**: 你修改了与控制流相关的查询，想同时验证两个相关类别

```bash
node process-test-cases.js c:control-flow c:control-flow-relationships
```

**输出**：
```
处理2个测试指定

处理 c:control-flow: 找到 10 个测试用例，处理 10 个
  ✓ control-flow-001
  ...
  ✓ control-flow-010

处理 c:control-flow-relationships: 找到 8 个测试用例，处理 8 个
  ✓ control-flow-relationships-001
  ...
  ✓ control-flow-relationships-008

============================================================
测试执行总结
============================================================

[c:control-flow]
  总计: 10, 通过: 10, 失败: 0

[c:control-flow-relationships]
  总计: 8, 通过: 8, 失败: 0

✓ 处理完成!
```

## 🔍 调试和诊断

### 查看单个测试的详细结果

**场景**: 某个测试失败了，你想看详细的请求和响应

```bash
# 运行该测试
node process-test-cases.js c:lifecycle:025

# 查看结果文件
cat src/service/parser/__tests__/c/lifecycle-relationships/results/result-025.json
```

**结果文件示例**：
```json
{
  "testId": "lifecycle-025",
  "request": {
    "language": "c",
    "code": "#include <stdlib.h>\n\nint main() { ... }",
    "query": "(call_expression ..."
  },
  "response": {
    "success": true,
    "data": [],
    "message": "Query executed successfully but found no matches"
  },
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

从结果文件可以看出：
- `request` 显示发送了什么
- `response.success === true` 说明查询执行没错
- `response.data === []` 说明没有匹配，这是问题所在

### 对比代码和查询

**场景**: 查询无结果，想看代码和查询是否匹配

```bash
# 查看代码文件
cat src/service/parser/__tests__/c/lifecycle-relationships/tests/test-025/code.c

# 查看查询文件
cat src/service/parser/__tests__/c/lifecycle-relationships/tests/test-025/query.txt

# 查看元数据（期望的匹配数量）
cat src/service/parser/__tests__/c/lifecycle-relationships/tests/test-025/metadata.json
```

### 运行多个相关的失败用例

**场景**: 有多个测试都失败了，都涉及同一个查询模式，想一起测试修复

```bash
# 比如 test-020, test-021, test-025 都失败了
node process-test-cases.js c:lifecycle:020,021,025

# 修改查询后重新运行
node process-test-cases.js c:lifecycle:020,021,025
```

## 🚀 高效工作流

### 工作流1：快速迭代修复某个查询

```bash
# 1. 找出失败的用例（比如 test-025）
node process-test-cases.js c:lifecycle

# 2. 查看该测试的代码和查询
cat src/service/parser/__tests__/c/lifecycle-relationships/tests/test-025/code.c
cat src/service/parser/__tests__/c/lifecycle-relationships/tests/test-025/query.txt

# 3. 编辑查询文件
vim src/service/parser/__tests__/c/lifecycle-relationships/tests/test-025/query.txt

# 4. 快速验证
node process-test-cases.js c:lifecycle:025

# 5. 如果还是失败，查看详细结果
cat src/service/parser/__tests__/c/lifecycle-relationships/results/result-025.json

# 6. 重复步骤3-5直到通过

# 7. 验证修改没有破坏其他测试
node process-test-cases.js c:lifecycle
```

### 工作流2：修复一类共同的问题

```bash
# 1. 识别共同问题（比如所有XXX模式都失败）
node process-test-cases.js c:lifecycle
# 发现 test-010, 012, 015, 020, 025 都是"Query executed successfully but found no matches"

# 2. 对比这些测试的代码，找出共同点
cat src/service/parser/__tests__/c/lifecycle-relationships/tests/test-010/code.c
cat src/service/parser/__tests__/c/lifecycle-relationships/tests/test-012/code.c

# 3. 修改通用的查询（可能在 constants/queries/c/lifecycle-relationships.ts）
vim src/service/parser/constants/queries/c/lifecycle-relationships.ts

# 4. 同时更新测试用例中的 query.txt
vim src/service/parser/__tests__/c/lifecycle-relationships/tests/test-010/query.txt
# ... 更新其他失败的用例

# 5. 批量验证这些用例
node process-test-cases.js c:lifecycle:010,012,015,020,025

# 6. 如果都通过了，验证整个类别
node process-test-cases.js c:lifecycle
```

### 工作流3：添加新的测试用例

```bash
# 1. 创建新的测试目录（假设要添加 test-031）
mkdir -p src/service/parser/__tests__/c/lifecycle-relationships/tests/test-031

# 2. 添加文件
echo "..." > src/service/parser/__tests__/c/lifecycle-relationships/tests/test-031/code.c
echo "..." > src/service/parser/__tests__/c/lifecycle-relationships/tests/test-031/query.txt
echo '{"id": "lifecycle-031", "language": "c", "description": "New test"}' > src/service/parser/__tests__/c/lifecycle-relationships/tests/test-031/metadata.json

# 3. 更新索引文件 lifecycle-relationships.json
# 添加新的条目到 requests 数组

# 4. 测试新的用例
node process-test-cases.js c:lifecycle:031

# 5. 验证整个类别仍然通过
node process-test-cases.js c:lifecycle
```

## 🎓 进阶用法

### 运行特定序号范围的测试

**场景**: 只测试 test-001 到 test-005

```bash
node process-test-cases.js c:lifecycle:001,002,003,004,005
```

### 同时测试多个语言（准备好时）

**场景**: 假设已添加 Python 支持

```bash
# 运行 C 和 Python 的所有测试
node process-test-cases.js c python

# 运行特定类别
node process-test-cases.js c:lifecycle python:generators

# 混合指定
node process-test-cases.js c:lifecycle python:generators:001,002
```


## 📝 完整工作示例

### 场景：修复10个失败的测试

```bash
# 1. 运行所有C语言测试，找出失败的
node process-test-cases.js c

# 2. 从输出中识别出失败的测试（假设是 lifecycle:003, 010, 015, 020, 025）

# 3. 分析这5个测试的共同点(后缀视语言而定)
for i in 003 010 015 020 025; do
  echo "=== Test $i ==="
  head -5 src/service/parser/__tests__/c/lifecycle-relationships/tests/test-$i/code.c
done

# 4. 识别问题（比如都是关于 realloc 的）

# 5. 修改共同的查询文件
vim src/service/parser/constants/queries/c/lifecycle-relationships.ts

# 6. 同时更新所有受影响的测试用例的 query.txt
for i in 003 010 015 020 025; do
  vim src/service/parser/__tests__/c/lifecycle-relationships/tests/test-$i/query.txt
done

# 7. 批量验证这些用例
node process-test-cases.js c:lifecycle:003,010,015,020,025

# 8. 全部通过后，验证整个类别
node process-test-cases.js c:lifecycle

# 9. 最后验证没有破坏其他类别
node process-test-cases.js c
```

## 🔗 相关文档

- [USAGE.md](./USAGE.md) - 详细的参数说明
- [README.md](./README.md) - 脚本概览
- [TEST_ARCHITECTURE.md](../TEST_ARCHITECTURE.md) - 测试架构说明
