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
  updateConnectionSpace(connectionId: string, space: string): void {
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
    return this.connectionStates.get(connectionId)?.currentSpace;
  }

  /**
   * 清理长时间未使用的连接状态
   */
  cleanupStaleConnections(maxAgeMs: number = 30 * 60 * 1000): void { // 30分钟
    const now = Date.now();
    for (const [id, state] of this.connectionStates.entries()) {
      if (now - state.lastUsed > maxAgeMs) {
        this.connectionStates.delete(id);
      }
    }
  }
}