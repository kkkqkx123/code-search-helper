import { injectable, inject } from 'inversify';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 批处理配置接口
 */
export interface BatchProcessingConfig {
  maxBatchSize: number;
  maxConcurrency: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enabled: boolean;
  maxConcurrentOperations: number;
  defaultBatchSize: number;
  memoryThreshold: number;
  processingTimeout: number;
  continueOnError: boolean;
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    alertThresholds: {
      highLatency: number;
      highMemoryUsage: number;
      highErrorRate: number;
    };
  };
}

/**
 * 批处理上下文
 */
export interface BatchContext {
  domain: string;
  subType?: string;
  operation?: string;
}

/**
 * 统一批处理配置管理服务
 * 整合了原有的BatchConfigManager和GraphBatchConfigManager的功能
 */
@injectable()
export class BatchConfigManager {
  private config: BatchProcessingConfig | null = null;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  /**
   * 获取配置，如果未初始化则使用默认配置
   */
  getConfig(): BatchProcessingConfig {
    if (!this.config) {
      this.config = this.getDefaultConfig();
      this.logger.info('BatchProcessingService config initialized with defaults', {
        config: this.config
      });
    }
    return this.config;
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): BatchProcessingConfig {
    return {
      enabled: true,
      maxConcurrentOperations: 5,
      defaultBatchSize: 50,
      maxBatchSize: 500,
      maxConcurrency: 5,
      timeout: 30000,
      memoryThreshold: 0.80,
      processingTimeout: 300000,
      retryAttempts: 3,
      retryDelay: 1000,
      continueOnError: true,
      monitoring: {
        enabled: true,
        metricsInterval: 60000,
        alertThresholds: {
          highLatency: 5000,
          highMemoryUsage: 0.80,
          highErrorRate: 0.1,
        },
      },
    };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<BatchProcessingConfig>): void {
    this.config = { ...this.getDefaultConfig(), ...config };
    this.logger.info('BatchProcessingService config updated', {
      config: this.config
    });
  }

  /**
   * 重置配置为默认值
   */
  resetConfig(): void {
    this.config = null;
    this.logger.info('BatchProcessingService config reset to defaults');
  }

  /**
   * 计算最优批处理大小
   * 整合了GraphBatchConfigManager的逻辑
   */
  async calculateOptimalBatchSize(files: string[]): Promise<number> {
    try {
      const avgFileSize = await this.calculateAverageFileSize(files);
      const fileTypes = this.analyzeFileTypes(files);
      const systemLoad = this.getSystemLoad();

      // 基于文件大小的基础批次大小
      let baseBatchSize: number;

      if (await avgFileSize > 200 * 1024) { // 大文件 (>200KB)
        baseBatchSize = Math.min(3, files.length);
      } else if (await avgFileSize > 100 * 1024) { // 中等文件 (100-200KB)
        baseBatchSize = Math.min(5, files.length);
      } else if (await avgFileSize > 50 * 1024) { // 小文件 (50-100KB)
        baseBatchSize = Math.min(10, files.length);
      } else { // 很小文件 (<50KB)
        baseBatchSize = Math.min(20, files.length);
      }

      // 基于文件类型调整
      if (fileTypes.has('typescript') || fileTypes.has('java')) {
        baseBatchSize = Math.min(baseBatchSize, 8); // 复杂语言减少批次大小
      } else if (fileTypes.has('json') || fileTypes.has('yaml')) {
        baseBatchSize = Math.max(baseBatchSize, 10); // 配置文件可以增加批次大小
      }

      // 基于系统负载调整
      if (systemLoad > 0.8) {
        baseBatchSize = Math.max(1, Math.floor(baseBatchSize * 0.5)); // 高负载时减半
      } else if (systemLoad > 0.6) {
        baseBatchSize = Math.max(1, Math.floor(baseBatchSize * 0.75)); // 中等负载时减少25%
      }

      // 确保最小批次大小
      const minBatchSize = 1;
      const maxBatchSize = Math.min(25, files.length); // 最大不超过25个文件

      const finalBatchSize = Math.max(minBatchSize, Math.min(baseBatchSize, maxBatchSize));

      this.logger.debug('Calculated optimal batch size', {
        fileCount: files.length,
        avgFileSize: Math.round(avgFileSize / 1024) + 'KB',
        fileTypes: Array.from(fileTypes),
        systemLoad: Math.round(systemLoad * 100) + '%',
        finalBatchSize
      });

      return finalBatchSize;
    } catch (error) {
      this.logger.warn('Failed to calculate optimal batch size, using default', { error });
      return 5; // 默认批次大小
    }
  }

  /**
   * 计算最优并发数
   * 整合了GraphBatchConfigManager的逻辑
   */
  async calculateOptimalConcurrency(files: string[]): Promise<number> {
    try {
      const systemLoad = this.getSystemLoad();
      const fileComplexity = await this.estimateFileComplexity(files);
      const cpuCount = require('os').cpus().length;

      let baseConcurrency = Math.min(4, Math.ceil(files.length / 10));

      // 基于系统负载调整
      if (systemLoad > 0.8 || fileComplexity > 0.7) {
        baseConcurrency = 1; // 高负载或高复杂度时降低并发
      } else if (systemLoad > 0.6 || fileComplexity > 0.5) {
        baseConcurrency = Math.min(2, baseConcurrency); // 中等负载时限制并发
      } else {
        // 低负载时可以根据CPU核心数适当增加并发
        baseConcurrency = Math.min(baseConcurrency, Math.max(2, Math.floor(cpuCount / 2)));
      }

      // 确保并发数在合理范围内
      const finalConcurrency = Math.max(1, Math.min(baseConcurrency, 6));

      this.logger.debug('Calculated optimal concurrency', {
        fileCount: files.length,
        systemLoad: Math.round(systemLoad * 100) + '%',
        fileComplexity: Math.round(fileComplexity * 100) + '%',
        cpuCount,
        finalConcurrency
      });

      return finalConcurrency;
    } catch (error) {
      this.logger.warn('Failed to calculate optimal concurrency, using default', { error });
      return 2; // 默认并发数
    }
  }

  /**
   * 计算文件平均大小
   */
  private async calculateAverageFileSize(files: string[]): Promise<number> {
    if (files.length === 0) return 0;

    let totalSize = 0;
    let validFileCount = 0;

    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        if (stats.isFile()) {
          totalSize += stats.size;
          validFileCount++;
        }
      } catch (error) {
        // 忽略无法访问的文件
        this.logger.debug(`Failed to get file size: ${file}`, { error });
      }
    }

    return validFileCount > 0 ? totalSize / validFileCount : 0;
  }

  /**
   * 分析文件类型分布
   */
  private analyzeFileTypes(files: string[]): Set<string> {
    const fileTypes = new Set<string>();

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      const fileType = this.getFileTypeFromExtension(ext);
      if (fileType) {
        fileTypes.add(fileType);
      }
    }

    return fileTypes;
  }

  /**
   * 根据文件扩展名获取文件类型
   */
  private getFileTypeFromExtension(ext: string): string | null {
    const extensionMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.java': 'java',
      '.py': 'python',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.html': 'html',
      '.htm': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.md': 'markdown',
      '.txt': 'text',
      '.sql': 'sql'
    };

    return extensionMap[ext] || null;
  }

  /**
   * 获取系统负载
   */
  private getSystemLoad(): number {
    try {
      const loadAvg = require('os').loadavg();
      const cpuCount = require('os').cpus().length;
      // 使用1分钟平均负载除以CPU核心数
      return Math.min(loadAvg[0] / cpuCount, 1.0);
    } catch (error) {
      this.logger.debug('Failed to get system load', { error });
      return 0.5; // 默认中等负载
    }
  }

  /**
   * 估算文件复杂度
   */
  private async estimateFileComplexity(files: string[]): Promise<number> {
    if (files.length === 0) return 0;

    let totalComplexity = 0;
    let validFileCount = 0;

    for (const file of files) {
      try {
        const ext = path.extname(file).toLowerCase();
        const complexity = this.getFileComplexity(ext);
        totalComplexity += complexity;
        validFileCount++;
      } catch (error) {
        this.logger.debug(`Failed to estimate complexity for file: ${file}`, { error });
      }
    }

    return validFileCount > 0 ? totalComplexity / validFileCount : 0;
  }

  /**
   * 根据文件类型获取复杂度评分
   */
  private getFileComplexity(ext: string): number {
    const complexityMap: Record<string, number> = {
      '.ts': 0.8,    // TypeScript - 高复杂度
      '.tsx': 0.8,   // TypeScript React - 高复杂度
      '.java': 0.9,  // Java - 很高复杂度
      '.cpp': 0.85,  // C++ - 高复杂度
      '.c': 0.7,     // C - 中高复杂度
      '.cs': 0.8,    // C# - 高复杂度
      '.rs': 0.85,   // Rust - 高复杂度
      '.go': 0.6,    // Go - 中等复杂度
      '.py': 0.5,    // Python - 中等复杂度
      '.js': 0.6,    // JavaScript - 中等复杂度
      '.jsx': 0.7,   // React - 中高复杂度
      '.php': 0.6,   // PHP - 中等复杂度
      '.rb': 0.5,    // Ruby - 中等复杂度
      '.swift': 0.7, // Swift - 中等复杂度
      '.kt': 0.7,    // Kotlin - 中等复杂度
      '.scala': 0.8, // Scala - 高复杂度
      '.json': 0.2,  // JSON - 低复杂度
      '.yaml': 0.2,  // YAML - 低复杂度
      '.yml': 0.2,   // YAML - 低复杂度
      '.xml': 0.4,   // XML - 中低复杂度
      '.html': 0.4,  // HTML - 中低复杂度
      '.css': 0.3,   // CSS - 低复杂度
      '.scss': 0.4,  // SCSS - 中低复杂度
      '.sass': 0.4,  // Sass - 中低复杂度
      '.less': 0.4,  // Less - 中低复杂度
      '.md': 0.1,    // Markdown - 很低复杂度
      '.txt': 0.1,   // Text - 很低复杂度
      '.sql': 0.5    // SQL - 中等复杂度
    };

    return complexityMap[ext] || 0.5; // 默认中等复杂度
  }
}
