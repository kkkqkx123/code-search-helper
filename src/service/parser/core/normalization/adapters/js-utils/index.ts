/**
 * JavaScript/TypeScript 工具模块索引文件
 * 统一导出所有关系提取器和辅助方法
 */

export { CallRelationshipExtractor } from '../cpp-utils/CallRelationshipExtractor';
export { DataFlowRelationshipExtractor } from '../cpp-utils/DataFlowRelationshipExtractor';
export { InheritanceRelationshipExtractor } from '../cpp-utils/InheritanceRelationshipExtractor';
export { ConcurrencyRelationshipExtractor } from '../cpp-utils/ConcurrencyRelationshipExtractor';
export { LifecycleRelationshipExtractor } from '../cpp-utils/LifecycleRelationshipExtractor';
export { SemanticRelationshipExtractor } from '../cpp-utils/SemanticRelationshipExtractor';
export { ControlFlowRelationshipExtractor } from '../cpp-utils/ControlFlowRelationshipExtractor';

// JavaScript/TypeScript 特有的关系提取器
export { JsAnnotationRelationshipExtractor } from './AnnotationRelationshipExtractor';
export { JsCreationRelationshipExtractor } from './CreationRelationshipExtractor';
export { JsDependencyRelationshipExtractor } from './DependencyRelationshipExtractor';
export { JsReferenceRelationshipExtractor } from './ReferenceRelationshipExtractor';

export { JsHelperMethods } from './JsHelperMethods';

// 导出常量
export * from './constants';