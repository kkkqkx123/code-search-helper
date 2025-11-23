/**
 * C++工具模块统一导出
 */

export { CppHelperMethods } from './CppHelperMethods';

// 关系提取器
export { CallRelationshipExtractor } from './CallRelationshipExtractor';
export { DataFlowRelationshipExtractor } from './DataFlowRelationshipExtractor';
export { InheritanceRelationshipExtractor } from './InheritanceRelationshipExtractor';
export { ControlFlowRelationshipExtractor } from './ControlFlowRelationshipExtractor';

// 新增的关系提取器
export { AnnotationRelationshipExtractor } from './AnnotationRelationshipExtractor';
export { CreationRelationshipExtractor } from './CreationRelationshipExtractor';
export { CppDependencyRelationshipExtractor } from './DependencyRelationshipExtractor';
export { ReferenceRelationshipExtractor } from './ReferenceRelationshipExtractor';

// 高级语义关系提取器
export { ConcurrencyRelationshipExtractor } from './ConcurrencyRelationshipExtractor';
export { LifecycleRelationshipExtractor } from './LifecycleRelationshipExtractor';
export { SemanticRelationshipExtractor } from './SemanticRelationshipExtractor';

// 查询分流器
export { QueryDispatcher } from './QueryDispatcher';

// 重新导出常用常量
export {
  CPP_NODE_TYPE_MAPPING,
  CPP_QUERY_TYPE_MAPPING,
  CPP_SUPPORTED_QUERY_TYPES,
  CPP_NAME_CAPTURES,
  CPP_BLOCK_NODE_TYPES,
  CPP_FUNCTION_NODE_TYPES,
  CPP_MODIFIERS,
  CPP_COMPLEXITY_KEYWORDS
} from './constants';

// 导出通用工具
export { BaseRelationshipExtractor, RelationshipMetadata, SymbolTable, RelationshipExtractorUtils } from '../utils';