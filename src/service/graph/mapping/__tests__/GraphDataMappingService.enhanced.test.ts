import { GraphDataMappingService } from '../GraphDataMappingService';
import { GraphRelationshipType } from '../IGraphDataMappingService';
import { StandardizedQueryResult } from '../../parser/core/normalization/types';
import { TYPE_MAPPING_CONFIG } from '../TypeMappingConfig';

describe('GraphDataMappingService Enhanced Tests', () => {
  let mappingService: GraphDataMappingService;
  let mockLogger: any;
  let mockValidator: any;
  let mockCache: any;
  let mockUnifiedCache: any;
  let mockBatchOptimizer: any;
  let mockFaultToleranceHandler: any;
  let mockRelationshipExtractorFactory: any;

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

    mockRelationshipExtractorFactory = {
      getExtractor: jest.fn(),
      getSupportedLanguages: jest.fn(),
      registerExtractor: jest.fn()
    };

    mappingService = new GraphDataMappingService(
      mockLogger,
      mockValidator,
      mockCache,
      mockUnifiedCache,
      mockBatchOptimizer,
      mockFaultToleranceHandler,
      mockRelationshipExtractorFactory
    );
  });

  describe('Enhanced Relationship Type Support', () => {
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
        { input: 'implements', expected: GraphRelationshipType.IMPLEMENTS },
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
        expect(mappingService['mapRelationshipTypeToGraphType'](testCase.input))
          .toBe(testCase.expected);
      }
    });

    test('should return USES for unknown relationship types', () => {
      expect(mappingService['mapRelationshipTypeToGraphType']('unknown-type'))
        .toBe(GraphRelationshipType.USES);
    });
  });

  describe('Relationship Metadata Processors', () => {
    test('should process call relationship metadata correctly', () => {
      const callMetadata = {
        fromNodeId: 'node1',
        toNodeId: 'node2',
        callName: 'testFunction',
        callType: 'function',
        callContext: { isChained: false, isAsync: false }
      };

      const processor = mappingService['getRelationshipProcessor']('call');
      const result = processor.processMetadata(callMetadata);

      expect(result).toEqual({
        sourceNodeId: 'node1',
        targetNodeId: 'node2',
        properties: {
          callName: 'testFunction',
          callType: 'function',
          callContext: { isChained: false, isAsync: false },
          fromNodeId: 'node1',
          toNodeId: 'node2'
        }
      });
    });

    test('should process annotation relationship metadata correctly', () => {
      const annotationMetadata = {
        source: 'node1',
        target: 'node2',
        type: 'struct_tag'
      };

      const processor = mappingService['getRelationshipProcessor']('annotation');
      const result = processor.processMetadata(annotationMetadata);

      expect(result).toEqual({
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

    test('should return null for missing metadata', () => {
      const processor = mappingService['getRelationshipProcessor']('call');
      const result = processor.processMetadata(null);
      expect(result).toBeNull();
    });

    test('should return null for undefined metadata', () => {
      const processor = mappingService['getRelationshipProcessor']('call');
      const result = processor.processMetadata(undefined);
      expect(result).toBeNull();
    });
  });

  describe('Enhanced createEdgeFromStandardizedNode', () => {
    test('should create edge for call relationship', async () => {
      const callNode: StandardizedQueryResult = {
        nodeId: 'edge1',
        type: 'call',
        name: 'test_call',
        startLine: 10,
        endLine: 10,
        content: 'testFunction()',
        metadata: {
          language: 'c',
          complexity: 1,
          dependencies: [],
          modifiers: [],
          extra: {
            fromNodeId: 'node1',
            toNodeId: 'node2',
            callName: 'testFunction',
            callType: 'function'
          }
        }
      };

      const edge = mappingService['createEdgeFromStandardizedNode'](callNode);

      expect(edge).toEqual({
        id: 'edge1',
        type: GraphRelationshipType.CALLS,
        sourceNodeId: 'node1',
        targetNodeId: 'node2',
        properties: {
          callName: 'testFunction',
          callType: 'function',
          fromNodeId: 'node1',
          toNodeId: 'node2'
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

      const edge = mappingService['createEdgeFromStandardizedNode'](unknownNode);
      expect(edge).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No processor found for relationship type: unknown-type'
      );
    });
  });

  describe('Integration Tests', () => {
    test('should handle mixed entity and relationship nodes', async () => {
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

      const result = await mappingService.mapToGraph('test.c', standardizedNodes, null as any);

      expect(mockFaultToleranceHandler.executeWithFaultTolerance).toHaveBeenCalled();
    });
  });
});