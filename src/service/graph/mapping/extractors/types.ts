// 统一的类型导入文件，避免重复导入，供所有语言提取器使用

// 关系类型接口
export {
  ILanguageRelationshipExtractor,
  CallRelationship,
  InheritanceRelationship,
  DependencyRelationship,
  ReferenceRelationship,
  CreationRelationship,
  AnnotationRelationship,
  DataFlowRelationship,
  ControlFlowRelationship,
  SemanticRelationship,
  LifecycleRelationship,
  ConcurrencyRelationship
} from '../interfaces/IRelationshipExtractor';

// 符号解析相关
export {
  SymbolResolver,
  Symbol,
  SymbolType
} from '../../symbol/SymbolResolver';

// 基础类 - 这里需要为每个语言创建特定的基础类
// 例如：BaseCRelationshipExtractor, BaseJavaRelationshipExtractor等
// 这些应该在各自的文件夹中定义
export { BaseCRelationshipExtractor } from './CRelationshipExtractor/BaseCRelationshipExtractor';
export { BaseRustRelationshipExtractor } from './RustRelationshipExtractor/BaseRustRelationshipExtractor';
export { BaseJavaScriptRelationshipExtractor } from './JavaScriptRelationshipExtractor/BaseJavaScriptRelationshipExtractor';

// 外部依赖
export { TreeSitterService } from '../../../parser/core/parse/TreeSitterService';
export { LoggerService } from '../../../../utils/LoggerService';
export { TYPES } from '../../../../types';
export { LANGUAGE_NODE_MAPPINGS } from '../LanguageNodeTypes';

// Tree-sitter
import Parser = require('tree-sitter');
export { Parser };

// 依赖注入
export { inject, injectable } from 'inversify';