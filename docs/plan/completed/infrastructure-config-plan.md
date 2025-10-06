# 基础设施配置管理改进方案

## 方案审查与评估

经过对代码库的详细分析，原方案总体思路正确，但需要进一步完善和细化。以下是经过优化的完整改进方案：

### 现状分析

#### 1. 现有问题
- `InfrastructureManager` 构造函数中硬编码配置（第59-182行）
- 配置结构不一致：`InfrastructureConfigService` 使用简化配置，而 `InfrastructureManager` 使用完整配置结构
- 缺乏统一的配置加载优先级策略
- 缺少配置验证、热更新和监控机制

#### 2. 现有架构优势
- 完善的分层配置服务架构：BaseConfigService → 具体配置服务
- 良好的依赖注入和注册器模式
- 配置服务间解耦设计合理

### 改进方案

#### 第一阶段：统一配置类型定义

#### 1. 重构 `InfrastructureConfigService` 配置类型
首先更新 `src/infrastructure/config/types.ts`，统一配置结构：

```typescript
// 新增基础设施配置接口，与 InfrastructureManager 保持一致
export interface InfrastructureConfig {
  common: CommonConfig;
  qdrant: DatabaseInfrastructureConfig;
  nebula: DatabaseInfrastructureConfig & { graph: GraphSpecificConfig };
  vector?: DatabaseInfrastructureConfig & { vector?: VectorSpecificConfig };
  graph?: DatabaseInfrastructureConfig & { graph: GraphSpecificConfig };
  transaction: TransactionConfig;
}

export interface DatabaseInfrastructureConfig {
  cache: CacheConfig;
  performance: PerformanceConfig;
  batch: BatchConfig;
  connection: ConnectionConfig;
}
```

#### 2. 在 `src/types.ts` 中添加类型定义
在 `TYPES` 对象的 "配置服务" 部分添加：
```typescript
// 配置服务
EnvironmentConfigService: Symbol.for('EnvironmentConfigService'),
QdrantConfigService: Symbol.for('QdrantConfigService'),
EmbeddingConfigService: Symbol.for('EmbeddingConfigService'),
LoggingConfigService: Symbol.for('LoggingConfigService'),
MonitoringConfigService: Symbol.for('MonitoringConfigService'),
FileProcessingConfigService: Symbol.for('FileProcessingConfigService'),
BatchProcessingConfigService: Symbol.for('BatchProcessingConfigService'),
RedisConfigService: Symbol.for('RedisConfigService'),
ProjectConfigService: Symbol.for('ProjectConfigService'),
IndexingConfigService: Symbol.for('IndexingConfigService'),
LSPConfigService: Symbol.for('LSPConfigService'),
SemgrepConfigService: Symbol.for('SemgrepConfigService'),
TreeSitterConfigService: Symbol.for('TreeSitterConfigService'),
NebulaConfigService: Symbol.for('NebulaConfigService'),
InfrastructureConfigService: Symbol.for('InfrastructureConfigService'), // 新增
```

#### 3. 细化配置服务模块新增基础设施设置管理方案

在config服务模块中新增基础设施设置管理，具体方案如下：

**新增配置服务类：**

```typescript
// src/config/service/InfrastructureSettingsConfigService.ts
import { injectable, inject } from 'inversify';
import { BaseConfigService } from './BaseConfigService';
import { TYPES } from '../../types';
import { InfrastructureSettingsConfig } from '../ConfigTypes';

@injectable()
export class InfrastructureSettingsConfigService extends BaseConfigService<InfrastructureSettingsConfig> {
  constructor(
    @inject(TYPES.EnvironmentConfigService) environmentConfigService: EnvironmentConfigService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super('infrastructureSettings', environmentConfigService, logger);
  }

  protected getDefaultConfig(): InfrastructureSettingsConfig {
    return {
      // 基础设施设置默认配置
      enableDynamicConfig: true,
      configReloadInterval: 300000, // 5分钟
      maxConfigReloadRetries: 3,
      configValidationEnabled: true,
      hotReloadEnabled: false,
      configSources: ['environment', 'file', 'database'],
      fallbackToDefaults: true,
      configChangeNotification: true,
      
      // 配置优先级设置
      configPriority: {
        environment: 1,
        file: 2,
        database: 3,
        default: 4
      },
      
      // 配置验证设置
      validation: {
        enabled: true,
        strictMode: false,
        validateOnLoad: true,
        validateOnUpdate: true,
        maxValidationErrors: 10,
        allowWarnings: true
      },
      
      // 配置缓存设置
      caching: {
        enabled: true,
        ttl: 3600000, // 1小时
        maxSize: 100,
        cleanupInterval: 60000 // 1分钟
      },
      
      // 配置监控设置
      monitoring: {
        enabled: true,
        trackChanges: true,
        trackPerformance: true,
        alertOnFailures: true,
        metricsRetention: 86400000 // 24小时
      }
    };
  }

  public async initialize(): Promise<void> {
    await super.initialize();
    this.logger.info('Infrastructure settings configuration service initialized');
  }

  public isDynamicConfigEnabled(): boolean {
    return this.config.enableDynamicConfig;
  }

  public isHotReloadEnabled(): boolean {
    return this.config.hotReloadEnabled;
  }

  public getConfigReloadInterval(): number {
    return this.config.configReloadInterval;
  }

  public getConfigSources(): string[] {
    return this.config.configSources;
  }

  public getConfigPriority(): Record<string, number> {
    return this.config.configPriority;
  }

  public isValidationEnabled(): boolean {
    return this.config.validation?.enabled ?? true;
  }

  public isCachingEnabled(): boolean {
    return this.config.caching?.enabled ?? true;
  }

  public isMonitoringEnabled(): boolean {
    return this.config.monitoring?.enabled ?? true;
  }
}
```

**新增配置类型定义：**

```typescript
// src/config/ConfigTypes.ts
export interface InfrastructureSettingsConfig {
  enableDynamicConfig: boolean;
  configReloadInterval: number;
  maxConfigReloadRetries: number;
  configValidationEnabled: boolean;
  hotReloadEnabled: boolean;
  configSources: string[];
  fallbackToDefaults: boolean;
  configChangeNotification: boolean;
  
  configPriority: {
    environment: number;
    file: number;
    database: number;
    default: number;
  };
  
  validation: {
    enabled: boolean;
    strictMode: boolean;
    validateOnLoad: boolean;
    validateOnUpdate: boolean;
    maxValidationErrors: number;
    allowWarnings: boolean;
  };
  
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
    cleanupInterval: number;
  };
  
  monitoring: {
    enabled: boolean;
    trackChanges: boolean;
    trackPerformance: boolean;
    alertOnFailures: boolean;
    metricsRetention: number;
  };
}
```

**在配置服务索引中导出：**

```typescript
// src/config/service/index.ts
export { InfrastructureSettingsConfigService } from './InfrastructureSettingsConfigService';
export type { InfrastructureSettingsConfig } from '../ConfigTypes';
```

**在ConfigService中集成：**

```typescript
// src/config/ConfigService.ts
export class ConfigService {
  private infrastructureSettingsConfigService: InfrastructureSettingsConfigService;
  
  constructor(
    environmentConfigService: EnvironmentConfigService,
    logger: LoggerService
  ) {
    // 初始化基础设施设置配置服务
    this.infrastructureSettingsConfigService = new InfrastructureSettingsConfigService(
      environmentConfigService,
      logger
    );
  }
  
  public getInfrastructureSettings(): InfrastructureSettingsConfigService {
    return this.infrastructureSettingsConfigService;
  }
}
```

#### 第二阶段：实现配置服务注册

更新 `InfrastructureServiceRegistrar.ts`，添加基础设施配置服务注册：

```typescript
import { InfrastructureConfigService } from '../../infrastructure/config/InfrastructureConfigService';

export class InfrastructureServiceRegistrar {
  static register(container: Container): void {
    // 基础设施服务
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    
    // 图服务基础设施
    container.bind<GraphCacheService>(TYPES.GraphCacheService).to(GraphCacheService).inSingletonScope();
    container.bind<GraphPerformanceMonitor>(TYPES.GraphPerformanceMonitor).to(GraphPerformanceMonitor).inSingletonScope();
    container.bind<GraphBatchOptimizer>(TYPES.GraphBatchOptimizer).to(GraphBatchOptimizer).inSingletonScope();
    container.bind<GraphQueryValidator>(TYPES.GraphQueryValidator).to(GraphQueryValidator).inSingletonScope();
    
    // 基础设施配置服务
    container.bind<InfrastructureConfigService>(TYPES.InfrastructureConfigService)
      .to(InfrastructureConfigService).inSingletonScope();
  }
}
```

#### 第三阶段：重构 InfrastructureConfigService

更新 `src/infrastructure/config/InfrastructureConfigService.ts`：

```typescript
@injectable()
export class InfrastructureConfigService {
  private logger: LoggerService;
  private configService: ConfigService;
  private config: InfrastructureConfig;
  private configLoaders: ConfigLoader[];

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.configService = configService;
    this.configLoaders = [
      new EnvironmentConfigLoader(),
      new FileConfigLoader(),
      new DatabaseConfigLoader(),
      new DefaultConfigLoader()
    ];
    
    // 初始化配置
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): InfrastructureConfig {
    let finalConfig: InfrastructureConfig | null = null;
    
    // 按优先级加载配置
    for (const loader of this.configLoaders) {
      try {
        const loadedConfig = loader.load();
        if (loadedConfig) {
          if (!finalConfig) {
            finalConfig = loadedConfig;
          } else {
            // 合并配置（后面的配置覆盖前面的）
            finalConfig = this.mergeConfigurations(finalConfig, loadedConfig);
          }
          this.logger.info(`Configuration loaded from ${loader.getName()}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to load configuration from ${loader.getName()}`, {
          error: (error as Error).message
        });
      }
    }
    
    if (!finalConfig) {
      throw new Error('Failed to load any configuration');
    }
    
    return finalConfig;
  }

  private mergeConfigurations(base: InfrastructureConfig, override: Partial<InfrastructureConfig>): InfrastructureConfig {
    return deepMerge(base, override);
  }

  getConfig(): InfrastructureConfig {
    return this.config;
  }

  updateConfig(updates: Partial<InfrastructureConfig>): void {
    this.config = this.mergeConfigurations(this.config, updates);
    this.logger.info('Infrastructure configuration updated');
  }
}
```

#### 第四阶段：重构 InfrastructureManager

修改 `InfrastructureManager` 构造函数，实现智能配置加载：

```typescript
@injectable()
export class InfrastructureManager {
  private logger: LoggerService;
  private databaseInfrastructures: Map<DatabaseType, IDatabaseInfrastructure>;
  private transactionCoordinator: TransactionCoordinator;
  private config: InfrastructureConfig;
  private configValidator: ConfigValidator;
  private infrastructureConfigService: InfrastructureConfigService;
  private configUpdateCallbacks: Array<() => void> = [];
  
  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.CacheService) cacheService: any,
    @inject(TYPES.PerformanceMonitor) performanceMonitor: any,
    @inject(TYPES.BatchOptimizer) batchOptimizer: any,
    @inject(TYPES.HealthChecker) healthChecker: any,
    transactionCoordinator: TransactionCoordinator,
    databaseConnectionPool: DatabaseConnectionPool,
    @inject(TYPES.InfrastructureConfigService) infrastructureConfigService: InfrastructureConfigService
  ) {
    this.logger = logger;
    this.databaseInfrastructures = new Map();
    this.transactionCoordinator = transactionCoordinator;
    this.infrastructureConfigService = infrastructureConfigService;
    
    // 初始化配置
    this.initializeConfiguration();
    
    // 创建配置验证器
    this.configValidator = new ConfigValidator(this.logger);
    
    // 验证配置
    this.validateConfiguration(this.config, 'configuration');
    
    // 创建数据库基础设施实例
    this.createDatabaseInfrastructures(
      cacheService,
      performanceMonitor,
      batchOptimizer,
      healthChecker,
      databaseConnectionPool
    );
    
    // 注册配置变更监听器
    this.registerConfigUpdateListener();
    
    this.logger.info('Infrastructure manager initialized with dynamic configuration');
  }

  private initializeConfiguration(): void {
    try {
      // 从配置服务获取配置
      this.config = this.infrastructureConfigService.getConfig();
      this.logger.info('Infrastructure configuration loaded from InfrastructureConfigService', {
        configSource: 'configuration-service',
        configKeys: this.getConfigKeys(this.config)
      });
    } catch (error) {
      // 配置服务不可用时的降级策略
      this.logger.error('Failed to load configuration from InfrastructureConfigService', {
        error: (error as Error).message,
        fallbackStrategy: 'default-configuration'
      });
      
      // 使用默认配置作为后备
      this.config = this.getDefaultConfiguration();
      this.logger.warn('Using default infrastructure configuration as fallback');
    }
  }

  private registerConfigUpdateListener(): void {
    // 注册配置更新监听器（如果配置服务支持）
    if (this.infrastructureConfigService.onConfigUpdate) {
      this.infrastructureConfigService.onConfigUpdate((newConfig) => {
        this.logger.info('Infrastructure configuration update detected');
        this.handleConfigurationUpdate(newConfig);
      });
    }
  }

  private handleConfigurationUpdate(newConfig: InfrastructureConfig): void {
    try {
      // 验证新配置
      this.validateConfiguration(newConfig, 'configuration-update');
      
      // 更新配置
      const oldConfig = this.config;
      this.config = newConfig;
      
      // 应用配置变更
      this.applyConfigurationChanges(oldConfig, newConfig);
      
      this.logger.info('Infrastructure configuration updated successfully', {
        updatedKeys: this.getUpdatedKeys(oldConfig, newConfig)
      });
      
      // 触发配置更新回调
      this.triggerConfigUpdateCallbacks();
      
    } catch (error) {
      this.logger.error('Failed to update infrastructure configuration', {
        error: (error as Error).message,
        rollbackTo: 'previous-configuration'
      });
      
      // 回滚到之前的配置
      // 这里可以实现更复杂的回滚逻辑
    }
  }

  private getDefaultConfiguration(): InfrastructureConfig {
    return {
      common: {
        enableCache: true,
        enableMonitoring: true,
        enableBatching: true,
        logLevel: 'info',
        enableHealthChecks: true,
        healthCheckInterval: 30000,
        gracefulShutdownTimeout: 10000
      },
      qdrant: {
        cache: {
          defaultTTL: 300000,
          maxEntries: 10000,
          cleanupInterval: 60000,
          enableStats: true,
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: 30000,
          metricsRetentionPeriod: 86400000,
          enableDetailedLogging: true,
          performanceThresholds: {
            queryExecutionTime: 1000,
            memoryUsage: 80,
            responseTime: 500
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: 5,
          defaultBatchSize: 50,
          maxBatchSize: 500,
          minBatchSize: 10,
          memoryThreshold: 80,
          processingTimeout: 300000,
          retryAttempts: 3,
          retryDelay: 1000,
          adaptiveBatchingEnabled: true,
          performanceThreshold: 1000,
          adjustmentFactor: 0.1,
          databaseSpecific: {}
        },
        connection: {
          maxConnections: 10,
          minConnections: 2,
          connectionTimeout: 30000,
          idleTimeout: 300000,
          acquireTimeout: 10000,
          validationInterval: 60000,
          enableConnectionPooling: true,
          databaseSpecific: {}
        }
      },
      nebula: {
        cache: {
          defaultTTL: 300000,
          maxEntries: 10000,
          cleanupInterval: 60000,
          enableStats: true,
          databaseSpecific: {}
        },
        performance: {
          monitoringInterval: 30000,
          metricsRetentionPeriod: 86400000,
          enableDetailedLogging: true,
          performanceThresholds: {
            queryExecutionTime: 1000,
            memoryUsage: 80,
            responseTime: 500
          },
          databaseSpecific: {}
        },
        batch: {
          maxConcurrentOperations: 5,
          defaultBatchSize: 50,
          maxBatchSize: 500,
          minBatchSize: 10,
          memoryThreshold: 80,
          processingTimeout: 300000,
          retryAttempts: 3,
          retryDelay: 1000,
          adaptiveBatchingEnabled: true,
          performanceThreshold: 1000,
          adjustmentFactor: 0.1,
          databaseSpecific: {}
        },
        connection: {
          maxConnections: 10,
          minConnections: 2,
          connectionTimeout: 30000,
          idleTimeout: 300000,
          acquireTimeout: 10000,
          validationInterval: 60000,
          enableConnectionPooling: true,
          databaseSpecific: {}
        },
        graph: {
          defaultSpace: 'default',
          spaceOptions: {
            partitionNum: 10,
            replicaFactor: 1,
            vidType: 'FIXED_STRING'
          },
          queryOptions: {
            timeout: 30000,
            retryAttempts: 3
          },
          schemaManagement: {
            autoCreateTags: false,
            autoCreateEdges: false
          }
        }
      },
      transaction: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        enableTwoPhaseCommit: true,
        maxConcurrentTransactions: 100,
        deadlockDetectionTimeout: 5000
      }
    };
  }

  // 辅助方法
  private getConfigKeys(config: any, prefix = ''): string[] {
    const keys: string[] = [];
    for (const key in config) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof config[key] === 'object' && config[key] !== null) {
        keys.push(...this.getConfigKeys(config[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    return keys;
  }

  private getUpdatedKeys(oldConfig: any, newConfig: any, prefix = ''): string[] {
    const updatedKeys: string[] = [];
    
    // 检查所有键
    const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(newConfig)]);
    
    for (const key of allKeys) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (!(key in oldConfig)) {
        updatedKeys.push(`${fullKey} [added]`);
      } else if (!(key in newConfig)) {
        updatedKeys.push(`${fullKey} [removed]`);
      } else if (typeof oldConfig[key] === 'object' && typeof newConfig[key] === 'object') {
        const nestedChanges = this.getUpdatedKeys(oldConfig[key], newConfig[key], fullKey);
        updatedKeys.push(...nestedChanges);
      } else if (oldConfig[key] !== newConfig[key]) {
        updatedKeys.push(`${fullKey} [changed: ${oldConfig[key]} -> ${newConfig[key]}]`);
      }
    }
    
    return updatedKeys;
  }

  // 注册配置更新回调
  public onConfigUpdate(callback: () => void): void {
    this.configUpdateCallbacks.push(callback);
  }

  private triggerConfigUpdateCallbacks(): void {
    this.configUpdateCallbacks.forEach(callback => {
      try {
        callback();
      } catch (error) {
        this.logger.error('Error in configuration update callback', {
          error: (error as Error).message
        });
      }
    });
  }
}
```

#### 第五阶段：实现配置验证与错误处理

增强配置验证机制，确保配置的安全性和一致性：

```typescript
export class ConfigValidator {
  private logger: LoggerService;
  private validationRules: Map<string, ValidationRule[]>;

  constructor(logger: LoggerService) {
    this.logger = logger;
    this.validationRules = this.initializeValidationRules();
  }

  private initializeValidationRules(): Map<string, ValidationRule[]> {
    const rules = new Map<string, ValidationRule[]>();

    // 通用配置验证规则
    rules.set('common.healthCheckInterval', [
      { type: 'range', min: 5000, max: 300000, message: '健康检查间隔必须在5秒到5分钟之间' }
    ]);

    rules.set('common.gracefulShutdownTimeout', [
      { type: 'range', min: 1000, max: 60000, message: '优雅关闭超时必须在1秒到1分钟之间' }
    ]);

    // 数据库连接配置验证规则
    rules.set('*.connection.maxConnections', [
      { type: 'range', min: 1, max: 100, message: '最大连接数必须在1到100之间' }
    ]);

    rules.set('*.connection.connectionTimeout', [
      { type: 'range', min: 1000, max: 60000, message: '连接超时必须在1秒到1分钟之间' }
    ]);

    // 性能配置验证规则
    rules.set('*.performance.monitoringInterval', [
      { type: 'range', min: 5000, max: 300000, message: '监控间隔必须在5秒到5分钟之间' }
    ]);

    // 批处理配置验证规则
    rules.set('*.batch.maxConcurrentOperations', [
      { type: 'range', min: 1, max: 50, message: '最大并发操作数必须在1到50之间' }
    ]);

    rules.set('*.batch.maxBatchSize', [
      { type: 'range', min: 10, max: 1000, message: '最大批处理大小必须在10到1000之间' }
    ]);

    return rules;
  }

  public validateConfiguration(config: any, context: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      // 验证配置结构
      this.validateStructure(config, errors);

      // 验证配置值
      this.validateValues(config, errors, warnings);

      // 验证配置依赖关系
      this.validateDependencies(config, errors);

      // 验证配置一致性
      this.validateConsistency(config, errors);

      const result: ValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        timestamp: Date.now()
      };

      this.logValidationResult(result, context);
      return result;

    } catch (error) {
      this.logger.error('Configuration validation failed with unexpected error', {
        error: (error as Error).message,
        context
      });

      return {
        isValid: false,
        errors: [{
          path: 'validation',
          message: `配置验证过程中发生错误: ${(error as Error).message}`,
          value: null,
          rule: 'validation-process'
        }],
        warnings: [],
        timestamp: Date.now()
      };
    }
  }

  private validateStructure(config: any, errors: ValidationError[]): void {
    // 验证必需的配置项
    const requiredPaths = [
      'common',
      'qdrant',
      'nebula',
      'transaction'
    ];

    for (const path of requiredPaths) {
      if (!this.hasPath(config, path)) {
        errors.push({
          path,
          message: `缺少必需的配置项: ${path}`,
          value: undefined,
          rule: 'required'
        });
      }
    }

    // 验证配置类型
    this.validateTypes(config, errors);
  }

  private validateValues(config: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    for (const [path, rules] of this.validationRules) {
      const value = this.getValueByPath(config, path);
      if (value !== undefined) {
        for (const rule of rules) {
          this.applyValidationRule(path, value, rule, errors, warnings);
        }
      }
    }
  }

  private validateDependencies(config: any, errors: ValidationError[]): void {
    // 验证配置依赖关系
    if (config.common?.enableCache && !config.qdrant?.cache) {
      errors.push({
        path: 'qdrant.cache',
        message: '启用缓存时，Qdrant缓存配置不能为空',
        value: config.qdrant?.cache,
        rule: 'dependency'
      });
    }

    if (config.common?.enableBatching && !config.qdrant?.batch) {
      errors.push({
        path: 'qdrant.batch',
        message: '启用批处理时，Qdrant批处理配置不能为空',
        value: config.qdrant?.batch,
        rule: 'dependency'
      });
    }
  }

  private validateConsistency(config: any, errors: ValidationError[]): void {
    // 验证数据库特定配置的一致性
    const databases = ['qdrant', 'nebula'];
    
    for (const db of databases) {
      const dbConfig = config[db];
      if (dbConfig) {
        // 验证连接池配置
        if (dbConfig.connection?.minConnections > dbConfig.connection?.maxConnections) {
          errors.push({
            path: `${db}.connection`,
            message: '最小连接数不能大于最大连接数',
            value: {
              min: dbConfig.connection.minConnections,
              max: dbConfig.connection.maxConnections
            },
            rule: 'consistency'
          });
        }

        // 验证批处理配置
        if (dbConfig.batch?.minBatchSize > dbConfig.batch?.maxBatchSize) {
          errors.push({
            path: `${db}.batch`,
            message: '最小批处理大小不能大于最大批处理大小',
            value: {
              min: dbConfig.batch.minBatchSize,
              max: dbConfig.batch.maxBatchSize
            },
            rule: 'consistency'
          });
        }
      }
    }
  }

  // 辅助验证方法
  private hasPath(obj: any, path: string): boolean {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) {
        return false;
      }
      current = current[key];
    }
    
    return true;
  }

  private getValueByPath(obj: any, path: string): any {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[key];
    }
    
    return current;
  }

  private applyValidationRule(path: string, value: any, rule: ValidationRule, errors: ValidationError[], warnings: ValidationWarning[]): void {
    switch (rule.type) {
      case 'range':
        if (typeof value !== 'number' || value < rule.min! || value > rule.max!) {
          errors.push({
            path,
            message: rule.message,
            value,
            rule: 'range'
          });
        }
        break;
        
      case 'regex':
        if (typeof value === 'string' && !rule.pattern!.test(value)) {
          errors.push({
            path,
            message: rule.message,
            value,
            rule: 'regex'
          });
        }
        break;
        
      case 'warning':
        if (rule.condition && rule.condition(value)) {
          warnings.push({
            path,
            message: rule.message,
            value,
            severity: rule.severity || 'medium'
          });
        }
        break;
    }
  }

  private logValidationResult(result: ValidationResult, context: string): void {
    if (result.isValid) {
      this.logger.info('Configuration validation passed', {
        context,
        warnings: result.warnings.length,
        timestamp: new Date(result.timestamp).toISOString()
      });
    } else {
      this.logger.error('Configuration validation failed', {
        context,
        errors: result.errors.length,
        warnings: result.warnings.length,
        timestamp: new Date(result.timestamp).toISOString()
      });
    }

    // 记录详细的验证结果
    if (result.errors.length > 0) {
      result.errors.forEach(error => {
        this.logger.error('Configuration validation error', {
          path: error.path,
          message: error.message,
          value: error.value,
          rule: error.rule,
          context
        });
      });
    }

    if (result.warnings.length > 0) {
      result.warnings.forEach(warning => {
        this.logger.warn('Configuration validation warning', {
          path: warning.path,
          message: warning.message,
          value: warning.value,
          severity: warning.severity,
          context
        });
      });
    }
  }
}

// 验证相关类型定义
interface ValidationRule {
  type: 'range' | 'regex' | 'dependency' | 'consistency' | 'warning';
  message: string;
  min?: number;
  max?: number;
  pattern?: RegExp;
  condition?: (value: any) => boolean;
  severity?: 'low' | 'medium' | 'high';
}

interface ValidationError {
  path: string;
  message: string;
  value: any;
  rule: string;
}

interface ValidationWarning {
  path: string;
  message: string;
  value: any;
  severity: 'low' | 'medium' | 'high';
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  timestamp: number;
}
```

#### 第六阶段：实现配置热更新与监控

实现配置的动态更新和监控机制：

```typescript
export class ConfigurationMonitor {
  private logger: LoggerService;
  private metricsCollector: MetricsCollector;
  private updateHistory: ConfigurationUpdate[] = [];
  private maxHistorySize: number = 100;
  private listeners: Map<string, ConfigurationListener> = new Map();

  constructor(
    logger: LoggerService,
    metricsCollector: MetricsCollector
  ) {
    this.logger = logger;
    this.metricsCollector = metricsCollector;
  }

  public recordConfigurationUpdate(
    oldConfig: any,
    newConfig: any,
    updateSource: string,
    updateResult: 'success' | 'failure' | 'rollback'
  ): void {
    const update: ConfigurationUpdate = {
      timestamp: Date.now(),
      source: updateSource,
      result: updateResult,
      changes: this.detectChanges(oldConfig, newConfig),
      performanceMetrics: this.collectUpdateMetrics()
    };

    this.updateHistory.push(update);

    // 限制历史记录大小
    if (this.updateHistory.length > this.maxHistorySize) {
      this.updateHistory.shift();
    }

    // 记录指标
    this.recordUpdateMetrics(update);

    // 触发监听器
    this.notifyListeners('configuration-updated', update);
  }

  public registerListener(
    listenerId: string,
    listener: ConfigurationListener
  ): void {
    this.listeners.set(listenerId, listener);
    this.logger.info('Configuration listener registered', { listenerId });
  }

  public unregisterListener(listenerId: string): void {
    if (this.listeners.delete(listenerId)) {
      this.logger.info('Configuration listener unregistered', { listenerId });
    }
  }

  public getUpdateHistory(filters?: UpdateHistoryFilters): ConfigurationUpdate[] {
    let history = [...this.updateHistory];

    if (filters) {
      if (filters.startTime) {
        history = history.filter(update => update.timestamp >= filters.startTime!);
      }

      if (filters.endTime) {
        history = history.filter(update => update.timestamp <= filters.endTime!);
      }

      if (filters.source) {
        history = history.filter(update => update.source === filters.source);
      }

      if (filters.result) {
        history = history.filter(update => update.result === filters.result);
      }

      if (filters.limit) {
        history = history.slice(-filters.limit);
      }
    }

    return history;
  }

  public getConfigurationMetrics(): ConfigurationMetrics {
    const totalUpdates = this.updateHistory.length;
    const successfulUpdates = this.updateHistory.filter(u => u.result === 'success').length;
    const failedUpdates = this.updateHistory.filter(u => u.result === 'failure').length;
    const rollbackUpdates = this.updateHistory.filter(u => u.result === 'rollback').length;

    const recentUpdates = this.updateHistory.slice(-10);
    const averageUpdateTime = recentUpdates.reduce((sum, update) => {
      return sum + (update.performanceMetrics?.updateDuration || 0);
    }, 0) / Math.max(recentUpdates.length, 1);

    return {
      totalUpdates,
      successfulUpdates,
      failedUpdates,
      rollbackUpdates,
      successRate: totalUpdates > 0 ? successfulUpdates / totalUpdates : 0,
      averageUpdateTime,
      lastUpdateTime: this.updateHistory.length > 0 ? this.updateHistory[this.updateHistory.length - 1].timestamp : 0
    };
  }

  private detectChanges(oldConfig: any, newConfig: any, path = ''): ConfigurationChange[] {
    const changes: ConfigurationChange[] = [];
    const allKeys = new Set([...Object.keys(oldConfig || {}), ...Object.keys(newConfig || {})]);

    for (const key of allKeys) {
      const currentPath = path ? `${path}.${key}` : key;
      const oldValue = oldConfig?.[key];
      const newValue = newConfig?.[key];

      if (!(key in oldConfig)) {
        changes.push({
          path: currentPath,
          type: 'added',
          oldValue: undefined,
          newValue,
          timestamp: Date.now()
        });
      } else if (!(key in newConfig)) {
        changes.push({
          path: currentPath,
          type: 'removed',
          oldValue,
          newValue: undefined,
          timestamp: Date.now()
        });
      } else if (typeof oldValue === 'object' && typeof newValue === 'object' && oldValue !== null && newValue !== null) {
        const nestedChanges = this.detectChanges(oldValue, newValue, currentPath);
        changes.push(...nestedChanges);
      } else if (oldValue !== newValue) {
        changes.push({
          path: currentPath,
          type: 'modified',
          oldValue,
          newValue,
          timestamp: Date.now()
        });
      }
    }

    return changes;
  }

  private collectUpdateMetrics(): UpdatePerformanceMetrics {
    const startTime = Date.now();
    
    return {
      updateDuration: 0, // 将在调用时计算
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      timestamp: startTime
    };
  }

  private recordUpdateMetrics(update: ConfigurationUpdate): void {
    // 记录配置更新指标
    this.metricsCollector.recordCounter('configuration_updates_total', {
      source: update.source,
      result: update.result
    });

    if (update.performanceMetrics) {
      this.metricsCollector.recordHistogram('configuration_update_duration_ms', update.performanceMetrics.updateDuration, {
        source: update.source,
        result: update.result
      });
    }
  }

  private notifyListeners(event: string, data: any): void {
    for (const [listenerId, listener] of this.listeners) {
      try {
        listener(event, data);
      } catch (error) {
        this.logger.error('Error notifying configuration listener', {
          listenerId,
          event,
          error: (error as Error).message
        });
      }
    }
  }
}

// 监控相关类型定义
interface ConfigurationUpdate {
  timestamp: number;
  source: string;
  result: 'success' | 'failure' | 'rollback';
  changes: ConfigurationChange[];
  performanceMetrics?: UpdatePerformanceMetrics;
}

interface ConfigurationChange {
  path: string;
  type: 'added' | 'removed' | 'modified';
  oldValue: any;
  newValue: any;
  timestamp: number;
}

interface UpdatePerformanceMetrics {
  updateDuration: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  timestamp: number;
}

interface ConfigurationMetrics {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  rollbackUpdates: number;
  successRate: number;
  averageUpdateTime: number;
  lastUpdateTime: number;
}

interface UpdateHistoryFilters {
  startTime?: number;
  endTime?: number;
  source?: string;
  result?: 'success' | 'failure' | 'rollback';
  limit?: number;
}

type ConfigurationListener = (event: string, data: any) => void;
```

### 方案优势

1. **解耦配置**：将基础设施配置从 `InfrastructureManager` 中分离出来，实现配置与业务逻辑的解耦。

2. **动态配置**：通过配置服务，可以实现配置的动态加载和更新，无需重启应用。

3. **集中管理**：所有基础设施配置都集中在配置服务中管理，便于维护和监控。

4. **更好的测试性**：可以更容易地模拟不同的配置场景进行测试。

5. **增强的验证机制**：提供全面的配置验证，包括结构验证、值验证、依赖关系验证和一致性验证。

6. **热更新支持**：支持配置的实时更新，并提供回滚机制确保系统稳定性。

7. **监控与可观测性**：提供详细的配置更新监控和历史记录，便于问题追踪和性能分析。

### 实施建议

1. **分阶段实施**：
   - 第一阶段：统一配置类型定义
   - 第二阶段：实现配置服务注册
   - 第三阶段：重构 `InfrastructureConfigService`
   - 第四阶段：重构 `InfrastructureManager`
   - 第五阶段：实现配置验证与错误处理
   - 第六阶段：实现配置热更新与监控

2. **充分测试**：在每个阶段完成后进行充分的单元测试和集成测试。

3. **监控配置变更**：添加配置变更的监控和日志记录，便于追踪配置的变更历史。

4. **配置版本管理**：考虑实现配置的版本管理，支持配置的回滚功能。

5. **性能优化**：注意配置加载和验证的性能，避免影响系统启动时间。

6. **安全性考虑**：对敏感配置进行加密处理，确保配置数据的安全性。

7. **文档化**：为新的配置系统编写详细的使用文档和运维指南。
