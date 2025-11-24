/**
 * 增强的语言适配器工厂
 * 提供适配器创建、缓存和配置管理功能
 */

import { ILanguageAdapter } from './types';
import { AdapterOptions } from './adapters/base/BaseLanguageAdapter';
import { QueryTypeMapper } from './QueryTypeMappings';

// 导入所有语言适配器
import { RustLanguageAdapter } from './adapters/RustLanguageAdapter';
import { TypeScriptLanguageAdapter } from './adapters/TypeScriptLanguageAdapter';
import { JavaScriptLanguageAdapter } from './adapters/JavaScriptLanguageAdapter';
import { PythonLanguageAdapter } from './adapters/PythonLanguageAdapter';
import { JavaLanguageAdapter } from './adapters/JavaLanguageAdapter';
import { CppLanguageAdapter } from './adapters/CppLanguageAdapter';
import { CLanguageAdapter } from './adapters/CLanguageAdapter';
import { CSharpLanguageAdapter } from './adapters/CSharpLanguageAdapter';
import { KotlinLanguageAdapter } from './adapters/KotlinLanguageAdapter';
import { CssLanguageAdapter } from './adapters/CssLanguageAdapter';
import { HtmlLanguageAdapter } from './adapters/HtmlLanguageAdapter';
import { VueLanguageAdapter } from './adapters/VueLanguageAdapter';
import { DefaultLanguageAdapter } from './adapters/DefaultLanguageAdapter';
import { TOMLConfigAdapter } from './adapters/TOMLConfigAdapter';
import { YAMLConfigAdapter } from './adapters/YAMLConfigAdapter';
import { LoggerService } from '../../../../utils/LoggerService';
import { JSONConfigAdapter } from './adapters/JSONConfigAdapter';
import { TSXLanguageAdapter } from './adapters/TSXLanguageAdapter';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../../../types';
import { ICacheService } from '../../../../infrastructure/caching/types';

/**
 * 语言适配器工厂类
 * 负责创建、缓存和管理语言适配器实例
 */
@injectable()
export class LanguageAdapterFactory {
  private adapterCache = new Map<string, ILanguageAdapter>();
  private adapterConfigs = new Map<string, AdapterOptions>();
  private defaultOptions: AdapterOptions = {
    enableDeduplication: true,
    enablePerformanceMonitoring: false,
    enableErrorRecovery: true,
    enableCaching: true,
    cacheSize: 100,
    customTypeMappings: {}
  };
  private adapterLock = new Map<string, Promise<ILanguageAdapter>>();
  private logger = new LoggerService();
  private cacheService: ICacheService;

  constructor(@inject(TYPES.CacheService) cacheService: ICacheService) {
    this.cacheService = cacheService;
  }

  /**
   * 获取语言适配器（带缓存）
   * @param language 编程语言
   * @param options 适配器选项
   * @returns 语言适配器实例
   */
  async getAdapter(language: string, options?: AdapterOptions): Promise<ILanguageAdapter> {
    const normalizedLanguage = language.toLowerCase();
    const mergedOptions = {
      ...this.defaultOptions,
      ...this.adapterConfigs.get(normalizedLanguage),
      ...options
    };
    const cacheKey = `adapter:${normalizedLanguage}:${JSON.stringify(mergedOptions)}`;

    // 检查是否有正在进行的创建操作
    if (this.adapterLock.has(cacheKey)) {
      return await this.adapterLock.get(cacheKey)!;
    }

    // 检查缓存
    const cachedAdapter = this.cacheService.getFromCache<ILanguageAdapter>(cacheKey);
    if (cachedAdapter) {
      return cachedAdapter;
    }

    // 创建锁定的Promise
    const createPromise = this.createAdapterWithLock(cacheKey, normalizedLanguage, mergedOptions);
    this.adapterLock.set(cacheKey, createPromise);

    try {
      const adapter = await createPromise;
      // 缓存适配器实例 (TTL: 10分钟)
      this.cacheService.setCache(cacheKey, adapter, 10 * 60 * 1000);
      this.adapterCache.set(cacheKey, adapter);
      return adapter;
    } finally {
      this.adapterLock.delete(cacheKey);
    }
  }

  /**
   * 同步获取语言适配器（仅从缓存）
   * @param language 编程语言
   * @param options 适配器选项
   * @returns 语言适配器实例或null（如果未缓存）
   */
  getAdapterSync(language: string, options?: AdapterOptions): ILanguageAdapter | null {
    const normalizedLanguage = language.toLowerCase();
    const mergedOptions = {
      ...this.defaultOptions,
      ...this.adapterConfigs.get(normalizedLanguage),
      ...options
    };
    const cacheKey = `adapter:${normalizedLanguage}:${JSON.stringify(mergedOptions)}`;

    // 仅从缓存获取，不创建新实例
    const cachedAdapter = this.cacheService.getFromCache<ILanguageAdapter>(cacheKey);
    if (cachedAdapter) {
      return cachedAdapter;
    }

    // 检查本地缓存作为后备
    if (this.adapterCache.has(cacheKey)) {
      return this.adapterCache.get(cacheKey)!;
    }

    return null;
  }

  private async createAdapterWithLock(cacheKey: string, language: string, options: AdapterOptions): Promise<ILanguageAdapter> {
    // 双重检查缓存
    const cachedAdapter = this.cacheService.getFromCache<ILanguageAdapter>(cacheKey);
    if (cachedAdapter) {
      return cachedAdapter;
    }
    if (this.adapterCache.has(cacheKey)) {
      return this.adapterCache.get(cacheKey)!;
    }
    return this.createAdapter(language, options);
  }

  /**
   * 创建语言适配器
   * @param language 编程语言
   * @param options 适配器选项
   * @returns 语言适配器实例
   */
  private createAdapter(language: string, options: AdapterOptions): ILanguageAdapter {
    try {
      switch (language) {
        case 'rust':
          return new RustLanguageAdapter(options);
        case 'typescript':
          return new TypeScriptLanguageAdapter(options);
        case 'javascript':
          return new JavaScriptLanguageAdapter(options);
        case 'python':
        case 'py':
          return new PythonLanguageAdapter(options);
        case 'java':
          return new JavaLanguageAdapter(options);
        case 'cpp':
        case 'c++':
          return new CppLanguageAdapter(options);
        case 'c':
          return new CLanguageAdapter(options);
        case 'csharp':
        case 'c#':
          return new CSharpLanguageAdapter(options);
        case 'kotlin':
        case 'kt':
        case 'kts':
          return new KotlinLanguageAdapter(options);
        case 'css':
          return new CssLanguageAdapter();
        case 'html':
          return new HtmlLanguageAdapter();
        case 'vue':
          return new VueLanguageAdapter();
        case 'tsx':
          return new TSXLanguageAdapter(options);
        case 'toml':
          // TOML configuration files
          return new TOMLConfigAdapter(options);
        case 'yaml':
        case 'yml':
          // YAML configuration files
          return new YAMLConfigAdapter(options);
        case 'json':
          // JSON configuration files
          return new JSONConfigAdapter(options);
        default:
          this.logger.warn(`Unsupported language: ${language}, using default adapter`);
          return new DefaultLanguageAdapter(options);
      }
    } catch (error) {
      this.logger.error(`Failed to create adapter for language: ${language}`, error);
      return new DefaultLanguageAdapter(options);
    }
  }

  /**
   * 设置适配器配置
   * @param language 编程语言
   * @param config 适配器配置
   */
  setAdapterConfig(language: string, config: AdapterOptions): void {
    this.adapterConfigs.set(language.toLowerCase(), config);
    this.clearCache();
    this.logger.debug(`Updated adapter config for language: ${language}`, config);
  }

  /**
   * 获取适配器配置
   * @param language 编程语言
   * @returns 适配器配置
   */
  getAdapterConfig(language: string): AdapterOptions {
    return this.adapterConfigs.get(language.toLowerCase()) || {};
  }

  /**
   * 设置全局默认配置
   * @param options 默认选项
   */
  setDefaultOptions(options: AdapterOptions): void {
    this.defaultOptions = { ...this.defaultOptions, ...options };
    this.clearCache();
    this.logger.debug('Updated default adapter options', options);
  }

  /**
   * 获取全局默认配置
   * @returns 默认选项
   */
  getDefaultOptions(): AdapterOptions {
    return { ...this.defaultOptions };
  }

  /**
   * 清除适配器缓存
   */
  clearCache(): void {
    // 清除集中缓存中的适配器相关条目
    this.cacheService.deleteByPattern(/^adapter:/);
    // 清除本地缓存
    const cacheSize = this.adapterCache.size;
    this.adapterCache.clear();
    this.logger.debug(`Cleared adapter cache, removed ${cacheSize} entries`);
  }

  /**
   * 清除特定语言的适配器缓存
   * @param language 编程语言
   */
  clearLanguageCache(language: string): void {
    const normalizedLanguage = language.toLowerCase();
    // 清除集中缓存中的特定语言适配器
    this.cacheService.deleteByPattern(new RegExp(`^adapter:${normalizedLanguage}:`));

    // 清除本地缓存中的特定语言适配器
    const keysToDelete: string[] = [];
    for (const key of this.adapterCache.keys()) {
      if (key.startsWith(`adapter:${normalizedLanguage}:`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.adapterCache.delete(key));
    this.logger.debug(`Cleared cache for language: ${language}, removed ${keysToDelete.length} entries`);
  }

  /**
   * 获取支持的语言列表
   * @returns 支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return [
      'rust', 'typescript', 'javascript', 'python', 'java',
      'cpp', 'c', 'csharp', 'kotlin', 'css', 'html', 'vue', 'tsx',
      'json', 'yaml', 'yml', 'toml'
    ];
  }

  /**
   * 检查语言是否支持
   * @param language 编程语言
   * @returns 是否支持
   */
  isLanguageSupported(language: string): boolean {
    return this.getSupportedLanguages().includes(language.toLowerCase());
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  getCacheStats(): { size: number; languages: string[]; entries: Array<{ language: string, count: number }> } {
    // 获取本地缓存统计
    const languageCounts = new Map<string, number>();

    for (const key of this.adapterCache.keys()) {
      const parts = key.split(':');
      if (parts.length > 1) {
        const language = parts[1]; // adapter:language:... 格式
        languageCounts.set(language, (languageCounts.get(language) || 0) + 1);
      }
    }

    const entries = Array.from(languageCounts.entries()).map(([language, count]) => ({
      language,
      count
    }));

    // 合并集中缓存统计
    const centralizedStats = this.cacheService.getCacheStats();
    const totalSize = this.adapterCache.size + centralizedStats.totalEntries;

    return {
      size: totalSize,
      languages: [...new Set([...Array.from(languageCounts.keys()), ...this.getSupportedLanguages()])],
      entries
    };
  }

  /**
   * 预热适配器缓存
   * @param languages 要预热的语言列表，如果不提供则预热所有支持的语言
   */
  async warmupCache(languages?: string[]): Promise<void> {
    const targetLanguages = languages || this.getSupportedLanguages();

    this.logger.info('Warming up adapter cache', { languages: targetLanguages });

    for (const language of targetLanguages) {
      if (this.isLanguageSupported(language)) {
        await this.getAdapter(language);
      }
    }

    this.logger.info('Adapter cache warmup completed');
  }

  /**
   * 获取语言的查询类型
   * @param language 编程语言
   * @returns 查询类型数组
   */
  async getSupportedQueryTypes(language: string): Promise<string[]> {
    try {
      const adapter = await this.getAdapter(language);
      return adapter.getSupportedQueryTypes();
    } catch (error) {
      this.logger.warn(`Failed to get query types for language: ${language}`, error);
      return QueryTypeMapper.getSupportedQueryTypes(language);
    }
  }

  /**
   * 验证查询类型是否支持
   * @param language 编程语言
   * @param queryTypes 查询类型数组
   * @returns 验证结果
   */
  validateQueryTypes(language: string, queryTypes: string[]): boolean {
    return QueryTypeMapper.validateQueryTypes(language, queryTypes);
  }

  /**
   * 获取映射后的查询类型
   * @param language 编程语言
   * @param discoveredTypes 发现的查询类型
   * @returns 映射后的查询类型
   */
  getMappedQueryTypes(language: string, discoveredTypes: string[]): string[] {
    return QueryTypeMapper.getMappedQueryTypes(language, discoveredTypes);
  }

  /**
   * 注册自定义适配器
   * @param language 编程语言
   * @param adapterClass 适配器类
   * @param options 适配器选项
   */
  registerCustomAdapter(
    language: string,
    adapterClass: new (options: AdapterOptions) => ILanguageAdapter,
    options?: AdapterOptions
  ): void {
    const normalizedLanguage = language.toLowerCase();
    const mergedOptions = { ...this.defaultOptions, ...options };

    // 创建适配器实例
    const adapter = new adapterClass(mergedOptions);

    // 缓存适配器
    const cacheKey = `adapter:${normalizedLanguage}:${JSON.stringify(mergedOptions)}`;
    this.cacheService.setCache(cacheKey, adapter, 10 * 60 * 1000); // TTL: 10分钟
    this.adapterCache.set(cacheKey, adapter);

    this.logger.info(`Registered custom adapter for language: ${language}`, {
      language: normalizedLanguage,
      adapterClass: adapterClass.name
    });
  }

  /**
   * 获取适配器性能统计
   * @returns 性能统计信息
   */
  getPerformanceStats(): Record<string, any> {
    const stats: Record<string, any> = {
      cacheSize: this.adapterCache.size,
      supportedLanguages: this.getSupportedLanguages().length,
      configuredLanguages: this.adapterConfigs.size
    };

    // 按语言分组统计
    const languageStats: Record<string, any> = {};
    for (const [key, adapter] of this.adapterCache.entries()) {
      const parts = key.split(':');
      if (parts.length > 1) {
        const language = parts[1]; // adapter:language:... 格式
        if (!languageStats[language]) {
          languageStats[language] = {
            count: 0,
            adapters: []
          };
        }
        languageStats[language].count++;
        languageStats[language].adapters.push(adapter.constructor.name);
      }
    }

    stats.languageStats = languageStats;
    return stats;
  }
}