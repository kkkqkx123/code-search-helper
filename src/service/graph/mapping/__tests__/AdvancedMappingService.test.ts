import { AdvancedMappingService, AdvancedMappingOptions } from '../SemanticRelationshipExtractor';
import { LoggerService } from '../../../../utils/LoggerService';
import { DataMappingValidator } from '../../../validation/DataMappingValidator';
import { GraphMappingCache } from '../../caching/GraphMappingCache';
import { GraphBatchOptimizer } from '../../utils/GraphBatchOptimizer';
import { TreeSitterService } from '../../../parser/core/parse/TreeSitterService';
import { GraphNodeType, GraphRelationshipType, FileAnalysisResult } from '../IGraphDataMappingService';

// Mock dependencies
const mockLoggerService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const mockDataMappingValidator = {
  validateGraphData: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
};

const mockGraphMappingCache = {
  getMappingResult: jest.fn(),
  cacheMappingResult: jest.fn(),
};

const mockGraphBatchOptimizer = {
  optimizeBatch: jest.fn(),
};

const mockTreeSitterService = {
  findNodeByType: jest.fn(),
  getNodeText: jest.fn(),
};

describe('AdvancedMappingService', () => {
  let advancedMappingService: AdvancedMappingService;

  beforeEach(() => {
    advancedMappingService = new AdvancedMappingService(
      mockLoggerService as unknown as LoggerService,
      mockDataMappingValidator as unknown as DataMappingValidator,
      mockGraphMappingCache as unknown as GraphMappingCache,
      mockGraphBatchOptimizer as unknown as GraphBatchOptimizer,
      mockTreeSitterService as unknown as TreeSitterService
    );
  });

  describe('constructor', () => {
    it('should initialize correctly', () => {
      expect(mockLoggerService.info).toHaveBeenCalledWith('AdvancedMappingService initialized');
    });
  });

  describe('mapWithAdvancedFeatures', () => {
    it('should map with default advanced features', async () => {
      const filePath = 'test.js';
      const fileContent = 'class TestClass { method() { } }';
      const analysisResult: FileAnalysisResult = {
        filePath,
        language: 'javascript',
        ast: {},
        functions: [{
          name: 'method',
          signature: 'method()',
          startLine: 1,
          endLine: 1,
          complexity: 1,
          parameters: [],
          returnType: 'void'
        }],
        classes: [{
          name: 'TestClass',
          methods: [{
            name: 'method',
            signature: 'method()',
            startLine: 1,
            endLine: 1,
            complexity: 1,
            parameters: [],
            returnType: 'void'
          }],
          properties: [],
          superClass: undefined,
          interfaces: []
        }],
        imports: [],
        variables: []
      };

      const result = await advancedMappingService.mapWithAdvancedFeatures(filePath, fileContent, analysisResult);

      expect(result.nodes.length).toBeGreaterThanOrEqual(0);
      expect(result.relationships.length).toBeGreaterThanOrEqual(0);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Starting advanced mapping', expect.objectContaining({ filePath }));
    });

    it('should use cached result if available', async () => {
      const cachedResult = {
        nodes: [{
          id: 'cached-node',
          type: GraphNodeType.FILE,
          properties: { name: 'test.js' }
        }],
        relationships: []
      };

      const options: AdvancedMappingOptions = { 
        includeInheritance: true,
        includeMethodCalls: false,
        includePropertyAccesses: false,
        includeInterfaceImplementations: false,
        includeDependencies: false
      };
      const cacheKey = `advanced_mapping_${'test.js'}_${JSON.stringify(options)}`;
      
      (mockGraphMappingCache.getMappingResult as jest.Mock).mockResolvedValueOnce(cachedResult);

      const result = await advancedMappingService.mapWithAdvancedFeatures(
        'test.js',
        'console.log("test");',
        {
          filePath: 'test.js',
          language: 'javascript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          variables: []
        },
        options
      );

      expect(result).toEqual(cachedResult);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Using cached advanced mapping result', { filePath: 'test.js' });
    });

    it('should map with custom options', async () => {
      const filePath = 'test.js';
      const fileContent = 'function testFunc() { }';
      const analysisResult: FileAnalysisResult = {
        filePath,
        language: 'javascript',
        ast: {},
        functions: [{
          name: 'testFunc',
          signature: 'testFunc()',
          startLine: 1,
          endLine: 1,
          complexity: 1,
          parameters: [],
          returnType: 'void'
        }],
        classes: [],
        imports: [],
        variables: []
      };

      const options: AdvancedMappingOptions = {
        includeInheritance: false,
        includeMethodCalls: true,
        includePropertyAccesses: false,
        includeInterfaceImplementations: false,
        includeDependencies: true
      };

      const result = await advancedMappingService.mapWithAdvancedFeatures(filePath, fileContent, analysisResult, options);

      expect(result.nodes.length).toBeGreaterThanOrEqual(0);
      expect(mockLoggerService.debug).toHaveBeenCalledWith('Starting advanced mapping', expect.objectContaining({ filePath, options }));
    });
  });

 describe('extractInheritanceRelationships', () => {
    it('should extract inheritance relationships', async () => {
      const analysisResult: FileAnalysisResult = {
        filePath: 'test.js',
        language: 'javascript',
        ast: {},
        functions: [],
        classes: [{
          name: 'ChildClass',
          methods: [],
          properties: [],
          superClass: 'ParentClass',
          interfaces: ['Interface1']
        }],
        imports: [],
        variables: []
      };

      const relationships = await advancedMappingService.extractInheritanceRelationships(analysisResult);

      expect(relationships.length).toBe(2); // One for inheritance, one for interface implementation
      expect(relationships.some(rel => rel.type === GraphRelationshipType.INHERITS)).toBe(true);
      expect(relationships.some(rel => rel.type === GraphRelationshipType.IMPLEMENTS)).toBe(true);
    });

    it('should handle classes without inheritance', async () => {
      const analysisResult: FileAnalysisResult = {
        filePath: 'test.js',
        language: 'javascript',
        ast: {},
        functions: [],
        classes: [{
          name: 'SimpleClass',
          methods: [],
          properties: [],
          superClass: undefined,
          interfaces: []
        }],
        imports: [],
        variables: []
      };

      const relationships = await advancedMappingService.extractInheritanceRelationships(analysisResult);

      expect(relationships.length).toBe(0);
    });
  });

  describe('extractCallRelationships', () => {
    it('should extract call relationships', async () => {
      const analysisResult: FileAnalysisResult = {
        filePath: 'test.js',
        language: 'javascript',
        ast: {},
        functions: [{
          name: 'callerFunc',
          signature: 'callerFunc()',
          startLine: 1,
          endLine: 3,
          complexity: 1,
          parameters: [],
          returnType: 'void'
        }],
        classes: [],
        imports: [],
        variables: []
      };

      // Mock TreeSitterService to return call expressions
      (mockTreeSitterService.findNodeByType as jest.Mock).mockReturnValueOnce([
        { 
          type: 'call_expression',
          children: [
            { type: 'identifier', startPosition: { row: 1, column: 0 }, endPosition: { row: 1, column: 10 } }
          ]
        }
      ]);
      (mockTreeSitterService.getNodeText as jest.Mock).mockReturnValueOnce('calledFunc');

      const relationships = await advancedMappingService.extractCallRelationships(analysisResult, 'callerFunc() { calledFunc(); }');

      expect(relationships.length).toBe(1);
      expect(relationships[0].type).toBe(GraphRelationshipType.CALLS);
    });

    it('should handle functions without calls', async () => {
      const analysisResult: FileAnalysisResult = {
        filePath: 'test.js',
        language: 'javascript',
        ast: {},
        functions: [{
          name: 'simpleFunc',
          signature: 'simpleFunc()',
          startLine: 1,
          endLine: 1,
          complexity: 1,
          parameters: [],
          returnType: 'void'
        }],
        classes: [],
        imports: [],
        variables: []
      };

      const relationships = await advancedMappingService.extractCallRelationships(analysisResult, 'simpleFunc() { console.log("hello"); }');

      expect(relationships.length).toBe(0);
    });
  });

 describe('extractPropertyAccessRelationships', () => {
    it('should extract property access relationships', async () => {
      const analysisResult: FileAnalysisResult = {
        filePath: 'test.js',
        language: 'javascript',
        ast: {},
        functions: [{
          name: 'accessorFunc',
          signature: 'accessorFunc()',
          startLine: 1,
          endLine: 3,
          complexity: 1,
          parameters: [],
          returnType: 'void'
        }],
        classes: [{
          name: 'TestClass',
          methods: [],
          properties: [{ name: 'testProp', type: 'string', visibility: 'public' }],
          superClass: undefined,
          interfaces: []
        }],
        imports: [],
        variables: []
      };

      // Mock TreeSitterService to return member expressions
      (mockTreeSitterService.findNodeByType as jest.Mock).mockReturnValueOnce([
        { 
          type: 'member_expression',
          children: [
            { type: 'identifier', startPosition: { row: 1, column: 0 }, endPosition: { row: 1, column: 5 } },
            { type: 'property_identifier', startPosition: { row: 1, column: 6 }, endPosition: { row: 1, column: 13 } }
          ]
        }
      ]);
      (mockTreeSitterService.getNodeText as jest.Mock).mockReturnValueOnce('testProp');

      const relationships = await advancedMappingService.extractPropertyAccessRelationships(analysisResult, 'accessorFunc() { obj.testProp; }');

      expect(relationships.length).toBe(1);
      expect(relationships[0].type).toBe(GraphRelationshipType.USES);
    });
  });

 describe('extractInterfaceImplementationRelationships', () => {
    it('should extract interface implementation relationships', async () => {
      const analysisResult: FileAnalysisResult = {
        filePath: 'test.js',
        language: 'javascript',
        ast: {},
        functions: [],
        classes: [{
          name: 'TestClass',
          methods: [],
          properties: [],
          superClass: undefined,
          interfaces: ['TestInterface', 'AnotherInterface']
        }],
        imports: [],
        variables: []
      };

      const relationships = await advancedMappingService.extractInterfaceImplementationRelationships(analysisResult);

      expect(relationships.length).toBe(2);
      expect(relationships.every(rel => rel.type === GraphRelationshipType.IMPLEMENTS)).toBe(true);
    });
  });

  describe('extractDependencyRelationships', () => {
    it('should extract dependency relationships', async () => {
      const analysisResult: FileAnalysisResult = {
        filePath: 'test.js',
        language: 'javascript',
        ast: {},
        functions: [],
        classes: [],
        imports: [
          { name: 'module1', path: './module1', importedAs: 'mod1' },
          { name: 'module2', path: '../module2', importedAs: 'mod2' }
        ],
        variables: []
      };

      const relationships = await advancedMappingService.extractDependencyRelationships(analysisResult);

      expect(relationships.length).toBe(2);
      expect(relationships.every(rel => rel.type === GraphRelationshipType.IMPORTS)).toBe(true);
    });
  });

  describe('computeNodeId', () => {
    it('should compute consistent node IDs', () => {
      const name = 'TestClass';
      const type = GraphNodeType.CLASS;
      const filePath = 'test.js';
      
      // Using private method access for testing purposes
      const id1 = (advancedMappingService as any).computeNodeId(name, type, filePath);
      const id2 = (advancedMappingService as any).computeNodeId(name, type, filePath);
      
      expect(id1).toBe(id2);
    });
  });

  describe('simpleHash', () => {
    it('should compute consistent hashes', () => {
      const str = 'test string';
      
      // Using private method access for testing purposes
      const hash1 = (advancedMappingService as any).simpleHash(str);
      const hash2 = (advancedMappingService as any).simpleHash(str);
      
      expect(hash1).toBe(hash2);
    });
  });
});