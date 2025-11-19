# 查询一致性校验指南

本文档说明如何使用校验脚本确保测试用例与查询常量定义保持同步。

## 为什么需要校验

在开发过程中，您可能会：
- 修改测试用例中的 `query.txt` 文件
- 修改查询常量定义文件 (`src/service/parser/constants/queries/{language}/{category}.ts`)
- 添加新的测试用例或查询

这些变更可能导致两者不同步，造成：
1. 测试用例中有的查询在常量文件中不存在
2. 常量文件中有的查询没有对应的测试用例
3. 看似相同的查询实际上因为格式问题而不同步

校验脚本可以自动检测这些问题。

## 快速开始

### 1. 全量验证（验证所有查询）

验证特定语言的特定类别：
```bash
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c lifecycle
```

验证特定语言的所有类别：
```bash
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c
```

验证所有语言的所有类别：
```bash
node src/service/parser/__tests__/scripts/validate-queries-consistency.js
```

### 2. 诊断失败原因（详细分析）

当验证失败时，使用诊断脚本找出具体的差异：

```bash
node src/service/parser/__tests__/scripts/diagnose-query-mismatches.js c lifecycle
```

诊断脚本会显示：
- 哪些测试用例没有在常量文件中找到匹配的查询
- 最相似的常量查询是什么（包含相似度百分比）
- 具体的差异在哪些行（按行显示差异）
- 哪些常量查询未被任何测试用例使用

### 3. 诊断单个测试用例

如果您只想诊断特定的失败测试：

```bash
node src/service/parser/__tests__/scripts/diagnose-query-mismatches.js c lifecycle lifecycle-relationships-011
```

## 工作流程

### 修改测试用例后的验证流程

```bash
# 1. 修改测试文件
# 编辑 src/service/parser/__tests__/c/lifecycle-relationships/tests/test-XXX/query.txt

# 2. 立即进行一致性校验
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c lifecycle

# 如果失败，诊断差异
node src/service/parser/__tests__/scripts/diagnose-query-mismatches.js c lifecycle

# 3. 根据诊断结果修复问题
# a) 如果是新增查询：添加到 src/service/parser/constants/queries/c/lifecycle-relationships.ts
# b) 如果是修改查询：更新常量文件中的对应查询
# c) 如果是删除查询：从常量文件中删除对应查询

# 4. 重新验证确认成功
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c lifecycle
```

### 修改常量文件后的验证流程

```bash
# 1. 修改查询常量文件
# 编辑 src/service/parser/constants/queries/c/lifecycle-relationships.ts

# 2. 验证一致性
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c lifecycle

# 如果失败，可能是：
# - 新增查询没有对应的测试用例
# - 修改查询时与测试用例格式不一致

# 3. 根据需要修改测试用例或常量文件
```

## 理解验证结果

### 成功验证

```
✅ 通过的类别

  [c:lifecycle-relationships]
    测试用例: 30, 常量查询: 30, 匹配: 30
```

表示：
- 30 个测试用例都在常量文件中找到了匹配的查询
- 常量文件中的 30 个查询都被测试用例使用
- 完全同步 ✓

### 失败验证

```
❌ 失败的类别

  [c:lifecycle-relationships]
    测试用例: 30, 常量查询: 30
    ✓ 匹配: 21
    ✗ 不匹配: 9
    ⚠️  未使用常量查询: 9
```

表示：
- 30 个测试用例中有 21 个找到了匹配
- 9 个测试用例没有在常量文件中找到匹配的查询
- 9 个常量查询没有被任何测试用例使用

## 常见问题

### Q: 为什么高相似度的查询还是显示不匹配？

**A:** 因为校验脚本使用严格的字符串比较。常见的格式差异包括：
- 多余的空白符或换行符
- 括号位置不同
- 注释的有无

诊断脚本会显示具体是哪一行不同。

### Q: 如何快速修复大量的格式差异？

**A:** 
1. 先用诊断脚本查看所有差异
2. 确认差异类型后，使用脚本批量修复：
   - 使用 `trim()` 移除前后空白
   - 使用代码编辑器的查找替换功能修复格式

### Q: 我添加了一个新的测试用例，应该怎么做？

**A:**
1. 创建测试目录：`tests/test-031/`
2. 添加 `code.c`, `query.txt`, `metadata.json`
3. **重要：** 确保查询在常量文件中存在
4. 运行校验脚本验证

### Q: 我想从常量文件中删除一个查询，应该怎么做？

**A:**
1. 先检查是否有测试用例使用这个查询：
   ```bash
   node src/service/parser/__tests__/scripts/diagnose-query-mismatches.js c lifecycle
   ```
2. 如果有未使用的查询列表，确认要删除的查询是否在其中
3. 删除常量文件中的查询
4. 删除对应的测试用例（如果有）
5. 运行校验脚本确认

## 集成到工作流

### 在验收标准中

参考 `prompt.md` 第二步，校验脚本必须通过才能认为验收完成。

### 在持续集成中

建议在 CI/CD 流程中添加：
```bash
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c
```

确保每次提交都保持查询同步。

## 脚本选项参考

### validate-queries-consistency.js

```bash
# 验证所有语言
node validate-queries-consistency.js

# 验证特定语言
node validate-queries-consistency.js c

# 验证特定类别（前缀匹配）
node validate-queries-consistency.js c lifecycle

# 验证完整类别名
node validate-queries-consistency.js c lifecycle-relationships
```

### diagnose-query-mismatches.js

```bash
# 诊断整个类别的不匹配
node diagnose-query-mismatches.js c lifecycle

# 诊断特定测试用例
node diagnose-query-mismatches.js c lifecycle lifecycle-relationships-011
```

## 最佳实践

1. **每次修改后立即验证**：不要积累多个修改再验证
2. **先诊断后修复**：理解具体差异后再修改
3. **保持格式一致**：定期清理查询的格式（空白符、换行等）
4. **在提交前验证**：确保通过全量验证再提交代码
5. **记录修复步骤**：在提交消息中说明修复的不匹配

## 故障排除

### 脚本找不到文件

```
常量文件不存在: ...
```

检查：
1. 语言名称是否正确（c, python, javascript 等）
2. 类别名称是否正确
3. 常量文件是否存在于 `src/service/parser/constants/queries/{language}/`

### 测试文件无法读取

```
索引文件不存在: ...
```

检查：
1. 测试目录是否存在
2. 索引文件 `{category}.json` 是否存在
3. 索引文件格式是否正确

## 相关文档

- [prompt.md](./prompt.md) - 验收标准
- [README.md](./README.md) - 脚本总览
- [TESTING_GUIDE.md](../TESTING_GUIDE.md) - 测试指南
