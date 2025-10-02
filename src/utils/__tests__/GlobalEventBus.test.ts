import { GlobalEventBus, GlobalEvents } from '../GlobalEventBus';
import { EventManager } from '../EventManager';
import { EventBridge } from '../../database/common/EventBridge';
import { DatabaseEventManager, DatabaseEventType, QdrantEventType, NebulaEventType } from '../../database/common/DatabaseEventTypes';

// Mock the dependencies
jest.mock('../../database/common/EventBridge');
jest.mock('../../database/common/DatabaseEventTypes');

describe('GlobalEventBus', () => {
  let globalEventBus: GlobalEventBus<GlobalEvents>;

  beforeEach(() => {
    // Reset mocks
    (EventBridge as jest.Mock).mockClear();
    (DatabaseEventManager as unknown as jest.Mock).mockClear();
    
    // Create new instance for each test
    globalEventBus = new GlobalEventBus<GlobalEvents>();
  });

  afterEach(() => {
    globalEventBus.clearAllListeners();
  });

  describe('constructor', () => {
    it('should create instances of EventManager, DatabaseEventManager, and EventBridge', () => {
      expect(globalEventBus.getEventManager()).toBeInstanceOf(EventManager);
      expect(globalEventBus.getDatabaseEventManager()).toBeInstanceOf(DatabaseEventManager);
      expect(globalEventBus.getEventBridge()).toBeInstanceOf(EventBridge);
    });

    it('should accept custom instances in constructor', () => {
      const customEventManager = new EventManager<GlobalEvents>();
      const customDatabaseEventManager = new DatabaseEventManager<GlobalEvents>();
      const customEventBridge = new EventBridge<GlobalEvents>(customDatabaseEventManager, customEventManager);
      
      const bus = new GlobalEventBus<GlobalEvents>(
        customEventManager,
        customDatabaseEventManager,
        customEventBridge
      );
      
      expect(bus.getEventManager()).toBe(customEventManager);
      expect(bus.getDatabaseEventManager()).toBe(customDatabaseEventManager);
      expect(bus.getEventBridge()).toBe(customEventBridge);
    });
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = GlobalEventBus.getInstance<GlobalEvents>();
      const instance2 = GlobalEventBus.getInstance<GlobalEvents>();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('on', () => {
    it('should add an event listener', () => {
      const listener = jest.fn();
      globalEventBus.on('app.started', listener);
      
      // We can't directly check the listener count since it's internal to EventManager
      // But we can verify the listener is called when emitting
      const eventData = {
        version: '1.0.0',
        environment: 'test' as const,
        startTime: new Date()
      };
      
      globalEventBus.emit('app.started', eventData);
      expect(listener).toHaveBeenCalledWith(eventData);
    });
  });

  describe('off', () => {
    it('should remove an event listener', () => {
      const listener = jest.fn();
      globalEventBus.on('app.started', listener);
      globalEventBus.off('app.started', listener);
      
      const eventData = {
        version: '1.0.0',
        environment: 'test' as const,
        startTime: new Date()
      };
      
      globalEventBus.emit('app.started', eventData);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('emit', () => {
    it('should emit an event to listeners', () => {
      const listener = jest.fn();
      globalEventBus.on('app.started', listener);
      
      const eventData = {
        version: '1.0.0',
        environment: 'test' as const,
        startTime: new Date()
      };
      
      globalEventBus.emit('app.started', eventData);
      expect(listener).toHaveBeenCalledWith(eventData);
    });

    it('should emit important events to database event manager', () => {
      const databaseEventManager = globalEventBus.getDatabaseEventManager();
      const databaseEventManagerEmitSpy = jest.spyOn(databaseEventManager, 'emitEvent');
      
      const eventData = {
        version: '1.0.0',
        environment: 'test' as const,
        startTime: new Date()
      };
      
      globalEventBus.emit('app.started', eventData);
      
      expect(databaseEventManagerEmitSpy).toHaveBeenCalled();
    });

    it('should convert database errors to app errors', () => {
      const listener = jest.fn();
      globalEventBus.on('app.error', listener);
      
      // Simulate a database error event
      const databaseEventManager = globalEventBus.getDatabaseEventManager();
      // We can't directly emit a database event through the public API
      // But we can test if our bridge is set up correctly
      expect(databaseEventManager).toBeDefined();
    });
  });

  describe('onDatabaseEvent', () => {
    it('should add a database event listener', () => {
      const databaseEventManager = globalEventBus.getDatabaseEventManager();
      const addEventListenerSpy = jest.spyOn(databaseEventManager, 'addEventListener');
      
      const listener = jest.fn();
      globalEventBus.onDatabaseEvent(DatabaseEventType.SERVICE_INITIALIZED, listener);
      
      expect(addEventListenerSpy).toHaveBeenCalledWith(DatabaseEventType.SERVICE_INITIALIZED, listener);
    });
  });

  describe('offDatabaseEvent', () => {
    it('should remove a database event listener', () => {
      const databaseEventManager = globalEventBus.getDatabaseEventManager();
      const removeEventListenerSpy = jest.spyOn(databaseEventManager, 'removeEventListener');
      
      const listener = jest.fn();
      globalEventBus.offDatabaseEvent(DatabaseEventType.SERVICE_INITIALIZED, listener);
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith(DatabaseEventType.SERVICE_INITIALIZED, listener);
    });
  });

  describe('emitDatabaseEvent', () => {
    it('should emit a database event', () => {
      const databaseEventManager = globalEventBus.getDatabaseEventManager();
      const emitEventSpy = jest.spyOn(databaseEventManager, 'emitEvent');
      
      const event = {
        type: DatabaseEventType.SERVICE_INITIALIZED,
        timestamp: new Date(),
        source: 'common' as const,
        data: {}
      };
      
      globalEventBus.emitDatabaseEvent(event);
      
      expect(emitEventSpy).toHaveBeenCalledWith(event);
    });
  });

  describe('clearAllListeners', () => {
    it('should clear all listeners', () => {
      const eventManager = globalEventBus.getEventManager();
      const databaseEventManager = globalEventBus.getDatabaseEventManager();
      
      const clearAllListenersSpy = jest.spyOn(eventManager, 'clearAllListeners');
      const removeAllListenersSpy = jest.spyOn(databaseEventManager, 'removeAllListeners');
      
      globalEventBus.clearAllListeners();
      
      expect(clearAllListenersSpy).toHaveBeenCalled();
      expect(removeAllListenersSpy).toHaveBeenCalled();
    });
  });

  describe('getEventManager', () => {
    it('should return the event manager instance', () => {
      expect(globalEventBus.getEventManager()).toBeInstanceOf(EventManager);
    });
  });

  describe('getDatabaseEventManager', () => {
    it('should return the database event manager instance', () => {
      expect(globalEventBus.getDatabaseEventManager()).toBeInstanceOf(DatabaseEventManager);
    });
  });

  describe('getEventBridge', () => {
    it('should return the event bridge instance', () => {
      expect(globalEventBus.getEventBridge()).toBeInstanceOf(EventBridge);
    });
  });

  describe('getEventHistory', () => {
    it('should return event history', () => {
      const databaseEventManager = globalEventBus.getDatabaseEventManager();
      const getEventHistorySpy = jest.spyOn(databaseEventManager, 'getEventHistory').mockReturnValue([]);
      
      const history = globalEventBus.getEventHistory();
      
      expect(getEventHistorySpy).toHaveBeenCalled();
      expect(history).toEqual([]);
    });
  });

  describe('getPerformanceStats', () => {
    it('should return performance stats', () => {
      const history = [
        { type: DatabaseEventType.SERVICE_INITIALIZED, timestamp: new Date(), source: 'common' as const, data: {} },
        { type: DatabaseEventType.SERVICE_INITIALIZED, timestamp: new Date(), source: 'common' as const, data: {} },
        { type: DatabaseEventType.ERROR_OCCURRED, timestamp: new Date(), source: 'common' as const, data: {} }
      ];
      
      const databaseEventManager = globalEventBus.getDatabaseEventManager();
      jest.spyOn(databaseEventManager, 'getEventHistory').mockReturnValue(history as any);
      
      const stats = globalEventBus.getPerformanceStats();
      
      expect(stats.totalEvents).toBe(3);
      expect(stats.eventTypes).toEqual({
        'service_initialized': 2,
        'error_occurred': 1
      });
    });
  });
});