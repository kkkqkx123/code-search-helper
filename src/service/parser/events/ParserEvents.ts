/**
 * Parser模块事件类型定义
 * 定义所有Parser相关的事件名称和数据结构
 */

export enum ParserEvents {
  // 文件检测事件
  FILE_DETECTED = 'file:detected',
  FILE_DETECTION_STARTED = 'file:detection:started',
  FILE_DETECTION_COMPLETED = 'file:detection:completed',
  FILE_DETECTION_FAILED = 'file:detection:failed',

  // 策略选择事件
  STRATEGY_SELECTED = 'strategy:selected',
  STRATEGY_SELECTION_STARTED = 'strategy:selection:started',
  STRATEGY_SELECTION_COMPLETED = 'strategy:selection:completed',
  STRATEGY_SELECTION_FAILED = 'strategy:selection:failed',

  // 处理执行事件
  PROCESSING_STARTED = 'processing:started',
  PROCESSING_COMPLETED = 'processing:completed',
  PROCESSING_FAILED = 'processing:failed',
  PROCESSING_PROGRESS = 'processing:progress',

  // 错误处理事件
  ERROR_OCCURRED = 'error:occurred',
  ERROR_THRESHOLD_REACHED = 'error:threshold:reached',
  ERROR_THRESHOLD_RESET = 'error:threshold:reset',

  // 内存管理事件
  MEMORY_PRESSURE = 'memory:pressure',
  MEMORY_LIMIT_EXCEEDED = 'memory:limit:exceeded',
  MEMORY_CLEANUP_COMPLETED = 'memory:cleanup:completed',
  MEMORY_CLEANUP_FAILED = 'memory:cleanup:failed',

  // 降级处理事件
  FALLBACK_TRIGGERED = 'fallback:triggered',
  FALLBACK_COMPLETED = 'fallback:completed',
  FALLBACK_FAILED = 'fallback:failed',

  // 缓存事件
  CACHE_HIT = 'cache:hit',
  CACHE_MISS = 'cache:miss',
  CACHE_CLEARED = 'cache:cleared',

  // 配置更新事件
  CONFIG_UPDATED = 'config:updated',
  CONFIG_RELOADED = 'config:reloaded',

  // 系统事件
  SYSTEM_INITIALIZED = 'system:initialized',
  SYSTEM_SHUTDOWN = 'system:shutdown',
  HEALTH_CHECK_COMPLETED = 'health:check:completed'
}

// 事件数据接口定义
export interface FileDetectedEvent {
  filePath: string;
  result: any;
  duration: number;
}

export interface FileDetectionFailedEvent {
  filePath: string;
  error: Error;
  duration: number;
}

export interface StrategySelectedEvent {
  filePath: string;
  strategy: string;
  detection: any;
}

export interface ProcessingCompletedEvent {
  filePath: string;
  result: any;
  duration: number;
  strategy: string;
}

export interface ProcessingFailedEvent {
  filePath: string;
  error: Error;
  duration: number;
  strategy?: string;
}

export interface ErrorOccurredEvent {
  error: Error;
  context?: string;
  filePath?: string;
  timestamp: number;
}

export interface MemoryPressureEvent {
  usage: number;
  limit: number;
  timestamp: number;
}

export interface FallbackTriggeredEvent {
  filePath: string;
  reason: string;
  originalStrategy?: string;
  fallbackStrategy: string;
}

export interface ConfigUpdatedEvent {
  changes: string[];
  timestamp: number;
}

export interface HealthCheckCompletedEvent {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: any;
  duration: number;
}