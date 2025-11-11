import { GraphIndexPerformanceMonitor } from '../GraphIndexPerformanceMonitor';
import { LoggerService } from '../../../utils/LoggerService';
import { 
  GraphIndexMetric, 
  GraphIndexPerformanceStats,
  PerformanceWarningType,
  DEFAULT_GRAPH_INDEX_THRESHOLDS 
} from '../GraphIndexMetrics';

describe('GraphIndexPerformanceMonitor', () => {
  let performanceMonitor: GraphIndexPerformanceMonitor;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;

    performanceMonitor = new GraphIndexPerformanceMonitor(mockLogger);
  });

  describe('recordMetric', () => {
    const projectId = 'test-project';
    const metric: GraphIndexMetric = {
      operation: 'startIndexing',
      projectId,
      duration: 1000,
      success: true,
      timestamp: Date.now(),
      metadata: {
        fileCount: 10,
        batchSize: 5,
        nodesCreated: 20,
        relationshipsCreated: 15
      }
    };

    it('should record metric and update stats', () => {
      performanceMonitor.recordMetric(metric);

      const stats = performanceMonitor.getPerformanceStats(projectId);
      expect(stats).toBeTruthy();
      expect(stats!.projectId).toBe(projectId);
      expect(stats!.totalOperations).toBe(1);
      expect(stats!.successfulOperations).toBe(1);
      expect(stats!.failedOperations).toBe(0);
      expect(stats!.averageOperationTime).toBe(1000);
      expect(stats!.totalFilesProcessed).toBe(10);
      expect(stats!.totalNodesCreated).toBe(20);
      expect(stats!.totalRelationshipsCreated).toBe(15);
      expect(stats!.successRate).toBe(1);
    });

    it('should handle failed operations', () => {
      const failedMetric = { ...metric, success: false };
      performanceMonitor.recordMetric(failedMetric);

      const stats = performanceMonitor.getPerformanceStats(projectId);
      expect(stats!.successfulOperations).toBe(0);
      expect(stats!.failedOperations).toBe(1);
      expect(stats!.successRate).toBe(0);
    });

    it('should generate performance warnings for slow operations', () => {
      const slowMetric = { ...metric, duration: DEFAULT_GRAPH_INDEX_THRESHOLDS.maxOperationTime + 1000 };
      performanceMonitor.recordMetric(slowMetric);

      const warnings = performanceMonitor.getWarnings(projectId);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe(PerformanceWarningType.SLOW_OPERATION);
      expect(warnings[0].severity).toBe('medium');
    });

    it('should generate critical warnings for very slow operations', () => {
      const verySlowMetric = { 
        ...metric, 
        duration: DEFAULT_GRAPH_INDEX_THRESHOLDS.maxOperationTime * 2.5 
      };
      performanceMonitor.recordMetric(verySlowMetric);

      const warnings = performanceMonitor.getWarnings(projectId);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe(PerformanceWarningType.SLOW_OPERATION);
      expect(warnings[0].severity).toBe('high');
    });

    it('should generate warnings for high memory usage', () => {
      const highMemoryMetric = {
        ...metric,
        metadata: {
          ...metric.metadata,
          memoryUsage: {
            heapUsed: 850,
            heapTotal: 1000,
            percentage: 0.85
          }
        }
      };
      performanceMonitor.recordMetric(highMemoryMetric);

      const warnings = performanceMonitor.getWarnings(projectId);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe(PerformanceWarningType.HIGH_MEMORY_USAGE);
      expect(warnings[0].severity).toBe('high');
    });

    it('should generate critical warnings for very high memory usage', () => {
      const criticalMemoryMetric = {
        ...metric,
        metadata: {
          ...metric.metadata,
          memoryUsage: {
            heapUsed: 960,
            heapTotal: 1000,
            percentage: 0.96
          }
        }
      };
      performanceMonitor.recordMetric(criticalMemoryMetric);

      const warnings = performanceMonitor.getWarnings(projectId);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe(PerformanceWarningType.HIGH_MEMORY_USAGE);
      expect(warnings[0].severity).toBe('critical');
    });

    it('should generate warnings for large batch sizes', () => {
      const largeBatchMetric = {
        ...metric,
        metadata: {
          ...metric.metadata,
          batchSize: DEFAULT_GRAPH_INDEX_THRESHOLDS.maxBatchSize + 5
        }
      };
      performanceMonitor.recordMetric(largeBatchMetric);

      const warnings = performanceMonitor.getWarnings(projectId);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe(PerformanceWarningType.LARGE_BATCH_SIZE);
      expect(warnings[0].severity).toBe('medium');
    });

    it('should accumulate stats over multiple operations', () => {
      const metric2: GraphIndexMetric = {
        ...metric,
        duration: 2000,
        metadata: {
          fileCount: 15,
          batchSize: 7,
          nodesCreated: 30,
          relationshipsCreated: 25
        }
      };

      performanceMonitor.recordMetric(metric);
      performanceMonitor.recordMetric(metric2);

      const stats = performanceMonitor.getPerformanceStats(projectId);
      expect(stats!.totalOperations).toBe(2);
      expect(stats!.successfulOperations).toBe(2);
      expect(stats!.averageOperationTime).toBe(1500); // (1000 + 2000) / 2
      expect(stats!.totalFilesProcessed).toBe(25); // 10 + 15
      expect(stats!.totalNodesCreated).toBe(50); // 20 + 30
      expect(stats!.totalRelationshipsCreated).toBe(40); // 15 + 25
      expect(stats!.averageBatchSize).toBe(6); // (5 + 7) / 2
    });
  });

  describe('getPerformanceStats', () => {
    it('should return null for non-existent project', () => {
      const stats = performanceMonitor.getPerformanceStats('non-existent');
      expect(stats).toBeNull();
    });

    it('should return stats for existing project', () => {
      const projectId = 'test-project';
      const metric: GraphIndexMetric = {
        operation: 'startIndexing',
        projectId,
        duration: 1000,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      performanceMonitor.recordMetric(metric);

      const stats = performanceMonitor.getPerformanceStats(projectId);
      expect(stats).toBeTruthy();
      expect(stats!.projectId).toBe(projectId);
    });
  });

  describe('getAllPerformanceStats', () => {
    it('should return empty map when no stats exist', () => {
      const allStats = performanceMonitor.getAllPerformanceStats();
      expect(allStats.size).toBe(0);
    });

    it('should return all project stats', () => {
      const projectId1 = 'project1';
      const projectId2 = 'project2';

      const metric1: GraphIndexMetric = {
        operation: 'startIndexing',
        projectId: projectId1,
        duration: 1000,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      const metric2: GraphIndexMetric = {
        operation: 'processBatch',
        projectId: projectId2,
        duration: 500,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      performanceMonitor.recordMetric(metric1);
      performanceMonitor.recordMetric(metric2);

      const allStats = performanceMonitor.getAllPerformanceStats();
      expect(allStats.size).toBe(2);
      expect(allStats.has(projectId1)).toBe(true);
      expect(allStats.has(projectId2)).toBe(true);
    });
  });

  describe('clearProjectStats', () => {
    it('should clear stats for specific project', () => {
      const projectId1 = 'project1';
      const projectId2 = 'project2';

      const metric1: GraphIndexMetric = {
        operation: 'startIndexing',
        projectId: projectId1,
        duration: 1000,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      const metric2: GraphIndexMetric = {
        operation: 'processBatch',
        projectId: projectId2,
        duration: 500,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      performanceMonitor.recordMetric(metric1);
      performanceMonitor.recordMetric(metric2);

      performanceMonitor.clearProjectStats(projectId1);

      expect(performanceMonitor.getPerformanceStats(projectId1)).toBeNull();
      expect(performanceMonitor.getPerformanceStats(projectId2)).toBeTruthy();
    });
  });

  describe('clearAllStats', () => {
    it('should clear all stats', () => {
      const projectId1 = 'project1';
      const projectId2 = 'project2';

      const metric1: GraphIndexMetric = {
        operation: 'startIndexing',
        projectId: projectId1,
        duration: 1000,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      const metric2: GraphIndexMetric = {
        operation: 'processBatch',
        projectId: projectId2,
        duration: 500,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      performanceMonitor.recordMetric(metric1);
      performanceMonitor.recordMetric(metric2);

      performanceMonitor.clearAllStats();

      expect(performanceMonitor.getAllPerformanceStats().size).toBe(0);
      expect(performanceMonitor.getWarnings().length).toBe(0);
    });
  });

  describe('getPerformanceReport', () => {
    it('should return empty summary when no stats exist', () => {
      const report = performanceMonitor.getPerformanceReport();
      
      expect(report.summary.totalProjects).toBe(0);
      expect(report.summary.totalOperations).toBe(0);
      expect(report.summary.overallSuccessRate).toBe(0);
      expect(report.summary.averageOperationTime).toBe(0);
      expect(report.projectStats).toBeUndefined();
    });

    it('should return summary for all projects', () => {
      const projectId1 = 'project1';
      const projectId2 = 'project2';

      const metric1: GraphIndexMetric = {
        operation: 'startIndexing',
        projectId: projectId1,
        duration: 1000,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      const metric2: GraphIndexMetric = {
        operation: 'processBatch',
        projectId: projectId2,
        duration: 500,
        success: false,
        timestamp: Date.now(),
        metadata: {}
      };

      performanceMonitor.recordMetric(metric1);
      performanceMonitor.recordMetric(metric2);

      const report = performanceMonitor.getPerformanceReport();
      
      expect(report.summary.totalProjects).toBe(2);
      expect(report.summary.totalOperations).toBe(2);
      expect(report.summary.overallSuccessRate).toBe(0.5); // 1 success / 2 total
      expect(report.summary.averageOperationTime).toBe(750); // (1000 + 500) / 2
      expect(report.projectStats).toHaveLength(2);
    });

    it('should return summary for specific project', () => {
      const projectId = 'test-project';

      const metric: GraphIndexMetric = {
        operation: 'startIndexing',
        projectId,
        duration: 1000,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      performanceMonitor.recordMetric(metric);

      const report = performanceMonitor.getPerformanceReport(projectId);
      
      expect(report.summary.totalProjects).toBe(1);
      expect(report.summary.totalOperations).toBe(1);
      expect(report.summary.overallSuccessRate).toBe(1);
      expect(report.summary.averageOperationTime).toBe(1000);
      expect(report.projectStats).toHaveLength(1);
      expect(report.projectStats![0].projectId).toBe(projectId);
    });
  });

  describe('getWarnings', () => {
    it('should return all warnings when no project specified', () => {
      const projectId1 = 'project1';
      const projectId2 = 'project2';

      const slowMetric1: GraphIndexMetric = {
        operation: 'startIndexing',
        projectId: projectId1,
        duration: DEFAULT_GRAPH_INDEX_THRESHOLDS.maxOperationTime + 1000,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      const slowMetric2: GraphIndexMetric = {
        operation: 'processBatch',
        projectId: projectId2,
        duration: DEFAULT_GRAPH_INDEX_THRESHOLDS.maxOperationTime + 1000,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      performanceMonitor.recordMetric(slowMetric1);
      performanceMonitor.recordMetric(slowMetric2);

      const warnings = performanceMonitor.getWarnings();
      expect(warnings).toHaveLength(2);
    });

    it('should return warnings for specific project', () => {
      const projectId1 = 'project1';
      const projectId2 = 'project2';

      const slowMetric1: GraphIndexMetric = {
        operation: 'startIndexing',
        projectId: projectId1,
        duration: DEFAULT_GRAPH_INDEX_THRESHOLDS.maxOperationTime + 1000,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      const slowMetric2: GraphIndexMetric = {
        operation: 'processBatch',
        projectId: projectId2,
        duration: DEFAULT_GRAPH_INDEX_THRESHOLDS.maxOperationTime + 1000,
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      performanceMonitor.recordMetric(slowMetric1);
      performanceMonitor.recordMetric(slowMetric2);

      const warnings = performanceMonitor.getWarnings(projectId1);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].projectId).toBe(projectId1);
    });
  });

  describe('setThresholds', () => {
    it('should update thresholds', () => {
      const newThresholds = {
        maxOperationTime: 5000,
        minSuccessRate: 0.9
      };

      performanceMonitor.setThresholds(newThresholds);

      // Verify thresholds are updated by triggering a warning
      const metric: GraphIndexMetric = {
        operation: 'startIndexing',
        projectId: 'test-project',
        duration: 6000, // Exceeds new threshold
        success: true,
        timestamp: Date.now(),
        metadata: {}
      };

      performanceMonitor.recordMetric(metric);

      const warnings = performanceMonitor.getWarnings();
      expect(warnings).toHaveLength(1);
      expect(warnings[0].metadata.threshold).toBe(5000);
    });
  });
});