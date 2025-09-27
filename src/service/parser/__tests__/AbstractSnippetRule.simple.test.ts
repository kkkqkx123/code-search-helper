import { AbstractSnippetRule } from '../treesitter-rule/AbstractSnippetRule';
import { SnippetChunk } from '../types';
import Parser from 'tree-sitter';

// Mock tree-sitter Parser for testing
const createMockNode = (
  type: string,
  text: string,
  startIndex = 0,
  endIndex = text.length,
  children: Parser.SyntaxNode[] = []
): Parser.SyntaxNode => {
  const mockNode: any = {
    type,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 1, column: 0 },
    startIndex,
    endIndex,
    children,
    parent: null,
    childForFieldName: (fieldName: string) => null,
    fieldNameForChild: (childIndex: number) => null,
    namedChild: (index: number) => null,
    namedChildren: [],
    hasChanges: false,
    text,
  };
  return mockNode as Parser.SyntaxNode;
};

// Test implementation of AbstractSnippetRule for testing base functionality
class TestRule extends AbstractSnippetRule {
  readonly name = 'TestRule';
  readonly supportedNodeTypes = new Set(['test_node']);
  protected readonly snippetType = 'control_structure' as const;

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
      },
    };
  }

  // Override validation to allow test snippets to pass
  protected validateSnippet(snippet: SnippetChunk): boolean {
    // Simple validation for testing - just check basic length requirements
    return snippet.content.length >= 5 && snippet.content.length <= 1500;
  }
}

describe('AbstractSnippetRule Tests', () => {
  let rule: TestRule;
  let mockNode: Parser.SyntaxNode;
  const sourceCode = 'const test = "value";';

  beforeEach(() => {
    rule = new TestRule();
    mockNode = createMockNode('test_node', sourceCode);
  });

  test('should extract snippets from matching nodes', () => {
    const result = rule.extract(mockNode, sourceCode);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe(sourceCode);
    expect(result[0].snippetMetadata.snippetType).toBe('control_structure');
  });

  test('should not extract from non-matching node types', () => {
    const nonMatchingNode = createMockNode('other_node', sourceCode);
    const result = rule.extract(nonMatchingNode, sourceCode);
    expect(result).toHaveLength(0);
  });

  test('should respect max depth limit', () => {
    const deepNode = createMockNode('test_node', 'deep content');
    const childNode = createMockNode('test_node', 'child content');

    // Simulate deep nesting
    let currentNode = deepNode;
    for (let i = 0; i < 60; i++) {
      const newChild = { ...childNode };
      newChild.parent = currentNode;
      currentNode.children = [newChild];
      currentNode = newChild;
    }

    const result = rule.extract(deepNode, sourceCode);
    // Should not process nodes beyond maxDepth
    expect(result.length).toBeLessThan(60);
  });

  test('should extract node text correctly', () => {
    const text = (rule as any).getNodeText(mockNode, sourceCode);
    expect(text).toBe(sourceCode);
  });

  test('should extract node location correctly', () => {
    const location = (rule as any).getNodeLocation(mockNode);
    expect(location).toEqual({
      startLine: 1,
      endLine: 2,
      startColumn: 1,
      endColumn: 1,
    });
  });

  test('should extract context info correctly', () => {
    const contextInfo = (rule as any).extractContextInfo(mockNode, sourceCode, 0);
    expect(contextInfo.nestingLevel).toBe(0);
  });

  test('should calculate complexity correctly', () => {
    const complexCode = `
      if (condition) {
        while (true) {
          console.log('test');
        }
      }
    `;
    const complexity = (rule as any).calculateComplexity(complexCode);
    expect(complexity).toBeGreaterThan(1);
  });

  test('should analyze language features', () => {
    const asyncCode = 'async function test() { await Promise.resolve(); }';
    const features = (rule as any).analyzeLanguageFeatures(asyncCode);
    expect(features.usesAsync).toBe(true);
  });

  test('should detect side effects', () => {
    const sideEffectCode = 'console.log("test");';
    const hasSideEffects = (rule as any).hasSideEffects(sideEffectCode);
    expect(hasSideEffects).toBe(true);
  });

  test('should generate unique snippet IDs', () => {
    const id1 = (rule as any).generateSnippetId('content1', 1);
    const id2 = (rule as any).generateSnippetId('content2', 2);
    expect(id1).not.toBe(id2);
    expect(id1).toContain('control_structure_1_');
  });

  test('should have correct name and supported types', () => {
    expect(rule.name).toBe('TestRule');
    expect(rule.supportedNodeTypes).toBeInstanceOf(Set);
    expect(rule.supportedNodeTypes.has('test_node')).toBe(true);
  });

  test('should have default configuration', () => {
    expect((rule as any).config.maxDepth).toBe(50);
    expect((rule as any).config.minComplexity).toBe(2);
    expect((rule as any).config.maxComplexity).toBe(100);
    expect((rule as any).config.minLines).toBe(1);
    expect((rule as any).config.maxLines).toBe(50);
  });

  test('should accept custom configuration', () => {
    const customRule = new TestRule({ maxDepth: 100, minComplexity: 5 });
    expect((customRule as any).config.maxDepth).toBe(100);
    expect((customRule as any).config.minComplexity).toBe(5);
    expect((customRule as any).config.maxComplexity).toBe(100); // default value
  });

  test('should generate consistent hash values', () => {
    const content = 'test content';
    const hash1 = (rule as any)['simpleHash'](content);
    const hash2 = (rule as any)['simpleHash'](content);

    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('string');
  });

  test('should handle malformed nodes gracefully', () => {
    // Create a node with null/undefined properties
    const malformedNode: any = createMockNode('test_node', 'test');
    malformedNode.startIndex = null;
    malformedNode.endIndex = undefined;

    // Should not throw errors
    expect(() => {
      rule.extract(malformedNode, 'test');
    }).not.toThrow();
  });

  test('should handle empty source code', () => {
    const node = createMockNode('test_node', '');

    const result = rule.extract(node, '');
    expect(Array.isArray(result)).toBe(true);
  });
});
