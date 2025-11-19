# 统一测试脚本使用指南

## 概述

`process-test-cases.js` 是一个通用的多语言测试框架，支持灵活的参数指定，可以：
- 运行特定语言的全部测试
- 运行特定类别的测试
- 运行特定序号的测试用例
- 混合指定多个组合

## 快速开始

### 1. 运行所有测试
```bash
node process-test-cases.js
```

### 2. 运行特定语言的全部测试
```bash
node process-test-cases.js c
node process-test-cases.js python
```

### 3. 运行特定类别的测试
```bash
node process-test-cases.js c:lifecycle
node process-test-cases.js c:control-flow
```

### 4. 运行特定的测试用例
```bash
# 第1个测试用例
node process-test-cases.js c:lifecycle:001

# 第1和3个测试用例
node process-test-cases.js c:lifecycle:001,003

# 第1-5个测试用例
node process-test-cases.js c:lifecycle:001,002,003,004,005
```

### 5. 查看帮助
```bash
node process-test-cases.js --help
node process-test-cases.js -h
```

## 参数格式详解

### 格式定义

参数采用冒号分隔的三层结构：

```
[语言]:[类别]:[序号]
```

- **语言**（必需）: 编程语言标识
- **类别**（可选）: 测试类别名称，支持前缀匹配
- **序号**（可选）: 测试用例序号（1-based），多个序号用逗号分隔

### 支持的语言

```
c           # C语言
python      # Python
javascript  # JavaScript
java        # Java
go          # Go
rust        # Rust
```

### C语言支持的类别

```
lifecycle-relationships     # 生命周期管理
control-flow               # 控制流语句
control-flow-relationships # 控制流关系分析
data-flow                  # 数据流分析
functions                  # 函数定义和调用
structs                    # 结构体定义和使用
concurrency               # 并发编程
```

### 类别前缀匹配

类别支持前缀匹配，只需输入足够的前缀即可：

```bash
# 以下几种写法等效
node process-test-cases.js c:lifecycle-relationships
node process-test-cases.js c:lifecycle-rel
node process-test-cases.js c:lifecycle
node process-test-cases.js c:life

# 以下几种写法等效
node process-test-cases.js c:control-flow
node process-test-cases.js c:control
node process-test-cases.js c:ctrl
```

特殊前缀 `all` 表示该语言的所有类别：

```bash
node process-test-cases.js c:all
```

## 使用示例

### 基本示例

```bash
# 运行所有测试
node process-test-cases.js

# 运行所有C语言测试
node process-test-cases.js c

# 运行C语言的lifecycle测试
node process-test-cases.js c:lifecycle

# 运行C语言lifecycle的第1个测试
node process-test-cases.js c:lifecycle:001
```

### 高级示例

```bash
# 运行多个特定测试用例
node process-test-cases.js c:lifecycle:001,003,005

# 运行多个类别
node process-test-cases.js c:lifecycle c:structs

# 混合指定
node process-test-cases.js c:lifecycle:001 c:structs:001,002

# 用逗号分隔（效果相同）
node process-test-cases.js c:lifecycle:001,c:structs:001,002
```

### 调试特定问题

```bash
# 测试单个问题的修复
node process-test-cases.js c:lifecycle:025

# 测试某个类别的前3个用例
node process-test-cases.js c:lifecycle:001,002,003

# 测试所有control-flow相关的测试
node process-test-cases.js c:control-flow c:control-flow-relationships
```

## 输出说明

### 控制台输出

```
处理3个测试指定

处理 c:lifecycle-relationships: 找到 30 个测试用例，处理 3 个
  ✓ lifecycle-001
  ✓ lifecycle-002
  ✓ lifecycle-003

处理 c:structs: 找到 15 个测试用例，处理 15 个
  ✓ structs-001
  ...
  ✗ 错误处理测试用例 structs-010: Query executed successfully but found no matches

============================================================
测试执行总结
============================================================

[c:lifecycle-relationships]
  总计: 3, 通过: 3, 失败: 0

[c:structs]
  总计: 15, 通过: 14, 失败: 1
  ⚠️  空匹配: 1 (查询无结果)

✓ 处理完成!
```

### 结果文件

每个测试用例的详细结果保存到：

```
src/service/parser/__tests__/c/{category}/results/result-{序号}.json
```

示例 `result-001.json`：

```json
{
  "testId": "lifecycle-001",
  "request": {
    "language": "c",
    "code": "...",
    "query": "..."
  },
  "response": {
    "success": true,
    "data": [
      {
        "type": "call_expression",
        "matches": {...}
      }
    ]
  },
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

## 常见用法

### 快速调试工作流

```bash
# 1. 修改测试用例或查询文件
# vim src/service/parser/__tests__/c/lifecycle/tests/test-001/query.txt

# 2. 快速测试该用例
node process-test-cases.js c:lifecycle:001

# 3. 检查结果
cat src/service/parser/__tests__/c/lifecycle/results/result-001.json

# 4. 如果有多个问题，修改后继续
node process-test-cases.js c:lifecycle:001,002,003
```

### 验证类别

```bash
# 验证lifecycle类别的所有用例
node process-test-cases.js c:lifecycle

# 如有失败，修改后重新运行全部
node process-test-cases.js c:lifecycle

# 或只重新运行失败的那个
node process-test-cases.js c:lifecycle:025
```

### 批量验证

```bash
# 验证所有C语言测试
node process-test-cases.js c

# 验证lifecycle和structs
node process-test-cases.js c:lifecycle c:structs

# 验证所有结构相关的测试
node process-test-cases.js c:structs c:control-flow-relationships
```

## 参数解析规则

1. **参数分隔**
   - 多个参数可用 **逗号** 或 **空格** 分隔
   - 建议用 **逗号** 在长参数列表中避免shell扩展问题

2. **大小写不敏感**
   - 语言和类别不区分大小写
   - `c:LIFECYCLE` 等同于 `c:lifecycle`

3. **前缀匹配**
   - 类别支持前缀匹配
   - `c:life` 会匹配 `lifecycle-relationships`

4. **序号范围**
   - 序号必须是正整数，基于1
   - 自动转换为0-based内部索引
   - 无效的序号会被忽略

5. **去重和合并**
   - 重复指定的测试用例会自动去重
   - 相同类别的序号会合并处理

## 故障排除

### 问题：提示语言不支持

```
⚠️  不支持的语言: javascript
```

**解决**：检查是否拼写正确，目前支持的语言见上面的列表。

### 问题：提示类别不存在

```
⚠️  未找到匹配的类别: c:xyz
```

**解决**：检查类别名称，或运行 `c:all` 查看所有可用类别。

### 问题：索引文件不存在

```
⏭️  跳过 c:lifecycle (索引文件不存在)
```

**解决**：确认该类别已迁移到新架构，查看是否存在 `{category}.json` 文件。

### 问题：所有测试都失败

```
总计: 30, 通过: 0, 失败: 30
```

**解决**：
1. 检查API服务是否运行（localhost:4001）
2. 检查测试文件结构是否完整（code.c, query.txt, metadata.json）
3. 运行单个测试查看详细错误

## 扩展支持新语言

### 1. 添加语言支持

编辑 `process-test-cases.js`：

```javascript
// 添加到 SUPPORTED_LANGUAGES
const SUPPORTED_LANGUAGES = ['c', 'python', 'javascript', 'java', 'go', 'rust', 'cpp'];

// 添加到 TEST_CATEGORIES
const TEST_CATEGORIES = {
  c: [...],
  cpp: [
    'classes',
    'templates',
    'memory-management'
  ],
  // ... 其他语言
};
```

### 2. 创建测试文件结构

```bash
mkdir -p src/service/parser/__tests__/cpp/classes/tests/test-001
# 创建 code.cpp, query.txt, metadata.json
```

### 3. 生成索引文件

使用迁移脚本或手动创建 `cpp/classes.json`

### 4. 立即开始测试

```bash
node process-test-cases.js cpp:classes
```

## API兼容性

脚本使用以下API端点：

### `/api/parse` (POST)

**请求格式**：
```json
{
  "language": "c",
  "code": "...",
  "query": "..."
}
```

**响应格式**：
```json
{
  "success": boolean,
  "data": [...],
  "errors": [...],
  "message": "..."
}
```

详细文档见 `src/service/parser/__tests__/api.md`

## 性能提示

1. **并行测试**: 脚本顺序处理，可手动修改实现并行
2. **批量结果**: 每个测试结果单独保存，便于查看
3. **缓存**: 结果保存到 `results/` 目录，不会覆盖历史记录
4. **网络**: 默认每个请求30秒超时（HTTP库默认）
