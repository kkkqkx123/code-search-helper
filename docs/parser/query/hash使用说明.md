QueryResultNormalizer.ts中当前使用HashUtils是**合适且正确的**，不需要改为简单哈希算法。

**分析依据：**

1. **使用场景不同**：
   - QueryResultNormalizer：用于AST缓存键、文件哈希、分段哈希
   - BaseLanguageAdapter：用于查询结果缓存键

2. **数据完整性要求**：
   - AST缓存键需要保证唯一性和一致性
   - 文件哈希用于缓存失效检测，需要高可靠性
   - 分段哈希用于内容识别，需要低冲突率

3. **性能考虑**：
   - QueryResultNormalizer中的哈希计算频率相对较低
   - 数据完整性比性能更重要
   - SHA-256的额外开销在可接受范围内

4. **代码一致性**：
   - 文件已正确导入HashUtils（第12行）
   - 统一使用项目标准哈希工具
   - 避免重复实现

**结论**：QueryResultNormalizer.ts保持使用HashUtils是最佳选择，而BaseLanguageAdapter中的简单哈希也符合其高频缓存场景的需求。