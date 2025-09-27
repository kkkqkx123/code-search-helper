import { Container } from 'inversify';
import { GraphService } from './GraphService';
import { NebulaService } from '../../database/NebulaService';
import { LoggerService } from '../../core/LoggerService';
import { ConfigService } from '../../config/ConfigService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { GraphPersistenceService } from '../storage/graph/GraphPersistenceService';
import { NebulaQueryBuilder } from '../../database/nebula/NebulaQueryBuilder';
import { ResultFormatter } from '../query/ResultFormatter';
import { TYPES } from '../../types';

describe('GraphService', () => {
  let container: Container;
  let graphService: GraphService;
  let mockNebulaService: jest.Mocked<NebulaService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockErrorHandlerService: jest.Mocked<ErrorHandlerService>;
  let mockGraphPersistenceService: jest.Mocked<GraphPersistenceService>;
  let mockNebulaQueryBuilder: jest.Mocked<NebulaQueryBuilder>;
  let mockResultFormatter: jest.Mocked<ResultFormatter>;

  beforeEach(() => {
    container = new Container();

    // Create mocks
    mockNebulaService = {
      executeReadQuery: jest.fn(),
      executeWriteQuery: jest.fn(),
      executeTransaction: jest.fn(),
      createNode: jest.fn(),
      createRelationship: jest.fn(),
      findNodes: jest.fn(),
      findRelationships: jest.fn(),
      getDatabaseStats: jest.fn(),
      isConnected: jest.fn(),
      initialize: jest.fn(),
      close: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockErrorHandlerService = {
      handleError: jest.fn(),
    } as any;

    mockGraphPersistenceService = {
      findRelatedNodes: jest.fn(),
    } as any;

    mockNebulaQueryBuilder = {
      buildCountQuery: jest.fn(),
    } as any;

    mockResultFormatter = {
      formatForLLM: jest.fn(),
    } as any;

    // Bind mocks to container
    container.bind(TYPES.NebulaService).toConstantValue(mockNebulaService);
    container.bind(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandlerService);
    container.bind(TYPES.GraphPersistenceService).toConstantValue(mockGraphPersistenceService);
    container.bind(TYPES.NebulaQueryBuilder).toConstantValue(mockNebulaQueryBuilder);
    container.bind(TYPES.ResultFormatter).toConstantValue(mockResultFormatter);
    container.bind(TYPES.GraphService).to(GraphService);

    graphService = container.get<GraphService>(TYPES.GraphService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeCodebase', () => {
    it('should analyze codebase and return graph analysis result', async () => {
      const projectPath = './src';
      const mockResult = {
        data: [
          {
            node: {
              id: 'file_1',
              name: 'Button.tsx',
              properties: {
                path: 'src/components/Button.tsx',
                type: 'file',
                language: 'typescript',
              },
            },
            edgeProps: {
              id: 'edge_1',
              src: 'file_1',
              dst: 'function_1',
              type: 'CONTAINS',
              properties: { relationship: 'contains' },
            },
          },
        ],
      };

      mockNebulaService.executeReadQuery.mockResolvedValue(mockResult);
      mockResultFormatter.formatForLLM.mockResolvedValue({
        status: 'success',
        data: { formatted: 'result' },
        meta: { tool: 'test', duration_ms: 10 }
      });

      const result = await graphService.analyzeCodebase(projectPath);

      expect(result.result.nodes).toBeDefined();
      expect(result.result.edges).toBeDefined();
      expect(result.result.metrics).toBeDefined();
      expect(result.result.summary).toBeDefined();
      expect(result.formattedResult).toBeDefined();
      expect(mockNebulaService.executeReadQuery).toHaveBeenCalled();
    });

    it('should handle errors during codebase analysis', async () => {
      const projectPath = './src';
      const errorMessage = 'Database connection failed';

      mockNebulaService.executeReadQuery.mockRejectedValue(new Error(errorMessage));
      mockErrorHandlerService.handleError.mockImplementation(error => {
        throw error;
      });

      await expect(graphService.analyzeCodebase(projectPath)).rejects.toThrow(errorMessage);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('findDependencies', () => {
    it('should find dependencies for a file', async () => {
      const filePath = '/src/components/Button.tsx';
      const mockResult = {
        data: [
          {
            edgeProps: {
              id: 'edge_1',
              src: 'file_1',
              dst: 'function_1',
              type: 'IMPORTS',
              properties: { module: 'AuthService' },
            },
          },
        ],
      };

      mockNebulaService.executeReadQuery.mockResolvedValue(mockResult);

      const result = await graphService.findDependencies(filePath);

      expect(result).toBeDefined();
      expect(result.direct).toBeDefined();
      expect(result.transitive).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(mockNebulaService.executeReadQuery).toHaveBeenCalled();
    });

    it('should handle errors during dependency analysis', async () => {
      const filePath = '/src/components/Button.tsx';
      const errorMessage = 'Query execution failed';

      mockNebulaService.executeReadQuery.mockRejectedValue(new Error(errorMessage));
      mockErrorHandlerService.handleError.mockImplementation(error => {
        throw error;
      });

      await expect(graphService.findDependencies(filePath)).rejects.toThrow(errorMessage);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();
    });
  });

  describe('findImpact', () => {
    it('should find impact of changes to a file', async () => {
      const filePath = '/src/components/Button.tsx';

      const result = await graphService.findImpact(filePath);

      expect(result.affectedFiles).toBeDefined();
      expect(result.riskLevel).toBeDefined();
      expect(result.impactScore).toBeDefined();
      expect(result.affectedComponents).toBeDefined();
    });

    it('should handle errors during impact analysis', async () => {
      const filePath = '/src/components/Button.tsx';
      const errorMessage = 'Impact analysis failed';

      mockErrorHandlerService.handleError.mockImplementation(error => {
        throw error;
      });

      // We can't easily mock the internal simulateImpactAnalysis method
      // but we can test error handling by temporarily replacing it
      const originalSimulate = (graphService as any).simulateImpactAnalysis;
      (graphService as any).simulateImpactAnalysis = jest
        .fn()
        .mockRejectedValue(new Error(errorMessage));

      await expect(graphService.findImpact(filePath)).rejects.toThrow(errorMessage);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();

      // Restore original method
      (graphService as any).simulateImpactAnalysis = originalSimulate;
    });
  });

  describe('getGraphStats', () => {
    it('should get graph statistics', async () => {
      const projectPath = './src';

      const result = await graphService.getGraphStats(projectPath);

      expect(result.totalFiles).toBeDefined();
      expect(result.totalFunctions).toBeDefined();
      expect(result.totalClasses).toBeDefined();
      expect(result.totalImports).toBeDefined();
      expect(result.complexityScore).toBeDefined();
      expect(result.maintainabilityIndex).toBeDefined();
      expect(result.cyclicDependencies).toBeDefined();
    });

    it('should handle errors during stats calculation', async () => {
      const projectPath = './src';
      const errorMessage = 'Stats calculation failed';

      mockErrorHandlerService.handleError.mockImplementation(error => {
        throw error;
      });

      // We can't easily mock the internal simulateStatsCalculation method
      // but we can test error handling by temporarily replacing it
      const originalSimulate = (graphService as any).simulateStatsCalculation;
      (graphService as any).simulateStatsCalculation = jest
        .fn()
        .mockRejectedValue(new Error(errorMessage));

      await expect(graphService.getGraphStats(projectPath)).rejects.toThrow(errorMessage);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();

      // Restore original method
      (graphService as any).simulateStatsCalculation = originalSimulate;
    });
  });

  describe('exportGraph', () => {
    it('should export graph in JSON format', async () => {
      const projectPath = './src';
      const format = 'json';

      const result = await graphService.exportGraph(projectPath, format);

      expect(typeof result).toBe('string');
      expect(result).toContain('nodes');
      expect(result).toContain('edges');
      expect(result).toContain('metadata');
    });

    it('should handle errors during graph export', async () => {
      const projectPath = './src';
      const format = 'json';
      const errorMessage = 'Export failed';

      mockErrorHandlerService.handleError.mockImplementation(error => {
        throw error;
      });

      // We can't easily mock the internal simulateExport method
      // but we can test error handling by temporarily replacing it
      const originalSimulate = (graphService as any).simulateExport;
      (graphService as any).simulateExport = jest.fn().mockRejectedValue(new Error(errorMessage));

      await expect(graphService.exportGraph(projectPath, format)).rejects.toThrow(errorMessage);
      expect(mockErrorHandlerService.handleError).toHaveBeenCalled();

      // Restore original method
      (graphService as any).simulateExport = originalSimulate;
    });
  });
});
