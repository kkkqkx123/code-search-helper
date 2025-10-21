import Parser from 'tree-sitter';
import { QueryCache } from '../../query/QueryCache';

describe('QueryCache', () => {
  let mockLanguage: Parser.Language;

  beforeEach(() => {
    // 创建模拟语言对象
    mockLanguage = {} as Parser.Language;
    mockLanguage.name = 'typescript';
    QueryCache.clearCache();
  });

  test('should cache and retrieve queries', () => {
    const pattern = '(function_declaration) @function';
    const query1 = QueryCache.getQuery(mockLanguage, pattern);
    const query2 = QueryCache.getQuery(mockLanguage, pattern);
    
    expect(query1).toBe(query2); // 应该是同一个实例
  });

  test('should track cache statistics', () => {
    const pattern = '(class_declaration) @class';
    
    // 第一次访问
    QueryCache.getQuery(mockLanguage, pattern);
    
    // 第二次访问（应该命中缓存）
    QueryCache.getQuery(mockLanguage, pattern);
    
    const stats = QueryCache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe('50.00%');
  });

  test('should clear cache', () => {
    const pattern = '(import_statement) @import';
    QueryCache.getQuery(mockLanguage, pattern);
    
    QueryCache.clearCache();
    
    const stats = QueryCache.getStats();
    expect(stats.hits).toBe(0);
    expect(stats.misses).toBe(0);
    expect(stats.cacheSize).toBe(0);
  });

  test('should handle different patterns separately', () => {
    const pattern1 = '(function_declaration) @function';
    const pattern2 = '(class_declaration) @class';
    
    const query1 = QueryCache.getQuery(mockLanguage, pattern1);
    const query2 = QueryCache.getQuery(mockLanguage, pattern2);
    const query1Again = QueryCache.getQuery(mockLanguage, pattern1);
    
    expect(query1).toBe(query1Again);
    expect(query1).not.toBe(query2);
    
    const stats = QueryCache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
  });

  test('should handle different languages separately', () => {
    const mockLanguage2 = {} as Parser.Language;
    mockLanguage2.name = 'javascript';
    
    const pattern = '(function_declaration) @function';
    
    const query1 = QueryCache.getQuery(mockLanguage, pattern);
    const query2 = QueryCache.getQuery(mockLanguage2, pattern);
    const query1Again = QueryCache.getQuery(mockLanguage, pattern);
    
    expect(query1).toBe(query1Again);
    expect(query1).not.toBe(query2);
    
    const stats = QueryCache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(2);
  });
});