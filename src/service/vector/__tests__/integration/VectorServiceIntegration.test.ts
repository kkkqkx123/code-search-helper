import { Container } from 'inversify';
import { TYPES } from '../../../../types';
import { VectorService } from '../../core/VectorService';
import { VectorRepository } from '../../repository/VectorRepository';
import { VectorCacheManager } from '../../caching/VectorCacheManager';
import { VectorConversionService } from '../../conversion/VectorConversionService';
import { VectorEmbeddingService } from '../../embedding/VectorEmbeddingService';
import { ProcessingCoordinator } from '../../../parser/processing/coordinator/ProcessingCoordinator';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';

describe('VectorService Integration', () => {
  let container: Container;
  let vectorService: VectorService;

  beforeAll(() => {
    // 设置依赖注入容器
    container = new Container();

    // 注册基础服务
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();

    // 注册缓存服务（VectorCacheManager依赖）
    const { CacheService } = require('../../../../infrastructure/caching/CacheService');
    container.bind(CacheService).toSelf().inSingletonScope();
    container.bind(TYPES.CacheService).to(CacheService).inSingletonScope();

    // 注册其他必要的服务
    const { ProjectIdManager } = require('../../../../database/ProjectIdManager');
    container.bind(ProjectIdManager).toSelf().inSingletonScope();
    container.bind(TYPES.ProjectIdManager).to(ProjectIdManager);

    // 注册批处理服务
    const { BatchProcessingService } = require('../../../../infrastructure/batching/BatchProcessingService');
    const { BatchStrategyFactory } = require('../../../../infrastructure/batching/strategies/BatchStrategyFactory');
    const { SemanticBatchStrategy } = require('../../../../infrastructure/batching/strategies/SemanticBatchStrategy');
    
    // 注册批处理相关服务
    container.bind(BatchStrategyFactory).toSelf().inSingletonScope();
    container.bind(SemanticBatchStrategy).toSelf().inSingletonScope();
    
    // 注册其他批处理策略
    const { QdrantBatchStrategy } = require('../../../../infrastructure/batching/strategies/QdrantBatchStrategy');
    const { NebulaBatchStrategy } = require('../../../../infrastructure/batching/strategies/NebulaBatchStrategy');
    const { GraphBatchStrategy } = require('../../../../infrastructure/batching/strategies/GraphBatchStrategy');
    const { EmbeddingBatchStrategy } = require('../../../../infrastructure/batching/strategies/EmbeddingBatchStrategy');
    
    container.bind(QdrantBatchStrategy).toSelf().inSingletonScope();
    container.bind(NebulaBatchStrategy).toSelf().inSingletonScope();
    container.bind(GraphBatchStrategy).toSelf().inSingletonScope();
    container.bind(EmbeddingBatchStrategy).toSelf().inSingletonScope();
    
    // 注册内存监控服务
    const { MemoryMonitorService } = require('../../../../service/memory/MemoryMonitorService');
    container.bind(MemoryMonitorService).toSelf().inSingletonScope();
    container.bind(TYPES.MemoryMonitorService).to(MemoryMonitorService);
    
    // 注册嵌入器缓存服务
    const { EmbeddingCacheService } = require('../../../../embedders/EmbeddingCacheService');
    container.bind(EmbeddingCacheService).toSelf().inSingletonScope();
    container.bind(TYPES.EmbeddingCacheService).to(EmbeddingCacheService);
    
    container.bind(BatchProcessingService).toSelf().inSingletonScope();
    container.bind(TYPES.BatchProcessingService).to(BatchProcessingService);

    // 注册嵌入器工厂
    const { EmbedderFactory } = require('../../../../embedders/EmbedderFactory');
    container.bind(EmbedderFactory).toSelf().inSingletonScope();
    container.bind(TYPES.EmbedderFactory).to(EmbedderFactory);

    // 注册解析器相关服务
    const { TreeSitterService } = require('../../../../service/parser/core/parse/TreeSitterService');
    container.bind(TreeSitterService).toSelf().inSingletonScope();
    container.bind(TYPES.TreeSitterService).to(TreeSitterService);

    // 注册策略工厂
    const { StrategyFactory } = require('../../../../service/parser/processing/factory/StrategyFactory');
    container.bind(StrategyFactory).toSelf().inSingletonScope();
    container.bind(TYPES.StrategyFactory).to(StrategyFactory);

    // 注册配置管理器
    const { ConfigurationManager } = require('../../../../config/ConfigurationManager');
    container.bind(ConfigurationManager).toSelf().inSingletonScope();
    container.bind(TYPES.ConfigurationManager).to(ConfigurationManager);

    // 注册文件特征检测器
    const { FileFeatureDetector } = require('../../../../service/parser/detection/FileFeatureDetector');
    container.bind(FileFeatureDetector).toSelf().inSingletonScope();
    container.bind(TYPES.FileFeatureDetector).to(FileFeatureDetector);

    // 注册检测服务
    const { DetectionService } = require('../../../../service/parser/detection/DetectionService');
    container.bind(DetectionService).toSelf().inSingletonScope();
    container.bind(TYPES.DetectionService).to(DetectionService);

    // 注册后处理协调器
    const { ChunkPostProcessorCoordinator } = require('../../../../service/parser/post-processing/ChunkPostProcessorCoordinator');
    container.bind(ChunkPostProcessorCoordinator).toSelf().inSingletonScope();
    container.bind(TYPES.ChunkPostProcessorCoordinator).to(ChunkPostProcessorCoordinator);

    // 注册处理协调器
    container.bind<ProcessingCoordinator>(TYPES.UnifiedProcessingCoordinator).to(ProcessingCoordinator).inSingletonScope();

    // 注册向量服务模块
    container.bind(TYPES.IVectorRepository).to(VectorRepository).inSingletonScope();
    container.bind(TYPES.VectorRepository).to(VectorRepository).inSingletonScope();
    container.bind(TYPES.IVectorCacheManager).to(VectorCacheManager).inSingletonScope();
    container.bind(TYPES.VectorCacheManager).to(VectorCacheManager).inSingletonScope();
    container.bind(TYPES.VectorConversionService).to(VectorConversionService).inSingletonScope();
    container.bind(TYPES.VectorEmbeddingService).to(VectorEmbeddingService).inSingletonScope();
    container.bind(TYPES.IVectorService).to(VectorService).inSingletonScope();
    container.bind(TYPES.VectorService).to(VectorService).inSingletonScope();

    vectorService = container.get<VectorService>(TYPES.VectorService);
  });

  describe('Service Initialization', () => {
    it('should initialize successfully', () => {
      expect(vectorService).toBeDefined();
    });

    it('should be healthy after initialization', async () => {
      const isHealthy = await vectorService.isHealthy();
      expect(isHealthy).toBe(true);
    });

    it('should return proper status', async () => {
      const status = await vectorService.getStatus();
      expect(status).toBeDefined();
      expect(status.healthy).toBe(true);
    });
  });

  describe('Vector Operations', () => {
    it('should create vectors from content', async () => {
      const content = ['test content 1', 'test content 2'];
      const vectors = await vectorService.createVectors(content, {
        projectId: 'test-project'
      });

      expect(vectors).toHaveLength(2);
      expect(vectors[0].content).toBe('test content 1');
      expect(vectors[1].content).toBe('test content 2');
    });

    it('should search vectors by content', async () => {
      const content = ['test content for search'];
      await vectorService.createVectors(content, {
        projectId: 'test-project'
      });

      const results = await vectorService.searchByContent('test content for search');
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should delete vectors', async () => {
      const content = ['test content for deletion'];
      const vectors = await vectorService.createVectors(content, {
        projectId: 'test-project'
      });

      const vectorIds = vectors.map(v => v.id);
      const deleted = await vectorService.deleteVectors(vectorIds);
      expect(deleted).toBe(true);
    });
  });

  describe('Project Index Management', () => {
    it('should create project index', async () => {
      const created = await vectorService.createProjectIndex('test-project');
      expect(created).toBe(true);
    });

    it('should delete project index', async () => {
      const deleted = await vectorService.deleteProjectIndex('test-project');
      expect(deleted).toBe(true);
    });

    it('should get vector stats', async () => {
      const stats = await vectorService.getVectorStats('test-project');
      expect(stats).toBeDefined();
      expect(typeof stats.totalCount).toBe('number');
    });
  });

  describe('Performance Metrics', () => {
    it('should return performance metrics', async () => {
      const metrics = await vectorService.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.operationCounts).toBeDefined();
      expect(metrics.throughput).toBeDefined();
    });
  });

  afterAll(async () => {
    await vectorService.close();
  });
});