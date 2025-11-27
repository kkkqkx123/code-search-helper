import { CommonConfig } from './types';

/**
 * 基础设施配置接口
 * 使用提取的公共配置接口来减少重复
 */
export interface InfrastructureConfig {
  // 通用配置
  common: CommonConfig;
  
  // Qdrant特定配置 - 仅基础设施特定部分（数据库配置由 QdrantConfigService 管理）
  qdrant: {
    vector?: {
      defaultCollection?: string;
      collectionOptions?: {
        vectorSize?: number;
        distance?: 'Cosine' | 'Euclidean' | 'DotProduct';
        indexing?: {
          type?: string;
          options?: Record<string, any>;
        };
      };
      searchOptions?: {
        limit?: number;
        threshold?: number;
        exactSearch?: boolean;
      };
    };
  };
  
  // Nebula特定配置 - 仅基础设施特定部分（数据库配置由 NebulaConfigService 管理）
  nebula: {
    graph: {
      defaultSpace?: string;
      spaceOptions?: {
        partitionNum?: number;
        replicaFactor?: number;
        vidType?: 'FIXED_STRING' | 'INT64';
      };
      queryOptions?: {
        timeout?: number;
        retryAttempts?: number;
      };
      schemaManagement?: {
        autoCreateTags?: boolean;
        autoCreateEdges?: boolean;
      };
    };
  };
  
}