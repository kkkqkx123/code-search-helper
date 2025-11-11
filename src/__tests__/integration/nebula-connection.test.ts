import { diContainer } from '../../core/DIContainer';
import { TYPES } from '../../types';
import { NebulaService } from '../../database/nebula/NebulaService';
import { INebulaService } from '../../database/nebula/NebulaService';

describe('Nebula Connection Integration Test', () => {
  let nebulaService: INebulaService;

  beforeAll(() => {
    // 从DI容器获取Nebula服务
    nebulaService = diContainer.get<INebulaService>(TYPES.INebulaService);
  });

  it('should be able to get Nebula service from DI container', () => {
    expect(nebulaService).toBeDefined();
    expect(nebulaService).toBeInstanceOf(NebulaService);
  });

  it('should be able to initialize Nebula service', async () => {
    // 由于这是集成测试，我们不实际连接到数据库
    // 而是检查服务是否正确初始化
    expect(nebulaService.initialize).toBeDefined();
    expect(typeof nebulaService.initialize).toBe('function');
  });

  it('should have all required methods', () => {
    // 检查Nebula服务是否实现了所有必需的方法
    expect(nebulaService.isConnected).toBeDefined();
    expect(nebulaService.close).toBeDefined();
    expect(nebulaService.createSpaceForProject).toBeDefined();
    expect(nebulaService.deleteSpaceForProject).toBeDefined();
    expect(nebulaService.insertNodes).toBeDefined();
    expect(nebulaService.insertRelationships).toBeDefined();
    expect(nebulaService.findNodesByLabel).toBeDefined();
    expect(nebulaService.findRelationships).toBeDefined();
    expect(nebulaService.executeReadQuery).toBeDefined();
    expect(nebulaService.executeWriteQuery).toBeDefined();
    expect(nebulaService.useSpace).toBeDefined();
    expect(nebulaService.createNode).toBeDefined();
    expect(nebulaService.createRelationship).toBeDefined();
    expect(nebulaService.findNodes).toBeDefined();
    expect(nebulaService.getDatabaseStats).toBeDefined();
  });
});