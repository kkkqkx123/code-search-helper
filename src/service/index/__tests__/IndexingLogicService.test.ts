import { IndexingLogicService } from '../IndexingLogicService';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { FileSystemTraversal } from '../../filesystem/FileSystemTraversal';
import { QdrantService } from '../../../database/qdrant/QdrantService';
import { NebulaClient } from '../../../database/nebula/client/NebulaClient';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../../embedders/EmbeddingCacheService';
import { PerformanceOptimizerService } from '../../../infrastructure/batching/PerformanceOptimizerService';
import { ASTCodeSplitter } from '../../parser/processing/strategies/implementations/ASTCodeSplitter';
import { ChunkToVectorCoordinationService } from '../../parser/ChunkToVectorCoordinationService';
import { VectorPoint } from '../../../database/qdrant/IVectorStore';
import { FileInfo } from '../../filesystem/FileSystemTraversal';
import { ConfigService } from '../../../config/ConfigService';
import { IGraphService } from '../../graph/core/IGraphService';
import { IGraphDataMappingService } from '../../graph/mapping/IGraphDataMappingService';
import { PerformanceDashboard } from '../../monitoring/PerformanceDashboard';
import { AutoOptimizationAdvisor } from '../../optimization/AutoOptimizationAdvisor';
import { BatchProcessingOptimizer } from '../../optimization/BatchProcessingOptimizer';
import { INebulaProjectManager } from '../../../database/nebula/NebulaProjectManager';
import { TreeSitterService } from '../../parser/core/parse/TreeSitterService';
import { TreeSitterQueryEngine } from '../../parser/core/query/TreeSitterQueryExecutor';
import { NebulaNode, NebulaRelationship } from '../../../database/nebula/NebulaTypes';
import { CodeChunk } from '../../parser/types';
import { Container } from 'inversify';
import { TYPES } from '../../../types';
import { ConcurrencyService } from '../shared/ConcurrencyService';

// Mock dependencies
jest.mock('../../../utils/LoggerService');
jest.mock('../../../utils/ErrorHandlerService');
jest.mock('../../filesystem/FileSystemTraversal');
jest.mock('../../../database/qdrant/QdrantService');
jest.mock('../../../database/nebula/client/NebulaClient');
jest.mock('../../../database/ProjectIdManager');
jest.mock('../../../embedders/EmbedderFactory');
jest.mock('../../../embedders/EmbeddingCacheService');
jest.mock('../../../infrastructure/batching/PerformanceOptimizerService');
jest.mock('../../parser/processing/strategies/implementations/ASTCodeSplitter');
jest.mock('../../parser/ChunkToVectorCoordinationService');
jest.mock('../../graph/core/IGraphService');
jest.mock('../../graph/mapping/IGraphDataMappingService');
jest.mock('../../monitoring/PerformanceDashboard');
jest.mock('../../optimization/AutoOptimizationAdvisor');
jest.mock('../../optimization/BatchProcessingOptimizer');
jest.mock('../../parser/core/parse/TreeSitterService');
jest.mock('../../parser/core/query/TreeSitterQueryExecutor');
jest.mock('../../../config/ConfigService');
jest.mock('../../../database/nebula/NebulaProjectManager');

describe('IndexingLogicService', () => {
  let indexingLogicService: IndexingLogicService;
  let loggerService: LoggerService & jest.Mocked<LoggerService>;
  let errorHandlerService: ErrorHandlerService & jest.Mocked<ErrorHandlerService>;
  let fileSystemTraversal: jest.Mocked<FileSystemTraversal>;
  let qdrantService: jest.Mocked<QdrantService>;
  let nebulaService: jest.Mocked<NebulaClient>;
  let projectIdManager: jest.Mocked<ProjectIdManager>;
  let embedderFactory: jest.Mocked<EmbedderFactory>;
  let embeddingCacheService: jest.Mocked<EmbeddingCacheService>;
  let performanceOptimizerService: jest.Mocked<PerformanceOptimizerService>;
  let astSplitter: jest.Mocked<ASTCodeSplitter>;
  let coordinationService: jest.Mocked<ChunkToVectorCoordinationService>;
  let graphService: jest.Mocked<IGraphService>;
  let graphMappingService: jest.Mocked<IGraphDataMappingService>;
  let performanceDashboard: jest.Mocked<PerformanceDashboard>;
  let optimizationAdvisor: jest.Mocked<AutoOptimizationAdvisor>;
  let batchProcessingOptimizer: jest.Mocked<BatchProcessingOptimizer>;
  let nebulaProjectManager: jest.Mocked<INebulaProjectManager>;
  let treeSitterService: jest.Mocked<TreeSitterService>;
  let treeSitterQueryEngine: jest.Mocked<TreeSitterQueryEngine>;
  let testContainer: Container;

  beforeEach(() => {
    // Create a test container
    testContainer = new Container();

    // Bind ConfigService mock
    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'logging') {
          return { level: 'info' };
        }
        return undefined;
      })
    } as unknown as ConfigService;
    testContainer.bind<ConfigService>(TYPES.ConfigService).toConstantValue(mockConfigService);
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock instances
    loggerService = new LoggerService() as jest.Mocked<LoggerService>;
    errorHandlerService = new ErrorHandlerService(loggerService) as jest.Mocked<ErrorHandlerService>;
    fileSystemTraversal = new FileSystemTraversal(
      loggerService as unknown as LoggerService
    ) as jest.Mocked<FileSystemTraversal>;
    qdrantService = new QdrantService(
      {} as any,
      loggerService,
      errorHandlerService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    ) as jest.Mocked<QdrantService>;
    nebulaService = {
      insertNodes: jest.fn(),
      insertRelationships: jest.fn()
    } as any;
    projectIdManager = new ProjectIdManager(
      {} as any,
      {} as any,
      {} as any,
      loggerService,
      errorHandlerService,
      {} as any // Mock SqliteProjectManager
    ) as jest.Mocked<ProjectIdManager>;

    embedderFactory = new EmbedderFactory(
      loggerService,
      errorHandlerService,
      embeddingCacheService,
      testContainer.get<ConfigService>(TYPES.ConfigService)
    ) as jest.Mocked<EmbedderFactory>;
    embeddingCacheService = new EmbeddingCacheService(
      loggerService,
      errorHandlerService,
      {} as any
    ) as jest.Mocked<EmbeddingCacheService>;
    // 创建 IMemoryMonitorService 的模拟实现
    const mockMemoryMonitor: any = {
      getMemoryStatus: jest.fn().mockReturnValue({
        heapUsed: 100 * 1024 * 1024, // 100MB
        heapTotal: 500 * 1024 * 1024, // 500MB
        heapUsedPercent: 0.2,
        rss: 200 * 1024 * 1024, // 200MB
        external: 0,
        isWarning: false,
        isCritical: false,
        isEmergency: false,
        trend: 'stable',
        averageUsage: 150 * 1024 * 1024, // 150MB
        timestamp: new Date()
      }),
      forceGarbageCollection: jest.fn(),
      triggerCleanup: jest.fn(),
      isWithinLimit: jest.fn().mockReturnValue(true),
      setMemoryLimit: jest.fn(),
      getMemoryStats: jest.fn().mockReturnValue({
        current: {
          heapUsed: 100 * 1024 * 1024,
          heapTotal: 500 * 1024 * 1024,
          heapUsedPercent: 0.2,
          rss: 200 * 1024 * 1024,
          external: 0,
          isWarning: false,
          isCritical: false,
          isEmergency: false,
          trend: 'stable',
          averageUsage: 150 * 1024 * 1024,
          timestamp: new Date()
        }
      })
    };

    performanceOptimizerService = new PerformanceOptimizerService(
      loggerService,
      errorHandlerService,
      {} as any,
      mockMemoryMonitor,
    ) as jest.Mocked<PerformanceOptimizerService>;
    astSplitter = {} as jest.Mocked<ASTCodeSplitter>;
    coordinationService = {
      processFileForEmbedding: jest.fn(),
      setProjectEmbedder: jest.fn(),
    } as unknown as jest.Mocked<ChunkToVectorCoordinationService>;

    // Mock the missing dependencies
    graphService = {
      storeChunks: jest.fn()
    } as any;
    graphMappingService = {
      mapChunksToGraphNodes: jest.fn(),
      mapToGraph: jest.fn()
    } as any;
    performanceDashboard = {
      recordMetric: jest.fn().mockResolvedValue(undefined)
    } as any;
    optimizationAdvisor = {
      analyzeAndRecommend: jest.fn().mockResolvedValue(undefined)
    } as any;
    batchProcessingOptimizer = {
      executeOptimizedBatch: jest.fn().mockResolvedValue({
        results: [{
          success: true,
          nodesCreated: 1,
          relationshipsCreated: 1,
          nodesUpdated: 0,
          processingTime: 100,
          errors: []
        }],
        batchSize: 1,
        concurrency: 1,
        processingTime: 100,
        throughput: 10
      }),
      getCurrentParams: jest.fn().mockReturnValue({ batchSize: 50, concurrency: 3 }),
      setParams: jest.fn(),
      getPerformanceHistory: jest.fn().mockResolvedValue([]),
      getOptimizationRecommendations: jest.fn().mockResolvedValue([]),
      getPerformanceSummary: jest.fn().mockResolvedValue({
        currentParams: { batchSize: 50, concurrency: 3 },
        avgProcessingTime: 100,
        avgThroughput: 10,
        avgSuccessRate: 1,
        recommendations: []
      }),
      reset: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn().mockResolvedValue(undefined)
    } as any;
    nebulaProjectManager = {
      insertNodesForProject: jest.fn().mockResolvedValue(true),
      insertRelationshipsForProject: jest.fn().mockResolvedValue(true),
      createSpaceForProject: jest.fn().mockResolvedValue(true),
      deleteSpaceForProject: jest.fn().mockResolvedValue(true),
      getSpaceInfoForProject: jest.fn().mockResolvedValue(null),
      clearSpaceForProject: jest.fn().mockResolvedValue(true),
      listProjectSpaces: jest.fn().mockResolvedValue([]),
      findNodesForProject: jest.fn().mockResolvedValue([]),
      findRelationshipsForProject: jest.fn().mockResolvedValue([]),
      createProjectSpace: jest.fn().mockResolvedValue(true),
      deleteProjectSpace: jest.fn().mockResolvedValue(true),
      getProjectSpaceInfo: jest.fn().mockResolvedValue(null),
      clearProjectSpace: jest.fn().mockResolvedValue(true),
      insertProjectData: jest.fn().mockResolvedValue(true),
      updateProjectData: jest.fn().mockResolvedValue(true),
      deleteProjectData: jest.fn().mockResolvedValue(true),
      searchProjectData: jest.fn().mockResolvedValue([]),
      getProjectDataById: jest.fn().mockResolvedValue(null),
      subscribe: jest.fn()
    } as any;
    treeSitterService = {
      detectLanguage: jest.fn(),
      parseCode: jest.fn()
    } as any;
    treeSitterQueryEngine = {
      executeGraphQueries: jest.fn()
    } as any;
    const concurrencyService = {
      processWithConcurrency: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock fs methods
    jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue('test file content');
    jest.spyOn(require('fs/promises'), 'stat').mockResolvedValue({ size: 1024 } as any);

    // Bind all dependencies to test container
    testContainer.bind<LoggerService>(TYPES.LoggerService).toConstantValue(loggerService);
    testContainer.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).toConstantValue(errorHandlerService);
    testContainer.bind<FileSystemTraversal>(TYPES.FileSystemTraversal).toConstantValue(fileSystemTraversal);
    testContainer.bind<QdrantService>(TYPES.QdrantService).toConstantValue(qdrantService);
    testContainer.bind<NebulaClient>(TYPES.NebulaClient).toConstantValue(nebulaService);
    testContainer.bind<IGraphService>(TYPES.GraphService).toConstantValue(graphService);
    testContainer.bind<IGraphDataMappingService>(TYPES.GraphDataMappingService).toConstantValue(graphMappingService);
    testContainer.bind<PerformanceDashboard>(TYPES.PerformanceDashboard).toConstantValue(performanceDashboard);
    testContainer.bind<AutoOptimizationAdvisor>(TYPES.AutoOptimizationAdvisor).toConstantValue(optimizationAdvisor);
    testContainer.bind<BatchProcessingOptimizer>(TYPES.BatchProcessingOptimizer).toConstantValue(batchProcessingOptimizer);
    testContainer.bind<INebulaProjectManager>(TYPES.INebulaProjectManager).toConstantValue(nebulaProjectManager);
    testContainer.bind<TreeSitterService>(TYPES.TreeSitterService).toConstantValue(treeSitterService);
    testContainer.bind<TreeSitterQueryEngine>(TYPES.TreeSitterQueryEngine).toConstantValue(treeSitterQueryEngine);
    testContainer.bind<ProjectIdManager>(TYPES.ProjectIdManager).toConstantValue(projectIdManager);
    testContainer.bind<EmbedderFactory>(TYPES.EmbedderFactory).toConstantValue(embedderFactory);
    testContainer.bind<EmbeddingCacheService>(TYPES.EmbeddingCacheService).toConstantValue(embeddingCacheService);
    testContainer.bind<PerformanceOptimizerService>(TYPES.PerformanceOptimizerService).toConstantValue(performanceOptimizerService);
    testContainer.bind<ASTCodeSplitter>(TYPES.ASTCodeSplitter).toConstantValue(astSplitter);
    testContainer.bind<ChunkToVectorCoordinationService>(TYPES.ChunkToVectorCoordinationService).toConstantValue(coordinationService);
    testContainer.bind<ConcurrencyService>(TYPES.ConcurrencyService).toConstantValue(concurrencyService);

    // Bind IndexingLogicService itself
    testContainer.bind<IndexingLogicService>(TYPES.IndexingLogicService).to(IndexingLogicService).inSingletonScope();

    // Create service instance using dependency injection
    indexingLogicService = testContainer.get<IndexingLogicService>(TYPES.IndexingLogicService);
  });

  describe('indexProject', () => {
    it('should index a project successfully', async () => {
      const projectPath = '/test/project';
      const files: FileInfo[] = [
        {
          path: '/test/project/file1.js',
          relativePath: 'file1.js',
          name: 'file1.js',
          extension: '.js',
          size: 1024,
          hash: 'abc123',
          lastModified: new Date(),
          language: 'javascript',
          isBinary: false
        },
        {
          path: '/test/project/file2.js',
          relativePath: 'file2.js',
          name: 'file2.js',
          extension: '.js',
          size: 2048,
          hash: 'def456',
          lastModified: new Date(),
          language: 'javascript',
          isBinary: false
        }
      ];

      // Mock dependencies
      fileSystemTraversal.traverseDirectory.mockResolvedValue({ files, errors: [], directories: [], totalSize: 3072, processingTime: 100 });
      performanceOptimizerService.executeWithRetry.mockImplementation(async (fn) => {
        return await fn();
      });
      performanceOptimizerService.getCurrentBatchSize.mockReturnValue(10);
      performanceOptimizerService.processBatches.mockImplementation(async (items, processor) => {
        await processor([files[0]]);
        await processor([files[1]]);
        return [];
      });
      coordinationService.processFileForEmbedding.mockResolvedValue([
        {
          id: 'chunk1',
          vector: [0.1, 0.2],
          payload: {
            content: 'test content',
            filePath: 'file1.js',
            language: 'javascript',
            chunkType: ['code'],
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date()
          }
        }
      ]);
      qdrantService.upsertVectorsForProject.mockResolvedValue(true);

      // Call the method
      await indexingLogicService.indexProject(projectPath);

      // Verify results
      expect(fileSystemTraversal.traverseDirectory).toHaveBeenCalledWith(projectPath, {
        includePatterns: undefined,
        excludePatterns: undefined
      });
      expect(coordinationService.processFileForEmbedding).toHaveBeenCalledTimes(2);
      expect(qdrantService.upsertVectorsForProject).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during project indexing', async () => {
      const projectPath = '/test/project';
      const error = new Error('Traversal failed');

      // Mock dependencies to throw error
      fileSystemTraversal.traverseDirectory.mockRejectedValue(error);
      performanceOptimizerService.executeWithRetry.mockImplementation(async (fn) => {
        // When the underlying function throws an error, executeWithRetry should also throw
        try {
          await fn();
        } catch (e) {
          throw e;
        }
      });
      errorHandlerService.handleError = jest.fn();

      // Call the method and expect error
      await expect(indexingLogicService.indexProject(projectPath)).rejects.toThrow('Traversal failed');

      // Verify error handling
      expect(errorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('getEmbedderDimensions', () => {
    it('should return embedder dimensions successfully', async () => {
      const embedderProvider = 'openai';
      const providerInfo = { name: 'OpenAI Embeddings', model: 'text-embedding-ada-002', dimensions: 1536, available: true };

      // Mock dependencies
      embedderFactory.getProviderInfo.mockResolvedValue(providerInfo);

      // Call the method
      const dimensions = await indexingLogicService.getEmbedderDimensions(embedderProvider);

      // Verify results
      expect(dimensions).toBe(1536);
      expect(embedderFactory.getProviderInfo).toHaveBeenCalledWith(embedderProvider);
    });

    it('should fallback to environment variables when provider info fails', async () => {
      const embedderProvider = 'openai';
      const error = new Error('Provider not found');

      // Mock dependencies to throw error
      embedderFactory.getProviderInfo.mockRejectedValue(error);

      // Mock environment variable
      process.env.OPENAI_DIMENSIONS = '1536';

      // Call the method
      const dimensions = await indexingLogicService.getEmbedderDimensions(embedderProvider);

      // Verify results
      expect(dimensions).toBe(1536);
      expect(embedderFactory.getProviderInfo).toHaveBeenCalledWith(embedderProvider);
      expect(loggerService.warn).toHaveBeenCalled();
    });

    it('should use default dimensions when no environment variables are set', async () => {
      const embedderProvider = 'unknown';
      const error = new Error('Provider not found');

      // Mock dependencies to throw error
      embedderFactory.getProviderInfo.mockRejectedValue(error);

      // Clear environment variables
      delete process.env.OPENAI_DIMENSIONS;
      delete process.env.OLLAMA_DIMENSIONS;
      delete process.env.GEMINI_DIMENSIONS;
      delete process.env.MISTRAL_DIMENSIONS;
      delete process.env.SILICONFLOW_DIMENSIONS;

      // Call the method
      const dimensions = await indexingLogicService.getEmbedderDimensions(embedderProvider);

      // Verify results
      expect(dimensions).toBe(1024); // Default value
      expect(embedderFactory.getProviderInfo).toHaveBeenCalledWith(embedderProvider);
      expect(loggerService.warn).toHaveBeenCalled();
    });
  });

  describe('indexFile', () => {
    it('should index a file successfully', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const vectorPoints: VectorPoint[] = [
        {
          id: 'chunk1',
          vector: [0.1, 0.2],
          payload: {
            content: 'test content',
            filePath: 'file.js',
            language: 'javascript',
            chunkType: ['code'],
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date()
          }
        }
      ];

      // Mock dependencies
      coordinationService.processFileForEmbedding.mockResolvedValue(vectorPoints);
      qdrantService.upsertVectorsForProject.mockResolvedValue(true);
      jest.spyOn(require('fs/promises'), 'stat').mockResolvedValue({ size: 1024 } as any);

      // Call the method
      await indexingLogicService.indexFile(projectPath, filePath);

      // Verify results
      expect(coordinationService.processFileForEmbedding).toHaveBeenCalledWith(filePath, projectPath);
      expect(qdrantService.upsertVectorsForProject).toHaveBeenCalledWith(projectPath, vectorPoints);
      expect(loggerService.debug).toHaveBeenCalled();
    });

    it('should handle errors during file indexing', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const error = new Error('Indexing failed');

      // Mock dependencies to throw error
      coordinationService.processFileForEmbedding.mockRejectedValue(error);
      errorHandlerService.handleError = jest.fn();

      // Call the method and expect error
      await expect(indexingLogicService.indexFile(projectPath, filePath)).rejects.toThrow(error);

      // Verify error handling
      expect(errorHandlerService.handleError).toHaveBeenCalled();
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('removeFileFromIndex', () => {
    it('should remove file from index successfully', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const projectId = 'test-project-id';
      const collectionName = 'project-test-project-id';
      const chunkIds = ['chunk1', 'chunk2'];

      // Mock dependencies
      projectIdManager.getProjectId.mockReturnValue(projectId);
      projectIdManager.getCollectionName.mockReturnValue(collectionName);
      qdrantService.getChunkIdsByFiles.mockResolvedValue(chunkIds);
      qdrantService.deletePoints.mockResolvedValue(true);

      // Call the method
      await indexingLogicService.removeFileFromIndex(projectPath, filePath);

      // Verify results
      expect(projectIdManager.getProjectId).toHaveBeenCalledWith(projectPath);
      expect(projectIdManager.getCollectionName).toHaveBeenCalledWith(projectId);
      expect(qdrantService.getChunkIdsByFiles).toHaveBeenCalledWith(collectionName, [filePath]);
      expect(qdrantService.deletePoints).toHaveBeenCalledWith(collectionName, chunkIds);
      expect(loggerService.debug).toHaveBeenCalled();
    });

    it('should handle errors when removing file from index', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const error = new Error('Removal failed');

      // Mock dependencies to throw error
      projectIdManager.getProjectId.mockImplementation(() => {
        throw error;
      });
      errorHandlerService.handleError = jest.fn();

      // Call the method and expect error
      await expect(indexingLogicService.removeFileFromIndex(projectPath, filePath)).rejects.toThrow(error);

      // Verify error handling
      expect(errorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('storeFileToGraph', () => {
    it('should store file to graph database successfully', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const fileContent = 'console.log("test");';
      const chunks: CodeChunk[] = [
        {
          id: 'chunk1',
          content: 'console.log("test");',
          startLine: 1,
          endLine: 1,
          language: 'javascript',
          type: 'statement',
          metadata: {} as any
        } as any
      ];

      const mappedNodes = [{ id: 'node1', type: 'statement', properties: {} }] as any;
      const mappedRelationships = [{ id: 'rel1', type: 'contains', sourceNodeId: 'file1', targetNodeId: 'node1', properties: {} }] as any;
      const graphPersistenceResult = {
        success: true,
        nodesCreated: 1,
        relationshipsCreated: 1,
        nodesUpdated: 0,
        processingTime: 100,
        errors: []
      };

      // Mock dependencies
      graphMappingService.mapChunksToGraphNodes.mockResolvedValue({ nodes: mappedNodes, relationships: mappedRelationships, stats: {} } as any);
      projectIdManager.getProjectId.mockReturnValue('test-project-id');
      projectIdManager.getSpaceName.mockReturnValue('test_space');
      graphService.storeChunks.mockResolvedValue(graphPersistenceResult);
      performanceDashboard.recordMetric = jest.fn().mockResolvedValue(undefined);

      // Call private method via reflection
      const result = await (indexingLogicService as any).storeFileToGraph(projectPath, filePath, fileContent, chunks);

      // Verify results
      expect(graphMappingService.mapChunksToGraphNodes).toHaveBeenCalledWith(chunks, expect.any(String));
      expect(batchProcessingOptimizer.executeOptimizedBatch).toHaveBeenCalledWith(
        [{ nodes: mappedNodes, relationships: mappedRelationships }],
        expect.any(Function),
        {
          strategy: 'balanced',
          maxLatency: 5000
        }
      );
      expect(result).toEqual(graphPersistenceResult);
      expect(performanceDashboard.recordMetric).toHaveBeenCalledTimes(1);
    });

    it('should handle errors during graph storage', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const fileContent = 'console.log("test");';
      const chunks: CodeChunk[] = [];

      const error = new Error('Graph storage failed');
      graphMappingService.mapChunksToGraphNodes.mockRejectedValue(error);
      performanceDashboard.recordMetric = jest.fn().mockResolvedValue(undefined);

      // Call private method and expect error
      await expect((indexingLogicService as any).storeFileToGraph(projectPath, filePath, fileContent, chunks)).rejects.toThrow(error);

      // Verify error metrics
      expect(performanceDashboard.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({ metricName: 'graph.store_error' })
      );
    });
  });

  describe('indexFileToGraph', () => {
    it('should index file to graph database successfully', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const fileContent = 'function test() { return true; }';

      const language = { name: 'javascript', fileExtensions: ['.js'], supported: true } as any;
      const parseResult = { ast: {}, language: 'javascript', parseTime: 10, success: true } as any;
      const queryResults = new Map([['func1', { type: 'function', properties: { name: 'test' } }]]) as any;
      const graphElements = {
        nodes: [{ id: 'func1', type: 'function', properties: { name: 'test' } }],
        edges: [{ id: 'edge1', type: 'defines', sourceNodeId: 'file1', targetNodeId: 'func1', properties: {} }]
      } as any;
      const nebulaNodes: NebulaNode[] = [{ id: 'func1', label: 'function', properties: { name: 'test' } }];
      const nebulaRelationships: NebulaRelationship[] = [{ id: 'edge1', type: 'defines', sourceId: 'file1', targetId: 'func1', properties: {} }];

      // Mock dependencies
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue(fileContent);
      treeSitterService.detectLanguage.mockResolvedValue(language);
      treeSitterService.parseCode.mockResolvedValue(parseResult);
      treeSitterQueryEngine.executeGraphQueries.mockResolvedValue(queryResults);
      graphMappingService.mapToGraph.mockResolvedValue(graphElements);
      (indexingLogicService as any).convertToNebulaNodes = jest.fn().mockReturnValue(nebulaNodes);
      (indexingLogicService as any).convertToNebulaRelationships = jest.fn().mockReturnValue(nebulaRelationships);

      // Call the method
      await indexingLogicService.indexFileToGraph(projectPath, filePath);

      // Verify results
      expect(treeSitterService.detectLanguage).toHaveBeenCalledWith(filePath);
      expect(treeSitterService.parseCode).toHaveBeenCalledWith(fileContent, 'javascript');
      expect(treeSitterQueryEngine.executeGraphQueries).toHaveBeenCalledWith(parseResult.ast, 'javascript');
      expect(graphMappingService.mapToGraph).toHaveBeenCalledWith(filePath, expect.any(Array));
      expect(nebulaProjectManager.insertNodesForProject).toHaveBeenCalledWith(projectPath, nebulaNodes);
      expect(nebulaProjectManager.insertRelationshipsForProject).toHaveBeenCalledWith(projectPath, nebulaRelationships);
      expect(loggerService.info).toHaveBeenCalled();
    });

    it('should skip unsupported languages', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.unknown';

      // Mock dependencies
      treeSitterService.detectLanguage.mockResolvedValue(null);

      // Call the method
      await indexingLogicService.indexFileToGraph(projectPath, filePath);

      // Verify that unsupported language is logged as warning
      expect(loggerService.warn).toHaveBeenCalledWith(`Unsupported language for file: ${filePath}`);
      expect(treeSitterService.parseCode).not.toHaveBeenCalled();
    });

    it('should handle errors during graph indexing', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';

      const error = new Error('Indexing failed');
      jest.spyOn(require('fs/promises'), 'readFile').mockRejectedValue(error);

      // Call the method and expect error
      await expect(indexingLogicService.indexFileToGraph(projectPath, filePath)).rejects.toThrow(error);
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('convertToNebulaNodes', () => {
    it('should convert nodes to Nebula format', () => {
      const nodes = [
        { id: 'node1', type: 'function', properties: { name: 'test' } },
        { id: 'node2', type: 'class', properties: { name: 'MyClass' } }
      ];

      const result = (indexingLogicService as any).convertToNebulaNodes(nodes);

      expect(result).toEqual([
        { id: 'node1', label: 'function', properties: { name: 'test' } },
        { id: 'node2', label: 'class', properties: { name: 'MyClass' } }
      ]);
    });
  });

  describe('convertToNebulaRelationships', () => {
    it('should convert relationships to Nebula format', () => {
      const edges = [
        { id: 'edge1', type: 'calls', sourceNodeId: 'func1', targetNodeId: 'func2', properties: { line: 5 } },
        { id: 'edge2', type: 'inherits', sourceNodeId: 'class1', targetNodeId: 'class2', properties: {} }
      ];

      const result = (indexingLogicService as any).convertToNebulaRelationships(edges);

      expect(result).toEqual([
        { id: 'edge1', type: 'calls', sourceId: 'func1', targetId: 'func2', properties: { line: 5 } },
        { id: 'edge2', type: 'inherits', sourceId: 'class1', targetId: 'class2', properties: {} }
      ]);
    });
  });

  describe('indexFile with graph integration', () => {
    it('should index file with graph database when NEBULA_ENABLED is true', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const vectorPoints: VectorPoint[] = [
        {
          id: 'chunk1',
          vector: [0.1, 0.2],
          payload: {
            content: 'test content',
            filePath: 'file.js',
            language: 'javascript',
            chunkType: ['code'],
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date()
          }
        }
      ];

      // Mock environment variable
      process.env.NEBULA_ENABLED = 'true';

      // Mock dependencies
      coordinationService.processFileForEmbedding.mockResolvedValue(vectorPoints);
      qdrantService.upsertVectorsForProject.mockResolvedValue(true);
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue('test content');
      jest.spyOn(require('fs/promises'), 'stat').mockResolvedValue({ size: 1024 } as any);
      (indexingLogicService as any).storeFileToGraph = jest.fn().mockResolvedValue({
        success: true,
        nodesCreated: 1,
        relationshipsCreated: 1,
        processingTime: 50
      });

      // Call the method
      await indexingLogicService.indexFile(projectPath, filePath);

      // Verify graph storage was called
      expect((indexingLogicService as any).storeFileToGraph).toHaveBeenCalledWith(projectPath, filePath, 'test content', []);
    });

    it('should skip graph database when NEBULA_ENABLED is false', async () => {
      const projectPath = '/test/project';
      const filePath = '/test/project/file.js';
      const vectorPoints: VectorPoint[] = [
        {
          id: 'chunk1',
          vector: [0.1, 0.2],
          payload: {
            content: 'test content',
            filePath: 'file.js',
            language: 'javascript',
            chunkType: ['code'],
            startLine: 1,
            endLine: 10,
            metadata: {},
            timestamp: new Date()
          }
        }
      ];

      // Mock environment variable
      process.env.NEBULA_ENABLED = 'false';

      // Mock dependencies
      coordinationService.processFileForEmbedding.mockResolvedValue(vectorPoints);
      qdrantService.upsertVectorsForProject.mockResolvedValue(true);
      jest.spyOn(require('fs/promises'), 'readFile').mockResolvedValue('test content');
      jest.spyOn(require('fs/promises'), 'stat').mockResolvedValue({ size: 1024 } as any);
      (indexingLogicService as any).storeFileToGraph = jest.fn();

      // Call the method
      await indexingLogicService.indexFile(projectPath, filePath);

      // Verify graph storage was not called
      expect((indexingLogicService as any).storeFileToGraph).not.toHaveBeenCalled();
      expect(loggerService.debug).toHaveBeenCalledWith(
        'Nebula graph database is disabled via NEBULA_ENABLED environment variable, skipping graph storage for file',
        { filePath, projectPath }
      );
    });
  });
});