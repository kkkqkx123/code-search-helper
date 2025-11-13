import { ASTStructureExtractor } from '../ASTStructureExtractor';
import { ASTStructureExtractorFactory } from '../ASTStructureExtractorFactory';
import { UnifiedContentAnalyzer } from '../ContentAnalyzer';
import { StructureTypeConverter } from '../utils/StructureTypeConverter';
import { QueryResultNormalizer } from '../QueryResultNormalizer';
import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';
import { TopLevelStructure, NestedStructure, InternalStructure } from '../../../../utils/types/ContentTypes';
import { StandardizedQueryResult } from '../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { Container } from 'inversify';
import { TYPES } from '../../../../types';
import Parser from 'tree-sitter';

// Mock implementations
const mockTreeSitterCoreService = {
  isInitialized: jest.fn(() => true),
  parseCode: jest.fn().mockResolvedValue({
    ast: {} as Parser.SyntaxNode,
    language: {
      name: 'typescript',
      supported: true
    },
    parseTime: 100,
    success: true
  }),
  getSupportedLanguages: jest.fn(() => [
    { name: 'typescript', supported: true },
    { name: 'javascript', supported: true },
    { name: 'python', supported: true }
  ])
} as any;

const mockQueryResultNormalizer = {
  normalize: jest.fn().mockResolvedValue([
    {
      nodeId: 'test-node-1',
      type: 'function',
      name: 'testFunction',
      startLine: 1,
      endLine: 5,
      content: 'function testFunction() { return true; }',
      metadata: {
        language: 'typescript',
        complexity: 1,
        dependencies: [],
        modifiers: []
      }
    } as StandardizedQueryResult
  ]),
  getSupportedQueryTypes: jest.fn().mockResolvedValue(['functions', 'classes', 'methods']),
  mapNodeType: jest.fn((nodeType: string, language: string) => nodeType),
  getStats: jest.fn(() => ({
    totalNodes: 0,
    successfulNormalizations: 0,
    failedNormalizations: 0,
    processingTime: 0,
    cacheHitRate: 0,
    typeStats: {}
  })),
  clearCache: jest.fn(),
  updateOptions: jest.fn()
} as any;

const mockLoggerService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
} as any;

describe('ASTStructureExtractor', () => {
  let container: Container;
  let astStructureExtractor: ASTStructureExtractor;
  let mockAST: Parser.SyntaxNode;

  beforeEach(() => {
    container = new Container();

    // Bind mock services
    container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind<QueryResultNormalizer>(TYPES.QueryResultNormalizer).toConstantValue(mockQueryResultNormalizer);
    container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).toConstantValue(mockTreeSitterService);

    // Create ASTStructureExtractor through factory
    const factory = new ASTStructureExtractorFactory(
      mockQueryResultNormalizer,
      mockTreeSitterService
    );
    astStructureExtractor = factory.getInstance();

    // Create mock AST
    mockAST = {
      type: 'source_file',
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 10, column: 0 },
      text: 'function testFunction() { return true; }',
      children: []
    } as Parser.SyntaxNode;
  });

  describe('extractTopLevelStructuresFromAST', () => {
    it('should extract top level structures successfully', async () => {
      const content = 'function testFunction() { return true; }';
      const language = 'typescript';

      const result = await astStructureExtractor.extractTopLevelStructuresFromAST(content, language, mockAST);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty AST gracefully', async () => {
      const content = '';
      const language = 'typescript';
      const emptyAST = {
        type: 'ERROR',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 0 },
        text: '',
        children: []
      } as Parser.SyntaxNode;

      const result = await astStructureExtractor.extractTopLevelStructuresFromAST(content, language, emptyAST);

      expect(result).toEqual([]);
    });

    it('should use cache when enabled', async () => {
      const content = 'function testFunction() { return true; }';
      const language = 'typescript';

      // First call
      const result1 = await astStructureExtractor.extractTopLevelStructuresFromAST(content, language, mockAST);

      // Second call should use cache
      const result2 = await astStructureExtractor.extractTopLevelStructuresFromAST(content, language, mockAST);

      expect(result1).toEqual(result2);
    });

    it('should handle different languages', async () => {
      const content = 'function testFunction() { return true; }';

      const typescriptResult = await astStructureExtractor.extractTopLevelStructuresFromAST(content, 'typescript', mockAST);
      const javascriptResult = await astStructure.extractTopLevelStructures.py(content, 'javascript', mockAST);

      expect(typescriptResult).toBeDefined();
      expect(javascriptResult).toBeDefined();
    });
  });

  describe('extractNestedStructuresFromAST', () => {
    it('should extract nested structures successfully', async () => {
      const content = 'function testFunction() { if (true) { return true; } }';
      const language = 'typescript';
      const parentNode = mockAST;

      const result = await astStructureExtractor.extractNestedStructuresFromAST(content, parentNode, 1, mockAST);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should respect nesting level limit', async () => {
      const content = 'function testFunction() { if (true) { if (true) { return true; } } } }';
      const parentNode = mockAST;

      const level1Result = await astStructureExtractor.extractNestedStructuresFromAST(content, parentNode, 1, mockAST);
      const level2Result = await astStructureExtractor.extractNestedStructuresFromAST(content, parentNode, 2, mockAST);

      expect(level1Result.length).toBeGreaterThanOrEqual(level2Result.length);
    });
  });

  describe('extractInternalStructuresFromAST', () => {
    it('should extract internal structures successfully', async () => {
      const content = 'function testFunction() { const x = 1; return x; }';
      const parentNode = mockAST;

      const result = await astStructureExtractor.extractInternalStructuresFromAST(content, parentNode, mockAST);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should identify variable declarations', async () => {
      const content = 'function testFunction() { const x = 1; let y = 2; return x + y; }';
      const parentNode = mockAST;

      const result = await astStructureExtractor.extractInternalStructuresFromAST(content, parentNode, mockAST);

      const variableStructures = result.filter(s => s.type === 'variable');
      expect(variableStructures.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Caching', () => {
    it('should track cache statistics', () => {
      const stats = astStructureExtractor.getCacheStats();
      expect(stats).toBeDefined();
    });

    it('should clear cache successfully', () => {
      expect(() => astStructureExtractor.clearCache()).not.toThrow();
    });

    it('should track performance statistics', () => {
      const stats = astStructureExtractor.getPerformanceStats();
      expect(stats).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle parsing errors gracefully', async () => {
      const content = 'invalid syntax';
      const language = 'typescript';

      // Mock parseCode to throw an error
      mockTreeSitterService.parseCode.mockRejectedValue(new Error('Parse error'));

      const result = await astStructureExtractor.extractTopLevelStructuresFromAST(content, language, mockAST);

      expect(result).toEqual([]);
    });

    it('should use fallback when normalization fails', async () => {
      const content = 'function testFunction() { return true; }';
      const language = 'unsupported-language';

      // Mock normalize to throw an error
      mockQueryResultNormalizer.normalize.mockRejectedValue(new Error('Normalization error'));

      const result = await astStructureExtractor.extractTopLevelStructuresFromAST(content, language, mockAST);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

describe('ASTStructureExtractorFactory', () => {
  let factory: ASTStructureExtractorFactory;
  let container: Container;

  beforeEach(() => {
    container = new Container();

    // Bind mock services
    container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind<QueryResultNormalizer>(TYPES.QueryResultNormalizer).toConstantValue(mockQueryResultNormalizer);
    container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).toConstantValue(mockTreeSitterCoreService);

    factory = new ASTStructureExtractorFactory(
      mockQueryResultNormalizer,
      mockTreeSitterService
    );
  });

  describe('Instance Management', () => {
    it('should create singleton instance', () => {
      const instance1 = factory.getInstance();
      const instance2 = factory.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance when requested', () => {
      const instance1 = factory.getInstance();
      const instance2 = factory.createInstance();

      expect(instance1).not.toBe(instance2);
    });

    it('should reset instance successfully', () => {
      const instance1 = factory.getInstance();
      factory.resetInstance();
      const instance2 = factory.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Configuration', () => {
    it('should update options correctly', () => {
      const originalOptions = factory.getOptions();

      factory.updateOptions({
        enableCache: false,
        debug: true
      });

      const updatedOptions = factory.getOptions();

      expect(updatedOptions.enableCache).toBe(false);
      expect(updatedOptions.debug).toBe(true);
      expect(updatedOptions.enablePerformanceMonitoring).toBe(originalOptions.enablePerformanceMonitoring);
    });

    it('should validate configuration', () => {
      const health = factory.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details.queryNormalizer).toBe(true);
      expect(health.details.treeSitterService).toBe(true);
      expect(health.details.instance).toBe(false); // No instance yet
    });
  });

  describe('Statistics', () => {
    it('should provide comprehensive stats', () => {
      const stats = factory.getStats();

      expect(stats.hasInstance).toBe(false);
      expect(stats.options).toBeDefined();
    });

    it('should track cache and performance stats when instance exists', () => {
      const instance = factory.getInstance();
      const stats = factory.getStats();

      expect(stats.hasInstance).toBe(true);
      expect(stats.cacheStats).toBeDefined();
      expect(stats.performanceStats).toBeDefined();
    });
  });

  describe('Resource Management', () => {
    it('should dispose resources properly', () => {
      expect(() => factory.dispose()).not.toThrow();
    });

    it('should warm up successfully', async () => {
      await factory.warmup();

      const health = factory.healthCheck();
      expect(healthy.healthy).toBe(true);
    });
  });
});
});

describe('UnifiedContentAnalyzer', () => {
  let unifiedAnalyzer: UnifiedContentAnalyzer;
  let container: Container;

  beforeEach(() => {
    container = new Container();

    // Bind all required services
    container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLoggerService);
    container.bind<QueryResultNormalizer>(TYPES.QueryResultNormalizer).toConstantValue(mockQueryResultNormalizer);
    container.bind<TreeSitterCoreService>(TYPES.TreeSitterCoreService).toConstantValue(mockTreeSitterCoreService);

    // Create ASTStructureExtractor
    const factory = new ASTStructureExtractorFactory(
      mockQueryResultNormalizer,
      mockTreeSitterCoreService
    );
    const astStructureExtractor = factory.getInstance();

    container.bind<ASTStructureExtractor>(TYPES.ASTStructureExtractor).toConstantValue(astStructureExtractor);

    unifiedAnalyzer = new UnifiedContentAnalyzer(
      mockQueryResultNormalizer,
      mockTreeSitterCoreService,
      astStructureExtractor
    );
  });

  describe('extractAllStructures', () => {
    it('should extract all structure types', async () => {
      const content = `
        function topLevelFunction() {
          return 'top level';
        }
        
        class TopLevelClass {
          constructor() {}
          nestedMethod() {
            return 'nested method';
          }
        }
      `;
      const language = 'typescript';

      const result = await unifiedAnalyzer.extractAllStructures(content, language, {
        includeTopLevel: true,
        includeNested: true,
        includeInternal: true,
        maxNestingLevel: 3
      });

      expect(result.topLevelStructures.length).toBeGreaterThan(0);
      expect(result.nestedStructures.length).toBeGreaterThan(0);
      expect(result.internalStructures.length).toBeGreaterThanOrEqual(0);
      expect(result.stats.totalStructures).toBeGreaterThan(0);
    });

    it('should respect extraction options', async () => {
      const content = `
        function topLevelFunction() {
          return 'top level';
        }
        
        class TopLevelClass {
          constructor() {}
          nestedMethod() {
            return 'nested method';
          }
        }
      `;
      const language = 'typescript';

      const result1 = await unifiedAnalyzer.extractAllStructures(content, language, {
        includeTopLevel: true,
        includeNested: false,
        includeInternal: false
      });

      expect(result1.topLevelStructures.length).toBeGreaterThan(0);
      expect(result1.nestedStructures.length).toBe(0);
      expect(result1.internalStructures.length).toBe(0);

      const result2 = await unifiedAnalyzer.extractAllStructures(content, language, {
        includeTopLevel: false,
        includeNested: true,
        includeInternal: true
      });

      expect(result2.topLevelStructures.length).toBe(0);
      expect(result2.nestedStructures.length).toBeGreaterThan(0);
      expect(result2.internalStructures.length).toBeGreaterThan(0);
    });

    it('should use cache when enabled', async () => {
      const content = 'function testFunction() { return true; }';
      const language = 'typescript';

      const result1 = await unifiedAnalyzer.extractAllStructures(content, language, {
        enableCache: true
      });

      const result2 = await unifiedAnalyzer.extractAllStructures(content, language, {
        enableCache: true
      });

      expect(result1.stats.cacheHit).toBe(false);
      expect(result2.stats.cacheHit).toBe(true);
    });

    it('should track processing time', async () => {
      const content = 'function testFunction() { return true; }';
      const language = 'typescript';

      const result = await unifiedAnalyzer.extractAllStructures(content, language);

      expect(result.stats.processingTime).toBeGreaterThan(0);
    });
  });

  describe('extractWithRelationships', () => {
    it('should extract structures with relationships', async () => {
      const content = `
        function functionA() {
          return functionB();
        }
        
        function functionB() {
          return 'result';
        }
        
        class ClassA {
          methodA() {
            return ClassB.methodB();
          }
        }
        
        class ClassB {
          methodB() {
            return 'result';
          }
        }
      `;
      const language = 'typescript';

      const result = await unifiedAnalyzer.extractWithRelationships(content, language);

      expect(result.topLevelStructures.length).toBeGreaterThan(0);
      expect(result.relationships.nesting.length).toBeGreaterThanOrEqual(0));
    expect(result.relationships.references.length).toBeGreaterThanOrEqual(0));
  expect(result.relationships.dependencies.length).toBeGreaterThanOrEqual(0));
expect(result.stats.totalRelationships).toBeGreaterThanOrEqual(0));
    });

it('should analyze nesting relationships correctly', async () => {
  const content = `
        class ParentClass {
          childMethod() {
            return 'child result';
          }
        }
      `;
  const language = 'typescript';

  const result = await unifiedAnalyzer.extractWithRelationships(content, language);

  const nestingRelationships = result.relationships.nesting;
  expect(nestingRelationships.length).toBeGreaterThan(0);

  const parentChildRelation = nestingRelationships.find(r =>
    r.parent === 'ParentClass' && r.child === 'childMethod'
  );
  expect(parentChildRelation).toBeDefined();
  expect(parentChildRelation.type).toBe('contains');
});
  });

describe('Error Handling', () => {
  it('should handle parsing errors gracefully', async () => {
    const content = 'invalid syntax';
    const language = 'typescript';

    // Mock parseCode to throw an error
    mockTreeSitterService.parseCode.mockRejectedValue(new Error('Parse error'));

    const result = await unifiedAnalyzer.extractAllStructures(content, language);

    expect(result.topLevelStructures).toEqual([]);
    expect(result.nestedStructures).toEqual([]);
    expect(result.internalStructures).toEqual([]);
    expect(result.stats.totalStructures).toBe(0);
  });

  it('should handle empty content', async () => {
    const content = '';
    const language = 'typescript';

    const result = await unifiedAnalyzer.extractAllStructures(content, language);

    expect(result.topLevelStructures).toEqual([]);
    expect(result.nestedStructures).toEqual([]);
    expect(result.internalStructures).toEqual([]);
  });
});

describe('Performance Monitoring', () => {
  it('should track cache statistics', () => {
    const stats = unifiedAnalyzer.getCacheStats();
    expect(stats).toBeDefined();
  });

  it('should track performance statistics', () => {
    const stats = unifiedAnalyzer.getPerformanceStats();
    expect(stats).toBeDefined();
  });

  it('should clear cache', () => {
    expect(() => unifiedAnalyzer.clearCache()).not.toThrow();
  });
});

describe('Health Check', () => {
  it('should perform comprehensive health check', async () => {
    const health = await unifiedAnalyzer.healthCheck();

    expect(health.healthy).toBe(true);
    expect(health.details.queryNormalizer).toBe(true);
    expect(health.details.treeSitterService).toBe(true);
    expect(health.details.astStructureExtractor).toBe(true);
  });
});
});

describe('StructureTypeConverter', () => {
  let converter: StructureTypeConverter;
  let container: Container;

  beforeEach(() => {
    container = new Container();
    converter = new StructureTypeConverter();
  });

  describe('convertToTopLevelStructures', () => {
    it('should convert standardized results to top level structures', () => {
      const standardizedResults: StandardizedQueryResult[] = [
        {
          nodeId: 'test-node-1',
          type: 'function',
          name: 'testFunction',
          startLine: 1,
          endLine: 5,
          content: 'function testFunction() { return true; }',
          metadata: {
            language: 'typescript',
            complexity: 1,
            dependencies: [],
            modifiers: []
          }
        }
      ];

      const content = 'function testFunction() { return true; }';
      const language = 'typescript';

      const result = converter.convertToTopLevelStructures(standardizedResults, content, language);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('function');
      expect(result[0].name).toBe('testFunction');
      expect(result[0].content).toBe('function testFunction() { return true; }');
      expect(result[0].location.startLine).toBe(1);
      expect(result[0].location.endLine).toBe(5);
      expect(result[0].metadata.language).toBe('typescript');
    });

    it('should handle empty results', () => {
      const standardizedResults: StandardizedResult[] = [];
      const content = 'test content';
      const language = 'typescript';

      const result = converter.convertToTopLevelStructures(standardizedResults, content, language);

      expect(result).toHaveLength(0);
    });

    it('should calculate confidence correctly', () => {
      const standardizedResults: StandardizedResult[] = [
        {
          nodeId: 'test-node-1',
          type: 'function',
          name: 'testFunction',
          startLine: 1,
          endLine: 5,
          content: 'function testFunction() { return true; }',
          metadata: {
            language: 'typescript',
            complexity: 5,
            dependencies: ['dependency1', 'dependency2'],
            modifiers: ['async', 'export']
          }
        }
      ];

      const content = 'function testFunction() { return true; }';
      const language = 'typescript';

      const result = converter.convertToTopLevelStructures(standardizedResults, content, language);

      expect(result[0].metadata.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('convertToNestedStructures', () => {
    it('should convert standardized results to nested structures', () => {
      const standardizedResults: StandardizedQueryResult[] = [
        {
          nodeId: 'test-node-1',
          type: 'method',
          name: 'testMethod',
          startLine: 2,
          endLine: 4,
          content: 'testMethod() { return true; }',
          metadata: {
            language: 'typescript',
            complexity: 2,
            dependencies: [],
            modifiers: []
          }
        }
      ];

      const content = 'class TestClass { testMethod() { return true; } }';
      const level = 2;

      const result = converter.convertToNestedStructures(standardizedResults, content, level);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('method');
      expect(result[0].name).toBe('testMethod');
      expect(result[0].level).toBe(2);
      expect(result[0].metadata.nestingLevel).toBe(2);
    });
  });

  describe('convertToInternalStructures', () => {
    it('should convert standardized results to internal structures', () => {
      const standardizedResults: StandardizedResult[] = [
        {
          nodeId: 'test-node-1',
          type: 'variable',
          name: 'testVariable',
          startLine: 1,
          endLine: 1,
          content: 'const testVariable = 1;',
          metadata: {
            language: 'typescript',
            complexity: 1,
            dependencies: [],
            modifiers: ['const']
          }
        }
      ];

      const content = 'const testVariable = 1;';

      const result = converter.convertToInternalStructures(standardizedResults, content);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('variable');
      expect(result[0].name).toBe('testVariable');
      expect(result[0].importance).toBe('medium');
    });

    it('should determine importance based on type and complexity', () => {
      const standardizedResults: StandardizedResult[] = [
        {
          nodeId: 'test-node-1',
          type: 'function',
          name: 'testFunction',
          startLine: 1,
          endLine: 10,
          content: 'function testFunction() { /* complex logic */ }',
          metadata: {
            language: 'typescript',
            complexity: 8,
            dependencies: [],
            modifiers: []
          }
        }
      ];

      const content = 'function testFunction() { /* complex logic */ }';

      const result = converter.convertToInternalStructures(standardizedResults, content);

      expect(result[0].importance).toBe('high');
    });
  });

  describe('Batch Conversion', () => {
    it('should convert multiple structures efficiently', () => {
      const standardizedResults: StandardizedResult[] = [
        {
          nodeId: 'test-node-1',
          type: 'function',
          name: 'testFunction',
          startLine: 1,
          endLine: 5,
          content: 'function testFunction() { return true; }',
          metadata: {
            language: 'typescript',
            complexity: 1,
            dependencies: [],
            modifiers: []
          }
        },
        {
          nodeId: 'test-node-2',
          type: 'class',
          name: 'TestClass',
          startLine: 7,
          endLine: 12,
          content: 'class TestClass {}',
          metadata: {
            language: 'typescript',
            complexity: 3,
            dependencies: [],
            modifiers: []
          }
        }
      ];

      const content = 'function testFunction() { return true; }\n\nclass TestClass {}';
      const language = 'typescript';

      const result = converter.batchConvert(standardizedResults, content, language, {
        includeTopLevel: true,
        includeNested: false,
        includeInternal: false
      });

      expect(result.topLevelStructures).toHaveLength(2);
      expect(result.nestedStructures).toHaveLength(0);
      expect(result.internalStructures).toHaveLength(0);
    });
  });

  describe('Validation', () => {
    it('should validate conversion results', () => {
      const standardizedResults: StandardizedResult[] = [
        {
          nodeId: 'test-node-1',
          type: 'function',
          name: 'testFunction',
          startLine: 1,
          endLine: 5,
          content: 'function testFunction() { return true; }',
          metadata: {
            language: 'typescript',
            complexity: 1,
            dependencies: [],
            modifiers: []
          }
        }
      ];

      const content = 'function testFunction() { return true; }';
      const language = 'typescript';

      const result = converter.convertToTopLevelStructures(standardizedResults, content, language);
      const validation = converter.validateConversion(result);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect validation errors', () => {
      const standardizedResults: StandardizedResult[] = [
        {
          nodeId: 'test-node-1',
          type: 'function',
          name: '', // Empty name
          startLine: 1,
          endLine: 5,
          content: 'function testFunction() { return true; }',
          metadata: {
            language: 'typescript',
            complexity: 1,
            dependencies: [],
            modifiers: []
          }
        }
      ];

      const content = 'function testFunction() { return true; }';
      const language = 'typescript';

      const result = converter.convertToTopLevelStructures(standardizedResults, content, language);
      const validation = converter.validateConversion(result);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});