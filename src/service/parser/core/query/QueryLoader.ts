import { LoggerService } from '../../../../utils/LoggerService';
import { QueryPatternExtractor } from './QueryPatternExtractor';
import {
  COMMON_QUERY_TYPES,
  COMPOUND_QUERY_TYPES,
  QUERY_PATTERNS,
  BASIC_QUERY_TYPES,
  DEFAULT_QUERY_TYPES,
  COMMON_LANGUAGES
} from './query-config';
import { languageMappingManager } from '../../config/LanguageMappingManager';

/**
 * 查询发现错误类
 */
class QueryDiscoveryError extends Error {
  constructor(message: string, public context: any) {
    super(message);
    this.name = 'QueryDiscoveryError';
  }
}

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
    const normalizedLanguage = language.toLowerCase();
    if (this.loadedLanguages.has(normalizedLanguage)) {
      return;
    }

    try {
      const languageQueries = new Map<string, string>();
      const queryFileName = this.getQueryFileName(language);

      try {
        // 首先尝试加载index.ts文件（新结构）
        const importPath = `../../constants/queries/${queryFileName}/index`;

        const queryModule = await import(importPath);
        const query = queryModule.default;

        if (query) {
          // 对于有index.ts的语言，尝试加载单独的查询文件
          const languageQueriesMap = await this.loadStructuredQueries(queryFileName, language);
          
          // 如果没有找到单独的查询文件，回退到智能分类
          if (languageQueriesMap.size === 0) {
            const categorizedMap = this.categorizeSimpleLanguageQuery(query, language);
            // 确保至少有functions和classes查询类型
            this.ensureBasicQueryTypes(categorizedMap, query, language);
            languageQueriesMap.clear();
            for (const [key, value] of Array.from(categorizedMap)) {
              languageQueriesMap.set(key, value);
            }
          }

          this.queries.set(normalizedLanguage, languageQueriesMap);
          this.loadedLanguages.add(normalizedLanguage);
          return;
        }
      } catch (error) {

        // 尝试回退到旧的单一文件结构
        try {
          const queryModule = await import(`../../constants/queries/${queryFileName}`);
          const query = queryModule.default || queryModule[`${queryFileName}Query`];

          if (query) {
            // 对于简单语言，使用智能分类
            const languageQueriesMap = this.categorizeSimpleLanguageQuery(query, language);
            // 确保至少有functions和classes查询类型
            this.ensureBasicQueryTypes(languageQueriesMap, query, language);

            this.queries.set(normalizedLanguage, languageQueriesMap);
            this.loadedLanguages.add(normalizedLanguage);
            return;
          }
        } catch (fallbackError) {
          this.logger.error(`旧结构加载也失败: ${fallbackError}`);
        }
      }

      throw new Error(`未找到${language}语言的查询文件`);
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
    const normalizedLanguage = language.toLowerCase();
    const languageQueries = this.queries.get(normalizedLanguage);
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
    const normalizedLanguage = language.toLowerCase();
    const languageQueries = this.queries.get(normalizedLanguage);
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
    const normalizedLanguage = language.toLowerCase();
    const languageQueries = this.queries.get(normalizedLanguage);
    return languageQueries ? Array.from(languageQueries.keys()) : [];
  }

  /**
   * 预加载常用语言的查询
   */
  static async preloadCommonLanguages(): Promise<void> {
    await this.loadMultipleLanguages([...COMMON_LANGUAGES]);
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
  }

  /**
   * 动态发现查询类型
   * @param language 语言名称
   * @returns 查询类型数组
   */
  static async discoverQueryTypes(language: string): Promise<string[]> {
    const queryDir = `../../../constants/queries/${this.getQueryFileName(language)}`;

    try {
      // 尝试动态读取目录结构
      const fs = await import('fs');
      const path = await import('path');

      const queryDirPath = path.join(__dirname, queryDir);

      // 检查目录是否存在
      if (!fs.existsSync(queryDirPath)) {
        return this.getDefaultQueryTypes();
      }

      // 读取目录内容
      const files = fs.readdirSync(queryDirPath);

      // 过滤出TypeScript查询文件
      const queryFiles = files
        .filter(file => file.endsWith('.ts') && file !== 'index.ts')
        .map(file => file.replace('.ts', ''));

      if (queryFiles.length > 0) {
        return queryFiles;
      }
      return this.getDefaultQueryTypes();

    } catch (error) {
      const errorContext = {
        language,
        queryDir,
        errorType: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      };

      // 记录详细错误信息到安全日志
      this.logger.error('Query type discovery failed', errorContext);

      // 向用户返回友好的错误信息
      throw new QueryDiscoveryError(
        `无法发现 ${language} 语言的查询类型，将使用默认查询类型`,
        errorContext
      );
    }
  }

  /**
   * 获取默认查询类型
   * @returns 默认查询类型数组
   */
  private static getDefaultQueryTypes(): string[] {
    return [...DEFAULT_QUERY_TYPES];
  }

  /**
   * 检查查询类型是否存在
   * @param language 语言名称
   * @param queryType 查询类型
   * @returns 是否存在
   */
  static async queryTypeExists(language: string, queryType: string): Promise<boolean> {
    try {
      // 首先检查是否已经加载
      if (this.isLanguageLoaded(language)) {
        return this.hasQueryType(language, queryType);
      }

      // 尝试动态发现
      const discoveredTypes = await this.discoverQueryTypes(language);
      return discoveredTypes.includes(queryType);
    } catch (error) {
      const errorContext = {
        language,
        queryType,
        errorType: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      };

      // 记录详细错误信息到安全日志
      this.logger.error('Query type existence check failed', errorContext);

      // 返回false而不是抛出错误，保持方法的行为一致
      return false;
    }
  }

  /**
   * 获取查询统计信息
   */
  static getStats() {
    const languageStats: Record<string, number> = {};
    for (const [language, queries] of Array.from(this.queries)) {
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

      // 检查查询模式 - 修复跨行查询验证
      let currentQuery = '';
      let parenBalance = 0;

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed || trimmed.startsWith(';')) {
          // 跳过空行和注释
          if (currentQuery.trim() && parenBalance === 0) {
            // 检查完整的查询模式
            if (!currentQuery.includes('(') || !currentQuery.includes(')')) {
              errors.push(`无效的查询模式: ${currentQuery.trim()}`);
            }
            currentQuery = '';
          }
          continue;
        }

        currentQuery += (currentQuery ? ' ' : '') + trimmed;

        // 计算括号平衡
        parenBalance += (trimmed.match(/\(/g) || []).length;
        parenBalance -= (trimmed.match(/\)/g) || []).length;

        // 如果括号平衡，检查查询模式
        if (parenBalance === 0) {
          if (!currentQuery.includes('(') || !currentQuery.includes(')')) {
            errors.push(`无效的查询模式: ${currentQuery.trim()}`);
          }
          currentQuery = '';
        }
      }

      // 检查最后一个未完成的查询
      if (currentQuery.trim() && parenBalance === 0) {
        if (!currentQuery.includes('(') || !currentQuery.includes(')')) {
          errors.push(`无效的查询模式: ${currentQuery.trim()}`);
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
      'c#': 'csharp',
      'csharp': 'csharp',
      'ts': 'typescript',
      'js': 'javascript',
      'py': 'python',
      'embedded-template': 'embedded_template'
    };

    return fileMap[language.toLowerCase()] || language.toLowerCase();
  }

  /**
   * 智能分类简单语言的查询(例如lua)
   * @param query 查询字符串
   * @param language 语言名称
   * @returns 分类后的查询映射
   */
  private static categorizeSimpleLanguageQuery(query: string, language: string): Map<string, string> {
    // 使用QueryPatternExtractor提取所有模式
    const languageQueriesMap = QueryPatternExtractor.extractAllPatterns(query, QUERY_PATTERNS);

    // 如果没有找到任何分类，将整个查询作为通用查询
    if (languageQueriesMap.size === 0) {
      languageQueriesMap.set('functions', query);
    }

    return languageQueriesMap;
  }

  /**
   * 加载结构化查询（新目录结构）
   * @param queryFileName 查询文件名
   * @param language 语言名称
   * @returns 查询映射
   */
  private static async loadStructuredQueries(queryFileName: string, language: string): Promise<Map<string, string>> {
    const languageQueriesMap = new Map<string, string>();
    
    try {
      // 尝试加载常见的查询类型
      for (const queryType of COMMON_QUERY_TYPES) {
        try {
          const importPath = `../../constants/queries/${queryFileName}/${queryType}`;
          const queryModule = await import(importPath);
          const query = queryModule.default;
          
          if (query) {
            languageQueriesMap.set(queryType, query);
          }
        } catch (error) {
          // 某些查询类型可能不存在，这是正常的
        }
      }
      
      // 尝试加载复合查询类型
      for (const compoundType of COMPOUND_QUERY_TYPES) {
        try {
          const importPath = `../../constants/queries/${queryFileName}/${compoundType.file}`;
          const queryModule = await import(importPath);
          const query = queryModule.default;
          
          if (query) {
            // 为复合查询类型中的每个查询类型创建查询
            const categorizedQueries = this.categorizeSimpleLanguageQuery(query, language);
            for (const queryType of compoundType.queries) {
              if (categorizedQueries.has(queryType) && !languageQueriesMap.has(queryType)) {
                languageQueriesMap.set(queryType, categorizedQueries.get(queryType)!);
              }
            }
          }
        } catch (error) {
          // 某些复合查询类型可能不存在，这是正常的
        }
      }
      
      // 动态加载语言目录中的所有查询文件
      try {
        const fs = await import('fs');
        const path = await import('path');
        
        const queryDirPath = path.join(__dirname, `../../constants/queries/${queryFileName}`);
        
        if (fs.existsSync(queryDirPath)) {
          const files = fs.readdirSync(queryDirPath);
          
          for (const file of files) {
            if (file.endsWith('.ts') && file !== 'index.ts') {
              const queryType = file.replace('.ts', '');
              
              // 如果该查询类型尚未加载，则尝试加载
              if (!languageQueriesMap.has(queryType)) {
                try {
                  const importPath = `../../constants/queries/${queryFileName}/${queryType}`;
                  const queryModule = await import(importPath);
                  const query = queryModule.default;
                  
                  if (query) {
                    languageQueriesMap.set(queryType, query);
                  }
                } catch (error) {
                  // 某些查询文件可能无法直接导入，这是正常的
                  this.logger.debug(`无法加载查询文件 ${queryType}:`, error);
                }
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn(`动态加载${language}语言查询文件失败:`, error);
      }
      
    } catch (error) {
      this.logger.error(`加载${language}语言的结构化查询失败:`, error);
    }
    
    return languageQueriesMap;
  }

  /**
   * 确保基本的查询类型存在
   * @param languageQueriesMap 语言查询映射
   * @param query 完整查询字符串
   * @param language 语言名称
   */
  private static ensureBasicQueryTypes(
    languageQueriesMap: Map<string, string>,
    query: string,
    language: string
  ): void {
    // 确保至少有functions查询类型
    if (!languageQueriesMap.has('functions')) {
      // 从完整查询中提取函数相关的模式
      const functionPatterns = QueryPatternExtractor.extractPatterns(query, QUERY_PATTERNS.functions);
      
      if (functionPatterns.length > 0) {
        languageQueriesMap.set('functions', functionPatterns.join('\n\n'));
      } else {
        // 如果没有找到函数模式，使用整个查询
        languageQueriesMap.set('functions', query);
      }
    }
    
    // 确保至少有classes查询类型
    if (!languageQueriesMap.has('classes')) {
      // 从完整查询中提取类相关的模式
      const classPatterns = QueryPatternExtractor.extractPatterns(query, QUERY_PATTERNS.classes);
      
      if (classPatterns.length > 0) {
        languageQueriesMap.set('classes', classPatterns.join('\n\n'));
      } else {
        // 如果没有找到类模式，创建一个空的查询
        languageQueriesMap.set('classes', '; No class patterns found for this language');
      }
    }
  }

  /**
   * 从查询中提取特定类型的模式
   * @param query 完整查询字符串
   * @param keywords 关键词列表
   * @returns 提取的模式数组
   */
}