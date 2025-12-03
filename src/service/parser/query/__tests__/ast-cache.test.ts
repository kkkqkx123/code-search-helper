import Parser from 'tree-sitter';
import { CacheService } from '../CacheService';

// Mock tree-sitter node for testing
const createMockNode = (type: string, text: string): Parser.SyntaxNode => {
  return {
    type,
    text,
    startPosition: { row: 0, column: 0 },
  } as any;
};

describe('CacheService AST Caching', () => {
  beforeEach(() => {
    // Clear all caches before each test
    CacheService.clearAll();
  });

  it('should set and get an AST object from cache', () => {
    const mockAst = createMockNode('program', 'int main() { return 0; }');
    const key = CacheService.forAst('/path/to/file.c', 'hash123');

    CacheService.cacheAST('c', 'int main() { return 0; }', { rootNode: mockAst } as any);
    const cachedAst = CacheService.getCachedAST('c', 'int main() { return 0; }');

    expect(cachedAst).toBe(mockAst);
  });

  it('should return null for a non-existent AST', () => {
    const cachedAst = CacheService.getCachedAST('c', 'non-existent code');
    expect(cachedAst).toBeNull();
  });

  it('should generate correct AST cache keys', () => {
    const key1 = CacheService.forAst('/src/main.c', 'abc123');
    const key2 = CacheService.forAst('/src/main.c', 'def456');
    const key3 = CacheService.forAst('/src/lib.c', 'abc123');

    // Keys should be unique and start with 'ast:' prefix
    expect(key1).toMatch(/^ast:/);
    expect(key2).toMatch(/^ast:/);
    expect(key3).toMatch(/^ast:/);
    
    // Same path and hash should generate same key
    expect(key1).toBe(CacheService.forAst('/src/main.c', 'abc123'));
    
    // Different inputs should generate different keys
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });

  it('should clear AST cache when clearAll is called', () => {
    const mockAst = createMockNode('program', 'int main() {}');
    CacheService.cacheAST('c', 'int main() {}', { rootNode: mockAst } as any);

    const cachedBefore = CacheService.getCachedAST('c', 'int main() {}');
    expect(cachedBefore).not.toBeNull();

    CacheService.clearAll();
    
    const cachedAfter = CacheService.getCachedAST('c', 'int main() {}');
    expect(cachedAfter).toBeNull();
  });

  it('should include AST cache in combined stats', () => {
    const mockAst = createMockNode('program', 'int main() {}');

    // Initial stats should be empty
    let stats = CacheService.getAllStats();
    expect(stats.astCache.size).toBe(0);

    // Set an AST and check stats
    CacheService.cacheAST('c', 'int main() {}', { rootNode: mockAst } as any);
    stats = CacheService.getAllStats();
    expect(stats.astCache.size).toBe(1);
  });
});