ChunkToVectorCoordinationService 使用的数据主要来自以下模块：

文件系统 (fs): 通过 fs.readFile 读取文件内容作为原始数据源
DetectionService: 提供文件语言检测和统一检测结果
ASTCodeSplitter: 执行智能代码分段，优先处理支持AST的语言
GuardCoordinator: 决定是否启用降级处理策略
UniversalTextStrategy 和 BackupFileProcessor: 备用分段策略（括号平衡或行分段）
EmbedderFactory: 生成向量嵌入数据
ProjectIdManager: 提供项目ID映射
VectorBatchOptimizer: 优化嵌入批处理操作
这些模块通过依赖注入方式提供数据，服务协调文件处理、分段和向量转换的完整流程。