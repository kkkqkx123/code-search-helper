/**
 * 前端事件管理器
 * 
 * 提供类型安全的事件处理机制，支持 DOM 事件与自定义事件的统一管理。
 * 
 * @template TEvents - 事件类型映射接口，将事件类型映射到对应的事件数据类型
 * 
 * @example
 * // 定义前端事件类型映射
 * interface FrontendEvents {
 *   'search.started': { query: string; projectId: string };
 *   'search.completed': { results: any[]; totalCount: number };
 *   'search.failed': { error: string; query: string };
 *   'ui.page.changed': { page: number; from: string };
 * }
 * 
 * // 创建类型安全的事件管理器
 * const eventManager = new EventManager<FrontendEvents>();
 * 
 * // 添加事件监听器
 * eventManager.addEventListener('search.started', (data) => {
 *   console.log(`Search started for query: ${data.query}`);
 * });
 * 
 * // 触发事件
 * eventManager.emit('search.started', {
 *   query: 'function',
 *   projectId: 'project-123'
 * });
 */
export class EventManager<TEvents extends Record<string, any> = Record<string, any>> {
  private eventListeners: Map<keyof TEvents, Array<(data: TEvents[keyof TEvents]) => void>> = new Map();
  private domEventListeners: Map<Element, Map<string, EventListener>> = new Map();

  /**
   * 添加自定义事件监听器
   * 
   * @param eventType - 事件类型
   * @param listener - 事件监听器
   */
  addEventListener<K extends keyof TEvents>(
    eventType: K,
    listener: (data: TEvents[K]) => void
  ): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * 移除自定义事件监听器
   * 
   * @param eventType - 事件类型
   * @param listener - 要移除的事件监听器
   */
  removeEventListener<K extends keyof TEvents>(
    eventType: K,
    listener: (data: TEvents[K]) => void
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
      
      // 如果没有监听器了，删除该事件类型的条目
      if (listeners.length === 0) {
        this.eventListeners.delete(eventType);
      }
    }
  }

  /**
   * 触发自定义事件
   * 
   * @param eventType - 事件类型
   * @param data - 事件数据
   */
  emit<K extends keyof TEvents>(eventType: K, data: TEvents[K]): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      // 创建监听器副本，避免在迭代过程中修改原数组
      const listenersCopy = [...listeners];
      listenersCopy.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${String(eventType)}:`, error);
        }
      });
    }
  }

  /**
   * 添加 DOM 事件监听器
   * 
   * @param element - DOM 元素
   * @param eventType - DOM 事件类型
   * @param listener - 事件监听器
   * @param options - 事件监听器选项
   */
  addDomEventListener(
    element: Element,
    eventType: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    element.addEventListener(eventType, listener, options);
    
    // 记录 DOM 事件监听器，以便后续清理
    if (!this.domEventListeners.has(element)) {
      this.domEventListeners.set(element, new Map());
    }
    this.domEventListeners.get(element)!.set(eventType, listener);
  }

  /**
   * 移除 DOM 事件监听器
   * 
   * @param element - DOM 元素
   * @param eventType - DOM 事件类型
   * @param listener - 事件监听器
   * @param options - 事件监听器选项
   */
  removeDomEventListener(
    element: Element,
    eventType: string,
    listener: EventListener,
    options?: boolean | EventListenerOptions
  ): void {
    element.removeEventListener(eventType, listener, options);
    
    // 从记录中移除
    const elementListeners = this.domEventListeners.get(element);
    if (elementListeners) {
      elementListeners.delete(eventType);
      if (elementListeners.size === 0) {
        this.domEventListeners.delete(element);
      }
    }
  }

  /**
   * 添加一次性 DOM 事件监听器
   * 
   * @param element - DOM 元素
   * @param eventType - DOM 事件类型
   * @param listener - 事件监听器
   * @param options - 事件监听器选项
   */
  addDomEventListenerOnce(
    element: Element,
    eventType: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    const onceListener: EventListener = (event) => {
      listener(event);
      this.removeDomEventListener(element, eventType, onceListener, options);
    };
    
    this.addDomEventListener(element, eventType, onceListener, options);
  }

  /**
   * 委托 DOM 事件处理
   * 
   * @param parentElement - 父元素
   * @param selector - 子元素选择器
   * @param eventType - 事件类型
   * @param listener - 事件监听器
   * @param options - 事件监听器选项
   */
  delegateDomEvent(
    parentElement: Element,
    selector: string,
    eventType: string,
    listener: (event: Event, targetElement: Element) => void,
    options?: boolean | AddEventListenerOptions
  ): void {
    const delegateListener: EventListener = (event) => {
      const targetElement = (event.target as Element).closest(selector);
      if (targetElement && parentElement.contains(targetElement)) {
        listener(event, targetElement);
      }
    };
    
    this.addDomEventListener(parentElement, eventType, delegateListener, options);
  }

  /**
   * 获取特定事件类型的监听器数量
   * 
   * @param eventType - 事件类型
   * @returns 监听器数量
   */
  listenerCount<K extends keyof TEvents>(eventType: K): number {
    return this.eventListeners.get(eventType)?.length || 0;
  }

  /**
   * 获取所有自定义事件类型
   * 
   * @returns 事件类型数组
   */
  getEventTypes(): Array<keyof TEvents> {
    return Array.from(this.eventListeners.keys());
  }

  /**
   * 清除所有自定义事件监听器
   */
  clearAllCustomListeners(): void {
    this.eventListeners.clear();
  }

  /**
   * 清除所有 DOM 事件监听器
   */
  clearAllDomListeners(): void {
    for (const [element, listeners] of this.domEventListeners.entries()) {
      for (const [eventType, listener] of listeners.entries()) {
        element.removeEventListener(eventType, listener);
      }
    }
    this.domEventListeners.clear();
  }

  /**
   * 清除所有事件监听器
   */
  clearAllListeners(): void {
    this.clearAllCustomListeners();
    this.clearAllDomListeners();
  }

  /**
   * 检查是否有特定事件类型的监听器
   * 
   * @param eventType - 事件类型
   * @returns 是否有监听器
   */
  hasListeners<K extends keyof TEvents>(eventType: K): boolean {
    return this.eventListeners.has(eventType) && this.eventListeners.get(eventType)!.length > 0;
  }

  /**
   * 获取特定事件类型的所有监听器
   * 
   * @param eventType - 事件类型
   * @returns 监听器数组
   */
  getListeners<K extends keyof TEvents>(eventType: K): Array<(data: TEvents[K]) => void> {
    return this.eventListeners.get(eventType) || [];
  }
}

/**
 * 常见前端事件类型定义
 */
export interface FrontendEvents {
  // 搜索相关事件
  'search.started': {
    query: string;
    projectId: string;
    filters?: Record<string, any>;
  };
  'search.completed': {
    query: string;
    results: any[];
    totalCount: number;
    executionTime: number;
  };
  'search.failed': {
    query: string;
    error: string;
  };
  'search.pagination.changed': {
    page: number;
    pageSize: number;
    query: string;
  };
  
  // UI 相关事件
  'ui.page.changed': {
    page: string;
    from: string;
  };
  'ui.modal.opened': {
    modalId: string;
    data?: any;
  };
  'ui.modal.closed': {
    modalId: string;
  };
  'ui.theme.changed': {
    theme: 'light' | 'dark';
  };
  
  // 项目相关事件
  'project.selected': {
    projectId: string;
    projectName: string;
  };
  'project.loaded': {
    projectId: string;
    fileCount: number;
  };
  'project.indexing.started': {
    projectId: string;
  };
  'project.indexing.completed': {
    projectId: string;
    fileCount: number;
    duration: number;
  };
  
  // 网络相关事件
  'network.request.started': {
    url: string;
    method: string;
  };
  'network.request.completed': {
    url: string;
    method: string;
    status: number;
    duration: number;
  };
  'network.request.failed': {
    url: string;
    method: string;
    error: string;
  };
  
  // 错误相关事件
  'error.occurred': {
    type: string;
    message: string;
    stack?: string;
    context?: Record<string, any>;
  };
}

/**
 * 全局前端事件管理器实例
 */
export const globalEventManager = new EventManager<FrontendEvents>();

/**
 * 事件类型守卫函数
 */
export const isSearchStartedEvent = (event: any): event is FrontendEvents['search.started'] => {
  return event && typeof event.query === 'string' && typeof event.projectId === 'string';
};

export const isSearchCompletedEvent = (event: any): event is FrontendEvents['search.completed'] => {
  return event && 
    typeof event.query === 'string' && 
    Array.isArray(event.results) && 
    typeof event.totalCount === 'number' &&
    typeof event.executionTime === 'number';
};

export const isSearchFailedEvent = (event: any): event is FrontendEvents['search.failed'] => {
  return event && typeof event.query === 'string' && typeof event.error === 'string';
};

export const isProjectSelectedEvent = (event: any): event is FrontendEvents['project.selected'] => {
  return event && typeof event.projectId === 'string' && typeof event.projectName === 'string';
};

export const isErrorOccurredEvent = (event: any): event is FrontendEvents['error.occurred'] => {
  return event && 
    typeof event.type === 'string' && 
    typeof event.message === 'string';
};