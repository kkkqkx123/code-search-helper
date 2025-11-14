import { GraphAnalysisService } from '../GraphAnalysisService';
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

const mockGraphService = {
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
      mockGraphService as any,
      mockPerformanceMonitor as any
    );
  });

  describe('initialize', () => {
    it('should initialize successfully when database initializes', async () => {
      mockGraphService.isDatabaseConnected.mockReturnValue(false);
      mockGraphService.initialize.mockResolvedValue(true);

      const result = await service.initialize();

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Initializing graph analysis service');
      expect(mockGraphService.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Graph analysis service initialized successfully');
    });

    it('should return false when database initialization fails', async () => {
      mockGraphService.isDatabaseConnected.mockReturnValue(false);
      mockGraphService.initialize.mockResolvedValue(false);

      const result = await service.initialize();

      expect(result).toBe(false);
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });

    it('should not initialize database if already connected', async () => {
      mockGraphService.isDatabaseConnected.mockReturnValue(true);

      const result = await service.initialize();

      expect(result).toBe(true);
      expect(mockGraphService.initialize).not.toHaveBeenCalled();
    });
  });

  describe('analyzeCodebase', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return analysis result with proper structure', async () => {
      mockGraphService.executeReadQuery.mockResolvedValue({
        data: []
      });

      const result = await service.analyzeCodebase('/test/path');

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('formattedResult');
      expect(result.result).toHaveProperty('nodes');
      expect(result.result).toHaveProperty('edges');
      expect(result.result).toHaveProperty('metrics');
      expect(result.result).toHaveProperty('summary');
      expect(result.formattedResult).toHaveProperty('insights');
    });

    it('should analyze codebase', async () => {
      mockGraphService.executeReadQuery.mockResolvedValue({
        data: [
          { node: { id: '1', name: 'test.ts', properties: {} } },
          { edgeProps: { id: 'e1', src: '1', dst: '2', type: 'IMPORTS', properties: {} } }
        ]
      });

      const result = await service.analyzeCodebase('/test/path');

      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('formattedResult');
      expect(mockGraphService.executeReadQuery).toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordQueryExecution).toHaveBeenCalled();
    });

    it('should handle errors during analysis', async () => {
      mockGraphService.executeReadQuery.mockRejectedValue(new Error('Database error'));

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
      mockGraphService.executeReadQuery.mockResolvedValue({
        data: [
          { edgeProps: { id: 'e1', src: 'file1', dst: 'file2', type: 'IMPORTS', properties: {} } }
        ]
      });

      const result = await service.findDependencies('test.ts');

      expect(result).toHaveProperty('direct');
      expect(result).toHaveProperty('transitive');
      expect(result).toHaveProperty('summary');
      expect(mockGraphService.executeReadQuery).toHaveBeenCalled();
    });

    it('should handle errors during dependency analysis', async () => {
      mockGraphService.executeReadQuery.mockRejectedValue(new Error('Query error'));

      await expect(service.findDependencies('test.ts')).rejects.toThrow('Query error');
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
    });
  });

  describe('findImpact', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should find impact successfully', async () => {
      mockGraphService.executeReadQuery.mockResolvedValue({
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
      expect(mockGraphService.executeReadQuery).toHaveBeenCalled();
    });

    it('should return default values when no data', async () => {
      mockGraphService.executeReadQuery.mockResolvedValue({ data: null });

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
      mockGraphService.executeReadQuery
        .mockResolvedValueOnce({ data: [{ total: 10 }] })
        .mockResolvedValueOnce({ data: [{ total: 5 }] })
        .mockResolvedValueOnce({ data: [{ total: 3 }] })
        .mockResolvedValueOnce({ data: [{ total: 2 }] })
        .mockResolvedValueOnce({ data: [] }); // for cyclic dependencies detection

      const result = await service.getGraphStats('/test/path');

      expect(result).toHaveProperty('totalFiles', 10);
      expect(result).toHaveProperty('totalFunctions', 5);
      expect(result).toHaveProperty('totalClasses', 3);
      expect(result).toHaveProperty('totalImports', 2);
      expect(result).toHaveProperty('complexityScore');
      expect(result).toHaveProperty('maintainabilityIndex');
      expect(mockGraphService.executeReadQuery).toHaveBeenCalledTimes(5);
    });
  });

  describe('exportGraph', () => {
    // Note: exportGraph tests removed as method doesn't exist on GraphAnalysisService
    // This method should be tested on a different service if it exists elsewhere

    it('should skip this suite as exportGraph is not implemented', () => {
      // Placeholder test to allow the suite to run
      expect(true).toBe(true);
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

      expect(mockGraphService.close).toHaveBeenCalled();
      expect(service.isServiceInitialized()).toBe(false);
    });
  });

  // Note: Methods like analyzeDependencies, analyzeCallGraph, analyzeImpact, etc.
  // don't exist on GraphAnalysisService. These may belong to other services.
});