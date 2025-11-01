import { Container } from 'inversify';
import { TYPES } from '../../types';
import { InfrastructureServiceRegistrar } from '../../core/registrars/InfrastructureServiceRegistrar';
import { ConfigServiceRegistrar } from '../../core/registrars/ConfigServiceRegistrar';
import { DatabaseServiceRegistrar } from '../../core/registrars/DatabaseServiceRegistrar';
import { BusinessServiceRegistrar } from '../../core/registrars/BusinessServiceRegistrar';
import { EmbedderServiceRegistrar } from '../../core/registrars/EmbedderServiceRegistrar';
import { AsyncTaskQueue } from '../../infrastructure/batching/AsyncTaskQueue';
import { ConflictResolver } from '../../infrastructure/transaction/ConflictResolver';
import { DataConsistencyChecker } from '../../database/common/DataConsistencyChecker';
import { PerformanceOptimizerService } from '../../infrastructure/batching/PerformanceOptimizerService';
import { TransactionCoordinator } from '../../infrastructure/transaction/TransactionCoordinator';
import { DatabaseHealthChecker } from '../../service/monitoring/DatabaseHealthChecker';
import { GraphModule } from '../../service/graph/core/GraphModule';

describe('Service Integration Tests', () => {
  let container: Container;
  let taskQueue: AsyncTaskQueue;
  let conflictResolver: ConflictResolver;
  let consistencyChecker: DataConsistencyChecker;
  let performanceOptimizer: PerformanceOptimizerService;
  let transactionCoordinator: TransactionCoordinator;
  let healthChecker: DatabaseHealthChecker;
  let graphCacheService: any; // GraphCacheService

  beforeAll(() => {
    // 设置容器
    container = new Container();

    // 注册所有服务 - 按照依赖顺序注册
    InfrastructureServiceRegistrar.register(container);  // 基础设施服务，包括LoggerService
    ConfigServiceRegistrar.register(container);          // 配置服务，依赖基础设施服务
    DatabaseServiceRegistrar.register(container);        // 数据库服务，依赖配置服务
    BusinessServiceRegistrar.register(container);        // 业务服务，依赖前面的服务
    EmbedderServiceRegistrar.register(container);        // 嵌入器服务，包含EmbeddingCacheService
    container.load(GraphModule);                         // 图服务模块，包含IGraphService

    // 获取服务实例
    taskQueue = container.get<AsyncTaskQueue>(TYPES.AsyncTaskQueue);
    conflictResolver = container.get<ConflictResolver>(TYPES.ConflictResolver);
    consistencyChecker = container.get<DataConsistencyChecker>(TYPES.DataConsistencyChecker);
    performanceOptimizer = container.get<PerformanceOptimizerService>(TYPES.PerformanceOptimizerService);
    transactionCoordinator = container.get<TransactionCoordinator>(TYPES.TransactionCoordinator);
    healthChecker = container.get<DatabaseHealthChecker>(TYPES.HealthChecker);
    graphCacheService = container.get<any>(TYPES.GraphCacheService);
  });

  afterAll(async () => {
    // 清理资源
    if (taskQueue) {
      taskQueue.stop();
    }
    if (healthChecker) {
      healthChecker.stopMonitoring();
    }
    if (graphCacheService && typeof graphCacheService.stopCleanup === 'function') {
      graphCacheService.stopCleanup();
    }
  });

  describe('AsyncTaskQueue Integration', () => {
    test('should process tasks concurrently', async () => {
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `test-task-${i}`,
        priority: 'normal',
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 50)); // 减少等待时间
          return { result: `task-${i}-completed` };
        }
      }));

      const results: any[] = [];

      // 添加任务到队列
      const taskIds = [];
      for (const task of tasks) {
        const taskId = await taskQueue.addTask(task.execute, {
          priority: task.priority === 'normal' ? 0 : 1,
          timeout: 10000 // 设置任务超时时间
        });
        taskIds.push(taskId);
      }

      // 等待所有任务完成，增加超时时间
      await taskQueue.waitForCompletion(45000);

      // 验证结果
      const status = taskQueue.getStatus();
      expect(status.completed).toBe(10);
      expect(status.pending).toBe(0);
      expect(status.running).toBe(0);

      // 验证每个任务都有结果
      for (const taskId of taskIds) {
        const result = taskQueue.getTaskResult(taskId);
        expect(result).toBeDefined();
        expect(result?.success).toBe(true);
      }
    }, 60000); // 增加超时时间为60秒

    test('should handle task failures and retries', async () => {
      let attemptCount = 0;
      const taskId = await taskQueue.addTask(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Simulated failure');
        }
        return { success: true };
      }, {
        maxRetries: 3,
        timeout: 15000 // 设置任务超时时间
      });

      await taskQueue.waitForCompletion(45000);
      const result = taskQueue.getTaskResult(taskId);

      expect(result?.success).toBe(true);
      expect(result?.retries).toBe(2);
    }, 60000); // 增加超时时间为60秒
  });

  describe('ConflictResolver Integration', () => {
    test('should resolve data conflicts using latest_wins strategy', async () => {
      const conflict = {
        id: 'test-conflict-1',
        type: 'data_conflict' as const,
        entities: [
          {
            source: 'database1',
            id: 'entity-1',
            data: { value: 'old', timestamp: 1000 },
            timestamp: 1000
          },
          {
            source: 'database2',
            id: 'entity-1',
            data: { value: 'new', timestamp: 2000 },
            timestamp: 2000
          }
        ],
        context: {
          operation: 'update',
          projectPath: '/test/project'
        }
      };

      const resolution = await conflictResolver.resolveConflict(conflict, {
        strategy: 'latest_wins'
      });

      expect(resolution.success).toBe(true);
      expect(resolution.resolvedData.value).toBe('new');
      expect(resolution.appliedTo).toContain('database2');
    });

    test('should merge data using merge strategy', async () => {
      const conflict = {
        id: 'test-conflict-2',
        type: 'data_conflict' as const,
        entities: [
          {
            source: 'database1',
            id: 'entity-2',
            data: { field1: 'value1', field2: 'old' },
            timestamp: 1000
          },
          {
            source: 'database2',
            id: 'entity-2',
            data: { field2: 'new', field3: 'value3' },
            timestamp: 2000
          }
        ],
        context: {
          operation: 'merge',
          projectPath: '/test/project'
        }
      };

      const resolution = await conflictResolver.resolveConflict(conflict, {
        strategy: 'merge'
      });

      expect(resolution.success).toBe(true);
      expect(resolution.resolvedData.field1).toBe('value1');
      expect(resolution.resolvedData.field2).toBe('new');
      expect(resolution.resolvedData.field3).toBe('value3');
    });

    test('should handle batch conflict resolution', async () => {
      const conflicts = [
        {
          id: 'batch-conflict-1',
          type: 'data_conflict' as const,
          entities: [
            {
              source: 'database1',
              id: 'entity-1',
              data: { value: 'old' },
              timestamp: 1000
            },
            {
              source: 'database2',
              id: 'entity-1',
              data: { value: 'new' },
              timestamp: 2000
            }
          ],
          context: { operation: 'batch' }
        },
        {
          id: 'batch-conflict-2',
          type: 'data_conflict' as const,
          entities: [
            {
              source: 'database1',
              id: 'entity-2',
              data: { value: 'old2' },
              timestamp: 1000
            },
            {
              source: 'database2',
              id: 'entity-2',
              data: { value: 'new2' },
              timestamp: 2000
            }
          ],
          context: { operation: 'batch' }
        }
      ];

      const results = await conflictResolver.resolveConflicts(conflicts, {
        strategy: 'latest_wins'
      });

      expect(results.length).toBe(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(results[0].resolvedData.value).toBe('new');
      expect(results[1].resolvedData.value).toBe('new2');
    });
  });

  describe('DataConsistencyChecker Integration', () => {
    test('should perform consistency checks', async () => {
      const result = await consistencyChecker.checkConsistency('/test/project', {
        checkMissingReferences: true,
        checkDataIntegrity: true,
        checkReferenceIntegrity: true,
        batchSize: 100,
        maxResults: 1000
      });

      expect(result).toBeDefined();
      expect(typeof result.isConsistent).toBe('boolean');
      expect(Array.isArray(result.inconsistencies)).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalChecks).toBeGreaterThan(0);
    });

    test('should handle consistency check options', async () => {
      const result = await consistencyChecker.checkConsistency('/test/project', {
        checkMissingReferences: false,
        checkDataIntegrity: true,
        checkReferenceIntegrity: false,
        batchSize: 50,
        maxResults: 500
      });

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
    });
  });

  describe('PerformanceOptimizerService Integration', () => {
    test('should use AsyncTaskQueue for batch processing', async () => {
      const items = Array.from({ length: 20 }, (_, i) => ({ id: i, value: `item-${i}` }));

      const results = await performanceOptimizer.processBatchesWithQueue(
        items,
        async (batch: any[]) => {
          await new Promise(resolve => setTimeout(resolve, 25)); // 减少等待时间
          return batch.map((item: any) => ({ ...item, processed: true }));
        },
        'test-operation'
      );

      expect(results.length).toBe(20);
      expect(results.every((r: { processed: any; }) => r.processed)).toBe(true);
    }, 60000); // 增加超时时间为60秒

    test('should handle performance monitoring', async () => {
      await performanceOptimizer.executeWithMonitoring(
        async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'test-result';
        },
        'test-monitoring'
      );

      const stats = performanceOptimizer.getPerformanceStats('test-monitoring');
      expect(stats.count).toBe(1);
      expect(stats.successRate).toBe(1);
      expect(stats.averageDuration).toBeGreaterThan(0);
    });
  });

  describe('TransactionCoordinator Integration', () => {
    test('should handle transaction conflicts', async () => {
      const transactionId = await transactionCoordinator.beginTransaction();

      const conflictData = {
        entities: [
          {
            source: 'database1',
            id: 'entity-1',
            data: { value: 'conflicted' },
            timestamp: Date.now()
          }
        ],
        context: {
          operation: 'conflict_test'
        }
      };

      const resolved = await transactionCoordinator.resolveTransactionConflict(
        transactionId,
        conflictData
      );

      expect(typeof resolved).toBe('boolean');

      await transactionCoordinator.cleanupTransaction(transactionId);
    });

    test('should execute two-phase commit', async () => {
      const mockParticipant = {
        databaseType: 'test' as any,
        prepare: jest.fn().mockResolvedValue(true),
        commit: jest.fn().mockResolvedValue(true),
        rollback: jest.fn().mockResolvedValue(true),
        isPrepared: jest.fn().mockResolvedValue(true)
      };

      const result = await transactionCoordinator.executeTwoPhaseCommit(
        [mockParticipant],
        async () => {
          // 模拟业务操作
          return 'operation-result';
        }
      );

      expect(result).toBe(true);
      expect(mockParticipant.prepare).toHaveBeenCalled();
      expect(mockParticipant.commit).toHaveBeenCalled();
    });
  });

  describe('DatabaseHealthChecker Integration', () => {
    test('should perform comprehensive health checks', async () => {
      const result = await healthChecker.performComprehensiveHealthCheck('/test/project');

      expect(result).toBeDefined();
      expect(result.overallStatus).toMatch(/^(healthy|degraded|error)$/);
      expect(result.databaseStatuses).toBeDefined();
      expect(result.summary).toBeDefined();
    });

    test('should check data consistency as part of health check', async () => {
      const result = await healthChecker.checkDataConsistency('/test/project');

      expect(result).toBeDefined();
      expect(result.status).toMatch(/^(healthy|degraded|error)$/);
      expect(result.details).toBeDefined();
      expect(result.details.consistencyCheck).toBeDefined();
    });

    test('should handle health status monitoring', async () => {
      let updateReceived = false;

      healthChecker.subscribeToHealthUpdates((status) => {
        updateReceived = true;
        expect(status).toBeDefined();
      });

      // 注册一个模拟的健康检查器以确保有东西可以检查
      const mockHealthChecker = {
        checkHealth: jest.fn().mockResolvedValue({
          databaseType: 'test_db' as any,
          status: 'healthy',
          responseTime: 10,
          connectionPoolStatus: {
            activeConnections: 1,
            idleConnections: 1,
            pendingRequests: 0,
            maxConnections: 10
          },
          timestamp: Date.now()
        }),
        getHealthStatus: jest.fn().mockReturnValue({
          databaseType: 'test_db' as any,
          status: 'healthy',
          responseTime: 10,
          connectionPoolStatus: {
            activeConnections: 1,
            idleConnections: 1,
            pendingRequests: 0,
            maxConnections: 10
          },
          timestamp: Date.now()
        }),
        subscribeToHealthUpdates: jest.fn()
      };

      healthChecker.registerHealthChecker('test_db' as any, mockHealthChecker);

      // 触发健康检查
      await healthChecker.checkAllHealth();

      // 等待异步通知
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(updateReceived).toBe(true);
    });
  });

  describe('Cross-Service Integration', () => {
    test('should integrate AsyncTaskQueue with PerformanceOptimizer', async () => {
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({ id: i, data: `data-${i}` }));

      const startTime = Date.now();
      const results = await performanceOptimizer.processBatchesWithQueue(
        largeDataset,
        async (batch: any[]) => {
          // 模拟处理时间
          await new Promise(resolve => setTimeout(resolve, 5)); // 减少等待时间
          return batch.map((item: any) => ({ ...item, processed: true }));
        },
        'large-dataset-processing'
      );

      const processingTime = Date.now() - startTime;

      expect(results.length).toBe(100);
      expect(results.every((r: { processed: any; }) => r.processed)).toBe(true);
      expect(processingTime).toBeLessThan(15000); // 调整期望时间
    }, 90000); // 增加超时时间为90秒

    test('should integrate ConflictResolver with TransactionCoordinator', async () => {
      const transactionId = await transactionCoordinator.beginTransaction();

      // 模拟冲突场景
      const conflictData = {
        entities: [
          {
            source: 'primary_db',
            id: 'conflict-entity',
            data: { status: 'pending' },
            timestamp: Date.now() - 1000
          },
          {
            source: 'secondary_db',
            id: 'conflict-entity',
            data: { status: 'completed' },
            timestamp: Date.now()
          }
        ],
        context: {
          operation: 'status_update',
          transactionId
        }
      };

      const conflictResolved = await transactionCoordinator.resolveTransactionConflict(
        transactionId,
        conflictData
      );

      expect(typeof conflictResolved).toBe('boolean');

      await transactionCoordinator.cleanupTransaction(transactionId);
    });

    test('should integrate DataConsistencyChecker with DatabaseHealthChecker', async () => {
      const healthResult = await healthChecker.performComprehensiveHealthCheck('/test/project');

      expect(healthResult.databaseStatuses.has('consistency_check' as any)).toBe(true);

      const consistencyStatus = healthResult.databaseStatuses.get('consistency_check' as any);
      expect(consistencyStatus).toBeDefined();
      if (consistencyStatus) {
        expect(consistencyStatus.status).toMatch(/^(healthy|degraded|error)$/);
      }
    });
  });
});