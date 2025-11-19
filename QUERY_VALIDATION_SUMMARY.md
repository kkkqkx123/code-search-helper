# 查询校验脚本实现总结

## 问题陈述

在开发过程中，测试用例中的查询与查询常量定义很难保持完全一致，这可能导致：
- 测试用例中的查询不存在于常量文件中
- 常量文件中的查询没有对应的测试用例
- 看似相同但实际因格式差异而无法匹配的查询

## 解决方案

创建了两个互补的校验脚本：

### 1. validate-queries-consistency.js（高层验证）
**位置**: `src/service/parser/__tests__/scripts/validate-queries-consistency.js`

**功能**:
- 扫描测试用例目录和常量文件
- 提取并规范化所有查询
- 进行严格的一致性校验
- 生成清晰的报告

**输出**:
```
✅ 通过的类别 [count]
❌ 失败的类别 [count]
  - 匹配: X 个
  - 不匹配: Y 个
  - 未使用常量查询: Z 个
```

**用法**:
```bash
# 验证特定类别
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c lifecycle

# 验证特定语言
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c

# 验证所有
node src/service/parser/__tests__/scripts/validate-queries-consistency.js
```

### 2. diagnose-query-mismatches.js（深度诊断）
**位置**: `src/service/parser/__tests__/scripts/diagnose-query-mismatches.js`

**功能**:
- 详细显示每个不匹配的具体原因
- 找出最相似的常量查询及相似度
- 显示具体的行级差异
- 列出所有未使用的常量查询

**输出**:
```
❌ 发现 9 个不匹配的查询

1. lifecycle-relationships-011
   最相似的常量查询: 索引 10 (相似度: 81.7%)
   常量文件位置: 约第 45-52 行
   
   差异（共 2 处）:
     行 1:
       - (function_definition
       + (call_expression
     行 5:
       - ...

⚠️  未被使用的常量查询: 9 个
  索引 10 (第 45-52 行) - 描述: ...
```

**用法**:
```bash
# 诊断整个类别
node src/service/parser/__tests__/scripts/diagnose-query-mismatches.js c lifecycle

# 诊断特定测试用例
node src/service/parser/__tests__/scripts/diagnose-query-mismatches.js c lifecycle lifecycle-relationships-011
```

## 工作流程

```
修改代码/常量
    ↓
运行 validate-queries-consistency.js
    ↓
[通过] → ✅ 验收完成
    ↓
[失败] → 运行 diagnose-query-mismatches.js
    ↓
根据诊断结果修复
    ↓
重新运行 validate-queries-consistency.js
    ↓
[通过] → ✅ 验收完成
```

## 更新的文档

### 1. prompt.md（验收标准）
添加了新的第二步验收标准：
```
第二步：查询一致性校验（必须执行）
✅ 必须运行一致性校验脚本，确保测试用例与查询常量完全一致：
node src\service\parser\__tests__\scripts\validate-queries-consistency.js <language> <category>

此步骤失败则整个验收失败
```

### 2. TESTING_GUIDE.md（测试指南）
- 添加快速查询表中的校验命令
- 在快速开始中添加步骤4验证查询一致性
- 在快速链接中添加校验脚本链接

### 3. scripts/VALIDATION.md（详细指南）
新创建的详细文档，包含：
- 校验脚本的完整说明
- 诊断脚本的使用方法
- 常见问题和解决方案
- 工作流程和最佳实践
- 故障排除指南

### 4. scripts/QUICK_REFERENCE.md（快速参考）
简洁的一页纸参考，包含：
- 完整工作流
- 常用命令速查
- 诊断输出说明
- 修复指南

## 技术细节

### 查询规范化
两个脚本都使用相同的规范化算法：
1. 移除注释（`;` 开头的行）
2. 移除行尾注释（`;` 之后的内容）
3. 移除前后空白
4. 移除空行
5. 保留结构化内容用于精确匹配

### 相似度计算
诊断脚本使用Levenshtein编辑距离算法计算相似度：
- 100% = 完全相同
- 80-99% = 格式差异（推荐检查）
- 50-79% = 部分差异（可能相关）
- <50% = 可能无关

### 文件扫描
- 测试用例：扫描 `tests/test-XXX/query.txt`
- 常量文件：从 `export default \`...\`` 中提取
- 支持多种语言：c, python, javascript, java, go, rust

## 验收标准变更

原验收标准：
```
验证最终查询常量与已通过的测试用例是否一致
```

新验收标准（强制性）：
```
第二步：查询一致性校验（必须执行）
✅ 必须运行一致性校验脚本，确保测试用例与查询常量完全一致：
node src\service\parser\__tests__\scripts\validate-queries-consistency.js <language> <category>

此步骤失败则整个验收失败
```

## 使用流程示例

### 修改测试用例后
```bash
# 修改 src/service/parser/__tests__/c/lifecycle-relationships/tests/test-011/query.txt

# 立即校验
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c lifecycle

# 输出: 失败，9个不匹配

# 诊断
node src/service/parser/__tests__/scripts/diagnose-query-mismatches.js c lifecycle

# 根据诊断修复 src/service/parser/constants/queries/c/lifecycle-relationships.ts

# 重新校验
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c lifecycle

# 输出: 通过！✅
```

### 修改常量文件后
```bash
# 修改 src/service/parser/constants/queries/c/lifecycle-relationships.ts

# 校验
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c lifecycle

# 诊断失败原因
node src/service/parser/__tests__/scripts/diagnose-query-mismatches.js c lifecycle

# 更新测试用例或回滚常量文件修改

# 重新校验
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c lifecycle
```

## 优势

✅ **自动化** - 不依赖手工检查
✅ **准确** - 逐行对比，找出所有差异
✅ **可诊断** - 显示具体原因和修复建议
✅ **可集成** - 易于集成到 CI/CD 流程
✅ **易使用** - 简洁的命令行接口
✅ **规范化** - 统一的查询格式处理

## 后续扩展

脚本支持扩展：
1. **新语言支持** - 修改 `SUPPORTED_LANGUAGES` 和 `TEST_CATEGORIES`
2. **自动修复** - 可以添加脚本自动对齐格式
3. **CI集成** - 可以集成到 GitHub Actions/GitLab CI
4. **报告生成** - 可以生成 HTML/JSON 格式的详细报告

## 总结

通过引入这两个校验脚本和更新验收标准，确保了测试用例与查询常量定义的完全一致性，消除了大部分维护问题，提高了开发效率和代码质量。
