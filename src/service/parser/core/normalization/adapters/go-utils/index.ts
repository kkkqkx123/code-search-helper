/**
 * Go 工具模块索引文件
 * 统一导出所有关系提取器和辅助方法
 */

export { AnnotationRelationshipExtractor } from './AnnotationRelationshipExtractor';
export { CallRelationshipExtractor } from './CallRelationshipExtractor';
export { ConcurrencyRelationshipExtractor } from './ConcurrencyRelationshipExtractor';
export { ControlFlowRelationshipExtractor } from './ControlFlowRelationshipExtractor';
export { CreationRelationshipExtractor } from './CreationRelationshipExtractor';
export { DataFlowRelationshipExtractor } from './DataFlowRelationshipExtractor';
export { DependencyRelationshipExtractor } from './DependencyRelationshipExtractor';
export { InheritanceRelationshipExtractor } from './InheritanceRelationshipExtractor';
export { LifecycleRelationshipExtractor } from './LifecycleRelationshipExtractor';
export { ReferenceRelationshipExtractor } from './ReferenceRelationshipExtractor';
export { SemanticRelationshipExtractor } from './SemanticRelationshipExtractor';
export { GoHelperMethods } from './GoHelperMethods';

// 导出常量
export * from './constants';