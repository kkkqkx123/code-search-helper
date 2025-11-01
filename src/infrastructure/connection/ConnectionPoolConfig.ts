import { DatabaseType } from '../types';
import { ConnectionConfig } from '../types';

/**
 * 数据库特定配置
 */
export interface DatabaseSpecificConfig {
  [DatabaseType.QDRANT]?: {
    apiKey?: string;
    collectionName?: string;
    vectorSize?: number;
    distance?: string;
  };
  [DatabaseType.NEBULA]?: {
    spaceName?: string;
    username?: string;
    password?: string;
    graphOptions?: {
      enableReplica?: boolean;
      replicaFactor?: number;
      partitionNum?: number;
    };
  };
  [DatabaseType.SQLITE]?: {
    databasePath?: string;
    readonly?: boolean;
    timeout?: number;
  };
  [DatabaseType.VECTOR]?: {
    indexType?: string;
    dimensions?: number;
    metric?: string;
  };
  [DatabaseType.GRAPH]?: {
    enableVertexCache?: boolean;
    enableEdgeCache?: boolean;
    cacheSize?: number;
  };
}

/**
 * 连接池配置接口
 */
export interface ConnectionPoolConfig extends ConnectionConfig {
  // 数据库类型
  databaseType: DatabaseType;
  
  // 连接池大小配置
  minConnections: number;
  maxConnections: number;
  
  // 连接获取配置
  acquireTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  
  // 连接健康检查配置
  healthCheckInterval: number;
  healthCheckTimeout: number;
  
  // 连接回收配置
  idleTimeout: number;
  maxIdleTime: number;
  
  // 连接池监控配置
  enableMonitoring: boolean;
  monitoringInterval: number;
  
  // 连接池统计配置
  enableStatistics: boolean;
  statisticsInterval: number;
  
  // 数据库特定配置
  databaseSpecific?: DatabaseSpecificConfig;
  
  // 连接池事件处理器
  eventHandlers?: {
    onConnectionCreate?: (connectionId: string) => void;
    onConnectionAcquire?: (connectionId: string) => void;
    onConnectionRelease?: (connectionId: string) => void;
    onConnectionDestroy?: (connectionId: string) => void;
    onConnectionError?: (connectionId: string, error: Error) => void;
    onPoolFull?: () => void;
    onPoolEmpty?: () => void;
  };
}

/**
 * 默认连接池配置
 */
export const DEFAULT_CONNECTION_POOL_CONFIG: Partial<ConnectionPoolConfig> = {
  minConnections: 2,
  maxConnections: 10,
  connectionTimeout: 30000,
  idleTimeout: 300000, // 5分钟
  acquireTimeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
  healthCheckInterval: 60000, // 1分钟
  healthCheckTimeout: 5000,
  maxIdleTime: 1800000, // 30分钟
  enableMonitoring: true,
  monitoringInterval: 30000, // 30秒
  enableStatistics: true,
  statisticsInterval: 60000, // 1分钟
  validationInterval: 30000 // 30秒
};

/**
 * 数据库类型特定默认配置
 */
export const DATABASE_SPECIFIC_DEFAULT_CONFIG: Record<DatabaseType, Partial<ConnectionPoolConfig>> = {
  [DatabaseType.QDRANT]: {
    minConnections: 1,
    maxConnections: 20,
    connectionTimeout: 15000,
    idleTimeout: 600000, // 10分钟
    databaseSpecific: {
      [DatabaseType.QDRANT]: {
        vectorSize: 1536,
        distance: 'Cosine'
      }
    }
  },
  [DatabaseType.NEBULA]: {
    minConnections: 2,
    maxConnections: 15,
    connectionTimeout: 10000,
    idleTimeout: 300000, // 5分钟
    databaseSpecific: {
      [DatabaseType.NEBULA]: {
        username: 'root',
        password: 'nebula',
        graphOptions: {
          enableReplica: false,
          replicaFactor: 1,
          partitionNum: 10
        }
      }
    }
  },
  [DatabaseType.SQLITE]: {
    minConnections: 1,
    maxConnections: 5,
    connectionTimeout: 5000,
    idleTimeout: 120000, // 2分钟
    databaseSpecific: {
      [DatabaseType.SQLITE]: {
        readonly: false,
        timeout: 5000
      }
    }
  },
  [DatabaseType.VECTOR]: {
    minConnections: 1,
    maxConnections: 15,
    connectionTimeout: 15000,
    idleTimeout: 600000, // 10分钟
    databaseSpecific: {
      [DatabaseType.VECTOR]: {
        indexType: 'HNSW',
        dimensions: 1536,
        metric: 'Cosine'
      }
    }
  },
  [DatabaseType.GRAPH]: {
    minConnections: 2,
    maxConnections: 10,
    connectionTimeout: 10000,
    idleTimeout: 300000, // 5分钟
    databaseSpecific: {
      [DatabaseType.GRAPH]: {
        enableVertexCache: true,
        enableEdgeCache: true,
        cacheSize: 1000
      }
    }
  }
};

/**
 * 连接池配置管理器
 */
export class ConnectionPoolConfigManager {
  private configs: Map<DatabaseType, ConnectionPoolConfig> = new Map();
  
  /**
   * 获取数据库类型的配置
   */
  getConfig(databaseType: DatabaseType): ConnectionPoolConfig {
    if (!this.configs.has(databaseType)) {
      this.setDefaultConfig(databaseType);
    }
    
    return this.configs.get(databaseType)!;
  }
  
  /**
   * 设置数据库类型的配置
   */
  setConfig(databaseType: DatabaseType, config: Partial<ConnectionPoolConfig>): void {
    const currentConfig = this.getConfig(databaseType);
    const newConfig = this.mergeConfig(currentConfig, config);
    this.configs.set(databaseType, newConfig);
  }
  
  /**
   * 更新数据库类型的配置
   */
  updateConfig(databaseType: DatabaseType, updates: Partial<ConnectionPoolConfig>): void {
    const currentConfig = this.getConfig(databaseType);
    const updatedConfig = this.mergeConfig(currentConfig, updates);
    this.configs.set(databaseType, updatedConfig);
  }
  
  /**
   * 重置数据库类型的配置为默认值
   */
  resetConfig(databaseType: DatabaseType): void {
    this.setDefaultConfig(databaseType);
  }
  
  /**
   * 获取所有数据库类型的配置
   */
  getAllConfigs(): Map<DatabaseType, ConnectionPoolConfig> {
    // 确保所有数据库类型都有配置
    Object.values(DatabaseType).forEach(dbType => {
      if (!this.configs.has(dbType)) {
        this.setDefaultConfig(dbType);
      }
    });
    
    return new Map(this.configs);
  }
  
  /**
   * 验证配置是否有效
   */
  validateConfig(config: ConnectionPoolConfig): boolean {
    // 检查必需字段
    if (!config.databaseType) {
      return false;
    }
    
    // 检查数值范围
    if (config.minConnections < 0 || config.maxConnections < config.minConnections) {
      return false;
    }
    
    if (config.connectionTimeout <= 0 || config.idleTimeout <= 0) {
      return false;
    }
    
    if (config.acquireTimeout <= 0 || config.retryAttempts < 0) {
      return false;
    }
    
    if (config.retryDelay <= 0 || config.healthCheckInterval <= 0) {
      return false;
    }
    
    if (config.healthCheckTimeout <= 0 || config.maxIdleTime <= 0) {
      return false;
    }
    
    if (config.monitoringInterval <= 0 || config.statisticsInterval <= 0) {
      return false;
    }
    
    return true;
  }
  
  /**
   * 合并配置
   */
  private mergeConfig(baseConfig: ConnectionPoolConfig, updates: Partial<ConnectionPoolConfig>): ConnectionPoolConfig {
    return {
      ...baseConfig,
      ...updates,
      databaseSpecific: {
        ...baseConfig.databaseSpecific,
        ...updates.databaseSpecific
      },
      eventHandlers: {
        ...baseConfig.eventHandlers,
        ...updates.eventHandlers
      }
    };
  }
  
  /**
   * 设置默认配置
   */
  private setDefaultConfig(databaseType: DatabaseType): void {
    const defaultConfig = DATABASE_SPECIFIC_DEFAULT_CONFIG[databaseType] || {};
    const config: ConnectionPoolConfig = {
      databaseType,
      ...DEFAULT_CONNECTION_POOL_CONFIG,
      ...defaultConfig,
      // 确保必需字段有值
      minConnections: defaultConfig.minConnections || DEFAULT_CONNECTION_POOL_CONFIG.minConnections || 2,
      maxConnections: defaultConfig.maxConnections || DEFAULT_CONNECTION_POOL_CONFIG.maxConnections || 10,
      connectionTimeout: defaultConfig.connectionTimeout || DEFAULT_CONNECTION_POOL_CONFIG.connectionTimeout || 30000,
      idleTimeout: defaultConfig.idleTimeout || DEFAULT_CONNECTION_POOL_CONFIG.idleTimeout || 300000,
      acquireTimeout: defaultConfig.acquireTimeout || DEFAULT_CONNECTION_POOL_CONFIG.acquireTimeout || 10000,
      retryAttempts: defaultConfig.retryAttempts || DEFAULT_CONNECTION_POOL_CONFIG.retryAttempts || 3,
      retryDelay: defaultConfig.retryDelay || DEFAULT_CONNECTION_POOL_CONFIG.retryDelay || 1000,
      healthCheckInterval: defaultConfig.healthCheckInterval || DEFAULT_CONNECTION_POOL_CONFIG.healthCheckInterval || 60000,
      healthCheckTimeout: defaultConfig.healthCheckTimeout || DEFAULT_CONNECTION_POOL_CONFIG.healthCheckTimeout || 5000,
      maxIdleTime: defaultConfig.maxIdleTime || DEFAULT_CONNECTION_POOL_CONFIG.maxIdleTime || 1800000,
      enableMonitoring: defaultConfig.enableMonitoring !== undefined ? defaultConfig.enableMonitoring : DEFAULT_CONNECTION_POOL_CONFIG.enableMonitoring,
      monitoringInterval: defaultConfig.monitoringInterval || DEFAULT_CONNECTION_POOL_CONFIG.monitoringInterval || 30000,
      enableStatistics: defaultConfig.enableStatistics !== undefined ? defaultConfig.enableStatistics : DEFAULT_CONNECTION_POOL_CONFIG.enableStatistics,
      statisticsInterval: defaultConfig.statisticsInterval || DEFAULT_CONNECTION_POOL_CONFIG.statisticsInterval || 60000,
      validationInterval: defaultConfig.validationInterval || DEFAULT_CONNECTION_POOL_CONFIG.validationInterval || 30000
    } as ConnectionPoolConfig;
    
    this.configs.set(databaseType, config);
  }
}

// 导出全局配置管理器实例
export const globalConnectionPoolConfigManager = new ConnectionPoolConfigManager();