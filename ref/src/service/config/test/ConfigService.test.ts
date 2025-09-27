// Clear environment variables before importing ConfigService
const originalEnv = { ...process.env };
Object.keys(process.env).forEach(key => {
  if (
    key.startsWith('QDRANT_') ||
    key.startsWith('NEBULA_') ||
    key.startsWith('EMBEDDING_') ||
    key.startsWith('ENABLE_METRICS') ||
    key.startsWith('OPENAI_') ||
    key.startsWith('OLLAMA_') ||
    key.startsWith('GEMINI_') ||
    key.startsWith('MISTRAL_') ||
    key.startsWith('SILICONFLOW_') ||
    key.startsWith('CUSTOM_') ||
    key.startsWith('LOG_') ||
    key.startsWith('METRICS_') ||
    key.startsWith('MAX_') ||
    key.startsWith('SUPPORTED_') ||
    key.startsWith('INDEX_') ||
    key.startsWith('CHUNK_') ||
    key.startsWith('OVERLAP_')
  ) {
    delete process.env[key];
  }
});

import { ConfigService, Config } from '../ConfigService';

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

describe('ConfigService', () => {
  let testEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store test environment variables
    testEnv = { ...process.env };

    // Set required environment variables for tests
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.SILICONFLOW_API_KEY = 'test-siliconflow-key';
    process.env.NODE_ENV = 'development';

    // Reset the singleton instance
    (ConfigService as any).instance = undefined;
  });

  afterEach(() => {
    // Restore test environment variables
    process.env = testEnv;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = ConfigService.getInstance();
      const instance2 = ConfigService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create only one instance even when called concurrently', () => {
      const instances: ConfigService[] = [];

      // Create multiple instances in quick succession
      for (let i = 0; i < 10; i++) {
        instances.push(ConfigService.getInstance());
      }

      // All instances should be the same
      expect(new Set(instances).size).toBe(1);
    });
  });

  describe('Configuration Validation', () => {
    it('should use default values when environment variables are not set', () => {
      const configService = ConfigService.getInstance();

      expect(configService.get('nodeEnv')).toBe('development');
      expect(configService.get('port')).toBe(3000);
      expect(configService.get('logging').level).toBe('info'); // Default value from ConfigService
      expect(configService.get('logging').format).toBe('json');
    });

    it('should use environment variables when provided', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.LOG_LEVEL = 'debug';
      process.env.LOG_FORMAT = 'text';

      const configService = ConfigService.getInstance();

      expect(configService.get('nodeEnv')).toBe('production');
      expect(configService.get('port')).toBe(8080);
      expect(configService.get('logging').level).toBe('debug');
      expect(configService.get('logging').format).toBe('text');
    });

    it('should validate node environment', () => {
      process.env.NODE_ENV = 'invalid';

      expect(() => {
        ConfigService.getInstance();
      }).toThrow('Configuration validation error');
    });

    it('should validate port number', () => {
      process.env.PORT = 'invalid';

      expect(() => {
        ConfigService.getInstance();
      }).toThrow('Configuration validation error');
    });

    it('should validate embedding provider', () => {
      process.env.EMBEDDING_PROVIDER = 'invalid';

      expect(() => {
        ConfigService.getInstance();
      }).toThrow('Configuration validation error');
    });

    it('should require API key for selected embedding provider', () => {
      // Reset the singleton to test validation
      (ConfigService as any).instance = undefined;

      const originalOpenAIKey = process.env.OPENAI_API_KEY;
      process.env.EMBEDDING_PROVIDER = 'openai';
      delete process.env.OPENAI_API_KEY;
      // Keep MISTRAL_API_KEY since it's always required

      expect(() => {
        ConfigService.getInstance();
      }).toThrow('Configuration validation error');

      // Restore the API key
      process.env.OPENAI_API_KEY = originalOpenAIKey;
      (ConfigService as any).instance = undefined;
    });

    it('should parse numeric environment variables correctly', () => {
      process.env.MAX_FILE_SIZE = '20971520'; // 20MB
      process.env.INDEX_BATCH_SIZE = '200';
      process.env.CHUNK_SIZE = '1500';

      const configService = ConfigService.getInstance();

      expect(configService.get('fileProcessing').maxFileSize).toBe(20971520);
      expect(configService.get('fileProcessing').indexBatchSize).toBe(200);
      expect(configService.get('fileProcessing').chunkSize).toBe(1500);
    });

    it('should parse boolean environment variables correctly', () => {
      process.env.ENABLE_METRICS = 'true';
      process.env.BATCH_PROCESSING_ENABLED = 'false';

      const configService = ConfigService.getInstance();

      expect(configService.get('monitoring').enabled).toBe(true);
      expect(configService.get('batchProcessing').enabled).toBe(false);
    });

    it('should parse float environment variables correctly', () => {
      process.env.HIGH_ERROR_RATE_THRESHOLD = '0.15';
      process.env.ADJUSTMENT_FACTOR = '1.5';

      const configService = ConfigService.getInstance();

      expect(configService.get('batchProcessing').monitoring.alertThresholds.highErrorRate).toBe(
        0.15
      );
      expect(configService.get('batchProcessing').adaptiveBatching.adjustmentFactor).toBe(1.5);
    });
  });

  describe('Database Configuration', () => {
    it('should use default database settings', () => {
      const configService = ConfigService.getInstance();

      expect(configService.get('qdrant').host).toBe('localhost');
      expect(configService.get('qdrant').port).toBe(6333);
      expect(configService.get('qdrant').collection).toBe('code-snippets');

      expect(configService.get('nebula').host).toBe('localhost');
      expect(configService.get('nebula').port).toBe(9669);
      expect(configService.get('nebula').username).toBe('root');
      expect(configService.get('nebula').password).toBe('nebula');
      expect(configService.get('nebula').space).toBe('codegraph');
    });

    it('should use custom database settings when provided', () => {
      process.env.QDRANT_HOST = 'qdrant.example.com';
      process.env.QDRANT_PORT = '6334';
      process.env.QDRANT_COLLECTION = 'custom-collection';

      process.env.NEBULA_HOST = 'nebula.example.com';
      process.env.NEBULA_PORT = '9670';
      process.env.NEBULA_USERNAME = 'admin';
      process.env.NEBULA_PASSWORD = 'secret';
      process.env.NEBULA_SPACE = 'custom-space';

      const configService = ConfigService.getInstance();

      expect(configService.get('qdrant').host).toBe('qdrant.example.com');
      expect(configService.get('qdrant').port).toBe(6334);
      expect(configService.get('qdrant').collection).toBe('custom-collection');

      expect(configService.get('nebula').host).toBe('nebula.example.com');
      expect(configService.get('nebula').port).toBe(9670);
      expect(configService.get('nebula').username).toBe('admin');
      expect(configService.get('nebula').password).toBe('secret');
      expect(configService.get('nebula').space).toBe('custom-space');
    });
  });

  describe('Embedding Configuration', () => {
    it('should use default embedding settings', () => {
      const configService = ConfigService.getInstance();

      expect(configService.get('embedding').provider).toBe('openai');
      expect(configService.get('embedding').openai.model).toBe('text-embedding-ada-002');
      expect(configService.get('embedding').ollama.baseUrl).toBe('http://localhost:11434');
      expect(configService.get('embedding').ollama.model).toBe('nomic-embed-text');
      expect(configService.get('embedding').gemini.model).toBe('embedding-001');
      expect(configService.get('embedding').mistral.model).toBe('mistral-embed');
      expect(configService.get('embedding').qualityWeight).toBe(0.7);
      expect(configService.get('embedding').performanceWeight).toBe(0.3);
    });

    it('should use custom embedding settings when provided', () => {
      process.env.EMBEDDING_PROVIDER = 'ollama';
      process.env.OLLAMA_BASE_URL = 'http://localhost:11435';
      process.env.OLLAMA_MODEL = 'custom-model';
      process.env.QUALITY_WEIGHT = '0.8';
      process.env.PERFORMANCE_WEIGHT = '0.2';

      const configService = ConfigService.getInstance();

      expect(configService.get('embedding').provider).toBe('ollama');
      expect(configService.get('embedding').ollama.baseUrl).toBe('http://localhost:11435');
      expect(configService.get('embedding').ollama.model).toBe('custom-model');
      expect(configService.get('embedding').qualityWeight).toBe(0.8);
      expect(configService.get('embedding').performanceWeight).toBe(0.2);
    });

    it('should allow dimension rules to be optional', () => {
      const configService = ConfigService.getInstance();

      expect(configService.get('embedding').dimensionRules).toBeUndefined();
    });

    it('should validate weight ranges', () => {
      // Reset the singleton to test validation
      (ConfigService as any).instance = undefined;

      const originalQualityWeight = process.env.QUALITY_WEIGHT;
      const originalPerformanceWeight = process.env.PERFORMANCE_WEIGHT;
      process.env.QUALITY_WEIGHT = '1.5'; // Above 1
      process.env.PERFORMANCE_WEIGHT = '0.5'; // Valid

      expect(() => {
        ConfigService.getInstance();
      }).toThrow('Configuration validation error');

      // Restore the original values
      if (originalQualityWeight) {
        process.env.QUALITY_WEIGHT = originalQualityWeight;
      } else {
        delete process.env.QUALITY_WEIGHT;
      }
      if (originalPerformanceWeight) {
        process.env.PERFORMANCE_WEIGHT = originalPerformanceWeight;
      } else {
        delete process.env.PERFORMANCE_WEIGHT;
      }
      (ConfigService as any).instance = undefined;
    });
  });

  describe('Batch Processing Configuration', () => {
    it('should use default batch processing settings', () => {
      const configService = ConfigService.getInstance();

      expect(configService.get('batchProcessing').enabled).toBe(true);
      expect(configService.get('batchProcessing').maxConcurrentOperations).toBe(5);
      expect(configService.get('batchProcessing').defaultBatchSize).toBe(50);
      expect(configService.get('batchProcessing').maxBatchSize).toBe(500);
      expect(configService.get('batchProcessing').memoryThreshold).toBe(80);
      expect(configService.get('batchProcessing').processingTimeout).toBe(300000);
      expect(configService.get('batchProcessing').retryAttempts).toBe(3);
      expect(configService.get('batchProcessing').retryDelay).toBe(1000);
      expect(configService.get('batchProcessing').continueOnError).toBe(true);
    });

    it('should use custom batch processing settings when provided', () => {
      process.env.BATCH_PROCESSING_ENABLED = 'false';
      process.env.MAX_CONCURRENT_OPERATIONS = '10';
      process.env.DEFAULT_BATCH_SIZE = '100';
      process.env.MAX_BATCH_SIZE = '1000';
      process.env.MEMORY_THRESHOLD = '90';
      process.env.PROCESSING_TIMEOUT = '600000';
      process.env.RETRY_ATTEMPTS = '5';
      process.env.RETRY_DELAY = '2000';
      process.env.CONTINUE_ON_ERROR = 'false';

      const configService = ConfigService.getInstance();

      expect(configService.get('batchProcessing').enabled).toBe(false);
      expect(configService.get('batchProcessing').maxConcurrentOperations).toBe(10);
      expect(configService.get('batchProcessing').defaultBatchSize).toBe(100);
      expect(configService.get('batchProcessing').maxBatchSize).toBe(1000);
      expect(configService.get('batchProcessing').memoryThreshold).toBe(90);
      expect(configService.get('batchProcessing').processingTimeout).toBe(600000);
      expect(configService.get('batchProcessing').retryAttempts).toBe(5);
      expect(configService.get('batchProcessing').retryDelay).toBe(2000);
      expect(configService.get('batchProcessing').continueOnError).toBe(false);
    });

    it('should validate positive numeric values for batch processing', () => {
      process.env.MAX_CONCURRENT_OPERATIONS = '-1';

      expect(() => {
        ConfigService.getInstance();
      }).toThrow('Configuration validation error');
    });
  });

  describe('Adaptive Batching Configuration', () => {
    it('should use default adaptive batching settings', () => {
      const configService = ConfigService.getInstance();

      expect(configService.get('batchProcessing').adaptiveBatching.enabled).toBe(true);
      expect(configService.get('batchProcessing').adaptiveBatching.minBatchSize).toBe(10);
      expect(configService.get('batchProcessing').adaptiveBatching.maxBatchSize).toBe(200);
      expect(configService.get('batchProcessing').adaptiveBatching.performanceThreshold).toBe(1000);
      expect(configService.get('batchProcessing').adaptiveBatching.adjustmentFactor).toBe(1.2);
    });

    it('should use custom adaptive batching settings when provided', () => {
      process.env.ADAPTIVE_BATCHING_ENABLED = 'false';
      process.env.MIN_BATCH_SIZE = '20';
      process.env.ADAPTIVE_MAX_BATCH_SIZE = '300';
      process.env.PERFORMANCE_THRESHOLD = '2000';
      process.env.ADJUSTMENT_FACTOR = '1.5';

      const configService = ConfigService.getInstance();

      expect(configService.get('batchProcessing').adaptiveBatching.enabled).toBe(false);
      expect(configService.get('batchProcessing').adaptiveBatching.minBatchSize).toBe(20);
      expect(configService.get('batchProcessing').adaptiveBatching.maxBatchSize).toBe(300);
      expect(configService.get('batchProcessing').adaptiveBatching.performanceThreshold).toBe(2000);
      expect(configService.get('batchProcessing').adaptiveBatching.adjustmentFactor).toBe(1.5);
    });
  });

  describe('Monitoring Configuration', () => {
    it('should use default monitoring settings', () => {
      const configService = ConfigService.getInstance();

      expect(configService.get('monitoring').enabled).toBe(false); // Default is false since ENABLE_METRICS is not set
      expect(configService.get('monitoring').port).toBe(9090);

      expect(configService.get('batchProcessing').monitoring.enabled).toBe(true);
      expect(configService.get('batchProcessing').monitoring.metricsInterval).toBe(60000);

      const thresholds = configService.get('batchProcessing').monitoring.alertThresholds;
      expect(thresholds.highLatency).toBe(5000);
      expect(thresholds.lowThroughput).toBe(10);
      expect(thresholds.highErrorRate).toBe(0.1);
      expect(thresholds.highMemoryUsage).toBe(80);
      expect(thresholds.criticalMemoryUsage).toBe(90);
      expect(thresholds.highCpuUsage).toBe(70);
      expect(thresholds.criticalCpuUsage).toBe(85);
    });

    it('should use custom monitoring settings when provided', () => {
      process.env.ENABLE_METRICS = 'true';
      process.env.METRICS_PORT = '9091';
      process.env.BATCH_MONITORING_ENABLED = 'false';
      process.env.METRICS_INTERVAL = '120000';
      process.env.HIGH_LATENCY_THRESHOLD = '10000';
      process.env.LOW_THROUGHPUT_THRESHOLD = '5';
      process.env.HIGH_ERROR_RATE_THRESHOLD = '0.2';
      process.env.HIGH_MEMORY_USAGE_THRESHOLD = '85';
      process.env.CRITICAL_MEMORY_USAGE_THRESHOLD = '95';
      process.env.HIGH_CPU_USAGE_THRESHOLD = '75';
      process.env.CRITICAL_CPU_USAGE_THRESHOLD = '90';

      const configService = ConfigService.getInstance();

      expect(configService.get('monitoring').enabled).toBe(true);
      expect(configService.get('monitoring').port).toBe(9091);
      expect(configService.get('batchProcessing').monitoring.enabled).toBe(false);
      expect(configService.get('batchProcessing').monitoring.metricsInterval).toBe(120000);

      const thresholds = configService.get('batchProcessing').monitoring.alertThresholds;
      expect(thresholds.highLatency).toBe(10000);
      expect(thresholds.lowThroughput).toBe(5);
      expect(thresholds.highErrorRate).toBe(0.2);
      expect(thresholds.highMemoryUsage).toBe(85);
      expect(thresholds.criticalMemoryUsage).toBe(95);
      expect(thresholds.highCpuUsage).toBe(75);
      expect(thresholds.criticalCpuUsage).toBe(90);
    });
  });

  describe('get Method', () => {
    it('should return specific configuration values', () => {
      process.env.PORT = '8080';
      const configService = ConfigService.getInstance();

      expect(configService.get('port')).toBe(8080);
      expect(configService.get('qdrant').host).toBe('localhost');
    });

    it('should be type-safe', () => {
      const configService = ConfigService.getInstance();

      // These should compile without TypeScript errors
      const port: number = configService.get('port');
      const nodeEnv: string = configService.get('nodeEnv');
      const monitoringEnabled: boolean = configService.get('monitoring').enabled;

      expect(typeof port).toBe('number');
      expect(typeof nodeEnv).toBe('string');
      expect(typeof monitoringEnabled).toBe('boolean');
    });
  });

  describe('getAll Method', () => {
    it('should return a copy of the entire configuration', () => {
      process.env.PORT = '8080';
      const configService = ConfigService.getInstance();

      const config = configService.getAll();

      expect(config.port).toBe(8080);
      expect(config.nodeEnv).toBe('development');
      expect(config.qdrant.host).toBe('localhost');
    });

    it('should return a copy, not the original object', () => {
      const configService = ConfigService.getInstance();
      const config1 = configService.getAll();
      const config2 = configService.getAll();

      // Should be different objects
      expect(config1).not.toBe(config2);

      // But with same values
      expect(config1).toEqual(config2);
    });
  });

  describe('Environment Variable Parsing', () => {
    it('should handle undefined environment variables gracefully', () => {
      // Don't set any environment variables
      const configService = ConfigService.getInstance();

      // Should use defaults for all values
      expect(configService.get('nodeEnv')).toBe('development');
      expect(configService.get('port')).toBe(3000);
    });

    it('should handle empty string environment variables', () => {
      process.env.PORT = '';
      process.env.NODE_ENV = '';

      expect(() => {
        ConfigService.getInstance();
      }).toThrow('Configuration validation error');
    });

    it('should handle whitespace in environment variables', () => {
      // Reset the singleton to test validation
      (ConfigService as any).instance = undefined;

      const originalPort = process.env.PORT;
      const originalNodeEnv = process.env.NODE_ENV;

      process.env.PORT = ' 8080 ';
      process.env.NODE_ENV = ' development ';

      const configService = ConfigService.getInstance();

      expect(configService.get('port')).toBe(8080);
      expect(configService.get('nodeEnv')).toBe('development');

      // Restore original values
      if (originalPort) {
        process.env.PORT = originalPort;
      } else {
        delete process.env.PORT;
      }
      if (originalNodeEnv) {
        process.env.NODE_ENV = originalNodeEnv;
      } else {
        delete process.env.NODE_ENV;
      }
      (ConfigService as any).instance = undefined;
    });
  });
});
