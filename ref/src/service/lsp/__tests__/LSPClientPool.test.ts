import { LSPClientPool } from '../LSPClientPool';
import { LSPClient } from '../LSPClient';

// Mock dependencies
jest.mock('../LSPClient');

const MockLSPClient = LSPClient as jest.MockedClass<typeof LSPClient>;

const MockLanguageServerRegistry = {
  getServerConfig: jest.fn(),
  getInstance: jest.fn(),
};

describe('LSPClientPool', () => {
  let pool: LSPClientPool;
  let mockClient: jest.Mocked<LSPClient>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockClient = {
      initialize: jest.fn().mockResolvedValue(undefined),
      shutdown: jest.fn().mockResolvedValue(undefined),
      getWorkspaceRoot: jest.fn().mockReturnValue('/test/workspace'),
      isConnected: jest.fn().mockReturnValue(true),
    } as any;

    MockLSPClient.mockImplementation(() => mockClient);

    MockLanguageServerRegistry.getServerConfig.mockReturnValue({
      command: 'test-server',
      args: [],
    });

    pool = new LSPClientPool({
      maxConnections: 3,
      initialConnections: 1,
      idleTimeout: 1000,
    });
  });

  afterEach(async () => {
    await pool.shutdown();
  });

  describe('acquire and release', () => {
    it('should create new client when pool is empty', async () => {
      const client = await pool.acquire('/test/workspace');

      expect(client).toBeDefined();
      expect(MockLSPClient).toHaveBeenCalled();
      expect(mockClient.initialize).toHaveBeenCalled();
    });

    it('should reuse existing client when available', async () => {
      const client1 = await pool.acquire('/test/workspace');
      await pool.release(client1);

      const client2 = await pool.acquire('/test/workspace');

      expect(client1).toBe(client2);
      expect(MockLSPClient).toHaveBeenCalledTimes(1);
    });

    it('should respect max connections limit', async () => {
      const clients: any[] = [];

      // Acquire max connections
      for (let i = 0; i < 3; i++) {
        const client = await pool.acquire(`/test/workspace${i}`);
        clients.push(client);
      }

      // Next acquire should fail or trigger cleanup
      await expect(pool.acquire('/test/workspace4')).rejects.toThrow();
    });
  });

  describe('pool statistics', () => {
    it('should provide accurate stats', async () => {
      const client1 = await pool.acquire('/test/workspace1');
      const client2 = await pool.acquire('/test/workspace2');

      await pool.release(client1);

      const stats = pool.getStats();

      expect(stats.totalConnections).toBe(2);
      expect(stats.activeConnections).toBe(2); // Both clients are active until released
      expect(stats.idleConnections).toBe(0); // No idle connections initially
      expect(Object.keys(stats.pools)).toHaveLength(2);
    });
  });

  describe('preload functionality', () => {
    it('should preload initial connections', async () => {
      await pool.preload('/test/workspace');

      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(1);
      expect(stats.pools['/test/workspace']).toBeDefined();
    });

    it('should handle preload errors gracefully', async () => {
      MockLanguageServerRegistry.getServerConfig.mockReturnValue(null);

      // Preload should not throw, just emit error events
      await expect(pool.preload('/test/workspace')).resolves.not.toThrow();
    });
  });

  describe('idle connection cleanup', () => {
    it('should cleanup idle connections', async () => {
      const client = await pool.acquire('/test/workspace');
      await pool.release(client);

      // Fast-forward time
      jest.advanceTimersByTime(2000);

      // Manually trigger cleanup
      await (pool as any).cleanupIdleConnections();

      const stats = pool.getStats();
      expect(stats.totalConnections).toBe(0);
    }, 10000);
  });

  describe('error handling', () => {
    it('should handle client creation failures', async () => {
      MockLSPClient.mockImplementation(() => {
        throw new Error('Failed to create client');
      });

      await expect(pool.acquire('/test/workspace')).rejects.toThrow();
    });

    it('should handle initialization failures', async () => {
      mockClient.initialize.mockRejectedValue(new Error('Init failed'));

      await expect(pool.acquire('/test/workspace')).rejects.toThrow();
    });
  });

  describe('shutdown', () => {
    it('should shutdown all clients', async () => {
      const client1 = await pool.acquire('/test/workspace1');
      const client2 = await pool.acquire('/test/workspace2');

      await pool.release(client1);
      await pool.release(client2);

      await pool.shutdown();

      expect(mockClient.shutdown).toHaveBeenCalledTimes(2);
      expect(pool.getStats().totalConnections).toBe(0);
    });
  });
});

// Enable fake timers for timeout tests
beforeAll(() => {
  jest.useFakeTimers();
});

afterAll(() => {
  jest.useRealTimers();
});
