1. `ASTStrategy` - 在 `src/service/parser/processing/strategies/impl/ASTStrategy.ts` 中，实现了 `IProcessingStrategy` 接口，由 `ProcessingStrategyFactory` 使用
2. `ASTSplitStrategy` - 在 `src/service/parser/processing/strategies/providers/ASTStrategyProvider.ts` 中，实现了 `ISplitStrategy` 接口，由 `UnifiedStrategyFactory` 使用




是的，这两个模块存在重复功能。

重复点：

ASTStrategy 和 ASTSplitStrategy 的 split 方法逻辑高度相似，都使用 TreeSitterService 解析代码、提取函数和类、计算复杂度
都支持相同的编程语言列表
错误处理和 fallback 逻辑基本一致
区别：

ASTStrategy 额外实现了 IProcessingStrategy，包含 execute 方法用于完整文件处理
ASTSplitStrategy 仅专注分块策略，由 ASTStrategyProvider 创建和管理
ASTSplitStrategy 在输出中添加了 id 字段
建议：
可以考虑重构，将共享的 AST 解析逻辑提取到一个公共的工具类中，避免代码重复。ASTStrategy 可以作为更通用的实现，而 ASTSplitStrategy 专注于分块场景。


这2个文件各自负责什么职责？是否需要删掉1个？

首先，用户的问题是：这两个文件各自负责什么职责？是否需要删掉1个？

Examining file responsibilities
The user's question is whether two files have distinct roles and if one can be deleted.
Focusing on ASTStrategy.
ProcessingStrategyFactory
42 matches

现在查看 ProcessingStrategyFactory 的实现。


src\service\parser\processing\strategies\providers\ProcessingStrategyFactory.ts

ProcessingStrategyFactory 使用 ASTStrategy 作为 IProcessingStrategy，通过 registry。

UnifiedStrategyFactory
45 matches

现在读取 UnifiedStrategyFactory 的实现。


src\service\parser\processing\strategies\factory\UnifiedStrategyFactory.ts

现在我理解了架构。

Examining Processing Architecture
ProcessingStrategyFactory creates IProcessingStrategy instances for handling complete files.
职责区分：

ASTStrategy（由 ProcessingStrategyFactory 使用）：

职责：完整文件处理，实现了 IProcessingStrategy 和 ISplitStrategy
执行 execute 方法，返回 chunks + metadata 对象
用于文件级别的完整处理流程
ASTSplitStrategy（由 UnifiedStrategyFactory 通过 ASTStrategyProvider 使用）：

职责：专门的分块策略，仅实现 ISplitStrategy
执行 split 方法，返回 CodeChunk[] 数组
用于代码分块分割流程
是否需要删除：
不需要删除任何一个，它们服务于不同的工厂和接口系统：

ProcessingStrategyFactory → IProcessingStrategy（文件处理）
UnifiedStrategyFactory → ISplitStrategy（代码分块）
建议：
提取共享的 AST 解析逻辑到一个公共的工具类（如 ASTParserUtils），让两个策略都使用它来消除重复代码。两个策略可以保留，因为它们在不同的上下文中使用。