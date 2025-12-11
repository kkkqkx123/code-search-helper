import Parser from 'tree-sitter';
import { CacheService } from '../../../../infrastructure/caching/CacheService';
import { diContainer } from '../../../../core/DIContainer';
import { TYPES } from '../../../../types';

// Mock tree-sitter node for testing
const createMockNode = (type: string, text: string): Parser.SyntaxNode => {
  return {
    type,
    text,
    startPosition: { row: 0, column: 0 },
  } as any;
};

describe('CacheService AST Caching', () => {
  let cacheService: CacheService;

  beforeEach(() => {
    // Get cache service from DI container
    cacheService = diContainer.get<CacheService>(TYPES.CacheService);
    // Clear all caches before each test
    cacheService.clearAllCache();
  });

  it('should set and get an AST object from cache', async () => {
    const mockAst = createMockNode('program', 'int main() { return 0; }');
    const key = cacheService.forAst('/path/to/file.c', 'hash123');

    await cacheService.cacheAST('c', 'int main() { return 0; }', { rootNode: mockAst } as any);
    const cachedAst = await cacheService.getCachedAST('c', 'int main() { return 0; }');

    expect(cachedAst).toEqual({ rootNode: mockAst });
  });

  it('should return null for a non-existent AST', async () => {
    const cachedAst = await cacheService.getCachedAST('c', 'non-existent code');
    expect(cachedAst).toBeNull();
  });

  it('should generate correct AST cache keys', () => {
    const key1 = cacheService.forAst('/src/main.c', 'abc123');
    const key2 = cacheService.forAst('/src/main.c', 'def456');
    const key3 = cacheService.forAst('/src/lib.c', 'abc123');

    // Keys should be unique and start with 'query:ast:' prefix
    expect(key1).toMatch(/^query:ast:/);
    expect(key2).toMatch(/^query:ast:/);
    expect(key3).toMatch(/^query:ast:/);
    
    // Same path and hash should generate same key
    expect(key1).toBe(cacheService.forAst('/src/main.c', 'abc123'));
    
    // Different inputs should generate different keys
    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
    expect(key2).not.toBe(key3);
  });

  it('should clear AST cache when clearAll is called', async () => {
    const mockAst = createMockNode('program', 'int main() {}');
    await cacheService.cacheAST('c', 'int main() {}', { rootNode: mockAst } as any);

    const cachedBefore = await cacheService.getCachedAST('c', 'int main() {}');
    expect(cachedBefore).not.toBeNull();

    cacheService.clearAllCache();
    
    const cachedAfter = await cacheService.getCachedAST('c', 'int main() {}');
    expect(cachedAfter).toBeNull();
  });

  it('should include AST cache in stats', async () => {
    const mockAst = createMockNode('program', 'int main() {}');

    // Initial stats should be empty
    let stats = cacheService.getCacheStats();
    expect(stats.totalEntries).toBe(0);

    // Set an AST and check stats
    await cacheService.cacheAST('c', 'int main() {}', { rootNode: mockAst } as any);
    stats = cacheService.getCacheStats();
    expect(stats.totalEntries).toBeGreaterThan(0);
  });

  it('should clear query cache', async () => {
    const mockAst = createMockNode('program', 'int main() {}');
    await cacheService.cacheAST('c', 'int main() {}', { rootNode: mockAst } as any);

    const cachedBefore = await cacheService.getCachedAST('c', 'int main() {}');
    expect(cachedBefore).not.toBeNull();

    cacheService.clearQueryCache();
    
    const cachedAfter = await cacheService.getCachedAST('c', 'int main() {}');
    expect(cachedAfter).toBeNull();
  });
});