import { ConnectionStateManager } from '../../nebula/ConnectionStateManager';

describe('ConnectionStateManager', () => {
  let connectionStateManager: ConnectionStateManager;

  beforeEach(() => {
    connectionStateManager = new ConnectionStateManager();
  });

  afterEach(() => {
    // 确保清理定时器
    connectionStateManager.stopPeriodicCleanup();
  });

  describe('updateConnectionSpace', () => {
    it('should create a new connection state if it does not exist', () => {
      connectionStateManager.updateConnectionSpace('conn1', 'space1');

      const state = connectionStateManager.getConnectionSpace('conn1');
      expect(state).toBe('space1');
    });

    it('should update an existing connection state', () => {
      connectionStateManager.updateConnectionSpace('conn1', 'space1');
      connectionStateManager.updateConnectionSpace('conn1', 'space2');

      const state = connectionStateManager.getConnectionSpace('conn1');
      expect(state).toBe('space2');
    });

    it('should update last used timestamp when updating space', () => {
      const initialTime = Date.now();
      connectionStateManager.updateConnectionSpace('conn1', 'space1');
      
      const allConnections = connectionStateManager.getAllConnections();
      expect(allConnections).toHaveLength(1);
      expect(allConnections[0].lastUsed).toBeGreaterThanOrEqual(initialTime);
    });
  });

  describe('getConnectionsForSpace', () => {
    it('should return connection IDs for a specific space', () => {
      connectionStateManager.updateConnectionSpace('conn1', 'space1');
      connectionStateManager.updateConnectionSpace('conn2', 'space2');
      connectionStateManager.updateConnectionSpace('conn3', 'space1');

      const connectionsInSpace1 = connectionStateManager.getConnectionsForSpace('space1');
      expect(connectionsInSpace1).toContain('conn1');
      expect(connectionsInSpace1).toContain('conn3');
      expect(connectionsInSpace1).not.toContain('conn2');
    });

    it('should return empty array for non-existent space', () => {
      const connections = connectionStateManager.getConnectionsForSpace('nonexistent');
      expect(connections).toEqual([]);
    });
  });

  describe('getAllConnections', () => {
    it('should return all connection states', () => {
      connectionStateManager.updateConnectionSpace('conn1', 'space1');
      connectionStateManager.updateConnectionSpace('conn2', 'space2');

      const allConnections = connectionStateManager.getAllConnections();
      expect(allConnections).toHaveLength(2);
      expect(allConnections.map(conn => conn.connectionId)).toContain('conn1');
      expect(allConnections.map(conn => conn.connectionId)).toContain('conn2');
    });
  });

  describe('getConnectionSpace', () => {
    it('should return the space for an existing connection', () => {
      connectionStateManager.updateConnectionSpace('conn1', 'space1');
      
      const space = connectionStateManager.getConnectionSpace('conn1');
      expect(space).toBe('space1');
    });

    it('should return undefined for non-existent connection', () => {
      const space = connectionStateManager.getConnectionSpace('nonexistent');
      expect(space).toBeUndefined();
    });
  });

  describe('cleanupStaleConnections', () => {
    it('should remove connections that are older than the max age', () => {
      // 设置一个连接
      connectionStateManager.updateConnectionSpace('conn1', 'space1');
      
      // 手动修改连接状态的时间戳，使其变成"陈旧的"
      const connectionStates = (connectionStateManager as any).connectionStates;
      const state = connectionStates.get('conn1');
      if (state) {
        state.lastUsed = Date.now() - 40 * 60 * 1000; // 40分钟前
        connectionStates.set('conn1', state);
      }
      
      // 现在清理超过30分钟的连接
      connectionStateManager.cleanupStaleConnections(30 * 60 * 1000);

      const exists = connectionStateManager.hasConnection('conn1');
      expect(exists).toBe(false);
    });

    it('should not remove connections that are within the max age', () => {
      // 设置一个连接
      connectionStateManager.updateConnectionSpace('conn1', 'space1');
      
      // 清理超过40分钟的连接（但当前连接是现在创建的）
      connectionStateManager.cleanupStaleConnections(40 * 60 * 1000);

      const exists = connectionStateManager.hasConnection('conn1');
      expect(exists).toBe(true);
    });

    it('should return correct connection count', () => {
      connectionStateManager.updateConnectionSpace('conn1', 'space1');
      connectionStateManager.updateConnectionSpace('conn2', 'space2');
      
      expect(connectionStateManager.getConnectionsCount()).toBe(2);
      
      connectionStateManager.removeConnection('conn1');
      expect(connectionStateManager.getConnectionsCount()).toBe(1);
    });
  });

  describe('connection management methods', () => {
    it('should remove a specific connection', () => {
      connectionStateManager.updateConnectionSpace('conn1', 'space1');
      
      const removed = connectionStateManager.removeConnection('conn1');
      expect(removed).toBe(true);
      
      const exists = connectionStateManager.hasConnection('conn1');
      expect(exists).toBe(false);
    });

    it('should return false when trying to remove non-existent connection', () => {
      const removed = connectionStateManager.removeConnection('nonexistent');
      expect(removed).toBe(false);
    });

    it('should correctly check if connection exists', () => {
      connectionStateManager.updateConnectionSpace('conn1', 'space1');
      
      expect(connectionStateManager.hasConnection('conn1')).toBe(true);
      expect(connectionStateManager.hasConnection('nonexistent')).toBe(false);
    });
  });

  describe('periodic cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers({ legacyFakeTimers: true });
    });

    afterEach(() => {
      connectionStateManager.stopPeriodicCleanup();
      jest.useRealTimers();
    });

    it('should start periodic cleanup task', () => {
      connectionStateManager.startPeriodicCleanup(1000); // 每秒清理一次
      
      // 添加一个连接
      connectionStateManager.updateConnectionSpace('conn1', 'space1');
      expect(connectionStateManager.getConnectionsCount()).toBe(1);
      
      // 快进时间，触发定时清理
      jest.advanceTimersByTime(1000);
      
      // 连接依然存在，因为时间未超过清理阈值
      expect(connectionStateManager.getConnectionsCount()).toBe(1);
    });

    it('should stop periodic cleanup task', () => {
      connectionStateManager.startPeriodicCleanup(1000);
      connectionStateManager.updateConnectionSpace('conn1', 'space1');
      
      expect(connectionStateManager.getConnectionsCount()).toBe(1);
      
      connectionStateManager.stopPeriodicCleanup();
      
      // 再次添加连接
      connectionStateManager.updateConnectionSpace('conn2', 'space2');
      expect(connectionStateManager.getConnectionsCount()).toBe(2);
    });
  });
});