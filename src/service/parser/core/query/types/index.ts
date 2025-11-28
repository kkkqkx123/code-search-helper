/**
 * 实体类型定义模块导出
 */

// 基础类型定义
export {
  EntityType,
  LocationInfo,
  EntityQueryResult,
  FieldInfo,
  EnumConstant,
  ParameterInfo,
  PreprocessorEntity,
  TypeEntity,
  FunctionEntity,
  VariableEntity,
  AnnotationEntity,
  GenericEntityQueryResult,
  EntityTypeFactory,
  EntityTypeRegistry
} from './EntityTypes';

// 构建器类
export {
  EntityQueryBuilder,
  PreprocessorEntityBuilder,
  TypeEntityBuilder,
  FunctionEntityBuilder,
  VariableEntityBuilder,
  AnnotationEntityBuilder,
  EntityQueryBuilderFactory
} from './EntityQueryBuilder';

// 关系类型定义
export {
  RelationshipCategory,
  RelationshipType,
  RelationshipLocationInfo,
  RelationshipQueryResult,
  CallRelationship,
  DataFlowRelationship,
  ControlFlowRelationship,
  DependencyRelationship,
  InheritanceRelationship,
  LifecycleRelationship,
  SemanticRelationship,
  ReferenceRelationship,
  AnnotationRelationship,
  GenericRelationshipQueryResult,
  RelationshipTypeFactory,
  RelationshipTypeRegistry,
  RelationshipTypeMapping
} from './RelationshipTypes';

// 关系构建器类
export {
  RelationshipQueryBuilder,
  CallRelationshipBuilder,
  DataFlowRelationshipBuilder,
  ControlFlowRelationshipBuilder,
  DependencyRelationshipBuilder,
  InheritanceRelationshipBuilder,
  LifecycleRelationshipBuilder,
  SemanticRelationshipBuilder,
  ReferenceRelationshipBuilder,
  AnnotationRelationshipBuilder,
  RelationshipQueryBuilderFactory
} from './RelationshipQueryBuilder';

// C语言特定类型定义
export {
  CEntityType,
  CPreprocessorEntity,
  CTypeEntity,
  CFunctionEntity,
  CVariableEntity,
  CAnnotationEntity,
  CEntityQueryResult,
  C_ENTITY_TYPE_PRIORITIES,
  CEntityTypeFactory,
  getCEntityTypePriority,
  isCPreprocessorType,
  isCTypeDefinitionType,
  isCFunctionType,
  isCVariableType,
  isCAnnotationType
} from './languages/c/CEntityTypes';

// C语言特定关系类型定义
export {
  CRelationshipType,
  CCallRelationship,
  CDataFlowRelationship,
  CControlFlowRelationship,
  CDependencyRelationship,
  CInheritanceRelationship,
  CLifecycleRelationship,
  CSemanticRelationship,
  CReferenceRelationship,
  CAnnotationRelationship,
  CRelationshipQueryResult,
  CRelationshipTypeFactory
} from './languages/c/CRelationshipTypes';

// 语言特定类型定义
export * from './languages';