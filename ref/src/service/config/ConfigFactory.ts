import { injectable, inject } from 'inversify';
import { LoggerService } from '../core/LoggerService';
import { ErrorHandlerService } from '../core/ErrorHandlerService';
import { ConfigService } from './ConfigService';
import {
  CompleteConfig,
  ConfigSection,
  EnvironmentConfig,
  ServiceConfig,
  FeatureConfig,
  SecurityConfig,
} from './ConfigTypes';
import { TYPES } from '../types';

@injectable()
export class ConfigFactory implements ConfigFactory {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private configCache: Map<string, any> = new Map();
  private configListeners: Map<string, Array<(config: any) => void>> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;

    this.initializeConfig();
  }

  getConfig<T>(section: ConfigSection): T {
    // Check cache first
    if (this.configCache.has(section)) {
      return this.configCache.get(section) as T;
    }

    try {
      // Get configuration based on section
      let config: T;

      if (section === 'environment') {
        config = this.getEnvironmentConfig() as T;
      } else if (section === 'services') {
        config = this.getServicesConfig() as T;
      } else if (section === 'features') {
        config = this.getFeaturesConfig() as T;
      } else if (section === 'security') {
        config = this.getSecurityConfig() as T;
      } else if (section.startsWith('services.')) {
        config = this.getServiceSubConfig(section) as T;
      } else if (section.startsWith('features.')) {
        config = this.getFeatureSubConfig(section) as T;
      } else if (section.startsWith('security.')) {
        config = this.getSecuritySubConfig(section) as T;
      } else {
        throw new Error(`Unknown configuration section: ${section}`);
      }

      // Cache the result
      this.configCache.set(section, config);

      return config;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`Failed to get config section '${section}'`, {
        error: errorMessage,
      });

      throw new Error(`Configuration error for section '${section}': ${errorMessage}`);
    }
  }

  updateConfig<T>(section: ConfigSection, updates: Partial<T>): void {
    try {
      const currentConfig = this.configCache.get(section) || this.getConfig<T>(section);
      const updatedConfig = { ...currentConfig, ...updates };

      // Update cache
      this.configCache.set(section, updatedConfig);

      // Update underlying config service if needed
      this.updateConfigService(section, updatedConfig);

      // Notify listeners
      this.notifyConfigListeners(section, updatedConfig);

      this.logger.info('Configuration updated', { section, updates });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.errorHandler.handleError(
        new Error(`Failed to update config section '${section}': ${errorMessage}`),
        { component: 'ConfigFactory', operation: 'updateConfig' }
      );
    }
  }

  reloadConfig(): void {
    this.configCache.clear();
    this.initializeConfig();
    this.logger.info('Configuration reloaded from factory');
  }

  exportConfig(): CompleteConfig {
    return {
      environment: this.getConfig<EnvironmentConfig>('environment'),
      services: this.getConfig<ServiceConfig>('services'),
      features: this.getConfig<FeatureConfig>('features'),
      security: this.getConfig<SecurityConfig>('security'),
    };
  }

  validateConfig(): boolean {
    try {
      const config = this.exportConfig();

      // Validate required fields
      const validations = [
        this.validateEnvironmentConfig(config.environment),
        this.validateServicesConfig(config.services),
        this.validateFeaturesConfig(config.features),
        this.validateSecurityConfig(config.security),
      ];

      const isValid = validations.every(v => v.valid);

      if (!isValid) {
        const errors = validations.filter(v => !v.valid).map(v => v.error);
        this.logger.error('Configuration validation failed', { errors });
      }

      return isValid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Configuration validation error', { error: errorMessage });
      return false;
    }
  }

  onConfigChange<T>(section: ConfigSection, listener: (config: T) => void): () => void {
    if (!this.configListeners.has(section)) {
      this.configListeners.set(section, []);
    }

    this.configListeners.get(section)!.push(listener as any);

    // Return unsubscribe function
    return () => {
      const listeners = this.configListeners.get(section);
      if (listeners) {
        const index = listeners.indexOf(listener as any);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  private getEnvironmentConfig(): EnvironmentConfig {
    const config = this.configService.get('nodeEnv') ? this.configService.getAll() : {};

    return {
      nodeEnv: (this.configService.get('nodeEnv') || process.env.NODE_ENV || 'development') as
        | 'development'
        | 'production'
        | 'test',
      port: this.configService.get('port') || parseInt(process.env.PORT || '3000'),
      host: 'localhost',
      logLevel: (this.configService.get('logging')?.level || process.env.LOG_LEVEL || 'info') as
        | 'debug'
        | 'error'
        | 'warn'
        | 'info',
      debug: false,
      corsEnabled: true,
      maxRequestBodySize: '10mb',
    };
  }

  private getServicesConfig(): ServiceConfig {
    const config = this.configService.getAll();

    return {
      database: {
        vector: {
          host: config.qdrant?.host || process.env.QDRANT_HOST || 'localhost',
          port: config.qdrant?.port || parseInt(process.env.QDRANT_PORT || '6333'),
          apiKey: process.env.QDRANT_API_KEY,
          timeout: 30000,
          maxConnections: 10,
          retryAttempts: 3,
          retryDelay: 1000,
          indexName: 'codebase-index',
          dimension: 1536,
        },
        graph: {
          host: config.nebula?.host || process.env.NEBULA_HOST || 'localhost',
          port: config.nebula?.port || parseInt(process.env.NEBULA_PORT || '9669'),
          username: config.nebula?.username || process.env.NEBULA_USERNAME || 'root',
          password: config.nebula?.password || process.env.NEBULA_PASSWORD || 'nebula',
          timeout: 30000,
          maxConnections: 10,
          retryAttempts: 3,
          retryDelay: 1000,
          database: 'neo4j',
        },
        connectionPool: {
          minConnections: 2,
          maxConnections: 20,
          acquireTimeoutMs: 30000,
          createTimeoutMs: 5000,
          destroyTimeoutMs: 5000,
          idleTimeoutMs: 30000,
          reapIntervalMs: 1000,
          createRetryIntervalMs: 200,
        },
      },
      embedding: {
        provider: (config.embedding?.provider || process.env.EMBEDDING_PROVIDER || 'openai') as
          | 'openai'
          | 'ollama'
          | 'gemini'
          | 'mistral'
          | 'local',
        model:
          config.embedding?.openai?.model || process.env.OPENAI_MODEL || 'text-embedding-ada-002',
        apiKey: config.embedding?.openai?.apiKey || process.env.OPENAI_API_KEY,
        baseUrl: config.embedding?.openai?.baseUrl || process.env.OPENAI_BASE_URL,
        timeout: 30000,
        maxRetries: 3,
        batchSize: 100,
        maxTokens: 8192,
        temperature: 0,
      },
      monitoring: {
        enabled: config.monitoring?.enabled ?? true,
        checkInterval: 30000,
        memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '75'),
        cpuThreshold: 80,
        eventLoopThreshold: 100,
        metricsEnabled: true,
        healthCheckEnabled: true,
        prometheusEnabled: false,
        prometheusPort: 9090,
      },
      search: {
        defaultLimit: 10,
        maxLimit: 100,
        defaultThreshold: 0.5,
        includeGraph: true,
        useHybrid: true,
        useLSP: false,
        useReranking: true,
        lspSearchTypes: ['symbol', 'definition', 'reference'],
        includeDiagnostics: false,
        lspTimeout: 5000,
        weights: {
          semantic: 0.6,
          keyword: 0.3,
          graph: 0.1,
          lsp: 0.2,
        },
        cacheEnabled: true,
        cacheTtl: 300000,
      },
      processing: {
        batchProcessing: {
          enabled: config.batchProcessing?.enabled ?? true,
          defaultBatchSize: config.batchProcessing?.defaultBatchSize || 50,
          maxBatchSize: config.batchProcessing?.maxBatchSize || 500,
          minBatchSize: config.batchProcessing?.adaptiveBatching?.minBatchSize || 10,
          maxConcurrentOperations: config.batchProcessing?.maxConcurrentOperations || 5,
          memoryThreshold: parseInt(
            process.env.BATCH_MEMORY_THRESHOLD ||
              String(config.batchProcessing?.memoryThreshold || 75)
          ),
          processingTimeout: config.batchProcessing?.processingTimeout || 300000,
          retryAttempts: config.batchProcessing?.retryAttempts || 3,
          retryDelay: config.batchProcessing?.retryDelay || 1000,
          continueOnError: config.batchProcessing?.continueOnError ?? false,
          adaptiveBatching: {
            enabled: config.batchProcessing?.adaptiveBatching?.enabled ?? true,
            performanceThreshold:
              config.batchProcessing?.adaptiveBatching?.performanceThreshold || 1000,
            adjustmentFactor: 1.2,
            maxBatchSize: config.batchProcessing?.adaptiveBatching?.maxBatchSize || 200,
            minBatchSize: 10,
          },
        },
        chunking: {
          defaultChunkSize: config.fileProcessing?.chunkSize || 1000,
          overlapSize: config.fileProcessing?.overlapSize || 200,
          maxChunkSize: 2000,
          minChunkSize: 100,
          chunkByLanguage: true,
          preserveStructure: true,
        },
        parsing: {
          enabledLanguages: [
            'typescript',
            'javascript',
            'python',
            'java',
            'go',
            'rust',
            'c',
            'cpp',
          ],
          timeout: 30000,
          maxFileSize: config.fileProcessing?.maxFileSize || 10485760, // 10MB
          includePatterns: [],
          excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**'],
          extractComments: true,
          extractMetadata: true,
        },
      },
      storage: {
        compression: {
          enabled: true,
          algorithm: 'gzip',
          level: 6,
        },
        caching: {
          enabled: (config.caching as any)?.enabled ?? true,
          maxSize: (config.caching as any)?.maxSize || 1000,
          ttl: (config.caching as any)?.defaultTTL || 3600000,
          strategy: 'lru',
        },
        backup: {
          enabled: false,
          interval: 86400000, // 24 hours
          retention: 7, // 7 days
          location: './backups',
        },
      },
    };
  }

  private getFeaturesConfig(): FeatureConfig {
    const config = (this.configService.getAll() as any).features || {};

    return {
      indexing: {
        autoIndex: config.indexing?.autoIndex ?? true,
        watchMode: config.indexing?.watchMode ?? true,
        incrementalUpdates: config.indexing?.incrementalUpdates ?? true,
        deduplication: config.indexing?.deduplication ?? true,
        parallelProcessing: config.indexing?.parallelProcessing ?? true,
      },
      search: {
        semanticSearch: config.search?.semanticSearch ?? true,
        keywordSearch: config.search?.keywordSearch ?? true,
        fuzzySearch: config.search?.fuzzySearch ?? true,
        regexSearch: config.search?.regexSearch ?? true,
        graphSearch: config.search?.graphSearch ?? true,
        hybridSearch: config.search?.hybridSearch ?? true,
        reranking: config.search?.reranking ?? true,
        faceting: config.search?.faceting ?? false,
        aggregation: config.search?.aggregation ?? false,
      },
      monitoring: {
        metrics: config.monitoring?.metrics ?? true,
        logging: config.monitoring?.logging ?? true,
        tracing: config.monitoring?.tracing ?? false,
        alerting: config.monitoring?.alerting ?? false,
        dashboard: config.monitoring?.dashboard ?? false,
      },
      api: {
        rest: config.api?.rest ?? true,
        graphql: config.api?.graphql ?? false,
        websocket: config.api?.websocket ?? false,
        mcp: config.api?.mcp ?? true,
        rateLimit: {
          enabled: config.api?.rateLimit?.enabled ?? true,
          requestsPerMinute: config.api?.rateLimit?.requestsPerMinute || 60,
          burstSize: config.api?.rateLimit?.burstSize || 10,
        },
        authentication: {
          enabled: config.api?.authentication?.enabled ?? false,
          type: config.api?.authentication?.type || 'api-key',
        },
      },
      staticAnalysis: {
        enabled: config.staticAnalysis?.enabled ?? true,
        defaultTool: config.staticAnalysis?.defaultTool || 'semgrep',
        scanOnChange: config.staticAnalysis?.scanOnChange ?? true,
        batchSize: config.staticAnalysis?.batchSize || 50,
        resultRetentionDays: config.staticAnalysis?.resultRetentionDays || 30,
        semgrep: {
          enabled: config.staticAnalysis?.semgrep?.enabled ?? true,
          cliPath: config.staticAnalysis?.semgrep?.cliPath || 'semgrep',
          rulesDir: config.staticAnalysis?.semgrep?.rulesDir || './rules',
          defaultRules: config.staticAnalysis?.semgrep?.defaultRules || [
            'p/security-audit',
            'p/secrets',
          ],
          timeout: config.staticAnalysis?.semgrep?.timeout || 30000,
          maxTargetBytes: config.staticAnalysis?.semgrep?.maxTargetBytes || 1000000,
          maxConcurrentScans: config.staticAnalysis?.semgrep?.maxConcurrentScans || 3,
          cacheEnabled: config.staticAnalysis?.semgrep?.cacheEnabled ?? true,
          cacheTtl: config.staticAnalysis?.semgrep?.cacheTtl || 3600000,
        },
      },
    };
  }

  private getSecurityConfig(): SecurityConfig {
    const config = (this.configService.getAll() as any).security || {};

    return {
      encryption: {
        enabled: config.encryption?.enabled ?? false,
        algorithm: config.encryption?.algorithm || 'aes-256-gcm',
        keyRotationDays: config.encryption?.keyRotationDays || 30,
        atRest: config.encryption?.atRest ?? false,
        inTransit: config.encryption?.inTransit ?? true,
      },
      authentication: {
        enabled: config.authentication?.enabled ?? false,
        method: config.authentication?.method || 'api-key',
        tokenExpiry: config.authentication?.tokenExpiry || 3600,
        refreshExpiry: config.authentication?.refreshExpiry || 86400,
        issuer: config.authentication?.issuer || 'codebase-index',
        audience: config.authentication?.audience || 'codebase-index-clients',
      },
      authorization: {
        enabled: config.authorization?.enabled ?? false,
        method: config.authorization?.method || 'rbac',
        defaultRole: config.authorization?.defaultRole || 'user',
        roleHierarchy: config.authorization?.roleHierarchy || ['user', 'admin', 'superadmin'],
      },
      rateLimit: {
        enabled: config.rateLimit?.enabled ?? true,
        windowMs: config.rateLimit?.windowMs || 60000,
        maxRequests: config.rateLimit?.maxRequests || 100,
        skipSuccessfulRequests: config.rateLimit?.skipSuccessfulRequests ?? false,
        skipFailedRequests: config.rateLimit?.skipFailedRequests ?? false,
        keyGenerator: config.rateLimit?.keyGenerator || 'ip',
        handler: config.rateLimit?.handler || 'default',
      },
    };
  }

  private getServiceSubConfig(section: string): any {
    const serviceConfig = this.getServicesConfig();
    const parts = section.split('.');

    if (parts.length < 2 || parts.length > 3) {
      throw new Error(`Invalid service configuration section: ${section}`);
    }

    const [, serviceName, subServiceName] = parts;

    // If only service name is provided (e.g., 'services.search'), return the entire service config
    if (parts.length === 2) {
      const service = (serviceConfig as any)[serviceName];
      if (!service) {
        throw new Error(`Service configuration not found: ${serviceName}`);
      }
      return service;
    }

    // If both service and sub-service names are provided (e.g., 'services.database.vector')
    const service = (serviceConfig as any)[serviceName];
    if (!service) {
      throw new Error(`Service configuration not found: ${serviceName}`);
    }

    const subService = service[subServiceName];
    if (!subService) {
      throw new Error(`Sub-service configuration not found: ${subServiceName}`);
    }

    return subService;
  }

  private getFeatureSubConfig(section: string): any {
    const featureConfig = this.getFeaturesConfig();
    const parts = section.split('.');

    if (parts.length !== 3) {
      throw new Error(`Invalid feature configuration section: ${section}`);
    }

    const [, featureName, subFeatureName] = parts;
    const feature = (featureConfig as any)[featureName];

    if (!feature) {
      throw new Error(`Feature configuration not found: ${featureName}`);
    }

    const subFeature = feature[subFeatureName];

    if (!subFeature) {
      throw new Error(`Sub-feature configuration not found: ${subFeatureName}`);
    }

    return subFeature;
  }

  private getSecuritySubConfig(section: string): any {
    const securityConfig = this.getSecurityConfig();
    const parts = section.split('.');

    if (parts.length !== 3) {
      throw new Error(`Invalid security configuration section: ${section}`);
    }

    const [, securityName, subSecurityName] = parts;
    const security = (securityConfig as any)[securityName];

    if (!security) {
      throw new Error(`Security configuration not found: ${securityName}`);
    }

    const subSecurity = security[subSecurityName];

    if (!subSecurity) {
      throw new Error(`Sub-security configuration not found: ${subSecurityName}`);
    }

    return subSecurity;
  }

  private updateConfigService(section: string, config: any): void {
    try {
      // For now, just log the update since ConfigService doesn't have a set method
      this.logger.warn('Config update not implemented for underlying config service', {
        section,
        configKeys: Object.keys(config),
      });
    } catch (error) {
      this.logger.warn('Failed to update underlying config service', {
        section,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private notifyConfigListeners(section: string, config: any): void {
    const listeners = this.configListeners.get(section);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(config);
        } catch (error) {
          this.logger.error('Error in config listener', {
            section,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    }
  }

  private initializeConfig(): void {
    try {
      // Initialize all configuration sections
      this.getEnvironmentConfig();
      this.getServicesConfig();
      this.getFeaturesConfig();
      this.getSecurityConfig();

      this.logger.info('Configuration factory initialized', {
        sections: Array.from(this.configCache.keys()),
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to initialize configuration factory: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'ConfigFactory', operation: 'initialize' }
      );
    }
  }

  private validateEnvironmentConfig(config: EnvironmentConfig): { valid: boolean; error?: string } {
    if (!config.nodeEnv || !['development', 'production', 'test'].includes(config.nodeEnv)) {
      return { valid: false, error: 'Invalid node environment' };
    }

    if (!config.port || config.port < 1 || config.port > 65535) {
      return { valid: false, error: 'Invalid port number' };
    }

    return { valid: true };
  }

  private validateServicesConfig(config: ServiceConfig): { valid: boolean; error?: string } {
    if (!config.database.vector.host || !config.database.graph.host) {
      return { valid: false, error: 'Database host configuration missing' };
    }

    if (!config.embedding.provider || !config.embedding.model) {
      return { valid: false, error: 'Embedding configuration missing' };
    }

    return { valid: true };
  }

  private validateFeaturesConfig(config: FeatureConfig): { valid: boolean; error?: string } {
    // Basic validation for features
    return { valid: true };
  }

  private validateSecurityConfig(config: SecurityConfig): { valid: boolean; error?: string } {
    // Basic validation for security
    return { valid: true };
  }
}
