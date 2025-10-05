import { injectable, inject } from 'inversify';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseEventType, DatabaseEventListener, NebulaEventType, NebulaEvent } from '../common/DatabaseEventTypes';
import { TYPES } from '../../types';
import { ConfigService } from '../../config/ConfigService';

export interface EventManagerConfig {
  maxEventQueueSize?: number;
  enablePerformanceMetrics?: boolean;
  enableEventLogging?: boolean;
}

export interface EventStats {
  totalEvents: number;
  processedEvents: number;
  failedEvents: number;
  activeSubscriptions: number;
}

export interface ActiveSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
}

export interface INebulaEventManager {
  emit(event: NebulaEvent): void;
  emitAsync(event: NebulaEvent): Promise<void>;
  on(eventType: NebulaEventType | string, handler: EventHandler): Subscription;
  once(eventType: NebulaEventType | string, handler: EventHandler): Subscription;
  off(subscription: Subscription): void;
  onMultiple(events: (NebulaEventType | string)[], handler: EventHandler): Subscription[];
  offMultiple(subscriptions: Subscription[]): void;
  getEventStats(): EventStats;
  getActiveSubscriptions(): ActiveSubscription[];
  clearAll(): void;
  setConfig(config: EventManagerConfig): void;
  getConfig(): EventManagerConfig;
}

type EventHandler = (event: NebulaEvent) => void | Promise<void>;
export interface Subscription { 
  id: string; 
  eventType: string; 
  handler: EventHandler;
  unsubscribe: () => void;
}

@injectable()
export class NebulaEventManager implements INebulaEventManager {
  private handlers: Map<string, EventHandler[]> = new Map();
  private config: EventManagerConfig;
  private stats: EventStats = {
    totalEvents: 0,
    processedEvents: 0,
    failedEvents: 0,
    activeSubscriptions: 0
  };
  private performanceMetrics: Map<string, {
    totalCount: number;
    successCount: number;
    failureCount: number;
    totalDuration: number;
    maxDuration: number;
    minDuration: number;
  }> = new Map();

  constructor(@inject(TYPES.ConfigService) private configService: ConfigService) {
    this.config = this.loadDefaultConfig();
  }

  private loadDefaultConfig(): EventManagerConfig {
    return {
      maxEventQueueSize: 1000,
      enablePerformanceMetrics: true,
      enableEventLogging: true
    };
  }

  emit(event: NebulaEvent): void {
    this.stats.totalEvents++;

    const handlers = this.handlers.get(event.type) || [];
    const allHandlers = this.handlers.get('*') || []; // Handle wildcard events

    // Synchronously execute all handlers
    [...handlers, ...allHandlers].forEach(handler => {
      try {
        handler(event);
        this.stats.processedEvents++;
      } catch (error) {
        this.stats.failedEvents++;
        this.handleHandlerError(error, event, handler);
      }
    });
  }

  async emitAsync(event: NebulaEvent): Promise<void> {
    this.stats.totalEvents++;

    const handlers = this.handlers.get(event.type) || [];
    const allHandlers = this.handlers.get('*') || []; // Handle wildcard events

    // Asynchronously execute all handlers
    await Promise.allSettled(
      [...handlers, ...allHandlers].map(async handler => {
        try {
          const startTime = Date.now();
          await handler(event);
          const duration = Date.now() - startTime;

          this.stats.processedEvents++;
          if (this.config.enablePerformanceMetrics) {
            this.recordPerformanceMetrics(event.type, duration, true);
          }
        } catch (error) {
          this.stats.failedEvents++;
          if (this.config.enablePerformanceMetrics) {
            this.recordPerformanceMetrics(event.type, Date.now() - Date.now(), false); // Could improve duration calculation
          }
          this.handleHandlerError(error, event, handler);
        }
      })
    );
  }

  on(eventType: string, handler: EventHandler): Subscription {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }

    const handlers = this.handlers.get(eventType)!;
    handlers.push(handler);

    this.stats.activeSubscriptions++;

    const subscriptionId = uuidv4();
    const subscription: Subscription = {
      id: subscriptionId,
      eventType,
      handler,
      unsubscribe: () => this.off(subscription)
    };

    return subscription;
  }

  once(eventType: string, handler: EventHandler): Subscription {
    const onceHandler: EventHandler = (...args) => {
      handler(...args);
      this.off({ id: '', eventType, handler: onceHandler });
    };

    return this.on(eventType, onceHandler);
  }

  off(subscription: Subscription): void {
    const handlers = this.handlers.get(subscription.eventType);
    if (handlers) {
      const index = handlers.indexOf(subscription.handler);
      if (index > -1) {
        handlers.splice(index, 1);
        this.stats.activeSubscriptions--;
      }
    }
  }

  onMultiple(eventTypes: (NebulaEventType | string)[], handler: EventHandler): Subscription[] {
    return eventTypes.map(eventType => this.on(eventType, handler));
  }

  offMultiple(subscriptions: Subscription[]): void {
    subscriptions.forEach(subscription => this.off(subscription));
  }

  getEventStats(): EventStats {
    return { ...this.stats };
  }

  getActiveSubscriptions(): ActiveSubscription[] {
    const subscriptions: ActiveSubscription[] = [];
    this.handlers.forEach((handlers, eventType) => {
      handlers.forEach(handler => {
        subscriptions.push({
          id: uuidv4(),
          eventType,
          handler
        });
      });
    });
    return subscriptions;
  }

  clearAll(): void {
    this.handlers.clear();
    this.stats = {
      totalEvents: 0,
      processedEvents: 0,
      failedEvents: 0,
      activeSubscriptions: 0
    };
    this.performanceMetrics.clear();
  }

  setConfig(config: EventManagerConfig): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): EventManagerConfig {
    return { ...this.config };
  }

  private handleHandlerError(error: any, event: NebulaEvent, handler: EventHandler): void {
    // Log the error but don't throw to avoid breaking the event flow
    console.error(`Error in event handler for ${event.type}:`, error);
  }

  private recordPerformanceMetrics(
    eventType: string, 
    duration: number, 
    success: boolean
  ): void {
    if (!this.performanceMetrics.has(eventType)) {
      this.performanceMetrics.set(eventType, {
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        totalDuration: 0,
        maxDuration: 0,
        minDuration: Infinity
      });
    }

    const metrics = this.performanceMetrics.get(eventType)!;
    metrics.totalCount++;
    metrics.totalDuration += duration;
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    metrics.minDuration = Math.min(metrics.minDuration, duration);

    if (success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
    }
  }
}