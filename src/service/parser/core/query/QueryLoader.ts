import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 查询加载器 - 支持新的目录结构
 */
export class QueryLoader {
  private static queries = new Map<string, Map<string, string>>();
  private static logger = new LoggerService();
  private static loadedLanguages = new Set<string>();

  /**
   * 加载指定语言的查询文件
   * @param language 语言名称
   */
  static async loadLanguageQueries(language: string): Promise<void> {
    if (this.loadedLanguages.has(language.toLowerCase())) {
      this.logger.debug(`${language}语言的查询已加载`);
      return;
    }

    try {
      this.logger.info(`加载${language}语言的查询文件...`);

      // 尝试加载新的目录结构
      const languageQueries = new Map<string, string>();
      
      try {
        const queryTypes = ['functions', 'classes', 'imports', 'exports', 'methods', 'interfaces', 'types', 'properties', 'variables'];
        
        for (const queryType of queryTypes) {
          try {
            const queryModule = await import(`../../constants/queries/${this.getQueryFileName(language)}/${queryType}.ts`);
            const query = queryModule.default;
            if (query) {
              languageQueries.set(queryType, query);
            }
          } catch (error) {
            // 如果特定类型不存在，跳过
            this.logger.debug(`跳过 ${language}.${queryType}: ${error}`);
          }
        }
        
        if (languageQueries.size > 0) {
          this.queries.set(language.toLowerCase(), languageQueries);
          this.loadedLanguages.add(language.toLowerCase());
          this.logger.info(`${language}语言查询加载成功，共${languageQueries.size}种类型`);
          return;
        }
      } catch (error) {
        this.logger.error(`新结构加载失败: ${error}`);
        throw error;
      }

      // 新结构是唯一支持的方式，不再回退到旧结构
      throw new Error(`未找到${language}语言的查询文件，请确保新结构目录存在`);
    } catch (error) {
      this.logger.error(`加载${language}语言查询失败:`, error);
      throw error;
    }
  }

  /**
   * 批量加载多种语言的查询
   * @param languages 语言数组
   */
  static async loadMultipleLanguages(languages: string[]): Promise<void> {
    const loadPromises = languages.map(lang => this.loadLanguageQueries(lang));
    await Promise.allSettled(loadPromises);
  }

  /**
   * 获取指定语言的查询字符串
   * @param language 语言名称
   * @param queryType 查询类型
   * @returns 查询字符串
   */
  static getQuery(language: string, queryType: string): string {
    const languageQueries = this.queries.get(language.toLowerCase());
    if (!languageQueries) {
      throw new Error(`${language}语言的查询未加载`);
    }
    
    const query = languageQueries.get(queryType);
    if (!query) {
      throw new Error(`${language}语言的${queryType}查询未找到`);
    }
    
    return query;
  }

  /**
   * 检查特定查询类型是否存在
   * @param language 语言名称
   * @param queryType 查询类型
   * @returns 是否存在
   */
  static hasQueryType(language: string, queryType: string): boolean {
    const languageQueries = this.queries.get(language.toLowerCase());
    return languageQueries ? languageQueries.has(queryType) : false;
  }

  /**
   * 检查语言是否已加载
   * @param language 语言名称
   * @returns 是否已加载
   */
  static isLanguageLoaded(language: string): boolean {
    return this.loadedLanguages.has(language.toLowerCase());
  }

  /**
   * 获取已加载的语言列表
   * @returns 已加载的语言列表
   */
  static getLoadedLanguages(): string[] {
    return Array.from(this.loadedLanguages);
  }

  /**
   * 获取指定语言支持的所有查询类型
   * @param language 语言名称
   * @returns 查询类型列表
   */
  static getQueryTypesForLanguage(language: string): string[] {
    const languageQueries = this.queries.get(language.toLowerCase());
    return languageQueries ? Array.from(languageQueries.keys()) : [];
  }

  /**
   * 预加载常用语言的查询
   */
  static async preloadCommonLanguages(): Promise<void> {
    const commonLanguages = [
      'javascript',
      'typescript',
      'python',
      'java',
      'go',
      'rust',
      'cpp',
      'c'
    ];

    this.logger.info('预加载常用语言查询...');
    await this.loadMultipleLanguages(commonLanguages);
    this.logger.info(`预加载完成，共加载${this.loadedLanguages.size}种语言`);
  }

  /**
   * 重新加载指定语言的查询
   * @param language 语言名称
   */
  static async reloadLanguageQueries(language: string): Promise<void> {
    this.loadedLanguages.delete(language.toLowerCase());
    this.queries.delete(language.toLowerCase());
    await this.loadLanguageQueries(language);
  }

  /**
   * 清除所有已加载的查询
   */
  static clearAllQueries(): void {
    this.queries.clear();
    this.loadedLanguages.clear();
    this.logger.info('所有查询已清除');
  }

  /**
   * 获取查询统计信息
   */
  static getStats() {
    const languageStats: Record<string, number> = {};
    for (const [language, queries] of this.queries) {
      languageStats[language] = queries.size;
    }

    return {
      loadedLanguages: this.loadedLanguages.size,
      totalQueries: Array.from(this.queries.values()).reduce((sum, queries) => sum + queries.size, 0),
      languages: Array.from(this.loadedLanguages),
      languageStats
    };
  }

  /**
   * 验证查询语法
   * @param query 查询字符串
   * @returns 验证结果
   */
  static validateQuerySyntax(query: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // 基本语法检查
      const lines = query.split('\n');
      let balance = 0;
      let inString = false;
      let escapeNext = false;

      for (let i = 0; i < query.length; i++) {
        const char = query[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (char === '"' && !escapeNext) {
          inString = !inString;
          continue;
        }

        if (!inString) {
          if (char === '(') {
            balance++;
          } else if (char === ')') {
            balance--;
            if (balance < 0) {
              errors.push(`行${this.getLineNumber(query, i)}: 括号不匹配`);
              break;
            }
          }
        }
      }

      if (balance !== 0) {
        errors.push('括号不匹配');
      }

      if (inString) {
        errors.push('字符串未闭合');
      }

      // 检查查询模式
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith(';') && !trimmed.includes('@')) {
          // 检查是否包含有效的节点类型
          if (!trimmed.includes('(') || !trimmed.includes(')')) {
            errors.push(`无效的查询模式: ${trimmed}`);
          }
        }
      }

    } catch (error) {
      errors.push(`语法验证错误: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 根据字符位置获取行号
   * @param text 文本
   * @param position 字符位置
   * @returns 行号
   */
  private static getLineNumber(text: string, position: number): number {
    const before = text.substring(0, position);
    return before.split('\n').length;
  }

  /**
   * 获取查询文件名
   * @param language 语言名称
   * @returns 查询文件名
   */
  private static getQueryFileName(language: string): string {
    const fileMap: Record<string, string> = {
      'c++': 'cpp',
      'c#': 'c-sharp',
      'ts': 'typescript',
      'js': 'javascript',
      'py': 'python'
    };

    return fileMap[language.toLowerCase()] || language.toLowerCase();
  }
}