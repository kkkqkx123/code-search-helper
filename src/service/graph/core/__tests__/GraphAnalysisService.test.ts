import { GraphAnalysisService } from '../GraphAnalysisService';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../../config/ConfigService';
import { GraphDatabaseService } from '../../../../database/graph/GraphDatabaseService';
import { GraphQueryBuilder } from '../../../../database/nebula/query/GraphQueryBuilder';
import { ICacheService } from '../../../../infrastructure/caching/types';
import { IPerformanceMonitor } from '../../../../infrastructure/monitoring/types';
import { GraphAnalysisOptions, GraphAnalysisResult, CodeGraphRelationship } from '../types';

// Mock dependencies
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const mockErrorHandler = {
  handleError: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue({ defaultTTL: 300 }),
};

const mockGraphDatabase = {
  isDatabaseConnected: jest.fn().mockReturnValue(true),
  initialize: jest.fn().mockResolvedValue(true),
  executeReadQuery: jest.fn().mockResolvedValue({ data: [] }),
  executeWriteQuery: jest.fn(),
  close: jest.fn(),
  useSpace: jest.fn(),
  deleteSpace: jest.fn(),
  spaceExists: jest.fn(),
  getCurrentSpace: jest.fn(),
};

const mockQueryBuilder = {
  buildCodeAnalysisQuery: jest.fn().mockReturnValue({
    nGQL: 'MATCH (n) RETURN n',
    parameters: {},
  }),
  buildDependencyQuery: jest.fn().mockReturnValue({
    nGQL: 'MATCH ()-[r]->() RETURN r',
    parameters: {},
  }),
  buildNodeCountQuery: jest.fn().mockReturnValue({
    nGQL: 'MATCH (n:File) RETURN count(n) as total',
    parameters: {},
  }),
};

const mockCacheService = {
  getFromCache: jest.fn(),
  setCache: jest.fn(),
  clearCache: jest.fn(),
};

const mockPerformanceMonitor = {
  updateCacheHitRate: jest.fn(),
  recordQueryExecution: jest.fn(),
};

describe('GraphAnalysisService', () => {
  let service: GraphAnalysisService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create service instance with mocked dependencies
    service = new GraphAnalysisService(
      mockLogger as any,
      mockErrorHandler as any,
      mockConfigService as any,
      mockGraphDatabase as any,
      mockQueryBuilder as any,
      mockCacheService as any,
      mockPerformanceMonitor as any
    );
  });

  describe('initialize', () => {
    it('should initialize successfully when database initializes', async () => {
      mockGraphDatabase.isDatabaseConnected.mockReturnValue(false);
      mockGraphDatabase.initialize.mockResolvedValue(true);

      const result = await service.initialize();

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing graph analysis service');
      expect(mockGraphDatabase.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Graph analysis service initialized successfully');
    });

    it('should return false when database initialization fails', async () => {
      mockGraphDatabase.isDatabaseConnected.mockReturnValue(false);
      mockGraphDatabase.initialize.mockResolvedValue(false);

      const result = await service.initialize();

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    it('should not initialize database if already connected', async () => {
      mockGraphDatabase.isDatabaseConnected.mockReturnValue(true);

      const result = await service.initialize();

      expect(result).toBe(true);
      expect(mockGraphDatabase.initialize).not.toHaveBeenCalled();
    });
  });

  describe('analyzeCodebase', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return cached result if available', async () => {
      const cachedResult = {
        result: { nodes: [], edges: [], metrics: { totalNodes: 0, totalEdges: 0, averageDegree: 0, maxDepth: 3, componentCount: 0 }, summary: { projectFiles: 0, functions: 0, classes: 0, imports: 0, externalDependencies: 0 } },
        formattedResult: {},
      };
      mockCacheService.getFromCache.mockReturnValue(cachedResult);

      const result = await service.analyzeCodebase('/test/path');

      expect(result).toBe(cachedResult);
      expect(mockCacheService.getFromCache).toHaveBeenCalled();
      expect(mockPerformanceMonitor.updateCacheHitRate).toHaveBeenCalledWith(true);
      expect(mockGraphDatabase.executeReadQuery).not.toHaveBeenCalled();
    });

    it('should analyze codebase when no cache is available', async () => {
      mockCacheService.getFromCache.mockReturnValue(null);
      mockGraphDatabase.executeReadQuery.mockResolvedValue({
        data: [
          { node: { id: '1', name: 'test.ts', properties: {} } },
          { edgeProps: { id: 'e1', src: '1', dst: '2', type: 'IMPORTS', properties: {} } }
        ]
      });

      const result = await service.analyzeCodebase('/test/path');

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('formattedResult');
      expect(mockQueryBuilder.buildCodeAnalysisQuery).toHaveBeenCalledWith('/test/path', {});
      expect(mockGraphDatabase.executeReadQuery).toHaveBeenCalled();
      expect(mockCacheService.setCache).toHaveBeenCalled();
      expect(mockPerformanceMonitor.updateCacheHitRate).toHaveBeenCalledWith(false);
      expect(mockPerformanceMonitor.recordQueryExecution).toHaveBeenCalled();
    });

    it('should handle errors during analysis', async () => {
      mockCacheService.getFromCache.mockReturnValue(null);
      mockGraphDatabase.executeReadQuery.mockRejectedValue(new Error('Database error'));

      await expect(service.analyzeCodebase('/test/path')).rejects.toThrow('Database error');
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordQueryExecution).toHaveBeenCalled();
    });
  });

  describe('findDependencies', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should find dependencies successfully', async () => {
      mockGraphDatabase.executeReadQuery.mockResolvedValue({
        data: [
          { edgeProps: { id: 'e1', src: 'file1', dst: 'file2', type: 'IMPORTS', properties: {} } }
        ]
      });

      const result = await service.findDependencies('test.ts');

      expect(result).toHaveProperty('direct');
      expect(result).toHaveProperty('transitive');
      expect(result).toHaveProperty('summary');
      expect(mockQueryBuilder.buildDependencyQuery).toHaveBeenCalled();
      expect(mockGraphDatabase.executeReadQuery).toHaveBeenCalled();
    });

    it('should handle errors during dependency analysis', async () => {
      mockGraphDatabase.executeReadQuery.mockRejectedValue(new Error('Query error'));

      await expect(service.findDependencies('test.ts')).rejects.toThrow('Query error');
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('findImpact', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should find impact successfully', async () => {
      mockGraphDatabase.executeReadQuery.mockResolvedValue({
        data: [
          { affectedNode: { tag: 'File', properties: { path: 'affected.ts' } } },
          { affectedNode: { tag: 'Function', properties: { name: 'func' } } }
        ]
      });

      const result = await service.findImpact('test.ts');

      expect(result).toHaveProperty('affectedFiles');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('impactScore');
      expect(result).toHaveProperty('affectedComponents');
      expect(mockGraphDatabase.executeReadQuery).toHaveBeenCalled();
    });

    it('should return default values when no data', async () => {
      mockGraphDatabase.executeReadQuery.mockResolvedValue({ data: null });

      const result = await service.findImpact('test.ts');

      expect(result.affectedFiles).toEqual([]);
      expect(result.riskLevel).toBe('low');
      expect(result.impactScore).toBe(0);
      expect(result.affectedComponents).toEqual([]);
    });
  });

  describe('getGraphStats', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should get graph statistics successfully', async () => {
      mockGraphDatabase.executeReadQuery
        .mockResolvedValueOnce({ data: [{ total: 10 }] })
        .mockResolvedValueOnce({ data: [{ total: 5 }] })
        .mockResolvedValueOnce({ data: [{ total: 3 }] })
        .mockResolvedValueOnce({ data: [{ total: 2 }] });

      const result = await service.getGraphStats('/test/path');

      expect(result).toHaveProperty('totalFiles', 10);
      expect(result).toHaveProperty('totalFunctions', 5);
      expect(result).toHaveProperty('totalClasses', 3);
      expect(result).toHaveProperty('totalImports', 2);
      expect(result).toHaveProperty('complexityScore');
      expect(result).toHaveProperty('maintainabilityIndex');
      expect(mockQueryBuilder.buildNodeCountQuery).toHaveBeenCalledTimes(4);
    });
  });

  describe('exportGraph', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should export graph as JSON', async () => {
      mockGraphDatabase.executeReadQuery
        .mockResolvedValueOnce({
          data: [{ n: { id: '1', tag: 'File', properties: { name: 'test.ts' } } }]
        })
        .mockResolvedValueOnce({
          data: [{ e: { id: 'e1', src: '1', dst: '2', type: 'IMPORTS', properties: {} } }]
        });

      const result = await service.exportGraph('/test/path', 'json');

      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed).toHaveProperty('nodes');
      expect(parsed).toHaveProperty('edges');
      expect(parsed).toHaveProperty('metadata');
    });

    it('should export graph as DOT', async () => {
      mockGraphDatabase.executeReadQuery
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] });

      const result = await service.exportGraph('/test/path', 'dot');

      expect(typeof result).toBe('string');
      expect(result).toContain('digraph G');
    });

    it('should throw error for unsupported format', async () => {
      await expect(service.exportGraph('/test/path', 'unsupported' as any)).rejects.toThrow('Unsupported export format');
    });
  });

  describe('isServiceInitialized', () => {
    it('should return false before initialization', () => {
      expect(service.isServiceInitialized()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await service.initialize();
      expect(service.isServiceInitialized()).toBe(true);
    });
  });

  describe('close', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should close service successfully', async () => {
      await service.close();

      expect(mockGraphDatabase.close).toHaveBeenCalled();
      expect(service.isServiceInitialized()).toBe(false);
    });
  });

  describe('analyzeDependencies', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should analyze dependencies with default options', async () => {
      const mockFindDependencies = jest.spyOn(service as any, 'findDependencies').mockResolvedValue({
        direct: [{ id: '1', type: 'IMPORTS', sourceId: 'a', targetId: 'b', properties: {} }],
        transitive: [],
        summary: { directCount: 1, transitiveCount: 0, criticalPath: [] }
      });

      const result = await service.analyzeDependencies('test.ts', 'project1');

      expect(result).toHaveProperty('directDependencies');
      expect(result).toHaveProperty('transitiveDependencies');
      expect(result).toHaveProperty('summary');
      expect(mockFindDependencies).toHaveBeenCalledWith('test.ts', { direction: 'outgoing', depth: 1 });
    });
  });

  describe('analyzeCallGraph', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return basic call graph structure', async () => {
      const result = await service.analyzeCallGraph('testFunction', 'project1');

      expect(result).toHaveProperty('callers', []);
      expect(result).toHaveProperty('callees', []);
      expect(result).toHaveProperty('callGraph', []);
      expect(result).toHaveProperty('summary');
    });
  });

  describe('analyzeImpact', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return basic impact analysis structure', async () => {
      const result = await service.analyzeImpact(['node1'], 'project1');

      expect(result).toHaveProperty('affectedNodes', []);
      expect(result).toHaveProperty('impactPaths', []);
      expect(result).toHaveProperty('summary');
    });
  });

  describe('getProjectOverview', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return project overview', async () => {
      const result = await service.getProjectOverview('project1');

      expect(result).toHaveProperty('projectInfo');
      expect(result).toHaveProperty('graphStats');
      expect(result).toHaveProperty('analysisSummary');
    });
  });

  describe('getStructureMetrics', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return structure metrics', async () => {
      const result = await service.getStructureMetrics('project1');

      expect(result).toHaveProperty('fileMetrics');
      expect(result).toHaveProperty('codeMetrics');
      expect(result).toHaveProperty('dependencyMetrics');
      expect(result).toHaveProperty('complexityMetrics');
    });
  });

  describe('detectCircularDependencies', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return empty array for circular dependencies', async () => {
      const result = await service.detectCircularDependencies('project1');

      expect(result).toEqual([]);
    });
  });

  describe('getGraphStatsByProject', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return graph stats by project', async () => {
      const result = await service.getGraphStatsByProject('project1');

      expect(result).toHaveProperty('nodeCount', 0);
      expect(result).toHaveProperty('edgeCount', 0);
      expect(result).toHaveProperty('nodeTypes', {});
      expect(result).toHaveProperty('relationshipTypes', {});
    });
  });
});
