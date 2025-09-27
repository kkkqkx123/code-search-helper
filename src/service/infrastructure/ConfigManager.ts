import { injectable, inject } from 'inversify';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { ConfigService, Config } from '../../config/ConfigService';

export interface ConfigSection {
  [key: string]: any;
}

export interface EnvironmentConfig {
  nodeEnv: string;
  port: number;
  logLevel: string;
  debug: boolean;
}

export interface ServiceConfig {
  database: DatabaseConfig;
  embedding: EmbeddingConfig;
  monitoring: MonitoringConfig;
  search: SearchConfig;
}

export interface DatabaseConfig {
  vector: VectorDatabaseConfig;
  graph: GraphDatabaseConfig;
}

export interface VectorDatabaseConfig {
  host: string;
  port: number;
  apiKey?: string;
  timeout: number;
  maxConnections: number;
}

export interface GraphDatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout: number;
  maxConnections: number;
}

export interface EmbeddingConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  timeout: number;
  maxRetries: number;
}

export interface MonitoringConfig {
  enabled: boolean;
  checkInterval: number;
  memoryThreshold: number;
  cpuThreshold: number;
  eventLoopThreshold: number;
}

export interface SearchConfig {
  defaultLimit: number;
  defaultThreshold: number;
  includeGraph: boolean;
  useHybrid: boolean;
  useReranking: boolean;
  weights: {
    semantic: number;
    keyword: number;
    graph: number;
  };
}

@injectable()
export class ConfigManager {
  private logger: LoggerService;
  private errorHandler: ErrorHandlerService;
  private configService: ConfigService;
  private configCache: Map<string, ConfigSection> = new Map();
  private configListeners: Map<string, Array<(config: ConfigSection) => void>> = new Map();

  constructor(
    @inject(LoggerService) logger: LoggerService,
    @inject(ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = ConfigService.getInstance();

    this.initializeConfig();
  }

  getEnvironment(): EnvironmentConfig {
    return this.getConfig<EnvironmentConfig>('environment', {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.PORT || '3000'),
      logLevel: process.env.LOG_LEVEL || 'info',
      debug: process.env.DEBUG === 'true',
    });
  }

  getServices(): ServiceConfig {
    return this.getConfig<ServiceConfig>('services', {
      database: {
        vector: {
          host: process.env.VECTOR_DB_HOST || 'localhost',
          port: parseInt(process.env.VECTOR_DB_PORT || '6333'),
          apiKey: process.env.VECTOR_DB_API_KEY,
          timeout: 30000,
          maxConnections: 10,
        },
        graph: {
          host: process.env.GRAPH_DB_HOST || 'localhost',
          port: parseInt(process.env.GRAPH_DB_PORT || '7687'),
          username: process.env.GRAPH_DB_USERNAME || 'neo4j',
          password: process.env.GRAPH_DB_PASSWORD || 'password',
          timeout: 30000,
          maxConnections: 10,
        },
      },
      embedding: {
        provider: process.env.EMBEDDING_PROVIDER || 'openai',
        model: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002',
        apiKey: process.env.EMBEDDING_API_KEY,
        baseUrl: process.env.EMBEDDING_BASE_URL,
        timeout: 30000,
        maxRetries: 3,
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED !== 'false',
        checkInterval: parseInt(process.env.MONITORING_INTERVAL || '30000'),
        memoryThreshold: parseInt(process.env.MEMORY_THRESHOLD || '85'),
        cpuThreshold: parseInt(process.env.CPU_THRESHOLD || '80'),
        eventLoopThreshold: parseInt(process.env.EVENT_LOOP_THRESHOLD || '100'),
      },
      search: {
        defaultLimit: parseInt(process.env.SEARCH_DEFAULT_LIMIT || '10'),
        defaultThreshold: parseFloat(process.env.SEARCH_DEFAULT_THRESHOLD || '0.5'),
        includeGraph: process.env.SEARCH_INCLUDE_GRAPH !== 'false',
        useHybrid: process.env.SEARCH_USE_HYBRID === 'true',
        useReranking: process.env.SEARCH_USE_RERANKING !== 'false',
        weights: {
          semantic: parseFloat(process.env.SEARCH_WEIGHT_SEMANTIC || '0.6'),
          keyword: parseFloat(process.env.SEARCH_WEIGHT_KEYWORD || '0.3'),
          graph: parseFloat(process.env.SEARCH_WEIGHT_GRAPH || '0.1'),
        },
      },
    });
  }

  getConfig<T>(section: string, defaults: T): T {
    // Check cache first
    if (this.configCache.has(section)) {
      return this.configCache.get(section) as T;
    }

    try {
      // Get from config service - cast to any since section may not be a keyof Config
      const config = this.configService.get(section as keyof Config) || {};

      // Merge with defaults
      const mergedConfig = this.mergeConfig(defaults, config as Partial<T>);

      // Cache the result - cast to ConfigSection for cache storage
      this.configCache.set(section, mergedConfig as ConfigSection);

      return mergedConfig;
    } catch (error) {
      this.logger.warn(`Failed to get config section '${section}', using defaults`, {
        error: error instanceof Error ? error.message : String(error),
      });

      // Return defaults if config service fails
      this.configCache.set(section, defaults as ConfigSection);
      return defaults;
    }
  }

  updateConfig<T extends ConfigSection>(section: string, updates: Partial<T>): void {
    try {
      const currentConfig = this.configCache.get(section) || ({} as T);
      const updatedConfig = this.mergeConfig(currentConfig, updates);

      // Update cache
      this.configCache.set(section, updatedConfig);

      // Notify listeners
      this.notifyConfigListeners(section, updatedConfig);

      this.logger.info('Configuration updated', { section, updates });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to update config section '${section}': ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'ConfigManager', operation: 'updateConfig' }
      );
    }
  }

  onConfigChange<T>(section: string, listener: (config: T) => void): () => void {
    if (!this.configListeners.has(section)) {
      this.configListeners.set(section, []);
    }

    this.configListeners.get(section)!.push(listener as (config: ConfigSection) => void);

    // Return unsubscribe function
    return () => {
      const listeners = this.configListeners.get(section);
      if (listeners) {
        const index = listeners.indexOf(listener as (config: ConfigSection) => void);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  getConfigSections(): string[] {
    return Array.from(this.configCache.keys());
  }

  hasConfig(section: string): boolean {
    return this.configCache.has(section);
  }

  clearCache(): void {
    this.configCache.clear();
    this.logger.info('Configuration cache cleared');
  }

  reloadConfig(): void {
    this.clearCache();
    this.initializeConfig();
    this.logger.info('Configuration reloaded');
  }

  exportConfig(): Record<string, ConfigSection> {
    const exportObj: Record<string, ConfigSection> = {};

    for (const [section, config] of this.configCache.entries()) {
      exportObj[section] = config;
    }

    return exportObj;
  }

  private initializeConfig(): void {
    try {
      // Initialize all config sections
      this.getEnvironment();
      this.getServices();

      this.logger.info('Configuration manager initialized', {
        sections: this.getConfigSections(),
      });
    } catch (error) {
      this.errorHandler.handleError(
        new Error(
          `Failed to initialize configuration: ${error instanceof Error ? error.message : String(error)}`
        ),
        { component: 'ConfigManager', operation: 'initialize' }
      );
    }
  }

  private mergeConfig<T>(defaults: T, overrides: Partial<T>): T {
    const result = { ...defaults } as T;

    for (const key in overrides) {
      if (overrides.hasOwnProperty(key)) {
        const defaultValue = defaults[key];
        const overrideValue = overrides[key];

        if (
          typeof defaultValue === 'object' &&
          defaultValue !== null &&
          !Array.isArray(defaultValue) &&
          overrideValue !== null &&
          typeof overrideValue === 'object' &&
          !Array.isArray(overrideValue)
        ) {
          (result as any)[key] = this.mergeConfig(defaultValue, overrideValue);
        } else {
          (result as any)[key] = overrideValue;
        }
      }
    }

    return result;
  }

  private notifyConfigListeners(section: string, config: ConfigSection): void {
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
}
