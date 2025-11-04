# Query Rules Test Script

这个脚本用于验证代码库中各个编程语言的Tree-sitter查询文件的存在性和语法正确性。

## 功能特性

- **文件存在性检查**: 验证查询文件是否能正常加载
- **语法验证**: 检查查询语法是否正确（括号平衡等）
- **语言过滤**: 支持只测试指定编程语言

## 支持的语言

- JavaScript
- Python
- Java
- C

## 使用方法

### 基本用法

```bash
# 运行所有语言的测试（默认行为）
npm run test:query-rules

# 或直接运行脚本
npx ts-node scripts/query-verify/test-query-rules.ts
```

### 指定语言

```bash
# 只测试 JavaScript
npm run test:query-rules --lang=javascript

# 测试多个语言
npm run test:query-rules --lang=javascript --lang=python

# 或者使用完整参数名
npm run test:query-rules --language=javascript --language=c
```

### 获取帮助

```bash
npm run test:query-rules --help
```

## 输出说明

脚本会输出以下信息：

- ✅ **成功加载**: 显示查询文件的大小（字符数）
- ✓ **语法验证通过**: 查询语法正确
- ✗ **语法错误**: 显示具体的语法错误信息

## 示例输出

```
Testing new query files existence...

Testing JavaScript query files...
✓ JavaScript data-flow query loaded: 2037 characters
✓ JavaScript semantic-relationships query loaded: 2999 characters

✅ Query files for selected languages (javascript) have been successfully tested!

Validating query syntax...

✓ JavaScript data-flow syntax is valid
✓ JavaScript semantic-relationships syntax is valid

✅ All query syntax validations completed!

🎉 All tests completed successfully!
```

## 注意事项

- 如果查询文件有语法错误，脚本会继续执行但会报告错误
- 语法验证包括括号平衡检查和基本查询模式验证
- 测试失败不会阻止脚本继续运行其他语言的测试
