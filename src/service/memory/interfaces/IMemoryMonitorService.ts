import { IMemoryStatus, IMemoryMonitorConfig, MemoryCleanupLevel, IMemoryMonitorEventListener, IMemoryStats, IMemoryHistoryItem } from './IMemoryStatus';

/**
 * 统一的内存监控服务接口
 * 整合所有内存监控功能，提供一致的API
 */
export interface IMemoryMonitorService {
  /**
   * 启动内存监控
   */
  startMonitoring(): void;

  /**
   * 停止内存监控
   */
  stopMonitoring(): void;

  /**
   * 获取当前内存状态
   */
  getMemoryStatus(): IMemoryStatus;

  /**
   * 获取内存统计信息
   */
  getMemoryStats(): IMemoryStats;

  /**
   * 获取内存使用历史
   */
  getMemoryHistory(): IMemoryHistoryItem[];

  /**
   * 清空内存使用历史
   */
  clearHistory(): void;

  /**
   * 手动触发内存清理
   */
  triggerCleanup(level?: MemoryCleanupLevel): void;

  /**
   * 检查内存使用情况
   */
  checkMemoryUsage(): {
    isWithinLimit: boolean;
    usagePercent: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
  };

  /**
   * 更新内存监控配置
   */
  updateConfig(config: Partial<IMemoryMonitorConfig>): void;

  /**
   * 获取当前配置
   */
  getConfig(): IMemoryMonitorConfig;

  /**
   * 添加内存事件监听器
   */
  addEventListener(event: string, listener: IMemoryMonitorEventListener): void;

  /**
   * 移除内存事件监听器
   */
  removeEventListener(event: string, listener: IMemoryMonitorEventListener): void;

  /**
   * 强制垃圾回收
   */
  forceGarbageCollection(): void;

  /**
   * 优化内存使用
   */
  optimizeMemory(): void;

  /**
   * 设置内存限制（适用于MemoryGuard场景）
   */
  setMemoryLimit?(limitMB: number): void;

  /**
   * 获取内存限制（适用于MemoryGuard场景）
   */
  getMemoryLimit?(): number | undefined;

  /**
   * 检查是否在限制范围内（适用于MemoryGuard场景）
   */
  isWithinLimit?(): boolean;

  /**
   * 销毁服务，清理所有资源
   */
  destroy(): void;
}