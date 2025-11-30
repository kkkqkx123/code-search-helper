import { GraphConstructionService } from '../GraphConstructionService';
import { IGraphConstructionService } from '../IGraphConstructionService';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { ParserFacade } from '../../../parser/core/parse/ParserFacade';
import { IGraphDataMappingService, GraphNodeType, GraphRelationshipType } from '../../mapping/IGraphDataMappingService';
import { InfrastructureConfigService } from '../../../../infrastructure/config/InfrastructureConfigService';
import { IGraphIndexPerformanceMonitor } from '../../../../infrastructure/monitoring/GraphIndexMetrics';
import { Container } from 'inversify';
import { TYPES } from '../../../../types';
import { CodeChunk } from '../../../parser/types';
import { ChunkType } from '../../../parser/processing/types/CodeChunk';

describe('GraphConstructionService', () => {
  let service: IGraphConstructionService;
  let container: Container;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockErrorHandler: jest.Mocked<ErrorHandlerService>;
  let mockParserFacade: jest.Mocked<ParserFacade>;
  let mockGraphMappingService: jest.Mocked<IGraphDataMappingService>;
  let mockConfigService: jest.Mocked<InfrastructureConfigService>;
  let mockPerformanceMonitor: jest.Mocked<IGraphIndexPerformanceMonitor>;

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

    mockParserFacade = {
      detectLanguage: jest.fn(),
      parseCode: jest.fn()
    } as any;

    mockGraphMappingService = {
      mapToGraph: jest.fn()
    } as any;

    mockConfigService = {
      getGraphConfiguration: jest.fn().mockReturnValue({})
    } as any;

    mockPerformanceMonitor = {
      recordMetric: jest.fn()
    } as any;

    // 绑定依赖
    container.bind(TYPES.LoggerService).toConstantValue(mockLogger);
    container.bind(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandler);
    container.bind(TYPES.ParserFacade).toConstantValue(mockParserFacade);
    container.bind(TYPES.GraphDataMappingService).toConstantValue(mockGraphMappingService);
    container.bind(TYPES.InfrastructureConfigService).toConstantValue(mockConfigService);
    container.bind(TYPES.GraphIndexPerformanceMonitor).toConstantValue(mockPerformanceMonitor);
    container.bind<IGraphConstructionService>(TYPES.GraphConstructionService).to(GraphConstructionService);

    service = container.get<IGraphConstructionService>(TYPES.GraphConstructionService);
  });

  describe('buildGraphStructure', () => {
    it('should build graph structure from files', async () => {
      // Arrange
      const files = ['/test/file1.ts', '/test/file2.ts'];
      const projectPath = '/test';
      
      mockParserFacade.detectLanguage.mockResolvedValue({ name: 'typescript' } as any);
      mockParserFacade.parseCode.mockResolvedValue({ ast: {} } as any);
      mockGraphMappingService.mapToGraph.mockResolvedValue({
        nodes: [{ id: 'node1', type: GraphNodeType.FUNCTION, properties: {} }],
        edges: [{ id: 'edge1', type: GraphRelationshipType.CALLS, sourceNodeId: 'node1', targetNodeId: 'node2', properties: {} }]
      });

      // Act
      const result = await service.buildGraphStructure(files, projectPath);

      // Assert
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      expect(result.relationships).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith({
        operation: 'storeFiles',
        projectId: projectPath,
        duration: expect.any(Number),
        success: true,
        timestamp: expect.any(Number),
        metadata: {
          fileCount: files.length,
          nodesCreated: expect.any(Number),
          relationshipsCreated: expect.any(Number)
        }
      });
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const files = ['/test/file1.ts'];
      const projectPath = '/test';
      
      mockParserFacade.detectLanguage.mockRejectedValue(new Error('Language detection failed'));
      mockErrorHandler.handleError.mockImplementation(() => {
        throw new Error('Language detection failed');
      });

      // Act & Assert
      await expect(service.buildGraphStructure(files, projectPath)).rejects.toThrow();
      expect(mockErrorHandler.handleError).toHaveBeenCalled();
      expect(mockPerformanceMonitor.recordMetric).toHaveBeenCalledWith({
        operation: 'storeFiles',
        projectId: projectPath,
        duration: expect.any(Number),
        success: false,
        timestamp: expect.any(Number),
        metadata: {
          fileCount: files.length,
          errorMessage: 'Language detection failed',
          errorType: 'Error'
        }
      });
    });
  });

  describe('convertToGraphNodes', () => {
    it('should convert code chunks to graph nodes', () => {
      // Arrange
      const chunks: CodeChunk[] = [
        {
          content: 'function test() {}',
          metadata: {
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            filePath: '/test/file.ts',
            strategy: 'ast',
            type: ChunkType.FUNCTION,
            size: 20,
            lineCount: 3,
            timestamp: Date.now()
          }
        }
      ];

      // Act
      const nodes = service.convertToGraphNodes(chunks);

      // Assert
      expect(nodes).toHaveLength(1);
      expect(nodes[0].type).toBe('Function');
      expect(nodes[0].properties.content).toBe('function test() {}');
      expect(nodes[0].properties.startLine).toBe(1);
      expect(nodes[0].properties.endLine).toBe(3);
    });
  });

  describe('convertToGraphRelationships', () => {
    it('should convert code chunks to graph relationships', () => {
      // Arrange
      const chunks: CodeChunk[] = [
        {
          content: 'function parent() {}',
          metadata: {
            startLine: 1,
            endLine: 3,
            language: 'typescript',
            filePath: '/test/file.ts',
            strategy: 'ast',
            type: ChunkType.FUNCTION,
            size: 20,
            lineCount: 3,
            timestamp: Date.now()
          }
        },
        {
          content: 'function child() {}',
          metadata: {
            startLine: 5,
            endLine: 7,
            language: 'typescript',
            filePath: '/test/file.ts',
            strategy: 'ast',
            type: ChunkType.FUNCTION,
            size: 20,
            lineCount: 3,
            timestamp: Date.now()
          }
        }
      ];

      // Act
      const relationships = service.convertToGraphRelationships(chunks);

      // Assert
      expect(relationships).toBeDefined();
      expect(Array.isArray(relationships)).toBe(true);
    });
  });
});