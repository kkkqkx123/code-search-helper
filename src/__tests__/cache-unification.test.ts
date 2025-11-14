import { Container } from 'inversify';
import { TYPES } from '../types';
import { GraphRepository } from '../service/graph/repository/GraphRepository';
import { ICacheService } from '../infrastructure/caching/types';
import { CacheService } from '../infrastructure/caching/CacheService';
import { LoggerService } from '../utils/LoggerService';

describe('Cache Unification', () => {
  let container: Container;
  let graphRepository: GraphRepository;
  let cacheService: ICacheService;

  beforeEach(() => {
    container = new Container();
    
    // Mock dependencies
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    const mockErrorHandler = {
      handleError: jest.fn()
    } as any;

    const mockDataOps = {} as any;
    const mockGraphOps = {
      insertVertex: jest.fn().mockResolvedValue(undefined),
      updateVertex: jest.fn().mockResolvedValue(true),
      deleteVertex: jest.fn().mockResolvedValue(true)
    } as any;

    const mockQueryService = {
      executeQuery: jest.fn().mockResolvedValue({ data: [{ id: 'test-node', label: 'Test', properties: {} }] })
    } as any;

    // Bind services
    container.bind(TYPES.LoggerService).toConstantValue(mockLogger);
    container.bind(TYPES.ErrorHandlerService).toConstantValue(mockErrorHandler);
    container.bind(TYPES.INebulaDataOperations).toConstantValue(mockDataOps);
    container.bind(TYPES.INebulaGraphOperations).toConstantValue(mockGraphOps);
    container.bind(TYPES.INebulaQueryService).toConstantValue(mockQueryService);
    
    cacheService = new CacheService(mockLogger);
    container.bind<ICacheService>(TYPES.CacheService).toConstantValue(cacheService);
    container.bind<GraphRepository>(TYPES.GraphRepository).to(GraphRepository);
    
    graphRepository = container.get<GraphRepository>(TYPES.GraphRepository);
  });

  afterEach(() => {
    cacheService.clearAllCache();
  });

  describe('Repository层缓存集成', () => {
    it('应该通过ICacheService缓存节点数据', async () => {
      const nodeId = 'test-node-1';
      
      // 第一次调用 - 缓存未命中
      const node1 = await graphRepository.getNodeById(nodeId);
      expect(node1).toBeDefined();
      
      // 第二次调用 - 应该命中缓存
      const node2 = await graphRepository.getNodeById(nodeId);
      expect(node2).toEqual(node1);
      
      // 验证缓存统计
      const stats = cacheService.getCacheStats();
      expect(stats.hitCount).toBeGreaterThan(0);
    });

    it('写操作应该失效相关缓存', async () => {
      const nodeId = 'test-node-2';
      
      // 先缓存节点
      await graphRepository.getNodeById(nodeId);
      
      // 更新节点
      await graphRepository.updateNode(nodeId, { updated: true });
      
      // 验证缓存已失效
      const cacheKey = `graph:node:${nodeId}`;
      const cached = cacheService.getFromCache(cacheKey);
      expect(cached).toBeUndefined();
    });

    it('删除操作应该失效相关缓存', async () => {
      const nodeId = 'test-node-3';
      
      // 先缓存节点
      await graphRepository.getNodeById(nodeId);
      
      // 删除节点
      await graphRepository.deleteNode(nodeId);
      
      // 验证缓存已失效
      const cacheKey = `graph:node:${nodeId}`;
      const cached = cacheService.getFromCache(cacheKey);
      expect(cached).toBeUndefined();
    });
  });

  describe('缓存失效策略', () => {
    it('创建关系应该失效相关节点缓存', async () => {
      const sourceId = 'source-node';
      const targetId = 'target-node';
      
      // 先缓存节点
      await graphRepository.getNodeById(sourceId);
      await graphRepository.getNodeById(targetId);
      
      // 创建关系
      await graphRepository.createRelationship({
        type: 'RELATES_TO',
        sourceId,
        targetId
      });
      
      // 验证相关缓存已失效
      const stats = cacheService.getCacheStats();
      expect(stats.totalEntries).toBeLessThan(2);
    });
  });
});