
import { injectable } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 通用文件处理配置
 * 管理所有通用文件处理相关的配置参数
 */
@injectable()
export class UniversalProcessingConfig {
  private logger?: LoggerService;

  // 错误处理配置
  private maxErrors: number = 5;
  private errorResetInterval: number = 60000; // 1分钟

  // 内存限制配置
  private memoryLimitMB: number = 500;
  private memoryCheckInterval: number = 5000; // 5秒

  // 分段参数配置
  private maxChunkSize: number = 2000;
  private chunkOverlap: number = 200;
  private maxLinesPerChunk: number = 50;

  // 备份文件处理配置
  private backupFilePatterns: string[] = ['.bak', '.backup', '.old', '.tmp'];

  constructor(logger?: LoggerService) {
    this.logger = logger;
    this.loadFromEnvironment();
  }

  /**
   * 从环境变量加载配置
   */
  private loadFromEnvironment(): void {
    try {
      // 错误处理配置
      if (process.env.UNIVERSAL_MAX_ERRORS) {
        this.maxErrors = parseInt(process.env.UNIVERSAL_MAX_ERRORS, 10);
      }
      
      if (process.env.UNIVERSAL_ERROR_RESET_INTERVAL) {
        this.errorResetInterval = parseInt(process.env.UNIVERSAL_ERROR_RESET_INTERVAL, 10);
      }

      // 内存限制配置
      if (process.env.UNIVERSAL_MEMORY_LIMIT_MB) {
        this.memoryLimitMB = parseInt(process.env.UNIVERSAL_MEMORY_LIMIT_MB, 10);
      }
      
      if (process.env.UNIVERSAL_MEMORY_CHECK_INTERVAL) {
        this.memoryCheckInterval = parseInt(process.env.UNIVERSAL_MEMORY_CHECK_INTERVAL, 10);
      }

      // 分段参数配置
      if (process.env.UNIVERSAL_MAX_CHUNK_SIZE) {
        this.maxChunkSize = parseInt(process.env.UNIVERSAL_MAX_CHUNK_SIZE, 10);
      }
      
      if (process.env.UNIVERSAL_CHUNK_OVERLAP) {
        this.chunkOverlap = parseInt(process.env.UNIVERSAL_CHUNK_OVERLAP, 10);
      }
      
      if (process.env.UNIVERSAL_MAX_LINES_PER_CHUNK) {
        this.maxLinesPerChunk = parseInt(process.env.UNIVERSAL_MAX_LINES_PER_CHUNK, 10);
      }

      // 备份文件处理配置
      if (process.env.UNIVERSAL_BACKUP_PATTERNS) {
        this.backupFilePatterns = process.env.UNIVERSAL_BACKUP_PATTERNS.split(',').map(p => p.trim());
      }

      this.logger?.info('Universal processing configuration loaded from environment variables');
    } catch (error) {
      this.logger?.error(`Failed to load configuration from environment: ${error}`);
    }
  }

  /**
   * 获取错误处理配置
   */
  getErrorConfig(): {
    maxErrors: number;
    errorResetInterval: number;
  } {
    return {
      maxErrors: this.maxErrors,
      errorResetInterval: this.errorResetInterval
    };
  }

  /**
   * 获取内存限制配置
   */
  getMemoryConfig(): {
    memoryLimitMB: number;
    memoryCheckInterval: number;
  } {
    return {
      memoryLimitMB: this.memoryLimitMB,
      memoryCheckInterval: this.memoryCheckInterval
    };
  }

  /**
   * 获取分段参数配置
   */
  getChunkingConfig(): {
    maxChunkSize: number;
    chunkOverlap: number;
    maxLinesPerChunk: number;
  } {
    return {
      maxChunkSize: this.maxChunkSize,
      chunkOverlap: this.chunkOverlap,
      maxLinesPerChunk: this.maxLinesPerChunk
    };
  }

  /**
   * 获取备份文件处理配置
   */
  getBackupFileConfig(): {
    backupFilePatterns: string[];
  } {
    return {
      backupFilePatterns: [...this.backupFilePatterns]
    };
  }

  /**
   * 设置错误处理配置
   */
  setErrorConfig(maxErrors: number, errorResetInterval: number): void {
    this.maxErrors = maxErrors;
    this.errorResetInterval = errorResetInterval;
    this.logger?.info(`Error config updated: maxErrors=${maxErrors}, errorResetInterval=${errorResetInterval}`);
  }

  /**
   * 设置内存限制配置
   */
  setMemoryConfig(memoryLimitMB: number, memoryCheckInterval: number): void {
    this.memoryLimitMB = memoryLimitMB;
    this.memoryCheckInterval = memoryCheckInterval;
    this.logger?.info(`Memory config updated: memoryLimitMB=${memoryLimitMB}, memoryCheckInterval=${memoryCheckInterval}`);
  }

  /**
   * 设置分段参数配置
   */
  setChunkingConfig(maxChunkSize: number, chunkOverlap: number, maxLinesPerChunk: number): void {
    this.maxChunkSize = maxChunkSize;
    this.chunkOverlap = chunkOverlap;
    this.maxLinesPerChunk = maxLinesPerChunk;
    this.logger?.info(`Chunking config updated: maxChunkSize=${maxChunkSize}, chunkOverlap=${chunkOverlap}, maxLinesPerChunk=${maxLinesPerChunk}`);
  }

  /**
   * 设置备份文件处理配置
   */
  setBackupFileConfig(backupFilePatterns: string[]): void {
    this.backupFilePatterns = [...backupFilePatterns];
    this.logger?.info(`Backup file config updated: patterns=${backupFilePatterns.join(', ')}`);
  }

  /**
   * 获取所有配置
   */
  getAllConfig(): {
    error: { maxErrors: number; errorResetInterval: number };
    memory: { memoryLimitMB: number; memoryCheckInterval: number };
    chunking: { maxChunkSize: number; chunkOverlap: number; maxLinesPerChunk: number };
    backup: { backupFilePatterns: string[] };
  } {
    return {
      error: this.getErrorConfig(),
      memory: this.getMemoryConfig(),
      chunking: this.getChunkingConfig(),
      backup: this.getBackupFileConfig()
    };
  }

  /**
   * 重置为默认配置
   */
  resetToDefaults(): void {
    this.maxErrors = 5;
    this.errorResetInterval = 60000;
    this.memoryLimitMB = 500;
    this.memoryCheckInterval = 5000;
    this.maxChunkSize = 2000;
    this.chunkOverlap = 200;
    this.maxLinesPerChunk = 50;
    this.backupFilePatterns = ['.bak', '.backup', '.old', '.tmp'];
    
    this.logger?.info('Universal processing configuration reset to defaults');
  }

  /**
   * 验证配置的有效性
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 验证错误处理配置
    if (this.maxErrors <= 0) {
      errors.push('maxErrors must be greater than 0');
    }
    
    if (this.errorResetInterval <= 0) {
      errors.push('errorResetInterval must be greater than 0');
    }

    // 验证内存限制配置
    if (this.memoryLimitMB <= 0) {
      errors.push('memoryLimitMB must be greater than 0');
    }
    
    if (this.memoryCheckInterval <= 0) {
      errors.push('memoryCheckInterval must be greater than 0');
    }

    // 验证分段参数配置
    if (this.maxChunkSize <= 0) {
      errors.push('maxChunkSize must be greater than 0');
    }
    
    if (this.chunkOverlap < 0) {
      errors.push('chunkOverlap must be non-negative');
    }
    
    if (this.chunkOverlap >= this.maxChunkSize) {
      errors.push('chunkOverlap must be less than maxChunkSize');
    }
    
    if (this.maxLinesPerChunk <= 0) {
      errors.push('maxLinesPerChunk must be greater than 0');
    }

    // 验证备份文件处理配置
    if (this.backupFilePatterns.length === 0) {
      errors.push('backupFilePatterns cannot be empty');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}