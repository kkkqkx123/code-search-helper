import { QueryRegistryImpl } from './QueryRegistry';

/**
 * 向后兼容性包装器
 * 确保现有代码无需修改即可继续工作
 */
//等待重构完成后即可移除
export class QueryRegistryCompatibility {
  /**
   * 静态初始化（保持与旧版本相同的API）
   */
  static initialize(): void {
    // 异步初始化，但提供同步接口
    QueryRegistryImpl.initialize().catch(error => {
      console.error('QueryRegistry异步初始化失败:', error);
    });
  }

  /**
   * 获取查询模式（同步版本，向后兼容）
   */
  static getPattern(language: string, queryType: string): string | null {
    return QueryRegistryImpl.getPatternSync(language, queryType);
  }

  /**
   * 异步获取查询模式（新功能）
   */
  static async getPatternAsync(language: string, queryType: string): Promise<string | null> {
    return await QueryRegistryImpl.getPattern(language, queryType);
  }

  /**
   * 其他方法保持相同签名
   */
  static getPatternsForLanguage(language: string): Record<string, string> {
    return QueryRegistryImpl.getPatternsForLanguage(language);
  }

  static getSupportedLanguages(): string[] {
    return QueryRegistryImpl.getSupportedLanguages();
  }

  static getQueryTypesForLanguage(language: string): string[] {
    return QueryRegistryImpl.getQueryTypesForLanguage(language);
  }

  static isSupported(language: string, queryType?: string): boolean {
    return QueryRegistryImpl.isSupported(language, queryType);
  }

  static getAllQueryTypes(): string[] {
    return QueryRegistryImpl.getAllQueryTypes();
  }

  static getStats() {
    return QueryRegistryImpl.getStats();
  }

  static async reloadLanguageQueries(language: string): Promise<void> {
    return await QueryRegistryImpl.reloadLanguageQueries(language);
  }

  static clearCache(): void {
    QueryRegistryImpl.clearCache();
  }

  static getTransformerStats() {
    return QueryRegistryImpl.getTransformerStats();
  }

  static getLoaderStats() {
    return QueryRegistryImpl.getLoaderStats();
  }
}

// 保持原有的导出方式
export { QueryRegistryCompatibility as QueryRegistry };