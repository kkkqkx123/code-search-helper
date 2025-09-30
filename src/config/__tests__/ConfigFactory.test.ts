import { ConfigFactory } from '../ConfigFactory';
import { ConfigService } from '../ConfigService';

// 模拟ConfigService
const mockConfigService = {
  getAll: jest.fn(),
  get: jest.fn(),
};

describe('ConfigFactory', () => {
  let configFactory: ConfigFactory;

  beforeEach(() => {
    jest.clearAllMocks();
    configFactory = new ConfigFactory(mockConfigService as any);
  });

  describe('getAppConfig', () => {
    it('应该返回完整的应用配置', () => {
      const mockFullConfig = {
        environment: {
          nodeEnv: 'development',
          port: 3000,
          logLevel: 'info',
          debug: true,
        },
        logging: { level: 'info', format: 'json' },
        qdrant: { host: 'localhost', port: 6333, collection: 'test', useHttps: false, timeout: 30000 },
        embedding: { provider: 'openai', openai: { apiKey: 'test', model: 'test', dimensions: 1536 }, ollama: { baseUrl: 'http://localhost:11434', model: 'test', dimensions: 768 }, gemini: { apiKey: 'test', model: 'test', dimensions: 768 }, mistral: { apiKey: 'test', model: 'test', dimensions: 1024 }, siliconflow: { apiKey: 'test', model: 'test', dimensions: 1024 }, qualityWeight: 0.7, performanceWeight: 0.3 },
        monitoring: { enabled: true, port: 9090, prometheusTargetDir: './etc/prometheus' },
        fileProcessing: { maxFileSize: 10485760, supportedExtensions: '.ts,.js,.py', indexBatchSize: 100, chunkSize: 1000, overlapSize: 200 },
        batchProcessing: { enabled: true, maxConcurrentOperations: 5, defaultBatchSize: 50, maxBatchSize: 500, memoryThreshold: 80, processingTimeout: 300000, retryAttempts: 3, retryDelay: 1000, continueOnError: true, adaptiveBatching: { enabled: true, minBatchSize: 10, maxBatchSize: 200, performanceThreshold: 1000, adjustmentFactor: 1.2 }, monitoring: { enabled: true, metricsInterval: 6000, alertThresholds: { highLatency: 5000, lowThroughput: 10, highErrorRate: 0.1, highMemoryUsage: 80, criticalMemoryUsage: 90, highCpuUsage: 70, criticalCpuUsage: 85 } } },
        redis: { enabled: false, url: 'redis://localhost:6379', useMultiLevel: true, ttl: { embedding: 86400, search: 3600, graph: 1800, progress: 300 }, retry: { attempts: 3, delay: 1000 }, pool: { min: 1, max: 10 } },
        lsp: { enabled: true, timeout: 3000, retryAttempts: 3, retryDelay: 100, cacheEnabled: true, cacheTTL: 30, batchSize: 20, maxConcurrency: 5, supportedLanguages: ['typescript'], languageServers: {} },
        semgrep: { binaryPath: 'semgrep', timeout: 3000, maxMemory: 512, maxTargetBytes: 1000000, jobs: 4, noGitIgnore: false, noRewriteRuleIds: false, strict: false, configPaths: ['auto'], customRulesPath: './config/semgrep-rules', enhancedRulesPath: './enhanced-rules', outputFormat: 'json', excludePatterns: ['node_modules'], includePatterns: ['*.js'], severityLevels: ['ERROR'], enableControlFlow: false, enableDataFlow: false, enableTaintAnalysis: false, securitySeverity: ['HIGH'] },
        mlReranking: { modelPath: './model', modelType: 'linear', features: ['semanticScore'], trainingEnabled: true },
        caching: { defaultTTL: 300, maxSize: 1000 },
        indexing: { batchSize: 50, maxConcurrency: 3 },
        nebula: { host: 'localhost', port: 9669, username: 'root', password: 'password', space: 'test' },
        performance: { cleanupInterval: 3600, retentionPeriod: 86400 },
        cache: { ttl: 300, maxEntries: 1000, cleanupInterval: 3600 },
        fusion: { vectorWeight: 0.5, graphWeight: 0.3, contextualWeight: 0.2 },
      };

      mockConfigService.getAll.mockReturnValue(mockFullConfig);

      const appConfig = configFactory.getAppConfig();

      expect(mockConfigService.getAll).toHaveBeenCalled();
      expect(appConfig.environment).toEqual(mockFullConfig.environment);
      expect(appConfig.qdrant).toBe(mockFullConfig.qdrant);
      expect(appConfig.embedding).toBe(mockFullConfig.embedding);
      expect(appConfig.logging).toBe(mockFullConfig.logging);
      expect(appConfig.monitoring).toBe(mockFullConfig.monitoring);
      expect(appConfig.fileProcessing).toBe(mockFullConfig.fileProcessing);
      expect(appConfig.batchProcessing).toBe(mockFullConfig.batchProcessing);
      expect(appConfig.redis).toBe(mockFullConfig.redis);
      expect(appConfig.lsp).toBe(mockFullConfig.lsp);
      expect(appConfig.semgrep).toBe(mockFullConfig.semgrep);
      expect(appConfig.mlReranking).toBe(mockFullConfig.mlReranking);
      expect(appConfig.caching).toBe(mockFullConfig.caching);
      expect(appConfig.indexing).toBe(mockFullConfig.indexing);
      expect(appConfig.nebula).toBe(mockFullConfig.nebula);
      expect(appConfig.performance).toBe(mockFullConfig.performance);
      expect(appConfig.cache).toBe(mockFullConfig.cache);
      expect(appConfig.fusion).toBe(mockFullConfig.fusion);
    });

    it('应该在生产环境中设置debug为false', () => {
      const mockConfig = {
        environment: {
          nodeEnv: 'production',
          port: 3000,
          logLevel: 'info',
          debug: false,
        },
        logging: { level: 'info', format: 'json' },
        qdrant: {},
        embedding: {},
        monitoring: {},
        fileProcessing: {},
        batchProcessing: {},
        redis: {},
        lsp: {},
        semgrep: {},
        caching: {},
        indexing: {},
      };

      mockConfigService.getAll.mockReturnValue(mockConfig);

      const appConfig = configFactory.getAppConfig();

      expect(appConfig.environment.debug).toBe(false);
    });
  });

  describe('特定配置获取方法', () => {
    it('应该返回Qdrant配置', () => {
      const expectedQdrantConfig = { host: 'localhost', port: 6333, collection: 'test', useHttps: false, timeout: 30000 };
      mockConfigService.get.mockReturnValue(expectedQdrantConfig);

      const qdrantConfig = configFactory.getQdrantConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('qdrant');
      expect(qdrantConfig).toBe(expectedQdrantConfig);
    });

    it('应该返回嵌入器配置', () => {
      const expectedEmbeddingConfig = { provider: 'openai', openai: { apiKey: 'test', model: 'test', dimensions: 1536 }, ollama: { baseUrl: 'http://localhost:11434', model: 'test', dimensions: 768 } };
      mockConfigService.get.mockReturnValue(expectedEmbeddingConfig);

      const embeddingConfig = configFactory.getEmbeddingConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('embedding');
      expect(embeddingConfig).toBe(expectedEmbeddingConfig);
    });

    it('应该返回环境配置', () => {
      const expectedEnvConfig = {
        nodeEnv: 'test',
        port: 3000,
        logLevel: 'info',
        debug: false
      };
      mockConfigService.get.mockReturnValue(expectedEnvConfig);

      const envConfig = configFactory.getEnvironmentConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('environment');
      expect(envConfig).toEqual(expectedEnvConfig);
    });

    it('应该返回日志配置', () => {
      const expectedLoggingConfig = { level: 'debug', format: 'json' };
      mockConfigService.get.mockReturnValue(expectedLoggingConfig);

      const loggingConfig = configFactory.getLoggingConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('logging');
      expect(loggingConfig).toBe(expectedLoggingConfig);
    });

    it('应该返回监控配置', () => {
      const expectedMonitoringConfig = { enabled: true, port: 9090, prometheusTargetDir: './etc/prometheus' };
      mockConfigService.get.mockReturnValue(expectedMonitoringConfig);

      const monitoringConfig = configFactory.getMonitoringConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('monitoring');
      expect(monitoringConfig).toBe(expectedMonitoringConfig);
    });

    it('应该返回文件处理配置', () => {
      const expectedFileProcessingConfig = { maxFileSize: 10485760, supportedExtensions: '.ts,.js,.py' };
      mockConfigService.get.mockReturnValue(expectedFileProcessingConfig);

      const fileProcessingConfig = configFactory.getFileProcessingConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('fileProcessing');
      expect(fileProcessingConfig).toBe(expectedFileProcessingConfig);
    });

    it('应该返回批处理配置', () => {
      const expectedBatchProcessingConfig = { enabled: true, maxConcurrentOperations: 5 };
      mockConfigService.get.mockReturnValue(expectedBatchProcessingConfig);

      const batchProcessingConfig = configFactory.getBatchProcessingConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('batchProcessing');
      expect(batchProcessingConfig).toBe(expectedBatchProcessingConfig);
    });

    it('应该返回Redis配置', () => {
      const expectedRedisConfig = { enabled: false, url: 'redis://localhost:6379' };
      mockConfigService.get.mockReturnValue(expectedRedisConfig);

      const redisConfig = configFactory.getRedisConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('redis');
      expect(redisConfig).toBe(expectedRedisConfig);
    });

    it('应该返回LSP配置', () => {
      const expectedLSPConfig = { enabled: true, timeout: 30000 };
      mockConfigService.get.mockReturnValue(expectedLSPConfig);

      const lspConfig = configFactory.getLSPConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('lsp');
      expect(lspConfig).toBe(expectedLSPConfig);
    });

    it('应该返回Semgrep配置', () => {
      const expectedSemgrepConfig = { binaryPath: 'semgrep', timeout: 3000 };
      mockConfigService.get.mockReturnValue(expectedSemgrepConfig);

      const semgrepConfig = configFactory.getSemgrepConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('semgrep');
      expect(semgrepConfig).toBe(expectedSemgrepConfig);
    });

    it('应该返回ML重排序配置', () => {
      const expectedMLRerankingConfig = { modelPath: './model', modelType: 'linear', features: ['semanticScore'], trainingEnabled: true };
      mockConfigService.get.mockReturnValue(expectedMLRerankingConfig);

      const mlRerankingConfig = configFactory.getMLRerankingConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('mlReranking');
      expect(mlRerankingConfig).toBe(expectedMLRerankingConfig);
    });

    it('应该返回缓存配置', () => {
      const expectedCachingConfig = { defaultTTL: 30, maxSize: 1000 };
      mockConfigService.get.mockReturnValue(expectedCachingConfig);

      const cachingConfig = configFactory.getCachingConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('caching');
      expect(cachingConfig).toEqual(expectedCachingConfig);
    });

    it('应该返回索引配置', () => {
      const expectedIndexingConfig = { batchSize: 50, maxConcurrency: 3 };
      mockConfigService.get.mockReturnValue(expectedIndexingConfig);

      const indexingConfig = configFactory.getIndexingConfig();

      expect(mockConfigService.get).toHaveBeenCalledWith('indexing');
      expect(indexingConfig).toBe(expectedIndexingConfig);
    });
  });

  describe('环境检查方法', () => {
    it('应该返回端口', () => {
      mockConfigService.get.mockReturnValue({ port: 3000 });

      const port = configFactory.getPort();

      expect(mockConfigService.get).toHaveBeenCalledWith('environment');
      expect(port).toBe(3000);
    });

    it('应该返回节点环境', () => {
      mockConfigService.get.mockReturnValue({ nodeEnv: 'development' });

      const nodeEnv = configFactory.getNodeEnv();

      expect(mockConfigService.get).toHaveBeenCalledWith('environment');
      expect(nodeEnv).toBe('development');
    });

    it('应该正确检查开发环境', () => {
      mockConfigService.get.mockReturnValue({ nodeEnv: 'development' });

      const isDev = configFactory.isDevelopment();

      expect(mockConfigService.get).toHaveBeenCalledWith('environment');
      expect(isDev).toBe(true);
    });

    it('应该正确检查生产环境', () => {
      mockConfigService.get.mockReturnValue({ nodeEnv: 'production' });

      const isProd = configFactory.isProduction();

      expect(mockConfigService.get).toHaveBeenCalledWith('environment');
      expect(isProd).toBe(true);
    });

    it('应该正确检查测试环境', () => {
      mockConfigService.get.mockReturnValue({ nodeEnv: 'test' });

      const isTest = configFactory.isTest();

      expect(mockConfigService.get).toHaveBeenCalledWith('environment');
      expect(isTest).toBe(true);
    });
  });
});