import { QueryLoader } from './QueryLoader';
import { QueryTransformer } from './QueryTransformer';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 查询注册表 - 管理所有语言的查询模式
 * 重构版本：从常量查询文件加载，通过转换层提取特定模式
 */
export class QueryRegistryImpl {
  private static patterns: Map<string, Map<string, string>> = new Map();
  private static logger = new LoggerService();
  private static initialized = false;

  /**
   * 异步初始化查询注册表
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('初始化查询注册表...');
    
    try {
      // 初始化查询转换器
      QueryTransformer.initialize();
      
      // 从常量查询文件加载
      await this.loadFromConstants();
      
      this.initialized = true;
      this.logger.info(`查询注册表初始化完成，支持 ${this.patterns.size} 种语言`);
      
    } catch (error) {
      this.logger.error('查询注册表初始化失败:', error);
      throw error;
    }
  }

  /**
   * 从常量查询文件加载查询模式
   */
  private static async loadFromConstants(): Promise<void> {
    const languages = this.getSupportedLanguages();
    
    for (const language of languages) {
      try {
        await this.loadLanguageQueries(language);
      } catch (error) {
        this.logger.warn(`加载 ${language} 语言查询失败:`, error);
        // 继续加载其他语言，不中断整个初始化过程
      }
    }
  }

  /**
   * 加载指定语言的查询
   */
  private static async loadLanguageQueries(language: string): Promise<void> {
    this.logger.debug(`加载 ${language} 语言查询...`);
    
    // 加载完整的查询文件
    await QueryLoader.loadLanguageQueries(language);
    const fullQuery = QueryLoader.getQuery(language);
    
    // 提取所有支持的模式类型
    const patternTypes = QueryTransformer.getSupportedPatternTypesForLanguage(language);
    const languagePatterns = new Map<string, string>();
    
    let loadedCount = 0;
    for (const patternType of patternTypes) {
      try {
        const pattern = QueryTransformer.extractPatternType(fullQuery, patternType, language);
        if (pattern && pattern.trim()) {
          languagePatterns.set(patternType, pattern);
          loadedCount++;
        }
      } catch (error) {
        this.logger.warn(`提取 ${language}.${patternType} 模式失败:`, error);
      }
    }
    
    this.patterns.set(language, languagePatterns);
    this.logger.debug(`成功加载 ${language} 语言的 ${loadedCount} 种查询模式`);
  }

  /**
   * 获取指定语言的查询模式
   */
  static async getPattern(language: string, queryType: string): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const langPatterns = this.patterns.get(language.toLowerCase());
    if (!langPatterns) {
      this.logger.warn(`语言 ${language} 的查询模式未加载`);
      return null;
    }

    const pattern = langPatterns.get(queryType);
    if (!pattern) {
      this.logger.debug(`查询类型 ${queryType} 在语言 ${language} 中不存在`);
      return null;
    }

    return pattern;
  }

  /**
   * 同步获取查询模式（向后兼容）
   */
  static getPatternSync(language: string, queryType: string): string | null {
    if (!this.initialized) {
      this.logger.warn('查询注册表未初始化，使用同步方式获取模式可能返回空值');
      return null;
    }

    const langPatterns = this.patterns.get(language.toLowerCase());
    return langPatterns ? langPatterns.get(queryType) || null : null;
  }

  /**
   * 获取指定语言的所有查询模式
   */
  static getPatternsForLanguage(language: string): Record<string, string> {
    const langPatterns = this.patterns.get(language.toLowerCase());
    return langPatterns ? Object.fromEntries(langPatterns) : {};
  }

  /**
   * 获取支持的所有语言
   */
  static getSupportedLanguages(): string[] {
    return [
      'javascript', 'typescript', 'python', 'java', 'go', 'rust',
      'cpp', 'c', 'csharp', 'swift', 'kotlin', 'ruby', 'php', 'scala'
    ];
  }

  /**
   * 获取指定语言支持的所有查询类型
   */
  static getQueryTypesForLanguage(language: string): string[] {
    const langPatterns = this.patterns.get(language.toLowerCase());
    return langPatterns ? Array.from(langPatterns.keys()) : [];
  }

  /**
   * 重新加载指定语言的查询
   */
  static async reloadLanguageQueries(language: string): Promise<void> {
    this.logger.info(`重新加载 ${language} 语言查询...`);
    
    // 清除相关缓存
    this.patterns.delete(language.toLowerCase());
    await QueryLoader.reloadLanguageQueries(language);
    
    // 重新加载
    await this.loadLanguageQueries(language);
    this.logger.info(`${language} 语言查询重新加载完成`);
  }

  /**
   * 获取注册表统计信息
   */
  static getStats() {
    let totalPatterns = 0;
    const languageStats: Record<string, number> = {};

    for (const [language, patterns] of this.patterns) {
      const count = patterns.size;
      languageStats[language] = count;
      totalPatterns += count;
    }

    return {
      initialized: this.initialized,
      totalLanguages: this.patterns.size,
      totalPatterns,
      languageStats
    };
  }

  /**
   * 检查是否支持特定语言和查询类型
   */
  static isSupported(language: string, queryType?: string): boolean {
    const langPatterns = this.patterns.get(language.toLowerCase());
    if (!langPatterns) {
      return false;
    }
    
    if (queryType) {
      return langPatterns.has(queryType);
    }
    
    return true;
  }

  /**
   * 获取所有可用的查询类型
   */
  static getAllQueryTypes(): string[] {
    const allTypes = new Set<string>();
    
    for (const patterns of this.patterns.values()) {
      for (const type of patterns.keys()) {
        allTypes.add(type);
      }
    }
    
    return Array.from(allTypes);
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.patterns.clear();
    QueryLoader.clearAllQueries();
    QueryTransformer.clearCache();
    this.logger.info('QueryRegistry 缓存已清除');
  }

  /**
   * 获取转换器统计信息
   */
  static getTransformerStats() {
    return QueryTransformer.getCacheStats();
  }

  /**
   * 获取查询加载器统计信息
   */
  static getLoaderStats() {
    return QueryLoader.getStats();
  }
}

// 注意：移除了自动初始化，改为异步初始化
// QueryRegistry.initialize();

// 导出兼容性包装器作为默认导出
export { QueryRegistryCompatibility as QueryRegistry } from './QueryRegistryCompatibility';