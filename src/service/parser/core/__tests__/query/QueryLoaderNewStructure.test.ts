import { QueryLoader } from '../../query/QueryLoader';

describe('QueryLoader New Structure', () => {
  beforeEach(async () => {
    QueryLoader.clearAllQueries();
  });

  test('should load queries from new directory structure', async () => {
    await QueryLoader.loadLanguageQueries('typescript');
    
    expect(QueryLoader.isLanguageLoaded('typescript')).toBe(true);
    expect(QueryLoader.hasQueryType('typescript', 'functions')).toBe(true);
    expect(QueryLoader.hasQueryType('typescript', 'classes')).toBe(true);
  });

  test('should load queries for multiple languages', async () => {
    await QueryLoader.loadLanguageQueries('typescript');
    await QueryLoader.loadLanguageQueries('javascript');
    await QueryLoader.loadLanguageQueries('python');
    
    expect(QueryLoader.isLanguageLoaded('typescript')).toBe(true);
    expect(QueryLoader.isLanguageLoaded('javascript')).toBe(true);
    expect(QueryLoader.isLanguageLoaded('python')).toBe(true);
  });

  test('should get query types for language', async () => {
    await QueryLoader.loadLanguageQueries('typescript');
    
    const queryTypes = QueryLoader.getQueryTypesForLanguage('typescript');
    expect(queryTypes).toContain('functions');
    expect(queryTypes).toContain('classes');
    expect(queryTypes).toContain('imports');
    expect(queryTypes).toContain('exports');
  });

  test('should retrieve specific query patterns', async () => {
    await QueryLoader.loadLanguageQueries('typescript');
    
    const functionsQuery = QueryLoader.getQuery('typescript', 'functions');
    const classesQuery = QueryLoader.getQuery('typescript', 'classes');
    
    expect(functionsQuery).toContain('function_declaration');
    expect(classesQuery).toContain('class_declaration');
  });

  test('should handle missing query types gracefully', async () => {
    await QueryLoader.loadLanguageQueries('typescript');
    
    expect(() => QueryLoader.getQuery('typescript', 'nonexistent')).toThrow();
    expect(QueryLoader.hasQueryType('typescript', 'nonexistent')).toBe(false);
  });

  test('should provide statistics', async () => {
    await QueryLoader.loadLanguageQueries('typescript');
    await QueryLoader.loadLanguageQueries('javascript');
    
    const stats = QueryLoader.getStats();
    expect(stats.loadedLanguages).toBe(2);
    expect(stats.totalQueries).toBeGreaterThan(0);
    expect(stats.languages).toContain('typescript');
    expect(stats.languages).toContain('javascript');
    expect(stats.languageStats).toHaveProperty('typescript');
    expect(stats.languageStats).toHaveProperty('javascript');
  });

  test('should validate query syntax', () => {
    const validQuery = '(function_declaration name: (identifier) @name) @function';
    const invalidQuery = '(function_declaration name: (identifier) @name @function';
    
    const validResult = QueryLoader.validateQuerySyntax(validQuery);
    const invalidResult = QueryLoader.validateQuerySyntax(invalidQuery);
    
    expect(validResult.valid).toBe(true);
    expect(validResult.errors).toHaveLength(0);
    
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });

  test('should reload language queries', async () => {
    await QueryLoader.loadLanguageQueries('typescript');
    
    const initialStats = QueryLoader.getStats();
    expect(initialStats.loadedLanguages).toBe(1);
    
    await QueryLoader.reloadLanguageQueries('typescript');
    
    const reloadedStats = QueryLoader.getStats();
    expect(reloadedStats.loadedLanguages).toBe(1);
    expect(QueryLoader.isLanguageLoaded('typescript')).toBe(true);
  });

  test('should preload common languages', async () => {
    await QueryLoader.preloadCommonLanguages();
    
    const stats = QueryLoader.getStats();
    expect(stats.loadedLanguages).toBeGreaterThan(0);
    expect(stats.languages).toContain('typescript');
    expect(stats.languages).toContain('javascript');
    expect(stats.languages).toContain('python');
  });

  test('should handle batch loading', async () => {
    const languages = ['typescript', 'javascript', 'python'];
    await QueryLoader.loadMultipleLanguages(languages);
    
    for (const lang of languages) {
      expect(QueryLoader.isLanguageLoaded(lang)).toBe(true);
    }
  });

  test('should clear all queries', async () => {
    await QueryLoader.loadLanguageQueries('typescript');
    await QueryLoader.loadLanguageQueries('javascript');
    
    expect(QueryLoader.getLoadedLanguages().length).toBeGreaterThan(0);
    
    QueryLoader.clearAllQueries();
    
    expect(QueryLoader.getLoadedLanguages().length).toBe(0);
    expect(QueryLoader.getStats().loadedLanguages).toBe(0);
  });
});