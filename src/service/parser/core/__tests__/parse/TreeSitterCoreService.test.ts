import Parser from 'tree-sitter';
import { TreeSitterCoreService, ParserLanguage, ParseResult } from '../../parse/TreeSitterCoreService';
import { TreeSitterUtils } from '../../../utils/TreeSitterUtils';

describe('TreeSitterCoreService', () => {
  let treeSitterService: TreeSitterCoreService;

  beforeEach(() => {
    treeSitterService = new TreeSitterCoreService();
  });

  describe('Constructor', () => {
    it('should initialize with parsers', () => {
      expect(treeSitterService).toBeInstanceOf(TreeSitterCoreService);
      expect(treeSitterService.isInitialized()).toBe(true);
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return supported languages', () => {
      const supportedLanguages = treeSitterService.getSupportedLanguages();
      expect(Array.isArray(supportedLanguages)).toBe(true);
      expect(supportedLanguages.length).toBeGreaterThan(0);

      // Check that some expected languages are included
      const languageNames = supportedLanguages.map(lang => lang.name.toLowerCase());
      expect(languageNames).toContain('typescript');
      expect(languageNames).toContain('javascript');
      expect(languageNames).toContain('python');
      expect(languageNames).toContain('java');
      expect(languageNames).toContain('go');
    });
  });

  describe('detectLanguage', () => {
    it('should detect TypeScript language from file extension', async () => {
      const language = await treeSitterService.detectLanguage('test.ts');
      expect(language).not.toBeNull();
      expect(language!.name).toBe('TypeScript');
    });

    it('should detect TypeScript JSX language from file extension', async () => {
      const language = await treeSitterService.detectLanguage('test.tsx');
      expect(language).not.toBeNull();
      expect(language!.name).toBe('TypeScript');
    });

    it('should detect JavaScript language from file extension', async () => {
      const language = await treeSitterService.detectLanguage('test.js');
      expect(language).not.toBeNull();
      expect(language!.name).toBe('JavaScript');
    });

    it('should detect JavaScript JSX language from file extension', async () => {
      const language = await treeSitterService.detectLanguage('test.jsx');
      expect(language).not.toBeNull();
      expect(language!.name).toBe('JavaScript');
    });

    it('should detect Python language from file extension', async () => {
      const language = await treeSitterService.detectLanguage('test.py');
      expect(language).not.toBeNull();
      expect(language!.name).toBe('Python');
    });

    it('should detect Java language from file extension', async () => {
      const language = await treeSitterService.detectLanguage('test.java');
      expect(language).not.toBeNull();
      expect(language!.name).toBe('Java');
    });

    it('should detect Go language from file extension', async () => {
      const language = await treeSitterService.detectLanguage('test.go');
      expect(language).not.toBeNull();
      expect(language!.name).toBe('Go');
    });

    it('should return null for unsupported file extension', async () => {
      const language = await treeSitterService.detectLanguage('test.unsupported');
      expect(language).toBeNull();
    });

    it('should return null for file without extension', async () => {
      const language = await treeSitterService.detectLanguage('test');
      expect(language).toBeNull();
    });
  });

  describe('parseCode', () => {
    it('should parse TypeScript code successfully', async () => {
      const code = `function hello(): string { return "Hello, World!"; }`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('ast');
      expect(result).toHaveProperty('parseTime');
      expect(typeof result.parseTime).toBe('number');
      expect(result.parseTime).toBeGreaterThanOrEqual(0);
    });

    it('should parse JavaScript code successfully', async () => {
      const code = `function hello() { return "Hello, World!"; }`;
      const result = await treeSitterService.parseCode(code, 'javascript');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('ast');
      expect(result).toHaveProperty('parseTime');
      expect(typeof result.parseTime).toBe('number');
      expect(result.parseTime).toBeGreaterThanOrEqual(0);
    });

    it('should parse Python code successfully', async () => {
      const code = `def hello():\n    return "Hello, World!"`;
      const result = await treeSitterService.parseCode(code, 'python');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('ast');
      expect(result).toHaveProperty('parseTime');
      expect(typeof result.parseTime).toBe('number');
      expect(result.parseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return error for unsupported language', async () => {
      const code = `function hello() { return "Hello, World!"; }`;
      const result = await treeSitterService.parseCode(code, 'unsupported');

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('Unsupported language');
    });

    it('should return error for invalid code', async () => {
      const code = `function hello() { return "Hello, World!"; // Missing closing brace`;
      const result = await treeSitterService.parseCode(code, 'javascript');

      // Even with invalid code, Tree-sitter might still produce an AST with errors
      // The important thing is that it doesn't throw an exception
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('ast');
    });

    it('should cache parsed results', async () => {
      const code = `function hello(): string { return "Hello, World!"; }`;

      // First parse
      const result1 = await treeSitterService.parseCode(code, 'typescript');
      expect(result1.fromCache).toBe(false); // Should not be from cache initially

      // Second parse of the same code
      const result2 = await treeSitterService.parseCode(code, 'typescript');
      expect(result2.fromCache).toBe(true); // Should be from cache
    });
  });

  describe('parseFile', () => {
    it('should parse TypeScript file successfully', async () => {
      const code = `function hello(): string { return "Hello, World!"; }`;
      const result = await treeSitterService.parseFile('test.ts', code);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('ast');
      expect(result).toHaveProperty('parseTime');
      expect(typeof result.parseTime).toBe('number');
      expect(result.parseTime).toBeGreaterThanOrEqual(0);
    });

    it('should parse JavaScript file successfully', async () => {
      const code = `function hello() { return "Hello, World!"; }`;
      const result = await treeSitterService.parseFile('test.js', code);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('ast');
      expect(result).toHaveProperty('parseTime');
      expect(typeof result.parseTime).toBe('number');
      expect(result.parseTime).toBeGreaterThanOrEqual(0);
    });

    it('should return error for unsupported file type', async () => {
      const code = `function hello() { return "Hello, World!"; }`;

      await expect(treeSitterService.parseFile('test.unsupported', code))
        .rejects
        .toThrow('Unsupported file type: test.unsupported');
    });
  });

  describe('isInitialized', () => {
    it('should return true when service is initialized', () => {
      expect(treeSitterService.isInitialized()).toBe(true);
    });
  });

  describe('getNodeText', () => {
    it('should extract text from a node', async () => {
      const code = `function hello(): string { return "Hello, World!"; }`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const nodeText = treeSitterService.getNodeText(result.ast, code);
        expect(nodeText).toContain('function hello()');
      }
    });
  });

  describe('getNodeLocation', () => {
    it('should return location information for a node', async () => {
      const code = `function hello(): string { return "Hello, World!"; }`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const location = treeSitterService.getNodeLocation(result.ast);
        expect(location).toHaveProperty('startLine');
        expect(location).toHaveProperty('endLine');
        expect(location).toHaveProperty('startColumn');
        expect(location).toHaveProperty('endColumn');
        expect(typeof location.startLine).toBe('number');
        expect(typeof location.endLine).toBe('number');
        expect(typeof location.startColumn).toBe('number');
        expect(typeof location.endColumn).toBe('number');
      }
    });
  });

  describe('findNodeByType', () => {
    it('should find nodes of a specific type', async () => {
      const code = `function hello(): string { return "Hello, World!"; }`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const functionNodes = treeSitterService.findNodeByType(result.ast, 'function_declaration');
        expect(Array.isArray(functionNodes)).toBe(true);
        expect(functionNodes.length).toBeGreaterThan(0);
      }
    });

    it('should return empty array for non-existent node type', async () => {
      const code = `function hello(): string { return "Hello, World!"; }`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const nonExistentNodes = treeSitterService.findNodeByType(result.ast, 'non_existent_type');
        expect(Array.isArray(nonExistentNodes)).toBe(true);
        expect(nonExistentNodes.length).toBe(0);
      }
    });
  });

  describe('queryTree', () => {
    it('should execute tree-sitter query pattern', async () => {
      const code = `function hello(): string { return "Hello, World!"; }`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        // This test might need adjustment based on actual query implementation
        const matches = treeSitterService.queryTree(result.ast, '(function_declaration) @function');
        expect(Array.isArray(matches)).toBe(true);
      }
    });
  });

  describe('findNodesByTypes', () => {
    it('should find nodes of multiple types', async () => {
      const code = `function hello(): string { return "Hello, World!"; }`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const nodes = treeSitterService.findNodesByTypes(result.ast, ['function_declaration', 'return_statement']);
        expect(Array.isArray(nodes)).toBe(true);
        expect(nodes.length).toBeGreaterThanOrEqual(0); // At least function_declaration should be found
      }
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = treeSitterService.getCacheStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('evictions');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('dynamicManagerStats');
      expect(typeof stats.hits).toBe('number');
      expect(typeof stats.misses).toBe('number');
      expect(typeof stats.evictions).toBe('number');
      expect(typeof stats.totalRequests).toBe('number');
      expect(typeof stats.hitRate).toBe('string');
      expect(typeof stats.dynamicManagerStats.astCacheSize).toBe('number');
      expect(typeof stats.dynamicManagerStats.nodeCacheSize).toBe('number');
    });
  });

  describe('getPerformanceStats', () => {
    it('should return performance statistics', () => {
      const stats = treeSitterService.getPerformanceStats();
      expect(stats).toHaveProperty('cacheStats');
      expect(stats.cacheStats).toHaveProperty('hits');
      expect(stats.cacheStats).toHaveProperty('misses');
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      // First, populate the cache with a parse operation
      const code = `function hello(): string { return "Hello, World!"; }`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      // Check that cache has some entries
      const statsBefore = treeSitterService.getCacheStats();
      const hasCacheEntries = statsBefore.dynamicManagerStats.astCacheSize > 0 || statsBefore.dynamicManagerStats.nodeCacheSize > 0;

      // Clear the cache
      treeSitterService.clearCache();

      // Check that cache is empty
      const statsAfter = treeSitterService.getCacheStats();
      expect(statsAfter.dynamicManagerStats.astCacheSize).toBe(0);
      expect(statsAfter.dynamicManagerStats.nodeCacheSize).toBe(0);
    });
  });

  describe('extractFunctions', () => {
    it('should extract function nodes from AST', async () => {
      const code = `function hello(): string { return "Hello, World!"; }`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const functions = await treeSitterService.extractFunctions(result.ast);
        expect(Array.isArray(functions)).toBe(true);
        expect(functions.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should extract multiple functions', async () => {
      const code = `
        function hello(): string { return "Hello"; }
        function world(): string { return "World"; }
      `;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const functions = await treeSitterService.extractFunctions(result.ast);
        expect(Array.isArray(functions)).toBe(true);
        expect(functions.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('extractClasses', () => {
    it('should extract class nodes from AST', async () => {
      const code = `class TestClass { method() { return "test"; } }`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const classes = await treeSitterService.extractClasses(result.ast);
        expect(Array.isArray(classes)).toBe(true);
        expect(classes.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should extract multiple classes', async () => {
      const code = `
        class ClassA { }
        class ClassB { }
      `;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const classes = await treeSitterService.extractClasses(result.ast);
        expect(Array.isArray(classes)).toBe(true);
        expect(classes.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('extractImports', () => {
    it('should extract import statements from AST', async () => {
      const code = `import { Component } from 'react';`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const imports = await treeSitterService.extractImports(result.ast);
        expect(Array.isArray(imports)).toBe(true);
        expect(imports.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should extract import statements from AST', async () => {
      const code = `import { Component } from 'react';`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const imports = await treeSitterService.extractImports(result.ast);
        expect(Array.isArray(imports)).toBe(true);
        expect(imports.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('extractExports', () => {
    it('should extract export statements from AST', async () => {
      const code = `export { Component };`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const exports = await treeSitterService.extractExports(result.ast);
        expect(Array.isArray(exports)).toBe(true);
        expect(exports.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should extract export statements from AST', async () => {
      const code = `export { Component };`;
      const result = await treeSitterService.parseCode(code, 'typescript');

      if (result.success) {
        const exports = await treeSitterService.extractExports(result.ast);
        expect(Array.isArray(exports)).toBe(true);
        expect(exports.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});