`src/service/parser/detection/FileFeatureDetector.ts`：

isCodeLanguage() 方法硬编码了代码语言列表：['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp', 'go', 'rust', 'php', 'ruby', 'css', 'html', 'json', 'yaml', 'xml']
canUseTreeSitter() 方法硬编码了 TreeSitter 支持的语言列表
isStructuredFile() 方法硬编码了结构化语言列表：['json', 'xml', 'html', 'yaml', 'css', 'sql']
src/service/filesystem/languageConstants.ts：

定义了 LANGUAGE_MAP 和 DEFAULT_SUPPORTED_EXTENSIONS，包含支持的文件扩展名
文件遍历和索引服务：

FileTraversalService 使用 includePatterns 和 excludePatterns 过滤文件
索引服务可能在处理前过滤非代码文件
检测和处理服务：

DetectionService、ProcessingGuard 等在处理文件前检测语言类型
多个策略类（如 ImportStrategy、FunctionStrategy 等）可能基于文件类型进行处理
这些地方普遍存在硬编码问题，建议统一复用 language-constants.ts 中的常量定义。