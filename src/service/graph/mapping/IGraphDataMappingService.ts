import { CodeChunk } from '../../parser/types';

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
  CHUNK = 'Chunk'
}

// 图关系类型枚举
export enum GraphRelationshipType {
  CONTAINS = 'CONTAINS',
  IMPORTS = 'IMPORTS',
  CALLS = 'CALLS',
  INHERITS = 'INHERITS',
  IMPLEMENTS = 'IMPLEMENTS',
  USES = 'USES',
  DEFINES = 'DEFINES'
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

export interface IGraphDataMappingService {
  /**
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
   */
  extractCodeElementsFromAST(ast: any, filePath: string): Promise<FileAnalysisResult>;
}