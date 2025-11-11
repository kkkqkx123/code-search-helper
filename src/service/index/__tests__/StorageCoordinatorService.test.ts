import { Container } from 'inversify';
import { TYPES } from '../../../types';
import { StorageCoordinatorService, CoordinatedIndexOptions, CoordinatedResult } from '../StorageCoordinatorService';
import { VectorIndexService } from '../VectorIndexService';
import { GraphIndexService } from '../GraphIndexService';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ProjectStateManager } from '../../project/ProjectStateManager';

describe('StorageCoordinatorService', () => {
  let container: Container;
  let storageCoordinatorService: StorageCoordinatorService;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockErrorHandler: jest.Mocked<ErrorHandlerService>;
  let mockProjectStateManager: jest.Mocked<ProjectStateManager>;
  let mockVectorIndexService: jest.Mocked<VectorIndexService>;
  let mockGraphIndexService: jest.Mocked<GraphIndexService>;

  beforeEach(() => {
    container = new Container();

    // 创建模拟对象
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    mockErrorHandler = {
      handleError: jest.fn()
    } as any;

    mockProjectStateManager = {
      getVectorStatus: jest.fn(),
      getGraphStatus: jest.fn()
    } as any;

    mockVectorIndexService = {
      indexVectors: jest.fn(),
      getVectorStatus: jest.fn()
    } as any;

    mockGraphIndexService = {
      indexGraph: jest.fn(),
      getGraphStatus: jest.fn()
    } as any;

    // 绑定依赖
    container.bind(TYPES.LoggerService).toConstantValue(mockLogger);
    container.bind(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandler);
    container.bind(TYPES.ProjectStateManager).toConstantValue(mockProjectStateManager);
    container.bind(TYPES.VectorIndexService).toConstantValue(mockVectorIndexService);
    container.bind(TYPES.GraphIndexService).toConstantValue(mockGraphIndexService);
    container.bind(TYPES.StorageCoordinatorService).to(StorageCoordinatorService);

    storageCoordinatorService = container.get<StorageCoordinatorService>(TYPES.StorageCoordinatorService);
  });

  describe('coordinateIndexing', () => {
    const projectId = 'test-project-id';
    const vectorOptions = { embedder: 'test', batchSize: 10 };
    const graphOptions = { maxConcurrency: 2 };

    it('should coordinate both vector and graph indexing successfully', async () => {
      const options: CoordinatedIndexOptions = {
        vectors: true,
        graph: true,
        vectorOptions,
        graphOptions
      };

      const vectorResult = { success: true, projectId, operationId: 'vector_123', status: 'started' as const };
      const graphResult = { success: true, projectId, operationId: 'graph_456', status: 'started' as const };

      mockVectorIndexService.indexVectors.mockResolvedValue(vectorResult);
      mockGraphIndexService.indexGraph.mockResolvedValue(graphResult);

      const result = await storageCoordinatorService.coordinateIndexing(projectId, options);

      expect(result.success).toBe(true);
      expect(result.projectId).toBe(projectId);
      expect(result.vectorResult).toEqual(vectorResult);
      expect(result.graphResult).toEqual(graphResult);
      expect(result.errors).toBeUndefined();
      expect(mockVectorIndexService.indexVectors).toHaveBeenCalledWith(projectId, vectorOptions);
      expect(mockGraphIndexService.indexGraph).toHaveBeenCalledWith(projectId, graphOptions);
      expect(mockLogger.info).toHaveBeenCalledWith(`Starting coordinated indexing for project ${projectId}`, expect.any(Object));
    });

    it('should coordinate only vector indexing when graph is disabled', async () => {
      const options: CoordinatedIndexOptions = {
        vectors: true,
        graph: false,
        vectorOptions
      };

      const vectorResult = { success: true, projectId, operationId: 'vector_123', status: 'started' as const };

      mockVectorIndexService.indexVectors.mockResolvedValue(vectorResult);

      const result = await storageCoordinatorService.coordinateIndexing(projectId, options);

      expect(result.success).toBe(true);
      expect(result.projectId).toBe(projectId);
      expect(result.vectorResult).toEqual(vectorResult);
      expect(result.graphResult).toBeNull();
      expect(result.errors).toBeUndefined();
      expect(mockVectorIndexService.indexVectors).toHaveBeenCalledWith(projectId, vectorOptions);
      expect(mockGraphIndexService.indexGraph).not.toHaveBeenCalled();
    });

    it('should coordinate only graph indexing when vector is disabled', async () => {
      const options: CoordinatedIndexOptions = {
        vectors: false,
        graph: true,
        graphOptions
      };

      const graphResult = { success: true, projectId, operationId: 'graph_456', status: 'started' as const };

      mockGraphIndexService.indexGraph.mockResolvedValue(graphResult);

      const result = await storageCoordinatorService.coordinateIndexing(projectId, options);

      expect(result.success).toBe(true);
      expect(result.projectId).toBe(projectId);
      expect(result.vectorResult).toBeNull();
      expect(result.graphResult).toEqual(graphResult);
      expect(result.errors).toBeUndefined();
      expect(mockVectorIndexService.indexVectors).not.toHaveBeenCalled();
      expect(mockGraphIndexService.indexGraph).toHaveBeenCalledWith(projectId, graphOptions);
    });

    it('should default to both when no options specified', async () => {
      const options: CoordinatedIndexOptions = {};

      const vectorResult = { success: true, projectId, operationId: 'vector_123', status: 'started' as const };
      const graphResult = { success: true, projectId, operationId: 'graph_456', status: 'started' as const };

      mockVectorIndexService.indexVectors.mockResolvedValue(vectorResult);
      mockGraphIndexService.indexGraph.mockResolvedValue(graphResult);

      const result = await storageCoordinatorService.coordinateIndexing(projectId, options);

      expect(result.success).toBe(true);
      expect(result.vectorResult).toEqual(vectorResult);
      expect(result.graphResult).toEqual(graphResult);
      expect(mockVectorIndexService.indexVectors).toHaveBeenCalledWith(projectId, undefined);
      expect(mockGraphIndexService.indexGraph).toHaveBeenCalledWith(projectId, undefined);
    });

    it('should handle vector indexing failure', async () => {
      const options: CoordinatedIndexOptions = {
        vectors: true,
        graph: true
      };

      const graphResult = { success: true, projectId, operationId: 'graph_456', status: 'started' as const };
      const vectorError = new Error('Vector indexing failed');

      mockVectorIndexService.indexVectors.mockRejectedValue(vectorError);
      mockGraphIndexService.indexGraph.mockResolvedValue(graphResult);

      const result = await storageCoordinatorService.coordinateIndexing(projectId, options);

      expect(result.success).toBe(false);
      expect(result.projectId).toBe(projectId);
      expect(result.vectorResult).toBeNull();
      expect(result.graphResult).toEqual(graphResult);
      expect(result.errors).toEqual(['Vector indexing failed: Vector indexing failed']);
      expect(mockLogger.error).toHaveBeenCalledWith(`Vector indexing failed for project ${projectId}`, { error: vectorError });
    });

    it('should handle graph indexing failure', async () => {
      const options: CoordinatedIndexOptions = {
        vectors: true,
        graph: true
      };

      const vectorResult = { success: true, projectId, operationId: 'vector_123', status: 'started' as const };
      const graphError = new Error('Graph indexing failed');

      mockVectorIndexService.indexVectors.mockResolvedValue(vectorResult);
      mockGraphIndexService.indexGraph.mockRejectedValue(graphError);

      const result = await storageCoordinatorService.coordinateIndexing(projectId, options);

      expect(result.success).toBe(false);
      expect(result.projectId).toBe(projectId);
      expect(result.vectorResult).toEqual(vectorResult);
      expect(result.graphResult).toBeNull();
      expect(result.errors).toEqual(['Graph indexing failed: Graph indexing failed']);
      expect(mockLogger.error).toHaveBeenCalledWith(`Graph indexing failed for project ${projectId}`, { error: graphError });
    });

    it('should handle both indexing failures', async () => {
      const options: CoordinatedIndexOptions = {
        vectors: true,
        graph: true
      };

      const vectorError = new Error('Vector indexing failed');
      const graphError = new Error('Graph indexing failed');

      mockVectorIndexService.indexVectors.mockRejectedValue(vectorError);
      mockGraphIndexService.indexGraph.mockRejectedValue(graphError);

      const result = await storageCoordinatorService.coordinateIndexing(projectId, options);

      expect(result.success).toBe(false);
      expect(result.projectId).toBe(projectId);
      expect(result.vectorResult).toBeNull();
      expect(result.graphResult).toBeNull();
      expect(result.errors).toEqual([
        'Vector indexing failed: Vector indexing failed',
        'Graph indexing failed: Graph indexing failed'
      ]);
    });

    it('should throw error when both vectors and graph are disabled', async () => {
      const options: CoordinatedIndexOptions = {
        vectors: false,
        graph: false
      };

      const result = await storageCoordinatorService.coordinateIndexing(projectId, options);

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['At least one of vectors or graph must be enabled']);
    });
  });

  describe('getCoordinatedStatus', () => {
    const projectId = 'test-project-id';

    it('should return combined status when both services are available', async () => {
      const vectorStatus = {
        projectId,
        status: 'completed',
        progress: 100,
        totalFiles: 10,
        indexedFiles: 10
      };

      const graphStatus = {
        projectId,
        status: 'completed',
        progress: 100,
        totalFiles: 10,
        indexedFiles: 10
      };

      mockVectorIndexService.getVectorStatus.mockResolvedValue(vectorStatus);
      mockGraphIndexService.getGraphStatus.mockResolvedValue(graphStatus);

      const result = await storageCoordinatorService.getCoordinatedStatus(projectId);

      expect(result).toEqual({
        projectId,
        vectorStatus,
        graphStatus,
        overallStatus: 'completed'
      });
    });

    it('should handle errors when getting status', async () => {
      const error = new Error('Failed to get status');
      mockVectorIndexService.getVectorStatus.mockRejectedValue(error);
      mockGraphIndexService.getGraphStatus.mockRejectedValue(error);

      await expect(storageCoordinatorService.getCoordinatedStatus(projectId)).rejects.toThrow('Failed to get coordinated status: Failed to get status');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Error),
        { component: 'StorageCoordinatorService', operation: 'getCoordinatedStatus', projectId }
      );
    });
  });

  describe('calculateOverallStatus', () => {
    it('should return pending when both statuses are null', () => {
      const result = (storageCoordinatorService as any).calculateOverallStatus(null, null);
      expect(result).toBe('pending');
    });

    it('should return indexing when either status is indexing', () => {
      const vectorStatus = { status: 'indexing' };
      const graphStatus = { status: 'completed' };
      
      const result = (storageCoordinatorService as any).calculateOverallStatus(vectorStatus, graphStatus);
      expect(result).toBe('indexing');
    });

    it('should return error when either status is error', () => {
      const vectorStatus = { status: 'completed' };
      const graphStatus = { status: 'error' };
      
      const result = (storageCoordinatorService as any).calculateOverallStatus(vectorStatus, graphStatus);
      expect(result).toBe('error');
    });

    it('should return completed when both statuses are completed', () => {
      const vectorStatus = { status: 'completed' };
      const graphStatus = { status: 'completed' };
      
      const result = (storageCoordinatorService as any).calculateOverallStatus(vectorStatus, graphStatus);
      expect(result).toBe('completed');
    });

    it('should return pending when both statuses are pending', () => {
      const vectorStatus = { status: 'pending' };
      const graphStatus = { status: 'pending' };
      
      const result = (storageCoordinatorService as any).calculateOverallStatus(vectorStatus, graphStatus);
      expect(result).toBe('pending');
    });

    it('should return partial for mixed statuses', () => {
      const vectorStatus = { status: 'completed' };
      const graphStatus = { status: 'pending' };
      
      const result = (storageCoordinatorService as any).calculateOverallStatus(vectorStatus, graphStatus);
      expect(result).toBe('partial');
    });

    it('should default to pending when status is missing', () => {
      const vectorStatus = { status: 'completed' };
      const graphStatus = {};
      
      const result = (storageCoordinatorService as any).calculateOverallStatus(vectorStatus, graphStatus);
      expect(result).toBe('partial');
    });
  });
});