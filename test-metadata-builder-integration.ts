/**
 * MetadataBuilder 集成测试
 * 验证 MetadataBuilder 在各个服务中的正确使用
 */

import { MetadataBuilder, MetadataFactory } from '../src/service/parser/core/normalization/utils/MetadataBuilder';
import { ExtensibleMetadata } from '../src/service/parser/core/normalization/types/ExtensibleMetadata';
import { BaseLanguageAdapter } from '../src/service/parser/core/normalization/BaseLanguageAdapter';
import { JavaScriptLanguageAdapter } from '../src/service/parser/core/normalization/adapters/JavaScriptLanguageAdapter';
import { PythonLanguageAdapter } from '../src/service/parser/core/normalization/adapters/PythonLanguageAdapter';

describe('MetadataBuilder Integration Tests', () => {
  describe('MetadataBuilder Basic Functionality', () => {
    it('should create and build metadata correctly', () => {
      const builder = new MetadataBuilder()
        .setLanguage('javascript')
        .setComplexity(5)
        .addDependencies(['react', 'lodash'])
        .addModifiers(['async', 'export'])
        .setLocation('src/app.js', 10, 5)
        .setCodeSnippet('const x = 1;');

      const metadata = builder.build();
      
      expect(metadata.language).toBe('javascript');
      expect(metadata.complexity).toBe(5);
      expect(metadata.dependencies).toContain('react');
      expect(metadata.modifiers).toContain('async');
      expect((metadata as any).location).toBeDefined();
      expect((metadata as any).codeSnippet).toBeDefined();
    });

    it('should create metadata using factory', () => {
      const builder = MetadataFactory.createFunction('myFunction', 'javascript', 'src/utils.js', 5, ['param1', 'param2'], 'string');
      const metadata = builder.build();
      
      expect(metadata.language).toBe('javascript');
      expect((metadata as any).functionName).toBe('myFunction');
      expect((metadata as any).parameters).toEqual(['param1', 'param2']);
      expect((metadata as any).returnType).toBe('string');
    });
  });

  describe('Language Adapter Integration', () => {
    it('should use MetadataBuilder in BaseLanguageAdapter', () => {
      // Create a mock language adapter
      const adapter = new BaseLanguageAdapter();
      
      // Create a mock result
      const mockResult = {
        captures: [{
          node: {
            type: 'function',
            text: 'function test() {}',
            startPosition: { row: 10, column: 5 },
            endPosition: { row: 12, column: 5 }
          }
        }]
      };
      
      // Create metadata using the adapter
      const metadata = adapter['createMetadata'](mockResult, 'javascript');
      
      // Verify it has the expected structure from MetadataBuilder
      expect(metadata.language).toBe('javascript');
      expect(Array.isArray(metadata.dependencies)).toBe(true);
      expect(Array.isArray(metadata.modifiers)).toBe(true);
    });

    it('should use MetadataBuilder in JavaScriptLanguageAdapter', async () => {
      const adapter = new JavaScriptLanguageAdapter();
      
      // Mock query results
      const mockQueryResults = [{
        captures: [{
          node: {
            type: 'function',
            text: 'function test() {}',
            startPosition: { row: 10, column: 5 },
            endPosition: { row: 12, column: 5 }
          }
        }],
        startLine: 10,
        endLine: 12
      }];
      
      const results = await adapter.normalize(mockQueryResults, 'function', 'javascript');
      
      // Verify results were created with MetadataBuilder
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.language).toBe('javascript');
      expect(results[0].metadata.complexity).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(results[0].metadata.dependencies)).toBe(true);
      expect(Array.isArray(results[0].metadata.modifiers)).toBe(true);
    });

    it('should use MetadataBuilder in PythonLanguageAdapter', async () => {
      const adapter = new PythonLanguageAdapter();
      
      // Mock query results
      const mockQueryResults = [{
        captures: [{
          node: {
            type: 'function',
            text: 'def test(): pass',
            startPosition: { row: 10, column: 5 },
            endPosition: { row: 12, column: 5 }
          }
        }],
        startLine: 10,
        endLine: 12
      }];
      
      const results = await adapter.normalize(mockQueryResults, 'function', 'python');
      
      // Verify results were created with MetadataBuilder
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata.language).toBe('python');
      expect(results[0].metadata.complexity).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(results[0].metadata.dependencies)).toBe(true);
      expect(Array.isArray(results[0].metadata.modifiers)).toBe(true);
    });
  });

  describe('Integration with Services', () => {
    // Integration tests for IndexingLogicService and GraphDataMappingService
    // would go here
  });
});
