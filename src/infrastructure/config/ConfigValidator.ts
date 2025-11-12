import { InfrastructureConfig } from './types';

/**
 * 配置验证器
 * 提供基础设施配置的验证功能
 */
export class ConfigValidator {
  /**
   * 验证整个基础设施配置
   */
  static validate(config: InfrastructureConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证通用配置
    this.validateCommonConfig(config.common, errors);

    // 验证Qdrant配置
    this.validateQdrantConfig(config.qdrant, errors);

    // 验证Nebula配置
    this.validateNebulaConfig(config.nebula, errors);


    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 验证通用配置
   */
  private static validateCommonConfig(common: any, errors: string[]): void {
    if (!common) {
      errors.push('Common configuration is required');
      return;
    }

    // 验证健康检查间隔
    if (typeof common.healthCheckInterval !== 'number' || common.healthCheckInterval < 1000) {
      errors.push('Common health check interval must be a number and at least 1000ms');
    }

    // 验证优雅关闭超时时间
    if (typeof common.gracefulShutdownTimeout !== 'number' || common.gracefulShutdownTimeout < 1000) {
      errors.push('Common graceful shutdown timeout must be a number and at least 1000ms');
    }

    // 验证日志级别
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(common.logLevel)) {
      errors.push(`Common log level must be one of: ${validLogLevels.join(', ')}`);
    }

    // 验证布尔值
    const booleanFields = ['enableCache', 'enableMonitoring', 'enableBatching', 'enableHealthChecks'];
    for (const field of booleanFields) {
      if (typeof common[field] !== 'boolean') {
        errors.push(`Common ${field} must be a boolean`);
      }
    }
  }

  /**
   * 验证Qdrant配置
   */
  private static validateQdrantConfig(qdrant: any, errors: string[]): void {
    if (!qdrant) {
      errors.push('Qdrant configuration is required');
      return;
    }

    // 验证缓存配置
    this.validateCacheConfig(qdrant.cache, 'Qdrant', errors);

    // 验证性能配置
    this.validatePerformanceConfig(qdrant.performance, 'Qdrant', errors);

    // 验证批处理配置
    this.validateBatchConfig(qdrant.batch, 'Qdrant', errors);

    // 验证向量配置（如果存在）
    if (qdrant.vector) {
      this.validateVectorConfig(qdrant.vector, 'Qdrant', errors);
    }
  }

  /**
   * 验证Nebula配置
   */
  private static validateNebulaConfig(nebula: any, errors: string[]): void {
    if (!nebula) {
      errors.push('Nebula configuration is required');
      return;
    }

    // 验证缓存配置
    this.validateCacheConfig(nebula.cache, 'Nebula', errors);

    // 验证性能配置
    this.validatePerformanceConfig(nebula.performance, 'Nebula', errors);

    // 验证批处理配置
    this.validateBatchConfig(nebula.batch, 'Nebula', errors);

    // 验证图配置（如果存在）
    if (nebula.graph) {
      this.validateGraphConfig(nebula.graph, 'Nebula', errors);
    }
  }

  /**
   * 验证缓存配置
   */
  private static validateCacheConfig(cache: any, service: string, errors: string[]): void {
    if (!cache) {
      errors.push(`${service} cache configuration is required`);
      return;
    }

    // 验证TTL
    if (typeof cache.defaultTTL !== 'number' || cache.defaultTTL < 1000) {
      errors.push(`${service} cache default TTL must be a number and at least 1000ms`);
    }

    // 验证最大条目数
    if (typeof cache.maxEntries !== 'number' || cache.maxEntries < 1) {
      errors.push(`${service} cache max entries must be a number and at least 1`);
    }

    // 验证清理间隔
    if (typeof cache.cleanupInterval !== 'number' || cache.cleanupInterval < 1000) {
      errors.push(`${service} cache cleanup interval must be a number and at least 1000ms`);
    }

    // 验证统计启用状态
    if (typeof cache.enableStats !== 'boolean') {
      errors.push(`${service} cache enableStats must be a boolean`);
    }
  }

  /**
   * 验证性能配置
   */
  private static validatePerformanceConfig(performance: any, service: string, errors: string[]): void {
    if (!performance) {
      errors.push(`${service} performance configuration is required`);
      return;
    }

    // 验证监控间隔
    if (typeof performance.monitoringInterval !== 'number' || performance.monitoringInterval < 1000) {
      errors.push(`${service} performance monitoring interval must be a number and at least 1000ms`);
    }

    // 验证指标保留周期
    if (typeof performance.metricsRetentionPeriod !== 'number' || performance.metricsRetentionPeriod < 60000) {
      errors.push(`${service} performance metrics retention period must be a number and at least 60000ms`);
    }

    // 验证详细日志启用状态
    if (typeof performance.enableDetailedLogging !== 'boolean') {
      errors.push(`${service} performance enableDetailedLogging must be a boolean`);
    }

    // 验证性能阈值
    if (!performance.performanceThresholds) {
      errors.push(`${service} performance thresholds configuration is required`);
    } else {
      const thresholds = performance.performanceThresholds;
      if (typeof thresholds.queryExecutionTime !== 'number' || thresholds.queryExecutionTime < 100) {
        errors.push(`${service} performance query execution time threshold must be a number and at least 100ms`);
      }
      if (typeof thresholds.memoryUsage !== 'number' || thresholds.memoryUsage < 0 || thresholds.memoryUsage > 100) {
        errors.push(`${service} performance memory usage threshold must be a number between 0 and 100`);
      }
      if (typeof thresholds.responseTime !== 'number' || thresholds.responseTime < 1) {
        errors.push(`${service} performance response time threshold must be a number and at least 1ms`);
      }
    }
  }

  /**
   * 验证批处理配置
   */
  private static validateBatchConfig(batch: any, service: string, errors: string[]): void {
    if (!batch) {
      errors.push(`${service} batch configuration is required`);
      return;
    }

    // 验证最大并发操作数
    if (typeof batch.maxConcurrentOperations !== 'number' || batch.maxConcurrentOperations < 1 || batch.maxConcurrentOperations > 100) {
      errors.push(`${service} batch max concurrent operations must be a number between 1 and 100`);
    }

    // 验证默认批处理大小
    if (typeof batch.defaultBatchSize !== 'number' || batch.defaultBatchSize < 1 || batch.defaultBatchSize > 10000) {
      errors.push(`${service} batch default batch size must be a number between 1 and 10000`);
    }

    // 验证最大批处理大小
    if (typeof batch.maxBatchSize !== 'number' || batch.maxBatchSize < 1 || batch.maxBatchSize > 10000) {
      errors.push(`${service} batch max batch size must be a number between 1 and 10000`);
    }

    // 验证最小批处理大小
    if (typeof batch.minBatchSize !== 'number' || batch.minBatchSize < 1 || batch.minBatchSize > 1000) {
      errors.push(`${service} batch min batch size must be a number between 1 and 1000`);
    }

    // 验证内存阈值
    if (typeof batch.memoryThreshold !== 'number' || batch.memoryThreshold < 0.1 || batch.memoryThreshold > 0.95) {
      errors.push(`${service} batch memory threshold must be a number between 0.1 and 0.95`);
    }

    // 验证处理超时时间
    if (typeof batch.processingTimeout !== 'number' || batch.processingTimeout < 1000) {
      errors.push(`${service} batch processing timeout must be a number and at least 1000ms`);
    }

    // 验证重试次数
    if (typeof batch.retryAttempts !== 'number' || batch.retryAttempts < 0 || batch.retryAttempts > 10) {
      errors.push(`${service} batch retry attempts must be a number between 0 and 10`);
    }

    // 验证重试延迟
    if (typeof batch.retryDelay !== 'number' || batch.retryDelay < 100) {
      errors.push(`${service} batch retry delay must be a number and at least 100ms`);
    }

    // 验证自适应批处理启用状态
    if (typeof batch.adaptiveBatchingEnabled !== 'boolean') {
      errors.push(`${service} batch adaptiveBatchingEnabled must be a boolean`);
    }

    // 验证性能阈值
    if (typeof batch.performanceThreshold !== 'number' || batch.performanceThreshold < 100) {
      errors.push(`${service} batch performance threshold must be a number and at least 100ms`);
    }

    // 验证调整因子
    if (typeof batch.adjustmentFactor !== 'number' || batch.adjustmentFactor < 0.01 || batch.adjustmentFactor > 1.0) {
      errors.push(`${service} batch adjustment factor must be a number between 0.01 and 1.0`);
    }
  }


  /**
   * 验证向量配置
   */
  private static validateVectorConfig(vector: any, service: string, errors: string[]): void {
    if (!vector) {
      return; // 向量配置是可选的
    }

    // 验证默认集合
    if (vector.defaultCollection && typeof vector.defaultCollection !== 'string') {
      errors.push(`${service} vector default collection must be a string`);
    }

    // 验证集合选项
    if (vector.collectionOptions) {
      const collectionOptions = vector.collectionOptions;
      if (collectionOptions.vectorSize && (typeof collectionOptions.vectorSize !== 'number' || collectionOptions.vectorSize < 1)) {
        errors.push(`${service} vector collection vectorSize must be a number and at least 1`);
      }
      if (collectionOptions.distance && !['Cosine', 'Euclidean', 'DotProduct'].includes(collectionOptions.distance)) {
        errors.push(`${service} vector collection distance must be one of: Cosine, Euclidean, DotProduct`);
      }
    }

    // 验证搜索选项
    if (vector.searchOptions) {
      const searchOptions = vector.searchOptions;
      if (searchOptions.limit && (typeof searchOptions.limit !== 'number' || searchOptions.limit < 1)) {
        errors.push(`${service} vector search limit must be a number and at least 1`);
      }
      if (searchOptions.threshold && (typeof searchOptions.threshold !== 'number' || searchOptions.threshold < 0 || searchOptions.threshold > 1)) {
        errors.push(`${service} vector search threshold must be a number between 0 and 1`);
      }
      if (searchOptions.exactSearch !== undefined && typeof searchOptions.exactSearch !== 'boolean') {
        errors.push(`${service} vector search exactSearch must be a boolean`);
      }
    }
  }

  /**
   * 验证图配置
   */
  private static validateGraphConfig(graph: any, service: string, errors: string[]): void {
    if (!graph) {
      errors.push(`${service} graph configuration is required`);
      return;
    }

    // 验证默认空间
    if (graph.defaultSpace && typeof graph.defaultSpace !== 'string') {
      errors.push(`${service} graph default space must be a string`);
    }

    // 验证空间选项
    if (graph.spaceOptions) {
      const spaceOptions = graph.spaceOptions;
      if (spaceOptions.partitionNum && (typeof spaceOptions.partitionNum !== 'number' || spaceOptions.partitionNum < 1)) {
        errors.push(`${service} graph space partitionNum must be a number and at least 1`);
      }
      if (spaceOptions.replicaFactor && (typeof spaceOptions.replicaFactor !== 'number' || spaceOptions.replicaFactor < 1)) {
        errors.push(`${service} graph space replicaFactor must be a number and at least 1`);
      }
      if (spaceOptions.vidType && !['FIXED_STRING', 'INT64'].includes(spaceOptions.vidType)) {
        errors.push(`${service} graph space vidType must be one of: FIXED_STRING, INT64`);
      }
    }

    // 验证查询选项
    if (graph.queryOptions) {
      const queryOptions = graph.queryOptions;
      if (queryOptions.timeout && (typeof queryOptions.timeout !== 'number' || queryOptions.timeout < 1000)) {
        errors.push(`${service} graph query timeout must be a number and at least 1000ms`);
      }
      if (queryOptions.retryAttempts && (typeof queryOptions.retryAttempts !== 'number' || queryOptions.retryAttempts < 0)) {
        errors.push(`${service} graph query retry attempts must be a number and at least 0`);
      }
    }

    // 验证模式管理选项
    if (graph.schemaManagement) {
      const schemaManagement = graph.schemaManagement;
      if (schemaManagement.autoCreateTags !== undefined && typeof schemaManagement.autoCreateTags !== 'boolean') {
        errors.push(`${service} graph schema autoCreateTags must be a boolean`);
      }
      if (schemaManagement.autoCreateEdges !== undefined && typeof schemaManagement.autoCreateEdges !== 'boolean') {
        errors.push(`${service} graph schema autoCreateEdges must be a boolean`);
      }
    }
  }

}

/**
 * 配置验证工具
 * 提供便捷的配置验证方法
 */
export class ConfigValidationUtil {
  /**
   * 验证配置并根据结果记录日志
   */
  static validateAndLog(config: InfrastructureConfig, logger?: { info: (msg: string, meta?: any) => void; error: (msg: string, meta?: any) => void }): boolean {
    const validationResult = ConfigValidator.validate(config);
    
    if (validationResult.isValid) {
      if (logger) {
        logger.info('Configuration validation passed');
      } else {
        console.log('Configuration validation passed');
      }
      return true;
    } else {
      if (logger) {
        logger.error('Configuration validation failed', { errors: validationResult.errors });
      } else {
        console.error('Configuration validation failed:', validationResult.errors);
      }
      return false;
    }
  }

  /**
   * 验证配置并抛出错误（如果验证失败）
   */
  static validateAndThrow(config: InfrastructureConfig): void {
    const validationResult = ConfigValidator.validate(config);
    
    if (!validationResult.isValid) {
      throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`);
    }
  }
}