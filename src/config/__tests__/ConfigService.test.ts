import { ConfigService } from '../ConfigService';

// 模拟环境变量
const originalEnv = process.env;

describe('ConfigService', () => {
 let configService: ConfigService;

  beforeEach(() => {
    // 每个测试前重置环境变量
    process.env = { ...originalEnv };
    // 创建新的实例（因为ConfigService使用单例模式）
    (ConfigService as any).instance = undefined;
    configService = new ConfigService();
  });

  afterEach(() => {
    // 每个测试后恢复环境变量
    process.env = originalEnv;
  });

  describe('构造函数和配置验证', () => {
    it('应该使用默认值创建配置', () => {
      const config = configService.getAll();
      
      expect(config.nodeEnv).toBe('test');
      expect(config.port).toBe(3010);
      expect(config.qdrant.host).toBe('127.0.0.1');
      expect(config.qdrant.port).toBe(6333);
      expect(config.qdrant.collection).toBe('code-snippets');
      expect(config.qdrant.useHttps).toBe(false);
      expect(config.qdrant.timeout).toBe(30000);
      expect(config.embedding.provider).toBe('siliconflow');
      expect(config.logging.level).toBe('info');
      expect(config.logging.format).toBe('json');
      expect(config.monitoring.enabled).toBe(true);
      expect(config.monitoring.port).toBe(9090);
    });

    it('应该从环境变量加载配置', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.QDRANT_HOST = 'test-host';
      process.env.QDRANT_PORT = '634';
      process.env.QDRANT_COLLECTION = 'test-collection';
      process.env.QDRANT_USE_HTTPS = 'true';
      process.env.QDRANT_TIMEOUT = '60000';
      process.env.EMBEDDING_PROVIDER = 'ollama';
      process.env.LOG_LEVEL = 'debug';
      process.env.LOG_FORMAT = 'text';
      process.env.ENABLE_METRICS = 'false';
      process.env.METRICS_PORT = '9091';

      // 重新创建实例以使用新的环境变量
      (ConfigService as any).instance = undefined;
      const newConfigService = new ConfigService();
      const config = newConfigService.getAll();

      expect(config.nodeEnv).toBe('production');
      expect(config.port).toBe(8080);
      expect(config.qdrant.host).toBe('test-host');
      expect(config.qdrant.port).toBe(634);
      expect(config.qdrant.collection).toBe('test-collection');
      expect(config.qdrant.useHttps).toBe(true);
      expect(config.qdrant.timeout).toBe(60000);
      expect(config.embedding.provider).toBe('ollama');
      expect(config.logging.level).toBe('debug');
      expect(config.logging.format).toBe('text');
      expect(config.monitoring.enabled).toBe(false);
      expect(config.monitoring.port).toBe(9091);
    });

    it('应该验证配置并抛出错误', () => {
      process.env.PORT = 'invalid_port';
      
      expect(() => {
        (ConfigService as any).instance = undefined;
        new ConfigService();
      }).toThrow('Configuration validation error:');
    });
  });

 describe('get方法', () => {
    it('应该返回指定的配置键值', () => {
      const nodeEnv = configService.get('nodeEnv');
      expect(nodeEnv).toBe('test');

      const port = configService.get('port');
      expect(port).toBe(3010);
    });

    it('应该返回嵌套配置对象', () => {
      const qdrantConfig = configService.get('qdrant');
      expect(qdrantConfig).toEqual({
        apiKey: undefined,
        host: '127.0.0.1',
        port: 6333,
        collection: 'code-snippets',
        useHttps: false,
        timeout: 30000,
      });

      const embeddingConfig = configService.get('embedding');
      expect(embeddingConfig.provider).toBe('siliconflow');
      expect(embeddingConfig.openai.model).toBe('text-embedding-ada-002');
    });
  });

  describe('getAll方法', () => {
    it('应该返回所有配置的副本', () => {
      const config1 = configService.getAll();
      const config2 = configService.getAll();
      
      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // 应该是不同的对象引用
    });
  });

  describe('专用配置获取方法', () => {
    it('应该返回Qdrant配置', () => {
      const qdrantConfig = configService.getQdrantConfig();
      expect(qdrantConfig.host).toBe('127.0.0.1');
      expect(qdrantConfig.port).toBe(6333);
    });

    it('应该返回环境配置', () => {
      const envConfig = configService.getEnvironmentConfig();
      expect(envConfig).toBe('test');
    });

    it('应该返回端口配置', () => {
      const port = configService.getPort();
      expect(port).toBe(3010);
    });

    it('应该返回嵌入器配置', () => {
      const embeddingConfig = configService.getEmbeddingConfig();
      expect(embeddingConfig.provider).toBe('siliconflow');
    });
  });

 describe('单例模式', () => {
    it('应该返回相同的实例', () => {
      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('应该返回相同的配置', () => {
      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();
      
      expect(instance1.getAll()).toEqual(instance2.getAll());
    });
  });

  describe('嵌入器配置', () => {
    it('应该正确处理OpenAI配置', () => {
      process.env.OPENAI_API_KEY = 'test-key';
      process.env.OPENAI_BASE_URL = 'https://test.openai.com';
      process.env.OPENAI_MODEL = 'test-model';
      process.env.OPENAI_DIMENSIONS = '1024';
      
      (ConfigService as any).instance = undefined;
      const newConfigService = new ConfigService();
      const embeddingConfig = newConfigService.get('embedding');
      
      expect(embeddingConfig.openai.apiKey).toBe('test-key');
      expect(embeddingConfig.openai.baseUrl).toBe('https://test.openai.com');
      expect(embeddingConfig.openai.model).toBe('test-model');
      expect(embeddingConfig.openai.dimensions).toBe(1024);
    });

    it('应该正确处理Ollama配置', () => {
      process.env.OLLAMA_BASE_URL = 'http://test.ollama.com';
      process.env.OLLAMA_MODEL = 'test-ollama-model';
      process.env.OLLAMA_DIMENSIONS = '512';
      
      (ConfigService as any).instance = undefined;
      const newConfigService = new ConfigService();
      const embeddingConfig = newConfigService.get('embedding');
      
      expect(embeddingConfig.ollama.baseUrl).toBe('http://test.ollama.com');
      expect(embeddingConfig.ollama.model).toBe('test-ollama-model');
      expect(embeddingConfig.ollama.dimensions).toBe(512);
    });

    it('应该正确处理Gemini配置', () => {
      process.env.GEMINI_API_KEY = 'gemini-test-key';
      process.env.GEMINI_BASE_URL = 'https://test.gemini.com';
      process.env.GEMINI_MODEL = 'test-gemini-model';
      process.env.GEMINI_DIMENSIONS = '384';
      
      (ConfigService as any).instance = undefined;
      const newConfigService = new ConfigService();
      const embeddingConfig = newConfigService.get('embedding');
      
      expect(embeddingConfig.gemini.apiKey).toBe('gemini-test-key');
      expect(embeddingConfig.gemini.baseUrl).toBe('https://test.gemini.com');
      expect(embeddingConfig.gemini.model).toBe('test-gemini-model');
      expect(embeddingConfig.gemini.dimensions).toBe(384);
    });
  });

 describe('批处理配置', () => {
    it('应该正确处理批处理配置', () => {
      process.env.BATCH_PROCESSING_ENABLED = 'false';
      process.env.MAX_CONCURRENT_OPERATIONS = '10';
      process.env.DEFAULT_BATCH_SIZE = '25';
      process.env.MAX_BATCH_SIZE = '250';
      
      (ConfigService as any).instance = undefined;
      const newConfigService = new ConfigService();
      const batchConfig = newConfigService.get('batchProcessing');
      
      expect(batchConfig.enabled).toBe(false);
      expect(batchConfig.maxConcurrentOperations).toBe(10);
      expect(batchConfig.defaultBatchSize).toBe(25);
      expect(batchConfig.maxBatchSize).toBe(250);
    });
  });

  describe('Semgrep配置', () => {
    it('应该正确处理Semgrep配置', () => {
      process.env.SEMGREP_BINARY_PATH = '/usr/local/bin/semgrep';
      process.env.SEMGREP_TIMEOUT = '60000';
      process.env.SEMGREP_JOBS = '8';
      process.env.SEMGREP_CONFIG_PATHS = 'p/security-audit,p/secrets';
      
      (ConfigService as any).instance = undefined;
      const newConfigService = new ConfigService();
      const semgrepConfig = newConfigService.get('semgrep');
      
      expect(semgrepConfig.binaryPath).toBe('/usr/local/bin/semgrep');
      expect(semgrepConfig.timeout).toBe(60000);
      expect(semgrepConfig.jobs).toBe(8);
      expect(semgrepConfig.configPaths).toEqual(['p/security-audit', 'p/secrets']);
    });
  });
});