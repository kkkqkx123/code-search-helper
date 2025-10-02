import { injectable } from 'inversify';
import { EventManager, EventListener } from '../../utils/EventManager';
import { 
  DatabaseEventManager, 
  DatabaseEvent, 
  DatabaseEventListener,
  DatabaseEventType,
  QdrantEventType,
  NebulaEventType
} from './DatabaseEventTypes';

/**
 * 事件桥接器
 * 
 * 这个类在数据库事件管理器和通用事件管理器之间建立桥接，
 * 允许两个事件系统互操作，同时保持各自的类型安全性。
 * 
 * @template TEvents - 事件类型映射接口
 * 
 * @example
 * // 定义事件类型映射
 * interface AppEvents {
 *   'database.connected': { host: string; port: number };
 *   'query.executed': { query: string; time: number };
 * }
 * 
 * // 创建事件桥接器
 * const eventBridge = new EventBridge<AppEvents>();
 * 
 * // 添加数据库事件监听器
 * eventBridge.addDatabaseListener(DatabaseEventType.CONNECTION_OPENED, (event) => {
 *   console.log('Database connected:', event.data);
 * });
 * 
 * // 添加通用事件监听器
 * eventBridge.addEventListener('database.connected', (data) => {
 *   console.log('Database connected:', data.host);
 * });
 */
@injectable()
export class EventBridge<TEvents = Record<string, any>> {
  private databaseEventManager: DatabaseEventManager<TEvents>;
  private eventManager: EventManager;
  private eventMapping: Map<string, string> = new Map();

  constructor(
    databaseEventManager?: DatabaseEventManager<TEvents>,
    eventManager?: EventManager
  ) {
    this.databaseEventManager = databaseEventManager || new DatabaseEventManager<TEvents>();
    this.eventManager = eventManager || new EventManager();
    this.initializeDefaultMappings();
  }

  /**
   * 初始化默认事件映射
   */
  private initializeDefaultMappings(): void {
    // 数据库连接事件映射
    this.eventMapping.set(String(DatabaseEventType.CONNECTION_OPENED), 'database.connected');
    this.eventMapping.set(String(DatabaseEventType.CONNECTION_CLOSED), 'database.disconnected');
    this.eventMapping.set(String(DatabaseEventType.CONNECTION_FAILED), 'database.connection_failed');
    
    // Qdrant 事件映射
    this.eventMapping.set(String(QdrantEventType.COLLECTION_CREATED), 'qdrant.collection_created');
    this.eventMapping.set(String(QdrantEventType.COLLECTION_DELETED), 'qdrant.collection_deleted');
    this.eventMapping.set(String(QdrantEventType.VECTOR_INSERTED), 'qdrant.vector_inserted');
    this.eventMapping.set(String(QdrantEventType.VECTOR_SEARCHED), 'qdrant.vector_searched');
    
    // Nebula 事件映射
    this.eventMapping.set(String(NebulaEventType.SPACE_CREATED), 'nebula.space_created');
    this.eventMapping.set(String(NebulaEventType.NODE_INSERTED), 'nebula.node_inserted');
    this.eventMapping.set(String(NebulaEventType.QUERY_EXECUTED), 'nebula.query_executed');
    
    // 性能事件映射
    this.eventMapping.set(String(DatabaseEventType.PERFORMANCE_METRIC), 'performance.metric');
    this.eventMapping.set(String(DatabaseEventType.QUERY_EXECUTED), 'query.executed');
    this.eventMapping.set(String(DatabaseEventType.BATCH_OPERATION_COMPLETED), 'batch.operation_completed');
  }

  /**
   * 添加数据库事件监听器
   * 
   * @param eventType - 数据库事件类型
   * @param listener - 事件监听器
   */
  addDatabaseListener(
    eventType: DatabaseEventType | QdrantEventType | NebulaEventType,
    listener: DatabaseEventListener<DatabaseEvent>
  ): void {
    this.databaseEventManager.addEventListener(eventType, listener);
  }

  /**
   * 移除数据库事件监听器
   * 
   * @param eventType - 数据库事件类型
   * @param listener - 事件监听器
   */
  removeDatabaseListener(
    eventType: DatabaseEventType | QdrantEventType | NebulaEventType,
    listener: DatabaseEventListener<DatabaseEvent>
  ): void {
    this.databaseEventManager.removeEventListener(eventType, listener);
  }

  /**
   * 添加通用事件监听器
   * 
   * @param eventType - 事件类型
   * @param listener - 事件监听器
   */
  addEventListener<K extends keyof TEvents>(
    eventType: K,
    listener: EventListener<TEvents[K]>
  ): void {
    this.eventManager.addEventListener(String(eventType), listener);
  }

  /**
   * 移除通用事件监听器
   * 
   * @param eventType - 事件类型
   * @param listener - 事件监听器
   */
  removeEventListener<K extends keyof TEvents>(
    eventType: K,
    listener: EventListener<TEvents[K]>
  ): void {
    this.eventManager.removeEventListener(String(eventType), listener);
  }

  /**
   * 添加事件映射
   * 
   * @param databaseEventType - 数据库事件类型
   * @param genericEventType - 通用事件类型
   */
  addEventMapping(
    databaseEventType: DatabaseEventType | QdrantEventType | NebulaEventType,
    genericEventType: keyof TEvents
  ): void {
    this.eventMapping.set(String(databaseEventType), String(genericEventType));
  }

  /**
   * 移除事件映射
   * 
   * @param databaseEventType - 数据库事件类型
   */
  removeEventMapping(databaseEventType: DatabaseEventType | QdrantEventType | NebulaEventType): void {
    this.eventMapping.delete(String(databaseEventType));
  }

  /**
   * 启动事件桥接
   * 
   * 这个方法开始监听数据库事件，并将它们转换为通用事件
   */
  startBridging(): void {
    // 监听所有数据库事件
    this.databaseEventManager.addEventListener('*', (event: DatabaseEvent) => {
      this.bridgeEvent(event);
    });
  }

  /**
   * 停止事件桥接
   */
  stopBridging(): void {
    // 移除桥接监听器
    this.databaseEventManager.removeEventListener('*', this.bridgeEvent.bind(this));
  }

  /**
   * 桥接事件
   * 
   * @param event - 数据库事件
   */
  private bridgeEvent(event: DatabaseEvent): void {
    const eventTypeStr = String(event.type);
    
    // 查找对应的通用事件类型
    const genericEventType = this.eventMapping.get(eventTypeStr);
    if (genericEventType) {
      // 转换事件数据格式
      const eventData = this.transformEventData(event);
      
      // 发出通用事件
      this.eventManager.emit(genericEventType, eventData);
    }
  }

  /**
   * 转换事件数据格式
   * 
   * @param event - 数据库事件
   * @returns 转换后的事件数据
   */
  private transformEventData(event: DatabaseEvent): any {
    // 基础转换逻辑
    const transformed = {
      ...event.data,
      timestamp: event.timestamp,
      source: event.source,
      error: event.error?.message
    };

    // 根据事件类型进行特殊处理
    switch (event.type) {
      case DatabaseEventType.CONNECTION_OPENED:
      case DatabaseEventType.CONNECTION_CLOSED:
      case DatabaseEventType.CONNECTION_FAILED:
        return {
          ...transformed,
          status: event.type === DatabaseEventType.CONNECTION_OPENED ? 'connected' : 'disconnected'
        };
      
      case DatabaseEventType.PERFORMANCE_METRIC:
        return {
          ...transformed,
          operation: event.data?.operation,
          duration: event.data?.duration,
          success: event.data?.success,
          dataSize: event.data?.dataSize
        };
      
      case DatabaseEventType.QUERY_EXECUTED:
        return {
          ...transformed,
          query: event.data?.query,
          executionTime: event.data?.executionTime,
          resultCount: event.data?.resultCount,
          success: event.data?.success
        };
      
      default:
        return transformed;
    }
  }

  /**
   * 发出数据库事件
   * 
   * @param event - 数据库事件
   */
  emitDatabaseEvent(event: DatabaseEvent): void {
    this.databaseEventManager.emitEvent(event);
  }

  /**
   * 发出通用事件
   * 
   * @param eventType - 事件类型
   * @param data - 事件数据
   */
  emitGenericEvent<K extends keyof TEvents>(eventType: K, data: TEvents[K]): void {
    this.eventManager.emit(String(eventType), data);
  }

  /**
   * 获取数据库事件管理器
   */
  getDatabaseEventManager(): DatabaseEventManager<TEvents> {
    return this.databaseEventManager;
  }

  /**
   * 获取通用事件管理器
   */
  getEventManager(): EventManager {
    return this.eventManager;
  }

  /**
   * 获取事件映射
   */
  getEventMappings(): Map<string, string> {
    return new Map(this.eventMapping);
  }

  /**
   * 清除所有事件监听器
   */
  clearAllListeners(): void {
    this.databaseEventManager.removeAllListeners();
    this.eventManager.clearAllListeners();
  }
}