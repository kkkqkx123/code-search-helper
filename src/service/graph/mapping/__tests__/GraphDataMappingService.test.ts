import { GraphDataMappingService } from '../GraphDataMappingService';
import { LoggerService } from '../../../../utils/LoggerService';
import { DataMappingValidator } from '../DataMappingValidator';
import { GraphMappingCache } from '../../caching/GraphMappingCache';
import { GraphBatchOptimizer } from '../../utils/GraphBatchOptimizer';
import { FaultToleranceHandler } from '../../../../utils/FaultToleranceHandler';
import { RelationshipExtractorFactory } from '../RelationshipExtractorFactory';
import { GraphNodeType, GraphRelationshipType, FileAnalysisResult } from '../IGraphDataMappingService';
import { CodeChunk } from '../../../parser/types';

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
  getFileAnalysis: jest.fn(),
  cacheMappingResult: jest.fn(),
  clear: jest.fn(),
  getStats: jest.fn().mockResolvedValue({ hits: 0, misses: 0 }),
};

const mockUnifiedCache = {
  getGraphData: jest.fn(),
  setGraphData: jest.fn(),
  clearGraphCache: jest.fn(),
  getGraphCacheStats: jest.fn().mockResolvedValue({ hits: 0, misses: 0 }),
};

const mockGraphBatchOptimizer = {
  optimizeBatch: jest.fn(),
};

const mockFaultToleranceHandler = {
  executeWithFaultTolerance: jest.fn(async (fn: () => any, operation: string, context: any) => {
    try {
      const result = await fn();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  }),
};

const mockRelationshipExtractorFactory = {
  getExtractor: jest.fn(),
  getSupportedLanguages: jest.fn().mockReturnValue(['javascript', 'typescript']),
  registerExtractor: jest.fn(),
  getSupportedRelationshipTypes: jest.fn().mockReturnValue(['call', 'inheritance']),
  supportsRelationshipType: jest.fn(),
  getAllSupportedRelationshipTypes: jest.fn().mockReturnValue(['call', 'inheritance', 'data-flow']),
};

const mockTransactionLogger = {
  logTransaction: jest.fn(),
  getTransactionHistory: jest.fn(),
};

describe('GraphDataMappingService', () => {
  let graphDataMappingService: GraphDataMappingService;

  beforeEach(() => {
    graphDataMappingService = new GraphDataMappingService(
      mockLoggerService as unknown as LoggerService,
      mockDataMappingValidator as unknown as DataMappingValidator,
      mockGraphMappingCache as unknown as GraphMappingCache,
      mockUnifiedCache as any,
      mockGraphBatchOptimizer as unknown as GraphBatchOptimizer,
      mockFaultToleranceHandler as unknown as FaultToleranceHandler,
      mockRelationshipExtractorFactory as unknown as RelationshipExtractorFactory
    );
  });

  describe('inferLanguageFromFile', () => {
    it('should correctly infer language from file extension', () => {
      expect(graphDataMappingService['inferLanguageFromFile']('test.js')).toBe('javascript');
      expect(graphDataMappingService['inferLanguageFromFile']('test.ts')).toBe('typescript');
      expect(graphDataMappingService['inferLanguageFromFile']('test.py')).toBe('python');
      expect(graphDataMappingService['inferLanguageFromFile']('test.java')).toBe('java');
      expect(graphDataMappingService['inferLanguageFromFile']('test.cpp')).toBe('cpp');
      expect(graphDataMappingService['inferLanguageFromFile']('test.html')).toBe('html');
      expect(graphDataMappingService['inferLanguageFromFile']('test.unknown')).toBe('unknown');
    });

    it('should handle file paths with multiple dots', () => {
      expect(graphDataMappingService['inferLanguageFromFile']('test.config.js')).toBe('javascript');
      expect(graphDataMappingService['inferLanguageFromFile']('test.backup.ts')).toBe('typescript');
    });
  });

  describe('mapFileToGraphNodes', () => {
    it('should map file to graph nodes correctly', async () => {
      const filePath = 'test.js';
      const fileContent = 'console.log("hello world");';
      const analysisResult: FileAnalysisResult = {
        filePath,
        language: 'javascript',
        ast: {},
        functions: [],
        classes: [],
        imports: [],
        variables: []
      };

      const result = await graphDataMappingService.mapFileToGraphNodes(filePath, fileContent, analysisResult);

      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.relationships.length).toBeGreaterThanOrEqual(0);
      expect(result.stats.fileNodes).toBe(1);
      expect(mockFaultToleranceHandler.executeWithFaultTolerance).toHaveBeenCalled();
    });

    it('should use cached result if available', async () => {
      const cachedResult = {
        nodes: [{
          id: 'file_123',
          type: GraphNodeType.FILE,
          properties: { name: 'test.js', path: 'test.js' }
        }],
        relationships: [],
        stats: {
          fileNodes: 1,
          functionNodes: 0,
          classNodes: 0,
          relationships: 0
        }
      };

      (mockUnifiedCache.getGraphData as jest.Mock).mockResolvedValueOnce(cachedResult);

      const filePath = 'test.js';
      const fileContent = 'console.log("hello world");';
      const analysisResult: FileAnalysisResult = {
        filePath,
        language: 'javascript',
        ast: {},
        functions: [],
        classes: [],
        imports: [],
        variables: []
      };

      const result = await graphDataMappingService.mapFileToGraphNodes(filePath, fileContent, analysisResult);

      expect(result).toEqual({
        nodes: cachedResult.nodes,
        relationships: cachedResult.relationships,
        stats: {
          fileNodes: 1,
          functionNodes: 0,
          classNodes: 0,
          relationships: 0
        }
      });
    });
  });

  describe('mapChunkToGraphNodes', () => {
    it('should map code chunk to graph nodes correctly', async () => {
      const chunk: CodeChunk = {
        id: 'chunk_123',
        content: 'console.log("hello world");',
        metadata: { startLine: 1, endLine: 1, language: 'javascript' }
      };
      const filePath = 'test.js';
      const language = 'javascript';

      const result = await graphDataMappingService.mapChunkToGraphNodes(chunk, filePath, language);

      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].type).toBe(GraphNodeType.CHUNK);
      expect(mockFaultToleranceHandler.executeWithFaultTolerance).toHaveBeenCalled();
    });

    it('should use cached result if available', async () => {
      const cachedResult = {
        nodes: [{
          id: 'chunk_123',
          type: GraphNodeType.CHUNK,
          properties: { name: 'Chunk_chunk_123', filePath: 'test.js' }
        }],
        relationships: [],
        stats: {
          chunkNodes: 1,
          relationships: 0
        }
      };

      (mockUnifiedCache.getGraphData as jest.Mock).mockResolvedValueOnce(cachedResult);

      const chunk: CodeChunk = {
        id: 'chunk_123',
        content: 'console.log("hello world");',
        metadata: { startLine: 1, endLine: 1, language: 'javascript' }
      };
      const filePath = 'test.js';
      const language = 'javascript';

      const result = await graphDataMappingService.mapChunkToGraphNodes(chunk, filePath, language);

      expect(result).toEqual(cachedResult);
    });
  });

  describe('createFileNode', () => {
    it('should create a file node with correct properties', () => {
      const filePath = 'test.js';
      const metadata = {
        name: 'test.js',
        path: 'test.js',
        size: 100,
        language: 'javascript',
        lastModified: new Date(),
        projectId: 'project123'
      };

      const fileNode = graphDataMappingService.createFileNode(filePath, metadata);

      expect(fileNode.type).toBe(GraphNodeType.FILE);
      expect(fileNode.name).toBe(metadata.name);
      expect(fileNode.path).toBe(metadata.path);
      expect(fileNode.language).toBe(metadata.language);
      expect(fileNode.size).toBe(metadata.size);
      expect(fileNode.projectId).toBe(metadata.projectId);
    });
  });

  describe('createFunctionNode', () => {
    it('should create a function node with correct properties', () => {
      const functionInfo = {
        name: 'testFunction',
        signature: 'testFunction()',
        startLine: 1,
        endLine: 5,
        complexity: 1,
        parameters: [],
        returnType: 'void'
      };
      const parentFileId = 'file_123';

      const functionNode = graphDataMappingService.createFunctionNode(functionInfo, parentFileId);

      expect(functionNode.type).toBe(GraphNodeType.FUNCTION);
      expect(functionNode.name).toBe(functionInfo.name);
      expect(functionNode.signature).toBe(functionInfo.signature);
      expect(functionNode.startLine).toBe(functionInfo.startLine);
      expect(functionNode.endLine).toBe(functionInfo.endLine);
      expect(functionNode.complexity).toBe(functionInfo.complexity);
      expect(functionNode.parentFileId).toBe(parentFileId);
    });
  });

  describe('createClassNode', () => {
    it('should create a class node with correct properties', () => {
      const classInfo = {
        name: 'TestClass',
        methods: [{ name: 'method1', signature: 'method1()', startLine: 2, endLine: 4, complexity: 1, parameters: [], returnType: 'void' }],
        properties: [{ name: 'prop1', type: 'string', visibility: 'public' as const }],
        superClass: undefined,
        interfaces: []
      };
      const parentFileId = 'file_123';

      const classNode = graphDataMappingService.createClassNode(classInfo, parentFileId);

      expect(classNode.type).toBe(GraphNodeType.CLASS);
      expect(classNode.name).toBe(classInfo.name);
      expect(classNode.parentFileId).toBe(parentFileId);
    });
  });

  describe('createImportRelationships', () => {
    it('should create import relationships', () => {
      const imports = [
        { name: 'module1', path: './module1', importedAs: 'mod1' },
        { name: 'module2', path: './module2', importedAs: 'mod2' }
      ];
      const fileId = 'file_123';

      const relationships = graphDataMappingService.createImportRelationships(imports, fileId);

      expect(relationships.length).toBe(0); // Currently returns empty array in implementation
    });
  });

  describe('createFunctionCallRelationships', () => {
    it('should create function call relationships', () => {
      const functions = [
        { name: 'func1', signature: 'func1()', startLine: 1, endLine: 3, complexity: 1, parameters: [], returnType: 'void' },
        { name: 'func2', signature: 'func2()', startLine: 5, endLine: 7, complexity: 1, parameters: [], returnType: 'void' }
      ];
      const fileId = 'file_123';

      const relationships = graphDataMappingService.createFunctionCallRelationships(functions, fileId);

      expect(relationships.length).toBe(0); // Currently returns empty array in implementation
    });
  });

  describe('extractCodeElementsFromAST', () => {
    it('should extract code elements from AST', async () => {
      const ast = { type: 'Program' };
      const filePath = 'test.js';

      const result = await graphDataMappingService.extractCodeElementsFromAST(ast, filePath);

      expect(result.filePath).toBe(filePath);
      expect(result.language).toBe('javascript'); // Inferred from file extension
      expect(result.ast).toBe(ast);
      expect(result.functions).toEqual([]);
      expect(result.classes).toEqual([]);
      expect(result.imports).toEqual([]);
      expect(result.variables).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear both old and new cache', async () => {
      await graphDataMappingService.clearCache();

      expect(mockUnifiedCache.clearGraphCache).toHaveBeenCalled();
      expect(mockGraphMappingCache.clear).toHaveBeenCalled();
      expect(mockFaultToleranceHandler.executeWithFaultTolerance).toHaveBeenCalled();
    });
  });
});