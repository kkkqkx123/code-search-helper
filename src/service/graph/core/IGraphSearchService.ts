import {
  GraphSearchOptions,
  GraphSearchResult
} from './types';

export interface IGraphSearchService {
  search(query: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;
  searchByNodeType(nodeType: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;
  searchByRelationshipType(relationshipType: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;
  searchByPath(sourceId: string, targetId: string, options?: GraphSearchOptions): Promise<GraphSearchResult>;
  getSearchSuggestions(query: string): Promise<string[]>;
  getSearchStats(): Promise<{
    totalSearches: number;
    avgExecutionTime: number;
    cacheHitRate: number;
  }>;
  close(): Promise<void>;
  isServiceInitialized(): boolean;
}