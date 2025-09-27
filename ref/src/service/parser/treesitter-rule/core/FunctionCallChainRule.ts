import Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../AbstractSnippetRule';
import { SnippetChunk } from '../../types';

export class FunctionCallChainRule extends AbstractSnippetRule {
  readonly name = 'FunctionCallChainRule';
  readonly supportedNodeTypes = new Set(['call_expression', 'expression_statement']);
  protected readonly snippetType = 'function_call_chain' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    // Enhanced filtering for meaningful function call chains
    return this.isMeaningfulFunctionCallChain(node, sourceCode);
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
        callChainInfo: this.extractCallChainInfo(content),
      },
    };
  }

  private isMeaningfulFunctionCallChain(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);

    // Filter out simple function calls
    const simplePatterns = [
      /^[a-zA-Z_]\w*\(\s*\)$/, // func()
      /^[a-zA-Z_]\w*\(\s*[a-zA-Z_]\w*\s*\)$/, // func(arg)
      /console\.(log|error|warn|info)\(/, // console.log calls (too common)
      /return\s+[a-zA-Z_]\w*\(\s*\);?$/, // return func();
    ];

    const isSimpleCall = simplePatterns.some(pattern => pattern.test(content.trim()));
    if (isSimpleCall) return false;

    // Check for meaningful call characteristics
    const hasChain = this.countCallChainLength(content) > 1;
    const hasComplexArgs = this.hasComplexArguments(content);
    const hasAsyncOperations = content.includes('await') || content.includes('Promise');
    const hasMethodChaining = content.includes('.') && content.length > 15;
    const hasCallback = /=>|function/.test(content);

    return hasChain || hasComplexArgs || hasAsyncOperations || hasMethodChaining || hasCallback;
  }

  private hasComplexArguments(content: string): boolean {
    const argsMatch = content.match(/\(([^)]*)\)/);
    if (!argsMatch) return false;

    const args = argsMatch[1];

    // Check for complex argument patterns
    return (
      args.length > 10 || // Long argument list
      args.includes(',') || // Multiple arguments
      /=>|function/.test(args) || // Callback arguments
      /\{.*\}/.test(args) || // Object arguments
      /\[.*\]/.test(args) || // Array arguments
      args.includes('.') // Object property access
    );
  }

  private countCallChainLength(content: string): number {
    const methodCalls = content.match(/\.\w+\s*\(/g) || [];
    return methodCalls.length + 1; // +1 for the initial function call
  }

  private extractCallChainInfo(content: string): {
    chainLength: number;
    hasAsyncOperations: boolean;
    hasCallbacks: boolean;
    hasComplexArguments: boolean;
    callType?: 'simple' | 'chained' | 'async' | 'callback_based';
  } {
    const chainLength = this.countCallChainLength(content);
    const hasAsyncOperations = content.includes('await') || content.includes('Promise');
    const hasCallbacks = /=>|function/.test(content);
    const hasComplexArguments = this.hasComplexArguments(content);

    let callType: 'simple' | 'chained' | 'async' | 'callback_based' = 'simple';
    if (hasAsyncOperations) {
      callType = 'async';
    } else if (hasCallbacks) {
      callType = 'callback_based';
    } else if (chainLength > 1) {
      callType = 'chained';
    }

    return {
      chainLength,
      hasAsyncOperations,
      hasCallbacks,
      hasComplexArguments,
      callType,
    };
  }
}
