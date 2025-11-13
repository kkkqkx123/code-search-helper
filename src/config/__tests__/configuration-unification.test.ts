/**
 * 配置统一验证测试
 * 验证配置模块重构后的正确性和一致性
 */

import { Container } from 'inversify';
import { TYPES } from '../../types';
import { ConfigServiceRegistrar } from '../../core/registrars/ConfigServiceRegistrar';
import { InfrastructureServiceRegistrar } from '../../core/registrars/InfrastructureServiceRegistrar';
import { NebulaConfigService } from '../service/NebulaConfigService';
import { InfrastructureConfigService } from '../../infrastructure/config/InfrastructureConfigService';
import { ConfigService } from '../ConfigService';

describe('配置统一验证测试', () => {
  let container: Container;
  let nebulaConfigService: NebulaConfigService;
  let infrastructureConfigService: InfrastructureConfigService;
  let configService: ConfigService;

  beforeAll(() => {
    container = new Container();

    // 注册基础设施服务
    InfrastructureServiceRegistrar.registerBasicServices(container);

    // 注册配置服务
    ConfigServiceRegistrar.register(container);

    // 获取服务实例
    nebulaConfigService = container.get<NebulaConfigService>(TYPES.NebulaConfigService);
    infrastructureConfigService = container.get<InfrastructureConfigService>(TYPES.InfrastructureConfigService);
    configService = container.get<ConfigService>(TYPES.ConfigService);
  });

  describe('NebulaConfigService 扩展验证', () => {
    it('应该包含连接池配置', () => {
      const config = nebulaConfigService.getConfig();

      expect(config.connectionPool).toBeDefined();
      expect(config.connectionPool?.minConnections).toBeDefined();
      expect(config.connectionPool?.maxConnections).toBeDefined();
      expect(config.connectionPool?.acquireTimeout).toBeDefined();
      expect(config.connectionPool?.idleTimeout).toBeDefined();
    });

    it('应该包含缓存配置', () => {
      const config = nebulaConfigService.getConfig();

      expect(config.cache).toBeDefined();
      expect(config.cache?.defaultTTL).toBeDefined();
      expect(config.cache?.maxEntries).toBeDefined();
      expect(config.cache?.cleanupInterval).toBeDefined();
    });

    it('应该包含性能配置', () => {
      const config = nebulaConfigService.getConfig();

      expect(config.performance).toBeDefined();
      expect(config.performance?.monitoringInterval).toBeDefined();
      expect(config.performance?.queryExecutionTime).toBeDefined();
      expect(config.performance?.memoryUsage).toBeDefined();
    });

    it('应该包含容错配置', () => {
      const config = nebulaConfigService.getConfig();

      expect(config.faultTolerance).toBeDefined();
      expect(config.faultTolerance?.maxRetries).toBeDefined();
      expect(config.faultTolerance?.retryDelay).toBeDefined();
      expect(config.faultTolerance?.exponentialBackoff).toBeDefined();
    });
  });

  describe('配置冲突解决验证', () => {
    it('应该解决连接池配置冲突', () => {
      const nebulaConfig = nebulaConfigService.getConfig();

      // 验证连接池配置一致性
      expect(nebulaConfig.maxConnections).toBe(nebulaConfig.connectionPool?.maxConnections);
    });

    it('应该解决超时配置冲突', () => {
      const nebulaConfig = nebulaConfigService.getConfig();

      // 验证超时配置存在且合理
      expect(nebulaConfig.timeout).toBeGreaterThan(0);
      expect(nebulaConfig.connectionPool?.acquireTimeout).toBeGreaterThan(0);
    });

    it('应该解决重试配置冲突', () => {
      const nebulaConfig = nebulaConfigService.getConfig();

      // 验证重试配置一致性
      expect(nebulaConfig.retryAttempts).toBe(nebulaConfig.faultTolerance?.maxRetries);
    });
  });

  describe('InfrastructureConfigService 简化验证', () => {
    it('应该移除与 NebulaConfigService 重复的配置', () => {
      const infraConfig = infrastructureConfigService.getConfig();

      // 验证不再包含重复的 nebula 连接配置
      expect(infraConfig.nebula).toBeDefined();
      // 但不包含连接池、超时等重复配置
      expect((infraConfig.nebula as any).maxConnections).toBeUndefined();
      expect((infraConfig.nebula as any).timeout).toBeUndefined();
    });

    it('应该保留 Qdrant 特定配置', () => {
      const infraConfig = infrastructureConfigService.getConfig();

      expect(infraConfig.qdrant).toBeDefined();
      expect(infraConfig.qdrant.cache).toBeDefined();
    });
  });

  describe('已移除服务验证', () => {
    it('GraphConfigService 应该已被移除', () => {
      // 验证 GraphConfigService 不再在 TYPES 中定义
      expect((TYPES as any).GraphConfigService).toBeUndefined();

      // 验证容器中没有注册 GraphConfigService
      expect(container.isBound((TYPES as any).GraphConfigService)).toBe(false);
    });

    it('BatchProcessingConfigService 应该已被移除', () => {
      // 验证 BatchProcessingConfigService 不再在 TYPES 中定义
      expect((TYPES as any).BatchProcessingConfigService).toBeUndefined();

      // 验证容器中没有注册 BatchProcessingConfigService
      expect(container.isBound((TYPES as any).BatchProcessingConfigService)).toBe(false);
    });
  });

  describe('向后兼容性验证', () => {
    it('应该支持现有的环境变量', () => {
      // 设置测试环境变量
      process.env.NEBULA_MAX_CONNECTIONS = '20';
      process.env.NEBULA_POOL_MAX_CONNECTIONS = '20';
      process.env.NEBULA_TIMEOUT = '60000';
      process.env.NEBULA_POOL_ACQUIRE_TIMEOUT = '60000';

      // 创建新的配置服务实例
      const testContainer = new Container();
      InfrastructureServiceRegistrar.registerBasicServices(testContainer);
      ConfigServiceRegistrar.register(testContainer);

      const testNebulaConfigService = testContainer.get<NebulaConfigService>(TYPES.NebulaConfigService);
      const config = testNebulaConfigService.getConfig();

      // 验证环境变量生效
      expect(config.maxConnections).toBe(20);
      expect(config.timeout).toBe(60000);

      // 清理环境变量
      delete process.env.NEBULA_MAX_CONNECTIONS;
      delete process.env.NEBULA_TIMEOUT;
    });
  });

  describe('配置验证测试', () => {
    it('应该验证 NebulaConfig 配置的完整性', () => {
      const config = nebulaConfigService.getConfig();

      // 验证必需字段
      expect(config.host).toBeDefined();
      expect(config.port).toBeDefined();
      expect(config.username).toBeDefined();
      expect(config.password).toBeDefined();

      // 验证可选字段有默认值
      expect(config.timeout).toBeGreaterThan(0);
      expect(config.maxConnections).toBeGreaterThan(0);
      expect(config.retryAttempts).toBeGreaterThanOrEqual(0);
    });

    it('应该验证配置值的合理性', () => {
      const config = nebulaConfigService.getConfig();

      // 验证数值范围
      expect(config.port).toBeGreaterThan(0);
      expect(config.port).toBeLessThan(65536);
      expect(config.maxConnections).toBeGreaterThan(0);
      expect(config.maxConnections).toBeLessThan(1000);
      expect(config.timeout).toBeGreaterThan(0);
    });
  });
});