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
  PropertyInfo
} from './IGraphDataMappingService';
import { CodeChunk } from '../../parser/types';
import { v4 as uuidv4 } from 'uuid';
import { DataMappingValidator } from './DataMappingValidator';
import { GraphMappingCache } from '../caching/GraphMappingCache';
import { GraphBatchOptimizer } from '../utils/GraphBatchOptimizer';
import { FaultToleranceHandler } from '../../../utils/FaultToleranceHandler';

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
}