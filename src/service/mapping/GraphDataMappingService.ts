import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { IGraphDataMappingService,
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
         PropertyInfo } from './IGraphDataMappingService';
import { CodeChunk } from '../parser/splitting/Splitter';
import { v4 as uuidv4 } from 'uuid';
import { DataMappingValidator } from '../validation/DataMappingValidator';
import { GraphMappingCache } from '../caching/GraphMappingCache';
import { GraphBatchOptimizer } from '../batching/GraphBatchOptimizer';

@injectable()
export class GraphDataMappingService implements IGraphDataMappingService {
  private logger: LoggerService;
  private validator: DataMappingValidator;
  private cache: GraphMappingCache;
  private batchOptimizer: GraphBatchOptimizer;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.DataMappingValidator) validator: DataMappingValidator,
    @inject(TYPES.GraphMappingCache) cache: GraphMappingCache,
    @inject(TYPES.GraphBatchOptimizer) batchOptimizer: GraphBatchOptimizer
  ) {
    this.logger = logger;
    this.validator = validator;
    this.cache = cache;
    this.batchOptimizer = batchOptimizer;
  }

  async mapFileToGraphNodes(
    filePath: string,
    fileContent: string,
    analysisResult: FileAnalysisResult
  ): Promise<GraphNodeMappingResult> {
    this.logger.debug('Mapping file to graph nodes', { filePath });

    // 检查缓存
    const cacheKey = `file_mapping_${filePath}_${analysisResult.filePath}`;
    const cachedResult = await this.cache.getMappingResult(cacheKey);
    if (cachedResult) {
      this.logger.debug('Using cached mapping result', { filePath });
      return {
        nodes: cachedResult.nodes,
        relationships: cachedResult.relationships,
        stats: {
          fileNodes: cachedResult.nodes.filter(n => n.type === GraphNodeType.FILE).length,
          functionNodes: cachedResult.nodes.filter(n => n.type === GraphNodeType.FUNCTION).length,
          classNodes: cachedResult.nodes.filter(n => n.type === GraphNodeType.CLASS).length,
          relationships: cachedResult.relationships.length
        }
      };
    }

    const nodes: GraphNode[] = [];
    const relationships: GraphRelationship[] = [];

    // 创建文件节点
    const fileNode = this.createFileNode(filePath, {
      name: analysisResult.filePath.split('/').pop() || analysisResult.filePath.split('\\').pop() || '',
      path: analysisResult.filePath,
      size: fileContent.length,
      language: analysisResult.language,
      lastModified: new Date(),
      projectId: 'default-project' // 在实际实现中，这里应该是实际的项目ID
    });

    nodes.push(fileNode);

    // 批量创建函数节点
    if (analysisResult.functions.length > 0) {
      const functionNodes = await this.batchOptimizer.executeWithOptimalBatching(
        analysisResult.functions,
        async (funcBatch) => {
          const batchNodes = funcBatch.map(func => this.createFunctionNode(func, fileNode.id));
          nodes.push(...batchNodes);

          // 创建文件包含函数的关系
          const batchRelationships = funcBatch.map(func => {
            const funcNode = batchNodes.find(n =>
              n.properties.name === func.name && n.properties.startLine === func.startLine
            );
            return funcNode ? {
              id: `rel_${uuidv4()}`,
              type: GraphRelationshipType.CONTAINS,
              fromNodeId: fileNode.id,
              toNodeId: funcNode.id,
              properties: {
                created: new Date().toISOString()
              }
            } : null;
          }).filter(Boolean) as GraphRelationship[];

          relationships.push(...batchRelationships);
          return batchNodes;
        }
      );
    }

    // 批量创建类节点
    if (analysisResult.classes.length > 0) {
      const classNodes = await this.batchOptimizer.executeWithOptimalBatching(
        analysisResult.classes,
        async (clsBatch) => {
          const batchNodes = clsBatch.map(cls => this.createClassNode(cls, fileNode.id));
          nodes.push(...batchNodes);

          // 创建文件包含类的关系和类包含方法的关系
          for (const cls of clsBatch) {
            const classNode = batchNodes.find(n => n.properties.name === cls.name);
            if (classNode) {
              relationships.push({
                id: `rel_${uuidv4()}`,
                type: GraphRelationshipType.CONTAINS,
                fromNodeId: fileNode.id,
                toNodeId: classNode.id,
                properties: {
                  created: new Date().toISOString()
                }
              });

              // 创建类包含方法的关系
              for (const method of cls.methods) {
                const methodNode = this.createFunctionNode(method, classNode.id);
                nodes.push(methodNode);

                relationships.push({
                  id: `rel_${uuidv4()}`,
                  type: GraphRelationshipType.CONTAINS,
                  fromNodeId: classNode.id,
                  toNodeId: methodNode.id,
                  properties: {
                    created: new Date().toISOString()
                  }
                });
              }
            }
          }
          return batchNodes;
        }
      );
    }

    // 创建导入关系
    if (analysisResult.imports.length > 0) {
      const importRelationships = this.createImportRelationships(analysisResult.imports, fileNode.id);
      relationships.push(...importRelationships);
    }

    // 创建函数调用关系
    if (analysisResult.functions.length > 0) {
      const callRelationships = this.createFunctionCallRelationships(analysisResult.functions, fileNode.id);
      relationships.push(...callRelationships);
    }

    // 验证生成的节点和关系
    const validationResult = this.validator.validateGraphData(nodes, relationships);
    if (!validationResult.isValid) {
      this.logger.warn('Graph data validation failed', {
        filePath,
        errors: validationResult.errors
      });
      // 可以选择抛出错误或继续处理
      // throw new Error(`Graph data validation failed: ${validationResult.errors.join(', ')}`);
    }

    const result: GraphNodeMappingResult = {
      nodes,
      relationships,
      stats: {
        fileNodes: 1,
        functionNodes: analysisResult.functions.length + analysisResult.classes.reduce((acc, cls) => acc + cls.methods.length, 0),
        classNodes: analysisResult.classes.length,
        relationships: relationships.length
      }
    };

    // 缓存结果
    await this.cache.cacheMappingResult(cacheKey, nodes, relationships);

    this.logger.debug('File mapping completed', {
      filePath,
      nodeCount: nodes.length,
      relationshipCount: relationships.length
    });

    return result;
  }

  async mapChunksToGraphNodes(
    chunks: CodeChunk[],
    parentFileId: string
  ): Promise<ChunkNodeMappingResult> {
    this.logger.debug('Mapping chunks to graph nodes', { chunkCount: chunks.length, parentFileId });

    // 检查缓存
    const cacheKey = `chunk_mapping_${parentFileId}_${chunks.length}`;
    const cachedResult = await this.cache.getMappingResult(cacheKey);
    if (cachedResult) {
      this.logger.debug('Using cached chunk mapping result', { parentFileId, chunkCount: chunks.length });
      return {
        nodes: cachedResult.nodes,
        relationships: cachedResult.relationships,
        stats: {
          chunkNodes: cachedResult.nodes.length,
          relationships: cachedResult.relationships.length
        }
      };
    }

    const nodes: GraphNode[] = [];
    const relationships: GraphRelationship[] = [];

    // 使用批量优化器处理代码块
    const result = await this.batchOptimizer.executeWithOptimalBatching(
      chunks,
      async (chunkBatch) => {
        const batchNodes = chunkBatch.map(chunk => {
          // 为每个代码块创建节点
          return {
            id: `chunk_${uuidv4()}`,
            type: GraphNodeType.FUNCTION, // 暂时将代码块视为函数类型
            properties: {
              content: chunk.content,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              language: chunk.language,
              parentFileId,
              embeddingId: chunk.id // 如果有嵌入向量ID
            }
          };
        });

        nodes.push(...batchNodes);

        // 创建文件包含代码块的关系
        const batchRelationships = batchNodes.map(chunkNode => ({
          id: `rel_${uuidv4()}`,
          type: GraphRelationshipType.CONTAINS,
          fromNodeId: parentFileId,
          toNodeId: chunkNode.id,
          properties: {
            created: new Date().toISOString()
          }
        }));

        relationships.push(...batchRelationships);
        
        return batchNodes;
      }
    );

    // 验证生成的节点和关系
    const validationResult = this.validator.validateGraphData(nodes, relationships);
    if (!validationResult.isValid) {
      this.logger.warn('Chunk graph data validation failed', {
        parentFileId,
        errors: validationResult.errors
      });
    }

    const finalResult: ChunkNodeMappingResult = {
      nodes,
      relationships,
      stats: {
        chunkNodes: nodes.length,
        relationships: relationships.length
      }
    };

    // 缓存结果
    await this.cache.cacheMappingResult(cacheKey, nodes, relationships);

    this.logger.debug('Chunk mapping completed', {
      chunkCount: chunks.length,
      nodeCount: nodes.length,
      relationshipCount: relationships.length
    });

    return finalResult;
  }

  createFileNode(filePath: string, metadata: FileMetadata): GraphFileNode {
    const nodeId = `file_${uuidv4()}`;

    const node: GraphFileNode = {
      id: nodeId,
      type: GraphNodeType.FILE,
      name: metadata.name,
      path: metadata.path,
      language: metadata.language,
      size: metadata.size,
      lastModified: metadata.lastModified,
      projectId: metadata.projectId,
      properties: {
        ...metadata,
        created: new Date().toISOString()
      }
    };

    this.logger.debug('Created file node', { nodeId, filePath: metadata.path });
    return node;
  }

  createFunctionNode(functionInfo: FunctionInfo, parentFileId: string): GraphFunctionNode {
    const nodeId = `func_${uuidv4()}`;

    const node: GraphFunctionNode = {
      id: nodeId,
      type: GraphNodeType.FUNCTION,
      name: functionInfo.name,
      signature: functionInfo.signature,
      startLine: functionInfo.startLine,
      endLine: functionInfo.endLine,
      complexity: functionInfo.complexity,
      parentFileId,
      properties: {
        ...functionInfo,
        parentFileId,
        created: new Date().toISOString()
      }
    };

    this.logger.debug('Created function node', { nodeId, functionName: functionInfo.name });
    return node;
 }

  createClassNode(classInfo: ClassInfo, parentFileId: string): GraphClassNode {
    const nodeId = `class_${uuidv4()}`;

    const node: GraphClassNode = {
      id: nodeId,
      type: GraphNodeType.CLASS,
      name: classInfo.name,
      methods: classInfo.methods.map(m => m.name),
      properties: classInfo.properties.map(p => p.name),
      parentFileId,
      properties: {
        ...classInfo,
        parentFileId,
        created: new Date().toISOString()
      }
    };

    this.logger.debug('Created class node', { nodeId, className: classInfo.name });
    return node;
 }

  createRelationships(nodes: GraphNode[], fileId: string): GraphRelationship[] {
    const relationships: GraphRelationship[] = [];

    // 在节点之间创建基本关系
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeA = nodes[i];
        const nodeB = nodes[j];

        // 根据节点类型创建适当的关系
        if (nodeA.type === GraphNodeType.FUNCTION && nodeB.type === GraphNodeType.FUNCTION) {
          // 函数之间可能存在调用关系（在实际实现中需要从AST中提取）
          continue; // 暂时跳过，因为需要更复杂的分析
        } else if (nodeA.type === GraphNodeType.CLASS && nodeB.type === GraphNodeType.FUNCTION) {
          // 如果函数属于类，创建包含关系
          relationships.push({
            id: `rel_${uuidv4()}`,
            type: GraphRelationshipType.CONTAINS,
            fromNodeId: nodeA.id,
            toNodeId: nodeB.id,
            properties: {
              created: new Date().toISOString()
            }
          });
        } else if (nodeA.type === GraphNodeType.FUNCTION && nodeB.type === GraphNodeType.CLASS) {
          relationships.push({
            id: `rel_${uuidv4()}`,
            type: GraphRelationshipType.CONTAINS,
            fromNodeId: nodeB.id,
            toNodeId: nodeA.id,
            properties: {
              created: new Date().toISOString()
            }
          });
        }
      }
    }

    // 添加文件包含关系
    for (const node of nodes) {
      if (node.id !== fileId) { // 避免自己包含自己的情况
        relationships.push({
          id: `rel_${uuidv4()}`,
          type: GraphRelationshipType.CONTAINS,
          fromNodeId: fileId,
          toNodeId: node.id,
          properties: {
            created: new Date().toISOString()
          }
        });
      }
    }

    this.logger.debug('Created relationships', { relationshipCount: relationships.length });
    return relationships;
  }

  createImportRelationships(imports: ImportInfo[], fileId: string): GraphRelationship[] {
    const relationships: GraphRelationship[] = [];

    for (const imp of imports) {
      // 创建一个虚拟的导入节点
      const importNode: GraphNode = {
        id: `import_${uuidv4()}`,
        type: GraphNodeType.IMPORT,
        properties: {
          name: imp.name,
          path: imp.path,
          importedAs: imp.importedAs,
          created: new Date().toISOString()
        }
      };

      // 创建文件导入关系
      relationships.push({
        id: `rel_${uuidv4()}`,
        type: GraphRelationshipType.IMPORTS,
        fromNodeId: fileId,
        toNodeId: importNode.id,
        properties: {
          created: new Date().toISOString()
        }
      });
    }

    this.logger.debug('Created import relationships', { importCount: imports.length });
    return relationships;
  }

  createFunctionCallRelationships(functions: FunctionInfo[], fileId: string): GraphRelationship[] {
    const relationships: GraphRelationship[] = [];

    // 在函数之间创建调用关系（在实际实现中需要从AST中提取调用信息）
    // 这里我们创建一个简单的示例，实际实现需要更复杂的AST分析
    for (let i = 0; i < functions.length; i++) {
      for (let j = i + 1; j < functions.length; j++) {
        // 随机创建一些函数调用关系作为示例
        // 在实际实现中，这需要从AST中提取真实的调用信息
        if (Math.random() > 0.7) { // 30% 概率创建调用关系
          relationships.push({
            id: `rel_${uuidv4()}`,
            type: GraphRelationshipType.CALLS,
            fromNodeId: functions[i].name, // 实际中应该是函数节点ID
            toNodeId: functions[j].name, // 实际中应该是函数节点ID
            properties: {
              created: new Date().toISOString()
            }
          });
        }
      }
    }

    this.logger.debug('Created function call relationships', { relationshipCount: relationships.length });
    return relationships;
  }

  async extractCodeElementsFromAST(ast: any, filePath: string): Promise<FileAnalysisResult> {
    this.logger.debug('Extracting code elements from AST', { filePath });

    // 这是一个简化的AST解析示例
    // 在实际实现中，这将使用Tree-sitter或其他AST解析库来提取详细信息
    const result: FileAnalysisResult = {
      filePath,
      language: this.getLanguageFromPath(filePath),
      ast,
      functions: [],
      classes: [],
      imports: [],
      variables: []
    };

    // 这里应该有实际的AST解析逻辑
    // 由于这是一个示例实现，我们返回空数组
    // 实际实现将使用Tree-sitter或其他工具来遍历AST并提取代码元素

    this.logger.debug('Code element extraction completed', { filePath });
    return result;
 }

  private getLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rb': 'ruby',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'xml': 'xml'
    };

    return languageMap[ext] || 'unknown';
  }
}