import { ContextAwareOverlapOptimizer } from '../overlap/ContextAwareOverlapOptimizer';
import { CodeChunk, CodeChunkMetadata } from '../../types';

describe('ContextAwareOverlapOptimizer', () => {
  let optimizer: ContextAwareOverlapOptimizer;

  beforeEach(() => {
    optimizer = new ContextAwareOverlapOptimizer();
  });

  describe('analyzeChunkRelationship', () => {
    it('should identify sequential functions', () => {
      const currentChunk: CodeChunk = {
        content: 'function first() {\n return "first";\n}',
        metadata: { startLine: 1, endLine: 3, language: 'typescript' } as CodeChunkMetadata
      };
      const nextChunk: CodeChunk = {
        content: 'function second() {\n return "second";\n}',
        metadata: { startLine: 5, endLine: 7, language: 'typescript' } as CodeChunkMetadata
      };

      const relationship = (optimizer as any).analyzeChunkRelationship(currentChunk, nextChunk);

      expect(relationship.type).toBe('sequential_functions');
      expect(relationship.similarity).toBeGreaterThan(0.8);
    });

    it('should identify class methods', () => {
      const currentChunk: CodeChunk = {
        content: 'class TestClass {\n constructor() {}',
        metadata: { startLine: 1, endLine: 2, language: 'typescript' } as CodeChunkMetadata
      };
      const nextChunk: CodeChunk = {
        content: '  method() {\n    return this.data;\n  }\n}',
        metadata: { startLine: 3, endLine: 6, language: 'typescript' } as CodeChunkMetadata
      };

      const relationship = (optimizer as any).analyzeChunkRelationship(currentChunk, nextChunk);

      expect(relationship.type).toBe('class_methods');
    });

    it('should identify related imports', () => {
      const currentChunk: CodeChunk = {
        content: 'import { Component } from "@angular/core";',
        metadata: { startLine: 1, endLine: 1, language: 'typescript' } as CodeChunkMetadata
      };
      const nextChunk: CodeChunk = {
        content: 'import { OnInit } from "@angular/core";',
        metadata: { startLine: 2, endLine: 2, language: 'typescript' } as CodeChunkMetadata
      };

      const relationship = (optimizer as any).analyzeChunkRelationship(currentChunk, nextChunk);

      expect(relationship.type).toBe('related_imports');
    });
  });

  describe('optimizeOverlapForContext', () => {
    it('should optimize overlap for sequential functions', () => {
      const overlap = {
        content: 'function test() {\n  return "test";\n}\n\nfunction next() {',
        lines: 3,
        strategy: 'semantic' as const,
        quality: 0.7
      };

      const currentChunk: CodeChunk = {
        content: 'function test() {\n return "test";\n}',
        metadata: { startLine: 1, endLine: 3, language: 'typescript' } as CodeChunkMetadata
      };
      const nextChunk: CodeChunk = {
        content: 'function next() {\n return "next";\n}',
        metadata: { startLine: 5, endLine: 7, language: 'typescript' } as CodeChunkMetadata
      };

      const result = optimizer.optimizeOverlapForContext(overlap, currentChunk, nextChunk);

      // Should preserve function signatures
      expect(result.content).toContain('function');
      // Quality should be improved
      expect(result.quality).toBeGreaterThanOrEqual(overlap.quality);
    });

    it('should optimize overlap for class methods', () => {
      const overlap = {
        content: 'class TestClass {\n prop: string;\n  method1() {',
        lines: 3,
        strategy: 'semantic' as const,
        quality: 0.6
      };

      const currentChunk: CodeChunk = {
        content: 'class TestClass {\n prop: string;\n  method1() {',
        metadata: { startLine: 1, endLine: 3, language: 'typescript' } as CodeChunkMetadata
      };
      const nextChunk: CodeChunk = {
        content: 'return "method1";\n  }\n  method2() {\n    return "method2";\n }\n}',
        metadata: { startLine: 4, endLine: 7, language: 'typescript' } as CodeChunkMetadata
      };

      const result = optimizer.optimizeOverlapForContext(overlap, currentChunk, nextChunk);

      // Should preserve class structure
      expect(result.content).toContain('class');
      expect(result.content).toContain('prop:');
    });
  });
});