export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface ICacheService {
  getFromCache<T>(key: string): T | undefined;
  setCache<T>(key: string, data: T, ttl: number): void;
  deleteFromCache(key: string): boolean;
  clearAllCache(): void;
  getCacheStats(): {
    totalEntries: number;
    hitCount: number;
    missCount: number;
    hitRate: number;
  };
  cleanupExpiredEntries(): void;
}

export interface CacheProvider {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, data: T, ttl: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  keys(): Promise<string[]>;
}

export interface CacheConfig {
  defaultTTL: number;
  maxEntries: number;
  cleanupInterval: number;
  enableStats: boolean;
}

export interface GraphAnalysisResult {
  nodes: any[];
  edges: any[];
  metrics: {
    totalNodes: number;
    totalEdges: number;
    averageDegree: number;
    maxDepth: number;
    componentCount: number;
  };
  summary: {
    projectFiles: number;
    functions: number;
    classes: number;
    imports: number;
    externalDependencies: number;
  };
}