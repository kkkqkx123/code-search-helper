import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';

export interface QueryMetrics {
  queryId: string;
  executionTime: number;
  vectorSearchTime: number;
  graphSearchTime: number;
  fusionTime: number;
  totalResults: number;
  cacheHit: boolean;
  performance: {
    throughput: number;
    latency: number;
    successRate: number;
  };
}

export interface PerformanceStats {
  timestamp: number;
  metrics: QueryMetrics;
  systemMetrics: {
    memoryUsage: number;
    cpuUsage: number;
    databaseConnections: number;
    activeQueries: number;
  };
}

export interface AggregatedStats {
  timeRange: { start: Date; end: Date };
  totalQueries: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  cacheHitRate: number;
  throughput: number;
  errorRate: number;
  topQueries: Array<{
    query: string;
    count: number;
    avgLatency: number;
  }>;
  systemHealth: {
    averageMemoryUsage: number;
    averageCpuUsage: number;
    peakMemoryUsage: number;
    peakCpuUsage: number;
  };
}

@injectable()
export class PerformanceMonitor {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private metrics: PerformanceStats[] = [];
  private queryCounts: Map<string, number> = new Map();
  private queryLatencies: Map<string, number[]> = new Map();
  private maxMetricsHistory = 10000;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    @inject(TYPES.ConfigService) configService: ConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService
  ) {
    this.configService = configService;
    this.logger = logger;
    this.errorHandler = errorHandler;

    this.startCleanupTask();
  }

  async recordQuery(metrics: QueryMetrics): Promise<void> {
    const systemMetrics = await this.getSystemMetrics();

    const performanceStats: PerformanceStats = {
      timestamp: Date.now(),
      metrics,
      systemMetrics,
    };

    this.metrics.push(performanceStats);

    // Update query statistics
    const queryKey = this.sanitizeQuery(metrics.queryId);
    const currentCount = this.queryCounts.get(queryKey) || 0;
    this.queryCounts.set(queryKey, currentCount + 1);

    const currentLatencies = this.queryLatencies.get(queryKey) || [];
    currentLatencies.push(metrics.executionTime);
    this.queryLatencies.set(queryKey, currentLatencies);

    // Maintain history size limit
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    this.logger.debug('Query metrics recorded', {
      queryId: metrics.queryId,
      executionTime: metrics.executionTime,
      cacheHit: metrics.cacheHit,
    });
  }

  async getStats(timeRange: { start: Date; end: Date }): Promise<AggregatedStats> {
    const filteredMetrics = this.metrics.filter(
      stat =>
        stat.timestamp >= timeRange.start.getTime() && stat.timestamp <= timeRange.end.getTime()
    );

    if (filteredMetrics.length === 0) {
      return this.getEmptyStats(timeRange);
    }

    const totalQueries = filteredMetrics.length;
    const latencies = filteredMetrics.map(stat => stat.metrics.executionTime);
    const cacheHits = filteredMetrics.filter(stat => stat.metrics.cacheHit).length;
    const successfulQueries = filteredMetrics.filter(stat => stat.metrics.totalResults > 0).length;

    // Calculate percentiles
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const p95Latency = this.percentile(sortedLatencies, 95);
    const p99Latency = this.percentile(sortedLatencies, 99);

    // Calculate throughput (queries per second)
    const timeSpan = (timeRange.end.getTime() - timeRange.start.getTime()) / 1000;
    const throughput = totalQueries / timeSpan;

    // Get top queries
    const topQueries = this.getTopQueries(filteredMetrics);

    // Calculate system health metrics
    const systemHealth = this.calculateSystemHealth(filteredMetrics);

    return {
      timeRange,
      totalQueries,
      averageLatency: latencies.reduce((sum, latency) => sum + latency, 0) / totalQueries,
      p95Latency,
      p99Latency,
      cacheHitRate: cacheHits / totalQueries,
      throughput,
      errorRate: (totalQueries - successfulQueries) / totalQueries,
      topQueries,
      systemHealth,
    };
  }

  async getRealTimeStats(): Promise<{
    currentQueries: number;
    averageLatency: number;
    cacheHitRate: number;
    systemLoad: {
      memory: number;
      cpu: number;
      connections: number;
    };
    alerts: Array<{
      type: 'warning' | 'error';
      message: string;
      timestamp: number;
    }>;
  }> {
    const recentMetrics = this.metrics.slice(-100); // Last 100 queries

    const currentQueries = recentMetrics.filter(
      stat => Date.now() - stat.timestamp < 5000 // Last 5 seconds
    ).length;

    const averageLatency =
      recentMetrics.length > 0
        ? recentMetrics.reduce((sum, stat) => sum + stat.metrics.executionTime, 0) /
          recentMetrics.length
        : 0;

    const cacheHits = recentMetrics.filter(stat => stat.metrics.cacheHit).length;
    const cacheHitRate = recentMetrics.length > 0 ? cacheHits / recentMetrics.length : 0;

    const systemMetrics = await this.getSystemMetrics();
    const alerts = this.generateAlerts(recentMetrics, systemMetrics);

    return {
      currentQueries,
      averageLatency,
      cacheHitRate,
      systemLoad: {
        memory: systemMetrics.memoryUsage,
        cpu: systemMetrics.cpuUsage,
        connections: systemMetrics.databaseConnections,
      },
      alerts,
    };
  }

  async getQueryPerformanceReport(queryId: string): Promise<{
    queryId: string;
    executionCount: number;
    averageExecutionTime: number;
    minExecutionTime: number;
    maxExecutionTime: number;
    cacheHitRate: number;
    performanceTrend: 'improving' | 'degrading' | 'stable';
    recommendations: string[];
  }> {
    const queryMetrics = this.metrics.filter(stat => stat.metrics.queryId === queryId);

    if (queryMetrics.length === 0) {
      throw new Error(`No metrics found for query: ${queryId}`);
    }

    const executionTimes = queryMetrics.map(stat => stat.metrics.executionTime);
    const cacheHits = queryMetrics.filter(stat => stat.metrics.cacheHit).length;

    const averageExecutionTime =
      executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
    const minExecutionTime = Math.min(...executionTimes);
    const maxExecutionTime = Math.max(...executionTimes);
    const cacheHitRate = cacheHits / queryMetrics.length;

    // Analyze performance trend
    const recentMetrics = queryMetrics.slice(-10);
    const olderMetrics = queryMetrics.slice(0, Math.max(0, queryMetrics.length - 10));
    const performanceTrend = this.analyzePerformanceTrend(recentMetrics, olderMetrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(queryMetrics);

    return {
      queryId,
      executionCount: queryMetrics.length,
      averageExecutionTime,
      minExecutionTime,
      maxExecutionTime,
      cacheHitRate,
      performanceTrend,
      recommendations,
    };
  }

  async exportMetrics(format: 'json' | 'csv' = 'json'): Promise<string> {
    if (format === 'json') {
      return JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          metrics: this.metrics,
          summary: await this.getStats({
            start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
            end: new Date(),
          }),
        },
        null,
        2
      );
    } else {
      return this.exportToCsv();
    }
  }

  private async getSystemMetrics(): Promise<{
    memoryUsage: number;
    cpuUsage: number;
    databaseConnections: number;
    activeQueries: number;
  }> {
    // Mock system metrics - in real implementation, this would use system monitoring
    const memUsage = process.memoryUsage();
    const memoryUsage = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    return {
      memoryUsage,
      cpuUsage: Math.random() * 100, // Mock CPU usage
      databaseConnections: Math.floor(Math.random() * 50) + 10, // Mock connections
      activeQueries: this.metrics.filter(
        stat => Date.now() - stat.timestamp < 1000 // Last second
      ).length,
    };
  }

  private sanitizeQuery(queryId: string): string {
    // Extract meaningful part of query ID for aggregation
    return queryId.replace(/^query_\d+_/g, '').substring(0, 50);
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private getTopQueries(metrics: PerformanceStats[]): Array<{
    query: string;
    count: number;
    avgLatency: number;
  }> {
    const queryStats = new Map<string, { count: number; totalLatency: number }>();

    metrics.forEach(stat => {
      const queryKey = this.sanitizeQuery(stat.metrics.queryId);
      const current = queryStats.get(queryKey) || { count: 0, totalLatency: 0 };

      queryStats.set(queryKey, {
        count: current.count + 1,
        totalLatency: current.totalLatency + stat.metrics.executionTime,
      });
    });

    return Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgLatency: stats.totalLatency / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateSystemHealth(metrics: PerformanceStats[]): {
    averageMemoryUsage: number;
    averageCpuUsage: number;
    peakMemoryUsage: number;
    peakCpuUsage: number;
  } {
    const memoryUsages = metrics.map(stat => stat.systemMetrics.memoryUsage);
    const cpuUsages = metrics.map(stat => stat.systemMetrics.cpuUsage);

    return {
      averageMemoryUsage: memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length,
      averageCpuUsage: cpuUsages.reduce((sum, usage) => sum + usage, 0) / cpuUsages.length,
      peakMemoryUsage: Math.max(...memoryUsages),
      peakCpuUsage: Math.max(...cpuUsages),
    };
  }

  private generateAlerts(
    metrics: PerformanceStats[],
    systemMetrics: any
  ): Array<{
    type: 'warning' | 'error';
    message: string;
    timestamp: number;
  }> {
    const alerts: Array<{
      type: 'warning' | 'error';
      message: string;
      timestamp: number;
    }> = [];

    // Check for high latency
    const recentLatencies = metrics.slice(-10).map(stat => stat.metrics.executionTime);
    const avgRecentLatency =
      recentLatencies.reduce((sum, latency) => sum + latency, 0) / recentLatencies.length;

    if (avgRecentLatency > 1000) {
      alerts.push({
        type: 'error',
        message: `High average latency: ${avgRecentLatency.toFixed(0)}ms`,
        timestamp: Date.now(),
      });
    }

    // Check for low cache hit rate
    const recentCacheHits = metrics.slice(-10).filter(stat => stat.metrics.cacheHit).length;
    const cacheHitRate = recentCacheHits / 10;

    if (cacheHitRate < 0.3) {
      alerts.push({
        type: 'warning',
        message: `Low cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`,
        timestamp: Date.now(),
      });
    }

    // Check system resources
    if (systemMetrics.memoryUsage > 90) {
      alerts.push({
        type: 'error',
        message: `High memory usage: ${systemMetrics.memoryUsage.toFixed(1)}%`,
        timestamp: Date.now(),
      });
    }

    if (systemMetrics.cpuUsage > 80) {
      alerts.push({
        type: 'warning',
        message: `High CPU usage: ${systemMetrics.cpuUsage.toFixed(1)}%`,
        timestamp: Date.now(),
      });
    }

    return alerts;
  }

  private analyzePerformanceTrend(
    recentMetrics: PerformanceStats[],
    olderMetrics: PerformanceStats[]
  ): 'improving' | 'degrading' | 'stable' {
    if (recentMetrics.length === 0 || olderMetrics.length === 0) {
      return 'stable';
    }

    const recentAvg =
      recentMetrics.reduce((sum, stat) => sum + stat.metrics.executionTime, 0) /
      recentMetrics.length;
    const olderAvg =
      olderMetrics.reduce((sum, stat) => sum + stat.metrics.executionTime, 0) / olderMetrics.length;

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (changePercent > 10) return 'degrading';
    if (changePercent < -10) return 'improving';
    return 'stable';
  }

  private generateRecommendations(metrics: PerformanceStats[]): string[] {
    const recommendations: string[] = [];

    const avgLatency =
      metrics.reduce((sum, stat) => sum + stat.metrics.executionTime, 0) / metrics.length;
    const cacheHitRate = metrics.filter(stat => stat.metrics.cacheHit).length / metrics.length;

    if (avgLatency > 500) {
      recommendations.push('Consider optimizing query performance or increasing caching');
    }

    if (cacheHitRate < 0.5) {
      recommendations.push('Consider increasing cache TTL or optimizing cache strategy');
    }

    const avgMemoryUsage =
      metrics.reduce((sum, stat) => sum + stat.systemMetrics.memoryUsage, 0) / metrics.length;
    if (avgMemoryUsage > 80) {
      recommendations.push('Consider optimizing memory usage or increasing system resources');
    }

    return recommendations;
  }

  private getEmptyStats(timeRange: { start: Date; end: Date }): AggregatedStats {
    return {
      timeRange,
      totalQueries: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      cacheHitRate: 0,
      throughput: 0,
      errorRate: 0,
      topQueries: [],
      systemHealth: {
        averageMemoryUsage: 0,
        averageCpuUsage: 0,
        peakMemoryUsage: 0,
        peakCpuUsage: 0,
      },
    };
  }

  private exportToCsv(): string {
    const headers = [
      'timestamp',
      'queryId',
      'executionTime',
      'vectorSearchTime',
      'graphSearchTime',
      'fusionTime',
      'totalResults',
      'cacheHit',
      'memoryUsage',
      'cpuUsage',
    ];

    const rows = this.metrics.map(stat => [
      stat.timestamp,
      stat.metrics.queryId,
      stat.metrics.executionTime,
      stat.metrics.vectorSearchTime,
      stat.metrics.graphSearchTime,
      stat.metrics.fusionTime,
      stat.metrics.totalResults,
      stat.metrics.cacheHit,
      stat.systemMetrics.memoryUsage,
      stat.systemMetrics.cpuUsage,
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  private startCleanupTask(): void {
    const config = this.configService.get('performance') || {};
    const cleanupInterval = config.cleanupInterval || 3600000; // 1 hour

    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, cleanupInterval);

    this.logger.info('Performance monitor cleanup task started', { interval: cleanupInterval });
  }

  private cleanupOldMetrics(): void {
    const config = this.configService.get('performance') || {};
    const retentionPeriod = config.retentionPeriod || 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoffTime = Date.now() - retentionPeriod;

    const initialSize = this.metrics.length;
    this.metrics = this.metrics.filter(stat => stat.timestamp > cutoffTime);

    const cleanedCount = initialSize - this.metrics.length;
    if (cleanedCount > 0) {
      this.logger.debug('Cleaned up old performance metrics', {
        count: cleanedCount,
      });
    }
  }

  stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('Performance monitor cleanup task stopped');
    }
  }
}
