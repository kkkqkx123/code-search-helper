import Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../AbstractSnippetRule';
import { SnippetChunk } from '../../types';

export class LogicBlockRule extends AbstractSnippetRule {
  readonly name = 'LogicBlockRule';
  readonly supportedNodeTypes = new Set(['block', 'statement_block', 'function_definition']);
  protected readonly snippetType = 'logic_block' as const;

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    return this.isMeaningfulLogicBlock(node, sourceCode);
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

  private isMeaningfulLogicBlock(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);
    // Should contain multiple statements or complex logic, or be a function definition
    const statements = content.split(';').filter(s => s.trim().length > 0);
    return statements.length >= 2 || content.length > 50 || /\bfunction\b/.test(content);
  }
}
