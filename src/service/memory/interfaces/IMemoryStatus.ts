/**
 * 统一的内存状态接口
 * 用于提供一致的内存监控视图
 */
export interface IMemoryStatus {
  /** 堆内存使用量（字节） */
  heapUsed: number;
  /** 堆内存总量（字节） */
  heapTotal: number;
  /** 堆内存使用百分比（0-1） */
  heapUsedPercent: number;
  /** RSS内存使用量（字节） */
  rss: number;
  /** 外部内存使用量（字节） */
  external: number;
  /** 数组缓冲区内存使用量（字节） */
  arrayBuffers: number;
  /** 是否达到警告阈值 */
  isWarning: boolean;
  /** 是否达到严重阈值 */
  isCritical: boolean;
  /** 是否达到紧急阈值 */
  isEmergency: boolean;
  /** 内存使用趋势 */
  trend: 'increasing' | 'decreasing' | 'stable';
  /** 平均内存使用量（字节） */
  averageUsage: number;
  /** 内存限制（字节，如果适用） */
  memoryLimit?: number;
  /** 相对于限制的使用百分比（如果有限制） */
  limitUsagePercent?: number;
  /** 时间戳 */
  timestamp: Date;
  
  // 新增监控指标
  /** RSS内存使用百分比（相对于堆内存总量） */
  rssPercent: number;
  /** 外部内存使用百分比（相对于堆内存总量） */
  externalPercent: number;
  /** 数组缓冲区内存使用百分比（相对于堆内存总量） */
  arrayBuffersPercent: number;
  /** 内存使用增长率（相对于上次检查） */
  growthRate: number;
  /** 预计达到限制的时间（秒，如果有限制且趋势为增长） */
  timeToLimit?: number;
  /** 内存健康评分（0-100，100为最佳） */
  healthScore: number;
  /** 内存压力等级 */
  pressureLevel: 'low' | 'moderate' | 'high' | 'critical';
  /** 垃圾回收效率（0-1，基于历史数据） */
  gcEfficiency?: number;
  /** 内存碎片化程度（0-1，基于堆使用情况） */
  fragmentationLevel: number;
}

/**
 * 内存监控配置接口
 */
export interface IMemoryMonitorConfig {
  /** 是否启用监控 */
  enabled: boolean;
  /** 警告阈值（0-1） */
  warningThreshold: number;
  /** 严重阈值（0-1） */
  criticalThreshold: number;
  /** 紧急阈值（0-1） */
  emergencyThreshold: number;
  /** 检查间隔（毫秒） */
  checkInterval: number;
  /** 清理冷却时间（毫秒） */
  cleanupCooldown: number;
  /** 历史记录最大数量 */
  maxHistorySize: number;
}

/**
 * 内存清理级别
 */
export type MemoryCleanupLevel = 'lightweight' | 'deep' | 'emergency';

/**
 * 内存监控事件类型
 */
export interface IMemoryMonitorEvent {
  type: 'warning' | 'critical' | 'emergency' | 'cleanup' | 'pressure';
  timestamp: Date;
  memoryStatus: IMemoryStatus;
  details?: Record<string, any>;
}

/**
 * 内存监控事件监听器
 */
export type IMemoryMonitorEventListener = (event: IMemoryMonitorEvent) => void;

/**
 * 内存历史记录项
 */
export interface IMemoryHistoryItem {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

/**
 * 内存统计信息
 */
export interface IMemoryStats {
  /** 当前内存状态 */
  current: IMemoryStatus;
  /** 历史记录 */
  history: IMemoryHistoryItem[];
  /** 峰值内存使用 */
  peak: {
    heapUsed: number;
    heapUsedPercent: number;
    timestamp: Date;
  };
  /** 平均内存使用 */
  average: {
    heapUsed: number;
    heapUsedPercent: number;
  };
  /** 清理统计 */
  cleanup: {
    totalCleanups: number;
    lightweightCleanups: number;
    deepCleanups: number;
    emergencyCleanups: number;
    lastCleanupTime?: Date;
  };
}