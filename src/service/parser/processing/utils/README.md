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
UniversalTextStrategy.ts
策略提供者: src/service/parser/processing/strategies/providers/LineStrategyProvider.ts 和 src/service/parser/processing/strategies/providers/BracketStrategyProvider.ts 中注入并调用分块方法
工厂使用: src/service/parser/processing/strategies/factory/UnifiedStrategyFactory.ts 中注入
核心服务: src/service/parser/core/normalization/NormalizationIntegrationService.ts 和 src/service/parser/ChunkToVectorCoordinationService.ts 中注入使用
测试: src/service/parser/core/normalization/__tests__/NormalizationIntegrationService.test.ts 中 mock 使用
依赖注入: src/core/registrars/BusinessServiceRegistrar.ts 中绑定到容器
类型定义: src/types.ts 中注册为符号
导出: 通过 src/service/parser/processing/utils/index.ts 导出


潜在的路径调整建议（可选）
如果需要更细粒度的组织，可以考虑以下调整，但目前不是必需的：

UniversalTextStrategy.ts
建议: 可移动到 src/service/parser/processing/strategies/impl/
理由: 它是核心分块策略实现，被多个策略提供者使用

ContentHashIDGenerator.ts、SemanticBoundaryAnalyzer.ts 和 SyntaxValidator.ts
建议: 保持在 utils/ 目录
理由: 作为核心工具类，被多个模块广泛使用，位置合适且符合架构设计
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
