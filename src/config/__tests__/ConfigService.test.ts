import { ConfigService } from '../ConfigService';
import { Container } from 'inversify';

// 模拟依赖注入容器
const mockContainer = {
  get: jest.fn((serviceIdentifier: any) => {
    // 返回模拟的配置服务实例
    if (serviceIdentifier.name === 'EnvironmentConfigService') {
      return {
        getConfig: () => ({
          nodeEnv: 'test',
          port: 3010,
          logLevel: 'info',
          debug: false,
        })
      };
    }
    if (serviceIdentifier.name === 'QdrantConfigService') {
      return {
        getConfig: () => ({
          host: '127.0.0.1',
          port: 6333,
          collection: 'code-snippets',
          useHttps: false,
          timeout: 30000,
        })
      };
    }
    if (serviceIdentifier.name === 'EmbeddingConfigService') {
      return {
        getConfig: () => ({
          provider: 'siliconflow',
          providerConfig: {
            apiKey: undefined,
            baseUrl: 'https://api.siliconflow.cn',
            model: 'BAAI/bge-m3',
            dimensions: 1024,
          },
          weights: {
            quality: 0.7,
            performance: 0.3,
          }
        })
      };
    }
    if (serviceIdentifier.name === 'LoggingConfigService') {
      return {
        getConfig: () => ({
          level: 'info',
          format: 'json',
        })
      };
    }
    if (serviceIdentifier.name === 'MonitoringConfigService') {
      return {
        getConfig: () => ({
          enabled: true,
          port: 9090,
        })
      };
    }
    if (serviceIdentifier.name === 'FileProcessingConfigService') {
      return {
        getConfig: () => ({
          maxFileSize: 10485760,
          supportedExtensions: ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.r', '.m', '.mm'],
          excludePatterns: ['node_modules/**', 'dist/**', 'build/**', '*.min.js', '*.bundle.js'],
          batchSize: 100,
          processingConcurrency: 5,
        })
      };
    }
    
    if (serviceIdentifier.name === 'ProjectConfigService') {
      return {
        getConfig: () => ({
          maxProjects: 100,
          projectMappingFile: './data/project-mapping.json',
          autoCleanup: true,
          cleanupInterval: 86400,
        })
      };
    }
    if (serviceIdentifier.name === 'IndexingConfigService') {
      return {
        getConfig: () => ({
          enabled: true,
          updateInterval: 300,
          maxFileSize: 5242880,
          batchSize: 50,
        })
      };
    }
    if (serviceIdentifier.name === 'TreeSitterConfigService') {
      return {
        getConfig: () => ({
          parserPaths: {
            javascript: './parsers/tree-sitter-javascript.wasm',
            typescript: './parsers/tree-sitter-typescript.wasm',
            python: './parsers/tree-sitter-python.wasm',
            java: './parsers/tree-sitter-java.wasm',
            go: './parsers/tree-sitter-go.wasm',
            rust: './parsers/tree-sitter-rust.wasm',
          },
          timeout: 5000,
        })
      };
    }
    if (serviceIdentifier.name === 'ProjectNamingConfigService') {
      return {
        getConfig: () => ({
          qdrant: {
            defaultCollection: 'default',
            namingPattern: '{projectId}',
          },
          nebula: {
            defaultSpace: 'default',
            namingPattern: '{projectId}',
          },
        })
      };
    }
    if (serviceIdentifier.name === 'MemoryMonitorConfigService') {
      return {
        getConfig: () => ({
          warningThreshold: 0.70,
          criticalThreshold: 0.85,
          emergencyThreshold: 0.95,
          checkInterval: 30000,
          cleanupCooldown: 30000,
          maxHistorySize: 100,
        })
      };
    }
    // 为其他配置服务提供默认值
    return {
      getConfig: () => ({})
    };
  })
};

// 模拟环境变量
const originalEnv = process.env;

// 保存原始的mock实现
const originalMockImplementation = mockContainer.get.getMockImplementation();

describe('ConfigService', () => {
  let configService: ConfigService;

  beforeEach(() => {
    // 每个测试前重置环境变量
    process.env = { ...originalEnv };
    // 清除日志级别环境变量以确保使用默认值
    delete process.env.LOG_LEVEL;

    // 恢复原始的mock实现
    mockContainer.get.mockImplementation(originalMockImplementation);

    // 创建ConfigService实例，传入模拟的服务
    configService = new ConfigService(
      mockContainer.get({ name: 'EnvironmentConfigService' }) as any,
      mockContainer.get({ name: 'QdrantConfigService' }) as any,
      mockContainer.get({ name: 'EmbeddingConfigService' }) as any,
      mockContainer.get({ name: 'MemoryMonitorConfigService' }) as any,
      mockContainer.get({ name: 'FileProcessingConfigService' }) as any,
      mockContainer.get({ name: 'ProjectConfigService' }) as any,
      mockContainer.get({ name: 'IndexingConfigService' }) as any,
      mockContainer.get({ name: 'TreeSitterConfigService' }) as any,
      mockContainer.get({ name: 'ProjectNamingConfigService' }) as any,
      mockContainer.get({ name: 'EmbeddingBatchConfigService' }) as any,
      mockContainer.get({ name: 'GraphCacheConfigService' }) as any,
    );
  });

  afterEach(() => {
    // 每个测试后恢复环境变量
    process.env = originalEnv;
    // 恢复原始的mock实现
    mockContainer.get.mockImplementation(originalMockImplementation);
  });

  describe('构造函数和配置验证', () => {
    it('应该使用默认值创建配置', async () => {
      await configService.initialize();
      const config = configService.getAll();

      expect(config.environment.nodeEnv).toBe('test');
      expect(config.environment.port).toBe(3010);
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

    it('应该从环境变量加载配置', async () => {
      // 更新模拟容器的返回值以反映新的环境变量
      mockContainer.get.mockImplementation((serviceIdentifier: any) => {
        if (serviceIdentifier.name === 'EnvironmentConfigService') {
          return {
            getConfig: () => ({
              nodeEnv: 'production',
              port: 8080,
              logLevel: 'debug',
              debug: false,
            })
          };
        }
        if (serviceIdentifier.name === 'QdrantConfigService') {
          return {
            getConfig: () => ({
              host: 'test-host',
              port: 634,
              collection: 'test-collection',
              useHttps: true,
              timeout: 60000,
            })
          };
        }
        if (serviceIdentifier.name === 'EmbeddingConfigService') {
          return {
            getConfig: () => ({
              provider: 'ollama',
              providerConfig: {
                baseUrl: 'http://localhost:11434',
                model: 'nomic-embed-text',
                dimensions: 768,
              },
              weights: {
                quality: 0.7,
                performance: 0.3,
              }
            })
          };
        }
        if (serviceIdentifier.name === 'LoggingConfigService') {
          return {
            getConfig: () => ({
              level: 'debug',
              format: 'text',
            })
          };
        }
        if (serviceIdentifier.name === 'MonitoringConfigService') {
          return {
            getConfig: () => ({
              enabled: false,
              port: 9091,
            })
          };
        }
        return {
          getConfig: () => ({})
        };
      });

      // 重新创建实例以使用新的配置
      const newConfigService = new ConfigService(
      mockContainer.get({ name: 'EnvironmentConfigService' }) as any,
      mockContainer.get({ name: 'QdrantConfigService' }) as any,
      mockContainer.get({ name: 'EmbeddingConfigService' }) as any,
      mockContainer.get({ name: 'MemoryMonitorConfigService' }) as any,
      mockContainer.get({ name: 'FileProcessingConfigService' }) as any,
      mockContainer.get({ name: 'ProjectConfigService' }) as any,
      mockContainer.get({ name: 'IndexingConfigService' }) as any,
      mockContainer.get({ name: 'TreeSitterConfigService' }) as any,
      mockContainer.get({ name: 'ProjectNamingConfigService' }) as any,
      mockContainer.get({ name: 'EmbeddingBatchConfigService' }) as any,
      mockContainer.get({ name: 'GraphCacheConfigService' }) as any,
      );
      await newConfigService.initialize();
      const config = newConfigService.getAll();

      expect(config.environment.nodeEnv).toBe('production');
      expect(config.environment.port).toBe(8080);
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
      // 更新模拟容器的返回值以包含会抛出错误的配置服务
      mockContainer.get.mockImplementation((serviceIdentifier: any) => {
        if (serviceIdentifier.name === 'EnvironmentConfigService') {
          return {
            getConfig: () => {
              throw new Error('Environment config validation error: "port" must be a number');
            }
          };
        }
        return {
          getConfig: () => ({})
        };
      });

      const newConfigService = new ConfigService(
      mockContainer.get({ name: 'EnvironmentConfigService' }) as any,
      mockContainer.get({ name: 'QdrantConfigService' }) as any,
      mockContainer.get({ name: 'EmbeddingConfigService' }) as any,
      mockContainer.get({ name: 'MemoryMonitorConfigService' }) as any,
      mockContainer.get({ name: 'FileProcessingConfigService' }) as any,
      mockContainer.get({ name: 'ProjectConfigService' }) as any,
      mockContainer.get({ name: 'IndexingConfigService' }) as any,
      mockContainer.get({ name: 'TreeSitterConfigService' }) as any,
      mockContainer.get({ name: 'ProjectNamingConfigService' }) as any,
      mockContainer.get({ name: 'EmbeddingBatchConfigService' }) as any,
      mockContainer.get({ name: 'GraphCacheConfigService' }) as any,
      );

      // 现在initialize()方法应该抛出错误，因为getConfig()会抛出错误
      return expect(newConfigService.initialize()).rejects.toThrow();
    });
  });

  describe('get方法', () => {
    it('应该返回指定的配置键值', async () => {
      await configService.initialize();
      const environment = configService.get('environment');
      expect(environment.nodeEnv).toBe('test');
      expect(environment.port).toBe(3010);
    });

    it('应该返回嵌套配置对象', async () => {
      await configService.initialize();
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
      expect(embeddingConfig.provider).toBe('siliconflow');
    });
  });

  describe('getAll方法', () => {
    it('应该返回所有配置的副本', async () => {
      await configService.initialize();
      const config1 = configService.getAll();
      const config2 = configService.getAll();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // 应该是不同的对象引用
    });
  });

  describe('专用配置获取方法', () => {
    it('应该返回Qdrant配置', async () => {
      await configService.initialize();
      const qdrantConfig = configService.get('qdrant');
      expect(qdrantConfig.host).toBe('127.0.0.1');
      expect(qdrantConfig.port).toBe(6333);
    });

    it('应该返回环境配置', async () => {
      await configService.initialize();
      const envConfig = configService.get('environment');
      expect(envConfig.nodeEnv).toBe('test');
      expect(envConfig.port).toBe(3010);
    });

    it('应该返回端口配置', async () => {
      await configService.initialize();
      const envConfig = configService.get('environment');
      expect(envConfig.port).toBe(3010);
    });

    it('应该返回嵌入器配置', async () => {
      await configService.initialize();
      const embeddingConfig = configService.get('embedding');
      expect(embeddingConfig.provider).toBe('siliconflow');
    });
  });

  describe('getAll方法', () => {
    it('应该返回所有配置', async () => {
      await configService.initialize();
      const config = configService.getAll();
      expect(config).toBeDefined();
      expect(config.environment).toBeDefined();
      expect(config.qdrant).toBeDefined();
      expect(config.embedding).toBeDefined();
      expect(config.logging).toBeDefined();
      expect(config.monitoring).toBeDefined();
    });
  });

  describe('依赖注入模式', () => {
    it('应该使用依赖注入容器', async () => {
      await configService.initialize();
      expect(configService).toBeDefined();
      expect(configService.getAll()).toBeDefined();
    });
  });

  describe('嵌入器配置', () => {
    it('应该正确处理OpenAI配置', async () => {
      // 更新模拟容器的返回值以包含OpenAI配置
      mockContainer.get.mockImplementation((serviceIdentifier: any) => {
        if (serviceIdentifier.name === 'EmbeddingConfigService') {
          return {
            getConfig: () => ({
              provider: 'openai',
              providerConfig: {
                apiKey: 'test-key',
                baseUrl: 'https://test.openai.com',
                model: 'test-model',
                dimensions: 1024,
              },
              weights: {
                quality: 0.7,
                performance: 0.3,
              }
            })
          };
        }
        return {
        getConfig: () => ({})
        };
        });

        const newConfigService = new ConfigService(
        mockContainer.get({ name: 'EnvironmentConfigService' }) as any,
        mockContainer.get({ name: 'QdrantConfigService' }) as any,
        mockContainer.get({ name: 'EmbeddingConfigService' }) as any,
        mockContainer.get({ name: 'MemoryMonitorConfigService' }) as any,
        mockContainer.get({ name: 'FileProcessingConfigService' }) as any,
        mockContainer.get({ name: 'ProjectConfigService' }) as any,
        mockContainer.get({ name: 'IndexingConfigService' }) as any,
        mockContainer.get({ name: 'TreeSitterConfigService' }) as any,
        mockContainer.get({ name: 'ProjectNamingConfigService' }) as any,
        mockContainer.get({ name: 'EmbeddingBatchConfigService' }) as any,
        mockContainer.get({ name: 'GraphCacheConfigService' }) as any,
        );
      await newConfigService.initialize();
      const embeddingConfig = newConfigService.get('embedding');

      expect(embeddingConfig.provider).toBe('openai');
    });

    it('应该正确处理Ollama配置', async () => {
      // 更新模拟容器的返回值以包含Ollama配置
      mockContainer.get.mockImplementation((serviceIdentifier: any) => {
        if (serviceIdentifier.name === 'EmbeddingConfigService') {
          return {
            getConfig: () => ({
              provider: 'ollama',
              providerConfig: {
                baseUrl: 'http://test.ollama.com',
                model: 'test-ollama-model',
                dimensions: 512,
              },
              weights: {
                quality: 0.7,
                performance: 0.3,
              }
            })
          };
        }
        return {
        getConfig: () => ({})
        };
        });

        const newConfigService = new ConfigService(
        mockContainer.get({ name: 'EnvironmentConfigService' }) as any,
        mockContainer.get({ name: 'QdrantConfigService' }) as any,
        mockContainer.get({ name: 'EmbeddingConfigService' }) as any,
        mockContainer.get({ name: 'MemoryMonitorConfigService' }) as any,
        mockContainer.get({ name: 'FileProcessingConfigService' }) as any,
        mockContainer.get({ name: 'ProjectConfigService' }) as any,
        mockContainer.get({ name: 'IndexingConfigService' }) as any,
        mockContainer.get({ name: 'TreeSitterConfigService' }) as any,
        mockContainer.get({ name: 'ProjectNamingConfigService' }) as any,
        mockContainer.get({ name: 'EmbeddingBatchConfigService' }) as any,
        mockContainer.get({ name: 'GraphCacheConfigService' }) as any,
        );
      await newConfigService.initialize();
      const embeddingConfig = newConfigService.get('embedding');

      expect(embeddingConfig.provider).toBe('ollama');
    });

    it('应该正确处理Gemini配置', async () => {
      // 更新模拟容器的返回值以包含Gemini配置
      mockContainer.get.mockImplementation((serviceIdentifier: any) => {
        if (serviceIdentifier.name === 'EmbeddingConfigService') {
          return {
            getConfig: () => ({
              provider: 'gemini',
              providerConfig: {
                apiKey: 'gemini-test-key',
                baseUrl: 'https://test.gemini.com',
                model: 'test-gemini-model',
                dimensions: 384,
              },
              weights: {
                quality: 0.7,
                performance: 0.3,
              }
            })
          };
        }
        return {
        getConfig: () => ({})
        };
        });

        const newConfigService = new ConfigService(
        mockContainer.get({ name: 'EnvironmentConfigService' }) as any,
        mockContainer.get({ name: 'QdrantConfigService' }) as any,
        mockContainer.get({ name: 'EmbeddingConfigService' }) as any,
        mockContainer.get({ name: 'MemoryMonitorConfigService' }) as any,
        mockContainer.get({ name: 'FileProcessingConfigService' }) as any,
        mockContainer.get({ name: 'ProjectConfigService' }) as any,
        mockContainer.get({ name: 'IndexingConfigService' }) as any,
        mockContainer.get({ name: 'TreeSitterConfigService' }) as any,
        mockContainer.get({ name: 'ProjectNamingConfigService' }) as any,
        mockContainer.get({ name: 'EmbeddingBatchConfigService' }) as any,
        mockContainer.get({ name: 'GraphCacheConfigService' }) as any,
        );
      await newConfigService.initialize();
      const embeddingConfig = newConfigService.get('embedding');

      expect(embeddingConfig.provider).toBe('gemini');
    });
  });

  

});