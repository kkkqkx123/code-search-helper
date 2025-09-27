export interface RedisConfig {
  enabled: boolean;
  url: string;
  maxmemory?: string;
  useMultiLevel: boolean; // 是否使用多级缓存
  ttl: {
    embedding: number; // 嵌入向量缓存TTL（秒）
    search: number; // 搜索结果缓存TTL
    graph: number; // 图数据缓存TTL
    progress: number; // 任务进度TTL
  };
  retry: {
    attempts: number;
    delay: number;
  };
  pool: {
    min: number;
    max: number;
  };
}

export const defaultRedisConfig: RedisConfig = {
  enabled: false,
  url: 'redis://localhost:6379',
  maxmemory: '256mb',
  useMultiLevel: true, // 默认启用多级缓存
  ttl: {
    embedding: 86400, // 24小时
    search: 3600, // 1小时
    graph: 1800, // 30分钟
    progress: 300, // 5分钟
  },
  retry: {
    attempts: 3,
    delay: 1000,
  },
  pool: {
    min: 1,
    max: 10,
  },
};
