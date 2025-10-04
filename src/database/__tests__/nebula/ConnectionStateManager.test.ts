import { ConnectionStateManager } from '../../nebula/ConnectionStateManager';

describe('ConnectionStateManager', () => {
  let connectionStateManager: ConnectionStateManager;

  beforeEach(() => {
    connectionStateManager = new ConnectionStateManager();
  });

  describe('updateConnectionSpace', () => {
    it('should update the space for a connection', () => {
      const connectionId = 'test-connection-1';
      const space = 'test_space';

      connectionStateManager.updateConnectionSpace(connectionId, space);

      const state = connectionStateManager.getConnectionSpace(connectionId);
      expect(state).toBe(space);
    });

    it('should create a new entry if connection does not exist', () => {
      const connectionId = 'new-connection';
      const space = 'new_space';

      connectionStateManager.updateConnectionSpace(connectionId, space);

      const state = connectionStateManager.getConnectionSpace(connectionId);
      expect(state).toBe(space);
    });

    it('should update lastUsed timestamp', () => {
      const connectionId = 'timestamp-test';
      const space = 'timestamp_space';

      const beforeUpdate = Date.now();
      connectionStateManager.updateConnectionSpace(connectionId, space);
      const afterUpdate = Date.now();

      // Get all connection states and verify the timestamp was updated
      const allConnections = connectionStateManager.getAllConnections();
      const connectionState = allConnections.find(c => c.connectionId === connectionId);
      
      expect(connectionState).toBeDefined();
      expect(connectionState!.lastUsed).toBeGreaterThanOrEqual(beforeUpdate);
      expect(connectionState!.lastUsed).toBeLessThanOrEqual(afterUpdate);
    });
  });

  describe('getConnectionsForSpace', () => {
    it('should return connections for the specified space', () => {
      const space1 = 'space_1';
      const space2 = 'space_2';
      const conn1 = 'conn-1';
      const conn2 = 'conn-2';
      const conn3 = 'conn-3';

      connectionStateManager.updateConnectionSpace(conn1, space1);
      connectionStateManager.updateConnectionSpace(conn2, space1);
      connectionStateManager.updateConnectionSpace(conn3, space2);

      const connectionsForSpace1 = connectionStateManager.getConnectionsForSpace(space1);
      expect(connectionsForSpace1).toContain(conn1);
      expect(connectionsForSpace1).toContain(conn2);
      expect(connectionsForSpace1).not.toContain(conn3);

      const connectionsForSpace2 = connectionStateManager.getConnectionsForSpace(space2);
      expect(connectionsForSpace2).toContain(conn3);
      expect(connectionsForSpace2).not.toContain(conn1);
      expect(connectionsForSpace2).not.toContain(conn2);
    });

    it('should return empty array for non-existent space', () => {
      const connections = connectionStateManager.getConnectionsForSpace('non-existent');
      expect(connections).toEqual([]);
    });
  });

  describe('getConnectionSpace', () => {
    it('should return the space for an existing connection', () => {
      const connectionId = 'test-connection';
      const space = 'test_space';

      connectionStateManager.updateConnectionSpace(connectionId, space);

      const result = connectionStateManager.getConnectionSpace(connectionId);
      expect(result).toBe(space);
    });

    it('should return undefined for non-existent connection', () => {
      const result = connectionStateManager.getConnectionSpace('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('getAllConnections', () => {
    it('should return all connection states', () => {
      const conn1 = 'conn-1';
      const conn2 = 'conn-2';
      const space1 = 'space_1';
      const space2 = 'space_2';

      connectionStateManager.updateConnectionSpace(conn1, space1);
      connectionStateManager.updateConnectionSpace(conn2, space2);

      const allConnections = connectionStateManager.getAllConnections();

      expect(allConnections).toHaveLength(2);
      expect(allConnections).toContainEqual(
        expect.objectContaining({
          connectionId: conn1,
          currentSpace: space1,
          isHealthy: true
        })
      );
      expect(allConnections).toContainEqual(
        expect.objectContaining({
          connectionId: conn2,
          currentSpace: space2,
          isHealthy: true
        })
      );
    });
  });

  describe('cleanupStaleConnections', () => {
    it('should remove connections that are older than maxAge', () => {
      const conn1 = 'recent-conn';
      const conn2 = 'stale-conn';
      const space = 'test_space';

      // Add a recent connection
      connectionStateManager.updateConnectionSpace(conn1, space);

      // Manually set a connection to be old
      const staleState = {
        connectionId: conn2,
        currentSpace: space,
        lastUsed: Date.now() - 40 * 60 * 1000, // 40 minutes ago (older than default 30 min)
        isHealthy: true
      };
      connectionStateManager['connectionStates'].set(conn2, staleState as any);

      // Clean up stale connections (default is 30 minutes)
      connectionStateManager.cleanupStaleConnections();

      const allConnections = connectionStateManager.getAllConnections();
      expect(allConnections).toHaveLength(1);
      expect(allConnections[0].connectionId).toBe(conn1);
    });

    it('should keep connections that are newer than maxAge', () => {
      const conn = 'recent-conn';
      const space = 'test_space';

      connectionStateManager.updateConnectionSpace(conn, space);

      // Clean up with a very long maxAge to ensure we keep the connection
      connectionStateManager.cleanupStaleConnections(10000); // 10 seconds

      const allConnections = connectionStateManager.getAllConnections();
      expect(allConnections).toHaveLength(1);
    });
  });
});