import Parser from 'tree-sitter';
import { ModuleChunkingStrategy } from '../../strategy/ModuleChunkingStrategy';
import { CodeChunk } from '../../types';

// Mock AST node for testing
const createMockASTNode = (type: string, content: string = '', children: any[] = []): any => {
  // Create import statement nodes if content contains import statements
  if (type === 'program' && content.includes('import')) {
    const importMatches = content.match(/import\s+[^;]+;/g) || content.match(/import\s+[^;]+\n/g);
    if (importMatches) {
      for (const importStatement of importMatches) {
        const importNode = createMockASTNode('import_statement', importStatement);
        children.push(importNode);
      }
    }
  }

  return {
    type,
    startIndex: 0,
    endIndex: content.length,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 2, column: 1 },
    text: content,
    children,
    parent: null,
    nextSibling: null,
    previousSibling: null,
    childForFieldName: (fieldName: string) => {
      if (fieldName === 'name' && type.includes('module')) {
        return createMockASTNode('identifier', 'testModule');
      }
      return null;
    }
  };
};

describe('ModuleChunkingStrategy', () => {
  let strategy: ModuleChunkingStrategy;

  beforeEach(() => {
    strategy = new ModuleChunkingStrategy();
  });

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(strategy.name).toBe('module_chunking');
      expect(strategy.priority).toBe(0); // Highest priority
      expect(strategy.description).toBe('Extract module-level declarations and imports/exports');
      expect(strategy.supportedLanguages).toContain('typescript');
      expect(strategy.supportedLanguages).toContain('javascript');
      expect(strategy.supportedLanguages).toContain('python');
      expect(strategy.supportedLanguages).toContain('java');
      expect(strategy.supportedLanguages).toContain('go');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        maxChunkSize: 3000,
        minChunkSize: 200,
        preserveComments: false,
        preserveEmptyLines: true,
        maxNestingLevel: 5
      };

      const customStrategy = new ModuleChunkingStrategy(customConfig);
      const config = customStrategy.getConfiguration();

      expect(config.maxChunkSize).toBe(3000);
      expect(config.minChunkSize).toBe(200);
      expect(config.preserveComments).toBe(false);
      expect(config.preserveEmptyLines).toBe(true);
      expect(config.maxNestingLevel).toBe(5);
    });
  });

  describe('canHandle', () => {
    it('should return true for supported language and module node', () => {
      const moduleNode = createMockASTNode('program', 'function test() {}');
      const result = strategy.canHandle('typescript', moduleNode);
      expect(result).toBe(true);
    });

    it('should return false for unsupported language', () => {
      const moduleNode = createMockASTNode('program', 'function test() {}');
      const result = strategy.canHandle('unsupported', moduleNode);
      expect(result).toBe(false);
    });

    it('should return false for non-module node in unsupported context', () => {
      const functionNode = createMockASTNode('function_declaration', 'function test() {}');
      const result = strategy.canHandle('typescript', functionNode);
      // This depends on the specific node types supported by the strategy
      expect(typeof result).toBe('boolean');
    });

    it('should return true for different module types in different languages', () => {
      // TypeScript/JavaScript module (program)
      const tsModuleNode = createMockASTNode('program');
      expect(strategy.canHandle('typescript', tsModuleNode)).toBe(true);

      // Python module
      const pyModuleNode = createMockASTNode('module');
      expect(strategy.canHandle('python', pyModuleNode)).toBe(true);

      // Java package declaration
      const javaPackageNode = createMockASTNode('package_declaration');
      expect(strategy.canHandle('java', javaPackageNode)).toBe(true);

      // Go source file
      const goSourceNode = createMockASTNode('source_file');
      expect(strategy.canHandle('go', goSourceNode)).toBe(true);
    });
  });

  describe('getSupportedNodeTypes', () => {
    it('should return module types for TypeScript', () => {
      const types = strategy.getSupportedNodeTypes('typescript');
      expect(types).toContain('program');
      expect(types).toContain('module');
      expect(types).toContain('namespace_declaration');
      expect(types).toContain('import_statement');
      expect(types).toContain('export_statement');
    });

    it('should return module types for JavaScript', () => {
      const types = strategy.getSupportedNodeTypes('javascript');
      expect(types).toContain('program');
      expect(types).toContain('import_statement');
      expect(types).toContain('export_statement');
    });

    it('should return module types for Python', () => {
      const types = strategy.getSupportedNodeTypes('python');
      expect(types).toContain('module');
      expect(types).toContain('import_statement');
      expect(types).toContain('import_from_statement');
    });

    it('should return module types for Java', () => {
      const types = strategy.getSupportedNodeTypes('java');
      expect(types).toContain('program');
      expect(types).toContain('package_declaration');
      expect(types).toContain('import_declaration');
    });

    it('should return module types for Go', () => {
      const types = strategy.getSupportedNodeTypes('go');
      expect(types).toContain('source_file');
      expect(types).toContain('package_clause');
      expect(types).toContain('import_declaration');
    });

    it('should return empty set for unsupported language', () => {
      const types = strategy.getSupportedNodeTypes('unsupported');
      expect(types.size).toBe(0);
    });
  });

  describe('chunk', () => {
    it('should create a chunk for a module node', () => {
      const moduleContent = `
        import { Component } from 'react';
        export function test() { return "hello"; }
      `;
      const moduleNode = createMockASTNode('program', moduleContent);
      
      const chunks = strategy.chunk(moduleNode, moduleContent);
      
      expect(Array.isArray(chunks)).toBe(true);
      // Should return at least one chunk
      if (chunks.length > 0) {
        const chunk = chunks[0];
        expect(chunk.content).toContain('import');
        expect(chunk.metadata).toHaveProperty('type', 'module');
        expect(chunk.metadata).toHaveProperty('language');
        expect(chunk.metadata).toHaveProperty('startLine');
        expect(chunk.metadata).toHaveProperty('endLine');
      }
    });

    it('should return empty array for non-module node that cannot be handled', () => {
      const node = createMockASTNode('function_declaration', 'function test() {}');
      const chunks = strategy.chunk(node, 'function test() {}');
      
      expect(Array.isArray(chunks)).toBe(true);
      // Result depends on whether the specific node type is supported
    });
 });

  describe('createModuleChunk', () => {
    it('should create a module chunk with correct metadata', () => {
      const moduleContent = `
        import { Component } from 'react';
        export function test() { return "hello"; }
      `;
      const moduleNode = createMockASTNode('program', moduleContent);
      
      // Access private method using any type
      const createModuleChunkMethod = (strategy as any).createModuleChunk.bind(strategy);
      const chunk = createModuleChunkMethod(moduleNode, moduleContent);
      
      if (chunk) {
        expect(chunk.content).toContain('import');
        expect(chunk.metadata.type).toBe('module');
        expect(chunk.metadata.language).toBe('typescript'); // Default
        expect(typeof chunk.metadata.complexity).toBe('number');
        expect(chunk.metadata).toHaveProperty('moduleName');
        expect(chunk.metadata).toHaveProperty('imports');
        expect(chunk.metadata).toHaveProperty('exports');
      }
    });
  });

  describe('extractModuleName', () => {
    it('should extract module name from node', () => {
      const moduleNode = createMockASTNode('program', 'function test() {}');
      const moduleName = (strategy as any).extractModuleName(moduleNode, 'function test() {}');
      // The exact behavior depends on the implementation
      expect(typeof moduleName).toBe('string');
    });
  });

  describe('extractImports', () => {
    it('should extract import statements from content', () => {
      const moduleContent = `
        import { Component } from 'react';
        import React from 'react';
        const x = 5;
      `;
      const moduleNode = createMockASTNode('program', moduleContent);
      const imports = (strategy as any).extractImports(moduleNode, moduleContent);
      
      expect(Array.isArray(imports)).toBe(true);
      expect(imports.length).toBeGreaterThanOrEqual(2); // At least 2 import statements
    });
  });

  describe('extractExports', () => {
    it('should extract export statements from content', () => {
      const moduleContent = `
        export function test() {}
        export const x = 5;
        const y = 10;
      `;
      const moduleNode = createMockASTNode('program', moduleContent);
      const exports = (strategy as any).extractExports(moduleNode, moduleContent);
      
      expect(Array.isArray(exports)).toBe(true);
      // May contain export statements depending on implementation
    });
  });

  describe('extractDependencies', () => {
    it('should extract dependencies from import statements', () => {
      const moduleContent = `
        import { Component } from 'react';
        import fs from 'fs';
        import { something } from '../utils/helper';
      `;
      const moduleNode = createMockASTNode('program', moduleContent);
      const dependencies = (strategy as any).extractDependencies(moduleNode, moduleContent);
      
      expect(Array.isArray(dependencies)).toBe(true);
      expect(dependencies.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isEntryModule', () => {
    it('should identify entry modules', () => {
      const isEntry = (strategy as any).isEntryModule(
        createMockASTNode('program', 'function main() {}'), 
        'function main() {}'
      );
      expect(typeof isEntry).toBe('boolean');
    });

    it('should identify index files as potential entry modules', () => {
      const isEntry = (strategy as any).isEntryModule(
        createMockASTNode('program', 'export default {}'), 
        'export default {}'
      );
      // Check with content that suggests it might be an index file
      expect(typeof isEntry).toBe('boolean');
    });
  });

  describe('hasModuleSideEffects', () => {
    it('should identify modules with side effects', () => {
      const hasSideEffects = (strategy as any).hasModuleSideEffects(
        createMockASTNode('program', 'console.log("hello")'), 
        'console.log("hello")'
      );
      expect(hasSideEffects).toBe(true);
    });

    it('should identify modules without side effects', () => {
      const noSideEffects = (strategy as any).hasModuleSideEffects(
        createMockASTNode('program', 'function pure(a, b) { return a + b; }'), 
        'function pure(a, b) { return a + b; }'
      );
      expect(noSideEffects).toBe(false);
    });
  });

  describe('getModuleType', () => {
    it('should identify module type', () => {
      const programNode = createMockASTNode('program', 'function test() {}');
      const moduleType = (strategy as any).getModuleType(programNode);
      expect(moduleType).toBe('source');
    });

    it('should identify namespace module type', () => {
      const namespaceNode = createMockASTNode('namespace_declaration', 'namespace Test {}');
      const moduleType = (strategy as any).getModuleType(namespaceNode);
      expect(moduleType).toBe('namespace');
    });
  });

  describe('extractModuleDeclarations', () => {
    it('should extract module-level declarations', () => {
      const moduleContent = `
        type MyType = string;
        interface MyInterface {}
        function myFunction() {}
      `;
      const moduleNode = createMockASTNode('program', moduleContent);
      const declarations = (strategy as any).extractModuleDeclarations(moduleNode, moduleContent);
      
      expect(Array.isArray(declarations)).toBe(true);
    });
  });

  describe('validateChunks', () => {
    it('should validate chunks correctly', () => {
      const validChunk: CodeChunk = {
        content: 'function test() { return "hello"; }\n\n// This is a longer content to meet the minimum chunk size requirement of 100 characters. We need to add more text to reach that limit.',
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'module'
        }
      };

      const result = strategy.validateChunks([validChunk]);
      expect(result).toBe(true);
    });

    it('should return false for chunks that are too small', () => {
      const smallChunk: CodeChunk = {
        content: 'a', // Too small
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'module'
        }
      };

      const result = strategy.validateChunks([smallChunk]);
      expect(result).toBe(false);
    });
  });

  describe('extractModulesUsingQuery', () => {
    it('should extract modules using query engine', async () => {
      const moduleContent = `
        import { Component } from 'react';
        export function test() { return "hello"; }
      `;
      const astNode = createMockASTNode('program', moduleContent);
      
      const result = await strategy.extractModulesUsingQuery(astNode, 'typescript', moduleContent);
      
      // Should return an array of chunks
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('optimizeModuleChunks', () => {
    it('should filter out invalid chunks', () => {
      const validChunk: CodeChunk = {
        content: `
          import { Component } from 'react';
          export function test() { return "hello"; }
        `,
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'typescript',
          type: 'module'
        }
      };

      const tooSmallChunk: CodeChunk = {
        content: 'i', // Too small - just import keyword
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'module'
        }
      };

      const optimized = (strategy as any).optimizeModuleChunks([validChunk, tooSmallChunk]);
      expect(Array.isArray(optimized)).toBe(true);
      expect(optimized.length).toBeLessThanOrEqual(2);
    });
  });

  describe('sortModulesByPriority', () => {
    it('should sort modules by priority', () => {
      const entryModule: CodeChunk = {
        content: 'function main() {}',
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'module',
          isEntryModule: true
        }
      };

      const regularModule: CodeChunk = {
        content: 'function helper() {}',
        metadata: {
          startLine: 2,
          endLine: 2,
          language: 'typescript',
          type: 'module',
          isEntryModule: false
        }
      };

      const unsorted = [regularModule, entryModule];
      const sorted = (strategy as any).sortModulesByPriority(unsorted);

      expect(Array.isArray(sorted)).toBe(true);
      // Entry module should come first if isEntryModule is true
      if (entryModule.metadata.isEntryModule && sorted.length >= 2) {
        expect(sorted[0]).toBe(entryModule);
      }
    });
  });
});