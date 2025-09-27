import * as Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../../AbstractSnippetRule';
import { SnippetChunk } from '../../../types';

/**
 * Python Comprehension Rule - Identifies Python list, dict, and set comprehensions
 */
export class PythonComprehensionRule extends AbstractSnippetRule {
  readonly name = 'PythonComprehensionRule';
  readonly supportedNodeTypes = new Set([
    'list_comprehension',
    'dictionary_comprehension',
    'set_comprehension',
    'generator_expression',
  ]);
  protected readonly snippetType = 'python_comprehension' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Ensure meaningful comprehension (not too simple)
    return this.hasMeaningfulComprehension(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const comprehensionFeatures = this.analyzeComprehensionFeatures(content);

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
        languageFeatures: {
          ...this.analyzeLanguageFeatures(content),
          ...comprehensionFeatures,
        },
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
        comprehensionInfo: this.extractComprehensionInfo(content),
      },
    };
  }

  private hasMeaningfulComprehension(content: string): boolean {
    // Should have actual operations, not just simple iteration
    const hasCondition = content.includes(' if ');
    const hasTransform = /[a-zA-Z_]\w+\s*for/.test(content);
    const hasMultipleTargets = content.includes(',') && content.includes(' for ');

    return hasCondition || hasTransform || hasMultipleTargets;
  }

  private analyzeComprehensionFeatures(content: string): {
    comprehensionType?: 'list' | 'dict' | 'set' | 'generator';
    hasConditions?: boolean;
    hasNestedComprehensions?: boolean;
    isGenerator?: boolean;
  } {
    const comprehensionType = this.getComprehensionType(content);

    return {
      comprehensionType,
      hasConditions: content.includes(' if '),
      hasNestedComprehensions: /\[.*\[.*for.*in.*\].*for.*in.*\]/.test(content),
      isGenerator: content.includes('(') && !content.includes('[') && !content.includes('{'),
    };
  }

  private getComprehensionType(content: string): 'list' | 'dict' | 'set' | 'generator' {
    if (content.startsWith('[')) return 'list';
    if (content.startsWith('{')) {
      if (content.includes(':')) return 'dict';
      return 'set';
    }
    return 'generator';
  }

  private extractComprehensionInfo(content: string): {
    type: 'list' | 'dict' | 'set' | 'generator';
    conditions: number;
    loops: number;
    isNested: boolean;
    complexity: number;
  } {
    const type = this.getComprehensionType(content);
    const conditions = (content.match(/ if /g) || []).length;
    const loops = (content.match(/ for /g) || []).length;
    const isNested = /\[.*\[.*for.*in.*\].*for.*in.*\]/.test(content);
    const complexity = this.calculateComprehensionComplexity(content);

    return {
      type,
      conditions,
      loops,
      isNested,
      complexity,
    };
  }

  private calculateComprehensionComplexity(content: string): number {
    let complexity = 0;

    // Base complexity
    complexity += 1;

    // Add for conditions
    complexity += (content.match(/ if /g) || []).length * 2;

    // Add for multiple loops
    complexity += (content.match(/ for /g) || []).length - 1;

    // Add for nested comprehensions
    complexity += (content.match(/\[.*\[.*for.*in.*\].*for.*in.*\]/g) || []).length * 3;

    // Add for complex expressions
    const complexExpressions = [
      (content.match(/[a-zA-Z_]\w+\.[a-zA-Z_]\w+/g) || []).length,
      (content.match(/\([^)]*\)\s+for/g) || []).length,
      (content.match(/[+\-*/%&|^~<>]=?/g) || []).length,
    ].reduce((sum, val) => sum + val, 0);

    complexity += complexExpressions;

    return complexity;
  }

  protected calculateComplexity(content: string): number {
    const baseComplexity = super.calculateComplexity(content);
    const comprehensionComplexity = this.calculateComprehensionComplexity(content);

    return baseComplexity + comprehensionComplexity;
  }
}
