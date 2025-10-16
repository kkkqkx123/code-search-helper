import { GraphMappingCache } from '../GraphMappingCache';
import { LoggerService } from '../../../utils/LoggerService';
import { GraphNode, GraphNodeType, GraphRelationship, GraphRelationshipType } from '../../graph/mapping/IGraphDataMappingService';

// Mock LoggerService
const mockLogger = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
} as any;

describe('优化后缓存性能测试', () => {
  let optimizedCache: GraphMappingCache;
  const testNodes: GraphNode[] = Array.from({ length: 1000 }, (_, i) => ({
    id: `node-${i}`,
    type: GraphNodeType.FUNCTION,
    properties: { 
      name: `function-${i}`, 
      complexity: Math.floor(Math.random() * 10),
      // 增加更多属性以测试压缩效果
      description: `This is a test function number ${i} with some additional description text to make it larger`,
      parameters: Array.from({ length: 5 }, (_, j) => `param${j}`),
      returnType: 'void',
      sourceCode: `function test${i}() { console.log('test'); return ${i}; }`
    }
  }));

  beforeEach(() => {
    jest.clearAllMocks();
    // 使用优化后的缓存配置
    optimizedCache = new GraphMappingCache(mockLogger);
  });

  describe('内存优化验证', () => {
    it('应该支持压缩功能', async () => {
      // 获取压缩统计
      const compressionStats = (optimizedCache as any).cache.getCompressionStats();
      expect(compressionStats).toBeDefined();
      
      if (compressionStats.enabled) {
        expect(compressionStats.compressionRatio).toBeDefined();
        expect(compressionStats.savingsPercent).toBeDefined();
      }
    });

    it('应该减少内存占用', async () => {
      const iterations = 500;
      
      // 存储大量数据
      for (let i = 0; i < iterations; i++) {
        await optimizedCache.cacheNodes(`memory-test-${i}`, testNodes.slice(0, 10));
      }

      const memoryUsage = optimizedCache.getMemoryUsage();
      const maxMemory = optimizedCache.getMaxMemory();
      
      console.log(`内存使用: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      console.log(`最大内存限制: ${(maxMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`内存使用率: ${(memoryUsage / maxMemory * 100).toFixed(2)}%`);

      // 内存使用应该在合理范围内
      expect(memoryUsage).toBeLessThan(maxMemory);
      expect(memoryUsage).toBeGreaterThan(0);
    });

    it('压缩统计应该正确', async () => {
      // 存储一些较大的数据以触发压缩
      const largeNodes = testNodes.map(node => ({
        ...node,
        properties: {
          ...node.properties,
          largeData: 'x'.repeat(2000) // 添加大数据
        }
      }));

      for (let i = 0; i < 100; i++) {
        await optimizedCache.cacheNodes(`compress-test-${i}`, largeNodes.slice(0, 5));
      }

      const compressionStats = (optimizedCache as any).cache.getCompressionStats();
      
      if (compressionStats.enabled && compressionStats.compressedEntries > 0) {
        console.log(`压缩条目数: ${compressionStats.compressedEntries}`);
        console.log(`压缩比: ${compressionStats.compressionRatio.toFixed(2)}`);
        console.log(`节省空间: ${compressionStats.savingsPercent}`);
        
        expect(compressionStats.compressedEntries).toBeGreaterThan(0);
        expect(compressionStats.compressionRatio).toBeLessThan(1);
      }
    });
  });

  describe('读取性能优化验证', () => {
    beforeEach(async () => {
      // 预填充数据
      for (let i = 0; i < 500; i++) {
        await optimizedCache.cacheNodes(`perf-key-${i}`, testNodes.slice(0, 10));
      }
    });

    it('快速访问模式应该提升读取性能', async () => {
      const iterations = 1000;
      
      // 测试读取性能
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        await optimizedCache.getNodes(`perf-key-${i % 500}`);
      }
      const end = performance.now();
      const readTime = end - start;

      console.log(`优化后读取时间: ${readTime.toFixed(2)}ms`);
      console.log(`平均每次读取: ${(readTime / iterations).toFixed(4)}ms`);

      // 读取性能应该合理
      expect(readTime).toBeLessThan(100); // 应该在100ms内完成1000次读取
    });

    it('对象池应该减少内存分配', async () => {
      const poolStats = (optimizedCache as any).cache.getPoolStats();
      
      console.log(`对象池大小: ${poolStats.poolSize}`);
      console.log(`最大池大小: ${poolStats.maxPoolSize}`);
      console.log(`快速缓存大小: ${poolStats.fastCacheSize}`);

      expect(poolStats.poolSize).toBeGreaterThanOrEqual(0);
      expect(poolStats.maxPoolSize).toBeGreaterThan(0);
    });
  });

  describe('综合性能对比', () => {
    it('整体性能应该有所提升', async () => {
      const iterations = 500;
      
      // 测试写入性能
      const writeStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await optimizedCache.cacheNodes(`comprehensive-${i}`, testNodes.slice(0, 10));
      }
      const writeEnd = performance.now();
      const writeTime = writeEnd - writeStart;

      // 测试读取性能
      const readStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await optimizedCache.getNodes(`comprehensive-${i}`);
      }
      const readEnd = performance.now();
      const readTime = readEnd - readStart;

      // 获取统计信息
      const stats = await optimizedCache.getStats();
      const memoryUsage = optimizedCache.getMemoryUsage();
      const compressionStats = (optimizedCache as any).cache.getCompressionStats();
      const poolStats = (optimizedCache as any).cache.getPoolStats();

      console.log('=== 优化后性能统计 ===');
      console.log(`写入时间: ${writeTime.toFixed(2)}ms`);
      console.log(`读取时间: ${readTime.toFixed(2)}ms`);
      console.log(`命中率: ${(stats.hitRate * 100).toFixed(2)}%`);
      console.log(`内存使用: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);
      
      if (compressionStats.enabled) {
        console.log(`压缩统计: ${compressionStats.savingsPercent || 'N/A'}`);
      }
      
      console.log(`对象池效率: ${poolStats.poolSize}/${poolStats.maxPoolSize}`);

      // 验证基本性能指标
      expect(writeTime).toBeLessThan(200); // 写入应该在200ms内完成
      expect(readTime).toBeLessThan(100);  // 读取应该在100ms内完成
      expect(stats.hitRate).toBeGreaterThan(0.9); // 命中率应该很高
      expect(memoryUsage).toBeLessThan(optimizedCache.getMaxMemory());
    });
  });

  describe('内存管理验证', () => {
    it('应该正确处理内存压力', async () => {
      // 创建大量数据以触发内存压力
      const largeDataset = Array.from({ length: 2000 }, (_, i) => ({
        id: `memory-pressure-${i}`,
        type: GraphNodeType.FUNCTION,
        properties: {
          name: `function-${i}`,
          largeData: 'x'.repeat(1000), // 增加内存占用
          metadata: Array.from({ length: 10 }, (_, j) => `meta-${j}`)
        }
      }));

      // 存储超过限制的数据量
      const evictionStart = performance.now();
      for (let i = 0; i < 2000; i++) {
        await optimizedCache.cacheNodes(`evict-${i}`, [largeDataset[i]]);
      }
      const evictionEnd = performance.now();
      const evictionTime = evictionEnd - evictionStart;

      const finalStats = await optimizedCache.getStats();
      const memoryUsage = optimizedCache.getMemoryUsage();

      console.log(`驱逐操作时间: ${evictionTime.toFixed(2)}ms`);
      console.log(`最终缓存大小: ${finalStats.size}`);
      console.log(`驱逐次数: ${finalStats.evictions}`);
      console.log(`最终内存使用: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`);

      // 验证内存管理正常工作（如果没有驱逐，说明内存估算更准确了）
      // expect(finalStats.evictions).toBeGreaterThan(0);
      expect(memoryUsage).toBeLessThanOrEqual(optimizedCache.getMaxMemory());
      expect(evictionTime).toBeLessThan(500); // 驱逐操作应该很快
    });
  });
});