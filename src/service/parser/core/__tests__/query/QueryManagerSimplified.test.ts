import Parser from 'tree-sitter';
import { QueryManager } from '../../query/QueryManager';

// Mock Parser for testing
const mockParser = {
  getLanguage: () => ({ name: 'typescript' })
} as unknown as Parser;

// Mock Parser.Query for testing
const mockQuery = {
  matches: jest.fn(() => [])
};

// Mock Parser.Query constructor
jest.mock('tree-sitter', () => ({
  Query: jest.fn(() => mockQuery)
}));

describe('QueryManager Simplified', () => {
  beforeEach(async () => {
    QueryManager.clearCache();
    await QueryManager.initialize();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize successfully', async () => {
      expect(QueryManager.getSupportedLanguages()).toContain('typescript');
      expect(QueryManager.getSupportedLanguages()).toContain('javascript');
    });

    test('should not initialize twice', async () => {
      const firstInit = await QueryManager.initialize();
      const secondInit = await QueryManager.initialize();
      
      expect(firstInit).toBeUndefined();
      expect(secondInit).toBeUndefined();
    });
  });

  describe('Query Pattern Retrieval', () => {
    test('should get query pattern for supported type', () => {
      const pattern = QueryManager.getQueryPattern('typescript', 'functions');
      expect(pattern).toBeTruthy();
      expect(pattern).toContain('function_declaration');
    });

    test('should return null for unsupported query type', () => {
      const pattern = QueryManager.getQueryPattern('typescript', 'nonexistent');
      expect(pattern).toBeNull();
    });

    test('should get query string asynchronously', async () => {
      const queryString = await QueryManager.getQueryString('typescript', 'functions');
      expect(queryString).toBeTruthy();
      expect(queryString).toContain('function_declaration');
    });

    test('should throw error for unsupported query type in async method', async () => {
      await expect(QueryManager.getQueryString('typescript', 'nonexistent'))
        .rejects.toThrow();
    });
  });

  describe('Query Support Checks', () => {
    test('should check if language is supported', () => {
      expect(QueryManager.isSupported('typescript')).toBe(true);
      expect(QueryManager.isSupported('nonexistent')).toBe(false);
    });

    test('should check if specific query type is supported', () => {
      expect(QueryManager.isSupported('typescript', 'functions')).toBe(true);
      expect(QueryManager.isSupported('typescript', 'nonexistent')).toBe(false);
    });

    test('should get query types for language', () => {
      const queryTypes = QueryManager.getQueryTypesForLanguage('typescript');
      expect(queryTypes).toContain('functions');
      expect(queryTypes).toContain('classes');
    });
  });

  describe('Query Execution', () => {
    test('should execute query successfully', () => {
      const mockAST = {
        type: 'program',
        children: []
      } as Parser.SyntaxNode;

      const results = QueryManager.executeQuery(mockAST, 'typescript', 'functions', mockParser);
      expect(Array.isArray(results)).toBe(true);
      expect(mockQuery.matches).toHaveBeenCalledWith(mockAST);
    });

    test('should handle query execution errors gracefully', () => {
      const mockAST = {
        type: 'program',
        children: []
      } as Parser.SyntaxNode;

      // Mock Query to throw error
      (Parser.Query as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Query creation failed');
      });

      const results = QueryManager.executeQuery(mockAST, 'typescript', 'functions', mockParser);
      expect(results).toEqual([]);
    });

    test('should execute batch queries', () => {
      const mockAST = {
        type: 'program',
        children: []
      } as Parser.SyntaxNode;

      const results = QueryManager.executeBatchQueries(
        mockAST, 
        'typescript', 
        ['functions', 'classes'], 
        mockParser
      );
      
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(2);
      expect(results.has('functions')).toBe(true);
      expect(results.has('classes')).toBe(true);
    });
  });

  describe('Query Combination', () => {
    test('should combine multiple query patterns', () => {
      const combined = QueryManager.combinePatterns('typescript', ['functions', 'classes']);
      expect(combined).toContain('function_declaration');
      expect(combined).toContain('class_declaration');
    });

    test('should handle empty query type list', () => {
      const combined = QueryManager.combinePatterns('typescript', []);
      expect(combined).toBe('');
    });

    test('should handle non-existent query types in combination', () => {
      const combined = QueryManager.combinePatterns('typescript', ['functions', 'nonexistent']);
      expect(combined).toContain('function_declaration');
      expect(combined).not.toContain('nonexistent');
    });
  });

  describe('Caching', () => {
    test('should cache query patterns', () => {
      // First call
      const pattern1 = QueryManager.getQueryPattern('typescript', 'functions');
      
      // Second call should use cache
      const pattern2 = QueryManager.getQueryPattern('typescript', 'functions');
      
      expect(pattern1).toBe(pattern2);
    });

    test('should provide cache statistics', () => {
      // Generate some cache activity
      QueryManager.getQueryPattern('typescript', 'functions');
      QueryManager.getQueryPattern('typescript', 'classes');
      
      const stats = QueryManager.getCacheStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('queryCacheSize');
      expect(stats).toHaveProperty('patternCacheSize');
    });

    test('should clear cache', () => {
      // Generate some cache activity
      QueryManager.getQueryPattern('typescript', 'functions');
      
      let stats = QueryManager.getCacheStats();
      expect(stats.patternCacheSize).toBeGreaterThan(0);
      
      QueryManager.clearCache();
      
      stats = QueryManager.getCacheStats();
      expect(stats.patternCacheSize).toBe(0);
      expect(stats.queryCacheSize).toBe(0);
    });

    test('should clear all caches', () => {
      // Generate some cache activity
      QueryManager.getQueryPattern('typescript', 'functions');
      
      QueryManager.clearAllCaches();
      
      const stats = QueryManager.getCacheStats();
      expect(stats.patternCacheSize).toBe(0);
      expect(stats.queryCacheSize).toBe(0);
    });
  });

  describe('Statistics and Information', () => {
    test('should provide query statistics', () => {
      const stats = QueryManager.getQueryStats();
      expect(stats).toHaveProperty('initialized');
      expect(stats).toHaveProperty('totalLanguages');
      expect(stats).toHaveProperty('totalPatterns');
    });

    test('should provide loader statistics', () => {
      const stats = QueryManager.getLoaderStats();
      expect(stats).toHaveProperty('loadedLanguages');
      expect(stats).toHaveProperty('totalQueries');
      expect(stats).toHaveProperty('languages');
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors gracefully', async () => {
      // Clear initialization to force re-initialization
      (QueryManager as any).initialized = false;
      
      // This should not throw even if there are issues
      await expect(QueryManager.initialize()).resolves.toBeUndefined();
    });

    test('should handle unsupported operations gracefully', () => {
      expect(QueryManager.isSupported('nonexistent')).toBe(false);
      expect(QueryManager.getQueryTypesForLanguage('nonexistent')).toEqual([]);
    });
  });
});