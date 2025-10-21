import { QueryRegistryImpl } from '../../query/QueryRegistry';

describe('QueryRegistry (重构后)', () => {
  beforeAll(async () => {
    await QueryRegistryImpl.initialize();
  });

  test('should initialize successfully', async () => {
    const stats = QueryRegistryImpl.getStats();
    expect(stats.initialized).toBe(true);
    expect(stats.totalLanguages).toBeGreaterThan(0);
  });

  test('should load queries for JavaScript', async () => {
    const functionQuery = await QueryRegistryImpl.getPattern('javascript', 'functions');
    expect(functionQuery).toBeTruthy();
    expect(functionQuery).toContain('function_declaration');
    
    const classQuery = await QueryRegistryImpl.getPattern('javascript', 'classes');
    expect(classQuery).toBeTruthy();
    expect(classQuery).toContain('class_declaration');
  });

  test('should support sync pattern retrieval', () => {
    const functionQuery = QueryRegistryImpl.getPatternSync('javascript', 'functions');
    expect(functionQuery).toBeTruthy();
  });

  test('should return null for unsupported language', async () => {
    const query = await QueryRegistryImpl.getPattern('nonexistent', 'functions');
    expect(query).toBeNull();
  });

  test('should return null for unsupported pattern type', async () => {
    const query = await QueryRegistryImpl.getPattern('javascript', 'nonexistent');
    expect(query).toBeNull();
  });

  test('should get patterns for language', () => {
    const patterns = QueryRegistryImpl.getPatternsForLanguage('javascript');
    expect(patterns).toHaveProperty('functions');
    expect(patterns).toHaveProperty('classes');
    expect(patterns.functions).toContain('function_declaration');
  });

  test('should get supported languages', () => {
    const languages = QueryRegistryImpl.getSupportedLanguages();
    expect(languages).toContain('javascript');
    expect(languages).toContain('typescript');
    expect(languages).toContain('python');
  });

  test('should get query types for language', () => {
    const queryTypes = QueryRegistryImpl.getQueryTypesForLanguage('javascript');
    expect(queryTypes).toContain('functions');
    expect(queryTypes).toContain('classes');
  });

  test('should check if language and pattern are supported', () => {
    expect(QueryRegistryImpl.isSupported('javascript')).toBe(true);
    expect(QueryRegistryImpl.isSupported('javascript', 'functions')).toBe(true);
    expect(QueryRegistryImpl.isSupported('nonexistent')).toBe(false);
    expect(QueryRegistryImpl.isSupported('javascript', 'nonexistent')).toBe(false);
  });

  test('should reload language queries', async () => {
    const originalQuery = await QueryRegistryImpl.getPattern('javascript', 'functions');
    await QueryRegistryImpl.reloadLanguageQueries('javascript');
    const reloadedQuery = await QueryRegistryImpl.getPattern('javascript', 'functions');
    
    expect(reloadedQuery).toBeTruthy();
    // 查询内容应该相同（除非文件被修改）
    expect(reloadedQuery).toBe(originalQuery);
  });

  test('should get all query types', () => {
    const allTypes = QueryRegistryImpl.getAllQueryTypes();
    expect(allTypes).toContain('functions');
    expect(allTypes).toContain('classes');
    expect(allTypes).toContain('imports');
    expect(allTypes).toContain('exports');
  });

  test('should clear cache', () => {
    QueryRegistryImpl.clearCache();
    // 清除后应该仍然能够获取查询
    const functionQuery = QueryRegistryImpl.getPatternSync('javascript', 'functions');
    expect(functionQuery).toBeTruthy();
  });

  test('should get transformer stats', () => {
    const stats = QueryRegistryImpl.getTransformerStats();
    expect(stats).toHaveProperty('totalQueries');
    expect(stats).toHaveProperty('cachedLanguages');
    expect(stats).toHaveProperty('languageStats');
  });

  test('should get loader stats', () => {
    const stats = QueryRegistryImpl.getLoaderStats();
    expect(stats).toHaveProperty('loadedLanguages');
    expect(stats).toHaveProperty('totalQueries');
    expect(stats).toHaveProperty('languages');
  });
});