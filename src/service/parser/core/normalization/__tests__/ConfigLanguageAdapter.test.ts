/**
 * ConfigLanguageAdapter 测试文件
 */

import { ConfigLanguageAdapter, ConfigAdapterOptions } from '../ConfigLanguageAdapter';
import { StandardizedQueryResult } from '../types';

// 创建一个测试用的具体配置语言适配器
class TestConfigAdapter extends ConfigLanguageAdapter {
  extractName(result: any): string {
    return result.captures?.[0]?.node?.text || 'test-config';
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    return {
      testMetadata: 'test-value'
    };
  }

  mapNodeType(nodeType: string): string {
    return nodeType;
  }

  mapQueryTypeToStandardType(queryType: string): 'config-item' | 'section' | 'key' | 'value' | 'array' | 'table' | 'dependency' | 'type-def' {
    const mapping: Record<string, 'config-item' | 'section' | 'key' | 'value' | 'array' | 'table' | 'dependency' | 'type-def'> = {
      'config-items': 'config-item',
      'sections': 'section',
      'keys': 'key',
      'values': 'value',
      'arrays': 'array',
      'tables': 'table',
      'dependencies': 'dependency',
      'types': 'type-def'
    };
    return mapping[queryType] || 'config-item';
  }

  calculateComplexity(result: any): number {
    return 1;
  }

  extractDependencies(result: any): string[] {
    return [];
  }

  extractModifiers(result: any): string[] {
    return [];
  }

  // 重写配置特定的方法进行测试
  protected extractConfigPath(result: any): string {
    return 'test.config.path';
  }

  protected extractDataType(result: any): string {
    return 'string';
  }

  protected extractValidationRules(result: any): string[] {
    return ['required', 'min-length:1'];
  }

  protected isRequired(result: any): boolean {
    return true;
  }
}

describe('ConfigLanguageAdapter', () => {
  let adapter: TestConfigAdapter;

  beforeEach(() => {
    adapter = new TestConfigAdapter();
  });

  describe('基础功能', () => {
    test('应该正确初始化适配器', () => {
      expect(adapter).toBeInstanceOf(ConfigLanguageAdapter);
    });

    test('应该返回支持的查询类型', () => {
      const supportedTypes = adapter.getSupportedQueryTypes();
      expect(supportedTypes).toContain('config-items');
      expect(supportedTypes).toContain('sections');
      expect(supportedTypes).toContain('keys');
      expect(supportedTypes).toContain('values');
      expect(supportedTypes).toContain('arrays');
      expect(supportedTypes).toContain('tables');
      expect(supportedTypes).toContain('dependencies');
      expect(supportedTypes).toContain('types');
    });
  });

  describe('标准化功能', () => {
    test('应该正确标准化配置查询结果', async () => {
      const mockResult = {
        captures: [
          {
            name: 'test.capture',
            node: {
              text: 'test-config-item',
              startPosition: { row: 1, column: 0 },
              endPosition: { row: 3, column: 0 }
            }
          }
        ]
      };

      const results = await adapter.normalize([mockResult], 'config-items', 'toml');

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('config-item');
      expect(results[0].name).toBe('test-config-item');
      expect(results[0].startLine).toBe(2);
      expect(results[0].endLine).toBe(4);
      expect(results[0].content).toBe('test-config-item');
    });

    test('应该正确处理配置元数据', async () => {
      const mockResult = {
        captures: [
          {
            name: 'test.capture',
            node: {
              text: 'test-config',
              startPosition: { row: 1, column: 0 },
              endPosition: { row: 1, column: 12 }
            }
          }
        ]
      };

      const results = await adapter.normalize([mockResult], 'config-items', 'yaml');
      const metadata = results[0].metadata as any;

      expect(metadata.language).toBe('yaml');
      expect(metadata.complexity).toBe(1);
      expect(metadata.dataType).toBe('string');
      expect(metadata.configPath).toBe('test.config.path');
      expect(metadata.validationRules).toEqual(['required', 'min-length:1']);
      expect(metadata.isRequired).toBe(true);
      expect(metadata.testMetadata).toBe('test-value');
    });
  });

  describe('缓存功能', () => {
    test('应该缓存标准化结果', async () => {
      const mockResult = {
        captures: [
          {
            name: 'test.capture',
            node: {
              text: 'cached-config',
              startPosition: { row: 1, column: 0 },
              endPosition: { row: 1, column: 12 }
            }
          }
        ]
      };

      // 第一次调用
      const results1 = await adapter.normalize([mockResult], 'config-items', 'toml');

      // 第二次调用应该使用缓存
      const results2 = await adapter.normalize([mockResult], 'config-items', 'toml');

      expect(results1).toEqual(results2);
    });
  });

  describe('错误处理', () => {
    test('应该处理无效的查询结果', async () => {
      const invalidResults = [
        null,
        undefined,
        {},
        { captures: [] },
        { captures: [{}] }
      ];

      const results = await adapter.normalize(invalidResults, 'config-items', 'toml');
      expect(results).toHaveLength(0);
    });

    test('应该启用错误恢复', async () => {
      const adapterWithErrorRecovery = new TestConfigAdapter({
        enableErrorRecovery: true
      });

      const problematicResult = {
        captures: [
          {
            name: 'test.capture',
            node: null // 会导致错误的节点
          }
        ]
      };

      const results = await adapterWithErrorRecovery.normalize([problematicResult], 'config-items', 'toml');
      expect(results).toBeDefined();
    });
  });

  describe('选项配置', () => {
    test('应该接受自定义选项', () => {
      const customOptions: ConfigAdapterOptions = {
        enableDeduplication: false,
        enablePerformanceMonitoring: true,
        enableCaching: false,
        cacheSize: 50,
        enableConfigPathParsing: false,
        enableDataTypeInference: false
      };

      const customAdapter = new TestConfigAdapter(customOptions);
      expect(customAdapter).toBeInstanceOf(ConfigLanguageAdapter);
    });
  });

  describe('去重功能', () => {
    test('应该去除重复的配置项', async () => {
      const duplicateResult = {
        captures: [
          {
            name: 'test.capture',
            node: {
              text: 'duplicate-config',
              startPosition: { row: 1, column: 0 },
              endPosition: { row: 1, column: 16 }
            }
          }
        ]
      };

      const results = await adapter.normalize([duplicateResult, duplicateResult], 'config-items', 'toml');
      expect(results).toHaveLength(1);
    });
  });
});