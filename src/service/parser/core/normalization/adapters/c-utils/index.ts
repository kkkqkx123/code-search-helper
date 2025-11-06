/**
 * C语言工具模块统一导出
 */

export { CHelperMethods } from './HelperMethods';

// 关系提取器
export { CallRelationshipExtractor } from './CallRelationshipExtractor';
export { DataFlowRelationshipExtractor } from './DataFlowRelationshipExtractor';
export { InheritanceRelationshipExtractor } from './InheritanceRelationshipExtractor';
export { ConcurrencyRelationshipExtractor } from './ConcurrencyRelationshipExtractor';
export { LifecycleRelationshipExtractor } from './LifecycleRelationshipExtractor';
export { SemanticRelationshipExtractor } from './SemanticRelationshipExtractor';
export { ControlFlowRelationshipExtractor } from './ControlFlowRelationshipExtractor';

// 新增的关系提取器
export { AnnotationRelationshipExtractor } from './AnnotationRelationshipExtractor';
export { CreationRelationshipExtractor } from './CreationRelationshipExtractor';
export { DependencyRelationshipExtractor } from './DependencyRelationshipExtractor';
export { ReferenceRelationshipExtractor } from './ReferenceRelationshipExtractor';

// 重新导出常用常量
export {
  C_NODE_TYPE_MAPPING,
  C_QUERY_TYPE_MAPPING,
  C_SUPPORTED_QUERY_TYPES,
  C_NAME_CAPTURES,
  C_BLOCK_NODE_TYPES,
  C_FUNCTION_NODE_TYPES,
  C_MODIFIERS,
  C_COMPLEXITY_KEYWORDS
} from './constants';