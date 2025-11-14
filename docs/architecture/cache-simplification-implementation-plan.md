# 缓存层级简化实施方案

## 📋 方案概述

基于[缓存简化分析报告](./cache-simplification-analysis.md)，本文档提供详细的实施步骤。

**目标**: 移除3个冗余缓存服务，保留3个核心缓存，减少30%代码，降低20-30%内存占用。

---

## 📊 影响范围分析

### GraphCacheService使用点统计
通过代码搜索，发现以下使用点：

1. **核心服务** (2处)
   - `src/service/graph/core/GraphService.ts` - 主要图服务
   - `src/service/graph/mapping/GraphDataMappingService.ts` - 图数据映射服务

2. **API层** (2处)
   - `src/api/routes/GraphStatsRoutes.ts` - 图统计路由
   - `src/api/ApiServer.ts` - API服务器初始化

3. **依赖注入** (1处)
   - `src/core/registrars/InfrastructureServiceRegistrar.ts` - 服务注册

4. **测试文件** (5处)
   - 集成测试、单元测试等

**总计**: 约10个文件需要修改

---

## 🚀 实施阶段

### 阶段1: 增强CacheService（优先级：高，工期：1周）

#### 步骤1.1: 添加压缩工具类
```typescript
// src/utils/cache/CompressionUtils.ts
import * as zlib from 'zlib';

export class CompressionUtils {
  static compress(data: string): Buffer {
    return zlib.gzipSync(Buffer.from(data));
  }
  
  static decompress(data: Buffer): string {
    return zlib.gunzipSync(data).toString();
  }
}
```

#### 步骤1.2: 更新CacheService配置接口
```typescript
// src/infrastructure/caching/types.ts
export interface CacheConfig {
  defaultTTL: number;
  maxEntries: number;
  cleanupInterval: number;
  enableStats: boolean;
  enableCompression?: boolean;
  compressionThreshold?: number;
  maxMemory?: number;
  memoryThreshold?: number;
  databaseSpecific: {
    [key in DatabaseType]?: {
      defaultTTL: number;
      maxEntries: number;
    };
  };
}
```

#### 步骤1.3: 增强CacheService实现
在 `src/infrastructure/caching/CacheService.ts` 中添加：
- 压缩/解压缩逻辑
- 内存监控
- 图数据便捷方法

---

### 阶段2: 移除GraphCacheService（优先级：高，工期：1周）

#### 步骤2.1: 更新核心服务注入

**文件1**: `src/service/graph/core/GraphService.ts`
```typescript
// 修改前
@inject(TYPES.GraphCacheService) private cacheService: ICacheService

// 修改后
@inject(TYPES.CacheService) private cacheService: ICacheService
```

**文件2**: `src/service/graph/mapping/GraphDataMappingService.ts`
```typescript
// 修改前
@inject(TYPES.GraphCacheService) unifiedCache: any

// 修改后
@inject(TYPES.CacheService) unifiedCache: ICacheService
```

#### 步骤2.2: 更新API层

**文件3**: `src/api/routes/GraphStatsRoutes.ts`
```typescript
// 修改导入
import { ICacheService } from '../../infrastructure/caching/types';

// 修改构造函数
constructor(
  @inject(TYPES.LoggerService) logger: LoggerService,
  @inject(TYPES.GraphService) graphService: IGraphService,
  @inject(TYPES.CacheService) graphCacheService: ICacheService, // 改类型
  @inject(TYPES.GraphPerformanceMonitor) performanceMonitor: GraphPerformanceMonitor,
  @inject(TYPES.ConfigService) configService: ConfigService
)

// 修改属性声明
protected graphCacheService: ICacheService;
```

**文件4**: `src/api/ApiServer.ts`
```typescript
// 修改前
const graphCacheService = diContainer.get<any>(TYPES.GraphCacheService);

// 修改后
const graphCacheService = diContainer.get<ICacheService>(TYPES.CacheService);
```

#### 步骤2.3: 更新依赖注入配置

**文件5**: `src/types.ts`
```typescript
export const TYPES = {
  // ... 其他类型
  CacheService: Symbol.for('CacheService'),
  // 删除: GraphCacheService: Symbol.for('GraphCacheService'),
  // ... 其他类型
};
```

**文件6**: `src/core/registrars/InfrastructureServiceRegistrar.ts`
```typescript
// 删除导入
// import { GraphCacheService } from '../../service/caching/GraphCacheService';

// 删除注册
// container.bind<GraphCacheService>(TYPES.GraphCacheService).to(GraphCacheService).inSingletonScope();
```

#### 步骤2.4: 更新测试文件

**文件7-11**: 测试文件更新
- `src/__tests__/integration/service-integration.test.ts`
- `src/__tests__/fault-tolerance-integration.test.ts`
- `src/api/__tests__/ApiServer.test.ts`
- `src/api/routes/__tests__/GraphStatsRoutes.test.ts`
- `src/service/graph/caching/__tests__/GraphCacheService.test.ts` (删除)

将所有 `TYPES.GraphCacheService` 替换为 `TYPES.CacheService`

#### 步骤2.5: 删除文件
```bash
rm src/service/caching/GraphCacheService.ts
rm src/service/graph/caching/__tests__/GraphCacheService.test.ts
```

#### 步骤2.6: 测试验证
```bash
npm test src/infrastructure/caching/__tests__/CacheService.test.ts
npm test src/service/graph/
npm test src/api/routes/__tests__/GraphStatsRoutes.test.ts
```

---

### 阶段3: 移除MappingCacheManager（优先级：中，工期：0.5周）

#### 步骤3.1: 确认未使用
```bash
grep -r "MappingCacheManager" src/ --include="*.ts" | grep -v "test" | grep -v ".md"
```

如果确认未被使用，直接删除：
```bash
rm src/service/graph/caching/MappingCacheManager.ts
```

---

### 阶段4: 内联SimilarityCacheManager（优先级：低，工期：0.5周）

#### 步骤4.1: 在SimilarityService中实现缓存逻辑
```typescript
// src/service/similarity/SimilarityService.ts
export class SimilarityService {
  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    @inject(TYPES.CacheService) private cacheService?: ICacheService, // 直接注入CacheService
    // 移除: @inject(TYPES.SimilarityCacheManager) private cacheManager?: ISimilarityCacheManager,
  ) {}
  
  private getSimilarityCacheKey(content1: string, content2: string, strategy: string): string {
    const hash1 = HashUtils.simpleHash(content1);
    const hash2 = HashUtils.simpleHash(content2);
    return `similarity:${strategy}:${hash1}:${hash2}`;
  }
  
  async calculateSimilarity(content1: string, content2: string, options?: SimilarityOptions): Promise<SimilarityResult> {
    // 检查缓存
    if (this.cacheService) {
      const cacheKey = this.getSimilarityCacheKey(content1, content2, options?.strategy || 'hybrid');
      const cached = this.cacheService.getFromCache<number>(cacheKey);
      if (cached !== undefined) {
        return { score: cached, strategy: options?.strategy || 'hybrid' };
      }
    }
    
    // 计算相似度...
    const result = await this.computeSimilarity(content1, content2, options);
    
    // 缓存结果
    if (this.cacheService) {
      const cacheKey = this.getSimilarityCacheKey(content1, content2, options?.strategy || 'hybrid');
      this.cacheService.setCache(cacheKey, result.score, 300000); // 5分钟TTL
    }
    
    return result;
  }
}
```

#### 步骤4.2: 删除文件
```bash
rm src/service/similarity/cache/SimilarityCacheManager.ts
rm src/service/similarity/cache/__tests__/SimilarityCacheManager.test.ts
```

#### 步骤4.3: 更新types.ts
```typescript
// 删除
// SimilarityCacheManager: Symbol.for('SimilarityCacheManager'),
```

---

## ✅ 实施检查清单

### 阶段1: CacheService增强
- [ ] 创建CompressionUtils工具类
- [ ] 更新CacheConfig接口
- [ ] 实现压缩/解压缩逻辑
- [ ] 实现内存监控
- [ ] 添加图数据便捷方法
- [ ] 运行测试验证

### 阶段2: GraphCacheService移除
- [ ] 更新GraphService注入
- [ ] 更新GraphDataMappingService注入
- [ ] 更新GraphStatsRoutes
- [ ] 更新ApiServer
- [ ] 更新types.ts
- [ ] 更新InfrastructureServiceRegistrar
- [ ] 更新所有测试文件
- [ ] 删除GraphCacheService.ts
- [ ] 运行完整测试套件

### 阶段3: MappingCacheManager移除
- [ ] 确认未被使用
- [ ] 删除文件
- [ ] 运行测试验证

### 阶段4: SimilarityCacheManager内联
- [ ] 在SimilarityService中实现缓存逻辑
- [ ] 删除SimilarityCacheManager
- [ ] 更新types.ts
- [ ] 运行测试验证

---

## ⚠️ 风险控制

### 回滚计划
每个阶段完成后：
1. 提交Git: `git commit -m "Phase X: [description]"`
2. 如果测试失败: `git revert HEAD`

### 测试策略
- 单元测试：每个修改的文件
- 集成测试：完整的服务交互
- 性能测试：缓存命中率、内存使用

---

## 📈 预期收益

- **代码减少**: ~600行 (GraphCacheService 521行 + MappingCacheManager 470行 - 新增功能 ~400行)
- **内存优化**: 20-30% (移除重复缓存实例)
- **维护性**: 缓存层级从6个减少到3个
- **性能**: 统一缓存策略，提高命中率

---

## 🎯 总结

本方案采用渐进式重构策略，分4个阶段实施：
1. 先增强基础设施层的CacheService
2. 再移除冗余的GraphCacheService
3. 清理未使用的MappingCacheManager
4. 最后内联简单的SimilarityCacheManager

每个阶段独立可测试，风险可控。