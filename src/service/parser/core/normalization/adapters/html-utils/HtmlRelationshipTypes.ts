/**
 * HTML关系类型定义
 * 用于HTML文档中的关系提取和图索引
 */

/**
 * 基础关系接口
 */
export interface BaseHtmlRelationship {
  /** 关系类型 */
  type: string;
  /** 源节点ID */
  source: string;
  /** 目标节点ID */
  target: string;
  /** 关系元数据 */
  metadata: Record<string, any>;
}

/**
 * 结构关系
 * 表示HTML元素之间的结构关系
 */
export interface StructuralRelationship extends BaseHtmlRelationship {
  type: 'parent-child' | 'sibling' | 'ancestor';
  /** 源标签名 */
  sourceTag: string;
  /** 目标标签名 */
  targetTag: string;
  /** 嵌套深度 */
  depth?: number;
}

/**
 * 依赖关系
 * 表示资源依赖关系
 */
export interface DependencyRelationship extends BaseHtmlRelationship {
  type: 'resource-dependency' | 'script-dependency' | 'style-dependency';
  /** 依赖类型 */
  dependencyType: 'src' | 'href' | 'data-src' | 'import' | 'link';
  /** 资源类型 */
  resourceType: 'script' | 'stylesheet' | 'image' | 'video' | 'audio' | 'document' | 'font' | 'other';
  /** 资源URL */
  resourceUrl: string;
  /** 是否为外部资源 */
  isExternal: boolean;
}

/**
 * 引用关系
 * 表示元素间的引用关系
 */
export interface ReferenceRelationship extends BaseHtmlRelationship {
  type: 'id-reference' | 'class-reference' | 'name-reference' | 'for-reference';
  /** 引用类型 */
  referenceType: 'id' | 'class' | 'name' | 'for' | 'data-*' | 'aria-*';
  /** 引用值 */
  referenceValue: string;
  /** 引用属性 */
  referenceAttribute: string;
}

/**
 * 语义关系
 * 表示元素间的语义关系
 */
export interface SemanticRelationship extends BaseHtmlRelationship {
  type: 'form-relationship' | 'table-relationship' | 'navigation-relationship' | 'list-relationship';
  /** 语义类型 */
  semanticType: string;
  /** 关系描述 */
  description: string;
}

/**
 * HTML关系联合类型
 */
export type HtmlRelationship = 
  | StructuralRelationship
  | DependencyRelationship
  | ReferenceRelationship
  | SemanticRelationship;

/**
 * 关系提取器接口
 */
export interface IRelationshipExtractor {
  /**
   * 提取关系
   * @param ast AST根节点
   * @returns 关系数组
   */
  extractRelationships(ast: any): HtmlRelationship[];
}

/**
 * 关系提取选项
 */
export interface RelationshipExtractionOptions {
  /** 是否提取结构关系 */
  extractStructural: boolean;
  /** 是否提取依赖关系 */
  extractDependencies: boolean;
  /** 是否提取引用关系 */
  extractReferences: boolean;
  /** 是否提取语义关系 */
  extractSemantic: boolean;
  /** 最大递归深度 */
  maxDepth: number;
  /** 是否包含外部资源 */
  includeExternal: boolean;
}

/**
 * 默认关系提取选项
 */
export const DEFAULT_RELATIONSHIP_OPTIONS: RelationshipExtractionOptions = {
  extractStructural: true,
  extractDependencies: true,
  extractReferences: true,
  extractSemantic: true,
  maxDepth: 50,
  includeExternal: true
};

/**
 * 关系提取结果
 */
export interface RelationshipExtractionResult {
  /** 提取的关系 */
  relationships: HtmlRelationship[];
  /** 提取统计 */
  stats: {
    structural: number;
    dependencies: number;
    references: number;
    semantic: number;
    total: number;
  };
  /** 提取耗时（毫秒） */
  extractionTime: number;
}