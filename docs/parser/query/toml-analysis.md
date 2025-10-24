### TOML查询规则分析结论

经过全面评估，当前[`src/service/parser/constants/queries/toml.ts`](src/service/parser/constants/queries/toml.ts:2)中的查询规则**基本足够**用于代码分块，但存在**关键缺失**需要优化：

#### ✅ 已覆盖的核心结构
1. **基础键值对**：完整捕获裸键(`bare_key`)和值类型
   ```tree-sitter
   (pair
     key: (bare_key) @name.definition.key
     value: (_) @definition.value) @definition.pair
   ```
2. **表结构**：正确识别普通表和数组表
   ```tree-sitter
   (table) @definition.table
   (table_array_element) @definition.table_array
   ```
3. **数据类型**：覆盖所有基本值类型
   ```tree-sitter
   (string) @definition.string
   (integer) @definition.integer
   (float) @definition.float
   (boolean) @definition.boolean
   (offset_date_time) @definition.datetime
   (local_date) @definition.date
   (local_time) @definition.time
   ```

#### ⚠️ 关键缺失项
1. **带引号键的捕获缺失**（最严重问题）：
   - TOML规范允许带引号的键（如`"key with space" = "value"`）
   - 当前规则仅捕获`bare_key`，**完全忽略`quoted_key`**
   - 导致包含带引号键的配置项无法被正确分块

2. **点分键处理不足**：
   - 虽捕获`(dotted_key)`节点，但**未分解内部结构**
   - 无法获取点分键的层级关系（如`a.b.c`应分解为`a`→`b`→`c`）
   - 影响后续适配器的层级分析能力

#### 📊 优化建议（最小必要修改）
```diff
; Key-value pairs - capture ALL key types
(pair
-  key: (bare_key) @name.definition.key
+  key: [
+    (bare_key)
+    (quoted_key)
+  ] @name.definition.key
   value: (_) @definition.value) @definition.pair

; Dotted keys - enable hierarchical analysis
(dotted_key
+  (bare_key) @name.definition.dotted_segment
+  (quoted_key) @name.definition.dotted_segment
) @name.definition.dotted_key
```

#### 📌 最终结论
当前规则**不足够**用于生产环境的代码分块：
- 带引号键的缺失会导致**关键配置项丢失**
- 点分键处理不足影响**层级关系分析**
- 但其他基础结构覆盖良好，只需**针对性补充2处规则**

建议优先添加带引号键支持，点分键优化可根据后续适配器需求决定是否实施。这些修改不会影响现有功能，且符合"最小必要规则"原则。