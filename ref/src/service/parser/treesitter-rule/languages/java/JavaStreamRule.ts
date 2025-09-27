import * as Parser from 'tree-sitter';
import { AbstractSnippetRule } from '../../AbstractSnippetRule';
import { SnippetChunk } from '../../../types';

/**
 * Java Stream Rule - Identifies Java Stream API patterns and operations
 */
export class JavaStreamRule extends AbstractSnippetRule {
  readonly name = 'JavaStreamRule';
  readonly supportedNodeTypes = new Set([
    'method_call',
    'lambda_expression',
    'method_reference',
    'expression_statement',
  ]);
  protected readonly snippetType = 'java_stream' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check for Java Stream patterns
    return this.containsJavaStreamPattern(content) && this.hasMeaningfulStreamOperation(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const streamFeatures = this.analyzeJavaStreamFeatures(content);

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
          ...streamFeatures,
        },
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
        javaStreamInfo: this.extractJavaStreamInfo(content),
      },
    };
  }

  private containsJavaStreamPattern(content: string): boolean {
    const streamPatterns = [
      /\.stream\s*\(\)/,
      /\.stream\(\)\./,
      /Stream\.of\(/,
      /IntStream\.of\(/,
      /LongStream\.of\(/,
      /DoubleStream\.of\(/,
      /Arrays\.stream\(/,
      /Collection\.stream\(\)/,
      /List\.stream\(\)/,
      /Set\.stream\(\)/,
    ];

    return streamPatterns.some(pattern => pattern.test(content));
  }

  private hasMeaningfulStreamOperation(content: string): boolean {
    // Should have actual stream operations, not just .stream()
    const operations = [
      (
        content.match(/\.(map|filter|forEach|reduce|collect|sorted|distinct|limit|skip)\s*\(/g) ||
        []
      ).length,
      (content.match(/::/g) || []).length,
    ].reduce((sum, count) => sum + count, 0);

    return operations > 0;
  }

  private analyzeJavaStreamFeatures(content: string): {
    usesStreamAPI?: boolean;
    usesMethodReferences?: boolean;
    usesLambdas?: boolean;
    streamComplexity?: number;
  } {
    const streamOperations = this.countStreamOperations(content);
    const methodReferences = (content.match(/::/g) || []).length;
    const lambdas = (content.match(/->/g) || []).length;

    return {
      usesStreamAPI: /\.stream\s*\(\)/.test(content),
      usesMethodReferences: methodReferences > 0,
      usesLambdas: lambdas > 0,
      streamComplexity: streamOperations,
    };
  }

  private countStreamOperations(content: string): number {
    const operations = [
      'map',
      'filter',
      'forEach',
      'reduce',
      'collect',
      'sorted',
      'distinct',
      'limit',
      'skip',
      'peek',
      'flatMap',
      'mapToInt',
      'mapToLong',
      'mapToDouble',
      'boxed',
      'toArray',
      'findFirst',
      'findAny',
      'anyMatch',
      'allMatch',
      'noneMatch',
      'min',
      'max',
      'count',
      'average',
      'sum',
      'summaryStatistics',
    ];

    return operations.reduce(
      (count, op) => count + (content.match(new RegExp(`\\.${op}\\s*\\(`, 'g')) || []).length,
      0
    );
  }

  private extractJavaStreamInfo(content: string): {
    operations: string[];
    collectors: string[];
    usesParallelStream: boolean;
    usesMethodReferences: boolean;
    usesLambdas: boolean;
    chainingDepth: number;
    streamType?: 'sequential' | 'parallel';
    purpose?: string;
  } {
    const operations: string[] = [];
    const collectors: string[] = [];

    // Extract operations
    const opPatterns = [/\.(\w+)\s*\(/g, /::(\w+)/g];

    for (const pattern of opPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        operations.push(match[1]);
      }
    }

    // Extract collectors
    const collectorPatterns = [/Collectors\.(\w+)\s*\(/g, /\.collect\s*\(\s*(\w+)::/g];

    for (const pattern of collectorPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        collectors.push(match[1]);
      }
    }

    const usesParallelStream = /\.parallelStream\s*\(\)/.test(content);
    const usesMethodReferences = /::/.test(content);
    const usesLambdas = /->/.test(content);
    const chainingDepth = this.calculateStreamChainingDepth(content);
    const streamType = usesParallelStream ? 'parallel' : 'sequential';
    const purpose = this.inferStreamPurpose(operations, collectors);

    return {
      operations: [...new Set(operations)],
      collectors: [...new Set(collectors)],
      usesParallelStream,
      usesMethodReferences,
      usesLambdas,
      chainingDepth,
      streamType,
      purpose,
    };
  }

  private calculateStreamChainingDepth(content: string): number {
    const chains = content.match(/\.stream\(\)\..*\./g) || [];
    return Math.max(...chains.map(chain => (chain.match(/\.\w+\s*\(/g) || []).length), 0);
  }

  private inferStreamPurpose(operations: string[], collectors: string[]): string {
    if (collectors.includes('groupingBy') || collectors.includes('partitioningBy')) {
      return 'grouping_aggregation';
    }
    if (collectors.includes('joining') || operations.includes('map')) {
      return 'transformation';
    }
    if (
      operations.includes('filter') &&
      (collectors.includes('count') || collectors.includes('toList'))
    ) {
      return 'filtering_collection';
    }
    if (operations.includes('sorted')) {
      return 'sorting';
    }
    if (operations.includes('reduce') || collectors.includes('reducing')) {
      return 'reduction';
    }
    if (operations.includes('flatMap')) {
      return 'flattening';
    }
    if (operations.includes('distinct') || collectors.includes('toSet')) {
      return 'deduplication';
    }
    return 'general_processing';
  }

  protected calculateComplexity(content: string): number {
    const baseComplexity = super.calculateComplexity(content);
    const streamComplexity = this.calculateJavaStreamComplexity(content);

    return baseComplexity + streamComplexity;
  }

  private calculateJavaStreamComplexity(content: string): number {
    let complexity = 0;

    // Add complexity for stream operations
    complexity += this.countStreamOperations(content);

    // Add complexity for chaining
    complexity += this.calculateStreamChainingDepth(content) * 2;

    // Add complexity for parallel streams
    complexity += (content.match(/\.parallelStream\s*\(\)/g) || []).length * 3;

    // Add complexity for method references
    complexity += (content.match(/::/g) || []).length * 2;

    // Add complexity for complex collectors
    const complexCollectors = [
      (content.match(/Collectors\.(groupingBy|partitioningBy|mapping|reducing)/g) || []).length * 3,
      (content.match(/Collectors\.(toList|toSet|toMap|joining)/g) || []).length * 2,
    ].reduce((sum, val) => sum + val, 0);

    complexity += complexCollectors;

    return complexity;
  }
}
