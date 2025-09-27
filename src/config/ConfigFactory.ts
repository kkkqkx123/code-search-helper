import { injectable } from 'inversify';
import { ConfigService } from './ConfigService';
import { AppConfig } from './ConfigTypes';

@injectable()
export class ConfigFactory {
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  /**
   * 获取完整的应用配置
   */
  getAppConfig(): AppConfig {
    const config = this.configService.getAll();
    
    // 确保caching配置包含所有必需的属性
    const cachingConfig = config.caching;
    const processedCachingConfig: AppConfig['caching'] = cachingConfig
      ? {
          defaultTTL: cachingConfig.defaultTTL,
          maxSize: cachingConfig.maxSize,
          cleanupInterval: (cachingConfig as any).cleanupInterval || 600000, // 10 minutes as default
        }
      : {
          defaultTTL: 300,
          maxSize: 1000,
          cleanupInterval: 600000, // 10 minutes
        };
    
    return {
      environment: {
        nodeEnv: config.nodeEnv,
        port: config.port,
        logLevel: config.logging.level,
        debug: config.nodeEnv === 'development',
      },
      qdrant: config.qdrant,
      embedding: config.embedding,
      logging: config.logging,
      monitoring: config.monitoring,
      fileProcessing: config.fileProcessing,
      batchProcessing: config.batchProcessing,
      redis: config.redis,
      lsp: config.lsp,
      semgrep: config.semgrep,
      mlReranking: config.mlReranking,
      caching: processedCachingConfig,
      indexing: config.indexing,
      nebula: config.nebula,
      performance: config.performance,
      cache: config.cache,
      fusion: config.fusion,
    };
  }

  /**
   * 获取Qdrant配置
   */
  getQdrantConfig(): AppConfig['qdrant'] {
    return this.configService.get('qdrant');
  }

  /**
   * 获取嵌入器配置
   */
  getEmbeddingConfig(): AppConfig['embedding'] {
    return this.configService.get('embedding');
  }

  /**
   * 获取环境配置
   */
  getEnvironmentConfig(): AppConfig['environment'] {
    const config = this.configService.getAll();
    return {
      nodeEnv: config.nodeEnv,
      port: config.port,
      logLevel: config.logging.level,
      debug: config.nodeEnv === 'development',
    };
  }

  /**
   * 获取日志配置
   */
  getLoggingConfig(): AppConfig['logging'] {
    return this.configService.get('logging');
  }

  /**
   * 获取监控配置
   */
  getMonitoringConfig(): AppConfig['monitoring'] {
    return this.configService.get('monitoring');
  }

  /**
   * 获取文件处理配置
   */
  getFileProcessingConfig(): AppConfig['fileProcessing'] {
    return this.configService.get('fileProcessing');
  }

  /**
   * 获取批处理配置
   */
  getBatchProcessingConfig(): AppConfig['batchProcessing'] {
    return this.configService.get('batchProcessing');
  }

  /**
   * 获取Redis配置
   */
  getRedisConfig(): AppConfig['redis'] {
    return this.configService.get('redis');
  }

  /**
   * 获取LSP配置
   */
  getLSPConfig(): AppConfig['lsp'] {
    return this.configService.get('lsp');
  }

  /**
   * 获取Semgrep配置
   */
  getSemgrepConfig(): AppConfig['semgrep'] {
    return this.configService.get('semgrep');
  }

  /**
   * 获取ML重排序配置
   */
  getMLRerankingConfig(): AppConfig['mlReranking'] | undefined {
    return this.configService.get('mlReranking');
  }

  /**
   * 获取缓存配置
   */
  getCachingConfig(): AppConfig['caching'] {
    const cachingConfig = this.configService.get('caching');
    if (cachingConfig) {
      // 确保返回的对象包含所有必需的字段
      return {
        defaultTTL: cachingConfig.defaultTTL,
        maxSize: cachingConfig.maxSize,
        cleanupInterval: (cachingConfig as any).cleanupInterval || 600000, // 10 minutes as default
      };
    }
    // 返回默认值
    return {
      defaultTTL: 300,
      maxSize: 1000,
      cleanupInterval: 600000, // 10 minutes
    };
  }

  /**
   * 获取索引配置
   */
  getIndexingConfig(): AppConfig['indexing'] {
    return this.configService.get('indexing');
  }

  /**
   * 获取端口
   */
  getPort(): number {
    return this.configService.get('port');
  }

  /**
   * 获取节点环境
   */
  getNodeEnv(): string {
    return this.configService.get('nodeEnv');
  }

  /**
   * 检查是否为开发环境
   */
  isDevelopment(): boolean {
    return this.getNodeEnv() === 'development';
  }

  /**
   * 检查是否为生产环境
   */
  isProduction(): boolean {
    return this.getNodeEnv() === 'production';
  }

  /**
   * 检查是否为测试环境
   */
  isTest(): boolean {
    return this.getNodeEnv() === 'test';
  }
}