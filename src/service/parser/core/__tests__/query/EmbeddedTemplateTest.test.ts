import { QueryManager } from '../../query/QueryManager';
import { QueryLoader } from '../../query/QueryLoader';
import Parser from 'tree-sitter';

// Mock tree-sitter for testing
const mockParser = {
  getLanguage: jest.fn().mockReturnValue({}),
  query: jest.fn().mockReturnValue({
    matches: jest.fn().mockReturnValue([
      {
        captures: [
          { name: 'name.definition.code', node: { type: 'code', text: 'function test() {}' } }
        ]
      }
    ])
  })
} as any;

// Mock Parser.Query constructor
jest.mock('tree-sitter', () => ({
  Query: jest.fn().mockImplementation(() => mockParser.query())
}));

describe('Embedded Template Query Tests', () => {
  beforeAll(async () => {
    // Initialize QueryManager
    await QueryManager.initialize();
    
    // Load embedded-template queries
    await QueryLoader.loadLanguageQueries('embedded-template');
  });

  test('should load embedded-template language queries', () => {
    expect(QueryLoader.isLanguageLoaded('embedded-template')).toBe(true);
    expect(QueryLoader.getQueryTypesForLanguage('embedded-template')).toContain('code-blocks');
    expect(QueryLoader.getQueryTypesForLanguage('embedded-template')).toContain('output-blocks');
    expect(QueryLoader.getQueryTypesForLanguage('embedded-template')).toContain('comments');
  });

  test('should get code-blocks query pattern', () => {
    const query = QueryLoader.getQuery('embedded-template', 'code-blocks');
    expect(query).toContain('directive');
    expect(query).toContain('@name.definition.code');
    expect(query).toContain('@definition.directive');
  });

  test('should get output-blocks query pattern', () => {
    const query = QueryLoader.getQuery('embedded-template', 'output-blocks');
    expect(query).toContain('output_directive');
    expect(query).toContain('@output.content');
    expect(query).toContain('@output');
  });

  test('should get comments query pattern', () => {
    const query = QueryLoader.getQuery('embedded-template', 'comments');
    expect(query).toContain('comment_directive');
    expect(query).toContain('@name.definition.comment');
    expect(query).toContain('@definition.comment');
  });

  test('should execute code-blocks query', () => {
    const mockAST = {
      type: 'document',
      children: [
        {
          type: 'directive',
          children: [
            { type: 'code', text: 'function test() {}' }
          ]
        }
      ]
    } as any;

    const results = QueryManager.executeQuery(
      mockAST,
      'embedded-template',
      'code-blocks',
      mockParser
    );

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  test('should execute batch queries for embedded-template', () => {
    const mockAST = {
      type: 'document',
      children: []
    } as any;

    const results = QueryManager.executeBatchQueries(
      mockAST,
      'embedded-template',
      ['code-blocks', 'output-blocks', 'comments'],
      mockParser
    );

    expect(results).toBeDefined();
    expect(results.size).toBe(3);
    expect(results.has('code-blocks')).toBe(true);
    expect(results.has('output-blocks')).toBe(true);
    expect(results.has('comments')).toBe(true);
  });

  test('should check embedded-template support', () => {
    expect(QueryManager.isSupported('embedded-template')).toBe(true);
    expect(QueryManager.isSupported('embedded-template', 'code-blocks')).toBe(true);
    expect(QueryManager.isSupported('embedded-template', 'output-blocks')).toBe(true);
    expect(QueryManager.isSupported('embedded-template', 'comments')).toBe(true);
    expect(QueryManager.isSupported('embedded-template', 'nonexistent')).toBe(false);
  });

  test('should get query types for embedded-template', () => {
    const queryTypes = QueryManager.getQueryTypesForLanguage('embedded-template');
    expect(queryTypes).toContain('code-blocks');
    expect(queryTypes).toContain('output-blocks');
    expect(queryTypes).toContain('comments');
  });

  test('should combine patterns for embedded-template', () => {
    const combinedPattern = QueryManager.combinePatterns(
      'embedded-template',
      ['code-blocks', 'output-blocks']
    );

    expect(combinedPattern).toContain('directive');
    expect(combinedPattern).toContain('output_directive');
    expect(combinedPattern).toContain('@name.definition.code');
    expect(combinedPattern).toContain('@output.content');
  });
});