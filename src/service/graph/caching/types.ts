import { GraphNode, GraphRelationship } from '../mapping/IGraphDataMappingService';
import { GraphAnalysisResult } from '../core/types';

// 统一的缓存统计接口
export interface GraphCacheStats {
  hits: number;
  misses: number;
  evictions: number;
  sets: number;
  size: number;
  hitRate: number;
  hasSufficientData: boolean;
  levelStats?: Map<string, { hits: number; misses: number; size: number }>;
}

// 缓存级别配置
export interface CacheLevel {
  name: string;
  maxSize: number;
  ttl: number; // 毫秒
  priority: number; // 数字越小优先级越高
}

// 多级缓存配置
export interface MultiLevelCacheConfig {
  levels: CacheLevel[];
  enableStats: boolean;
  evictionPolicy: 'LRU' | 'FIFO' | 'LFU';
}

// 缓存条目
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  level?: number;
  size?: number;
}

// 图映射结果
export interface GraphMappingResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  timestamp: number;
}

// 缓存使用情况
export interface CacheUsage {
  total: number;
  used: number;
  percentage: number;
}

// 缓存健康状态
export interface CacheHealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  hitRate: number;
  size: number;
}