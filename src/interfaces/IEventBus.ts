/**
 * 事件总线接口
 * 定义事件发布和订阅的抽象接口
 */
export interface IEventBus {
  /**
   * 发布事件
   * @param event 事件名称
   * @param data 事件数据
   */
  emit(event: string, data: any): void;

  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  on(event: string, handler: (data: any) => void): void;

  /**
   * 取消订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  off(event: string, handler: (data: any) => void): void;

  /**
   * 一次性订阅事件
   * @param event 事件名称
   * @param handler 事件处理函数
   */
  once(event: string, handler: (data: any) => void): void;

  /**
   * 移除所有事件监听器
   * @param event 可选的事件名称，如果不提供则移除所有事件
   */
  removeAllListeners(event?: string): void;

  /**
   * 获取事件监听器数量
   * @param event 事件名称
   * @returns 监听器数量
   */
  listenerCount(event: string): number;

  /**
   * 获取所有事件名称
   * @returns 事件名称列表
   */
  eventNames(): string[];
}