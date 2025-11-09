分析结果
CodeChunkBuilder 仍然有其价值，不能完全被 ChunkFactory 替代。

当前架构层次
CodeChunkBuilder - 底层构建器

提供流式API进行精细控制
轻量级，无额外开销
适合内部转换和性能敏感操作
ChunkFactory - 高层工厂

封装 CodeChunkBuilder
提供自动复杂度计算、哈希生成、验证等高级功能
适合策略实现的标准化创建
仍然需要 CodeChunkBuilder 的地方
OverlapPostProcessor - 后处理组件直接使用：

// 需要精细控制元数据转换，不需要额外验证
return new CodeChunkBuilder()
  .setContent(chunk.content)
  .setStartLine(chunk.metadata.startLine)
  // ...
内部转换操作 - 当不需要高级功能时使用

建议的设计原则
策略实现: 统一使用 ChunkFactory（已完成）
后处理组件: 可选择使用 CodeChunkBuilder（性能考虑）
新代码: 优先使用 ChunkFactory，除非有特殊需求
这样保持了架构的层次性，既有统一的标准化创建，也有灵活的底层控制。