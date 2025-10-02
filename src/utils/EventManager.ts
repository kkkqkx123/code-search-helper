import { EventListener } from '../types';

/**
 * 通用事件管理器
 * 
 * 这是一个具体的事件系统实现示例，展示了如何使用增强的 EventListener 类型。
 * 它支持泛型事件数据类型，提供了类型安全的事件处理机制。
 */
export class EventManager {
  private eventListeners: Map<string, EventListener[]> = new Map();

  /**
   * 添加事件监听器
   * 
   * @template T - 事件数据的类型
   * @param eventType - 事件类型
   * @param listener - 事件监听器
   */
  addEventListener<T = any>(eventType: string, listener: EventListener<T>): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * 移除事件监听器
   * 
   * @template T - 事件数据的类型
   * @param eventType - 事件类型
   * @param listener - 要移除的事件监听器
   */
  removeEventListener<T = any>(eventType: string, listener: EventListener<T>): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener as EventListener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   * 
   * @template T - 事件数据的类型
   * @param eventType - 事件类型
   * @param data - 事件数据
   */
  emit<T = any>(eventType: string, data: T): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error);
        }
      });
    }
  }

  /**
   * 获取特定事件类型的监听器数量
   * 
   * @param eventType - 事件类型
   * @returns 监听器数量
   */
  listenerCount(eventType: string): number {
    return this.eventListeners.get(eventType)?.length || 0;
  }

  /**
   * 清除所有事件监听器
   */
  clearAllListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * 清除特定事件类型的监听器
   * 
   * @param eventType - 事件类型
   */
  clearListeners(eventType: string): void {
    this.eventListeners.delete(eventType);
  }
}

// 导出一个全局事件管理器实例
export const globalEventManager = new EventManager();

// 示例：如何使用泛型增强的 EventListener
/*
interface UserLoginEventData {
  userId: string;
  username: string;
  timestamp: Date;
}

const userLoginListener: EventListener<UserLoginEventData> = (data) => {
  console.log(`User ${data.username} logged in at ${data.timestamp}`);
};

globalEventManager.addEventListener<UserLoginEventData>('user-login', userLoginListener);

// 触发事件时，TypeScript 会确保传递的数据符合 UserLoginEventData 类型
globalEventManager.emit<UserLoginEventData>('user-login', {
  userId: '123',
  username: 'john_doe',
  timestamp: new Date()
});
*/