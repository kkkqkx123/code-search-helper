# Query Rules Verification Tools

这个目录包含多个用于验证代码库中Tree-sitter查询文件的脚本工具。

## 脚本概览

### 1. test-query-rules.ts
主要的测试脚本，用于验证查询文件的存在性和基本语法正确性。

### 2. simple-balance-check.js
增强的查询文件分析工具，提供详细的语法检查和问题诊断。

### 3. check-cpp-queries.js
专门用于C++查询文件的全面分析工具。

## 支持的语言

- JavaScript
- Python
- Java
- C
- C#
- C++

## test-query-rules.ts 使用方法

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

## simple-balance-check.js 使用方法

### 基本用法

```bash
# 检查默认的C++ lifecycle-relationships文件
node scripts/query-verify/simple-balance-check.js

# 检查指定语言的默认文件
node scripts/query-verify/simple-balance-check.js --lang=javascript

# 检查指定文件
node scripts/query-verify/simple-balance-check.js src/service/parser/constants/queries/cpp/data-flow.ts

# 详细模式显示更多信息
node scripts/query-verify/simple-balance-check.js --verbose

# 获取帮助信息
node scripts/query-verify/simple-balance-check.js --help
```

### 参数说明

- `--file=<path>`: 指定要检查的查询文件路径
- `--lang=<language>`: 指定语言代码（cpp, javascript, python, java, c, csharp）
- `--verbose, -v`: 显示详细的分析信息
- `--help, -h`: 显示帮助信息

### 功能特性

- **括号平衡检查**: 检查查询中的括号是否正确配对
- **字符串检查**: 验证字符串是否正确关闭
- **查询模式验证**: 检查查询结构是否符合Tree-sitter语法
- **谓词检查**: 分析谓词表达式中的潜在问题
- **详细错误报告**: 提供行号和上下文信息
- **统计信息**: 显示查询数量、谓词数量和注释数量

## check-cpp-queries.js 使用方法

### 基本用法

```bash
# 分析所有C++查询文件
node scripts/query-verify/check-cpp-queries.js
```

### 功能特性

- **全面分析**: 对所有C++查询文件进行深度分析
- **问题汇总**: 提供所有发现问题的汇总报告
- **统计对比**: 比较不同文件的查询复杂度

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

## 常见问题和解决方案

### 1. 括号不平衡问题

**问题描述**: 查询中括号不匹配，导致Tree-sitter解析失败

**常见原因**:
- 复杂查询中嵌套层次过深
- 复制粘贴时遗漏括号
- 多行查询中括号位置错误

**解决方案**:
```bash
# 使用详细模式检查具体位置
node scripts/query-verify/simple-balance-check.js --file=path/to/query.ts --verbose
```

**预防措施**:
- 编写查询时使用代码编辑器的括号匹配功能
- 复杂查询分步构建，逐步验证
- 定期运行检查脚本

### 2. 字符串未关闭问题

**问题描述**: 查询中的字符串字面量没有正确关闭

**常见原因**:
- 谓词中的正则表达式包含特殊字符
- 字符串中包含转义字符处理不当

**解决方案**:
```bash
# 检查字符串问题
node scripts/query-verify/simple-balance-check.js --file=path/to/query.ts
```

**预防措施**:
- 在谓词中使用双引号时注意转义
- 使用正则表达式时仔细检查特殊字符

### 3. 查询模式无效问题

**问题描述**: 查询结构不符合Tree-sitter语法要求

**常见原因**:
- 查询缺少必要的节点类型
- 捕获标签格式错误
- 谓词语法错误

**解决方案**:
- 参考Tree-sitter官方文档
- 使用简单的查询测试语法
- 逐步增加查询复杂度

### 4. 谓词正则表达式问题

**问题描述**: 谓词中的正则表达式语法错误

**常见原因**:
- 未转义的特殊字符（如 `[`, `]`, `\`）
- 正则表达式语法错误

**解决方案**:
```bash
# 检查谓词问题
node scripts/query-verify/simple-balance-check.js --verbose
```

**预防措施**:
- 在正则表达式中使用双反斜杠转义特殊字符
- 测试正则表达式的有效性

## 最佳实践

### 1. 查询文件组织

```
src/service/parser/constants/queries/
├── cpp/
│   ├── data-flow.ts
│   ├── semantic-relationships.ts
│   ├── lifecycle-relationships.ts
│   └── concurrency-relationships.ts
├── javascript/
│   └── ...
└── ...
```

### 2. 查询编写规范

- **注释**: 每个查询都应该有清晰的注释说明其用途
- **命名**: 使用有意义的捕获标签名称
- **结构**: 保持查询结构清晰，适当使用换行和缩进
- **测试**: 编写查询后立即进行语法验证

### 3. 开发工作流

1. **编写查询**: 在编辑器中编写查询语法
2. **语法检查**: 运行 `simple-balance-check.js` 验证语法
3. **功能测试**: 使用实际代码测试查询效果
4. **集成测试**: 运行 `test-query-rules.ts` 进行全面测试

### 4. 调试技巧

- **分步验证**: 将复杂查询拆分为简单部分分别验证
- **上下文检查**: 使用详细模式查看错误上下文
- **参考示例**: 查看其他语言的类似查询实现

## 输出说明

### test-query-rules.ts 输出

- ✅ **成功加载**: 显示查询文件的大小（字符数）
- ✓ **语法验证通过**: 查询语法正确
- ✗ **语法错误**: 显示具体的语法错误信息

### simple-balance-check.js 输出

- ✓ **文件加载成功**: 文件读取和解析成功
- ✓ **括号平衡**: 括号配对正确
- ✓ **查询模式有效**: 查询结构符合语法
- ✓ **谓词正常**: 谓词表达式无问题
- 📊 **统计信息**: 查询数量、谓词数量、注释数量
- ❌ **问题报告**: 详细的问题描述和位置信息

## 注意事项

- 如果查询文件有语法错误，脚本会继续执行但会报告错误
- 语法验证包括括号平衡检查和基本查询模式验证
- 测试失败不会阻止脚本继续运行其他语言的测试
- 建议在提交代码前运行完整的查询验证
- 对于复杂的查询，建议使用详细模式进行深入分析
