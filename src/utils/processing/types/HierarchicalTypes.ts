/**
 * 分层结构相关的类型定义
 */

/**
 * 结构类型枚举
 */
export enum StructureType {
  UNKNOWN = 'unknown',
  FUNCTION = 'function',
  METHOD = 'method',
  CLASS = 'class',
  INTERFACE = 'interface',
  STRUCT = 'struct',
  ENUM = 'enum',
  VARIABLE = 'variable',
  IMPORT = 'import',
  EXPORT = 'export',
  TYPE = 'type',
  TRAIT = 'trait',
  IMPLEMENTATION = 'implementation',
  CONTROL_FLOW = 'control-flow',
  EXPRESSION = 'expression',
  RETURN = 'return',
  IF = 'if',
  FOR = 'for',
  WHILE = 'while',
  SWITCH = 'switch',
  CASE = 'case',
  TRY = 'try',
  CATCH = 'catch',
  DOCUMENT = 'document',
  KEY_VALUE = 'key-value',
  BLOCK = 'block',
  ARRAY = 'array',
  TABLE = 'table',
  SECTION = 'section',
  KEY = 'key',
  VALUE = 'value',
  DEPENDENCY = 'dependency',
  TYPE_DEFINITION = 'type-definition',
  CALL = 'call',
  DATA_FLOW = 'data-flow',
  PARAMETER_FLOW = 'parameter-flow',
  UNION = 'union',
  ANNOTATION = 'annotation',
  CONFIG_ITEM = 'config-item',
  NESTED_CLASS = 'nested-class',
  NESTED_FUNCTION = 'nested-function'
}

/**
 * 位置信息
 */
export interface LineLocation {
  startLine: number;
  endLine: number;
}

/**
 * 嵌套信息
 */
export interface NestingInfo {
  level: number;
  parentType: string;
  parentName: string;
  path: string[];
}

/**
 * 元数据信息
 */
export interface StructureMetadata {
  language: string;
  confidence: number;
  importance?: 'low' | 'medium' | 'high';
  [key: string]: any;
}

/**
 * 分层结构
 * 表示代码的分层结构信息
 */
export interface HierarchicalStructure {
  type: StructureType;
  name: string;
  content: string;
  location: LineLocation;
  nestingInfo?: NestingInfo;
  metadata: StructureMetadata;
}

/**
 * 转换配置
 */
export interface ConversionConfig {
  includeMetadata?: boolean;
  filterByType?: StructureType[];
  minConfidence?: number;
  maxDepth?: number;
}

/**
 * 分析结果
 */
export interface AnalysisResult {
  structures: HierarchicalStructure[];
  statistics: {
    total: number;
    byType: Record<StructureType, number>;
    byLanguage: Record<string, number>;
    averageConfidence: number;
  };
  errors: string[];
}

/**
 * 查询选项
 */
export interface QueryOptions {
  type?: StructureType;
  name?: string;
  language?: string;
  minConfidence?: number;
  maxResults?: number;
}

/**
 * 过滤选项
 */
export interface FilterOptions {
  types?: StructureType[];
  languages?: string[];
  confidenceRange?: [number, number];
  locationRange?: {
    startLine: number;
    endLine: number;
  };
  nestingLevel?: number;
}

/**
 * 排序选项
 */
export interface SortOptions {
  by: 'name' | 'location' | 'confidence' | 'type';
  order: 'asc' | 'desc';
}

/**
 * 分页选项
 */
export interface PaginationOptions {
  page: number;
  pageSize: number;
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}