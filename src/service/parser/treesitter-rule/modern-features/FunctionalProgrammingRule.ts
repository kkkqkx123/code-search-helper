import * as Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../AbstractSnippetRule';
import { SnippetChunk } from '../../types';

/**
 * Functional Programming Rule - Identifies functional programming patterns across different languages
 * Supports: JavaScript/TypeScript (map, filter, reduce), Python (lambda, comprehensions), Java (streams)
 */
export class FunctionalProgrammingRule extends AbstractSnippetRule {
  readonly name = 'FunctionalProgrammingRule';
  readonly supportedNodeTypes = new Set([
    // JavaScript/TypeScript
    'arrow_function',
    'call_expression',
    'method_call',
    // Python
    'lambda_expression',
    'list_comprehension',
    'dict_comprehension',
    'set_comprehension',
    'generator_expression',
    'call_expression',
    // Java
    'lambda_expression',
    'method_reference',
    'method_call',
    // General functional patterns
    'function_expression',
    'function_definition',
  ]);
  protected readonly snippetType = 'functional_programming' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check for functional programming patterns
    return (
      this.containsFunctionalPattern(content) && this.hasSufficientFunctionalComplexity(content)
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
    const functionalFeatures = this.analyzeFunctionalFeatures(content);

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
          ...functionalFeatures,
        },
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
        functionalInfo: {
          usesArrowFunctions: content.includes('=>'),
          usesFunctionComposition: (content.match(/=>/g) || []).length > 1,
          usesHigherOrderFunctions: /\.(map|filter|reduce|forEach|find|some|every)\s*\(/.test(
            content
          ),
          usesCurrying: /curry\(/.test(content),
          usesRecursion: /function\s+\w+\s*\([^)]*\)\s*{.*\w+\s*\(/g.test(content),
          usesImmutability: this.usesImmutability(content),
          complexity: this.calculateFunctionalComplexity(content),
        },
      },
    };
  }

  private containsFunctionalPattern(content: string): boolean {
    const functionalPatterns = [
      // Higher-order functions
      /\.map\s*\(/,
      /\.filter\s*\(/,
      /\.reduce\s*\(/,
      /\.forEach\s*\(/,
      /\.find\s*\(/,
      /\.some\s*\(/,
      /\.every\s*\(/,
      /\.sort\s*\(/,
      // Arrow functions and lambdas
      /=>/,
      /lambda\s+/,
      // Comprehensions
      /\[.*\s+for\s+.*\s+in\s+.*\]/,
      /\{.*\s+for\s+.*\s+in\s+.*\}/,
      // Method references
      /::/,
      /Class::method/,
      // Functional utility patterns
      /compose\(/,
      /pipe\(/,
      /curry\(/,
      /memoize\(/,
      // Java streams
      /\.stream\(\)/,
      /\.filter\s*\(/,
      /\.map\s*\(/,
      /\.collect\s*\(/,
      // Functional array methods
      /Array\.from/,
      /Array\.of/,
      /Object\.keys/,
      /Object\.values/,
      /Object\.entries/,
    ];

    return functionalPatterns.some(pattern => pattern.test(content));
  }

  private hasSufficientFunctionalComplexity(content: string): boolean {
    const functionalOperations = [
      (content.match(/\.map\s*\(/g) || []).length,
      (content.match(/\.filter\s*\(/g) || []).length,
      (content.match(/\.reduce\s*\(/g) || []).length,
      (content.match(/=>/g) || []).length,
      (content.match(/lambda\s+/g) || []).length,
    ].reduce((sum, count) => sum + count, 0);

    // Should have at least 2 functional operations or one complex chain
    return functionalOperations >= 2 || content.includes('.map(') || content.includes('.reduce(');
  }

  private analyzeFunctionalFeatures(content: string): {
    usesHigherOrderFunctions?: boolean;
    usesPureFunctions?: boolean;
    usesImmutability?: boolean;
    usesFunctionComposition?: boolean;
    functionalLanguage?: 'javascript' | 'typescript' | 'python' | 'java';
    functionalDepth?: number;
  } {
    const jsTsPatterns = /\.map\s*\(|\.filter\s*\(|\.reduce\s*\(|=>/;
    const pythonPatterns = /lambda\s+|\[.*for.*in.*\]|\{.*for.*in.*\}/;
    const javaPatterns = /\.stream\(\)|::|lambda/;

    let functionalLanguage: 'javascript' | 'typescript' | 'python' | 'java' | undefined;
    if (jsTsPatterns.test(content)) {
      functionalLanguage =
        content.includes('interface') || content.includes(':') ? 'typescript' : 'javascript';
    } else if (pythonPatterns.test(content)) {
      functionalLanguage = 'python';
    } else if (javaPatterns.test(content)) {
      functionalLanguage = 'java';
    }

    const functionalDepth = this.calculateFunctionalDepth(content);

    return {
      usesHigherOrderFunctions: /\.(map|filter|reduce|forEach|find|some|every)\s*\(/.test(content),
      usesPureFunctions: this.usesPureFunctions(content),
      usesImmutability: this.usesImmutability(content),
      usesFunctionComposition: /compose\(|\.then\s*\(|\.reduce\s*\(/.test(content),
      functionalLanguage,
      functionalDepth,
    };
  }

  private calculateFunctionalDepth(content: string): number {
    let depth = 0;

    // Calculate method chaining depth
    const methodChains = content.match(/\.\w+\s*\([^)]*\)\s*(?=\.\w+\s*\()/g) || [];
    depth += methodChains.length;

    // Calculate arrow function nesting
    const arrowFunctions = content.match(/=>\s*{[^}]*=>/g) || [];
    depth += arrowFunctions.length;

    // Calculate comprehension nesting
    const comprehensions = content.match(/\[.*\[.*for.*in.*\].*for.*in.*\]/g) || [];
    depth += comprehensions.length * 2;

    return depth;
  }

  private usesPureFunctions(content: string): boolean {
    // Check for pure function patterns
    const purePatterns = [
      // Functions that don't modify their inputs
      /\.map\s*\(/,
      /\.filter\s*\(/,
      /\.find\s*\(/,
      // No direct state modification
      /const\s+\w+\s*=\s*\w+\.map/,
      /const\s+\w+\s*=\s*\w+\.filter/,
      // Return expressions without side effects
      /return\s+\w+\.\w+\(\)/,
      /=>\s*\w+\.\w+\(\)/,
    ];

    const impurePatterns = [
      // State modification
      /\.push\(/,
      /\.pop\(/,
      /\.shift\(/,
      /\.unshift\(/,
      /\.splice\(/,
      /\.sort\(/,
      // External state access
      /console\./,
      /document\./,
      /window\./,
    ];

    const hasPure = purePatterns.some(pattern => pattern.test(content));
    const hasImpure = impurePatterns.some(pattern => pattern.test(content));

    return hasPure && !hasImpure;
  }

  private usesImmutability(content: string): boolean {
    const immutablePatterns = [
      // Spread operator for copying
      /\.\.\./,
      // Object.create, Object.assign for immutability
      /Object\.assign\(\{\},/,
      /Object\.create\(/,
      // Immutable array operations
      /\.slice\(\)/,
      /\.concat\(/,
      // Map/Set for immutable collections
      /new\s+Map\(/,
      /new\s+Set\(/,
      // Immutable return patterns
      /return\s*\{\s*\.\.\.\w+\s*\}/,
      /return\s*\[\s*\.\.\.\w+\s*\]/,
    ];

    return immutablePatterns.some(pattern => pattern.test(content));
  }

  private extractFunctionalInfo(content: string): {
    patterns: string[];
    operations: string[];
    chainingDepth: number;
    functionalStyle?: 'declarative' | 'imperative' | 'hybrid';
    purity?: 'pure' | 'impure' | 'mixed';
  } {
    const patterns: string[] = [];
    const operations: string[] = [];

    // Identify patterns
    if (content.includes('.map(')) patterns.push('mapping');
    if (content.includes('.filter(')) patterns.push('filtering');
    if (content.includes('.reduce(')) patterns.push('reduction');
    if (content.includes('=>')) patterns.push('arrow_function');
    if (content.includes('lambda')) patterns.push('lambda');
    if (content.includes('.stream()')) patterns.push('stream_processing');
    if ((content.match(/=>/g) || []).length > 1) patterns.push('function_composition');

    // Identify operations
    const operationMatches =
      content.match(/\.(map|filter|reduce|forEach|find|some|every|sort|slice|concat)\s*\(/g) || [];
    operations.push(...operationMatches.map(op => op.replace(/[.(\s]/g, '')));

    // Calculate chaining depth
    const chainingDepth = this.calculateChainingDepth(content);

    // Determine style
    const functionalStyle = this.determineFunctionalStyle(content);
    const purity = this.determinePurity(content);

    return {
      patterns,
      operations,
      chainingDepth,
      functionalStyle,
      purity,
    };
  }

  private calculateChainingDepth(content: string): number {
    const chains = content.match(/\.\w+\s*\([^)]*\)\s*\.\w+\s*\(/g) || [];
    return Math.max(...chains.map(chain => (chain.match(/\.\w+\s*\(/g) || []).length), 0);
  }

  private determineFunctionalStyle(content: string): 'declarative' | 'imperative' | 'hybrid' {
    const declarativePatterns = [
      /\.map\s*\(/,
      /\.filter\s*\(/,
      /\.reduce\s*\(/,
      /\.stream\(\)/,
      /\[.*for.*in.*\]/,
    ];

    const imperativePatterns = [
      /for\s*\(/,
      /while\s*\(/,
      /if\s*\(/,
      /switch\s*\(/,
      /\.push\(/,
      /\.pop\(/,
    ];

    const declarativeCount = declarativePatterns.reduce(
      (count, pattern) => count + (content.match(pattern) || []).length,
      0
    );
    const imperativeCount = imperativePatterns.reduce(
      (count, pattern) => count + (content.match(pattern) || []).length,
      0
    );

    if (declarativeCount > imperativeCount * 2) return 'declarative';
    if (imperativeCount > declarativeCount * 2) return 'imperative';
    return 'hybrid';
  }

  private determinePurity(content: string): 'pure' | 'impure' | 'mixed' {
    const purePatterns = [/\.map\s*\(/, /\.filter\s*\(/, /\.find\s*\(/, /return\s+\w+\.\w+\(\)/];

    const impurePatterns = [
      /\.push\(/,
      /\.pop\(/,
      /console\./,
      /document\./,
      /window\./,
      /\.sort\(/,
      /\.reverse\(/,
    ];

    const pureCount = purePatterns.reduce(
      (count, pattern) => count + (content.match(pattern) || []).length,
      0
    );
    const impureCount = impurePatterns.reduce(
      (count, pattern) => count + (content.match(pattern) || []).length,
      0
    );

    if (pureCount > 0 && impureCount === 0) return 'pure';
    if (impureCount > 0 && pureCount === 0) return 'impure';
    return 'mixed';
  }

  // Override complexity calculation for functional patterns
  protected calculateComplexity(content: string): number {
    const baseComplexity = super.calculateComplexity(content);
    const functionalComplexity = this.calculateFunctionalComplexity(content);

    return baseComplexity + functionalComplexity;
  }

  private calculateFunctionalComplexity(content: string): number {
    let complexity = 0;

    // Add complexity for functional operations
    complexity += (content.match(/\.(map|filter|reduce|forEach|find|some|every)\s*\(/g) || [])
      .length;

    // Add complexity for chaining
    const chainComplexity = this.calculateChainingDepth(content) * 2;
    complexity += chainComplexity;

    // Add complexity for comprehensions
    complexity += (content.match(/\[.*for.*in.*\]/g) || []).length * 2;
    complexity += (content.match(/\{.*for.*in.*\}/g) || []).length * 2;

    // Add complexity for function composition
    complexity += (content.match(/=>\s*.*=>/g) || []).length * 3;
    complexity += (content.match(/\.then\s*\(/g) || []).length * 2;

    // Add complexity for stream operations
    complexity += (content.match(/\.stream\(\)/g) || []).length * 2;
    complexity += (content.match(/::/g) || []).length;

    return complexity;
  }
}
