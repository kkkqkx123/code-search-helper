import { injectable } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { DEFAULT_CONFIG } from './constants';

/**
 * 通用文件处理配置
 * 管理所有通用文件处理相关的配置参数
 */
@injectable()
export class UniversalProcessingConfig {
  private logger?: LoggerService;

  // 错误处理配置
  private maxErrors: number = DEFAULT_CONFIG.MAX_ERRORS;
  private errorResetInterval: number = DEFAULT_CONFIG.ERROR_RESET_INTERVAL;

  // 内存限制配置
  private memoryLimitMB: number = DEFAULT_CONFIG.MEMORY_LIMIT_MB;
  private memoryCheckInterval: number = DEFAULT_CONFIG.MEMORY_CHECK_INTERVAL;

  // 分段参数配置
  private maxChunkSize: number = DEFAULT_CONFIG.MAX_CHUNK_SIZE;
  private chunkOverlap: number = DEFAULT_CONFIG.CHUNK_OVERLAP;
  private maxLinesPerChunk: number = DEFAULT_CONFIG.MAX_LINES_PER_CHUNK;

  // 备份文件处理配置
  private backupFilePatterns: string[] = ['.bak', '.backup', '.old', '.tmp', '.temp', '.orig', '.save'];
  private backupFileConfidenceThreshold: number = 0.7; // 默认置信度阈值

  constructor(logger?: LoggerService) {
    this.logger = logger;
    this.loadFromEnvironment();
  }

  /**
   * 从环境变量加载配置
   */
  private loadFromEnvironment(): void {
    try {
      let hasInvalidValues = false;
      
      // 错误处理配置
      if (process.env.UNIVERSAL_MAX_ERRORS) {
        const parsed = parseInt(process.env.UNIVERSAL_MAX_ERRORS, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.maxErrors = parsed;
        } else {
          hasInvalidValues = true;
        }
      }
      
      if (process.env.UNIVERSAL_ERROR_RESET_INTERVAL) {
        const parsed = parseInt(process.env.UNIVERSAL_ERROR_RESET_INTERVAL, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.errorResetInterval = parsed;
        } else {
          hasInvalidValues = true;
        }
      }

      // 内存限制配置
      if (process.env.UNIVERSAL_MEMORY_LIMIT_MB) {
        const parsed = parseInt(process.env.UNIVERSAL_MEMORY_LIMIT_MB, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.memoryLimitMB = parsed;
        } else {
          hasInvalidValues = true;
        }
      }
      
      if (process.env.UNIVERSAL_MEMORY_CHECK_INTERVAL) {
        const parsed = parseInt(process.env.UNIVERSAL_MEMORY_CHECK_INTERVAL, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.memoryCheckInterval = parsed;
        } else {
          hasInvalidValues = true;
        }
      }

      // 分段参数配置
      if (process.env.UNIVERSAL_MAX_CHUNK_SIZE) {
        const parsed = parseInt(process.env.UNIVERSAL_MAX_CHUNK_SIZE, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.maxChunkSize = parsed;
        } else {
          hasInvalidValues = true;
        }
      }
      
      if (process.env.UNIVERSAL_CHUNK_OVERLAP) {
        const parsed = parseInt(process.env.UNIVERSAL_CHUNK_OVERLAP, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          this.chunkOverlap = parsed;
        } else {
          hasInvalidValues = true;
        }
      }
      
      if (process.env.UNIVERSAL_MAX_LINES_PER_CHUNK) {
        const parsed = parseInt(process.env.UNIVERSAL_MAX_LINES_PER_CHUNK, 10);
        if (!isNaN(parsed) && parsed > 0) {
          this.maxLinesPerChunk = parsed;
        } else {
          hasInvalidValues = true;
        }
      }

      // 备份文件处理配置
      if (process.env.UNIVERSAL_BACKUP_PATTERNS !== undefined) {
        const patterns = process.env.UNIVERSAL_BACKUP_PATTERNS.split(',').map(p => p.trim());
        // 如果环境变量为空字符串，设置为空数组
        if (process.env.UNIVERSAL_BACKUP_PATTERNS === '') {
          this.backupFilePatterns = [''];
        } else {
          this.backupFilePatterns = patterns.filter(p => p.length > 0);
        }
      }
      
      // 备份文件置信度阈值配置
      if (process.env.UNIVERSAL_BACKUP_CONFIDENCE_THRESHOLD) {
        const parsed = parseFloat(process.env.UNIVERSAL_BACKUP_CONFIDENCE_THRESHOLD);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          this.backupFileConfidenceThreshold = parsed;
        } else {
          hasInvalidValues = true;
        }
      }

      if (hasInvalidValues) {
        this.logger?.error('Failed to load configuration from environment: Error: Invalid environment variable value');
      } else if (process.env.UNIVERSAL_MAX_ERRORS || 
                 process.env.UNIVERSAL_ERROR_RESET_INTERVAL || 
                 process.env.UNIVERSAL_MEMORY_LIMIT_MB || 
                 process.env.UNIVERSAL_MEMORY_CHECK_INTERVAL || 
                 process.env.UNIVERSAL_MAX_CHUNK_SIZE || 
                 process.env.UNIVERSAL_CHUNK_OVERLAP || 
                 process.env.UNIVERSAL_MAX_LINES_PER_CHUNK || 
                 process.env.UNIVERSAL_BACKUP_PATTERNS !== undefined || 
                 process.env.UNIVERSAL_BACKUP_CONFIDENCE_THRESHOLD) {
        this.logger?.info('Universal processing configuration loaded from environment variables');
      }
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
    backupFileConfidenceThreshold: number;
  } {
    return {
      backupFilePatterns: [...this.backupFilePatterns],
      backupFileConfidenceThreshold: this.backupFileConfidenceThreshold
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
   * 获取备份文件置信度阈值
   */
  getBackupFileConfidenceThreshold(): number {
    return this.backupFileConfidenceThreshold;
  }
  
  /**
   * 设置备份文件置信度阈值
   */
  setBackupFileConfidenceThreshold(threshold: number): void {
    // 只有在值有效时才更新内部值和记录日志
    if (threshold >= 0 && threshold <= 1) {
      this.backupFileConfidenceThreshold = threshold;
      this.logger?.info(`Backup file confidence threshold set to ${threshold}`);
    }
    // 当输入值无效时，不更新内部值，也不记录任何信息
  }

  /**
   * 获取所有配置
   */
  getAllConfig(): {
    error: { maxErrors: number; errorResetInterval: number };
    memory: { memoryLimitMB: number; memoryCheckInterval: number };
    chunking: { maxChunkSize: number; chunkOverlap: number; maxLinesPerChunk: number };
    backup: { backupFilePatterns: string[]; backupFileConfidenceThreshold: number };
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
    this.backupFileConfidenceThreshold = 0.7;
    
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
    
    // 验证备份文件置信度阈值
    if (this.backupFileConfidenceThreshold < 0 || this.backupFileConfidenceThreshold > 1) {
      errors.push('backupFileConfidenceThreshold must be between 0 and 1');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}