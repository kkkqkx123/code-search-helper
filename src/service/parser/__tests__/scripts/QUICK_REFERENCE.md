# 校验脚本快速参考

## 一行总结
**运行测试 → 验证通过 → 校验一致性 → 诊断修复 → 重新校验**

## 完整工作流

```bash
# 1️⃣ 运行测试
node src/service/parser/__tests__/scripts/process-test-cases.js c:lifecycle

# 2️⃣ 验证一致性（重要！此步骤必须通过）
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c lifecycle

# 如果失败，执行下一步

# 3️⃣ 诊断具体差异
node src/service/parser/__tests__/scripts/diagnose-query-mismatches.js c lifecycle

# 4️⃣ 根据诊断修复代码或常量文件

# 5️⃣ 重新校验确认通过
node src/service/parser/__tests__/scripts/validate-queries-consistency.js c lifecycle
```

## 常用命令

| 场景 | 命令 |
|------|------|
| 验证所有查询 | `validate-queries-consistency.js c lifecycle` |
| 诊断所有差异 | `diagnose-query-mismatches.js c lifecycle` |
| 诊断单个用例 | `diagnose-query-mismatches.js c lifecycle lifecycle-relationships-011` |
| 验证所有语言 | `validate-queries-consistency.js` |

## 诊断输出说明

```
✅ 通过             → 所有查询同步，无需修复
❌ 失败             → 存在不匹配，需要诊断
⚠️  最相似度 X%    → 查询相似但格式不同
```

## 修复指南

| 问题 | 解决方案 |
|------|---------|
| 测试用例有，常量文件无 | 添加到常量文件 |
| 常量文件有，测试用例无 | 添加测试用例或删除常量 |
| 高相似度但不同 | 对齐格式（空白、换行等） |
| 0% 相似度 | 完全新增，需要添加 |

## 成功标志

```
✅ 通过的类别

  [c:lifecycle-relationships]
    测试用例: 30, 常量查询: 30, 匹配: 30
```

表示完全同步！
