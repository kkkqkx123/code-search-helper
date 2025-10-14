import { injectable, inject } from 'inversify';
import { ConfigService } from './ConfigService';
import { AppConfig } from './ConfigTypes';

@injectable()
export class ConfigFactory {
  private configService: ConfigService;

  constructor(@inject(ConfigService) configService: ConfigService) {
    this.configService = configService;
  }

  /**
   * 获取完整的应用配置
   */
  getAppConfig(): AppConfig {
    return this.configService.getAll();
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
    return this.configService.get('environment');
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
   * 获取热更新配置
   */
  getHotReloadConfig(): AppConfig['hotReload'] {
    return this.configService.get('hotReload');
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
    return this.configService.get('caching');
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
    return this.configService.get('environment').port;
  }

  /**
   * 获取节点环境
   */
  getNodeEnv(): string {
    return this.configService.get('environment').nodeEnv;
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