import { CodeChunk } from '../../parser/types';
import { StandardizedQueryResult } from '../../parser/normalization/types';

// 图节点类型枚举
export enum GraphNodeType {
  FILE = 'File',
  FUNCTION = 'Function',
  CLASS = 'Class',
  VARIABLE = 'Variable',
  IMPORT = 'Import',
  INTERFACE = 'Interface',
  METHOD = 'Method',
  PROPERTY = 'Property',
  CHUNK = 'Chunk',
  // HTML特定节点类型
  ELEMENT = 'Element',
  DOCUMENT = 'Document',
  SCRIPT = 'Script',
  STYLE = 'Style',
  ATTRIBUTE = 'Attribute',
  TEXT = 'Text'
}

// 图关系类型枚举
export enum GraphRelationshipType {
  CONTAINS = 'CONTAINS',
  IMPORTS = 'IMPORTS',
  CALLS = 'CALLS',
  INHERITS = 'INHERITS',
  IMPLEMENTS = 'IMPLEMENTS',
  USES = 'USES',
  DEFINES = 'DEFINES',
  // 新增关系类型
  // 数据流关系
  DATA_FLOWS_TO = 'DATA_FLOWS_TO',
  PARAMETER_PASSES_TO = 'PARAMETER_PASSES_TO',
  RETURNS_TO = 'RETURNS_TO',
  // 控制流关系
  CONTROLS = 'CONTROLS',
  HANDLES_EXCEPTION = 'HANDLES_EXCEPTION',
  CALLBACKS = 'CALLBACKS',
  AWAITS = 'AWAITS',
  // 语义关系
  OVERRIDES = 'OVERRIDES',
  OVERLOADS = 'OVERLOADS',
  DELEGATES_TO = 'DELEGATES_TO',
  OBSERVES = 'OBSERVES',
  CONFIGURES = 'CONFIGURES',
  // 生命周期关系
  INSTANTIATES = 'INSTANTIATES',
  INITIALIZES = 'INITIALIZES',
  DESTROYS = 'DESTROYS',
  MANAGES_LIFECYCLE = 'MANAGES_LIFECYCLE',
  // 并发关系
  SYNCHRONIZES_WITH = 'SYNCHRONIZES_WITH',
  LOCKS = 'LOCKS',
  COMMUNICATES_WITH = 'COMMUNICATES_WITH',
  RACES_WITH = 'RACES_WITH',
  // 注解/装饰关系
  ANNOTATES = 'ANNOTATES',
  DECORATES = 'DECORATES',
  TAGS = 'TAGS',
  // 创建关系
  CREATES = 'CREATES',
  ALLOCATES = 'ALLOCATES',
  // 依赖关系
  DEPENDS_ON = 'DEPENDS_ON',
  REFERENCES = 'REFERENCES',
  ACCESSES = 'ACCESSES',
  // 引用关系
  READS = 'READS',
  WRITES = 'WRITES',
  DECLARES = 'DECLARES',
  USES_VARIABLE = 'USES_VARIABLE'
}

// 基础图节点接口
export interface GraphNode {
  id: string;
  type: GraphNodeType;
  properties: Record<string, any>;
}

// 图文件节点
export interface GraphFileNode extends GraphNode {
  type: GraphNodeType.FILE;
  name: string;
  path: string;
  language: string;
  size: number;
  lastModified: Date;
  projectId: string;
}

// 图函数节点
export interface GraphFunctionNode extends GraphNode {
  type: GraphNodeType.FUNCTION;
  name: string;
  signature: string;
  startLine: number;
  endLine: number;
  complexity: number;
  parentFileId: string;
}

// 图类节点
export interface GraphClassNode extends GraphNode {
  type: GraphNodeType.CLASS;
  name: string;
  methods: string[];
  properties: string[];
  parentFileId: string;
}

// 图关系接口
export interface GraphRelationship {
  id: string;
  type: GraphRelationshipType;
  fromNodeId: string;
  toNodeId: string;
  properties: Record<string, any>;
}

// 文件分析结果接口
export interface FileAnalysisResult {
  filePath: string;
  language: string;
  ast: any;
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  variables: VariableInfo[];
}

// 函数信息接口
export interface FunctionInfo {
  name: string;
  signature: string;
  startLine: number;
  endLine: number;
  complexity: number;
  parameters: string[];
  returnType: string;
}

// 类信息接口
export interface ClassInfo {
  name: string;
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  superClass?: string;
  interfaces: string[];
}

// 属性信息接口
export interface PropertyInfo {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'protected';
}

// 导入信息接口
export interface ImportInfo {
  name: string;
  path: string;
  importedAs: string;
}

// 变量信息接口
export interface VariableInfo {
  name: string;
  type: string;
  scope: string;
}

// 映射结果接口
export interface GraphNodeMappingResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  stats: {
    fileNodes: number;
    functionNodes: number;
    classNodes: number;
    relationships: number;
  };
}

// 代码块映射结果接口
export interface ChunkNodeMappingResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  stats: {
    chunkNodes: number;
    relationships: number;
  };
}

// 文件元数据接口
export interface FileMetadata {
  name: string;
  path: string;
  size: number;
  language: string;
  lastModified: Date;
  projectId: string;
}

// 图映射结果
export interface GraphMappingResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// 图边接口
export interface GraphEdge {
  id: string;
  type: GraphRelationshipType;
  sourceNodeId: string;
  targetNodeId: string;
  properties: Record<string, any>;
}

export interface IGraphDataMappingService {
  /**
   * 将标准化节点列表和原始AST映射为图数据库节点和关系
   * @param filePath 文件路径
   * @param standardizedNodes 标准化节点列表
   * @param ast 原始AST
   * @returns 图映射结果
   */
  mapToGraph(
    filePath: string,
    standardizedNodes: StandardizedQueryResult[]
  ): Promise<GraphMappingResult>;

  /**
   * @deprecated 请使用新的 mapToGraph 方法
   * 将文件分析结果映射为图数据库节点
   */
  mapFileToGraphNodes(
    filePath: string,
    fileContent: string,
    analysisResult: FileAnalysisResult
  ): Promise<GraphNodeMappingResult>;

  /**
   * 将代码块映射为图数据库节点
   */
  mapChunksToGraphNodes(
    chunks: CodeChunk[],
    parentFileId: string
  ): Promise<ChunkNodeMappingResult>;

  /**
   * 创建文件节点数据
   */
  createFileNode(
    filePath: string,
    metadata: FileMetadata
  ): GraphFileNode;

  /**
   * 创建函数节点数据
   */
  createFunctionNode(
    functionInfo: FunctionInfo,
    parentFileId: string
  ): GraphFunctionNode;

  /**
   * 创建类节点数据
   */
  createClassNode(
    classInfo: ClassInfo,
    parentFileId: string
  ): GraphClassNode;

  /**
   * 创建节点间关系
   */
  createRelationships(
    nodes: GraphNode[],
    fileId: string
  ): GraphRelationship[];

  /**
   * 创建导入关系
   */
  createImportRelationships(
    imports: ImportInfo[],
    fileId: string
  ): GraphRelationship[];

  /**
   * 创建函数调用关系
   */
  createFunctionCallRelationships(
    functions: FunctionInfo[],
    fileId: string
  ): GraphRelationship[];

  /**
   * 从AST中提取代码元素
   * @deprecated 此方法已废弃，请使用标准化模块
   */
  extractCodeElementsFromAST(ast: any, filePath: string): Promise<FileAnalysisResult>;
}