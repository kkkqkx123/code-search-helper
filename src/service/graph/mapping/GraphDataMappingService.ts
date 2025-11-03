import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import {
  IGraphDataMappingService,
  GraphNodeType,
  GraphRelationshipType,
  GraphNode,
  GraphFileNode,
  GraphFunctionNode,
  GraphClassNode,
  GraphRelationship,
  FileAnalysisResult,
  FunctionInfo,
  ClassInfo,
  ImportInfo,
  VariableInfo,
  GraphNodeMappingResult,
  ChunkNodeMappingResult,
  FileMetadata,
  PropertyInfo,
  GraphMappingResult,
  GraphEdge
} from './IGraphDataMappingService';
import { CodeChunk } from '../../parser/types';
import { v4 as uuidv4 } from 'uuid';
import { DataMappingValidator } from './DataMappingValidator';
import { GraphMappingCache } from '../caching/GraphMappingCache';
import { GraphBatchOptimizer } from '../utils/GraphBatchOptimizer';
import { FaultToleranceHandler } from '../../../utils/FaultToleranceHandler';
import { QueryResult, QueryMatch } from '../../parser/core/query/TreeSitterQueryEngine';

@injectable()
export class GraphDataMappingService implements IGraphDataMappingService {
  private logger: LoggerService;
  private validator: DataMappingValidator;
  private cache: GraphMappingCache; // 保持旧的缓存引用以确保向后兼容
  private unifiedCache: any; // 新的统一缓存服务
  private batchOptimizer: GraphBatchOptimizer;
  private faultToleranceHandler: FaultToleranceHandler;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.DataMappingValidator) validator: DataMappingValidator,
    @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
    @inject(TYPES.GraphCacheService) unifiedCache: any,
    @inject(TYPES.GraphBatchOptimizer) batchOptimizer: GraphBatchOptimizer,
    @inject(TYPES.FaultToleranceHandler) faultToleranceHandler: FaultToleranceHandler
  ) {
    this.logger = logger;
    this.validator = validator;
    this.cache = cache;
    this.unifiedCache = unifiedCache;
    this.batchOptimizer = batchOptimizer;
    this.faultToleranceHandler = faultToleranceHandler;

    this.logger.info('GraphDataMappingService initialized with fault tolerance');
  }

  private inferLanguageFromFile(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sql': 'sql',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'txt': 'text'
    };
    return languageMap[extension] || 'unknown';
  }

  async mapFileToGraphNodes(
    filePath: string,
    fileContent: string,
    analysisResult: FileAnalysisResult
  ): Promise<GraphNodeMappingResult> {
    const result = await this.faultToleranceHandler.executeWithFaultTolerance(
      async () => {
        // 从文件扩展名推断语言
        const language = this.inferLanguageFromFile(filePath);
        // 尝试从新缓存服务获取结果
        const cacheKey = `mapping_${filePath}_${language}`;
        const cachedResult = await this.unifiedCache.getGraphData(cacheKey);

        if (cachedResult) {
          this.logger.debug('Returning cached mapping result', { filePath });
          return {
            nodes: cachedResult.nodes,
            relationships: cachedResult.relationships,
            stats: {
              fileNodes: 1,
              functionNodes: 0,
              classNodes: 0,
              relationships: 0
            }
          };
        }

        // 如果新缓存中没有，则使用旧缓存
        const oldCachedResult = await this.cache.getMappingResult(cacheKey);
        if (oldCachedResult) {
          this.logger.debug('Returning cached mapping result from old cache', { filePath });
          return {
            nodes: oldCachedResult.nodes,
            relationships: oldCachedResult.relationships,
            stats: {
              fileNodes: 1,
              functionNodes: 0,
              classNodes: 0,
              relationships: 0
            }
          };
        }

        // 执行实际的映射逻辑
        const mappingResult = await this.performMapping(filePath, fileContent, language, analysisResult);

        // 缓存结果到新缓存服务
        await this.unifiedCache.setGraphData(cacheKey, {
          nodes: mappingResult.nodes,
          relationships: mappingResult.relationships
        });

        return mappingResult;
      },
      'mapFileToGraphNodes',
      { cacheKey: `mapping_${filePath}`, analysisResult }
    );

    if (result.success) {
      return result.data!;
    } else {
      throw result.error || new Error('Failed to map file to graph nodes');
    }
  }

  private async performMapping(
    filePath: string,
    fileContent: string,
    language: string,
    analysisResult: FileAnalysisResult
  ): Promise<GraphNodeMappingResult> {
    // 实际的映射逻辑保持不变
    const nodes: GraphNode[] = [];
    const relationships: GraphRelationship[] = [];

    // 创建文件节点
    const fileNode: GraphFileNode = {
      id: uuidv4(),
      type: GraphNodeType.FILE,
      name: filePath,
      path: filePath,
      language: language,
      size: fileContent.length,
      lastModified: new Date(),
      projectId: 'default',
      properties: {}
    };

    nodes.push(fileNode);

    // 处理函数
    if (analysisResult.functions) {
      for (const func of analysisResult.functions) {
        const functionNode: GraphFunctionNode = {
          id: uuidv4(),
          type: GraphNodeType.FUNCTION,
          name: func.name,
          signature: func.signature,
          startLine: func.startLine,
          endLine: func.endLine,
          complexity: func.complexity,
          parentFileId: fileNode.id,
          properties: {}
        };

        nodes.push(functionNode);

        // 创建文件到函数的关系
        const fileToFunctionRel: GraphRelationship = {
          id: uuidv4(),
          type: GraphRelationshipType.CONTAINS,
          fromNodeId: fileNode.id,
          toNodeId: functionNode.id,
          properties: {}
        };

        relationships.push(fileToFunctionRel);
      }
    }

    // 处理类
    if (analysisResult.classes) {
      for (const cls of analysisResult.classes) {
        const classNode: GraphClassNode = {
          id: uuidv4(),
          type: GraphNodeType.CLASS,
          name: cls.name,
          methods: cls.methods.map(m => m.name),
          properties: cls.properties.map(p => p.name),
          parentFileId: fileNode.id
        };

        nodes.push(classNode);

        // 创建文件到类的关系
        const fileToClassRel: GraphRelationship = {
          id: uuidv4(),
          type: GraphRelationshipType.CONTAINS,
          fromNodeId: fileNode.id,
          toNodeId: classNode.id,
          properties: {}
        };

        relationships.push(fileToClassRel);
      }
    }

    return {
      nodes,
      relationships,
      stats: {
        fileNodes: 1,
        functionNodes: analysisResult.functions?.length || 0,
        classNodes: analysisResult.classes?.length || 0,
        relationships: relationships.length
      }
    };
  }

  async mapChunkToGraphNodes(
    chunk: CodeChunk,
    filePath: string,
    language: string
  ): Promise<ChunkNodeMappingResult> {
    const result = await this.faultToleranceHandler.executeWithFaultTolerance(
      async () => {
        // 尝试从新缓存服务获取结果
        const cacheKey = `chunk_mapping_${chunk.id}_${filePath}`;
        const cachedResult = await this.unifiedCache.getGraphData(cacheKey);

        if (cachedResult) {
          this.logger.debug('Returning cached chunk mapping result', { chunkId: chunk.id });
          return {
            nodes: cachedResult.nodes,
            relationships: cachedResult.relationships,
            stats: {
              chunkNodes: cachedResult.nodes.length,
              relationships: cachedResult.relationships.length,
            }
          };
        }

        // 如果新缓存中没有，则使用旧缓存
        const oldCachedResult = await this.cache.getFileAnalysis(cacheKey);
        if (oldCachedResult) {
          this.logger.debug('Returning cached chunk mapping result from old cache', { chunkId: chunk.id });
          return oldCachedResult as ChunkNodeMappingResult;
        }

        // 执行实际的映射逻辑
        const chunkResult = await this.performChunkMapping(chunk, filePath, language);

        // 缓存结果到新缓存服务
        await this.unifiedCache.setGraphData(cacheKey, chunkResult);

        return chunkResult;
      },
      'mapChunkToGraphNodes',
      { parentFileId: filePath }
    );

    if (result.success) {
      return result.data!;
    } else {
      throw result.error || new Error('Failed to map chunk to graph nodes');
    }
  }

  private async performChunkMapping(
    chunk: CodeChunk,
    filePath: string,
    language: string
  ): Promise<ChunkNodeMappingResult> {
    // 实际的块映射逻辑保持不变
    const nodes: GraphNode[] = [];
    const relationships: GraphRelationship[] = [];

    // 创建块节点
    const chunkNode: GraphNode = {
      id: chunk.id || uuidv4(),
      type: GraphNodeType.CHUNK,
      properties: {
        name: `Chunk_${chunk.id || uuidv4()}`,
        filePath: filePath,
        language: language,
        content: chunk.content,
        startPosition: chunk.metadata?.startLine,
        endPosition: chunk.metadata?.endLine
      }
    };

    nodes.push(chunkNode);

    return {
      nodes,
      relationships,
      stats: {
        chunkNodes: 1,
        relationships: 0
      }
    };
  }

  async clearCache(): Promise<void> {
    const result = await this.faultToleranceHandler.executeWithFaultTolerance(
      async () => {
        // 清除新缓存服务
        await this.unifiedCache.clearGraphCache();

        // 清除旧缓存服务
        await this.cache.clear();

        this.logger.info('Cleared graph mapping cache');
      },
      'clearCache',
      {}
    );

    if (!result.success) {
      throw result.error || new Error('Failed to clear cache');
    }
  }

  async getCacheStats() {
    return this.faultToleranceHandler.executeWithFaultTolerance(
      async () => {
        // 获取新缓存服务统计
        const newStats = await this.unifiedCache.getGraphCacheStats();

        // 获取旧缓存服务统计
        const oldStats = await this.cache.getStats();

        return {
          newCache: newStats,
          oldCache: oldStats
        };
      },
      'getCacheStats',
      {}
    );
  }

  async mapChunksToGraphNodes(
    chunks: CodeChunk[],
    parentFileId: string
  ): Promise<ChunkNodeMappingResult> {
    const result = await this.faultToleranceHandler.executeWithFaultTolerance(
      async () => {
        // 简单实现，实际项目中可能需要更复杂的逻辑
        const nodes: GraphNode[] = [];
        const relationships: GraphRelationship[] = [];

        return {
          nodes,
          relationships,
          stats: {
            chunkNodes: chunks.length,
            relationships: 0
          }
        };
      },
      'mapChunksToGraphNodes',
      { parentFileId }
    );

    if (result.success) {
      return result.data!;
    } else {
      throw result.error || new Error('Failed to map chunks to graph nodes');
    }
  }

  createFileNode(
    filePath: string,
    metadata: FileMetadata
  ): GraphFileNode {
    return {
      id: uuidv4(),
      type: GraphNodeType.FILE,
      name: metadata.name,
      path: metadata.path,
      language: metadata.language,
      size: metadata.size,
      lastModified: metadata.lastModified,
      projectId: metadata.projectId,
      properties: {}
    };
  }

  createFunctionNode(
    functionInfo: FunctionInfo,
    parentFileId: string
  ): GraphFunctionNode {
    return {
      id: uuidv4(),
      type: GraphNodeType.FUNCTION,
      name: functionInfo.name,
      signature: functionInfo.signature,
      startLine: functionInfo.startLine,
      endLine: functionInfo.endLine,
      complexity: functionInfo.complexity,
      parentFileId: parentFileId,
      properties: {}
    };
  }

  createClassNode(
    classInfo: ClassInfo,
    parentFileId: string
  ): GraphClassNode {
    return {
      id: uuidv4(),
      type: GraphNodeType.CLASS,
      name: classInfo.name,
      methods: classInfo.methods.map(m => m.name),
      properties: classInfo.properties.map(p => p.name),
      parentFileId: parentFileId
    };
  }

  createRelationships(
    nodes: GraphNode[],
    fileId: string
  ): GraphRelationship[] {
    // 简单实现，实际项目中可能需要更复杂的逻辑
    return [];
  }

  createImportRelationships(
    imports: ImportInfo[],
    fileId: string
  ): GraphRelationship[] {
    // 简单实现，实际项目中可能需要更复杂的逻辑
    return [];
  }

  createFunctionCallRelationships(
    functions: FunctionInfo[],
    fileId: string
  ): GraphRelationship[] {
    // 简单实现，实际项目中可能需要更复杂的逻辑
    return [];
  }

  async extractCodeElementsFromAST(ast: any, filePath: string): Promise<FileAnalysisResult> {
    // 简单实现，实际项目中可能需要更复杂的逻辑
    return {
      filePath,
      language: this.inferLanguageFromFile(filePath),
      ast,
      functions: [],
      classes: [],
      imports: [],
      variables: []
    };
  }

  /**
   * 将查询结果映射为图元素
   */
  mapQueryResultsToGraph(queryResults: Map<string, QueryResult>): GraphMappingResult {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // 处理类和接口
    const classResults = queryResults.get('graph-classes');
    if (classResults) {
      for (const match of classResults.matches) {
        this.processClassOrInterface(match, nodes, edges);
      }
    }

    // 处理函数和方法
    const functionResults = queryResults.get('graph-functions');
    if (functionResults) {
      for (const match of functionResults.matches) {
        this.processFunctionOrMethod(match, nodes, edges);
      }
    }

    // 处理函数调用
    const callResults = queryResults.get('graph-calls');
    if (callResults) {
      for (const match of callResults.matches) {
        this.processCall(match, nodes, edges);
      }
    }

    // 处理导入和导出
    const importResults = queryResults.get('graph-imports');
    if (importResults) {
      for (const match of importResults.matches) {
        this.processImport(match, nodes, edges);
      }
    }

    const exportResults = queryResults.get('graph-exports');
    if (exportResults) {
      for (const match of exportResults.matches) {
        this.processExport(match, nodes, edges);
      }
    }

    return { nodes, edges };
  }

  /**
   * 处理类或接口
   */
  private processClassOrInterface(match: QueryMatch, nodes: GraphNode[], edges: GraphEdge[]): void {
    const captures = match.captures;
    const location = match.location;

    // 获取文件路径
    const filePath = captures['class.file_path']?.text || captures['interface.file_path']?.text || 'unknown';

    // 处理类定义
    if (captures['class.name']) {
      const className = captures['class.name'].text;
      const nodeId = `class_${Buffer.from(`${filePath}_${className}_${location.startLine}`).toString('hex')}`;

      const classNode: GraphNode = {
        id: nodeId,
        type: GraphNodeType.CLASS,
        properties: {
          name: className,
          file_path: filePath,
          start_line: location.startLine,
          end_line: location.endLine,
          method_count: 0, // 需要通过其他查询计算
          property_count: 0 // 需要通过其他查询计算
        }
      };

      nodes.push(classNode);

      // 创建文件包含类的关系
      const fileNodeId = `file_${Buffer.from(filePath).toString('hex')}`;
      const containsEdge: GraphEdge = {
        id: uuidv4(),
        type: GraphRelationshipType.CONTAINS,
        sourceNodeId: fileNodeId,
        targetNodeId: nodeId,
        properties: {
          line_number: location.startLine
        }
      };

      edges.push(containsEdge);
    }

    // 处理接口定义
    if (captures['interface.name']) {
      const interfaceName = captures['interface.name'].text;
      const nodeId = `interface_${Buffer.from(`${filePath}_${interfaceName}_${location.startLine}`).toString('hex')}`;

      const interfaceNode: GraphNode = {
        id: nodeId,
        type: GraphNodeType.INTERFACE,
        properties: {
          name: interfaceName,
          file_path: filePath,
          start_line: location.startLine,
          end_line: location.endLine
        }
      };

      nodes.push(interfaceNode);

      // 创建文件包含接口的关系
      const fileNodeId = `file_${Buffer.from(filePath).toString('hex')}`;
      const containsEdge: GraphEdge = {
        id: uuidv4(),
        type: GraphRelationshipType.CONTAINS,
        sourceNodeId: fileNodeId,
        targetNodeId: nodeId,
        properties: {
          line_number: location.startLine
        }
      };

      edges.push(containsEdge);
    }

    // 处理继承关系
    if (captures['class.inherits']) {
      const superClassName = captures['class.inherits'].text;
      const currentClassName = captures['class.name']?.text;
      if (currentClassName) {
        const superClassNodeId = `class_${Buffer.from(`${filePath}_${superClassName}`).toString('hex')}`;
        const currentClassNodeId = `class_${Buffer.from(`${filePath}_${currentClassName}_${location.startLine}`).toString('hex')}`;

        const inheritsEdge: GraphEdge = {
          id: uuidv4(),
          type: GraphRelationshipType.INHERITS,
          sourceNodeId: currentClassNodeId,
          targetNodeId: superClassNodeId,
          properties: {
            line_number: location.startLine
          }
        };

        edges.push(inheritsEdge);
      }
    }

    // 处理实现关系
    if (captures['class.implements']) {
      const interfaceName = captures['class.implements'].text;
      const className = captures['class.name']?.text;
      if (className) {
        const interfaceNodeId = `interface_${Buffer.from(`${filePath}_${interfaceName}`).toString('hex')}`;
        const classNodeId = `class_${Buffer.from(`${filePath}_${className}_${location.startLine}`).toString('hex')}`;

        const implementsEdge: GraphEdge = {
          id: uuidv4(),
          type: GraphRelationshipType.IMPLEMENTS,
          sourceNodeId: classNodeId,
          targetNodeId: interfaceNodeId,
          properties: {
            line_number: location.startLine
          }
        };

        edges.push(implementsEdge);
      }
    }
  }

  /**
   * 处理函数或方法
   */
  private processFunctionOrMethod(match: QueryMatch, nodes: GraphNode[], edges: GraphEdge[]): void {
    const captures = match.captures;
    const location = match.location;

    // 获取文件路径
    const filePath = captures['function.file_path']?.text || captures['method.file_path']?.text || 'unknown';

    // 处理函数定义
    if (captures['function.name']) {
      const functionName = captures['function.name'].text;
      const nodeId = `function_${Buffer.from(`${filePath}_${functionName}_${location.startLine}`).toString('hex')}`;

      const functionNode: GraphNode = {
        id: nodeId,
        type: GraphNodeType.FUNCTION,
        properties: {
          name: functionName,
          file_path: filePath,
          start_line: location.startLine,
          end_line: location.endLine,
          signature: captures['function.signature']?.text || '',
          cyclomatic_complexity: this.calculateCyclomaticComplexity(match.node), // 简化计算
          is_method: false
        }
      };

      nodes.push(functionNode);

      // 创建文件包含函数的关系
      const fileNodeId = `file_${Buffer.from(filePath).toString('hex')}`;
      const containsEdge: GraphEdge = {
        id: uuidv4(),
        type: GraphRelationshipType.CONTAINS,
        sourceNodeId: fileNodeId,
        targetNodeId: nodeId,
        properties: {
          line_number: location.startLine
        }
      };

      edges.push(containsEdge);
    }

    // 处理方法定义
    if (captures['method.name']) {
      const methodName = captures['method.name'].text;
      const nodeId = `method_${Buffer.from(`${filePath}_${methodName}_${location.startLine}`).toString('hex')}`;

      const methodNode: GraphNode = {
        id: nodeId,
        type: GraphNodeType.METHOD,
        properties: {
          name: methodName,
          file_path: filePath,
          start_line: location.startLine,
          end_line: location.endLine,
          signature: captures['method.signature']?.text || '',
          cyclomatic_complexity: this.calculateCyclomaticComplexity(match.node), // 简化计算
          is_method: true
        }
      };

      nodes.push(methodNode);

      // 创建文件包含方法的关系
      const fileNodeId = `file_${Buffer.from(filePath).toString('hex')}`;
      const containsEdge: GraphEdge = {
        id: uuidv4(),
        type: GraphRelationshipType.CONTAINS,
        sourceNodeId: fileNodeId,
        targetNodeId: nodeId,
        properties: {
          line_number: location.startLine
        }
      };

      edges.push(containsEdge);
    }
  }

  /**
   * 处理函数调用
   */
  private processCall(match: QueryMatch, nodes: GraphNode[], edges: GraphEdge[]): void {
    const captures = match.captures;
    const location = match.location;

    // 获取文件路径
    const filePath = captures['call.file_path']?.text || 'unknown';

    if (captures['call.name']) {
      const callName = captures['call.name'].text;
      const nodeId = `call_${Buffer.from(`${filePath}_${callName}_${location.startLine}_${location.startColumn}`).toString('hex')}`;

      // 查找目标函数节点
      const targetFunctionNodeId = `function_${Buffer.from(`${filePath}_${callName}`).toString('hex')}`;

      // 创建调用关系
      const callEdge: GraphEdge = {
        id: uuidv4(),
        type: GraphRelationshipType.CALLS,
        sourceNodeId: nodeId, // 或者是包含该调用的函数节点ID
        targetNodeId: targetFunctionNodeId,
        properties: {
          line_number: location.startLine,
          column_number: location.startColumn
        }
      };

      edges.push(callEdge);
    }
  }

  /**
   * 处理导入
   */
  private processImport(match: QueryMatch, nodes: GraphNode[], edges: GraphEdge[]): void {
    const captures = match.captures;
    const location = match.location;

    // 获取文件路径
    const filePath = captures['import.file_path']?.text || 'unknown';

    if (captures['import.source']) {
      const importSource = captures['import.source'].text;
      const nodeId = `import_${Buffer.from(`${filePath}_${importSource}_${location.startLine}`).toString('hex')}`;

      const importNode: GraphNode = {
        id: nodeId,
        type: GraphNodeType.IMPORT,
        properties: {
          source: importSource,
          specifiers: captures['import.specifiers']?.text || '',
          file_path: filePath
        }
      };

      nodes.push(importNode);

      // 创建导入关系（导入文件 -> 被导入文件）
      // 这里需要解析导入源路径，可能需要更复杂的路径解析逻辑
      const importedFilePath = this.resolveImportPath(importSource, filePath);
      const importedFileNodeId = `file_${Buffer.from(importedFilePath).toString('hex')}`;
      const sourceFileNodeId = `file_${Buffer.from(filePath).toString('hex')}`;

      const importEdge: GraphEdge = {
        id: uuidv4(),
        type: GraphRelationshipType.IMPORTS,
        sourceNodeId: sourceFileNodeId,
        targetNodeId: importedFileNodeId,
        properties: {
          line_number: location.startLine
        }
      };

      edges.push(importEdge);
    }
  }

  /**
   * 处理导出
   */
  private processExport(match: QueryMatch, nodes: GraphNode[], edges: GraphEdge[]): void {
    const captures = match.captures;
    const location = match.location;

    // 获取文件路径
    const filePath = captures['export.file_path']?.text || 'unknown';

    if (captures['export.name']) {
      const exportName = captures['export.name'].text;
      const nodeId = `export_${Buffer.from(`${filePath}_${exportName}_${location.startLine}`).toString('hex')}`;

      const exportNode: GraphNode = {
        id: nodeId,
        type: GraphNodeType.VARIABLE, // 使用VARIABLE类型表示导出的标识符
        properties: {
          name: exportName,
          file_path: filePath
        }
      };

      nodes.push(exportNode);
    }
  }

  /**
   * 计算圈复杂度（简化实现）
   */
  private calculateCyclomaticComplexity(node: any): number {
    // 简化实现：根据节点中的控制流语句数量来估算复杂度
    // 在实际实现中，需要分析节点的子节点来计算复杂度
    return 1; // 默认返回1
  }

  /**
   * 解析导入路径
   */
  private resolveImportPath(importSource: string, currentFilePath: string): string {
    // 简化实现：处理相对路径和绝对路径
    if (importSource.startsWith('./') || importSource.startsWith('../')) {
      // 处理相对路径
      const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
      return currentDir + '/' + importSource;
    } else if (importSource.startsWith('/')) {
      // 处理绝对路径
      return importSource;
    } else {
      // 处理模块导入
      return importSource;
    }
  }
}