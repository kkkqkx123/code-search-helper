import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { DynamicParserManager } from '../../parser/query/DynamicParserManager';
import { QueryExecutor } from '../../parser/query/QueryExecutor';
import { IGraphDataMappingService } from '../mapping/IGraphDataMappingService';
import { InfrastructureConfigService } from '../../../infrastructure/config/InfrastructureConfigService';
import { IGraphIndexPerformanceMonitor } from '../../../infrastructure/monitoring/GraphIndexMetrics';
import { IGraphConstructionService } from './IGraphConstructionService';
import { GraphData } from '../caching/types';
import { NodeIdGenerator } from '../../../utils/deterministic-node-id';
import { CodeChunk } from '../../parser/types';
import { GraphNode, GraphRelationship } from '../mapping/IGraphDataMappingService';
import * as fs from 'fs/promises';

/**
 * 图构建服务实现
 * 负责从代码块构建图结构
 */
@injectable()
export class GraphConstructionService implements IGraphConstructionService {
  private dynamicParserManager: DynamicParserManager;
  private queryExecutor: QueryExecutor;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.CacheService) private cacheService: any,
    @inject(TYPES.GraphDataMappingService) private graphMappingService: IGraphDataMappingService,
    @inject(TYPES.InfrastructureConfigService) private configService: InfrastructureConfigService,
    @inject(TYPES.GraphIndexPerformanceMonitor) private performanceMonitor: IGraphIndexPerformanceMonitor
  ) {
    this.dynamicParserManager = new DynamicParserManager(cacheService);
    this.queryExecutor = QueryExecutor.getInstance();
  }

  /**
   * 构建图结构
   */
  async buildGraphStructure(files: string[], projectPath: string): Promise<GraphData> {
    const operationId = `buildGraphStructure_${Date.now()}`;
    const startTime = Date.now();

    try {
      this.logger.info(`Starting graph structure construction for ${files.length} files`, {
        projectPath,
        fileCount: files.length
      });

      const nodes: GraphNode[] = [];
      const relationships: GraphRelationship[] = [];

      for (const filePath of files) {
        try {
          const fileNodes = await this.convertToGraphNodesFromFile(filePath);
          const fileRelationships = await this.convertToGraphRelationshipsFromFile(filePath);

          nodes.push(...fileNodes);
          relationships.push(...fileRelationships);
        } catch (error) {
          this.errorHandler.handleError(error as Error, {
            component: 'GraphConstructionService',
            operation: 'buildGraphStructure',
            filePath,
            projectPath
          });
        }
      }

      const result: GraphData = {
        nodes,
        relationships,
        metadata: this.buildMetadata(files, projectPath)
      };

      // 记录性能指标
      this.performanceMonitor.recordMetric({
        operation: 'storeFiles',
        projectId: projectPath,
        duration: Date.now() - startTime,
        success: true,
        timestamp: Date.now(),
        metadata: {
          fileCount: files.length,
          nodesCreated: nodes.length,
          relationshipsCreated: relationships.length
        }
      });

      this.logger.info(`Completed graph structure construction`, {
        projectPath,
        nodesCreated: nodes.length,
        relationshipsCreated: relationships.length,
        processingTime: Date.now() - startTime
      });

      return result;
    } catch (error) {
      // 记录失败的性能指标
      this.performanceMonitor.recordMetric({
        operation: 'storeFiles',
        projectId: projectPath,
        duration: Date.now() - startTime,
        success: false,
        timestamp: Date.now(),
        metadata: {
          fileCount: files.length,
          errorMessage: (error as Error).message,
          errorType: (error as Error).constructor.name
        }
      });

      this.errorHandler.handleError(error as Error, {
        component: 'GraphConstructionService',
        operation: 'buildGraphStructure',
        projectPath,
        files
      });
      throw error;
    }
  }

  /**
   * 将代码块转换为图节点
   */
  convertToGraphNodes(chunks: CodeChunk[]): GraphNode[] {
    const nodes: GraphNode[] = [];

    for (const chunk of chunks) {
      const symbolName = this.extractNameFromChunk(chunk);
      const filePath = chunk.metadata.filePath || 'unknown_file';
      const node: GraphNode = {
        id: NodeIdGenerator.forSymbol(symbolName, chunk.metadata.type, filePath, chunk.metadata.startLine),
        type: this.mapChunkTypeToGraphNodeType(chunk.metadata.type),
        properties: {
          content: chunk.content,
          startLine: chunk.metadata.startLine,
          endLine: chunk.metadata.endLine,
          language: chunk.metadata.language,
          filePath: chunk.metadata.filePath,
          complexity: chunk.metadata.complexity || 0,
          size: chunk.metadata.size,
          lineCount: chunk.metadata.lineCount,
          strategy: chunk.metadata.strategy,
          timestamp: chunk.metadata.timestamp
        }
      };

      nodes.push(node);
    }

    return nodes;
  }

  /**
   * 将代码块转换为图关系
   */
  convertToGraphRelationships(chunks: CodeChunk[]): GraphRelationship[] {
    const relationships: GraphRelationship[] = [];

    // 基于代码块之间的关系创建图关系
    for (let i = 0; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      const currentSymbolName = this.extractNameFromChunk(currentChunk);
      const currentFilePath = currentChunk.metadata.filePath || 'unknown_file';
      const currentId = NodeIdGenerator.forSymbol(currentSymbolName, currentChunk.metadata.type, currentFilePath, currentChunk.metadata.startLine);

      // 检查与其他代码块的关系
      for (let j = i + 1; j < chunks.length; j++) {
        const otherChunk = chunks[j];
        const otherSymbolName = this.extractNameFromChunk(otherChunk);
        const otherFilePath = otherChunk.metadata.filePath || 'unknown_file';
        const otherId = NodeIdGenerator.forSymbol(otherSymbolName, otherChunk.metadata.type, otherFilePath, otherChunk.metadata.startLine);

        // 检查包含关系
        if (this.isContaining(currentChunk, otherChunk)) {
          relationships.push({
            id: this.generateRelationshipId(currentId, otherId, 'CONTAINS'),
            type: 'CONTAINS' as any,
            fromNodeId: currentId,
            toNodeId: otherId,
            properties: {
              relationshipType: 'CONTAINS',
              strength: this.calculateRelationshipStrength(currentChunk, otherChunk)
            }
          });
        }

        // 检查调用关系
        if (this.isCalling(currentChunk, otherChunk)) {
          relationships.push({
            id: this.generateRelationshipId(currentId, otherId, 'CALLS'),
            type: 'CALLS' as any,
            fromNodeId: currentId,
            toNodeId: otherId,
            properties: {
              relationshipType: 'CALLS',
              strength: this.calculateRelationshipStrength(currentChunk, otherChunk)
            }
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 从文件转换为图节点
   */
  private async convertToGraphNodesFromFile(filePath: string): Promise<GraphNode[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const language = await this.dynamicParserManager.detectLanguage(filePath);

      if (!language) {
        this.logger.warn(`Unsupported language for file: ${filePath}`);
        return [];
      }

      // 创建文件节点
      const fileNode: GraphNode = {
        id: this.generateFileNodeId(filePath),
        type: 'File' as any,
        properties: {
          name: this.getFileName(filePath),
          path: filePath,
          language: language,
          size: content.length,
          lastModified: (await fs.stat(filePath)).mtime.getTime()
        }
      };

      // 使用图映射服务处理文件内容
      const parseResult = await this.dynamicParserManager.parseCode(content, language);
      const mappingResult = await this.graphMappingService.mapToGraph(filePath, []);

      return [fileNode, ...mappingResult.nodes];
    } catch (error) {
      this.logger.error(`Failed to convert file to graph nodes: ${filePath}`, { error });
      throw error;
    }
  }

  /**
   * 从文件转换为图关系
   */
  private async convertToGraphRelationshipsFromFile(filePath: string): Promise<GraphRelationship[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const language = await this.dynamicParserManager.detectLanguage(filePath);

      if (!language) {
        return [];
      }

      // 使用图映射服务处理文件内容
      const mappingResult = await this.graphMappingService.mapToGraph(filePath, []);
      return mappingResult.edges.map(edge => ({
        id: edge.id,
        type: edge.type as any,
        fromNodeId: edge.sourceNodeId,
        toNodeId: edge.targetNodeId,
        properties: edge.properties
      }));
    } catch (error) {
      this.logger.error(`Failed to convert file to graph relationships: ${filePath}`, { error });
      return [];
    }
  }

  /**
   * 构建元数据
   */
  private buildMetadata(files: string[], projectPath: string): Record<string, any> {
    return {
      projectPath,
      fileCount: files.length,
      createdAt: Date.now(),
      version: '1.0.0',
      config: this.configService.getGraphConfiguration()
    };
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(chunk: CodeChunk): string {
    const filePath = chunk.metadata.filePath || 'unknown_file';
    return NodeIdGenerator.forChunk(
      filePath,
      chunk.metadata.startLine,
      chunk.metadata.endLine,
      chunk.content
    );
  }

  /**
   * 生成文件节点ID
   */
  private generateFileNodeId(filePath: string): string {
    return `file_${Buffer.from(filePath).toString('hex').substring(0, 16)}`;
  }

  /**
   * 生成关系ID
   */
  private generateRelationshipId(fromId: string, toId: string, type: string): string {
    return NodeIdGenerator.forRelationship(fromId, toId, type);
  }

  /**
   * 将代码块类型映射到图节点类型
   */
  private mapChunkTypeToGraphNodeType(chunkType: string): any {
    const typeMapping: Record<string, string> = {
      'function': 'Function',
      'class': 'Class',
      'method': 'Method',
      'import': 'Import',
      'export': 'Export',
      'variable': 'Variable',
      'interface': 'Interface',
      'type': 'Type',
      'enum': 'Enum',
      'module': 'Module'
    };

    return typeMapping[chunkType] || 'Generic';
  }

  /**
   * 检查包含关系
   */
  private isContaining(parent: CodeChunk, child: CodeChunk): boolean {
    return parent.metadata.startLine <= child.metadata.startLine &&
      parent.metadata.endLine >= child.metadata.endLine &&
      parent.metadata.filePath === child.metadata.filePath;
  }

  /**
   * 检查调用关系
   */
  private isCalling(caller: CodeChunk, callee: CodeChunk): boolean {
    // 简化实现：检查调用者内容是否包含被调用者的名称
    if (caller.metadata.type === 'function' || caller.metadata.type === 'method') {
      const calleeName = this.extractNameFromChunk(callee);
      return caller.content.includes(calleeName);
    }
    return false;
  }

  /**
   * 计算关系强度
   */
  private calculateRelationshipStrength(from: CodeChunk, to: CodeChunk): number {
    // 简化实现：基于距离和重叠度计算
    const lineDistance = Math.abs(from.metadata.startLine - to.metadata.startLine);
    const maxDistance = 100;
    return Math.max(0, 1 - (lineDistance / maxDistance));
  }

  /**
   * 从代码块中提取名称
   */
  private extractNameFromChunk(chunk: CodeChunk): string {
    // 简化实现：使用正则表达式提取名称
    const nameRegex = /^(function|class|interface|enum|type|var|let|const)\s+(\w+)/;
    const match = chunk.content.match(nameRegex);
    return match ? match[2] : 'unknown';
  }

  /**
   * 获取文件名
   */
  private getFileName(filePath: string): string {
    return filePath.split(/[/\\]/).pop() || filePath;
  }
}