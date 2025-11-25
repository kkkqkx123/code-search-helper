import { QueryMappingResolver } from './QueryMappingResolver';
import { SupportedLanguage, QueryType, IMappingResolver, IMappingResolverFactory, MappingConfig } from './types';

/**
 * 映射解析器工厂
 * 负责创建和管理不同语言的映射解析器实例
 */
export class MappingResolverFactory implements IMappingResolverFactory {
  private static instance: MappingResolverFactory;
  private resolvers: Map<SupportedLanguage, IMappingResolver> = new Map();
  private supportedLanguages: Set<SupportedLanguage> = new Set();

  private constructor() {
    this.initializeSupportedLanguages();
  }

  /**
   * 获取工厂单例实例
   */
  static getInstance(): MappingResolverFactory {
    if (!MappingResolverFactory.instance) {
      MappingResolverFactory.instance = new MappingResolverFactory();
    }
    return MappingResolverFactory.instance;
  }

  /**
   * 创建指定语言的映射解析器
   */
  createResolver(language: SupportedLanguage): IMappingResolver {
    if (!this.isLanguageSupported(language)) {
      throw new Error(`不支持的语言: ${language}`);
    }

    // 检查是否已有缓存的解析器
    if (this.resolvers.has(language)) {
      return this.resolvers.get(language)!;
    }

    // 创建新的解析器实例
    const resolver = new QueryMappingResolver(language);
    this.resolvers.set(language, resolver);
    
    return resolver;
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): SupportedLanguage[] {
    return Array.from(this.supportedLanguages);
  }

  /**
   * 注册新的映射配置
   */
  registerMapping(language: SupportedLanguage, queryType: QueryType, config: MappingConfig): void {
    const resolver = this.createResolver(language);
    
    // 验证映射配置
    const validationResult = resolver.validateMapping(config);
    if (!validationResult.isValid) {
      const errorMessages = validationResult.errors.map(e => e.message).join(', ');
      throw new Error(`映射配置验证失败: ${errorMessages}`);
    }

    // 这里可以添加将配置注册到解析器的逻辑
    // 当前实现中，映射配置是通过文件系统加载的
    // 未来可以考虑动态注册机制
  }

  /**
   * 检查语言是否支持
   */
  isLanguageSupported(language: string): language is SupportedLanguage {
    return this.supportedLanguages.has(language as SupportedLanguage);
  }

  /**
   * 获取指定语言的可用查询类型
   */
  getAvailableQueryTypes(language: SupportedLanguage): QueryType[] {
    const resolver = this.createResolver(language);
    return resolver.getAvailableQueryTypes();
  }

  /**
   * 清除所有解析器的缓存
   */
  clearAllCaches(): void {
    for (const resolver of this.resolvers.values()) {
      resolver.clearCache();
    }
  }

  /**
   * 获取所有解析器的统计信息
   */
  getAllStats(): Record<SupportedLanguage, any> {
    const stats: Record<string, any> = {};
    
    for (const [language, resolver] of this.resolvers.entries()) {
      stats[language] = resolver.getStats();
    }
    
    return stats as Record<SupportedLanguage, any>;
  }

  /**
   * 重置工厂状态
   */
  reset(): void {
    this.resolvers.clear();
    this.supportedLanguages.clear();
    this.initializeSupportedLanguages();
  }

  /**
   * 初始化支持的语言列表
   */
  private initializeSupportedLanguages(): void {
    // 目前支持的语言列表
    const languages: SupportedLanguage[] = [
      'c',
      'cpp',
      'java',
      'python',
      'javascript',
      'typescript',
      'go',
      'rust'
    ];

    for (const language of languages) {
      this.supportedLanguages.add(language);
    }
  }

  /**
   * 预热解析器缓存
   */
  async warmupCache(languages?: SupportedLanguage[]): Promise<void> {
    const targetLanguages = languages || this.getSupportedLanguages();
    
    for (const language of targetLanguages) {
      try {
        const resolver = this.createResolver(language);
        const queryTypes = resolver.getAvailableQueryTypes();
        
        // 预加载所有查询类型的映射配置
        for (const queryType of queryTypes) {
          // 这里可以添加预热逻辑，比如加载映射配置到缓存
          // 当前实现中，映射配置是按需加载的
        }
      } catch (error) {
        console.warn(`预热 ${language} 语言解析器缓存失败:`, error);
      }
    }
  }

  /**
   * 获取工厂状态信息
   */
  getFactoryInfo(): {
    supportedLanguages: SupportedLanguage[];
    activeResolvers: number;
    totalCacheSize: number;
  } {
    let totalCacheSize = 0;
    
    for (const resolver of this.resolvers.values()) {
      const stats = resolver.getStats();
      totalCacheSize += stats.cacheSize;
    }

    return {
      supportedLanguages: this.getSupportedLanguages(),
      activeResolvers: this.resolvers.size,
      totalCacheSize
    };
  }

  /**
   * 验证所有语言的映射配置
   */
  async validateAllMappings(): Promise<Record<SupportedLanguage, { isValid: boolean; errors: string[] }>> {
    const results: Record<string, { isValid: boolean; errors: string[] }> = {};
    
    for (const language of this.getSupportedLanguages()) {
      try {
        const resolver = this.createResolver(language);
        const queryTypes = resolver.getAvailableQueryTypes();
        const allErrors: string[] = [];
        let isValid = true;

        for (const queryType of queryTypes) {
          try {
            // 这里可以添加验证逻辑
            // 当前实现中，映射配置验证在加载时进行
          } catch (error) {
            isValid = false;
            allErrors.push(`${queryType}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        results[language] = { isValid, errors: allErrors };
      } catch (error) {
        results[language] = {
          isValid: false,
          errors: [error instanceof Error ? error.message : String(error)]
        };
      }
    }

    return results as Record<SupportedLanguage, { isValid: boolean; errors: string[] }>;
  }
}

// 导出工厂单例实例
export const mappingResolverFactory = MappingResolverFactory.getInstance();

// 导出便捷函数
export function createMappingResolver(language: SupportedLanguage): IMappingResolver {
  return mappingResolverFactory.createResolver(language);
}

export function getSupportedLanguages(): SupportedLanguage[] {
  return mappingResolverFactory.getSupportedLanguages();
}

export function registerMapping(language: SupportedLanguage, queryType: QueryType, config: MappingConfig): void {
  return mappingResolverFactory.registerMapping(language, queryType, config);
}