import Parser from 'tree-sitter';
import { ParserFacade } from '../../parse/ParserFacade';
import { ICacheService } from '../../../../../infrastructure/caching/types';

// Mock the cache service
const mockCacheService = {
  getFromCache: jest.fn(),
  setCache: jest.fn(),
  deleteByPattern: jest.fn(),
  clearAllCache: jest.fn(),
  getCacheStats: jest.fn()
} as any;

// Mock the logger
jest.mock('../../../../../utils/LoggerService', () => ({
  LoggerService: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('ParserFacade', () => {
  let parserFacade: ParserFacade;

  beforeEach(() => {
    jest.clearAllMocks();
    parserFacade = new ParserFacade(mockCacheService);
  });

  describe('Constructor', () => {
    it('should initialize with cache service', () => {
      expect(parserFacade).toBeInstanceOf(ParserFacade);
    });
  });

  describe('parseCode', () => {
    it('should parse code and return AST', async () => {
      const code = 'function test() { return 42; }';
      const language = 'javascript';

      // Mock the internal parsing
      const mockAST = { type: 'Program' } as Parser.SyntaxNode;
      jest.spyOn(parserFacade.getDynamicManager(), 'parseCode').mockResolvedValue({
        ast: mockAST,
        language: { name: language, supported: true, fileExtensions: ['.js'] },
        parseTime: 10,
        success: true
      });

      const result = await parserFacade.parseCode(code, language);
      expect(result).toBe(mockAST);
    });

    it('should throw error when parsing fails', async () => {
      const code = 'invalid code';
      const language = 'javascript';

      jest.spyOn(parserFacade.getDynamicManager(), 'parseCode').mockResolvedValue({
        ast: {} as Parser.SyntaxNode,
        language: { name: language, supported: true, fileExtensions: ['.js'] },
        parseTime: 10,
        success: false,
        error: 'Parse error'
      });

      await expect(parserFacade.parseCode(code, language)).rejects.toThrow('解析失败: Parse error');
    });
  });

  describe('parseFile', () => {
    it('should parse file and return AST', async () => {
      const filePath = 'test.js';
      const content = 'function test() { return 42; }';

      const mockAST = { type: 'Program' } as Parser.SyntaxNode;
      jest.spyOn(parserFacade.getDynamicManager(), 'parseFile').mockResolvedValue({
        ast: mockAST,
        language: { name: 'javascript', supported: true, fileExtensions: ['.js'] },
        parseTime: 10,
        success: true
      });

      const result = await parserFacade.parseFile(filePath, content);
      expect(result).toBe(mockAST);
    });
  });

  describe('detectLanguage', () => {
    it('should detect language from file path', async () => {
      const filePath = 'test.js';

      jest.spyOn(parserFacade.getDynamicManager(), 'detectLanguage').mockResolvedValue('javascript');

      const result = await parserFacade.detectLanguage(filePath);
      expect(result).toBe('javascript');
    });

    it('should return null for unsupported file', async () => {
      const filePath = 'test.unknown';

      jest.spyOn(parserFacade.getDynamicManager(), 'detectLanguage').mockResolvedValue(null);

      const result = await parserFacade.detectLanguage(filePath);
      expect(result).toBeNull();
    });
  });

  describe('findFunctions', () => {
    it('should find functions in AST', async () => {
      const ast = { type: 'Program' } as Parser.SyntaxNode;
      const language = 'javascript';

      const mockFunctions = [
        {
          type: 'entity' as const,
          id: 'func_1',
          entityType: 'function',
          name: 'test',
          priority: 3,
          location: { startLine: 1, startColumn: 0, endLine: 1, endColumn: 30 },
          content: 'function test() { return 42; }',
          filePath: 'test.js',
          language: language,
          properties: {}
        }
      ];

      jest.spyOn(parserFacade.getQueryService(), 'findFunctions').mockResolvedValue(mockFunctions as any);

      const result = await parserFacade.findFunctions(ast, language);
      expect(result).toEqual(mockFunctions);
    });
  });

  describe('findClasses', () => {
    it('should find classes in AST', async () => {
      const ast = { type: 'Program' } as Parser.SyntaxNode;
      const language = 'javascript';

      const mockClasses = [
        {
          type: 'entity' as const,
          id: 'class_1',
          entityType: 'type_definition',
          name: 'TestClass',
          priority: 3,
          location: { startLine: 1, startColumn: 0, endLine: 10, endColumn: 1 },
          content: 'class TestClass {}',
          filePath: 'test.js',
          language: language,
          properties: {}
        }
      ];

      jest.spyOn(parserFacade.getQueryService(), 'findClasses').mockResolvedValue(mockClasses as any);

      const result = await parserFacade.findClasses(ast, language);
      expect(result).toEqual(mockClasses);
    });
  });

  describe('analyzeCode', () => {
    it('should perform complete code analysis', async () => {
      const code = 'function test() { return 42; }';
      const language = 'javascript';

      const mockAST = { type: 'Program' } as Parser.SyntaxNode;
      const mockFunctions = [
        {
          type: 'entity',
          node: { type: 'function_definition' },
          metadata: { type: 'entity', category: 'function', priority: 3, languages: [language] },
          captures: [],
          name: 'test'
        }
      ];

      jest.spyOn(parserFacade, 'parseCode').mockResolvedValue(mockAST);
      jest.spyOn(parserFacade, 'findAllEntities').mockResolvedValue({
        macros: [],
        types: [],
        functions: mockFunctions as any,
        variables: [],
        comments: []
      });
      jest.spyOn(parserFacade, 'findAllRelationships').mockResolvedValue({
        calls: [],
        dependencies: [],
        inheritance: [],
        dataFlow: [],
        controlFlow: []
      });

      const result = await parserFacade.analyzeCode(code, language);
      
      expect(result.entities.functions).toEqual(mockFunctions);
      expect(result.totalResults).toBe(1);
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages', () => {
      const mockLanguages = [
        { name: 'javascript', supported: true, fileExtensions: ['.js'] },
        { name: 'typescript', supported: true, fileExtensions: ['.ts'] }
      ];

      jest.spyOn(parserFacade.getDynamicManager(), 'getSupportedLanguages').mockReturnValue(mockLanguages);

      const result = parserFacade.getSupportedLanguages();
      expect(result).toEqual(mockLanguages);
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported language', () => {
      jest.spyOn(parserFacade.getDynamicManager(), 'isLanguageSupported').mockReturnValue(true);

      const result = parserFacade.isLanguageSupported('javascript');
      expect(result).toBe(true);
    });

    it('should return false for unsupported language', () => {
      jest.spyOn(parserFacade.getDynamicManager(), 'isLanguageSupported').mockReturnValue(false);

      const result = parserFacade.isLanguageSupported('unknown');
      expect(result).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should clear all caches', () => {
      const clearSpy = jest.spyOn(parserFacade.getCacheService(), 'clearAll');
      
      parserFacade.clearAll();
      
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('getCompleteStats', () => {
    it('should return complete statistics', () => {
      const centralizedCacheStats = {
        totalEntries: 100,
        hitCount: 80,
        missCount: 20,
        hitRate: 0.8
      };
      const mockCacheStats = { 
        hits: 10, 
        misses: 5, 
        evictions: 0,
        totalRequests: 15,
        hitRate: '66.67%',
        centralizedCacheStats
      };
      const mockQueryStats = { 
        totalQueries: 15, 
        successfulQueries: 14, 
        failedQueries: 1,
        cacheHits: 10,
        cacheMisses: 5,
        averageExecutionTime: 10,
        totalExecutionTime: 150
      };
      const mockParserStats = { 
        totalParseTime: 100, 
        totalParseCount: 10,
        averageParseTime: 10,
        maxParseTime: 20,
        minParseTime: 5,
        totalQueryTime: 150,
        totalQueryCount: 15,
        averageQueryTime: 10
      };

      jest.spyOn(parserFacade.getCacheService(), 'getCompleteStats').mockReturnValue({
        cache: mockCacheStats,
        performance: mockParserStats,
        config: { parserCacheTTL: 1800000, astCacheTTL: 600000, queryCacheTTL: 300000, nodeCacheSize: 1000 }
      });
      jest.spyOn(parserFacade.getQueryService(), 'getQueryStats').mockReturnValue(mockQueryStats);
      jest.spyOn(parserFacade.getDynamicManager(), 'getPerformanceStats').mockReturnValue({
        ...mockParserStats,
        cacheStats: mockCacheStats
      });

      const result = parserFacade.getCompleteStats();
      
      expect(result.cache).toBeDefined();
      expect(result.query).toEqual(mockQueryStats);
      expect(result.parser).toBeDefined();
      expect(result.initialized).toBeDefined();
    });
  });
});