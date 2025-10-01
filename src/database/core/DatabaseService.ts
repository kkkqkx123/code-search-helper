import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../config/ConfigService';

export interface DatabaseServiceConfig {
  connectionTimeout: number;
  maxRetries: number;
  retryDelay: number;
  healthCheckInterval: number;
}

@injectable()
export class DatabaseService {
  protected logger: LoggerService;
  protected errorHandler: ErrorHandlerService;
  protected configService: ConfigService;
  protected config: DatabaseServiceConfig;
  protected isConnected: boolean = false;
  protected healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) errorHandler: ErrorHandlerService,
    @inject(TYPES.ConfigService) configService: ConfigService
  ) {
    this.logger = logger;
    this.errorHandler = errorHandler;
    this.configService = configService;
    
    this.config = {
      connectionTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 60000,
    };

    this.loadConfig();
  }

  private loadConfig(): void {
    const dbConfig = this.configService.get('database');
    if (dbConfig) {
      this.config = {
        ...this.config,
        ...dbConfig,
      };
    }
  }

  async initialize(): Promise<boolean> {
    try {
      this.logger.info('Initializing database service');
      
      // Initialize connection
      const connected = await this.connect();
      if (!connected) {
        throw new Error('Failed to connect to database');
      }

      // Start health checks
      this.startHealthChecks();

      this.isConnected = true;
      this.logger.info('Database service initialized successfully');
      return true;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to initialize database service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'DatabaseService', operation: 'initialize' }
      );
      return false;
    }
  }

  protected async connect(): Promise<boolean> {
    // Override in subclasses
    return true;
  }

  protected async disconnect(): Promise<void> {
    // Override in subclasses
    this.isConnected = false;
  }

  protected async checkConnection(): Promise<boolean> {
    // Override in subclasses
    return true;
  }

  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      this.logger.warn('Health checks are already running');
      return;
    }

    this.logger.info('Starting database health checks', { interval: this.config.healthCheckInterval });
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isHealthy = await this.checkConnection();
        if (!isHealthy) {
          this.logger.warn('Database connection health check failed');
          // Attempt to reconnect
          await this.reconnect();
        }
      } catch (error) {
        this.logger.error('Database health check error', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.config.healthCheckInterval);

    // Ensure interval doesn't prevent Node.js from exiting
    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref();
    }
  }

  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      this.logger.info('Stopped database health checks');
    }
  }

  private async reconnect(): Promise<boolean> {
    this.logger.info('Attempting to reconnect to database');
    
    try {
      // Disconnect first
      await this.disconnect();
      
      // Wait before reconnecting
      await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
      
      // Attempt to reconnect
      const connected = await this.connect();
      if (connected) {
        this.isConnected = true;
        this.logger.info('Database reconnection successful');
        return true;
      }
      
      this.logger.error('Database reconnection failed');
      return false;
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Database reconnection failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'DatabaseService', operation: 'reconnect' }
      );
      return false;
    }
  }

  async close(): Promise<void> {
    try {
      this.logger.info('Closing database service');
      
      // Stop health checks
      this.stopHealthChecks();
      
      // Disconnect
      await this.disconnect();
      
      this.isConnected = false;
      this.logger.info('Database service closed successfully');
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`Failed to close database service: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'DatabaseService', operation: 'close' }
      );
      throw error;
    }
  }

  isDatabaseConnected(): boolean {
    return this.isConnected;
  }

  updateConfig(config: Partial<DatabaseServiceConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Database service configuration updated', { config });
    
    // Restart health checks with new interval
    if (this.healthCheckInterval) {
      this.stopHealthChecks();
      this.startHealthChecks();
    }
  }

  getConfig(): DatabaseServiceConfig {
    return { ...this.config };
  }

  async getDatabaseStats(): Promise<any> {
    // Override in subclasses
    return {
      status: this.isConnected ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    };
  }

  protected async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.config.maxRetries,
    retryDelay: number = this.config.retryDelay
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          this.logger.warn('Database operation failed, retrying', {
            attempt,
            maxRetries,
            error: lastError.message,
          });
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        } else {
          this.logger.error('Database operation failed after all retries', {
            attempts: maxRetries,
            error: lastError.message,
          });
        }
      }
    }

    throw lastError!;
  }

  protected async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = this.config.connectionTimeout
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Database operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
}