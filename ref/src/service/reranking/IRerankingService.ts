import { QueryResult } from '../query/QueryCoordinationService';

export interface RerankingOptions {
  strategy?: 'semantic' | 'graph' | 'hybrid' | 'ml';
  weights?: {
    semantic?: number;
    graph?: number;
    contextual?: number;
    recency?: number;
    popularity?: number;
  };
  limit?: number;
  threshold?: number;
}

export interface RerankedResult extends QueryResult {
  rerankingMetrics: {
    originalScore: number;
    semanticScore: number;
    graphScore: number;
    contextualScore: number;
    finalScore: number;
    confidence: number;
  };
}

export interface IRerankingService {
  rerank(
    results: QueryResult[],
    query: string,
    options?: RerankingOptions
  ): Promise<RerankedResult[]>;
  getRerankingStats(): Promise<{
    totalRerankings: number;
    averageImprovement: number;
    strategyDistribution: Record<string, number>;
  }>;
}
