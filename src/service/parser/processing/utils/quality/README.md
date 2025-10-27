[`CodeQualityAssessmentUtils`](src/service/parser/processing/quality/CodeQualityAssessmentUtils.ts) 和 [`ComplexityCalculator`](src/service/parser/processing/quality/ComplexityCalculator.ts) 主要在 [`UnifiedOverlapCalculator`](src/service/parser/processing/utils/overlap/UnifiedOverlapCalculator.ts) 中被用于评估代码块和重叠内容的质量。

具体使用情况如下：
1. [`CodeQualityAssessmentUtils`](src/service/parser/processing/quality/CodeQualityAssessmentUtils.ts:19) 提供了 `calculateOverlapQuality` 方法，用于计算重叠内容的质量评分。该方法通过分析代码结构、注释覆盖率、命名规范等因素来评估质量。
2. [`UnifiedOverlapCalculator`](src/service/parser/processing/utils/overlap/UnifiedOverlapCalculator.ts:716) 在 `applyFinalOptimizations` 方法中使用质量评估结果，当检测到重叠内容包含已使用的AST节点时，会降低质量评分并减少重叠行数。
3. 这些质量评估工具与 `UnifiedOverlapCalculator` 紧密集成，确保生成的代码块和重叠内容具有高质量，避免包含重复或低质量的代码片段。