import * as Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../../AbstractSnippetRule';
import { SnippetChunk } from '../../../types';

/**
 * Java Lambda Expression Rule - Identifies Java lambda expressions and functional interfaces
 */
export class JavaLambdaRule extends AbstractSnippetRule {
  readonly name = 'JavaLambdaRule';
  readonly supportedNodeTypes = new Set([
    'lambda_expression',
    'method_reference',
    'functional_interface',
    'parameterized_type',
  ]);
  protected readonly snippetType = 'java_lambda' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check for Java lambda patterns
    return this.containsJavaLambdaPattern(content) && this.hasMeaningfulLambda(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const lambdaFeatures = this.analyzeJavaLambdaFeatures(content);

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
          ...lambdaFeatures,
        },
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
        javaLambdaInfo: this.extractJavaLambdaInfo(content),
      },
    };
  }

  private containsJavaLambdaPattern(content: string): boolean {
    const lambdaPatterns = [
      /->\s*\{/,
      /->\s*\w+/,
      /::\w+/,
      /@\s*FunctionalInterface/,
      /Consumer|Supplier|Function|Predicate|UnaryOperator|BinaryOperator/,
    ];

    return lambdaPatterns.some(pattern => pattern.test(content));
  }

  private hasMeaningfulLambda(content: string): boolean {
    // Should have actual lambda operations, not just empty expressions
    const hasLambdaBody = /->\s*\{.*\}/.test(content) || /->\s*\w+/.test(content);
    const hasMethodReference = /::\w+/.test(content);
    const hasFunctionalInterface = /@(?:FunctionalInterface|Functional)/.test(content);

    return hasLambdaBody || hasMethodReference || hasFunctionalInterface;
  }

  private analyzeJavaLambdaFeatures(content: string): {
    usesLambdas?: boolean;
    usesMethodReferences?: boolean;
    usesFunctionalInterfaces?: boolean;
    lambdaComplexity?: number;
  } {
    const lambdaCount = (content.match(/->/g) || []).length;
    const methodRefCount = (content.match(/::/g) || []).length;
    const functionalInterfaceCount = (content.match(/@(?:FunctionalInterface|Functional)/g) || [])
      .length;

    return {
      usesLambdas: lambdaCount > 0,
      usesMethodReferences: methodRefCount > 0,
      usesFunctionalInterfaces: functionalInterfaceCount > 0,
      lambdaComplexity: this.calculateLambdaComplexity(content),
    };
  }

  private calculateLambdaComplexity(content: string): number {
    let complexity = 0;

    // Add complexity for lambda expressions
    complexity += (content.match(/->/g) || []).length;

    // Add complexity for method references
    complexity += (content.match(/::/g) || []).length * 2;

    // Add complexity for functional interfaces
    complexity += (content.match(/@(?:FunctionalInterface|Functional)/g) || []).length * 3;

    // Add complexity for lambda body complexity
    const lambdaBodies = content.match(/->\s*\{([^}]*)\}/g) || [];
    lambdaBodies.forEach(body => {
      const bodyContent = body.replace(/->\s*\{|}/g, '');
      const bodyComplexity = super.calculateComplexity(bodyContent);
      complexity += bodyComplexity;
    });

    return complexity;
  }

  private extractJavaLambdaInfo(content: string): {
    lambdaExpressions: string[];
    methodReferences: string[];
    functionalInterfaces: string[];
    lambdaParameters: number[];
    hasBlockBody: boolean;
    hasExpressionBody: boolean;
    purpose?: string;
  } {
    const lambdaExpressions: string[] = [];
    const methodReferences: string[] = [];
    const functionalInterfaces: string[] = [];
    const lambdaParameters: number[] = [];

    // Extract lambda expressions
    const lambdaRegex = /\(([^)]*)\)\s*->\s*(?:\{([^}]*)\}|(\w+))/g;
    let match;
    while ((match = lambdaRegex.exec(content)) !== null) {
      const params = match[1].trim();
      const body = match[2] || match[3];
      lambdaExpressions.push(`${params} -> ${body}`);

      // Count parameters
      const paramCount = params === '' ? 0 : params.split(',').length;
      lambdaParameters.push(paramCount);
    }

    // Extract method references
    const methodRefRegex = /(\w+(?:\.\w+)?)::(\w+)/g;
    while ((match = methodRefRegex.exec(content)) !== null) {
      methodReferences.push(`${match[1]}::${match[2]}`);
    }

    // Extract functional interfaces
    const functionalInterfaceRegex =
      /@(?:FunctionalInterface|Functional)\s+(?:interface\s+)?(\w+)/g;
    while ((match = functionalInterfaceRegex.exec(content)) !== null) {
      functionalInterfaces.push(match[1]);
    }

    const hasBlockBody = /->\s*\{/.test(content);
    const hasExpressionBody = /->\s*\w+/.test(content) && !hasBlockBody;
    const purpose = this.inferLambdaPurpose(
      lambdaExpressions,
      methodReferences,
      functionalInterfaces
    );

    return {
      lambdaExpressions,
      methodReferences,
      functionalInterfaces,
      lambdaParameters,
      hasBlockBody,
      hasExpressionBody,
      purpose,
    };
  }

  private inferLambdaPurpose(
    lambdaExpressions: string[],
    methodReferences: string[],
    functionalInterfaces: string[]
  ): string {
    if (methodReferences.length > 0) {
      return 'method_reference';
    }
    if (functionalInterfaces.some(fi => ['Consumer', 'Runnable'].includes(fi))) {
      return 'side_effect_operation';
    }
    if (functionalInterfaces.some(fi => ['Supplier'].includes(fi))) {
      return 'value_supply';
    }
    if (functionalInterfaces.some(fi => ['Predicate', 'Function'].includes(fi))) {
      return 'data_transformation';
    }
    if (lambdaExpressions.some(lambda => lambda.includes('return'))) {
      return 'computation';
    }
    return 'general_lambda';
  }

  protected calculateComplexity(content: string): number {
    const baseComplexity = super.calculateComplexity(content);
    const lambdaComplexity = this.calculateLambdaComplexity(content);

    return baseComplexity + lambdaComplexity;
  }
}
