import { EventManager } from '../EventManager';

describe('EventManager', () => {
  let eventManager: EventManager<any>;

  beforeEach(() => {
    eventManager = new EventManager();
  });

  afterEach(() => {
    eventManager.clearAllListeners();
  });

  describe('addEventListener', () => {
    it('should add an event listener', () => {
      const listener = jest.fn();
      eventManager.addEventListener('testEvent', listener);
      
      expect(eventManager.listenerCount('testEvent')).toBe(1);
    });

    it('should add multiple listeners for the same event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      eventManager.addEventListener('testEvent', listener1);
      eventManager.addEventListener('testEvent', listener2);
      
      expect(eventManager.listenerCount('testEvent')).toBe(2);
    });
  });

  describe('removeEventListener', () => {
    it('should remove an event listener', () => {
      const listener = jest.fn();
      eventManager.addEventListener('testEvent', listener);
      expect(eventManager.listenerCount('testEvent')).toBe(1);
      
      eventManager.removeEventListener('testEvent', listener);
      expect(eventManager.listenerCount('testEvent')).toBe(0);
    });

    it('should not remove listener if it was not added', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      eventManager.addEventListener('testEvent', listener1);
      eventManager.removeEventListener('testEvent', listener2);
      
      expect(eventManager.listenerCount('testEvent')).toBe(1);
    });
  });

  describe('emit', () => {
    it('should call all listeners for an event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      eventManager.addEventListener('testEvent', listener1);
      eventManager.addEventListener('testEvent', listener2);
      
      eventManager.emit('testEvent', { message: 'test' });
      
      expect(listener1).toHaveBeenCalledWith({ message: 'test' });
      expect(listener2).toHaveBeenCalledWith({ message: 'test' });
    });

    it('should not call listeners for other events', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      eventManager.addEventListener('event1', listener1);
      eventManager.addEventListener('event2', listener2);
      
      eventManager.emit('event1', { message: 'test' });
      
      expect(listener1).toHaveBeenCalledWith({ message: 'test' });
      expect(listener2).not.toHaveBeenCalled();
    });

    it('should handle errors in listeners gracefully', () => {
      const listener1 = jest.fn(() => { throw new Error('Test error'); });
      const listener2 = jest.fn();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      eventManager.addEventListener('testEvent', listener1);
      eventManager.addEventListener('testEvent', listener2);
      
      eventManager.emit('testEvent', { message: 'test' });
      
      expect(listener1).toHaveBeenCalledWith({ message: 'test' });
      expect(listener2).toHaveBeenCalledWith({ message: 'test' });
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should not call listeners if event has no listeners', () => {
      const listener = jest.fn();
      eventManager.addEventListener('testEvent', listener);
      
      eventManager.emit('otherEvent', { message: 'test' });
      
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('should return the correct number of listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      expect(eventManager.listenerCount('testEvent')).toBe(0);
      
      eventManager.addEventListener('testEvent', listener1);
      expect(eventManager.listenerCount('testEvent')).toBe(1);
      
      eventManager.addEventListener('testEvent', listener2);
      expect(eventManager.listenerCount('testEvent')).toBe(2);
      
      eventManager.removeEventListener('testEvent', listener1);
      expect(eventManager.listenerCount('testEvent')).toBe(1);
    });

    it('should return 0 for events with no listeners', () => {
      expect(eventManager.listenerCount('nonExistentEvent')).toBe(0);
    });
  });

  describe('clearListeners', () => {
    it('should clear listeners for a specific event', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      eventManager.addEventListener('event1', listener1);
      eventManager.addEventListener('event2', listener2);
      
      eventManager.clearListeners('event1');
      
      expect(eventManager.listenerCount('event1')).toBe(0);
      expect(eventManager.listenerCount('event2')).toBe(1);
    });
  });

  describe('clearAllListeners', () => {
    it('should clear all listeners', () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      
      eventManager.addEventListener('event1', listener1);
      eventManager.addEventListener('event2', listener2);
      
      eventManager.clearAllListeners();
      
      expect(eventManager.listenerCount('event1')).toBe(0);
      expect(eventManager.listenerCount('event2')).toBe(0);
    });
  });

  describe('generic typing', () => {
    it('should correctly type event data', () => {
      interface UserLoginEventData {
        userId: string;
        username: string;
        timestamp: Date;
      }
      
      const typedEventManager = new EventManager<UserLoginEventData>();
      const listener = jest.fn();
      
      typedEventManager.addEventListener('user-login', listener);
      const eventData: UserLoginEventData = {
        userId: '123',
        username: 'john_doe',
        timestamp: new Date()
      };
      
      typedEventManager.emit('user-login', eventData);
      
      expect(listener).toHaveBeenCalledWith(eventData);
    });
  });
});