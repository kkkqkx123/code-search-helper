import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types';
import { IEventBus } from '../../interfaces/IEventBus';

/**
 * 事件总线实现
 * 提供轻量级的发布-订阅模式事件系统
 */
@injectable()
export class EventBus implements IEventBus {
  private listeners = new Map<string, Set<(data: any) => void>>();
  private onceListeners = new Map<string, Set<(data: any) => void>>();
  private logger?: LoggerService;

  constructor(@inject(TYPES.LoggerService) logger?: LoggerService) {
    this.logger = logger;
    this.logger?.debug('EventBus initialized');
  }

  /**
   * 发布事件
   * @param event 事件名称
   * @param data 事件数据
   */
  emit(event: string, data: any): void {
    this.logger?.debug(`Emitting event: ${event}`, { data });

    // 处理普通监听器
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.logger?.error(`Error in event handler for '${event}': ${error}`);
        }
      });
    }

    // 处理一次性监听器
    const onceHandlers = this.onceListeners.get(event);
    if (onceHandlers) {
      const handlersToExecute = new Set(onceHandlers);
      onceHandlers.clear(); // 清空一次性监听器
      
      handlersToExecute.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.logger?.error(`Error in once event handler for '${event}': ${error}`);
        }
      });
    }
  }

  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  on(event: string, handler: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    this.logger?.debug(`Added listener for event: ${event}`);
  }

  /**
   * 取消订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  off(event: string, handler: (data: any) => void): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
      this.logger?.debug(`Removed listener for event: ${event}`);
    }

    const onceHandlers = this.onceListeners.get(event);
    if (onceHandlers) {
      onceHandlers.delete(handler);
      if (onceHandlers.size === 0) {
        this.onceListeners.delete(event);
      }
    }
  }

  /**
   * 一次性订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  once(event: string, handler: (data: any) => void): void {
    if (!this.onceListeners.has(event)) {
      this.onceListeners.set(event, new Set());
    }
    this.onceListeners.get(event)!.add(handler);
    this.logger?.debug(`Added once listener for event: ${event}`);
  }

  /**
   * 移除所有事件监听器
   * @param event 可选的事件名称，如果不提供则移除所有事件
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
      this.onceListeners.delete(event);
      this.logger?.debug(`Removed all listeners for event: ${event}`);
    } else {
      this.listeners.clear();
      this.onceListeners.clear();
      this.logger?.debug('Removed all event listeners');
    }
  }

  /**
   * 获取事件监听器数量
   * @param event 事件名称
   * @returns 监听器数量
   */
  listenerCount(event: string): number {
    const handlers = this.listeners.get(event);
    const onceHandlers = this.onceListeners.get(event);
    
    let count = 0;
    if (handlers) count += handlers.size;
    if (onceHandlers) count += onceHandlers.size;
    
    return count;
  }

  /**
   * 获取所有事件名称
   * @returns 事件名称列表
   */
  eventNames(): string[] {
    const events = new Set<string>();
    
    this.listeners.forEach((_, event) => events.add(event));
    this.onceListeners.forEach((_, event) => events.add(event));
    
    return Array.from(events);
  }

  /**
   * 获取事件总线统计信息
   * @returns 统计信息
   */
  getStats(): {
    totalEvents: number;
    totalListeners: number;
    eventDetails: Array<{ event: string; listeners: number; onceListeners: number }>;
  } {
    const eventDetails: Array<{ event: string; listeners: number; onceListeners: number }> = [];
    let totalListeners = 0;

    this.eventNames().forEach(event => {
      const listeners = this.listeners.get(event)?.size || 0;
      const onceListeners = this.onceListeners.get(event)?.size || 0;
      totalListeners += listeners + onceListeners;
      
      eventDetails.push({
        event,
        listeners,
        onceListeners
      });
    });

    return {
      totalEvents: this.eventNames().length,
      totalListeners,
      eventDetails
    };
  }
}