import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { NebulaService } from '../../../database/nebula/NebulaService';
import { NebulaQueryBuilder } from '../../../database/nebula/NebulaQueryBuilder';
import { CodeGraphNode, CodeGraphRelationship } from '../core/types';

// Define local types for missing imports
interface ParsedFile {
  id: string;
  filePath: string;
  relativePath: string;
  language: string;
  size: number;
  hash: string;
  metadata: {
    linesOfCode: number;
    functions: number;
    classes: number;
    imports: string[];
  };
  chunks: CodeChunk[];
}

interface CodeChunk {
  id: string;
  type: 'function' | 'class';
  content: string;
  startLine: number;
  endLine: number;
  functionName?: string;
  className?: string;
  metadata: {
    complexity?: number;
    parameters?: any[];
    returnType?: string;
    language?: string;
    methods?: number;
    properties?: number;
    inheritance?: string[];
  };
}

export interface GraphQuery {
  nGQL: string;
  parameters?: Record<string, any>;
}

export interface GraphPersistenceOptions {
  projectId?: string;
  overwriteExisting?: boolean;
  createRelationships?: boolean;
  batchSize?: number;
  useCache?: boolean;
  cacheTTL?: number;
  limit?: number;
  type?: string;
}

export interface BatchProcessingOptions {
  batchSize?: number;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

@injectable()
export class GraphPersistenceUtils {
  generateSpaceName(projectId: string): string {
    return `project_${projectId}`;
  }
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.NebulaService) private nebulaService: NebulaService,
    @inject(TYPES.INebulaQueryBuilder) private queryBuilder: NebulaQueryBuilder
  ) { }

  createProjectNode(projectId: string): GraphQuery {
    return {
      nGQL: `INSERT VERTEX Project(id, name, createdAt, updatedAt) VALUES $projectId:($projectId, $projectId, now(), now())`,
      parameters: { projectId },
    };
  }

  createFileQueries(file: ParsedFile, options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];
    const fileQuery: GraphQuery = {
      nGQL: `INSERT VERTEX File(id, path, relativePath, name, language, size, hash, linesOfCode, functions, classes, lastModified, updatedAt) VALUES $fileId:($fileId, $filePath, $relativePath, $fileName, $language, $size, $hash, $linesOfCode, $functions, $classes, $lastModified, now())`,
      parameters: {
        fileId: file.id,
        filePath: file.filePath,
        relativePath: file.relativePath,
        fileName: file.filePath.split('/').pop() || 'unknown',
        language: file.language,
        size: file.size,
        hash: file.hash,
        linesOfCode: file.metadata.linesOfCode,
        functions: file.metadata.functions,
        classes: file.metadata.classes,
        lastModified: new Date().toISOString(),
      },
    };

    queries.push(fileQuery);

    if (options.projectId) {
      queries.push({
        nGQL: `INSERT EDGE BELONGS_TO() VALUES $fileId->$projectId:()`,
        parameters: { fileId: file.id, projectId: options.projectId },
      });
    }

    for (const chunk of file.chunks) {
      queries.push(...this.createChunkNodeQueries(chunk, file, options));
    }

    return queries;
  }

  createChunkQueries(chunk: CodeChunk, options: GraphPersistenceOptions): GraphQuery[] {
    return this.createChunkNodeQueries(chunk, null, options);
  }

  private createChunkNodeQueries(
    chunk: CodeChunk,
    file: ParsedFile | null,
    options: GraphPersistenceOptions
  ): GraphQuery[] {
    const queries: GraphQuery[] = [];

    if (chunk.type === 'function') {
      queries.push({
        nGQL: `INSERT VERTEX Function(id, name, content, startLine, endLine, complexity, parameters, returnType, language, updatedAt) VALUES $chunkId:($chunkId, $functionName, $content, $startLine, $endLine, $complexity, $parameters, $returnType, $language, now())`,
        parameters: {
          chunkId: chunk.id,
          functionName: chunk.functionName || 'anonymous',
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          complexity: chunk.metadata.complexity || 1,
          parameters: chunk.metadata.parameters || [],
          returnType: chunk.metadata.returnType || 'unknown',
          language: chunk.metadata.language || 'unknown',
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
          methods: chunk.metadata.methods || 0,
          properties: chunk.metadata.properties || 0,
          inheritance: chunk.metadata.inheritance || [],
          language: chunk.metadata.language || 'unknown',
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

  createRelationshipQueries(files: ParsedFile[], options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];

    for (const file of files) {
      for (const importName of file.metadata.imports) {
        queries.push({
          nGQL: `INSERT VERTEX Import(id, module, updatedAt) VALUES $importId:($importId, $importName, now())`,
          parameters: {
            importId: `import_${file.id}_${importName}`,
            importName: importName,
          },
        });

        queries.push({
          nGQL: `INSERT EDGE IMPORTS() VALUES $fileId->$importId:()`,
          parameters: {
            fileId: file.id,
            importId: `import_${file.id}_${importName}`,
          },
        });
      }
    }

    return queries;
  }

  chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async retryOperation<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error = new Error('Unknown error');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts) {
          this.logger.debug('Operation failed, retrying', {
            attempt,
            maxAttempts,
            error: lastError.message,
          });

          // Wait before retrying
          await this.delay(delayMs);
        }
      }
    }

    throw lastError;
  }

  createUpdateNodeQueries(chunks: CodeChunk[], options: GraphPersistenceOptions): GraphQuery[] {
    const queries: GraphQuery[] = [];

    for (const chunk of chunks) {
      if (chunk.type === 'function') {
        const updateQuery = this.queryBuilder.updateVertex(chunk.id, 'Function', {
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          complexity: chunk.metadata.complexity || 1,
          parameters: chunk.metadata.parameters || [],
          returnType: chunk.metadata.returnType || 'unknown',
          updatedAt: new Date().toISOString(),
        });
        queries.push({ nGQL: updateQuery.query, parameters: updateQuery.params });
      }

      if (chunk.type === 'class') {
        const updateQuery = this.queryBuilder.updateVertex(chunk.id, 'Class', {
          content: chunk.content,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          methods: chunk.metadata.methods || 0,
          properties: chunk.metadata.properties || 0,
          inheritance: chunk.metadata.inheritance || [],
          updatedAt: new Date().toISOString(),
        });
        queries.push({ nGQL: updateQuery.query, parameters: updateQuery.params });
      }
    }

    return queries;
  }

  async getExistingNodeIds(
    nodeType: string,
    options: GraphPersistenceOptions = {}
  ): Promise<string[]> {
    try {
      // Simplified query implementation as buildPagedQuery doesn't exist
      const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
      const projectClause = options.projectId ? `AND n.projectId = \"${options.projectId}\"` : '';

      const query = {
        nGQL: `MATCH (n:${nodeType}) WHERE true ${projectClause} RETURN n.id ${limitClause}`,
        parameters: {}
      };

      const result = await this.nebulaService.executeReadQuery(query.nGQL, query.parameters);

      if (result && result.success && result.data && result.data.rows) {
        return result.data.rows.map((row: any) => row.id || row._id);
      }

      return [];
    } catch (error) {
      this.logger.error('Failed to get existing node IDs', {
        nodeType,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getExistingNodeIdsByIds(nodeIds: string[], nodeType: string = 'Node'): Promise<string[]> {
    try {
      if (nodeIds.length === 0) {
        return [];
      }

      // 对于大量节点ID，需要分批查询
      const batches = this.chunkArray(nodeIds, 100);
      const existingIds: string[] = [];

      for (const batch of batches) {
        const idList = batch.map(id => `\"${id}\"`).join(',');
        // Simplified query implementation as buildPagedQuery doesn't exist
        const query = {
          nGQL: `MATCH (n:${nodeType}) WHERE n.id IN [${idList}] RETURN n.id`,
          parameters: {}
        };

        const result = await this.nebulaService.executeReadQuery(query.nGQL, query.parameters);

        if (result && result.success && result.data && result.data.rows) {
          existingIds.push(...result.data.rows.map((row: any) => row.id || row._id));
        }
      }

      return existingIds;
    } catch (error) {
      this.logger.error('Failed to get existing node IDs by IDs', {
        nodeType,
        nodeIdsCount: nodeIds.length,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async getNodeIdsByFiles(
    filePaths: string[],
    options: GraphPersistenceOptions = {}
  ): Promise<Record<string, string[]>> {
    try {
      const result: Record<string, string[]> = {};

      for (const filePath of filePaths) {
        // Simplified query implementation as buildPagedQuery doesn't exist
        const limitClause = options.limit ? `LIMIT ${options.limit}` : '';
        const query = {
          nGQL: `MATCH (f:File) WHERE f.path = \"${filePath}\" RETURN f.id ${limitClause}`,
          parameters: {}
        };

        const queryResult = await this.nebulaService.executeReadQuery(query.nGQL, query.parameters);

        if (queryResult && queryResult.success && queryResult.data && queryResult.data.rows) {
          result[filePath] = queryResult.data.rows.map((row: any) => row.id || row._id);
        } else {
          result[filePath] = [];
        }
      }

      return result;
    } catch (error) {
      this.logger.error('Failed to get node IDs by files', {
        filePaths,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  checkMemoryUsage(): boolean {
    const memoryUsage = process.memoryUsage();
    const usedMemory = memoryUsage.heapUsed / 1024 / 1024;
    const totalMemory = memoryUsage.heapTotal / 1024 / 1024;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    this.logger.debug('Memory usage', {
      usedMemory: `${usedMemory.toFixed(2)}MB`,
      totalMemory: `${totalMemory.toFixed(2)}MB`,
      memoryUsagePercent: `${memoryUsagePercent.toFixed(2)}%`,
    });

    return memoryUsagePercent < 80;
  }

  calculateOptimalBatchSize(totalItems: number): number {
    const baseSize = 100;
    const maxSize = 1000;
    const memorySafe = this.checkMemoryUsage();

    if (!memorySafe) {
      return Math.max(10, Math.floor(baseSize * 0.5));
    }

    if (totalItems <= baseSize) {
      return totalItems;
    }

    const optimalSize = Math.min(Math.floor(baseSize * Math.log10(totalItems)), maxSize);

    return Math.max(baseSize, optimalSize);
  }

  extractProjectIdFromCurrentSpace(currentSpace: string | null): string | null {
    if (!currentSpace) {
      return null;
    }

    const projectIdMatch = currentSpace.match(/project_(.+)/);

    if (projectIdMatch && projectIdMatch[1]) {
      return projectIdMatch[1];
    }

    return null;
  }

  async waitForSpaceDeletion(
    nebulaService: NebulaService,
    spaceName: string,
    maxRetries: number = 30,
    retryDelay: number = 1000
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const spacesResult = await nebulaService.executeReadQuery('SHOW SPACES');
        const spaces = spacesResult?.data || [];
        const spaceExists = spaces.some((space: { Name: string } | { name: string }) => {
          const spaceNameValue = 'Name' in space ? space.Name : space.name;
          return spaceNameValue === spaceName;
        });

        if (!spaceExists) {
          this.logger.debug('Space successfully deleted', { spaceName });
          return;
        }

        this.logger.debug('Waiting for space deletion', {
          spaceName,
          attempt,
          maxRetries,
        });

        await this.delay(retryDelay);
      } catch (error) {
        this.logger.warn('Error checking space deletion status', {
          spaceName,
          error: (error as Error).message,
          attempt,
        });

        if (attempt === maxRetries) {
          throw new Error(
            `Failed to confirm space deletion after ${maxRetries} attempts: ${(error as Error).message}`
          );
        }

        await this.delay(retryDelay);
      }
    }

    throw new Error(`Space ${spaceName} still exists after ${maxRetries} retries`);
  }

  async ensureConstraints(nebulaService: NebulaService, logger: any): Promise<void> {
    try {
      // 确保唯一性约束
      const constraints = [
        'CREATE TAG INDEX IF NOT EXISTS unique_file_id ON File(id(64))',
        'CREATE TAG INDEX IF NOT EXISTS unique_function_id ON Function(id(64))',
        'CREATE TAG INDEX IF NOT EXISTS unique_class_id ON Class(id(64))',
        'CREATE TAG INDEX IF NOT EXISTS unique_chunk_id ON Chunk(id(64))',
        'CREATE EDGE INDEX IF NOT EXISTS unique_contains_id ON Contains()',
        'CREATE EDGE INDEX IF NOT EXISTS unique_imports_id ON Imports()',
        'CREATE EDGE INDEX IF NOT EXISTS unique_extends_id ON Extends()',
        'CREATE EDGE INDEX IF NOT EXISTS unique_implements_id ON Implements()',
      ];

      // 循环创建所有约束，确保每个都成功
      for (const constraint of constraints) {
        await this.createIndexWithRetry(nebulaService, constraint, logger);
      }

      logger.debug('Constraints ensured successfully');
    } catch (error) {
      logger.error('Failed to ensure constraints', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * 创建索引并带有重试机制和错误处理
   */
  private async createIndexWithRetry(
    nebulaService: NebulaService,
    indexQuery: string,
    logger: any,
    maxRetries: number = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await nebulaService.executeWriteQuery(indexQuery, {});
        logger.debug(`Successfully created constraint index: ${indexQuery}`);
        return;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // 检查是否是"已存在"错误
        if (errorMessage.includes('already exists') || errorMessage.includes('existed')) {
          logger.debug(`Constraint index already exists: ${indexQuery}`);
          return;
        }

        if (attempt === maxRetries) {
          logger.error(`Failed to create constraint index after ${maxRetries} attempts: ${indexQuery}`, error);
          throw new Error(`Failed to create constraint index: ${indexQuery}. Error: ${errorMessage}`);
        }

        logger.warn(`Attempt ${attempt} failed to create constraint index: ${indexQuery}. Retrying...`, error);
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  recordToGraphNode(record: any): CodeGraphNode {
    return {
      id: record.id || record._id,
      type: record.type || record.tag || 'Unknown',
      name: record.name || 'Unknown',
      properties: record.properties || {},
    };
  }

  recordToGraphRelationship(
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

  async initializeConnectionPoolMonitoring(
    nebulaService: NebulaService,
    performanceMonitor: any
  ): Promise<void> {
    try {
      // Monitor system health status
      const stats = await nebulaService.getDatabaseStats();
      performanceMonitor.updateSystemHealthStatus('healthy');

      // Set up periodic monitoring
      const interval = setInterval(async () => {
        try {
          // 检查服务是否已初始化和连接
          if (nebulaService.isInitialized() && nebulaService.isConnected()) {
            const currentStats = await nebulaService.getDatabaseStats();
            performanceMonitor.updateSystemHealthStatus(
              currentStats.hosts && currentStats.hosts.length > 0 ? 'healthy' : 'degraded'
            );
          } else {
            performanceMonitor.updateSystemHealthStatus('degraded');
          }
        } catch (error) {
          performanceMonitor.updateSystemHealthStatus('error');
        }
      }, 30000); // Check every 30 seconds

      // Ensure interval doesn't prevent Node.js from exiting
      if (interval && interval.unref) {
        interval.unref();
      }
    } catch (error) {
      performanceMonitor.updateSystemHealthStatus('error');
    }
  }

  async processWithTimeout<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  // Enhanced graph statistics using NebulaQueryBuilder
  async getEnhancedGraphStats(
    nebulaService: NebulaService,
    queryBuilder: NebulaQueryBuilder
  ): Promise<{
    nodeCount: number;
    relationshipCount: number;
    nodeTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
  }> {
    try {
      // Use NebulaQueryBuilder to build count queries
      // 先检查连接状态
      if (!nebulaService.isConnected()) {
        return {
          nodeCount: 0,
          relationshipCount: 0,
          nodeTypes: {},
          relationshipTypes: {},
        };
      }
      
      // 获取当前空间
      const connectionStatus = nebulaService.connectionManager.getConnectionStatus();
      const currentSpace = connectionStatus?.space;
      
      // 只有在当前空间存在的情况下才执行需要空间上下文的查询
      if (!currentSpace || currentSpace === 'undefined' || currentSpace === '') {
        return {
          nodeCount: 0,
          relationshipCount: 0,
          nodeTypes: {},
          relationshipTypes: {},
        };
      }
      
      const tagResult = await nebulaService.executeReadQuery('SHOW TAGS');
      const edgeResult = await nebulaService.executeReadQuery('SHOW EDGES');

      const nodeTypes: Record<string, number> = {};
      const relationshipTypes: Record<string, number> = {};

      // Count nodes for each tag
      if (tagResult && Array.isArray(tagResult)) {
        for (const tag of tagResult) {
          const tagName = tag.Name || tag.name || 'Unknown';
          const countQuery = queryBuilder.buildNodeCountQuery(tagName);
          const countResult = await nebulaService.executeReadQuery(
            countQuery.query,
            countQuery.params
          );

          if (countResult && Array.isArray(countResult) && countResult.length > 0) {
            nodeTypes[tagName] = countResult[0].total || 0;
          }
        }
      }

      // Count relationships for each edge type
      if (edgeResult && Array.isArray(edgeResult)) {
        for (const edge of edgeResult) {
          const edgeName = edge.Name || edge.name || 'Unknown';
          // For edge counting, we would need to use MATCH queries
          // This is a simplified implementation
          relationshipTypes[edgeName] = 0;
        }
      }

      const totalNodes = Object.values(nodeTypes).reduce((sum, count) => sum + count, 0);
      const totalRelationships = Object.values(relationshipTypes).reduce(
        (sum, count) => sum + count,
        0
      );

      return {
        nodeCount: totalNodes,
        relationshipCount: totalRelationships,
        nodeTypes,
        relationshipTypes,
      };
    } catch (error) {
      // Fallback to basic implementation
      return {
        nodeCount: 0,
        relationshipCount: 0,
        nodeTypes: {},
        relationshipTypes: {},
      } as const;
    }
  }
}