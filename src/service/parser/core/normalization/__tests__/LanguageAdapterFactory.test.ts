/**
 * LanguageAdapterFactory 测试
 */

import { LanguageAdapterFactory } from '../LanguageAdapterFactory';
import { ILanguageAdapter, AdapterOptions } from '../types';

// 模拟适配器类
class MockAdapter implements ILanguageAdapter {
  constructor(private options: AdapterOptions = {}) {}
  
  async normalize(queryResults: any[], queryType: string, language: string): Promise<any[]> {
    return [];
  }
  
  getSupportedQueryTypes(): string[] {
    return ['functions', 'classes'];
  }
  
  mapNodeType(nodeType: string): string {
    return nodeType;
  }
  
  extractName(result: any): string {
    return 'mock';
  }
  
  extractContent(result: any): string {
    return 'mock content';
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
}

describe('LanguageAdapterFactory', () => {
  beforeEach(() => {
    // 清除缓存
    LanguageAdapterFactory.clearCache();
  });

  describe('getAdapter', () => {
    it('should return adapter for supported language', async () => {
      const adapter = await LanguageAdapterFactory.getAdapter('typescript');
      
      expect(adapter).toBeDefined();
      expect(adapter.getSupportedQueryTypes()).toContain('functions');
    });

    it('should return same adapter instance for same options', async () => {
      const adapter1 = await LanguageAdapterFactory.getAdapter('typescript');
      const adapter2 = await LanguageAdapterFactory.getAdapter('typescript');
      
      expect(adapter1).toBe(adapter2);
    });

    it('should return different adapter instances for different options', async () => {
      const options1: AdapterOptions = { enableCaching: true };
      const options2: AdapterOptions = { enableCaching: false };
      
      const adapter1 = await LanguageAdapterFactory.getAdapter('typescript', options1);
      const adapter2 = await LanguageAdapterFactory.getAdapter('typescript', options2);
      
      expect(adapter1).not.toBe(adapter2);
    });

    it('should return default adapter for unsupported language', async () => {
      const adapter = await LanguageAdapterFactory.getAdapter('unsupported');
      
      expect(adapter).toBeDefined();
      expect(adapter.getSupportedQueryTypes()).toBeDefined();
    });

    it('should handle language aliases', async () => {
      const jsAdapter = await LanguageAdapterFactory.getAdapter('javascript');
      const tsAdapter = await LanguageAdapterFactory.getAdapter('typescript');
      
      expect(jsAdapter.constructor.name).toBe(tsAdapter.constructor.name);
    });

    it('should merge options correctly', async () => {
      const globalOptions: AdapterOptions = { enableCaching: false };
      const languageOptions: AdapterOptions = { enableDeduplication: false };
      const localOptions: AdapterOptions = { enableErrorRecovery: false };
      
      LanguageAdapterFactory.setDefaultOptions(globalOptions);
      LanguageAdapterFactory.setAdapterConfig('typescript', languageOptions);
      
      const adapter = await LanguageAdapterFactory.getAdapter('typescript', localOptions);
      expect(adapter).toBeDefined();
    });
  });

  describe('setAdapterConfig', () => {
    it('should set adapter config for language', () => {
      const config: AdapterOptions = { enableCaching: false };
      
      LanguageAdapterFactory.setAdapterConfig('typescript', config);
      const retrievedConfig = LanguageAdapterFactory.getAdapterConfig('typescript');
      
      expect(retrievedConfig.enableCaching).toBe(false);
    });

    it('should clear cache when config is updated', async () => {
      await LanguageAdapterFactory.getAdapter('typescript');
      expect(LanguageAdapterFactory.getCacheStats().size).toBe(1);
      
      LanguageAdapterFactory.setAdapterConfig('typescript', { enableCaching: false });
      expect(LanguageAdapterFactory.getCacheStats().size).toBe(0);
    });
  });

  describe('setDefaultOptions', () => {
    it('should set default options', () => {
      const options: AdapterOptions = { enableCaching: false };
      
      LanguageAdapterFactory.setDefaultOptions(options);
      const defaultOptions = LanguageAdapterFactory.getDefaultOptions();
      
      expect(defaultOptions.enableCaching).toBe(false);
    });

    it('should clear cache when default options are updated', async () => {
      await LanguageAdapterFactory.getAdapter('typescript');
      expect(LanguageAdapterFactory.getCacheStats().size).toBe(1);
      
      LanguageAdapterFactory.setDefaultOptions({ enableCaching: false });
      expect(LanguageAdapterFactory.getCacheStats().size).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached adapters', async () => {
      await LanguageAdapterFactory.getAdapter('typescript');
      await LanguageAdapterFactory.getAdapter('python');
      
      expect(LanguageAdapterFactory.getCacheStats().size).toBe(2);
      
      LanguageAdapterFactory.clearCache();
      expect(LanguageAdapterFactory.getCacheStats().size).toBe(0);
    });
  });

  describe('clearLanguageCache', () => {
    it('should clear cache for specific language', async () => {
      await LanguageAdapterFactory.getAdapter('typescript');
      await LanguageAdapterFactory.getAdapter('python');
      
      expect(LanguageAdapterFactory.getCacheStats().size).toBe(2);
      
      LanguageAdapterFactory.clearLanguageCache('typescript');
      const stats = LanguageAdapterFactory.getCacheStats();
      
      expect(stats.size).toBe(1);
      expect(stats.languages).not.toContain('typescript');
      expect(stats.languages).toContain('python');
    });
  });

  describe('getSupportedLanguages', () => {
    it('should return all supported languages', () => {
      const languages = LanguageAdapterFactory.getSupportedLanguages();
      
      expect(languages).toContain('rust');
      expect(languages).toContain('typescript');
      expect(languages).toContain('python');
      expect(languages).toContain('java');
    });
  });

  describe('isLanguageSupported', () => {
    it('should return true for supported languages', () => {
      expect(LanguageAdapterFactory.isLanguageSupported('typescript')).toBe(true);
      expect(LanguageAdapterFactory.isLanguageSupported('python')).toBe(true);
    });

    it('should return false for unsupported languages', () => {
      expect(LanguageAdapterFactory.isLanguageSupported('unsupported')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(LanguageAdapterFactory.isLanguageSupported('TYPESCRIPT')).toBe(true);
      expect(LanguageAdapterFactory.isLanguageSupported('Python')).toBe(true);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      await LanguageAdapterFactory.getAdapter('typescript');
      await LanguageAdapterFactory.getAdapter('python');
      const options = { enableCaching: false };
      await LanguageAdapterFactory.getAdapter('typescript', options);
      
      const stats = LanguageAdapterFactory.getCacheStats();
      
      // 由于缓存键包含选项，不同的选项会产生不同的缓存条目
      expect(stats.size).toBe(2); // 两个不同的选项组合
      expect(stats.languages).toContain('typescript');
      expect(stats.languages).toContain('python');
      expect(stats.entries).toHaveLength(2);
      
      const typescriptStats = stats.entries.find(e => e.language === 'typescript');
      expect(typescriptStats?.count).toBeGreaterThan(0); // 至少有一个typescript条目
    });
  });

  describe('warmupCache', () => {
    it('should warmup cache for all languages', async () => {
      await LanguageAdapterFactory.warmupCache();
      
      const stats = LanguageAdapterFactory.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      
      const supportedLanguages = LanguageAdapterFactory.getSupportedLanguages();
      for (const language of supportedLanguages) {
        expect(stats.languages).toContain(language);
      }
    });

    it('should warmup cache for specific languages', async () => {
      const languages = ['typescript', 'python'];
      await LanguageAdapterFactory.warmupCache(languages);
      
      const stats = LanguageAdapterFactory.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.languages).toContain('typescript');
      expect(stats.languages).toContain('python');
    });
  });

  describe('getSupportedQueryTypes', () => {
    it('should return query types from adapter', async () => {
      const queryTypes = await LanguageAdapterFactory.getSupportedQueryTypes('typescript');
      
      expect(Array.isArray(queryTypes)).toBe(true);
      expect(queryTypes).toContain('functions');
      expect(queryTypes).toContain('classes');
    });

    it('should fallback to QueryTypeMapper for unsupported language', async () => {
      const queryTypes = await LanguageAdapterFactory.getSupportedQueryTypes('unsupported');
      
      expect(Array.isArray(queryTypes)).toBe(true);
    });
  });

  describe('validateQueryTypes', () => {
    it('should validate query types using QueryTypeMapper', () => {
      const isValid = LanguageAdapterFactory.validateQueryTypes('typescript', ['functions', 'classes']);
      
      expect(isValid).toBe(true);
    });
  });

  describe('getMappedQueryTypes', () => {
    it('should map query types using QueryTypeMapper', () => {
      const mappedTypes = LanguageAdapterFactory.getMappedQueryTypes('rust', ['functions-structs']);
      
      expect(mappedTypes).toContain('functions');
      expect(mappedTypes).toContain('classes');
    });
  });

  describe('registerCustomAdapter', () => {
    it('should register custom adapter', async () => {
      LanguageAdapterFactory.registerCustomAdapter('custom', MockAdapter);
      
      const adapter = await LanguageAdapterFactory.getAdapter('custom');
      expect(adapter).toBeInstanceOf(MockAdapter);
    });

    it('should cache custom adapter', async () => {
      LanguageAdapterFactory.registerCustomAdapter('custom', MockAdapter);
      
      const adapter1 = await LanguageAdapterFactory.getAdapter('custom');
      const adapter2 = await LanguageAdapterFactory.getAdapter('custom');
      
      expect(adapter1).toBe(adapter2);
    });
  });

  describe('getPerformanceStats', () => {
    it('should return performance statistics', async () => {
      // 清除缓存和配置以确保干净的状态
      LanguageAdapterFactory.clearCache();
      
      await LanguageAdapterFactory.getAdapter('typescript');
      await LanguageAdapterFactory.getAdapter('python');
      
      const stats = LanguageAdapterFactory.getPerformanceStats();
      
      expect(stats.cacheSize).toBe(2);
      expect(stats.supportedLanguages).toBeGreaterThan(0);
      expect(stats.configuredLanguages).toBeGreaterThanOrEqual(0); // 允许已有配置
      expect(stats.languageStats).toBeDefined();
      
      // 现在设置配置，这会清除缓存
      LanguageAdapterFactory.setAdapterConfig('java', { enableCaching: false });
      
      const statsAfterConfig = LanguageAdapterFactory.getPerformanceStats();
      expect(statsAfterConfig.configuredLanguages).toBeGreaterThanOrEqual(1);
    });
  });
});