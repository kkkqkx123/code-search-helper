import { DatabaseType } from '../types';

/**
 * 数据库连接状态枚举
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

/**
 * 数据库连接统计信息
 */
export interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  failedConnections: number;
  averageConnectionTime: number;
  lastConnectionTime: Date | null;
  lastError: Error | null;
  lastErrorTime: Date | null;
}

/**
 * 数据库连接配置
 */
export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  connectionTimeout: number;
  idleTimeout: number;
  maxRetries: number;
  retryDelay: number;
  enableSsl?: boolean;
  additionalOptions?: Record<string, any>;
}

/**
 * 通用数据库连接接口
 */
export interface IDatabaseConnection {
  /**
   * 获取连接类型
   */
  getType(): DatabaseType;

  /**
   * 获取连接状态
   */
  getStatus(): ConnectionStatus;

  /**
   * 获取连接统计信息
   */
  getStats(): ConnectionStats;

  /**
   * 连接到数据库
   */
  connect(config?: DatabaseConnectionConfig): Promise<void>;

  /**
   * 断开数据库连接
   */
  disconnect(): Promise<void>;

  /**
   * 检查连接是否活跃
   */
  isConnected(): boolean;

  /**
   * 检查连接是否健康
   */
  isHealthy(): Promise<boolean>;

  /**
   * 重新连接到数据库
   */
  reconnect(): Promise<void>;

  /**
   * 尝试自动重连
   * @param maxRetries 最大重试次数
   * @param retryDelay 重试延迟（毫秒）
   */
  autoReconnect(maxRetries?: number, retryDelay?: number): Promise<boolean>;

  /**
   * 获取连接配置
   */
  getConfig(): DatabaseConnectionConfig | null;

  /**
   * 获取最后错误信息
   */
  getLastError(): Error | null;

  /**
   * 获取连接创建时间
   */
  getCreatedAt(): Date;

  /**
   * 获取最后活动时间
   */
  getLastActivityTime(): Date;

  /**
   * 更新最后活动时间
   */
  updateLastActivityTime(): void;

  /**
   * 获取连接ID
   */
  getId(): string;
}

/**
 * 抽象数据库连接基类
 */
export abstract class AbstractDatabaseConnection implements IDatabaseConnection {
  protected id: string;
 protected type: DatabaseType;
  protected status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  protected config: DatabaseConnectionConfig | null = null;
  protected createdAt: Date;
  protected lastActivityTime: Date;
  protected lastError: Error | null = null;
  protected stats: ConnectionStats;

  constructor(type: DatabaseType) {
    this.type = type;
    this.id = this.generateConnectionId();
    this.createdAt = new Date();
    this.lastActivityTime = new Date();
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      failedConnections: 0,
      averageConnectionTime: 0,
      lastConnectionTime: null,
      lastError: null,
      lastErrorTime: null
    };
  }

  /**
   * 生成唯一的连接ID
   */
  private generateConnectionId(): string {
    return `${this.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取连接类型
   */
  getType(): DatabaseType {
    return this.type;
  }

  /**
   * 获取连接状态
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * 获取连接统计信息
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * 获取连接配置
   */
  getConfig(): DatabaseConnectionConfig | null {
    return this.config;
  }

  /**
   * 获取最后错误信息
   */
  getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * 获取连接创建时间
   */
  getCreatedAt(): Date {
    return this.createdAt;
  }

  /**
   * 获取最后活动时间
   */
  getLastActivityTime(): Date {
    return this.lastActivityTime;
  }

  /**
   * 更新最后活动时间
   */
  updateLastActivityTime(): void {
    this.lastActivityTime = new Date();
  }

  /**
   * 获取连接ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * 连接到数据库（子类需要实现）
   */
  abstract connect(config?: DatabaseConnectionConfig): Promise<void>;

  /**
   * 断开数据库连接（子类需要实现）
   */
  abstract disconnect(): Promise<void>;

  /**
   * 检查连接是否活跃（子类需要实现）
   */
  abstract isConnected(): boolean;

  /**
   * 检查连接是否健康（子类需要实现）
   */
  abstract isHealthy(): Promise<boolean>;

  /**
   * 重新连接到数据库
   */
  async reconnect(): Promise<void> {
    this.status = ConnectionStatus.RECONNECTING;
    
    try {
      // 先断开现有连接
      if (this.isConnected()) {
        await this.disconnect();
      }
      
      // 重新连接
      await this.connect(this.config || undefined);
      
      this.status = ConnectionStatus.CONNECTED;
      this.stats.lastConnectionTime = new Date();
    } catch (error) {
      this.status = ConnectionStatus.ERROR;
      this.lastError = error instanceof Error ? error : new Error(String(error));
      this.stats.lastError = this.lastError;
      this.stats.lastErrorTime = new Date();
      this.stats.failedConnections++;
      throw error;
    }
 }

  /**
   * 尝试自动重连
   * @param maxRetries 最大重试次数
   * @param retryDelay 重试延迟（毫秒）
   */
  async autoReconnect(maxRetries: number = 3, retryDelay: number = 100): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.reconnect();
        
        return true;
      } catch (error) {
        if (attempt === maxRetries) {
          // 所有重试都失败了
          this.status = ConnectionStatus.ERROR;
          this.lastError = error instanceof Error ? error : new Error(String(error));
          this.stats.lastError = this.lastError;
          this.stats.lastErrorTime = new Date();
          this.stats.failedConnections++;
          return false;
        }

        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt)); // 指数退避
      }
    }
    
    return false;
  }

  /**
   * 更新连接统计信息
   */
  protected updateStats(connectionTime: number): void {
    this.stats.totalConnections++;
    this.stats.activeConnections++;
    
    if (this.stats.lastConnectionTime) {
      const totalTime = this.stats.averageConnectionTime * (this.stats.totalConnections - 1) + connectionTime;
      this.stats.averageConnectionTime = totalTime / this.stats.totalConnections;
    } else {
      this.stats.averageConnectionTime = connectionTime;
    }
    
    this.stats.lastConnectionTime = new Date();
  }

  /**
   * 处理连接错误
   */
  protected handleConnectionError(error: Error): void {
    this.status = ConnectionStatus.ERROR;
    this.lastError = error;
    this.stats.lastError = error;
    this.stats.lastErrorTime = new Date();
    this.stats.failedConnections++;
    this.stats.activeConnections--;
  }
}