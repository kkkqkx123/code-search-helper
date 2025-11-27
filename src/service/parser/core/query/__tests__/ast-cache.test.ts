import Parser from 'tree-sitter';
import { QueryCache } from '../QueryCache';

// Mock tree-sitter node for testing
const createMockNode = (type: string, text: string): Parser.SyntaxNode => {
  return {
    type,
    text,
    startPosition: { row: 0, column: 0 },
  } as any;
};

describe('QueryCache AST Caching', () => {
  beforeEach(() => {
    // Clear all caches before each test
    QueryCache.clearCache();
  });

  it('should set and get an AST object from cache', () => {
    const mockAst = createMockNode('program', 'int main() { return 0; }');
    const key = QueryCache.forAst('/path/to/file.c', 'hash123');

    QueryCache.setAst(key, mockAst);
    const cachedAst = QueryCache.getAst(key);

    expect(cachedAst).toBe(mockAst);
  });

  it('should return undefined for a non-existent AST key', () => {
    const key = QueryCache.forAst('/path/to/nonexistent.c', 'hash456');
    const cachedAst = QueryCache.getAst(key);
    expect(cachedAst).toBeUndefined();
  });

  it('should overwrite an existing AST in cache', () => {
    const originalAst = createMockNode('program', 'original');
    const newAst = createMockNode('program', 'new');
    const key = QueryCache.forAst('/path/to/file.c', 'hash789');

    QueryCache.setAst(key, originalAst);
    expect(QueryCache.getAst(key)).toBe(originalAst);

    QueryCache.setAst(key, newAst);
    expect(QueryCache.getAst(key)).toBe(newAst);
  });

  it('should clear AST cache when clearCache is called', () => {
    const mockAst = createMockNode('program', 'int main() {}');
    const key = QueryCache.forAst('/path/to/file.c', 'hash000');

    QueryCache.setAst(key, mockAst);
    expect(QueryCache.getAst(key)).toBe(mockAst);

    QueryCache.clearCache();
    expect(QueryCache.getAst(key)).toBeUndefined();
  });

  it('should include AST cache in combined stats', () => {
    const mockAst = createMockNode('program', 'int main() {}');
    const key = QueryCache.forAst('/path/to/file.c', 'hash111');

    // Initial stats should be empty
    let stats = QueryCache.getAllStats();
    expect(stats.astCache.size).toBe(0);

    // Set an AST and check stats
    QueryCache.setAst(key, mockAst);
    stats = QueryCache.getAllStats();
    expect(stats.astCache.size).toBe(1);
    expect(stats.combined.totalSize).toBe(1); // Assuming other caches are empty
  });

  it('should generate correct AST cache keys', () => {
    const key1 = QueryCache.forAst('/src/main.c', 'abc123');
    const key2 = QueryCache.forAst('/src/main.c', 'def456');
    const key3 = QueryCache.forAst('/src/lib.c', 'abc123');

    // Keys should be unique and start with 'ast:' prefix
    expect(key1).toMatch(/^ast:/);
    expect(key2).toMatch(/^ast:/);
    expect(key3).toMatch(/^ast:/);
    
    // Same path and hash should generate same key
    expect(key1).toBe(QueryCache.forAst('/src/main.c', 'abc123'));
    
    // Different inputs should generate different keys
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });

  it('should validate AST cache keys', () => {
    const validAstKey = QueryCache.forAst('/src/main.c', 'abc123');
    const validQueryKey = 'treesitter:someHash:function_name:c';
    const invalidKey = 'invalid:prefix';

    expect(QueryCache.isValidCacheKey(validAstKey)).toBe(true);
    expect(QueryCache.isValidCacheKey(validQueryKey)).toBe(true);
    expect(QueryCache.isValidCacheKey(invalidKey)).toBe(false);
  });
});