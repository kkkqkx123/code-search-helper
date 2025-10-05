import { injectable } from 'inversify';

export interface ConnectionState {
  connectionId: string;
  currentSpace: string;
  lastUsed: number;
  isHealthy: boolean;
}

@injectable()
export class ConnectionStateManager {
  private connectionStates: Map<string, ConnectionState> = new Map();

  /**
   * 更新连接的空间状态
   */
  updateConnectionSpace(connectionId: string, space: string | undefined): void {
    const existing = this.connectionStates.get(connectionId);
    if (existing) {
      existing.currentSpace = space;
      existing.lastUsed = Date.now();
      this.connectionStates.set(connectionId, existing);
    } else {
      const newConnectionState: ConnectionState = {
        connectionId,
        currentSpace: space,
        lastUsed: Date.now(),
        isHealthy: true
      };
      this.connectionStates.set(connectionId, newConnectionState);
    }
  }

  /**
   * 获取指定空间的连接ID列表
   */
  getConnectionsForSpace(space: string): string[] {
    return Array.from(this.connectionStates.entries())
      .filter(([_, state]) => state.currentSpace === space)
      .map(([id, _]) => id);
  }

  /**
   * 获取所有连接状态
   */
  getAllConnections(): ConnectionState[] {
    return Array.from(this.connectionStates.values());
  }

  /**
   * 获取连接的当前空间
   */
  getConnectionSpace(connectionId: string): string | undefined {
    const space = this.connectionStates.get(connectionId)?.currentSpace;
    
    // 确保空间名称有效，如果无效则返回undefined
    if (!space || space === 'undefined' || space === '') {
      return undefined;
    }
    
    return space;
  }

  /**
   * 清理长时间未使用的连接状态
   */
  cleanupStaleConnections(maxAgeMs: number = 30 * 60 * 1000): void { // 30分钟
    const now = Date.now();
    let removedCount = 0;
    for (const [id, state] of this.connectionStates.entries()) {
      if (now - state.lastUsed > maxAgeMs) {
        this.connectionStates.delete(id);
        removedCount++;
      }
    }
  }
  
  /**
   * 定期清理过期连接状态的定时器
   */
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  /**
   * 启动定期清理任务
   */
  startPeriodicCleanup(intervalMs: number = 15 * 60 * 1000): void { // 默认每15分钟清理一次
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // 在测试环境中不启动定时器，以避免Jest无法退出
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections();
    }, intervalMs);
  }
  
  /**
   * 停止定期清理任务
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * 获取连接状态的数量
   */
  getConnectionsCount(): number {
    return this.connectionStates.size;
  }
  
  /**
   * 移除特定连接的状态
   */
  removeConnection(connectionId: string): boolean {
    return this.connectionStates.delete(connectionId);
  }
  
  /**
   * 检查连接是否存在
   */
  hasConnection(connectionId: string): boolean {
    return this.connectionStates.has(connectionId);
  }
}