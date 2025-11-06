import { GraphDataMappingService } from '../GraphDataMappingService';
import { GraphRelationshipType } from '../IGraphDataMappingService';
import { StandardizedQueryResult } from '../../parser/core/normalization/types';
import { TYPE_MAPPING_CONFIG } from '../TypeMappingConfig';

describe('GraphDataMappingService New Architecture Tests', () => {
  let mappingService: GraphDataMappingService;
  let mockLogger: any;
  let mockValidator: any;
  let mockCache: any;
  let mockUnifiedCache: any;
  let mockBatchOptimizer: any;
  let mockFaultToleranceHandler: any;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    };

    mockValidator = {
      validate: jest.fn()
    };

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn()
    };

    mockUnifiedCache = {
      getGraphData: jest.fn(),
      setGraphData: jest.fn(),
      clearGraphCache: jest.fn(),
      getGraphCacheStats: jest.fn()
    };

    mockBatchOptimizer = {
      optimize: jest.fn()
    };

    mockFaultToleranceHandler = {
      executeWithFaultTolerance: jest.fn()
    };

    mappingService = new GraphDataMappingService(
      mockLogger,
      mockValidator,
      mockCache,
      mockUnifiedCache,
      mockBatchOptimizer,
      mockFaultToleranceHandler
    );
  });

  describe('New Architecture - No Tree-sitter Dependencies', () => {
    test('should initialize without tree-sitter dependencies', () => {
      expect(mappingService).toBeDefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'GraphDataMappingService initialized with new architecture (no tree-sitter dependencies)'
      );
    });

    test('should recognize all relationship types from TYPE_MAPPING_CONFIG', () => {
      for (const relationshipType of TYPE_MAPPING_CONFIG.relationshipTypes) {
        expect(mappingService['isRelationshipType'](relationshipType)).toBe(true);
      }
    });

    test('should recognize all entity types from TYPE_MAPPING_CONFIG', () => {
      for (const entityType of TYPE_MAPPING_CONFIG.entityTypes) {
        expect(mappingService['isEntityType'](entityType)).toBe(true);
      }
    });

    test('should map relationship types correctly', () => {
      const testCases = [
        { input: 'call', expected: GraphRelationshipType.CALLS },
        { input: 'data-flow', expected: GraphRelationshipType.DATA_FLOWS_TO },
        { input: 'inheritance', expected: GraphRelationshipType.INHERITS },
        { { input: 'implements', expected: GraphRelationshipType.IMPLEMENTS },
        { input: 'annotation', expected: GraphRelationshipType.ANNOTATES },
        { input: 'creation', expected: GraphRelationshipType.CREATES },
        { input: 'dependency', expected: GraphRelationshipType.DEPENDS_ON },
        { input: 'reference', expected: GraphRelationshipType.REFERENCES },
        { input: 'concurrency', expected: GraphRelationshipType.SYNCHRONIZES_WITH },
        { input: 'lifecycle', expected: GraphRelationshipType.MANAGES_LIFECYCLE },
        { input: 'semantic', expected: GraphRelationshipType.OVERRIDES },
        { input: 'control-flow', expected: GraphRelationshipType.CONTROLS }
      ];

      for (const testCase of testCases) {
        expect(mappingService['mapRelationshipTypeToGraphType'](testCase.input)).toBe(testCase.expected);
      }
    });

    test('should return USES for unknown relationship types', () => {
      expect(mappingService['mapRelationshipTypeToGraphType']('unknown-type')).toBe(GraphRelationshipType.USES);
    });
  });

  describe('Standardized Results Processing', () => {
    test('should create vertex for entity types', async () => {
      const functionNode: StandardizedQueryResult = {
        nodeId: 'func1',
        type: 'function',
        name: 'testFunction',
        startLine: 1,
        endLine: 10,
        content: 'function testFunction() {}',
        metadata: {
          language: 'c',
          complexity: 1,
          dependencies: [],
          modifiers: []
        }
      };

      const vertex = mappingService['createVertexFromStandardizedNode'](functionNode, 'test.c');

      expect(vertex).toEqual({
        id: 'func1',
        type: GraphNodeType.FUNCTION,
        properties: {
          name: 'testFunction',
          filePath: 'test.c',
          language: 'c',
          complexity: 1,
          dependencies: [],
          modifiers: []
        }
      });
    });

    test('should create edge for call relationship', async () => {
      const callNode: StandardizedQueryResult = {
        nodeId: 'call1',
        type: 'call',
        name: 'test_call',
        startLine: 5,
        endLine: 5,
        content: 'testFunction()',
        metadata: {
          language: 'c',
          complexity: 1,
          dependencies: [],
          modifiers: [],
          extra: {
            fromNodeId: 'func1',
            toNodeId: 'func2',
            callName: 'testFunction',
            callType: 'function'
          }
        }
      };

      const edge = mappingService['createEdgeFromStandardizedNode'](callNode);

      expect(edge).toEqual({
        id: 'call1',
        type: GraphRelationshipType.CALLS,
        sourceNodeId: 'func1',
        targetNodeId: 'func2',
        properties: {
          callName: 'testFunction',
          callType: 'function',
          fromNodeId: 'func1',
          toNodeId: 'func2'
        }
      });
    });

    test('should create edge for annotation relationship', async () => {
      const annotationNode: StandardizedQueryResult = {
        nodeId: 'edge2',
        type: 'annotation',
        name: 'test_annotation',
        startLine: 5,
        endLine: 5,
        content: '@deprecated',
        metadata: {
          language: 'c',
          complexity: 1,
          dependencies: [],
          modifiers: [],
          extra: {
            source: 'node1',
            target: 'node2',
            type: 'struct_tag'
          }
        }
      };

      const edge = mappingService['createEdgeFromStandardizedNode'](annotationNode);

      expect(edge).toEqual({
        id: 'edge2',
        type: GraphRelationshipType.ANNOTATES,
        sourceNodeId: 'node1',
        targetNodeId: 'node2',
        properties: {
          annotationType: 'struct_tag',
          source: 'node1',
          target: 'node2',
          type: 'struct_tag'
        }
      });
    });

    test('should return null for relationship with missing metadata', async () => {
      const invalidNode: StandardizedQueryResult = {
        nodeId: 'edge3',
        type: 'call',
        name: 'invalid_call',
        startLine: 1,
        endLine: 1,
        content: 'invalid',
        metadata: {
          language: 'c',
          complexity: 1,
          dependencies: [],
          modifiers: []
          // missing extra field
        }
      };

      const edge = mappingService['createEdgeFromStandardizedNode'](invalidNode);
      expect(edge).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Skipping relationship node due to missing metadata: invalid_call'
      );
    });

    test('should return null for unknown relationship type', async () => {
      const unknownNode: StandardizedQueryResult = {
        nodeId: 'edge4',
        type: 'unknown-type' as any,
        name: 'unknown',
        startLine: 1,
        endLine: 1,
        content: 'unknown',
        metadata: {
          language: 'c',
          complexity: 1,
          dependencies: [],
          modifiers: [],
          extra: {
            source: 'node1',
            target: 'node2'
          }
        }
      };

      const edge = mappingService['createEdgeFromStandardNode'](unknownNode);
      expect(edge).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No processor found for relationship type: unknown-type'
      );
    });
  });

  describe('mapToGraph Method', () => {
    test('should map mixed entity and relationship nodes', async () => {
      const mockFaultToleranceResult = {
        success: true,
        data: {
          nodes: [],
          edges: []
        }
      };

      mockFaultToleranceHandler.executeWithFaultTolerance.mockResolvedValue(mockFaultToleranceResult);

      const standardizedNodes: StandardizedQueryResult[] = [
        {
          nodeId: 'func1',
          type: 'function',
          name: 'testFunction',
          startLine: 1,
          endLine: 10,
          content: 'function testFunction() {}',
          metadata: {
            language: 'c',
            complexity: 1,
            dependencies: [],
            modifiers: []
          }
        },
        {
          nodeId: 'call1',
          type: 'call',
          name: 'test_call',
          startLine: 5,
          endLine: 5,
          content: 'testFunction()',
          metadata: {
            language: 'c',
            complexity: 1,
            dependencies: [],
            modifiers: [],
            extra: {
              fromNodeId: 'func1',
              toNodeId: 'func2',
              callName: 'testFunction',
              callType: 'function'
            }
          }
        }
      ];

      const result = await mappingService.mapToGraph('test.c', standardizedNodes);

      expect(mockFaultToleranceHandler.executeWithFaultTolerance).toHaveBeenCalled();
      expect(result.nodes).toHaveLength(1);
      expect(result.edges).toHaveLength(1);
    });

    test('should handle empty standardized nodes', async () => {
      const mockFaultToleranceResult = {
        success: true,
        data: {
          nodes: [],
          edges: []
        }
      };

      mockFaultToleranceHandler.executeWithFaultTolerance.mockResolvedValue(mockFaultToleranceResult);

      const result = await mappingService.mapToGraph('test.c', []);

      expect(result.nodes).toHaveLength(0);
      expect(result.edges).toHaveLength(0);
    });
  });

  describe('Backward Compatibility', () => {
    test('should handle deprecated mapQueryResultsToGraph method', async () => {
      const result = mappingService.mapQueryResultsToResults({} as any);
      
      expect(result).toEqual({
        nodes: [],
        edges: []
      });
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'mapQueryResultsToGraph is deprecated. Please use the new mapToGraph method with standardized results.'
      );
    });
  });
});