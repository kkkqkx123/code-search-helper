import { injectable } from 'inversify';
import { GlobalEventBus, GlobalEvents } from '../../utils/GlobalEventBus';
import { PerformanceMonitor } from './PerformanceMonitor';
import { DatabaseEventManager } from '../../database/common/DatabaseEventTypes';
import {
  IEventManager,
  DatabaseEvent,
  DatabaseEventType,
  PerformanceMetricData
} from '../../database/common/DatabaseEventTypes';

/**
 * 性能监控事件数据
 */
export interface PerformanceMetricsEvent {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  memoryUsage?: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage?: number;
  customMetrics?: Record<string, number>;
  context?: Record<string, any>;
}

/**
 * 性能阈值配置
 */
export interface PerformanceThresholdConfig {
  warningThreshold: number; // 警告阈值（毫秒）
  criticalThreshold: number; // 严重阈值（毫秒）
  memoryWarningThreshold?: number; // 内存警告阈值（百分比）
  memoryCriticalThreshold?: number; // 内存严重阈值（百分比）
}

/**
 * 性能监控事件接口
 */
export interface IEventPerformanceMonitor {
  /**
   * 开始监控操作
   */
  startOperation(operation: string, context?: Record<string, any>): string;
  
  /**
   * 结束监控操作
   */
  endOperation(operationId: string, success?: boolean, customMetrics?: Record<string, number>): void;
  
  /**
   * 监控函数执行
   */
  monitor<T>(operation: string, fn: () => Promise<T>, context?: Record<string, any>): Promise<T>;
  
  /**
   * 监控同步函数执行
   */
  monitorSync<T>(operation: string, fn: () => T, context?: Record<string, any>): T;
  
  /**
   * 设置性能阈值
   */
  setThreshold(operation: string, config: PerformanceThresholdConfig): void;
  
  /**
   * 获取性能统计
   */
  getStatistics(operation?: string): PerformanceStatistics;
  
  /**
   * 重置性能统计
   */
  resetStatistics(operation?: string): void;
}

/**
 * 性能统计数据
 */
export interface PerformanceStatistics {
  operation: string;
  count: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  warningCount: number;
  criticalCount: number;
  lastExecutionTime?: Date;
}

/**
 * 事件性能监控服务
 * 
 * 这个类将性能监控与事件系统集成，提供自动记录关键操作的事件时间线功能。
 * 
 * @example
 * // 创建性能监控实例
 * const performanceMonitor = new EventPerformanceMonitor();
 * 
 * // 监控异步操作
 * const result = await performanceMonitor.monitor('database.query', async () => {
 *   return await database.query('SELECT * FROM users');
 * }, { query: 'SELECT * FROM users' });
 * 
 * // 手动监控操作
 * const operationId = performanceMonitor.startOperation('file.process');
 * // ... 执行操作 ...
 * performanceMonitor.endOperation(operationId, true);
 */
@injectable()
export class EventPerformanceMonitor implements IEventPerformanceMonitor {
  private globalEventBus: GlobalEventBus<GlobalEvents>;
  private performanceMonitor: PerformanceMonitor;
  private databaseEventManager: IEventManager<GlobalEvents>;
  private activeOperations: Map<string, PerformanceMetricsEvent> = new Map();
  private thresholds: Map<string, PerformanceThresholdConfig> = new Map();
  private statistics: Map<string, PerformanceStatistics> = new Map();
  private defaultThreshold: PerformanceThresholdConfig = {
    warningThreshold: 1000, // 1秒
    criticalThreshold: 5000, // 5秒
    memoryWarningThreshold: 80, // 80%
    memoryCriticalThreshold: 95 // 95%
  };

  constructor(
    globalEventBus?: GlobalEventBus<GlobalEvents>,
    performanceMonitor?: PerformanceMonitor,
    databaseEventManager?: IEventManager<GlobalEvents>
  ) {
    this.globalEventBus = globalEventBus || GlobalEventBus.getInstance<GlobalEvents>();
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor({} as any); // 假设PerformanceMonitor需要一个logger参数
    this.databaseEventManager = databaseEventManager || new DatabaseEventManager<GlobalEvents>();
    
    // 监听全局性能事件
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听应用启动事件
    this.globalEventBus.on('app.started', (data) => {
      this.performanceMonitor.recordQueryExecution(Date.now() - data.startTime.getTime());
    });

    // 监听数据库连接事件
    this.globalEventBus.on('database.connected', (data) => {
      this.performanceMonitor.recordQueryExecution(Date.now() - data.timestamp.getTime());
    });

    // 监听项目加载事件
    this.globalEventBus.on('project.loaded', (data) => {
      this.performanceMonitor.recordQueryExecution(data.loadTime);
    });

    // 监听项目索引事件
    this.globalEventBus.on('project.indexed', (data) => {
      this.performanceMonitor.recordQueryExecution(data.indexTime);
    });

    // 监听搜索事件
    this.globalEventBus.on('search.completed', (data) => {
      this.performanceMonitor.recordQueryExecution(data.executionTime);
    });
  }

  /**
   * 开始监控操作
   */
  startOperation(operation: string, context?: Record<string, any>): string {
    const operationId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    // 获取内存使用情况
    const memoryUsage = this.getMemoryUsage();
    
    const metricsEvent: PerformanceMetricsEvent = {
      operation,
      startTime,
      endTime: 0,
      duration: 0,
      success: false,
      memoryUsage,
      context
    };
    
    this.activeOperations.set(operationId, metricsEvent);
    
    // 记录操作开始事件
    this.globalEventBus.emit('performance.metric' as keyof GlobalEvents, {
      operation: `${operation}.started`,
      duration: 0,
      success: true,
      timestamp: new Date()
    });
    
    return operationId;
  }

  /**
   * 结束监控操作
   */
  endOperation(operationId: string, success: boolean = true, customMetrics?: Record<string, number>): void {
    const metricsEvent = this.activeOperations.get(operationId);
    if (!metricsEvent) {
      console.warn(`Operation with ID ${operationId} not found`);
      return;
    }
    
    const endTime = Date.now();
    const duration = endTime - metricsEvent.startTime;
    
    // 更新性能指标
    metricsEvent.endTime = endTime;
    metricsEvent.duration = duration;
    metricsEvent.success = success;
    metricsEvent.customMetrics = customMetrics;
    
    // 获取结束时的内存使用情况
    const memoryUsage = this.getMemoryUsage();
    if (memoryUsage) {
      metricsEvent.memoryUsage = memoryUsage;
    }
    
    // 更新统计信息
    this.updateStatistics(metricsEvent);
    
    // 检查性能阈值
    this.checkThresholds(metricsEvent);
    
    // 记录性能指标
    this.performanceMonitor.recordQueryExecution(metricsEvent.duration);
    
    // 发出性能指标事件
    this.globalEventBus.emit('performance.metric' as keyof GlobalEvents, {
      operation: metricsEvent.operation,
      duration: metricsEvent.duration,
      success: metricsEvent.success,
      memoryUsage: metricsEvent.memoryUsage?.percentage,
      timestamp: new Date()
    });
    
    // 记录到数据库事件历史
    this.databaseEventManager.emitEvent({
      type: DatabaseEventType.PERFORMANCE_METRIC,
      timestamp: new Date(),
      source: 'common',
      data: {
        operation: metricsEvent.operation,
        duration: metricsEvent.duration,
        success: metricsEvent.success,
        dataSize: metricsEvent.customMetrics ? Object.keys(metricsEvent.customMetrics).length : undefined,
        timestamp: new Date()
      }
    });
    
    // 从活动操作中移除
    this.activeOperations.delete(operationId);
  }

  /**
   * 监控异步函数执行
   */
  async monitor<T>(operation: string, fn: () => Promise<T>, context?: Record<string, any>): Promise<T> {
    const operationId = this.startOperation(operation, context);
    
    try {
      const result = await fn();
      this.endOperation(operationId, true);
      return result;
    } catch (error) {
      this.endOperation(operationId, false);
      throw error;
    }
  }

  /**
   * 监控同步函数执行
   */
  monitorSync<T>(operation: string, fn: () => T, context?: Record<string, any>): T {
    const operationId = this.startOperation(operation, context);
    
    try {
      const result = fn();
      this.endOperation(operationId, true);
      return result;
    } catch (error) {
      this.endOperation(operationId, false);
      throw error;
    }
  }

  /**
   * 设置性能阈值
   */
  setThreshold(operation: string, config: PerformanceThresholdConfig): void {
    this.thresholds.set(operation, config);
  }

  /**
   * 获取性能统计
   */
  getStatistics(operation?: string): PerformanceStatistics {
    if (operation) {
      return this.statistics.get(operation) || this.getDefaultStatistics(operation);
    }
    
    // 当没有提供 operation 参数时，返回所有统计信息的数组
    return Array.from(this.statistics.values())[0] || this.getDefaultStatistics('default');
  }

  /**
   * 重置性能统计
   */
  resetStatistics(operation?: string): void {
    if (operation) {
      this.statistics.set(operation, this.getDefaultStatistics(operation));
    } else {
      this.statistics.clear();
    }
  }

  /**
   * 获取内存使用情况
   */
  private getMemoryUsage(): { used: number; total: number; percentage: number } | undefined {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      const used = memory.heapUsed;
      const total = memory.heapTotal;
      const percentage = (used / total) * 100;
      
      return { used, total, percentage };
    }
    
    // 浏览器环境
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      const used = memory.usedJSHeapSize;
      const total = memory.totalJSHeapSize;
      const percentage = (used / total) * 100;
      
      return { used, total, percentage };
    }
    
    return undefined;
  }

  /**
   * 更新统计信息
   */
  private updateStatistics(metricsEvent: PerformanceMetricsEvent): void {
    const { operation, duration, success } = metricsEvent;
    let stats = this.statistics.get(operation);
    
    if (!stats) {
      stats = this.getDefaultStatistics(operation);
      this.statistics.set(operation, stats);
    }
    
    // 更新计数
    stats.count++;
    
    // 更新持续时间统计
    stats.averageDuration = (stats.averageDuration * (stats.count - 1) + duration) / stats.count;
    stats.minDuration = Math.min(stats.minDuration, duration);
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    
    // 更新成功率
    if (success) {
      stats.successRate = ((stats.successRate * (stats.count - 1)) + 1) / stats.count;
    } else {
      stats.successRate = (stats.successRate * (stats.count - 1)) / stats.count;
    }
    
    // 更新最后执行时间
    stats.lastExecutionTime = new Date();
  }

  /**
   * 检查性能阈值
   */
  private checkThresholds(metricsEvent: PerformanceMetricsEvent): void {
    const { operation, duration, memoryUsage } = metricsEvent;
    const threshold = this.thresholds.get(operation) || this.defaultThreshold;
    
    // 检查执行时间阈值
    if (duration > threshold.criticalThreshold) {
      const stats = this.statistics.get(operation);
      if (stats) {
        stats.criticalCount++;
      }
      this.globalEventBus.emit('performance.warning', {
        operation,
        metric: 'duration',
        value: duration,
        threshold: threshold.criticalThreshold,
        timestamp: new Date()
      });
    } else if (duration > threshold.warningThreshold) {
      const stats = this.statistics.get(operation);
      if (stats) {
        stats.warningCount++;
      }
      this.globalEventBus.emit('performance.warning', {
        operation,
        metric: 'duration',
        value: duration,
        threshold: threshold.warningThreshold,
        timestamp: new Date()
      });
    }
    
    // 检查内存使用阈值
    if (memoryUsage && threshold.memoryCriticalThreshold && memoryUsage.percentage > threshold.memoryCriticalThreshold) {
      this.globalEventBus.emit('performance.warning', {
        operation,
        metric: 'memory',
        value: memoryUsage.percentage,
        threshold: threshold.memoryCriticalThreshold,
        timestamp: new Date()
      });
    } else if (memoryUsage && threshold.memoryWarningThreshold && memoryUsage.percentage > threshold.memoryWarningThreshold) {
      this.globalEventBus.emit('performance.warning', {
        operation,
        metric: 'memory',
        value: memoryUsage.percentage,
        threshold: threshold.memoryWarningThreshold,
        timestamp: new Date()
      });
    }
  }

  /**
   * 获取默认统计信息
   */
  private getDefaultStatistics(operation: string): PerformanceStatistics {
    return {
      operation,
      count: 0,
      averageDuration: 0,
      minDuration: Number.MAX_VALUE,
      maxDuration: 0,
      successRate: 0,
      warningCount: 0,
      criticalCount: 0
    };
  }
}

/**
 * 全局性能监控实例
 */
export const globalEventPerformanceMonitor = new EventPerformanceMonitor();