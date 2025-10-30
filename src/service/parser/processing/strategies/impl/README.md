通过分析 `src\service\parser\processing\strategies\impl` 目录中的文件，我发现这些实现类主要分为两类：

## 实现的接口类型

1. **ISplitStrategy接口** - 代码分割策略接口
2. **IProcessingStrategy接口** - 代码处理策略接口
3. **Splitter接口** - 完整代码分割器接口

## 各文件实现的主要区别

### ISplitStrategy实现类
- **ClassStrategy.ts** - 专注于类定义的提取和分割
- **FunctionStrategy.ts** - 专注于函数/方法定义的提取和分割
- **ImportStrategy.ts** - 专注于导入语句的提取和分割
- **ModuleStrategy.ts** - 专注于模块级别定义的提取和分割
- **SemanticStrategy.ts** - 使用语义评分进行分割
- **IntelligentStrategy.ts** - 使用语义边界分析和语法验证
- **StructureAwareStrategy.ts** - 基于标准化查询结果进行智能分割
- **SyntaxAwareStrategy.ts** - 组合多种策略的语法感知分割

### IProcessingStrategy实现类
- **ASTStrategy.ts** - 使用TreeSitter进行AST解析和处理

### Splitter实现类
- **ASTCodeSplitter.ts** - 完整的代码分割器，包含策略选择和协调功能

## 主要区别

1. **功能定位**：ISplitStrategy专注于代码分割，IProcessingStrategy专注于代码处理，Splitter提供完整功能

2. **继承结构**：大部分ISplitStrategy实现类继承自BaseSplitStrategy，而其他类直接实现接口

3. **依赖关系**：基于AST的策略依赖TreeSitterService，语义策略依赖复杂度计算器，组合策略协调多个其他策略

4. **复杂度**：从简单策略（ImportStrategy）到复杂策略（IntelligentStrategy）再到协调器（ASTCodeSplitter），复杂度递增

5. **提供者模式**：每个策略都有对应的Provider类实现IStrategyProvider接口，用于创建和管理策略实例

这种设计体现了策略模式和工厂模式的应用，使系统可根据不同需求选择合适的分割策略，同时保持良好的扩展性和可维护性。