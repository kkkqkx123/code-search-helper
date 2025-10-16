/**
 * UnifiedGuardCoordinator 接口定义
 * 统一的保护机制协调器，合并 MemoryGuard 和 ProcessingGuard 的功能
 */

// 内存状态接口
export interface MemoryStatus {
  isWithinLimit: boolean;
  usagePercent: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

// 内存统计接口
export interface MemoryStats {
  current: NodeJS.MemoryUsage;
  limit: number;
  usagePercent: number;
  isWithinLimit: boolean;
  trend: 'increasing' | 'decreasing' | 'stable';
  averageUsage: number;
}

// 内存历史记录
export interface MemoryHistory {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
}

// 文件处理结果
export interface FileProcessingResult {
  chunks: any[];
  language: string;
  processingStrategy: string;
  fallbackReason?: string;
}

// 保护状态
export interface GuardStatus {
  errorThreshold: {
    errorCount: number;
    maxErrors: number;
    shouldUseFallback: boolean;
    resetInterval: number;
  };
  memoryGuard: MemoryStats;
  isInitialized: boolean;
  isMonitoring: boolean;
}

/**
 * 统一的保护机制协调器接口
 */
export interface IUnifiedGuardCoordinator {
  // 生命周期管理
  initialize(): void;
  destroy(): void;
  reset(): void;
  
  // 内存保护功能
  startMonitoring(): void;
  stopMonitoring(): void;
  checkMemoryUsage(): MemoryStatus;
  forceCleanup(): Promise<void>;
  gracefulDegradation(): void;
  getMemoryStats(): MemoryStats;
  getMemoryHistory(): MemoryHistory[];
  clearHistory(): void;
  setMemoryLimit(limitMB: number): void;
  forceGarbageCollection(): void;
  
  // 错误保护功能
  shouldUseFallback(): boolean;
  recordError(error: Error, context?: string): void;
  
  // 文件处理协调
  processFile(filePath: string, content: string): Promise<FileProcessingResult>;
  
  // 状态查询
  getStatus(): GuardStatus;
}