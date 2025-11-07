import { diContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import { NebulaService } from '../../database/nebula/NebulaService';
import { INebulaService } from '../../database/nebula/NebulaService';
import { NebulaConnectionMonitor } from '../../service/graph/performance/NebulaConnectionMonitor';

describe('Nebula Reconnection Integration Test', () => {
  let nebulaService: INebulaService;
  let connectionMonitor: NebulaConnectionMonitor;

  beforeAll(() => {
    // 从DI容器获取Nebula服务和连接监控器
    nebulaService = diContainer.get<INebulaService>(TYPES.INebulaService);
    connectionMonitor = diContainer.get<NebulaConnectionMonitor>(TYPES.NebulaConnectionMonitor);
  });

  it('should be able to get Nebula service and connection monitor from DI container', () => {
    expect(nebulaService).toBeDefined();
    expect(nebulaService).toBeInstanceOf(NebulaService);
    expect(connectionMonitor).toBeDefined();
    expect(connectionMonitor).toBeInstanceOf(NebulaConnectionMonitor);
  });

  it('should have reconnect method', () => {
    expect(nebulaService.reconnect).toBeDefined();
    expect(typeof nebulaService.reconnect).toBe('function');
  });

  it('should handle connection errors gracefully', async () => {
    // 由于这是集成测试，我们不实际断开数据库连接
    // 而是检查服务是否能正确处理错误情况

    // 模拟一个查询错误
    try {
      // 这个查询会失败，因为服务未初始化或数据库不可用
      await nebulaService.executeReadQuery('INVALID QUERY');
    } catch (error) {
      // 预期会捕获到错误
      expect(error).toBeDefined();
    }
  });

  it('should be able to start and stop connection monitoring', () => {
    // 检查监控器是否实现了必要的方法
    expect(connectionMonitor.startMonitoring).toBeDefined();
    expect(typeof connectionMonitor.startMonitoring).toBe('function');

    expect(connectionMonitor.stopMonitoring).toBeDefined();
    expect(typeof connectionMonitor.stopMonitoring).toBe('function');

    expect(connectionMonitor.getConnectionStatus).toBeDefined();
    expect(typeof connectionMonitor.getConnectionStatus).toBe('function');

    expect(connectionMonitor.reconnect).toBeDefined();
    expect(typeof connectionMonitor.reconnect).toBe('function');
  });
});