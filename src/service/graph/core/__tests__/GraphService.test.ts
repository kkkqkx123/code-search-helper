import { GraphService } from '../GraphService';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../../config/ConfigService';
import { NebulaSpaceManager } from '../../../../database/nebula/space/NebulaSpaceManager';
import { ICacheService } from '../../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../../infrastructure/monitoring/types';
import { IGraphRepository } from '../../repository/IGraphRepository';

describe('GraphService', () => {
  let graphService: GraphService;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockErrorHandler: jest.Mocked<ErrorHandlerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockRepository: jest.Mocked<IGraphRepository>;
  let mockSpaceManager: jest.Mocked<NebulaSpaceManager>;
  let mockCacheService: jest.Mocked<ICacheService>;
  let mockPerformanceMonitor: jest.Mocked<IPerformanceMonitor>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    mockErrorHandler = {
      handleError: jest.fn()
    } as any;

    mockConfigService = {} as any;

    mockRepository = {
      executeQuery: jest.fn(),
      executeBatchQuery: jest.fn(),
      createNode: jest.fn(),
      createNodes: jest.fn(),
      createRelationship: jest.fn(),
      createRelationships: jest.fn(),
      deleteNode: jest.fn(),
      getGraphStats: jest.fn(),
      findRelatedNodes: jest.fn(),
      findPath: jest.fn()
    } as any;

    mockSpaceManager = {
      createSpace: jest.fn(),
      deleteSpace: jest.fn(),
      checkSpaceExists: jest.fn(),
      clearSpace: jest.fn(),
      getSpaceInfo: jest.fn()
    } as any;

    mockCacheService = {
      getFromCache: jest.fn(),
      setCache: jest.fn(),
      getCacheStats: jest.fn()
    } as any;

    mockPerformanceMonitor = {
      startPeriodicMonitoring: jest.fn(),
      stopPeriodicMonitoring: jest.fn(),
      recordQueryExecution: jest.fn(),
      updateCacheHitRate: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({})
    } as any;

    graphService = new GraphService(
      mockLogger,
      mockErrorHandler,
      mockConfigService,
      mockRepository,
      mockSpaceManager,
      mockCacheService,
      mockPerformanceMonitor
    );
  });

  describe('initialize', () => {
    it('should initialize successfully when NEBULA_ENABLED is true', async () => {
      process.env.NEBULA_ENABLED = 'true';
      const result = await graphService.initialize();
      
      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing graph service');
      expect(mockPerformanceMonitor.startPeriodicMonitoring).toHaveBeenCalled();
    });

    it('should skip initialization when NEBULA_ENABLED is false', async () => {
      process.env.NEBULA_ENABLED = 'false';
      const result = await graphService.initialize();
      
      expect(result).toBe(true);
      expect(mockPerformanceMonitor.startPeriodicMonitoring).not.toHaveBeenCalled();
    });
  });

  describe('executeReadQuery', () => {
    it('should return cached result if available', async () => {
      const query = 'MATCH (n) RETURN n';
      const cachedData = { data: [{ n: 'test' }] };
      mockCacheService.getFromCache.mockReturnValue(cachedData);

      const result = await graphService.executeReadQuery(query);

      expect(result).toEqual(cachedData);
      expect(mockRepository.executeQuery).not.toHaveBeenCalled();
      expect(mockPerformanceMonitor.updateCacheHitRate).toHaveBeenCalledWith(true);
    });

    it('should execute query and cache result when not cached', async () => {
      const query = 'MATCH (n) RETURN n';
      const queryResult = { data: [{ n: 'test' }] };
      mockCacheService.getFromCache.mockReturnValue(null);
      mockRepository.executeQuery.mockResolvedValue(queryResult);

      const result = await graphService.executeReadQuery(query);

      expect(result).toEqual(queryResult);
      expect(mockRepository.executeQuery).toHaveBeenCalledWith(query, {});
      expect(mockCacheService.setCache).toHaveBeenCalled();
      expect(mockPerformanceMonitor.updateCacheHitRate).toHaveBeenCalledWith(false);
    });
  });

  describe('executeWriteQuery', () => {
    it('should execute write query successfully', async () => {
      const query = 'INSERT VERTEX File(name) VALUES "test.ts":("test.ts")';
      const result = { success: true };
      mockRepository.executeQuery.mockResolvedValue(result);

      const queryResult = await graphService.executeWriteQuery(query);

      expect(queryResult).toEqual(result);
      expect(mockRepository.executeQuery).toHaveBeenCalledWith(query, {});
      expect(mockPerformanceMonitor.recordQueryExecution).toHaveBeenCalled();
    });
  });

  describe('executeBatch', () => {
    it('should execute batch queries successfully', async () => {
      const queries = [
        { nGQL: 'INSERT VERTEX File(name) VALUES "a.ts":("a.ts")' },
        { nGQL: 'INSERT VERTEX File(name) VALUES "b.ts":("b.ts")' }
      ];
      mockRepository.executeBatchQuery.mockResolvedValue([{}, {}]);

      const result = await graphService.executeBatch(queries);

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(2);
      expect(mockRepository.executeBatchQuery).toHaveBeenCalled();
    });
  });

  describe('space operations', () => {
    it('should use space successfully', async () => {
      const spaceName = 'test_project';
      mockRepository.executeQuery.mockResolvedValue({});

      await graphService.useSpace(spaceName);

      expect(mockRepository.executeQuery).toHaveBeenCalledWith(`USE \`${spaceName}\``, {});
      expect(graphService.getCurrentSpace()).toBe(spaceName);
    });

    it('should create space successfully', async () => {
      const spaceName = 'test_project';
      mockSpaceManager.createSpace.mockResolvedValue(true);

      const result = await graphService.createSpace(spaceName);

      expect(result).toBe(true);
      expect(mockSpaceManager.createSpace).toHaveBeenCalledWith(spaceName, undefined);
    });

    it('should delete space successfully', async () => {
      const spaceName = 'test_project';
      mockSpaceManager.deleteSpace.mockResolvedValue(true);

      const result = await graphService.deleteSpace(spaceName);

      expect(result).toBe(true);
      expect(mockSpaceManager.deleteSpace).toHaveBeenCalledWith(spaceName);
    });
  });

  describe('batch operations', () => {
    it('should batch insert nodes successfully', async () => {
      const nodes = [
        { id: 'node1', label: 'File', properties: { name: 'test.ts' } },
        { id: 'node2', label: 'File', properties: { name: 'test2.ts' } }
      ];
      const projectId = 'test_project';
      mockRepository.executeQuery.mockResolvedValue({});
      mockRepository.createNodes.mockResolvedValue(['node1', 'node2']);

      const result = await graphService.batchInsertNodes(nodes, projectId);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(2);
      expect(mockRepository.createNodes).toHaveBeenCalled();
    });

    it('should batch insert edges successfully', async () => {
      const edges = [
        { type: 'IMPORTS', sourceId: 'node1', targetId: 'node2', properties: {} }
      ];
      const projectId = 'test_project';
      mockRepository.executeQuery.mockResolvedValue({});
      mockRepository.createRelationships.mockResolvedValue(undefined);

      const result = await graphService.batchInsertEdges(edges, projectId);

      expect(result.success).toBe(true);
      expect(result.insertedCount).toBe(1);
      expect(mockRepository.createRelationships).toHaveBeenCalled();
    });
  });

  describe('getDatabaseStats', () => {
    it('should return database statistics', async () => {
      const stats = { nodeCount: 100, relationshipCount: 200 };
      mockRepository.getGraphStats.mockResolvedValue(stats);

      const result = await graphService.getDatabaseStats();

      expect(result.nodeCount).toBe(100);
      expect(result.relationshipCount).toBe(200);
      expect(result.currentSpace).toBeNull();
      expect(mockRepository.getGraphStats).toHaveBeenCalled();
    });
  });

  describe('analysis methods', () => {
    it('should analyze dependencies', async () => {
      const filePath = 'src/test.ts';
      const projectId = 'test_project';
      mockRepository.executeQuery.mockResolvedValue({ data: [] });

      await graphService.analyzeDependencies(filePath, projectId);

      expect(mockRepository.executeQuery).toHaveBeenCalled();
    });

    it('should find related nodes', async () => {
      const nodeId = 'node1';
      mockRepository.findRelatedNodes.mockResolvedValue([]);

      await graphService.findRelatedNodes(nodeId);

      expect(mockRepository.findRelatedNodes).toHaveBeenCalledWith(nodeId, { edgeTypes: undefined, maxDepth: undefined });
    });

    it('should find path between nodes', async () => {
      const sourceId = 'node1';
      const targetId = 'node2';
      mockRepository.findPath.mockResolvedValue([]);

      await graphService.findPath(sourceId, targetId);

      expect(mockRepository.findPath).toHaveBeenCalledWith(sourceId, targetId, undefined);
    });
  });

  describe('close', () => {
    it('should stop monitoring on close', async () => {
      await graphService.close();

      expect(mockPerformanceMonitor.stopPeriodicMonitoring).toHaveBeenCalled();
    });
  });
});