import { EventEmitter } from 'events';
import { LSPClient, LSPClientConfig } from './LSPClient';
import { LanguageServerRegistry } from './LanguageServerRegistry';

export interface PoolConfig {
  maxConnections: number;
  initialConnections: number;
  idleTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface PooledClient {
  client: LSPClient;
  lastUsed: number;
  isActive: boolean;
  workspaceRoot: string;
}

export class LSPClientPool extends EventEmitter {
  private clients = new Map<string, PooledClient[]>();
  private activeConnections = 0;
  private readonly config: PoolConfig;

  constructor(config: Partial<PoolConfig> = {}) {
    super();
    this.config = {
      maxConnections: config.maxConnections || 10,
      initialConnections: config.initialConnections || 2,
      idleTimeout: config.idleTimeout || 300000, // 5 minutes
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
    };
  }

  async acquire(workspaceRoot: string): Promise<LSPClient> {
    const key = this.getKey(workspaceRoot);

    // 检查是否有可用的空闲连接
    const pool = this.clients.get(key) || [];
    const availableClient = pool.find(c => !c.isActive);

    if (availableClient) {
      availableClient.isActive = true;
      availableClient.lastUsed = Date.now();
      return availableClient.client;
    }

    // 检查是否达到最大连接数
    if (this.activeConnections >= this.config.maxConnections) {
      // 尝试回收最老的空闲连接
      const oldestPool = this.findOldestPool();
      if (oldestPool) {
        await this.release(oldestPool.client);
      } else {
        throw new Error(`Maximum connections (${this.config.maxConnections}) reached`);
      }
    }

    // 创建新的连接
    const client = await this.createClient(workspaceRoot);

    if (!this.clients.has(key)) {
      this.clients.set(key, []);
    }

    this.clients.get(key)!.push({
      client,
      lastUsed: Date.now(),
      isActive: true,
      workspaceRoot,
    });

    this.activeConnections++;
    this.emit('clientCreated', { workspaceRoot, activeConnections: this.activeConnections });

    return client;
  }

  async release(client: LSPClient): Promise<void> {
    const key = this.getKey(client.getWorkspaceRoot());
    const pool = this.clients.get(key);

    if (!pool) return;

    const pooledClient = pool.find(c => c.client === client);
    if (!pooledClient) return;

    pooledClient.isActive = false;
    pooledClient.lastUsed = Date.now();

    // 检查是否需要清理空闲连接
    this.scheduleCleanup();
  }

  private getKey(workspaceRoot: string): string {
    return workspaceRoot;
  }

  private async createClient(workspaceRoot: string): Promise<LSPClient> {
    const registry = LanguageServerRegistry.getInstance();
    const serverConfig = registry.getServerConfig(workspaceRoot);

    if (!serverConfig) {
      throw new Error(`No language server configuration found for ${workspaceRoot}`);
    }

    const clientConfig = {
      command: serverConfig.command,
      args: serverConfig.args,
      workspaceRoot,
      timeout: 30000,
      retryAttempts: this.config.retryAttempts,
      retryDelay: this.config.retryDelay,
    };

    const client = new LSPClient(clientConfig);

    try {
      await client.initialize();
      return client;
    } catch (error) {
      // 清理失败的连接
      await client.shutdown();
      throw error;
    }
  }

  private findOldestPool(): PooledClient | null {
    let oldest: PooledClient | null = null;
    let oldestTime = Date.now();

    this.clients.forEach(pool => {
      pool.forEach(client => {
        if (!client.isActive && client.lastUsed < oldestTime) {
          oldest = client;
          oldestTime = client.lastUsed;
        }
      });
    });

    return oldest;
  }

  private scheduleCleanup(): void {
    setTimeout(() => {
      this.cleanupIdleConnections();
    }, this.config.idleTimeout);
  }

  private cleanupIdleConnections(): void {
    const now = Date.now();

    const keysToDelete: string[] = [];
    this.clients.forEach((pool, key) => {
      const remainingClients = pool.filter(client => {
        if (client.isActive) return true;

        const idleTime = now - client.lastUsed;
        if (idleTime > this.config.idleTimeout) {
          // 关闭空闲连接
          client.client.shutdown().catch(() => {
            // 忽略关闭错误
          });
          this.activeConnections--;
          this.emit('clientDestroyed', {
            workspaceRoot: client.workspaceRoot,
            activeConnections: this.activeConnections,
          });
          return false;
        }

        return true;
      });

      if (remainingClients.length === 0) {
        keysToDelete.push(key);
      } else {
        this.clients.set(key, remainingClients);
      }
    });

    keysToDelete.forEach(key => this.clients.delete(key));
  }

  async shutdown(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];

    this.clients.forEach(pool => {
      pool.forEach(client => {
        shutdownPromises.push(
          client.client.shutdown().catch(() => {
            // 忽略关闭错误
          })
        );
      });
    });

    await Promise.all(shutdownPromises);
    this.clients.clear();
    this.activeConnections = 0;

    this.emit('shutdown');
  }

  getStats(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    pools: Record<string, { active: number; idle: number }>;
  } {
    let idleConnections = 0;
    const pools: Record<string, { active: number; idle: number }> = {};

    this.clients.forEach((pool, key) => {
      const stats = { active: 0, idle: 0 };

      pool.forEach(client => {
        if (client.isActive) {
          stats.active++;
        } else {
          stats.idle++;
          idleConnections++;
        }
      });

      pools[key] = stats;
    });

    return {
      totalConnections: this.activeConnections,
      activeConnections: this.activeConnections - idleConnections,
      idleConnections,
      pools,
    };
  }

  async preload(workspaceRoot: string): Promise<void> {
    const key = this.getKey(workspaceRoot);
    const pool = this.clients.get(key) || [];

    // 预创建初始连接
    for (let i = pool.length; i < this.config.initialConnections; i++) {
      try {
        await this.acquire(workspaceRoot);
        this.emit('clientPreloaded', { workspaceRoot });
      } catch (error) {
        this.emit('error', error);
      }
    }
  }
}
