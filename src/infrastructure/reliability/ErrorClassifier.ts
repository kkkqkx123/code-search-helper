export enum ErrorType {
  CONNECTION = 'connection',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  VALIDATION = 'validation',
  PERMISSION = 'permission',
  UNKNOWN = 'unknown'
}

export interface ErrorContext {
  component: string;
  operation: string;
  metadata?: Record<string, any>;
}

/**
 * 错误分类器 - 统一错误分类和处理策略
 */
export class ErrorClassifier {
  /**
   * 分类错误类型
   */
  static classify(error: Error): ErrorType {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.constructor.name.toLowerCase();

    // 连接错误
    if (this.isConnectionError(errorMessage, errorName)) {
      return ErrorType.CONNECTION;
    }

    // 超时错误
    if (this.isTimeoutError(errorMessage, errorName)) {
      return ErrorType.TIMEOUT;
    }

    // 速率限制错误
    if (this.isRateLimitError(errorMessage, errorName)) {
      return ErrorType.RATE_LIMIT;
    }

    // 资源耗尽错误
    if (this.isResourceExhaustedError(errorMessage, errorName)) {
      return ErrorType.RESOURCE_EXHAUSTED;
    }

    // 验证错误
    if (this.isValidationError(errorMessage, errorName)) {
      return ErrorType.VALIDATION;
    }

    // 权限错误
    if (this.isPermissionError(errorMessage, errorName)) {
      return ErrorType.PERMISSION;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * 判断错误是否可重试
   */
  static isRetryable(error: Error): boolean {
    const errorType = this.classify(error);
    
    switch (errorType) {
      case ErrorType.CONNECTION:
      case ErrorType.TIMEOUT:
      case ErrorType.RATE_LIMIT:
        return true;
      case ErrorType.RESOURCE_EXHAUSTED:
      case ErrorType.VALIDATION:
      case ErrorType.PERMISSION:
        return false;
      case ErrorType.UNKNOWN:
      default:
        // 未知错误默认可重试，但限制次数
        return true;
    }
  }

  /**
   * 获取重试延迟
   */
  static getRetryDelay(error: Error, attempt: number): number {
    const errorType = this.classify(error);
    const baseDelay = this.getBaseDelay(errorType);
    
    // 指数退避，但限制最大延迟
    const delay = baseDelay * Math.pow(2, attempt - 1);
    return Math.min(delay, 30000); // 最大30秒
  }

  /**
   * 获取最大重试次数
   */
  static getMaxRetries(error: Error): number {
    const errorType = this.classify(error);
    
    switch (errorType) {
      case ErrorType.CONNECTION:
        return 5;
      case ErrorType.TIMEOUT:
        return 3;
      case ErrorType.RATE_LIMIT:
        return 2;
      case ErrorType.RESOURCE_EXHAUSTED:
        return 1;
      case ErrorType.VALIDATION:
      case ErrorType.PERMISSION:
        return 0; // 不重试
      case ErrorType.UNKNOWN:
      default:
        return 2;
    }
  }

  /**
   * 判断是否为连接错误
   */
  private static isConnectionError(errorMessage: string, errorName: string): boolean {
    const connectionKeywords = [
      'connection', 'connect', 'network', 'socket', 'dns', 'host',
      'unreachable', 'refused', 'reset', 'broken', 'pipe'
    ];
    
    return connectionKeywords.some(keyword => 
      errorMessage.includes(keyword) || errorName.includes(keyword)
    );
  }

  /**
   * 判断是否为超时错误
   */
  private static isTimeoutError(errorMessage: string, errorName: string): boolean {
    const timeoutKeywords = [
      'timeout', 'timed out', 'time out', 'deadline', 'expired'
    ];
    
    return timeoutKeywords.some(keyword => 
      errorMessage.includes(keyword) || errorName.includes(keyword)
    );
  }

  /**
   * 判断是否为速率限制错误
   */
  private static isRateLimitError(errorMessage: string, errorName: string): boolean {
    const rateLimitKeywords = [
      'rate limit', 'too many requests', 'quota', 'throttle', '429'
    ];
    
    return rateLimitKeywords.some(keyword => 
      errorMessage.includes(keyword) || errorName.includes(keyword)
    );
  }

  /**
   * 判断是否为资源耗尽错误
   */
  private static isResourceExhaustedError(errorMessage: string, errorName: string): boolean {
    const resourceKeywords = [
      'memory', 'out of memory', 'oom', 'disk full', 'no space',
      'resource', 'exhausted', 'limit', 'capacity'
    ];
    
    return resourceKeywords.some(keyword => 
      errorMessage.includes(keyword) || errorName.includes(keyword)
    );
  }

  /**
   * 判断是否为验证错误
   */
  private static isValidationError(errorMessage: string, errorName: string): boolean {
    const validationKeywords = [
      'validation', 'invalid', 'malformed', 'schema', 'format',
      'required', 'missing', 'bad request', '400'
    ];
    
    return validationKeywords.some(keyword => 
      errorMessage.includes(keyword) || errorName.includes(keyword)
    );
  }

  /**
   * 判断是否为权限错误
   */
  private static isPermissionError(errorMessage: string, errorName: string): boolean {
    const permissionKeywords = [
      'permission', 'unauthorized', 'forbidden', 'access denied',
      'not allowed', '401', '403', 'auth'
    ];
    
    return permissionKeywords.some(keyword => 
      errorMessage.includes(keyword) || errorName.includes(keyword)
    );
  }

  /**
   * 获取基础延迟时间
   */
  private static getBaseDelay(errorType: ErrorType): number {
    switch (errorType) {
      case ErrorType.CONNECTION:
        return 1000; // 1秒
      case ErrorType.TIMEOUT:
        return 500; // 0.5秒
      case ErrorType.RATE_LIMIT:
        return 5000; // 5秒
      case ErrorType.RESOURCE_EXHAUSTED:
        return 10000; // 10秒
      default:
        return 1000; // 1秒
    }
  }

  /**
   * 创建错误报告
   */
  static createErrorReport(error: Error, context: ErrorContext): {
    type: ErrorType;
    message: string;
    context: ErrorContext;
    retryable: boolean;
    maxRetries: number;
    suggestedDelay: number;
    timestamp: Date;
  } {
    const errorType = this.classify(error);
    const maxRetries = this.getMaxRetries(error);
    
    return {
      type: errorType,
      message: error.message,
      context,
      retryable: this.isRetryable(error),
      maxRetries,
      suggestedDelay: this.getRetryDelay(error, 1),
      timestamp: new Date()
    };
  }
}