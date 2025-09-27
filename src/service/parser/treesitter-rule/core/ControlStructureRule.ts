import Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../AbstractSnippetRule';
import { SnippetChunk } from '../../types';

export class ControlStructureRule extends AbstractSnippetRule {
  readonly name = 'ControlStructureRule';
  readonly supportedNodeTypes = new Set([
    'if_statement',
    'else_clause',
    'for_statement',
    'while_statement',
    'do_statement',
    'switch_statement',
  ]);
  protected readonly snippetType = 'control_structure' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Enhanced filtering for meaningful control structures
    return this.hasMeaningfulControlStructure(content) && this.hasSufficientComplexity(content);
  }

  private hasMeaningfulControlStructure(content: string): boolean {
    // Filter out trivial control structures
    const trivialPatterns = [
      /if\s*\([^)]*\)\s*\w+;\s*$/, // if (condition) statement;
      /if\s*\([^)]*\)\s*\{\s*\w+;\s*\}/, // if (condition) { statement; }
      /for\s*\(;;\)\s*\{\s*\}/, // empty for loop
      /while\s*\([^)]*\)\s*;/, // while (condition);
    ];

    return !trivialPatterns.some(pattern => pattern.test(content));
  }

  private hasSufficientComplexity(content: string): boolean {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const hasMultipleStatements = lines.length > 1;
    const hasNestedLogic = /if|for|while|switch/.test(content) && lines.length > 2;
    const hasComplexCondition = /\&\&|\|\||\?\s*:/.test(content);

    return hasMultipleStatements || hasNestedLogic || hasComplexCondition;
  }

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
}
