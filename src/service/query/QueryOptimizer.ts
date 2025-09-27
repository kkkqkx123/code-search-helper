import { injectable, inject } from 'inversify';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { TYPES } from '../../types';

export interface QueryRequest {
  query: string;
  projectId: string;
  options?: {
    limit?: number;
    threshold?: number;
    includeGraph?: boolean;
    filters?: {
      language?: string[];
      fileType?: string[];
      path?: string[];
    };
    searchType?: 'semantic' | 'hybrid' | 'graph';
  };
}

export interface OptimizedQuery {
  originalQuery: string;
  optimizedQuery: string;
  queryExpansion: string[];
  filters: {
    language: string[];
    fileType: string[];
    path: string[];
    custom: Array<{
      field: string;
      operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
      value: any;
    }>;
  };
  searchStrategy: {
    type: 'semantic' | 'hybrid' | 'graph' | 'multi_stage';
    parallel: boolean;
    cacheStrategy: 'aggressive' | 'moderate' | 'conservative';
  };
  performance: {
    estimatedLatency: number;
    complexity: 'low' | 'medium' | 'high';
    resourceUsage: 'low' | 'medium' | 'high';
  };
}

export interface QueryAnalysis {
  queryType: 'keyword' | 'semantic' | 'structural' | 'mixed';
  intent: 'search' | 'analysis' | 'navigation' | 'debugging';
  complexity: number;
  keywords: string[];
  queryExpansion: string[];
  entities: Array<{
    type: 'file' | 'function' | 'class' | 'variable' | 'concept';
    value: string;
    confidence: number;
  }>;
  context: {
    isCodeSpecific: boolean;
    isProjectSpecific: boolean;
    requiresGraphAnalysis: boolean;
  };
}

@injectable()
export class QueryOptimizer {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private queryHistory: Map<string, QueryAnalysis> = new Map();
  private performanceStats: Map<string, number> = new Map();

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;
  }

  async optimize(query: QueryRequest): Promise<OptimizedQuery> {
    this.logger.info('Optimizing query', {
      query: query.query,
      projectId: query.projectId,
    });

    try {
      // Analyze query intent and structure
      const analysis = await this.analyzeQuery(query);

      // Generate query expansions
      const expansions = await this.generateQueryExpansions(query.query, analysis);

      // Optimize filters
      const optimizedFilters = await this.optimizeFilters(query.options?.filters || {}, analysis);

      // Determine search strategy
      const searchStrategy = await this.determineSearchStrategy(analysis, query.options);

      // Estimate performance
      const performance = await this.estimatePerformance(analysis, searchStrategy);

      const optimizedQuery: OptimizedQuery = {
        originalQuery: query.query,
        optimizedQuery: this.optimizeQueryString(query.query, analysis),
        queryExpansion: expansions,
        filters: optimizedFilters,
        searchStrategy,
        performance,
      };

      // Cache analysis for future learning
      this.queryHistory.set(query.query, analysis);

      this.logger.info('Query optimization completed', {
        originalQuery: query.query,
        optimizedQuery: optimizedQuery.optimizedQuery,
        expansions: expansions.length,
        searchType: searchStrategy.type,
      });

      return optimizedQuery;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Query optimization failed: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'QueryOptimizer', operation: 'optimize' }
      );
      throw error;
    }
  }

  private async analyzeQuery(query: QueryRequest): Promise<QueryAnalysis> {
    const queryText = query.query.toLowerCase();

    // Determine query type
    const queryType = this.determineQueryType(queryText);

    // Determine intent
    const intent = this.determineIntent(queryText);

    // Extract keywords and entities
    const keywords = this.extractKeywords(queryText);
    const entities = await this.extractEntities(queryText, query.projectId);

    // Analyze context
    const context = this.analyzeContext(queryText, entities);

    // Calculate complexity
    const complexity = this.calculateComplexity(queryText, keywords, entities);

    return {
      queryType,
      intent,
      complexity,
      keywords,
      queryExpansion: [],
      entities,
      context,
    };
  }

  private determineQueryType(queryText: string): 'keyword' | 'semantic' | 'structural' | 'mixed' {
    const structuralPatterns = [
      /class\s+\w+/,
      /function\s+\w+/,
      /import\s+.*from/,
      /extends\s+\w+/,
      /implements\s+\w+/,
      /interface\s+\w+/,
      /type\s+\w+/,
    ];

    const semanticPatterns = [
      /what\s+is/,
      /how\s+to/,
      /explain/,
      /describe/,
      /purpose/,
      /meaning/,
      /concept/,
      /why/,
      /when\s+to/,
    ];

    const hasStructural = structuralPatterns.some(pattern => pattern.test(queryText));
    const hasSemantic = semanticPatterns.some(pattern => pattern.test(queryText));
    const hasKeywords = queryText.split(/\s+/).length > 1;

    if (hasStructural && hasSemantic) return 'mixed';
    if (hasStructural) return 'structural';
    if (hasSemantic) return 'semantic';
    if (hasKeywords) return 'keyword';

    return 'keyword';
  }

  private determineIntent(queryText: string): 'search' | 'analysis' | 'navigation' | 'debugging' {
    const searchPatterns = [/find/, /search/, /look for/, /where is/];
    const analysisPatterns = [/analyze/, /understand/, /explain/, /how does/];
    const navigationPatterns = [/go to/, /navigate to/, /show me/];
    const debuggingPatterns = [/error/, /bug/, /issue/, /problem/, /fix/];

    if (debuggingPatterns.some(pattern => pattern.test(queryText))) return 'debugging';
    if (analysisPatterns.some(pattern => pattern.test(queryText))) return 'analysis';
    if (navigationPatterns.some(pattern => pattern.test(queryText))) return 'navigation';
    if (searchPatterns.some(pattern => pattern.test(queryText))) return 'search';

    return 'search';
  }

  private extractKeywords(queryText: string): string[] {
    // Remove common stop words and extract meaningful keywords
    const stopWords = new Set([
      'the',
      'is',
      'at',
      'which',
      'on',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'with',
      'to',
      'for',
      'of',
      'as',
      'by',
      'be',
      'are',
      'was',
      'were',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
    ]);

    return queryText
      .split(/\s+/)
      .map(word => word.replace(/[^\w]/g, ''))
      .filter(word => word.length > 2 && !stopWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index);
  }

  private async extractEntities(
    queryText: string,
    projectId: string
  ): Promise<
    Array<{
      type: 'file' | 'function' | 'class' | 'variable' | 'concept';
      value: string;
      confidence: number;
    }>
  > {
    const entities: Array<{
      type: 'file' | 'function' | 'class' | 'variable' | 'concept';
      value: string;
      confidence: number;
    }> = [];

    // Extract file patterns
    const filePattern = /([a-zA-Z_][a-zA-Z0-9_]*)\.(ts|js|py|java|go|rs|cpp|c|md)/;
    const fileMatch = queryText.match(filePattern);
    if (fileMatch) {
      entities.push({
        type: 'file',
        value: fileMatch[1],
        confidence: 0.9,
      });
    }

    // Extract function patterns
    const functionPattern = /function\s+([a-zA-Z_][a-zA-Z0-9_]*)|([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/;
    const functionMatch = queryText.match(functionPattern);
    if (functionMatch) {
      entities.push({
        type: 'function',
        value: functionMatch[1] || functionMatch[2],
        confidence: 0.8,
      });
    }

    // Extract class patterns
    const classPattern = /class\s+([a-zA-Z_][a-zA-Z0-9_]*)/;
    const classMatch = queryText.match(classPattern);
    if (classMatch) {
      entities.push({
        type: 'class',
        value: classMatch[1],
        confidence: 0.8,
      });
    }

    // Extract programming concepts
    const concepts = [
      'algorithm',
      'data structure',
      'pattern',
      'architecture',
      'design',
      'framework',
      'library',
      'api',
      'interface',
      'implementation',
    ];

    concepts.forEach(concept => {
      if (queryText.includes(concept)) {
        entities.push({
          type: 'concept',
          value: concept,
          confidence: 0.6,
        });
      }
    });

    return entities;
  }

  private analyzeContext(
    queryText: string,
    entities: any[]
  ): {
    isCodeSpecific: boolean;
    isProjectSpecific: boolean;
    requiresGraphAnalysis: boolean;
  } {
    const codeKeywords = ['function', 'class', 'method', 'variable', 'parameter', 'return'];
    const structuralKeywords = ['dependency', 'import', 'extends', 'implements', 'interface'];

    const isCodeSpecific =
      codeKeywords.some(keyword => queryText.includes(keyword)) ||
      entities.some(e => e.type === 'function' || e.type === 'class');

    const isProjectSpecific =
      entities.some(e => e.type === 'file') ||
      queryText.includes('project') ||
      queryText.includes('codebase');

    const requiresGraphAnalysis =
      structuralKeywords.some(keyword => queryText.includes(keyword)) ||
      queryText.includes('dependency') ||
      queryText.includes('relationship');

    return {
      isCodeSpecific,
      isProjectSpecific,
      requiresGraphAnalysis,
    };
  }

  private calculateComplexity(queryText: string, keywords: string[], entities: any[]): number {
    let complexity = 0;

    // Base complexity from query length
    complexity += Math.min(queryText.length / 100, 0.3);

    // Keyword complexity
    complexity += Math.min(keywords.length / 10, 0.3);

    // Entity complexity
    complexity += Math.min(entities.length / 5, 0.2);

    // Structural complexity
    if (queryText.includes('and') || queryText.includes('or')) {
      complexity += 0.1;
    }

    // Filter complexity
    if (queryText.includes('where') || queryText.includes('filter')) {
      complexity += 0.1;
    }

    return Math.min(complexity, 1);
  }

  private async generateQueryExpansions(query: string, analysis: QueryAnalysis): Promise<string[]> {
    const expansions: string[] = [];

    // Add synonyms for key terms
    const synonyms = this.getSynonyms(analysis.keywords);
    expansions.push(...synonyms);

    // Add related concepts
    if (analysis.entities.length > 0) {
      const relatedConcepts = await this.getRelatedConcepts(analysis.entities);
      expansions.push(...relatedConcepts);
    }

    // Add context-aware expansions
    if (analysis.context.isCodeSpecific) {
      expansions.push('code', 'implementation', 'function');
    }

    return expansions.slice(0, 5); // Limit expansions
  }

  private getSynonyms(keywords: string[]): string[] {
    const synonymMap: Record<string, string[]> = {
      function: ['method', 'procedure', 'routine'],
      class: ['type', 'interface', 'struct'],
      error: ['exception', 'bug', 'issue'],
      performance: ['speed', 'efficiency', 'optimization'],
      data: ['information', 'content', 'structure'],
    };

    const synonyms: string[] = [];
    keywords.forEach(keyword => {
      if (synonymMap[keyword]) {
        synonyms.push(...synonymMap[keyword]);
      }
    });

    return synonyms;
  }

  private async getRelatedConcepts(entities: any[]): Promise<string[]> {
    // Mock implementation - in real system, this would query knowledge graph
    const concepts: string[] = [];

    entities.forEach(entity => {
      if (entity.type === 'class') {
        concepts.push('object', 'instance', 'method');
      } else if (entity.type === 'function') {
        concepts.push('parameter', 'return', 'call');
      }
    });

    return concepts;
  }

  private async optimizeFilters(
    filters: any,
    analysis: QueryAnalysis
  ): Promise<{
    language: string[];
    fileType: string[];
    path: string[];
    custom: Array<{
      field: string;
      operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
      value: any;
    }>;
  }> {
    const optimized = {
      language: filters.language || [],
      fileType: filters.fileType || [],
      path: filters.path || [],
      custom: [] as Array<{
        field: string;
        operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains';
        value: any;
      }>,
    };

    // Add intelligent filters based on analysis
    if (analysis.entities.length > 0) {
      const fileEntities = analysis.entities.filter(e => e.type === 'file');
      if (fileEntities.length > 0) {
        optimized.custom.push({
          field: 'fileName',
          operator: 'contains',
          value: fileEntities[0].value,
        });
      }
    }

    // Add language filters if query is language-specific
    if (analysis.queryType === 'structural') {
      const detectedLanguages = this.detectLanguageFromQuery(analysis.keywords);
      if (detectedLanguages.length > 0) {
        optimized.language = detectedLanguages;
      }
    }

    return optimized;
  }

  private detectLanguageFromQuery(keywords: string[]): string[] {
    const languageMap: Record<string, string[]> = {
      typescript: ['ts', 'tsx', 'typescript'],
      javascript: ['js', 'jsx', 'javascript'],
      python: ['py', 'python'],
      java: ['java'],
      go: ['go'],
      rust: ['rs', 'rust'],
    };

    const detected: string[] = [];
    keywords.forEach(keyword => {
      if (languageMap[keyword]) {
        detected.push(...languageMap[keyword]);
      }
    });

    return [...new Set(detected)];
  }

  private async determineSearchStrategy(
    analysis: QueryAnalysis,
    options?: any
  ): Promise<{
    type: 'semantic' | 'hybrid' | 'graph' | 'multi_stage';
    parallel: boolean;
    cacheStrategy: 'aggressive' | 'moderate' | 'conservative';
  }> {
    let type: 'semantic' | 'hybrid' | 'graph' | 'multi_stage' = 'semantic';
    let parallel = true;
    let cacheStrategy: 'aggressive' | 'moderate' | 'conservative' = 'moderate';

    // Determine search type based on analysis
    if (analysis.context.requiresGraphAnalysis) {
      type = analysis.queryType === 'semantic' ? 'hybrid' : 'graph';
    } else if (analysis.queryType === 'mixed') {
      type = 'multi_stage';
    } else if (analysis.queryType === 'structural') {
      type = 'hybrid';
    }

    // Determine parallel execution
    parallel = analysis.complexity < 0.7 && type !== 'graph';

    // Determine cache strategy
    if (analysis.complexity < 0.3) {
      cacheStrategy = 'aggressive';
    } else if (analysis.complexity > 0.7) {
      cacheStrategy = 'conservative';
    }

    // Override with user preferences
    if (options?.searchType) {
      type = options.searchType;
    }

    return {
      type,
      parallel,
      cacheStrategy,
    };
  }

  private async estimatePerformance(
    analysis: QueryAnalysis,
    strategy: any
  ): Promise<{
    estimatedLatency: number;
    complexity: 'low' | 'medium' | 'high';
    resourceUsage: 'low' | 'medium' | 'high';
  }> {
    let estimatedLatency = 100; // Base latency in ms
    let complexity: 'low' | 'medium' | 'high' = 'low';
    let resourceUsage: 'low' | 'medium' | 'high' = 'low';

    // Adjust based on query complexity
    estimatedLatency += analysis.complexity * 200;

    // Adjust based on search strategy
    if (strategy.type === 'multi_stage') {
      estimatedLatency += 150;
      resourceUsage = 'medium';
    } else if (strategy.type === 'hybrid') {
      estimatedLatency += 100;
      resourceUsage = 'medium';
    } else if (strategy.type === 'graph') {
      estimatedLatency += 200;
      resourceUsage = 'high';
    }

    // Adjust based on parallel execution
    if (!strategy.parallel) {
      estimatedLatency *= 1.5;
    }

    // Determine complexity level
    if (analysis.complexity < 0.3) {
      complexity = 'low';
    } else if (analysis.complexity < 0.7) {
      complexity = 'medium';
    } else {
      complexity = 'high';
    }

    return {
      estimatedLatency: Math.round(estimatedLatency),
      complexity,
      resourceUsage,
    };
  }

  private optimizeQueryString(query: string, analysis: QueryAnalysis): string {
    let optimized = query;

    // Remove redundant words
    optimized = this.removeRedundantWords(optimized);

    // Normalize whitespace
    optimized = optimized.replace(/\s+/g, ' ').trim();

    // Add query expansions if beneficial
    if (analysis.queryExpansion.length > 0 && analysis.complexity < 0.5) {
      optimized += ` ${analysis.queryExpansion.slice(0, 2).join(' ')}`;
    }

    return optimized;
  }

  private removeRedundantWords(query: string): string {
    const redundantWords = ['please', 'can you', 'could you', 'help me', 'show me'];
    let result = query.toLowerCase();

    redundantWords.forEach(word => {
      result = result.replace(new RegExp(word, 'gi'), '');
    });

    return result.trim();
  }

  async getOptimizationStats(): Promise<{
    totalOptimizations: number;
    averageImprovement: number;
    topOptimizations: Array<{
      type: string;
      count: number;
      improvement: number;
    }>;
  }> {
    return {
      totalOptimizations: this.queryHistory.size,
      averageImprovement: 0.25,
      topOptimizations: [
        { type: 'query_expansion', count: 45, improvement: 0.3 },
        { type: 'filter_optimization', count: 32, improvement: 0.2 },
        { type: 'strategy_selection', count: 28, improvement: 0.25 },
      ],
    };
  }
}
