import { QueryTransformer } from '../../query/QueryTransformer';
import { QueryLoader } from '../../query/QueryLoader';

describe('QueryTransformer', () => {
  beforeAll(async () => {
    QueryTransformer.initialize();
    // 预加载JavaScript查询用于测试
    await QueryLoader.loadLanguageQueries('javascript');
  });

  beforeEach(() => {
    QueryTransformer.clearCache();
  });

  test('should extract function patterns from JavaScript query', async () => {
    await QueryLoader.loadLanguageQueries('javascript');
    const fullQuery = QueryLoader.getQuery('javascript', 'functions');
    const functionPattern = QueryTransformer.extractPatternType(fullQuery, 'functions', 'javascript');
    
    expect(functionPattern).toBeTruthy();
    expect(functionPattern).toContain('function_declaration');
    expect(functionPattern).toContain('arrow_function');
    expect(functionPattern).toContain('function_expression');
    expect(functionPattern).not.toContain('class_declaration');
  });
test('should extract class patterns from JavaScript query', async () => {
  await QueryLoader.loadLanguageQueries('javascript');
  const fullQuery = QueryLoader.getQuery('javascript', 'classes');
  const classPattern = QueryTransformer.extractPatternType(fullQuery, 'classes', 'javascript');
  
  expect(classPattern).toBeTruthy();
  expect(classPattern).toContain('class_declaration');
  expect(classPattern).not.toContain('function_declaration');
});

  test('should cache extracted patterns', async () => {
    await QueryLoader.loadLanguageQueries('javascript');
    const fullQuery = QueryLoader.getQuery('javascript', 'functions');
    
    const result1 = QueryTransformer.extractPatternType(fullQuery, 'functions', 'javascript');
    const result2 = QueryTransformer.extractPatternType(fullQuery, 'functions', 'javascript');
    
    // 应该返回相同的引用（缓存）
    expect(result1).toBe(result2);
    
    const stats = QueryTransformer.getCacheStats();
    expect(stats.languageStats.javascript).toBe(1);
  });

  test('should return empty string for unsupported pattern type', async () => {
    await QueryLoader.loadLanguageQueries('javascript');
    const fullQuery = QueryLoader.getQuery('javascript', 'functions');
    const result = QueryTransformer.extractPatternType(fullQuery, 'nonexistent', 'javascript');
    
    expect(result).toBe('');
  });

  test('should get supported pattern types for language', () => {
    const types = QueryTransformer.getSupportedPatternTypesForLanguage('javascript');
    
    expect(types).toContain('functions');
    expect(types).toContain('classes');
    expect(types).toContain('imports');
    expect(types).toContain('exports');
  });

  test('should clear cache correctly', async () => {
    await QueryLoader.loadLanguageQueries('javascript');
    const fullQuery = QueryLoader.getQuery('javascript', 'functions');
    
    QueryTransformer.extractPatternType(fullQuery, 'functions', 'javascript');
    
    let stats = QueryTransformer.getCacheStats();
    expect(stats.totalQueries).toBe(1);
    
    QueryTransformer.clearCache();
    
    stats = QueryTransformer.getCacheStats();
    expect(stats.totalQueries).toBe(0);
  });

  test('should get all supported pattern types', () => {
    const types = QueryTransformer.getSupportedPatternTypes();
    
    expect(types).toContain('functions');
    expect(types).toContain('classes');
    expect(types).toContain('imports');
    expect(types).toContain('exports');
    expect(types).toContain('methods');
    expect(types).toContain('interfaces');
    expect(types).toContain('types');
    expect(types).toContain('properties');
    expect(types).toContain('variables');
  });

  test('should handle TypeScript queries', async () => {
    await QueryLoader.loadLanguageQueries('typescript');
    const fullQuery = QueryLoader.getQuery('typescript', 'functions');
    
    const functionPattern = QueryTransformer.extractPatternType(fullQuery, 'functions', 'typescript');
    expect(functionPattern).toBeTruthy();
    expect(functionPattern).toContain('function_declaration');
    expect(functionPattern).toContain('function_signature');
    
    const interfacePattern = QueryTransformer.extractPatternType(fullQuery, 'interfaces', 'typescript');
    expect(interfacePattern).toBeTruthy();
    expect(interfacePattern).toContain('interface_declaration');
  });

  test('should handle Python queries', async () => {
    await QueryLoader.loadLanguageQueries('python');
    const fullQuery = QueryLoader.getQuery('python', 'functions');
    
    const functionPattern = QueryTransformer.extractPatternType(fullQuery, 'functions', 'python');
    expect(functionPattern).toBeTruthy();
    expect(functionPattern).toContain('function_definition');
    
    const classPattern = QueryTransformer.extractPatternType(fullQuery, 'classes', 'python');
    expect(classPattern).toBeTruthy();
    expect(classPattern).toContain('class_definition');
  });
});