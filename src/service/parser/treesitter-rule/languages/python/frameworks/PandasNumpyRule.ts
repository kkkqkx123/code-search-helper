import * as Parser from 'tree-sitter';
import { SnippetChunk, SnippetMetadata } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * Pandas/NumPy Framework Rule - Extracts data science and array manipulation patterns
 */
export class PandasNumpyRule extends AbstractSnippetRule {
  readonly name = 'PandasNumpyRule';
  readonly supportedNodeTypes = new Set([
    'import_statement',
    'call_expression',
    'assignment',
    'attribute',
    'function_definition',
    'method_definition',
    'subscript',
    'operator_expression',
  ]);

  protected snippetType = 'data_manipulation' as const;

  // Common pandas and numpy patterns
  private readonly pandasPatterns = [
    'pd\\.',
    'pandas\\.',
    'DataFrame\\(',
    'Series\\(',
    'read_csv\\(',
    'read_excel\\(',
    'groupby\\(',
    'merge\\(',
    'pivot\\(',
    'melt\\(',
    'drop\\(',
    'fillna\\(',
    'replace\\(',
    'concat\\(',
    'join\\(',
    'apply\\(',
    'map\\(',
    'value_counts\\(',
    'sort_values\\(',
    'nunique\\(',
    'describe\\(',
    'info\\(',
    'head\\(',
    'tail\\(',
    'iterrows\\(',
    'itertuples\\(',
  ];

  private readonly numpyPatterns = [
    'np\\.',
    'numpy\\.',
    'array\\(',
    'arange\\(',
    'linspace\\(',
    'zeros\\(',
    'ones\\(',
    'eye\\(',
    'identity\\(',
    'random\\.',
    'dot\\(',
    'matmul\\(',
    'transpose\\(',
    'reshape\\(',
    'flatten\\(',
    'ravel\\(',
    'concatenate\\(',
    'stack\\(',
    'hstack\\(',
    'vstack\\(',
    'split\\(',
    'sort\\(',
    'argsort\\(',
    'mean\\(',
    'std\\(',
    'var\\(',
    'min\\(',
    'max\\(',
    'sum\\(',
    'cumsum\\(',
    'unique\\(',
    'where\\(',
    'select\\(',
    'linalg\\.',
    'fft\\.',
  ];

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const nodeText = this.getNodeText(node, sourceCode);

    // Check if node contains pandas or numpy patterns
    return this.isPandasPattern(nodeText) || this.isNumpyPattern(nodeText);
  }

  private isPandasPattern(text: string): boolean {
    return this.pandasPatterns.some(pattern => new RegExp(pattern, 'i').test(text));
  }

  private isNumpyPattern(text: string): boolean {
    return this.numpyPatterns.some(pattern => new RegExp(pattern, 'i').test(text));
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    if (
      !this.validateSnippet({
        id: '',
        content,
        startLine: location.startLine,
        endLine: location.endLine,
        startByte: node.startIndex,
        endByte: node.endIndex,
        type: 'snippet',
        imports: [],
        exports: [],
        metadata: {},
        snippetMetadata: {} as SnippetMetadata,
      })
    ) {
      return null;
    }

    // Extract framework-specific information
    const frameworkInfo = this.extractFrameworkInfo(content);
    const complexity = this.calculateDataComplexity(content);

    const metadata: SnippetMetadata = {
      snippetType: this.snippetType,
      contextInfo,
      languageFeatures: this.analyzeLanguageFeatures(content),
      complexity,
      isStandalone: true,
      hasSideEffects: this.hasSideEffects(content),
    };

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
      snippetMetadata: metadata,
    };
  }

  private extractFrameworkInfo(text: string): {
    patterns: string[];
    operations: string[];
  } {
    const patterns: string[] = [];
    const operations: string[] = [];

    // Identify pandas patterns
    if (text.includes('pd.') || text.includes('pandas.')) {
      patterns.push('pandas-import');
      if (text.includes('DataFrame')) patterns.push('dataframe-creation');
      if (text.includes('Series')) patterns.push('series-creation');
      if (text.includes('groupby')) patterns.push('grouping-operation');
      if (text.includes('merge') || text.includes('join')) patterns.push('join-operation');
      if (text.includes('pivot') || text.includes('melt')) patterns.push('reshaping-operation');
    }

    // Identify numpy patterns
    if (text.includes('np.') || text.includes('numpy.')) {
      patterns.push('numpy-import');
      if (text.includes('array')) patterns.push('array-creation');
      if (text.includes('random')) patterns.push('random-operations');
      if (text.includes('linalg')) patterns.push('linear-algebra');
      if (text.includes('fft')) patterns.push('fourier-transform');
    }

    // Extract specific operations
    if (text.includes('.sum(') || text.includes('.mean(') || text.includes('.std(')) {
      operations.push('aggregation');
    }
    if (text.includes('.fillna(') || text.includes('.dropna(') || text.includes('.replace(')) {
      operations.push('data-cleaning');
    }
    if (text.includes('.merge(') || text.includes('.concat(')) {
      operations.push('data-combination');
    }
    if (text.includes('.apply(') || text.includes('.map(')) {
      operations.push('data-transformation');
    }
    if (text.includes('reshape') || text.includes('transpose')) {
      operations.push('data-reshaping');
    }

    return { patterns, operations };
  }

  private calculateDataComplexity(text: string): number {
    let complexity = 1;

    // Base complexity for data operations
    complexity += text.split('\n').length * 0.5;

    // Increase complexity for specific operations
    if (text.includes('groupby')) complexity += 2;
    if (text.includes('merge') || text.includes('join')) complexity += 3;
    if (text.includes('pivot') || text.includes('melt')) complexity += 2;
    if (text.includes('apply')) complexity += 2;
    if (text.includes('concatenate') || text.includes('stack')) complexity += 2;

    // Increase complexity for multiple chained operations
    const methodChainCount = (text.match(/\.\w+\(/g) || []).length;
    complexity += methodChainCount * 0.5;

    // Increase complexity for complex expressions
    const bracketCount = (text.match(/\[/g) || []).length;
    complexity += bracketCount * 0.3;

    return Math.min(complexity, 100);
  }

  private generateDataTags(text: string): string[] {
    const tags: string[] = ['data-science'];

    if (this.isPandasPattern(text)) {
      tags.push('pandas', 'dataframe', 'tabular-data');
    }
    if (this.isNumpyPattern(text)) {
      tags.push('numpy', 'arrays', 'numerical-computing');
    }

    // Add operation-specific tags
    if (text.includes('groupby')) tags.push('grouping');
    if (text.includes('merge') || text.includes('join')) tags.push('joining');
    if (text.includes('pivot') || text.includes('melt')) tags.push('reshaping');
    if (text.includes('fillna') || text.includes('dropna')) tags.push('data-cleaning');
    if (text.includes('apply')) tags.push('transformation');
    if (text.includes('concatenate') || text.includes('stack')) tags.push('array-combination');
    if (text.includes('linalg')) tags.push('linear-algebra');
    if (text.includes('random')) tags.push('random-generation');

    return tags;
  }

  private inferDataType(text: string): string {
    if (text.includes('DataFrame') || text.includes('Series')) {
      return 'tabular';
    }
    if (text.includes('array') || text.includes('arange') || text.includes('linspace')) {
      return 'array';
    }
    if (text.includes('matrix') || text.includes('matmul')) {
      return 'matrix';
    }
    if (text.includes('groupby') || text.includes('pivot')) {
      return 'grouped';
    }
    return 'numerical';
  }

  private extractDataOperations(text: string): string[] {
    const operations: string[] = [];

    // Data loading operations
    if (text.includes('read_csv') || text.includes('read_excel')) {
      operations.push('data-loading');
    }

    // Data cleaning operations
    if (text.includes('fillna') || text.includes('dropna') || text.includes('replace')) {
      operations.push('data-cleaning');
    }

    // Data transformation operations
    if (text.includes('apply') || text.includes('map') || text.includes('transform')) {
      operations.push('data-transformation');
    }

    // Aggregation operations
    if (text.includes('groupby') || text.includes('agg') || text.includes('aggregate')) {
      operations.push('aggregation');
    }

    // Reshaping operations
    if (text.includes('pivot') || text.includes('melt') || text.includes('reshape')) {
      operations.push('reshaping');
    }

    // Mathematical operations
    if (
      text.includes('sum') ||
      text.includes('mean') ||
      text.includes('std') ||
      text.includes('var')
    ) {
      operations.push('statistical-operations');
    }

    // Array operations
    if (text.includes('concatenate') || text.includes('stack') || text.includes('split')) {
      operations.push('array-operations');
    }

    // Linear algebra operations
    if (text.includes('dot') || text.includes('matmul') || text.includes('linalg')) {
      operations.push('linear-algebra');
    }

    return operations;
  }

  protected getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    const lines = sourceCode.split('\n');
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;

    return lines.slice(startLine, endLine + 1).join('\n');
  }

  protected generateSnippetId(content: string, startLine: number): string {
    const hash = this.localSimpleHash(content).substring(0, 8);
    return `${this.name}_${startLine}_${hash}`;
  }

  private localSimpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}
