**SimilarityUtils 职责：**
- 基础相似度计算和算法实现
- 代码块过滤和去重（`filterSimilarChunks` 独有功能）
- 复杂的元数据处理和节点关系分析
- 作为相似度计算的基础工具类

**ChunkSimilarityUtils 职责：**
- 代码块合并和重叠处理（更精确的位置关系判断）
- 内容哈希优化和快速重复检测
- 在 UnifiedOverlapCalculator 中的专用集成
- 作为代码块处理的专业工具类

**统一原则：**
- 新代码优先使用 ChunkSimilarityUtils 进行代码块操作
- 相似度计算和过滤功能使用 SimilarityUtils
- 逐步迁移重叠计算相关功能到 ChunkSimilarityUtils
- 保持向后兼容性，避免破坏性修改