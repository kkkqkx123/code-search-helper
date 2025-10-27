// AST策略提供者
export { ASTSplitStrategy, ASTStrategyProvider } from './ASTStrategyProvider';

// 语义策略提供者
export { SemanticSplitStrategy as SemanticStrategy, SemanticStrategyProvider } from './SemanticStrategyProvider';

// 行级策略提供者
export { LineSplitStrategy, LineStrategyProvider } from './LineStrategyProvider';

// 专门格式策略提供者
export {
  MarkdownSplitStrategy,
  XMLSplitStrategy,
  MarkdownStrategyProvider,
  XMLStrategyProvider
} from './SpecializedStrategyProvider';

// 括号策略提供者
export { BracketSplitStrategy, BracketStrategyProvider } from './BracketStrategyProvider';

// AST高级策略提供者（函数、类、模块、分层）
export { FunctionSplitStrategy, FunctionStrategyProvider } from './FunctionStrategyProvider';
export { ClassSplitStrategy, ClassStrategyProvider } from './ClassStrategyProvider';
export { ModuleSplitStrategy, ModuleStrategyProvider } from './ModuleStrategyProvider';
export { HierarchicalSplitStrategy, HierarchicalStrategyProvider } from './HierarchicalStrategyProvider';

// 原有的处理策略接口（保持兼容性）
export { IProcessingStrategy } from '../impl/base/IProcessingStrategy';