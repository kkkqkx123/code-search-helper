/**
 * Process事件管理器
 * 用于统一管理process事件监听器，避免重复添加导致的内存泄漏警告
 */

export class ProcessEventManager {
  private static instance: ProcessEventManager;
  private registeredListeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private maxListeners: number = 10;

  private constructor() {
    // 增加process的最大监听器数量
    process.setMaxListeners(this.maxListeners);
  }

  public static getInstance(): ProcessEventManager {
    if (!ProcessEventManager.instance) {
      ProcessEventManager.instance = new ProcessEventManager();
    }
    return ProcessEventManager.instance;
  }

  /**
   * 注册事件监听器，避免重复注册
   */
  public addListener(event: string, listener: (...args: any[]) => void): void {
    if (!this.registeredListeners.has(event)) {
      this.registeredListeners.set(event, new Set());
    }

    const listeners = this.registeredListeners.get(event)!;
    
    // 检查是否已经注册过相同的监听器
    if (!listeners.has(listener)) {
      process.on(event, listener);
      listeners.add(listener);
    }
  }

  /**
   * 移除事件监听器
   */
  public removeListener(event: string, listener: (...args: any[]) => void): void {
    const listeners = this.registeredListeners.get(event);
    if (listeners) {
      process.removeListener(event, listener);
      listeners.delete(listener);
    }
  }

  /**
   * 移除所有监听器
   */
  public removeAllListeners(event?: string): void {
    if (event) {
      const listeners = this.registeredListeners.get(event);
      if (listeners) {
        listeners.forEach(listener => {
          process.removeListener(event, listener);
        });
        listeners.clear();
      }
    } else {
      // 移除所有事件的监听器
      this.registeredListeners.forEach((listeners, eventName) => {
        listeners.forEach(listener => {
          process.removeListener(eventName, listener);
        });
      });
      this.registeredListeners.clear();
    }
  }

  /**
   * 设置最大监听器数量
   */
  public setMaxListeners(max: number): void {
    this.maxListeners = max;
    process.setMaxListeners(max);
  }

  /**
   * 获取已注册的监听器数量
   */
  public getListenerCount(event: string): number {
    const listeners = this.registeredListeners.get(event);
    return listeners ? listeners.size : 0;
  }

  /**
   * 检查监听器是否已注册
   */
  public hasListener(event: string, listener: (...args: any[]) => void): boolean {
    const listeners = this.registeredListeners.get(event);
    return listeners ? listeners.has(listener) : false;
  }
}