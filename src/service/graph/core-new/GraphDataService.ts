import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';
import { GraphDatabaseService } from '../../../database/graph/GraphDatabaseService';
import { GraphQueryBuilder } from '../../../database/query/GraphQueryBuilder';
import { ICacheService } from '../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../infrastructure/monitoring/types';
import { 
  GraphPersistenceOptions, 
  GraphPersistenceResult,
  CodeGraphNode,
  CodeGraphRelationship
} from '../core/types';

@injectable()
export class GraphDataService {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private graphDatabase: GraphDatabaseService;
  private queryBuilder: GraphQueryBuilder;
  private cacheService: ICacheService;
  private performanceMonitor: IPerformanceMonitor;
  private isInitialized: boolean = false;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.GraphDatabaseService) graphDatabase: GraphDatabaseService,
    @inject(TYPES.IGraphQueryBuilder) queryBuilder: GraphQueryBuilder,
    @inject(TYPES.ICacheService) cacheService: ICacheService,
    @inject(TYPES.IPerformanceMonitor) performanceMonitor: IPerformanceMonitor
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    this.graphDatabase = graphDatabase;
    this.queryBuilder = queryBuilder;
    this.cacheService = cacheService;
    this.performanceMonitor = performanceMonitor;
  }

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing graph data service');
      
      // Ensure the graph database is initialized
      if (!this.graphDatabase.isDatabaseConnected()) {
        const initialized = await this.graphDatabase.initialize();
        if (!initialized) {
          throw new Error('Failed to initialize graph database');
        }
      }

      this.isInitialized = true;
      this.logger.info('Graph data service initialized successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize graph data service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'GraphDataService', operation: 'initialize' }
      );
      return false;
    }
  }

  async storeParsedFiles(
    files: any[],
    options: GraphPersistenceOptions = {}
  ): Promise<GraphPersistenceResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const result: GraphPersistenceResult = {
      success: false,
      nodesCreated: 0,
      relationshipsCreated: 0,
      nodesUpdated: 0,
      processingTime: 0,
      errors: [],
    };

    try {
      this.logger.info('Storing parsed files', {
        fileCount: files.length,
        options,
      });

      // Generate queries for all files
      const queries = [];
      for (const file of files) {
        queries.push(...this.createFileQueries(file, options));
      }

      // Execute the queries in batch
      const batchResult = await this.graphDatabase.executeBatch(queries);

      if (batchResult.success) {
        result.success = true;
        result.nodesCreated = this.countCreatedNodes(batchResult.results);
        result.relationshipsCreated = this.countCreatedRelationships(batchResult.results);
        result.processingTime = Date.now() - startTime;

        this.logger.info('Parsed files stored successfully', {
          fileCount: files.length,
          nodesCreated: result.nodesCreated,
          relationshipsCreated: result.relationshipsCreated,
          processingTime: result.processingTime,
        });
      } else {
        result.errors.push(batchResult.error || 'Unknown error');
        this.logger.error('Failed to store parsed files', {
          error: batchResult.error,
        });
      }

      return result;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to store parsed files: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphDataService', operation: 'storeParsedFiles' }
      );
      result.errors.push(`Storage failed: ${report.id}`);
      result.processingTime = Date.now() - startTime;
      this.logger.error('Failed to store parsed files', { errorId: report.id });
      return result;
    }
  }

  async storeChunks(
    chunks: any[],
    options: GraphPersistenceOptions = {}
  ): Promise<GraphPersistenceResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const result: GraphPersistenceResult = {
      success: false,
      nodesCreated: 0,
      relationshipsCreated: 0,
      nodesUpdated: 0,
      processingTime: 0,
      errors: [],
    };

    try {
      this.logger.info('Storing code chunks', {
        chunkCount: chunks.length,
        options,
      });

      // Generate queries for all chunks
      const queries = [];
      for (const chunk of chunks) {
        queries.push(...this.createChunkQueries(chunk, options));
      }

      // Execute the queries in batch
      const batchResult = await this.graphDatabase.executeBatch(queries);

      if (batchResult.success) {
        result.success = true;
        result.nodesCreated = this.countCreatedNodes(batchResult.results);
        result.relationshipsCreated = this.countCreatedRelationships(batchResult.results);
        result.processingTime = Date.now() - startTime;

        this.logger.info('Code chunks stored successfully', {
          chunkCount: chunks.length,
          nodesCreated: result.nodesCreated,
          relationshipsCreated: result.relationshipsCreated,
          processingTime: result.processingTime,
        });
      } else {
        result.errors.push(batchResult.error || 'Unknown error');
        this.logger.error('Failed to store code chunks', {
          error: batchResult.error,
        });
      }

      return result;
    } catch (error) {
      const report = this.errorHandler.handleError(
        new Error(
          `Failed to store code chunks: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphDataService', operation: 'storeChunks' }
      );
      result.errors.push(`Storage failed: ${report.id}`);
      result.processingTime = Date.now() - startTime;
      this.logger.error('Failed to store code chunks', { errorId: report.id });
      return result;
    }
  }

  async findRelatedNodes(
    nodeId: string,
    relationshipTypes?: string[],
    maxDepth: number = 2
  ): Promise<CodeGraphNode[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.debug('Finding related nodes', {
        nodeId,
        relationshipTypes,
        maxDepth,
      });

      // Build the traversal query
      const edgeTypes = relationshipTypes ? relationshipTypes.join(',') : '*';
      const query = `
        GO ${maxDepth} STEPS FROM "${nodeId}" OVER ${edgeTypes}
        YIELD dst(edge) AS relatedNodeId
        | FETCH PROP ON * $-.relatedNodeId YIELD vertex AS relatedNode
        LIMIT 100
      `;

      const result = await this.graphDatabase.executeReadQuery(query);
      
      if (result && result.data) {
        return result.data.map((record: any) => this.recordToGraphNode(record));
      }

      return [];
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to find related nodes: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphDataService', operation: 'findRelatedNodes' }
      );
      return [];
    }
  }

  async findPath(
    sourceId: string,
    targetId: string,
    maxDepth: number = 5
  ): Promise<CodeGraphRelationship[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.debug('Finding path between nodes', {
        sourceId,
        targetId,
        maxDepth,
      });

      // Build the path query
      const query = this.queryBuilder.buildPathQuery(sourceId, targetId, maxDepth);
      const result = await this.graphDatabase.executeReadQuery(query.nGQL, query.parameters);
      
      if (result && result.data) {
        return result.data.map((record: any) => this.recordToGraphRelationship(record, sourceId, targetId));
      }

      return [];
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to find path: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphDataService', operation: 'findPath' }
      );
      return [];
    }
  }

  async deleteNodes(nodeIds: string[]): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Deleting nodes', {
        nodeCount: nodeIds.length,
      });

      // Build delete queries
      const queries = nodeIds.map(nodeId => ({
        nGQL: `DELETE VERTEX "${nodeId}"`,
        parameters: {},
      }));

      // Execute the queries in batch
      const result = await this.graphDatabase.executeBatch(queries);

      if (result.success) {
        this.logger.info('Nodes deleted successfully', {
          nodeCount: nodeIds.length,
        });
        return true;
      } else {
        this.logger.error('Failed to delete nodes', {
          error: result.error,
        });
        return false;
      }
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to delete nodes: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphDataService', operation: 'deleteNodes' }
      );
      return false;
    }
  }

  async clearGraph(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      this.logger.info('Clearing graph');

      // Get the current space
      const currentSpace = this.graphDatabase.getCurrentSpace();
      if (!currentSpace) {
        throw new Error('No active space found');
      }

      // Delete and recreate the space
      const deleted = await this.graphDatabase.deleteSpace(currentSpace);
      if (!deleted) {
        throw new Error('Failed to delete space');
      }

      const created = await this.graphDatabase.createSpace(currentSpace);
      if (!created) {
        throw new Error('Failed to recreate space');
      }

      // Switch to the recreated space
      await this.graphDatabase.useSpace(currentSpace);

      this.logger.info('Graph cleared successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to clear graph: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphDataService', operation: 'clearGraph' }
      );
      return false;
    }
  }

  isServiceInitialized(): boolean {
    return this.isInitialized;
  }

  async close(): Promise<void> {
    try {
      this.logger.info('Closing graph data service');
      
      // Close the graph database service
      await this.graphDatabase.close();
      
      this.isInitialized = false;
      this.logger.info('Graph data service closed successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to close graph data service: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'GraphDataService', operation: 'close' }
      );
      throw error;
    }
  }

  private createFileQueries(file: any, options: GraphPersistenceOptions): any[] {
    const queries = [];

    // Create file node
    queries.push({
      nGQL: `INSERT VERTEX File(id, path, relativePath, name, language, size, hash, linesOfCode, functions, classes, lastModified, updatedAt) VALUES $fileId:($fileId, $filePath, $relativePath, $fileName, $language, $size, $hash, $linesOfCode, $functions, $classes, $lastModified, now())`,
      parameters: {
        fileId: file.id,
        filePath: file.filePath,
        relativePath: file.relativePath,
        fileName: file.filePath.split('/').pop() || 'unknown',
        language: file.language,
        size: file.size,
        hash: file.hash,
        linesOfCode: file.metadata?.linesOfCode || 0,
        functions: file.metadata?.functions || 0,
        classes: file.metadata?.classes || 0,
        lastModified: new Date().toISOString(),
      },
    });

    // Create project relationship if specified
    if (options.projectId) {
      queries.push({
        nGQL: `INSERT EDGE BELONGS_TO() VALUES $fileId->$projectId:()`,
        parameters: { fileId: file.id, projectId: options.projectId },
      });
    }

    // Process chunks
    for (const chunk of file.chunks || []) {
      queries.push(...this.createChunkNodeQueries(chunk, file, options));
    }

    // Process imports
    for (const importName of file.metadata?.imports || []) {
      const importId = `import_${file.id}_${importName}`;
      queries.push({
        nGQL: `INSERT VERTEX Import(id, module, updatedAt) VALUES $importId:($importId, $importName, now())`,
        parameters: {
          importId,
          importName,
        },
      });

      queries.push({
        nGQL: `INSERT EDGE IMPORTS() VALUES $fileId->$importId:()`,
        parameters: {
          fileId: file.id,
          importId,
        },
      });
    }

    return queries;
  }

  private createChunkQueries(chunk: any, options: GraphPersistenceOptions): any[] {
    return this.createChunkNodeQueries(chunk, null, options);
  }

  private createChunkNodeQueries(chunk: any, file: any | null, options: GraphPersistenceOptions): any[] {
    const queries = [];

    if (chunk.type === 'function') {
      queries.push({
        nGQL: `INSERT VERTEX Function(id, name, content, startLine, endLine, complexity, parameters, returnType, language, updatedAt) VALUES $chunkId:($chunkId, $functionName, $content, $startLine, $endLine, $complexity, $parameters, $returnType, $language, now())`,
        parameters: {
          chunkId: chunk.id,
          functionName: chunk.functionName || 'anonymous',
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          complexity: chunk.metadata?.complexity || 1,
          parameters: chunk.metadata?.parameters || [],
          returnType: chunk.metadata?.returnType || 'unknown',
          language: chunk.metadata?.language || 'unknown',
        },
      });

      if (file) {
        queries.push({
          nGQL: `INSERT EDGE CONTAINS() VALUES $fileId->$chunkId:()`,
          parameters: { fileId: file.id, chunkId: chunk.id },
        });
      }
    }

    if (chunk.type === 'class') {
      queries.push({
        nGQL: `INSERT VERTEX Class(id, name, content, startLine, endLine, methods, properties, inheritance, language, updatedAt) VALUES $chunkId:($chunkId, $className, $content, $startLine, $endLine, $methods, $properties, $inheritance, $language, now())`,
        parameters: {
          chunkId: chunk.id,
          className: chunk.className || 'anonymous',
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          methods: chunk.metadata?.methods || 0,
          properties: chunk.metadata?.properties || 0,
          inheritance: chunk.metadata?.inheritance || [],
          language: chunk.metadata?.language || 'unknown',
        },
      });

      if (file) {
        queries.push({
          nGQL: `INSERT EDGE CONTAINS() VALUES $fileId->$chunkId:()`,
          parameters: { fileId: file.id, chunkId: chunk.id },
        });
      }
    }

    return queries;
  }

  private countCreatedNodes(results: any[]): number {
    return results.filter(result => 
      result && result.success && 
      result.data && 
      (result.data.inserted || result.data.inserted_vertex)
    ).length;
  }

  private countCreatedRelationships(results: any[]): number {
    return results.filter(result => 
      result && result.success && 
      result.data && 
      (result.data.inserted || result.data.inserted_edge)
    ).length;
  }

  private recordToGraphNode(record: any): CodeGraphNode {
    return {
      id: record.id || record._id,
      type: record.type || record.tag || 'Unknown',
      name: record.name || 'Unknown',
      properties: record.properties || {},
    };
  }

  private recordToGraphRelationship(
    record: any,
    sourceId: string,
    targetId: string
  ): CodeGraphRelationship {
    return {
      id: record.id || record._id,
      type: record.type || record.edge || 'Unknown',
      sourceId,
      targetId,
      properties: record.properties || {},
    };
  }
}