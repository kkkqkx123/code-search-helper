import 'reflect-metadata';
import { GraphPersistenceUtils, GraphPersistenceOptions, GraphQuery } from '../GraphPersistenceUtils';

// Simple mock for LoggerService
const mockLoggerService = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn()
};

// Simple mock for NebulaService
const mockNebulaService = {
  executeReadQuery: jest.fn(),
  executeWriteQuery: jest.fn(),
  isConnected: jest.fn().mockReturnValue(true),
  isInitialized: jest.fn().mockReturnValue(true),
  getDatabaseStats: jest.fn().mockResolvedValue({
    hosts: ['localhost:9669']
  })
};

// Simple mock for NebulaQueryBuilder
const mockQueryBuilder = {
  buildNodeCountQuery: jest.fn().mockReturnValue({
    query: 'MATCH (n:${tagName}) RETURN count(n) AS total',
    params: {}
  }),
  updateVertex: jest.fn().mockReturnValue({
    query: 'UPDATE VERTEX ON Function "test-id" SET content = $content',
    params: { content: 'test content' }
  })
};

describe('GraphPersistenceUtils', () => {
  let persistenceUtils: GraphPersistenceUtils;

  beforeEach(() => {
    jest.clearAllMocks();
    persistenceUtils = new GraphPersistenceUtils(
      mockLoggerService as any,
      mockNebulaService as any,
      mockQueryBuilder as any
    );
  });

  describe('constructor', () => {
    it('should initialize with injected dependencies', () => {
      expect(persistenceUtils).toBeDefined();
    });
  });

  describe('generateSpaceName', () => {
    it('should generate space name from project ID', () => {
      const projectId = 'test-project-123';
      const spaceName = persistenceUtils.generateSpaceName(projectId);

      expect(spaceName).toBe(`project_${projectId}`);
    });
  });

  describe('createProjectNode', () => {
    it('should create project node query', () => {
      const projectId = 'test-project';
      const query = persistenceUtils.createProjectNode(projectId);

      expect(query).toHaveProperty('nGQL');
      expect(query).toHaveProperty('parameters');
      expect(query.parameters).toHaveProperty('projectId', projectId);
    });
  });

  describe('createFileQueries', () => {
    const mockFile = {
      id: 'file-123',
      filePath: '/src/test.ts',
      relativePath: 'src/test.ts',
      language: 'typescript',
      size: 1024,
      hash: 'abc123',
      metadata: {
        linesOfCode: 50,
        functions: 5,
        classes: 2,
        imports: ['fs', 'path']
      },
      chunks: []
    };

    it('should create file queries with project relationship', () => {
      const options: GraphPersistenceOptions = {
        projectId: 'test-project',
        overwriteExisting: true
      };

      const queries = persistenceUtils.createFileQueries(mockFile, options);

      expect(queries.length).toBeGreaterThan(0);
      expect(queries[0]).toHaveProperty('nGQL');
      expect(queries[0]).toHaveProperty('parameters');
    });

    it('should handle file without project ID', () => {
      const options: GraphPersistenceOptions = {};
      const queries = persistenceUtils.createFileQueries(mockFile, options);

      expect(queries.length).toBeGreaterThan(0);
    });
  });

  describe('createChunkQueries', () => {
    const mockChunk = {
      id: 'chunk-456',
      type: 'function' as const,
      content: 'function test() {}',
      startLine: 1,
      endLine: 5,
      functionName: 'test',
      metadata: {
        complexity: 1,
        parameters: [],
        returnType: 'void'
      }
    };

    it('should create chunk queries', () => {
      const options: GraphPersistenceOptions = {};
      const queries = persistenceUtils.createChunkQueries(mockChunk, options);

      expect(queries.length).toBeGreaterThan(0);
    });
  });

  describe('createRelationshipQueries', () => {
    const mockFiles = [
      {
        id: 'file-1',
        filePath: '/src/file1.ts',
        relativePath: 'src/file1.ts',
        language: 'typescript',
        size: 512,
        hash: 'def456',
        metadata: {
          linesOfCode: 30,
          functions: 3,
          classes: 1,
          imports: ['react', 'react-dom']
        },
        chunks: []
      }
    ];

    it('should create relationship queries for imports', () => {
      const options: GraphPersistenceOptions = {};
      const queries = persistenceUtils.createRelationshipQueries(mockFiles, options);

      expect(queries.length).toBeGreaterThan(0);
    });
  });

  describe('chunkArray', () => {
    it('should split array into chunks', () => {
      const items = Array.from({ length: 150 }, (_, i) => i);

      const chunks = persistenceUtils.chunkArray(items, 30);

      expect(chunks).toHaveLength(5); // 150/30 = 5 chunks
    });

    it('should handle empty array', () => {
      const chunks = persistenceUtils.chunkArray([], 10);

      expect(chunks).toHaveLength(0);
    });
  });

  describe('delay', () => {
    it('should delay for specified time', async () => {
      const startTime = Date.now();
      const delayMs = 100;

      await persistenceUtils.delay(delayMs);

      expect(Date.now() - startTime).toBeGreaterThanOrEqual(delayMs);
    });
  });

  describe('retryOperation', () => {
    it('should retry operation on failure', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('Temporary failure'));

      await expect(async () => {
        await persistenceUtils.retryOperation(failingOperation, 3, 10);
      }).rejects.toThrow('Temporary failure');
    });

    it('should succeed after retries', async () => {
      let callCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Temporary failure');
        }
        return 'success';
      });

      const result = await persistenceUtils.retryOperation(operation, 3, 10);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const alwaysFailing = jest.fn().mockRejectedValue(new Error('Permanent failure'));
      
      await expect(async () => {
        await persistenceUtils.retryOperation(alwaysFailing, 2, 10);
      }).rejects.toThrow('Permanent failure');

      expect(alwaysFailing).toHaveBeenCalledTimes(2);
    });
  });

  describe('createUpdateNodeQueries', () => {
    const mockChunks = [
      {
        id: 'chunk-1',
        type: 'function' as const,
        content: 'function test() {}',
        startLine: 1,
        endLine: 5,
        functionName: 'test',
        metadata: {
          complexity: 1,
          parameters: ['param1'],
          returnType: 'void'
        }
      },
      {
        id: 'chunk-2',
        type: 'class' as const,
        content: 'class Test {}',
        startLine: 6,
        endLine: 10,
        className: 'Test',
        metadata: {
          methods: 2,
          properties: 3,
          inheritance: ['BaseClass']
        }
      }
    ];

    it('should create update queries for chunks', () => {
      const options: GraphPersistenceOptions = {};
      const queries = persistenceUtils.createUpdateNodeQueries(mockChunks, options);

      expect(queries.length).toBe(2);
      expect(mockQueryBuilder.updateVertex).toHaveBeenCalled();
    });
  });

  describe('getExistingNodeIds', () => {
    it('should get existing node IDs by type', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue({
        success: true,
        data: {
          rows: []
        }
      });

      const result = await persistenceUtils.getExistingNodeIds('File', {});

      expect(result).toBeInstanceOf(Array);
    });

    it('should handle query failure', async () => {
      mockNebulaService.executeReadQuery.mockRejectedValue(new Error('Query failed'));
      
      await expect(async () => {
        await persistenceUtils.getExistingNodeIds('File', {});
      }).rejects.toThrow('Query failed');
    });
  });

  describe('getExistingNodeIdsByIds', () => {
    it('should get existing node IDs by specific IDs', async () => {
      const nodeIds = ['node-1', 'node-2', 'node-3'];
      mockNebulaService.executeReadQuery.mockResolvedValue({
        success: true,
        data: {
          rows: [{ id: 'node-1' }, { id: 'node-2' }]
        }
      });

      const result = await persistenceUtils.getExistingNodeIdsByIds(nodeIds, 'File');

      expect(result).toBeInstanceOf(Array);
    });

    it('should handle empty ID list', async () => {
      const result = await persistenceUtils.getExistingNodeIdsByIds([], 'File');

      expect(result).toHaveLength(0);
    });
  });

  describe('getNodeIdsByFiles', () => {
    it('should get node IDs by file paths', async () => {
      const filePaths = ['/src/file1.ts', '/src/file2.ts'];
      mockNebulaService.executeReadQuery.mockResolvedValue({
        success: true,
        data: {
          rows: []
        }
      });

      const result = await persistenceUtils.getNodeIdsByFiles(filePaths, {});

      expect(result).toBeInstanceOf(Object);
    });
  });

  describe('checkMemoryUsage', () => {
    it('should check memory usage', () => {
      const isMemorySafe = persistenceUtils.checkMemoryUsage();

      expect(typeof isMemorySafe).toBe('boolean');
    });
  });

  describe('calculateOptimalBatchSize', () => {
    it('should calculate optimal batch size based on total items', () => {
      const totalItems = 500;
      const batchSize = persistenceUtils.calculateOptimalBatchSize(totalItems);

      expect(typeof batchSize).toBe('number');
      expect(batchSize).toBeGreaterThan(0);
    });
  });

  describe('extractProjectIdFromCurrentSpace', () => {
    it('should extract project ID from space name', () => {
      const spaceName = 'project_test-project-123';
      const projectId = persistenceUtils.extractProjectIdFromCurrentSpace(spaceName);

      expect(projectId).toBe('test-project-123');
    });

    it('should return null for invalid space name', () => {
      const result = persistenceUtils.extractProjectIdFromCurrentSpace(null);

      expect(result).toBeNull();
    });
  });

  describe('waitForSpaceDeletion', () => {
    it('should wait for space deletion', async () => {
      mockNebulaService.executeReadQuery.mockResolvedValue({
        data: []
      });

      await persistenceUtils.waitForSpaceDeletion(mockNebulaService as any, 'test-space', 3, 10);

      expect(mockNebulaService.executeReadQuery).toHaveBeenCalled();
    });
  });

  describe('ensureConstraints', () => {
    it('should ensure database constraints', async () => {
      mockNebulaService.executeWriteQuery.mockResolvedValue({});

      await persistenceUtils.ensureConstraints(mockNebulaService as any, mockLoggerService as any);
    });
  });

  describe('recordToGraphNode', () => {
    it('should convert record to graph node', () => {
      const record = {
        id: 'node-123',
        type: 'File',
        name: 'test.ts',
        properties: { path: '/src/test.ts' }
      };

      const graphNode = persistenceUtils.recordToGraphNode(record);

      expect(graphNode).toEqual({
        id: 'node-123',
        type: 'File',
        name: 'test.ts',
        properties: { path: '/src/test.ts' }
      });
    });
  });

  describe('recordToGraphRelationship', () => {
    it('should convert record to graph relationship', () => {
      const record = {
        id: 'rel-456',
        type: 'CONTAINS',
        properties: {}
      };

      const graphRelationship = persistenceUtils.recordToGraphRelationship(record, 'source-123', 'target-456');

      expect(graphRelationship).toEqual({
        id: 'rel-456',
        type: 'CONTAINS',
        sourceId: 'source-123',
        targetId: 'target-456',
        properties: {}
      });
    });
  });

  describe('processWithTimeout', () => {
    it('should process operation with timeout', async () => {
      const fastOperation = jest.fn().mockResolvedValue('success');

      const result = await persistenceUtils.processWithTimeout(fastOperation, 5000);

      expect(result).toBe('success');
    });

    it('should timeout slow operation', async () => {
      const slowOperation = jest.fn().mockImplementation(() => {
        return new Promise((resolve) => setTimeout(() => resolve('slow'), 1000));
      });

      await expect(async () => {
        await persistenceUtils.processWithTimeout(slowOperation, 500);
      }).rejects.toThrow('Operation timed out after 500ms');
    });
  });

  describe('getEnhancedGraphStats', () => {
    it('should get enhanced graph statistics', async () => {
      const result = await persistenceUtils.getEnhancedGraphStats(mockNebulaService as any, mockQueryBuilder as any);

      expect(result).toHaveProperty('nodeCount');
      expect(result).toHaveProperty('relationshipCount');
      expect(result).toHaveProperty('nodeTypes');
      expect(result).toHaveProperty('relationshipTypes');
    });
  });
});