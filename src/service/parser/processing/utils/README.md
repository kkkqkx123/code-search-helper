SemanticBoundaryAnalyzer.ts
测试使用: 专属测试文件 src/service/parser/processing/utils/__tests__/SemanticBoundaryAnalyzer.test.ts
策略使用: src/service/parser/processing/strategies/impl/IntelligentStrategy.ts 中实例化并调用 calculateBoundaryScore
工具使用: src/service/parser/processing/utils/overlap/UnifiedOverlapCalculator.ts 和 src/service/parser/processing/strategies/providers/IntelligentStrategyProvider.ts 中实例化
性能优化: src/service/parser/processing/utils/performance/ChunkingPerformanceOptimizer.ts 中导入 BoundaryScore 接口
导出: 通过 src/service/parser/processing/utils/index.ts 导出
SyntaxValidator.ts
策略使用: src/service/parser/processing/strategies/impl/IntelligentStrategy.ts 中实例化并调用 validate 方法
类型定义: src/service/parser/types.ts 中定义接口
导出: 通过 src/service/parser/processing/utils/index.ts 和 src/service/parser/processing/index.ts 导出
ContentHashIDGenerator.ts
功能: 基于代码内容生成唯一ID，解决传统基于位置的ID无法识别内容相似性的问题
核心特性: 内容哈希生成、内容标准化、缓存机制、快速相似度检查
主要方法: generateNodeId()、generateChunkId()、isPotentiallySimilar()、getContentHashPrefix()
使用场景: 被几乎所有工具类使用，是整个分割系统的核心组件
工具使用: SimilarityUtils、SimilarityDetector、UnifiedOverlapCalculator、ChunkSimilarityUtils、SmartDeduplicationUtils
AST处理: ASTNodeTracker、ASTNodeExtractor 中用于节点ID生成和内容哈希
策略实现: ModuleStrategy、ImportStrategy、FunctionStrategy、ClassStrategy 中广泛使用
导出: 通过 src/service/parser/processing/utils/index.ts 导出
缓存管理: 内置LRU缓存机制，支持缓存统计和清理
