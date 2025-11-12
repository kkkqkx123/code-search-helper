import { injectable } from 'inversify';
import { GlobalEventBus, GlobalEvents } from '../../utils/GlobalEventBus';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { DatabaseEventManager } from '../../database/common/DatabaseEventTypes';
import {
  IEventManager,
  DatabaseEvent,
  DatabaseEventType
} from '../../database/common/DatabaseEventTypes';
import { NodeIdGenerator } from '../../utils/deterministic-node-id';

/**
 * 错误级别枚举
 */
export enum ErrorLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

/**
 * 错误分类枚举
 */
export enum ErrorCategory {
  NETWORK = 'network',
  DATABASE = 'database',
  FILESYSTEM = 'filesystem',
  BUSINESS_LOGIC = 'business_logic',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

/**
 * 增强的错误信息接口
 */
export interface EnhancedErrorInfo {
  id: string;
  timestamp: Date;
  level: ErrorLevel;
  category: ErrorCategory;
  message: string;
  stack?: string;
  context: Record<string, any>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  tags: string[];
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  resolved: boolean;
  resolutionInfo?: {
    resolvedAt: Date;
    resolvedBy: string;
    resolution: string;
  };
}

/**
 * 错误追踪事件数据
 */
export interface ErrorTrackingEvent {
  error: Error;
  level: ErrorLevel;
  category: ErrorCategory;
  context: Record<string, any>;
  tags: string[];
  timestamp: Date;
}

/**
 * 错误追踪接口
 */
export interface IEventErrorTracker {
  /**
   * 追踪错误
   */
  trackError(
    error: Error,
    level: ErrorLevel,
    category: ErrorCategory,
    context?: Record<string, any>,
    tags?: string[]
  ): string;

  /**
   * 追踪异步函数中的错误
   */
  trackAsyncError<T>(
    operation: string,
    fn: () => Promise<T>,
    context?: Record<string, any>,
    tags?: string[]
  ): Promise<T>;

  /**
   * 追踪同步函数中的错误
   */
  trackSyncError<T>(
    operation: string,
    fn: () => T,
    context?: Record<string, any>,
    tags?: string[]
  ): T;

  /**
   * 获取错误信息
   */
  getError(errorId: string): EnhancedErrorInfo | undefined;

  /**
   * 获取错误列表
   */
  getErrors(filter?: {
    level?: ErrorLevel;
    category?: ErrorCategory;
    tags?: string[];
    resolved?: boolean;
    startTime?: Date;
    endTime?: Date;
  }): EnhancedErrorInfo[];

  /**
   * 获取错误统计
   */
  getErrorStatistics(): {
    totalErrors: number;
    errorsByLevel: Record<ErrorLevel, number>;
    errorsByCategory: Record<ErrorCategory, number>;
    topErrors: Array<{ error: EnhancedErrorInfo; count: number }>;
    resolutionRate: number;
  };

  /**
   * 标记错误为已解决
   */
  resolveError(
    errorId: string,
    resolvedBy: string,
    resolution: string
  ): boolean;

  /**
   * 批量标记错误为已解决
   */
  resolveErrors(
    errorIds: string[],
    resolvedBy: string,
    resolution: string
  ): number;

  /**
   * 清除旧错误
   */
  clearOldErrors(olderThan: Date): number;
}

/**
 * 事件错误追踪服务
 * 
 * 这个类通过事件系统改进错误追踪，提供统一错误事件格式，并集成到日志系统中。
 * 
 * @example
 * // 创建错误追踪实例
 * const errorTracker = new EventErrorTracker();
 * 
 * // 追踪错误
 * try {
 *   // 可能出错的操作
 * } catch (error) {
 *   errorTracker.trackError(error, ErrorLevel.ERROR, ErrorCategory.DATABASE, {
 *     operation: 'database.query',
 *     query: 'SELECT * FROM users'
 *   }, ['database', 'query']);
 * }
 * 
 * // 监控异步操作
 * const result = await errorTracker.trackAsyncError('api.request', async () => {
 *   return await api.getData();
 * }, { endpoint: '/api/data' }, ['api', 'network']);
 */
@injectable()
export class EventErrorTracker implements IEventErrorTracker {
  private globalEventBus: GlobalEventBus<GlobalEvents>;
  private errorHandler: ErrorHandlerService;
  private databaseEventManager: IEventManager<GlobalEvents>;
  private errors: Map<string, EnhancedErrorInfo> = new Map();
  private errorGroups: Map<string, string[]> = new Map();

  constructor(
    globalEventBus?: GlobalEventBus<GlobalEvents>,
    errorHandler?: ErrorHandlerService,
    databaseEventManager?: IEventManager<GlobalEvents>
  ) {
    this.globalEventBus = globalEventBus || GlobalEventBus.getInstance<GlobalEvents>();
    this.errorHandler = errorHandler || new ErrorHandlerService({} as any); // 假设需要一个logger参数
    this.databaseEventManager = databaseEventManager || new DatabaseEventManager<GlobalEvents>();
    
    // 设置事件监听器
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听应用错误事件
    this.globalEventBus.on('app.error', (data) => {
      this.trackError(
        data.error,
        ErrorLevel.ERROR,
        ErrorCategory.SYSTEM,
        data.context,
        ['app', 'system']
      );
    });

    // 监听数据库错误事件
    this.globalEventBus.on('database.error', (data) => {
      this.trackError(
        data.error,
        ErrorLevel.ERROR,
        ErrorCategory.DATABASE,
        {
          operation: data.operation,
          type: data.type
        },
        ['database', data.type]
      );
    });

    // 监听网络错误事件
    this.globalEventBus.on('network.error', (data) => {
      this.trackError(
        new Error(data.error),
        ErrorLevel.ERROR,
        ErrorCategory.NETWORK,
        {
          url: data.url,
          method: data.method
        },
        ['network', 'api']
      );
    });

    // 监听搜索失败事件
    this.globalEventBus.on('search.failed', (data) => {
      this.trackError(
        new Error(data.error),
        ErrorLevel.WARN,
        ErrorCategory.BUSINESS_LOGIC,
        {
          query: data.query
        },
        ['search', 'query']
      );
    });
  }

  /**
   * 追踪错误
   */
  trackError(
    error: Error,
    level: ErrorLevel,
    category: ErrorCategory,
    context: Record<string, any> = {},
    tags: string[] = []
  ): string {
    const errorId = this.generateErrorId(error, category);
    const timestamp = new Date();
    
    // 检查是否已存在相同错误
    const existingError = this.errors.get(errorId);
    
    if (existingError) {
      // 更新现有错误信息
      existingError.count++;
      existingError.lastOccurrence = timestamp;
      existingError.context = { ...existingError.context, ...context };
      existingError.tags = [...new Set([...existingError.tags, ...tags])];
    } else {
      // 创建新的错误信息
      const errorInfo: EnhancedErrorInfo = {
        id: errorId,
        timestamp,
        level,
        category,
        message: error.message,
        stack: error.stack,
        context,
        tags,
        count: 1,
        firstOccurrence: timestamp,
        lastOccurrence: timestamp,
        resolved: false
      };
      
      this.errors.set(errorId, errorInfo);
    }
    
    // 将错误添加到分组
    const groupKey = this.generateGroupKey(error, category);
    if (!this.errorGroups.has(groupKey)) {
      this.errorGroups.set(groupKey, []);
    }
    if (!this.errorGroups.get(groupKey)!.includes(errorId)) {
      this.errorGroups.get(groupKey)!.push(errorId);
    }
    
    // 发出错误事件
    this.emitErrorEvent(error, level, category, context, tags, timestamp);
    
    // 记录到数据库事件历史
    this.recordErrorToDatabase(errorId, error, level, category, context, tags, timestamp);
    
    // 如果是严重错误，通知错误处理服务
    if (level === ErrorLevel.ERROR || level === ErrorLevel.FATAL) {
      this.errorHandler.handleError(error, {
        component: category as any,
        operation: level as any,
        context,
        tags
      });
    }
    
    return errorId;
  }

  /**
   * 追踪异步函数中的错误
   */
  async trackAsyncError<T>(
    operation: string,
    fn: () => Promise<T>,
    context: Record<string, any> = {},
    tags: string[] = []
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      this.trackError(
        error instanceof Error ? error : new Error(String(error)),
        ErrorLevel.ERROR,
        this.inferCategoryFromOperation(operation),
        { ...context, operation },
        [...tags, 'async', operation]
      );
      throw error;
    }
  }

  /**
   * 追踪同步函数中的错误
   */
  trackSyncError<T>(
    operation: string,
    fn: () => T,
    context: Record<string, any> = {},
    tags: string[] = []
  ): T {
    try {
      return fn();
    } catch (error) {
      this.trackError(
        error instanceof Error ? error : new Error(String(error)),
        ErrorLevel.ERROR,
        this.inferCategoryFromOperation(operation),
        { ...context, operation },
        [...tags, 'sync', operation]
      );
      throw error;
    }
  }

  /**
   * 获取错误信息
   */
  getError(errorId: string): EnhancedErrorInfo | undefined {
    return this.errors.get(errorId);
  }

  /**
   * 获取错误列表
   */
  getErrors(filter?: {
    level?: ErrorLevel;
    category?: ErrorCategory;
    tags?: string[];
    resolved?: boolean;
    startTime?: Date;
    endTime?: Date;
  }): EnhancedErrorInfo[] {
    let errors = Array.from(this.errors.values());
    
    if (filter) {
      if (filter.level) {
        errors = errors.filter(error => error.level === filter.level);
      }
      
      if (filter.category) {
        errors = errors.filter(error => error.category === filter.category);
      }
      
      if (filter.tags && filter.tags.length > 0) {
        errors = errors.filter(error => 
          filter.tags!.some(tag => error.tags.includes(tag))
        );
      }
      
      if (filter.resolved !== undefined) {
        errors = errors.filter(error => error.resolved === filter.resolved);
      }
      
      if (filter.startTime) {
        errors = errors.filter(error => error.timestamp >= filter.startTime!);
      }
      
      if (filter.endTime) {
        errors = errors.filter(error => error.timestamp <= filter.endTime!);
      }
    }
    
    // 按时间倒序排序
    return errors.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * 获取错误统计
   */
  getErrorStatistics() {
    const errors = Array.from(this.errors.values());
    const totalErrors = errors.reduce((sum, error) => sum + error.count, 0);
    
    const errorsByLevel: Record<ErrorLevel, number> = {
      [ErrorLevel.DEBUG]: 0,
      [ErrorLevel.INFO]: 0,
      [ErrorLevel.WARN]: 0,
      [ErrorLevel.ERROR]: 0,
      [ErrorLevel.FATAL]: 0
    };
    
    const errorsByCategory: Record<ErrorCategory, number> = {
      [ErrorCategory.NETWORK]: 0,
      [ErrorCategory.DATABASE]: 0,
      [ErrorCategory.FILESYSTEM]: 0,
      [ErrorCategory.BUSINESS_LOGIC]: 0,
      [ErrorCategory.VALIDATION]: 0,
      [ErrorCategory.AUTHENTICATION]: 0,
      [ErrorCategory.AUTHORIZATION]: 0,
      [ErrorCategory.SYSTEM]: 0,
      [ErrorCategory.UNKNOWN]: 0
    };
    
    errors.forEach(error => {
      errorsByLevel[error.level] += error.count;
      errorsByCategory[error.category] += error.count;
    });
    
    const topErrors = errors
      .map(error => ({ error, count: error.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    const resolvedErrors = errors.filter(error => error.resolved).length;
    const resolutionRate = errors.length > 0 ? resolvedErrors / errors.length : 0;
    
    return {
      totalErrors,
      errorsByLevel,
      errorsByCategory,
      topErrors,
      resolutionRate
    };
  }

  /**
   * 标记错误为已解决
   */
  resolveError(
    errorId: string,
    resolvedBy: string,
    resolution: string
  ): boolean {
    const error = this.errors.get(errorId);
    if (!error) {
      return false;
    }
    
    error.resolved = true;
    error.resolutionInfo = {
      resolvedAt: new Date(),
      resolvedBy,
      resolution
    };
    
    // 发出错误解决事件
    this.globalEventBus.emit('app.error' as keyof GlobalEvents, {
      error: new Error(`Error resolved: ${error.message}`),
      context: {
        errorId,
        resolvedBy,
        resolution,
        status: 'resolved'
      },
      timestamp: new Date()
    });
    
    return true;
  }

  /**
   * 批量标记错误为已解决
   */
  resolveErrors(
    errorIds: string[],
    resolvedBy: string,
    resolution: string
  ): number {
    let resolvedCount = 0;
    
    errorIds.forEach(errorId => {
      if (this.resolveError(errorId, resolvedBy, resolution)) {
        resolvedCount++;
      }
    });
    
    return resolvedCount;
  }

  /**
   * 清除旧错误
   */
  clearOldErrors(olderThan: Date): number {
    let clearedCount = 0;
    
    for (const [errorId, error] of this.errors.entries()) {
      if (error.timestamp < olderThan) {
        this.errors.delete(errorId);
        clearedCount++;
      }
    }
    
    return clearedCount;
  }

  /**
   * 生成错误ID
   */
  private generateErrorId(error: Error, category: ErrorCategory): string {
    return NodeIdGenerator.forError(`${category}_${error.message.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`);
  }

  /**
   * 生成分组键
   */
  private generateGroupKey(error: Error, category: ErrorCategory): string {
    const message = error.message.split('\n')[0].replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return `${category}_${message}`;
  }

  /**
   * 从操作推断错误类别
   */
  private inferCategoryFromOperation(operation: string): ErrorCategory {
    const op = operation.toLowerCase();
    
    if (op.includes('database') || op.includes('db') || op.includes('query')) {
      return ErrorCategory.DATABASE;
    }
    
    if (op.includes('file') || op.includes('fs') || op.includes('directory')) {
      return ErrorCategory.FILESYSTEM;
    }
    
    if (op.includes('network') || op.includes('http') || op.includes('api') || op.includes('request')) {
      return ErrorCategory.NETWORK;
    }
    
    if (op.includes('auth') || op.includes('login') || op.includes('user')) {
      return ErrorCategory.AUTHENTICATION;
    }
    
    if (op.includes('permission') || op.includes('access')) {
      return ErrorCategory.AUTHORIZATION;
    }
    
    if (op.includes('validate') || op.includes('check')) {
      return ErrorCategory.VALIDATION;
    }
    
    if (op.includes('business') || op.includes('logic') || op.includes('process')) {
      return ErrorCategory.BUSINESS_LOGIC;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  /**
   * 发出错误事件
   */
  private emitErrorEvent(
    error: Error,
    level: ErrorLevel,
    category: ErrorCategory,
    context: Record<string, any>,
    tags: string[],
    timestamp: Date
  ): void {
    this.globalEventBus.emit('app.error' as keyof GlobalEvents, {
      error,
      context: {
        level,
        category,
        ...context
      },
      timestamp
    });
  }

  /**
   * 记录错误到数据库
   */
  private recordErrorToDatabase(
    errorId: string,
    error: Error,
    level: ErrorLevel,
    category: ErrorCategory,
    context: Record<string, any>,
    tags: string[],
    timestamp: Date
  ): void {
    this.databaseEventManager.emitEvent({
      type: DatabaseEventType.ERROR_OCCURRED,
      timestamp,
      source: 'common',
      data: {
        errorId,
        level,
        category,
        errorMessage: error.message,
        stackTrace: error.stack,
        context,
        tags
      }
    });
  }
}

/**
 * 全局错误追踪实例
 */
export const globalEventErrorTracker = new EventErrorTracker();