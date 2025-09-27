import * as Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../AbstractSnippetRule';
import { SnippetChunk } from '../../types';

/**
 * Async Pattern Rule - Identifies async programming patterns across different languages
 * Supports: JavaScript/TypeScript (async/await), Python (async/await), C# (async/await)
 */
export class AsyncPatternRule extends AbstractSnippetRule {
  readonly name = 'AsyncPatternRule';
  readonly supportedNodeTypes = new Set([
    // JavaScript/TypeScript
    'async_function_declaration',
    'async_function_expression',
    'arrow_function',
    'await_expression',
    'promise_expression',
    'call_expression', // For Promise chains like fetch().then().catch()
    // Python
    'async_function_definition',
    'async_with_statement',
    'async_for_statement',
    // Generic patterns
    'function_definition',
    'function_declaration',
    'method_definition',
  ]);
  protected readonly snippetType = 'async_pattern' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check for async patterns in the content
    return this.containsAsyncPattern(content) && this.hasSufficientComplexity(content);
  }

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);

    // For Promise chains and concurrent execution patterns, we need to be more permissive
    // Check if it's a valid async pattern even without await keywords
    if (this.containsAsyncPattern(content)) {
      // For Promise chains (.then/.catch) or Promise.all/race patterns, 
      // we don't require await keywords
      if (/\.then\(|\.catch\(|Promise\.(all|race|allSettled)/.test(content)) {
        return true;
      }

      // For other patterns, use the standard complexity check
      return this.hasSufficientComplexity(content);
    }

    return true; // Default to true to let shouldProcessNode handle the rest
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const asyncFeatures = this.analyzeAsyncFeatures(content);

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
          ...asyncFeatures,
        },
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
        asyncPattern: this.extractAsyncPattern(content),
      },
    };
  }

  private containsAsyncPattern(content: string): boolean {
    const asyncPatterns = [
      // JavaScript/TypeScript patterns
      /\basync\s+function\b/,
      /\basync\s+\(/,
      /\bawait\s+/,
      /\.then\(/,
      /\.catch\(/,
      /Promise\.all/,
      /Promise\.race/,
      /Promise\.resolve/,
      /Promise\.reject/,
      /async\s+=>/,
      // Python patterns
      /\basync\s+def\b/,
      /\basync\s+with\b/,
      /\basync\s+for\b/,
      /\bawait\s+/,
      // General async indicators
      /\bcoroutine\b/,
      /\bfuture\b/,
      /\btask\b/,
    ];

    return asyncPatterns.some(pattern => pattern.test(content));
  }

  private hasSufficientComplexity(content: string): boolean {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const awaitCount = (content.match(/\bawait\s+/g) || []).length;
    const promiseChainCount = (content.match(/\.then\(|\.catch\(/g) || []).length;
    const promiseAllCount = (content.match(/Promise\.(all|race|allSettled)/g) || []).length;

    // Should have multiple lines and actual async operations
    // For Promise chains or concurrent patterns, we don't require await keywords
    const hasAsyncOperations = awaitCount > 0 || promiseChainCount > 0 || promiseAllCount > 0;
    return lines.length > 1 && hasAsyncOperations;
  }

  private analyzeAsyncFeatures(content: string): {
    usesAsync?: boolean;
    usesAwait?: boolean;
    usesPromises?: boolean;
    usesGenerators?: boolean;
    asyncPattern?: string;
  } {
    return {
      usesAsync: /\basync\s+/.test(content) || /\.then\(|\.catch\(|Promise\./.test(content),
      usesAwait: /\bawait\s+/.test(content),
      usesPromises: /Promise\.|\.then\(|\.catch\(/.test(content),
      usesGenerators: /function\s*\*|yield\b/.test(content),
      asyncPattern: this.extractAsyncPattern(content),
    };
  }

  private extractAsyncPattern(content: string): string {
    if (content.includes('Promise.all') || content.includes('Promise.race')) {
      return 'concurrent_execution';
    }
    if (content.includes('.then(') && content.includes('.catch(')) {
      return 'promise_chain';
    }
    if (/\basync\s+function\b/.test(content) && /\btry\s*\{/.test(content)) {
      return 'async_error_handling';
    }
    if (/\basync\s+=>\b/.test(content)) {
      return 'async_arrow_function';
    }
    if (/\bawait\s+.+\b\.then\b/.test(content)) {
      return 'mixed_async_pattern';
    }
    return 'basic_async';
  }

  // Override complexity calculation for async patterns
  protected calculateComplexity(content: string): number {
    const baseComplexity = super.calculateComplexity(content);
    const asyncComplexity = this.calculateAsyncComplexity(content);

    return baseComplexity + asyncComplexity;
  }

  private calculateAsyncComplexity(content: string): number {
    let complexity = 0;

    // Add complexity for async operations
    complexity += (content.match(/\bawait\s+/g) || []).length * 2;
    complexity += (content.match(/Promise\.(all|race|allSettled)/g) || []).length * 3;
    complexity += (content.match(/\.then\(/g) || []).length * 2;
    complexity += (content.match(/\.catch\(/g) || []).length * 2;
    complexity += (content.match(/try\s*\{.*\bawait/gs) || []).length * 3;

    return complexity;
  }
}
