import { EventBridge } from '../../../database/common/EventBridge';
import {
  DatabaseEvent,
  DatabaseEventType,
  QdrantEventType,
  NebulaEventType
} from '../../../database/common/DatabaseEventTypes';
import { DatabaseEventManager } from '../../../database/common/DatabaseEventManager';
import { EventManager } from '../../../utils/EventManager';

// Mock implementations
const mockDatabaseEventManager = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  emitEvent: jest.fn(),
  removeAllListeners: jest.fn(),
  getListenerCount: jest.fn()
};

const mockEventManager = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  emit: jest.fn(),
  clearAllListeners: jest.fn()
};

interface TestEvents {
  'database.connected': { host: string; port: number };
  'query.executed': { query: string; time: number };
  'test.event': { value: number };
}

describe('EventBridge', () => {
  let eventBridge: EventBridge<TestEvents>;

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks();
    
    // 创建新的EventBridge实例
    eventBridge = new EventBridge(
      mockDatabaseEventManager as any,
      mockEventManager as any
    );
  });

  describe('constructor', () => {
    it('should initialize with provided event managers', () => {
      expect(eventBridge).toBeInstanceOf(EventBridge);
    });

    it('should initialize with default event managers when none provided', () => {
      const bridge = new EventBridge();
      expect(bridge).toBeInstanceOf(EventBridge);
    });

    it('should initialize default event mappings', () => {
      const mappings = eventBridge.getEventMappings();
      expect(mappings.size).toBeGreaterThan(0);
      
      // 检查一些默认映射
      expect(mappings.get('connection_opened')).toBe('database.connected');
      expect(mappings.get('collection_created')).toBe('qdrant.collection_created');
      expect(mappings.get('space_created')).toBe('nebula.space_created');
    });
  });

  describe('addDatabaseListener', () => {
    it('should add database event listener', () => {
      const listener = jest.fn();
      
      eventBridge.addDatabaseListener(DatabaseEventType.CONNECTION_OPENED, listener as any);
      
      expect(mockDatabaseEventManager.addEventListener).toHaveBeenCalledWith(
        DatabaseEventType.CONNECTION_OPENED,
        listener
      );
    });
  });

  describe('removeDatabaseListener', () => {
    it('should remove database event listener', () => {
      const listener = jest.fn();
      
      eventBridge.removeDatabaseListener(DatabaseEventType.CONNECTION_OPENED, listener as any);
      
      expect(mockDatabaseEventManager.removeEventListener).toHaveBeenCalledWith(
        DatabaseEventType.CONNECTION_OPENED,
        listener
      );
    });
  });

  describe('addEventListener', () => {
    it('should add generic event listener', () => {
      const listener = jest.fn();
      
      eventBridge.addEventListener('test.event', listener);
      
      expect(mockEventManager.addEventListener).toHaveBeenCalledWith(
        'test.event',
        listener
      );
    });
  });

  describe('removeEventListener', () => {
    it('should remove generic event listener', () => {
      const listener = jest.fn();
      
      eventBridge.removeEventListener('test.event', listener);
      
      expect(mockEventManager.removeEventListener).toHaveBeenCalledWith(
        'test.event',
        listener
      );
    });
  });

  describe('event mapping', () => {
    it('should add event mapping', () => {
      eventBridge.addEventMapping(
        DatabaseEventType.CONNECTION_OPENED,
        'test.event'
      );
      
      const mappings = eventBridge.getEventMappings();
      expect(mappings.get('connection_opened')).toBe('test.event');
    });

    it('should remove event mapping', () => {
      // 先添加映射
      eventBridge.addEventMapping(
        DatabaseEventType.CONNECTION_OPENED,
        'test.event'
      );
      
      // 然后移除映射
      eventBridge.removeEventMapping(DatabaseEventType.CONNECTION_OPENED);
      
      const mappings = eventBridge.getEventMappings();
      expect(mappings.get('connection_opened')).toBeUndefined();
    });
  });

  describe('startBridging', () => {
    it('should start bridging events', () => {
      eventBridge.startBridging();
      
      expect(mockDatabaseEventManager.addEventListener).toHaveBeenCalledWith(
        '*',
        expect.any(Function)
      );
    });
  });

  describe('stopBridging', () => {
    it('should stop bridging events', () => {
      eventBridge.stopBridging();
      
      expect(mockDatabaseEventManager.removeEventListener).toHaveBeenCalledWith(
        '*',
        expect.any(Function)
      );
    });
  });

  describe('bridgeEvent', () => {
    it('should bridge events with matching mapping', () => {
      // 添加一个映射
      eventBridge.addEventMapping(
        DatabaseEventType.CONNECTION_OPENED,
        'database.connected'
      );
      
      // 创建一个事件
      const event: DatabaseEvent = {
        type: DatabaseEventType.CONNECTION_OPENED,
        timestamp: new Date(),
        source: 'qdrant',
        data: {
          host: 'localhost',
          port: 6333,
          status: 'connected'
        }
      };
      
      // 调用私有方法进行测试
      const bridgeEvent = (eventBridge as any).bridgeEvent.bind(eventBridge);
      bridgeEvent(event);
      
      // 检查是否发出了通用事件
      expect(mockEventManager.emit).toHaveBeenCalledWith(
        'database.connected',
        expect.objectContaining({
          host: 'localhost',
          port: 6333,
          timestamp: event.timestamp,
          source: 'qdrant'
        })
      );
    });

    it('should not bridge events without matching mapping', () => {
      // 创建一个没有映射的事件
      const event: DatabaseEvent = {
        type: DatabaseEventType.SERVICE_INITIALIZED,
        timestamp: new Date(),
        source: 'common'
      };
      
      // 调用私有方法进行测试
      const bridgeEvent = (eventBridge as any).bridgeEvent.bind(eventBridge);
      bridgeEvent(event);
      
      // 检查是否没有发出通用事件
      expect(mockEventManager.emit).not.toHaveBeenCalled();
    });
  });

  describe('transformEventData', () => {
    it('should transform connection events', () => {
      const event: DatabaseEvent = {
        type: DatabaseEventType.CONNECTION_OPENED,
        timestamp: new Date(),
        source: 'qdrant',
        data: {
          host: 'localhost',
          port: 6333
        }
      };
      
      const transformEventData = (eventBridge as any).transformEventData.bind(eventBridge);
      const transformed = transformEventData(event);
      
      expect(transformed).toEqual({
        host: 'localhost',
        port: 6333,
        timestamp: event.timestamp,
        source: 'qdrant',
        status: 'connected'
      });
    });

    it('should transform performance metric events', () => {
      const event: DatabaseEvent = {
        type: DatabaseEventType.PERFORMANCE_METRIC,
        timestamp: new Date(),
        source: 'qdrant',
        data: {
          operation: 'search',
          duration: 100,
          success: true,
          dataSize: 1024
        }
      };
      
      const transformEventData = (eventBridge as any).transformEventData.bind(eventBridge);
      const transformed = transformEventData(event);
      
      expect(transformed).toEqual({
        operation: 'search',
        duration: 100,
        success: true,
        dataSize: 1024,
        timestamp: event.timestamp,
        source: 'qdrant'
      });
    });

    it('should transform query executed events', () => {
      const event: DatabaseEvent = {
        type: DatabaseEventType.QUERY_EXECUTED,
        timestamp: new Date(),
        source: 'nebula',
        data: {
          query: 'MATCH (n) RETURN n',
          executionTime: 150,
          resultCount: 10,
          success: true
        }
      };
      
      const transformEventData = (eventBridge as any).transformEventData.bind(eventBridge);
      const transformed = transformEventData(event);
      
      expect(transformed).toEqual({
        query: 'MATCH (n) RETURN n',
        executionTime: 150,
        resultCount: 10,
        success: true,
        timestamp: event.timestamp,
        source: 'nebula'
      });
    });

    it('should transform generic events', () => {
      const event: DatabaseEvent = {
        type: DatabaseEventType.SERVICE_INITIALIZED,
        timestamp: new Date(),
        source: 'common',
        data: {
          projectId: 'test-project'
        },
        error: new Error('Test error')
      };
      
      const transformEventData = (eventBridge as any).transformEventData.bind(eventBridge);
      const transformed = transformEventData(event);
      
      expect(transformed).toEqual({
        projectId: 'test-project',
        timestamp: event.timestamp,
        source: 'common',
        error: 'Test error'
      });
    });
  });

  describe('emitDatabaseEvent', () => {
    it('should emit database event', () => {
      const event: DatabaseEvent = {
        type: DatabaseEventType.CONNECTION_OPENED,
        timestamp: new Date(),
        source: 'qdrant'
      };
      
      eventBridge.emitDatabaseEvent(event);
      
      expect(mockDatabaseEventManager.emitEvent).toHaveBeenCalledWith(event);
    });
  });

  describe('emitGenericEvent', () => {
    it('should emit generic event', () => {
      const data = { value: 42 };
      
      eventBridge.emitGenericEvent('test.event', data);
      
      expect(mockEventManager.emit).toHaveBeenCalledWith('test.event', data);
    });
  });

  describe('getters', () => {
    it('should get database event manager', () => {
      const manager = eventBridge.getDatabaseEventManager();
      expect(manager).toBe(mockDatabaseEventManager);
    });

    it('should get generic event manager', () => {
      const manager = eventBridge.getEventManager();
      expect(manager).toBe(mockEventManager);
    });

    it('should get event mappings', () => {
      const mappings = eventBridge.getEventMappings();
      expect(mappings).toBeInstanceOf(Map);
    });
  });

  describe('clearAllListeners', () => {
    it('should clear all listeners', () => {
      eventBridge.clearAllListeners();
      
      expect(mockDatabaseEventManager.removeAllListeners).toHaveBeenCalled();
      expect(mockEventManager.clearAllListeners).toHaveBeenCalled();
    });
  });
});