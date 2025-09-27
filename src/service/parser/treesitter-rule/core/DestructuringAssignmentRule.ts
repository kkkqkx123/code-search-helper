import Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../AbstractSnippetRule';
import { SnippetChunk } from '../../types';

export class DestructuringAssignmentRule extends AbstractSnippetRule {
  readonly name = 'DestructuringAssignmentRule';
  readonly supportedNodeTypes = new Set(['object_pattern', 'array_pattern']);
  protected readonly snippetType = 'destructuring_assignment' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    return (
      super.shouldProcessNode(node, sourceCode) &&
      (this.supportedNodeTypes.has(node.type) ||
        (node.type === 'assignment_expression' &&
          (node.childForFieldName('left')?.type === 'object_pattern' ||
            node.childForFieldName('left')?.type === 'array_pattern')))
    );
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
