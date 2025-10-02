import { injectable } from 'inversify';
import { EventManager } from './EventManager';
import { EventBridge } from '../database/common/EventBridge';
import { 
  DatabaseEventManager, 
  DatabaseEvent, 
  DatabaseEventListener,
  DatabaseEventType,
  QdrantEventType,
  NebulaEventType
} from '../database/common/DatabaseEventTypes';
import { DatabaseEventInterfaces } from '../database/common/DatabaseEventInterfaces';

/**
 * 全局事件总线接口
 * 
 * 定义全局事件总线应提供的方法和属性
 */
export interface IGlobalEventBus<TEvents extends Record<string, any> = Record<string, any>> {
  /**
   * 添加事件监听器
   */
  on<K extends keyof TEvents>(eventType: K, listener: (data: TEvents[K]) => void): void;
  
  /**
   * 移除事件监听器
   */
  off<K extends keyof TEvents>(eventType: K, listener: (data: TEvents[K]) => void): void;
  
  /**
   * 触发事件
   */
  emit<K extends keyof TEvents>(eventType: K, data: TEvents[K]): void;
  
  /**
   * 添加数据库事件监听器
   */
  onDatabaseEvent(
    eventType: DatabaseEventType | QdrantEventType | NebulaEventType, 
    listener: DatabaseEventListener<DatabaseEvent>
  ): void;
  
  /**
   * 移除数据库事件监听器
   */
  offDatabaseEvent(
    eventType: DatabaseEventType | QdrantEventType | NebulaEventType, 
    listener: DatabaseEventListener<DatabaseEvent>
  ): void;
  
  /**
   * 触发数据库事件
   */
  emitDatabaseEvent(event: DatabaseEvent): void;
  
  /**
   * 获取通用事件管理器
   */
  getEventManager(): EventManager<TEvents>;
  
  /**
   * 获取数据库事件管理器
   */
  getDatabaseEventManager(): DatabaseEventManager<TEvents>;
  
  /**
   * 获取事件桥接器
   */
  getEventBridge(): EventBridge<TEvents>;
  
  /**
   * 清除所有事件监听器
   */
  clearAllListeners(): void;
}

/**
 * 全局事件类型定义
 * 包含系统级别的所有事件类型
 */
export interface GlobalEvents {
  // 应用生命周期事件
  'app.started': {
    version: string;
    environment: 'development' | 'production' | 'test';
    startTime: Date;
  };
  'app.shutdown': {
    reason: string;
    timestamp: Date;
  };
  'app.error': {
    error: Error;
    context: Record<string, any>;
    timestamp: Date;
  };
  
  // 数据库相关事件
  'database.connected': {
    type: 'qdrant' | 'nebula';
    connectionString: string;
    timestamp: Date;
  };
  'database.disconnected': {
    type: 'qdrant' | 'nebula';
    reason: string;
    timestamp: Date;
  };
  'database.error': {
    type: 'qdrant' | 'nebula';
    error: Error;
    operation: string;
    timestamp: Date;
  };
  
  // 项目相关事件
  'project.loaded': {
    projectId: string;
    projectName: string;
    fileCount: number;
    loadTime: number;
    timestamp: Date;
  };
  'project.indexed': {
    projectId: string;
    fileCount: number;
    indexTime: number;
    success: boolean;
    timestamp: Date;
  };
  'project.unloaded': {
    projectId: string;
    reason: string;
    timestamp: Date;
  };
  
  // 搜索相关事件
  'search.started': {
    query: string;
    projectId?: string;
    filters: Record<string, any>;
    timestamp: Date;
  };
  'search.completed': {
    query: string;
    results: any[];
    totalCount: number;
    executionTime: number;
    timestamp: Date;
  };
  'search.failed': {
    query: string;
    error: string;
    timestamp: Date;
  };
  
  // 性能监控事件
  'performance.metric': {
    operation: string;
    duration: number;
    success: boolean;
    memoryUsage?: number;
    timestamp: Date;
  };
  'performance.warning': {
    operation: string;
    metric: string;
    value: number;
    threshold: number;
    timestamp: Date;
  };
  
  // 用户界面事件
  'ui.page.changed': {
    from: string;
    to: string;
    timestamp: Date;
  };
  'ui.modal.opened': {
    modalId: string;
    data?: any;
    timestamp: Date;
  };
  'ui.modal.closed': {
    modalId: string;
    timestamp: Date;
  };
  
  // 配置相关事件
  'config.changed': {
    key: string;
    oldValue: any;
    newValue: any;
    timestamp: Date;
  };
  'config.reloaded': {
    timestamp: Date;
  };
  
  // 网络相关事件
  'network.request': {
    url: string;
    method: string;
    status: number;
    duration: number;
    timestamp: Date;
  };
  'network.error': {
    url: string;
    method: string;
    error: string;
    timestamp: Date;
  };
}

/**
 * 全局事件总线实现
 * 
 * 提供项目级别的全局事件通信机制，整合通用事件管理器和数据库事件管理器。
 * 
 * @template TEvents - 事件类型映射接口
 * 
 * @example
 * // 使用全局事件总线
 * const globalEventBus = new GlobalEventBus<GlobalEvents>();
 * 
 * // 监听应用启动事件
 * globalEventBus.on('app.started', (data) => {
 *   console.log(`Application started at ${data.startTime}`);
 * });
 * 
 * // 触发应用启动事件
 * globalEventBus.emit('app.started', {
 *   version: '1.0.0',
 *   environment: 'development',
 *   startTime: new Date()
 * });
 */
@injectable()
export class GlobalEventBus<TEvents extends Record<string, any> = GlobalEvents> implements IGlobalEventBus<TEvents> {
  private eventManager: EventManager<TEvents>;
  private databaseEventManager: DatabaseEventManager<TEvents>;
  private eventBridge: EventBridge<TEvents>;
  private static instance: GlobalEventBus<any> | null = null;

  constructor(
    eventManager?: EventManager<TEvents>,
    databaseEventManager?: DatabaseEventManager<TEvents>,
    eventBridge?: EventBridge<TEvents>
  ) {
    this.eventManager = eventManager || new EventManager<TEvents>();
    this.databaseEventManager = databaseEventManager || new DatabaseEventManager<TEvents>();
    this.eventBridge = eventBridge || new EventBridge<TEvents>(this.databaseEventManager, this.eventManager);
    
    // 启动事件桥接
    this.eventBridge.startBridging();
    
    // 监听数据库错误事件，转换为全局错误事件
    this.databaseEventManager.addEventListener(DatabaseEventType.ERROR_OCCURRED, (event) => {
      this.emit('app.error' as keyof TEvents, {
        error: event.error || new Error('Unknown database error'),
        context: {
          source: 'database',
          operation: event.metadata?.operation || 'unknown',
          originalEventType: event.metadata?.originalEventType
        },
        timestamp: new Date()
      } as TEvents[keyof TEvents]);
    });
  }

  /**
   * 获取全局事件总线单例实例
   */
  static getInstance<T extends Record<string, any> = GlobalEvents>(): GlobalEventBus<T> {
    if (!GlobalEventBus.instance) {
      GlobalEventBus.instance = new GlobalEventBus<T>();
    }
    return GlobalEventBus.instance as GlobalEventBus<T>;
  }

  /**
   * 添加事件监听器
   */
  on<K extends keyof TEvents>(eventType: K, listener: (data: TEvents[K]) => void): void {
    this.eventManager.addEventListener(eventType, listener);
  }

  /**
   * 移除事件监听器
   */
  off<K extends keyof TEvents>(eventType: K, listener: (data: TEvents[K]) => void): void {
    this.eventManager.removeEventListener(eventType, listener);
  }

  /**
   * 触发事件
   */
  emit<K extends keyof TEvents>(eventType: K, data: TEvents[K]): void {
    this.eventManager.emit(eventType, data);
    
    // 如果是重要事件，记录到数据库事件历史中
    if (this.isImportantEvent(eventType)) {
      this.databaseEventManager.emitEvent({
        type: DatabaseEventType.SERVICE_INITIALIZED,
        timestamp: new Date(),
        source: 'common',
        data: {
          eventType: String(eventType),
          eventData: data
        }
      });
    }
  }

  /**
   * 添加数据库事件监听器
   */
  onDatabaseEvent(
    eventType: DatabaseEventType | QdrantEventType | NebulaEventType, 
    listener: DatabaseEventListener<DatabaseEvent>
  ): void {
    this.databaseEventManager.addEventListener(eventType, listener);
  }

  /**
   * 移除数据库事件监听器
   */
  offDatabaseEvent(
    eventType: DatabaseEventType | QdrantEventType | NebulaEventType, 
    listener: DatabaseEventListener<DatabaseEvent>
  ): void {
    this.databaseEventManager.removeEventListener(eventType, listener);
  }

  /**
   * 触发数据库事件
   */
  emitDatabaseEvent(event: DatabaseEvent): void {
    this.databaseEventManager.emitEvent(event);
  }

  /**
   * 获取通用事件管理器
   */
  getEventManager(): EventManager<TEvents> {
    return this.eventManager;
  }

  /**
   * 获取数据库事件管理器
   */
  getDatabaseEventManager(): DatabaseEventManager<TEvents> {
    return this.databaseEventManager;
  }

  /**
   * 获取事件桥接器
   */
  getEventBridge(): EventBridge<TEvents> {
    return this.eventBridge;
  }

  /**
   * 清除所有事件监听器
   */
  clearAllListeners(): void {
    this.eventManager.clearAllListeners();
    this.databaseEventManager.removeAllListeners();
  }

  /**
   * 判断是否为重要事件
   */
  private isImportantEvent<K extends keyof TEvents>(eventType: K): boolean {
    const importantEvents = [
      'app.started',
      'app.shutdown',
      'app.error',
      'database.error',
      'project.indexed',
      'search.failed'
    ];
    
    return importantEvents.includes(String(eventType));
  }

  /**
   * 获取事件历史
   */
  getEventHistory(limit?: number): DatabaseEvent[] {
    return this.databaseEventManager.getEventHistory(limit);
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): {
    totalEvents: number;
    eventTypes: Record<string, number>;
    averageEventProcessingTime: number;
  } {
    const eventHistory = this.getEventHistory();
    const eventTypes: Record<string, number> = {};
    
    eventHistory.forEach(event => {
      const eventType = String(event.type);
      eventTypes[eventType] = (eventTypes[eventType] || 0) + 1;
    });
    
    return {
      totalEvents: eventHistory.length,
      eventTypes,
      averageEventProcessingTime: 0 // 实际实现中需要计算
    };
  }
}

/**
 * 全局事件总线实例
 */
export const globalEventBus = GlobalEventBus.getInstance<GlobalEvents>();