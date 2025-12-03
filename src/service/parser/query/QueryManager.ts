import { LoggerService } from '../../../utils/LoggerService';
import { QUERY_PATTERNS } from './QueryConfig';

/**
 * 统一查询管理器
 * 整合了 QueryLoader、QueryRegistry 和 QueryPatternExtractor 的功能
 * 提供统一的查询模式管理和加载接口
 */
export class QueryManager {
  private static patterns: Map<string, Map<string, string>> = new Map();
  private static logger = new LoggerService();
  private static initialized = false;
  private static initializing = false;
  private static loadedLanguages = new Set<string>();

  /**
   * 初始化查询系统（全局单次初始化）
   */
  static async initialize(): Promise<boolean> {
    // 如果已经初始化完成，直接返回
    if (this.initialized) {
      return true;
    }

    // 如果正在初始化，等待初始化完成
    if (this.initializing) {
      // 等待最多5秒
      const maxWaitTime = 5000;
      const startTime = Date.now();

      while (this.initializing && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return this.initialized;
    }

    // 开始初始化
    this.initializing = true;
    this.logger.info('开始全局查询系统初始化...');

    try {
      // 从查询文件加载
      await this.loadFromQueryFiles();

      this.initialized = true;
      this.initializing = false;
      this.logger.info(`全局查询系统初始化完成，支持 ${this.patterns.size} 种语言`);
      return true;

    } catch (error) {
      this.initializing = false;
      this.logger.error('全局查询系统初始化失败:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown',
        type: typeof error
      });
      return false;
    }
  }

  /**
   * 重新初始化查询系统
   */
  static async reinitialize(): Promise<boolean> {
    this.initialized = false;
    return await this.initialize();
  }

  /**
   * 获取初始化状态
   */
  static getStatus(): { initialized: boolean; initializing: boolean } {
    return {
      initialized: this.initialized,
      initializing: this.initializing
    };
  }

  /**
   * 获取所有支持的语言
   */
  private static getSupportedLanguages(): string[] {
    return [
      'javascript', 'typescript', 'python', 'java', 'go', 'rust',
      'cpp', 'c', 'csharp', 'swift', 'kotlin', 'ruby', 'php', 'scala', 'embedded-template'
    ];
  }

  /**
   * 从查询文件加载查询模式
   */
  private static async loadFromQueryFiles(): Promise<void> {
    const languages = this.getSupportedLanguages();
    this.logger.info(`开始加载 ${languages.length} 种语言的查询模式...`);

    // 使用Promise.allSettled并行加载，但限制并发数
    const batchSize = 5; // 限制并发数避免资源竞争
    for (let i = 0; i < languages.length; i += batchSize) {
      const batch = languages.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (language: string) => {
          try {
            await this.loadLanguageQueries(language);
          } catch (error) {
            this.logger.warn(`加载 ${language} 语言查询失败:`, error);
            throw error; // 重新抛出错误，以便Promise.allSettled能捕获
          }
        })
      );

      // 记录结果
      results.forEach((result, index) => {
        const language = batch[index];
        if (result.status === 'rejected') {
          this.logger.warn(`加载 ${language} 语言查询失败:`, result.reason);
        }
      });
    }

    this.logger.info(`查询模式加载完成，成功加载 ${this.patterns.size} 种语言`);
  }

  /**
   * 加载指定语言的查询
   */
  static async loadLanguageQueries(language: string): Promise<void> {
    const normalizedLanguage = language.toLowerCase();
    if (this.loadedLanguages.has(normalizedLanguage)) {
      return;
    }

    this.logger.info(`开始加载 ${language} 语言的查询...`);

    try {
      const languageQueries = new Map<string, string>();
      const queryFileName = this.getQueryFileName(language);

      try {
        // 首先尝试加载index.ts文件（新结构）
        const importPath = `../../constants/queries/${queryFileName}/index`;

        // 使用绝对路径处理，避免相对路径问题
        const modulePath = require('path');
        const absolutePath = modulePath.join(__dirname, `../../constants/queries/${queryFileName}/index`);

        this.logger.debug(`尝试加载 ${language} 语言的查询文件: ${absolutePath}`);

        // 将绝对路径转换为file:// URL格式，以便在Windows上使用
        const pathModule = require('path');
        const fsModule = require('fs');
        const urlModule = require('url');

        // 检查文件是否存在
        if (fsModule.existsSync(absolutePath + '.ts') || fsModule.existsSync(absolutePath + '.js')) {
          this.logger.debug(`文件存在，开始动态导入: ${absolutePath}`);
          let queryModule;
          try {
            // 将绝对路径转换为file:// URL格式
            const fileUrl = urlModule.pathToFileURL(absolutePath).href;
            queryModule = await import(fileUrl);
          } catch (importError) {
            this.logger.error(`动态导入失败 ${absolutePath}:`, {
              error: importError instanceof Error ? importError.message : String(importError),
              stack: importError instanceof Error ? importError.stack : undefined,
              name: importError instanceof Error ? importError.name : 'Unknown',
              type: typeof importError
            });
            throw importError;
          }
          const query = queryModule.default;

          if (query) {
            // 对于有index.ts的语言，尝试加载单独的查询文件
            const languageQueriesMap = await this.loadStructuredQueries(queryFileName, language);

            // 如果没有找到单独的查询文件，回退到智能分类
            if (languageQueriesMap.size === 0) {
              const categorizedMap = this.categorizeSimpleLanguageQuery(query, language);
              languageQueriesMap.clear();
              for (const [key, value] of Array.from(categorizedMap)) {
                languageQueriesMap.set(key, value);
              }
            }

            this.patterns.set(normalizedLanguage, languageQueriesMap);
            this.loadedLanguages.add(normalizedLanguage);
            return;
          }
        } else {
          // 文件不存在，继续到下一个catch块
          throw new Error(`Query file does not exist: ${absolutePath}`);
        }
      } catch (error) {
        // 只记录警告，不输出详细错误信息，因为这是常见情况
        this.logger.warn(`新结构加载失败 ${language}，将尝试旧结构`);

        // 尝试回退到旧的单一文件结构
        try {
          const modulePath = require('path');
          const absolutePath = modulePath.join(__dirname, `../../constants/queries/${queryFileName}`);

          this.logger.debug(`尝试回退到旧结构: ${absolutePath}`);

          // 将绝对路径转换为file:// URL格式，以便在Windows上使用
          const pathModule = require('path');
          const fsModule = require('fs');
          const urlModule = require('url');

          // 检查文件是否存在
          if (fsModule.existsSync(absolutePath + '.ts') || fsModule.existsSync(absolutePath + '.js')) {
            const fileUrl = urlModule.pathToFileURL(absolutePath).href;
            const queryModule = await import(fileUrl);
            const query = queryModule.default || queryModule[`${queryFileName}Query`];

            if (query) {
              // 对于简单语言，使用智能分类
              const languageQueriesMap = this.categorizeSimpleLanguageQuery(query, language);

              this.patterns.set(normalizedLanguage, languageQueriesMap);
              this.loadedLanguages.add(normalizedLanguage);
              return;
            }
          } else {
            // 文件不存在，继续到下一个catch块
            throw new Error(`Query file does not exist: ${absolutePath}`);
          }
        } catch (fallbackError) {
          // 旧结构加载失败也只记录警告，不输出详细错误
          this.logger.warn(`旧结构加载也失败 ${language}`);
        }
      }

      throw new Error(`未找到${language}语言的查询文件`);
    } catch (error) {
      this.logger.error(`加载${language}语言查询失败:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown',
        type: typeof error
      });
      throw error;
    }
  }

  /**
   * 批量加载多种语言的查询
   */
  static async loadMultipleLanguages(languages: string[]): Promise<void> {
    const loadPromises = languages.map(lang => this.loadLanguageQueries(lang));
    await Promise.allSettled(loadPromises);
  }

  /**
   * 获取指定语言的查询字符串
   */
  static getQuery(language: string, queryType: string): string {
    const normalizedLanguage = language.toLowerCase();
    const languageQueries = this.patterns.get(normalizedLanguage);
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
   */
  static hasQueryType(language: string, queryType: string): boolean {
    const normalizedLanguage = language.toLowerCase();
    const languageQueries = this.patterns.get(normalizedLanguage);
    return languageQueries ? languageQueries.has(queryType) : false;
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
   * 获取指定语言的查询模式
   */
  static async getPattern(language: string, queryType: string): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
      if (!this.initialized) {
        return null;
      }
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
   * 检查语言是否已加载
   */
  static isLanguageLoaded(language: string): boolean {
    return this.loadedLanguages.has(language.toLowerCase());
  }

  /**
   * 获取已加载的语言列表
   */
  static getLoadedLanguages(): string[] {
    return Array.from(this.loadedLanguages);
  }

  /**
   * 获取指定语言支持的所有查询类型
   */
  static getQueryTypesForLanguage(language: string): string[] {
    const normalizedLanguage = language.toLowerCase();
    const languageQueries = this.patterns.get(normalizedLanguage);
    return languageQueries ? Array.from(languageQueries.keys()) : [];
  }

  /**
   * 预加载常用语言的查询
   */
  static async preloadCommonLanguages(): Promise<void> {
    const commonLanguages = [
      'javascript', 'typescript', 'python', 'java', 'go', 'rust',
      'cpp', 'c', 'csharp', 'swift', 'kotlin', 'ruby', 'php', 'scala', 'embedded-template'
    ];
    await this.loadMultipleLanguages(commonLanguages);
  }

  /**
   * 重新加载指定语言的查询
   */
  static async reloadLanguageQueries(language: string): Promise<void> {
    this.loadedLanguages.delete(language.toLowerCase());
    this.patterns.delete(language.toLowerCase());
    await this.loadLanguageQueries(language);
  }

  /**
   * 清除所有已加载的查询
   */
  static clearAllQueries(): void {
    this.patterns.clear();
    this.loadedLanguages.clear();
  }

  /**
   * 动态发现查询类型
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
      throw new Error(
        `无法发现 ${language} 语言的查询类型，将使用默认查询类型`,
        { cause: error }
      );
    }
  }

  /**
   * 获取默认查询类型
   */
  private static getDefaultQueryTypes(): string[] {
    return ['functions', 'types', 'variables', 'calls', 'dataFlow'];
  }

  /**
   * 检查查询类型是否存在
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
    for (const [language, queries] of Array.from(this.patterns)) {
      languageStats[language] = queries.size;
    }

    return {
      loadedLanguages: this.loadedLanguages.size,
      totalQueries: Array.from(this.patterns.values()).reduce((sum, queries) => sum + queries.size, 0),
      languages: Array.from(this.loadedLanguages),
      languageStats
    };
  }

  /**
   * 验证查询语法
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
   */
  private static getLineNumber(text: string, position: number): number {
    const before = text.substring(0, position);
    return before.split('\n').length;
  }

  /**
   * 获取查询文件名
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
   */
  private static categorizeSimpleLanguageQuery(query: string, language: string): Map<string, string> {
    try {
      // 使用 QUERY_PATTERNS 提取所有模式
      const languageQueriesMap = this.extractAllPatterns(query, QUERY_PATTERNS);

      // 如果没有找到任何分类，将整个查询作为通用查询
      if (languageQueriesMap.size === 0) {
        languageQueriesMap.set('functions', query);
      }

      return languageQueriesMap;
    } catch (error) {
      this.logger.error(`查询模式分类失败 ${language}:`, error);
      // 返回一个基本的映射以避免完全失败
      const fallbackMap = new Map<string, string>();
      fallbackMap.set('functions', query);
      return fallbackMap;
    }
  }

  /**
   * 加载结构化查询（新目录结构）
   */
  private static async loadStructuredQueries(queryFileName: string, language: string): Promise<Map<string, string>> {
    const languageQueriesMap = new Map<string, string>();

    try {
      // 尝试加载常见的查询类型
      const commonQueryTypes = ['functions', 'types', 'variables', 'calls', 'dataFlow', 'controlFlow', 'dependencies', 'inheritance'];

      for (const queryType of commonQueryTypes) {
        try {
          const modulePath = require('path');
          const absolutePath = modulePath.join(__dirname, `../../constants/queries/${queryFileName}/${queryType}`);

          // 将绝对路径转换为file:// URL格式，以便在Windows上使用
          const fs = require('fs');
          const urlModule = require('url');

          // 检查文件是否存在
          if (fs.existsSync(absolutePath + '.ts') || fs.existsSync(absolutePath + '.js')) {
            const fileUrl = urlModule.pathToFileURL(absolutePath).href;
            const queryModule = await import(fileUrl);
            const query = queryModule.default;

            if (query) {
              languageQueriesMap.set(queryType, query);
            }
          }
        } catch (error) {
          // 某些查询类型可能不存在，这是正常的
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
                  const modulePath = require('path');
                  const absolutePath = modulePath.join(__dirname, `../../constants/queries/${queryFileName}/${queryType}`);

                  // 将绝对路径转换为file:// URL格式，以便在Windows上使用
                  const fs = require('fs');
                  const urlModule = require('url');

                  // 检查文件是否存在
                  if (fs.existsSync(absolutePath + '.ts') || fs.existsSync(absolutePath + '.js')) {
                    const fileUrl = urlModule.pathToFileURL(absolutePath).href;
                    const queryModule = await import(fileUrl);
                    const query = queryModule.default;

                    if (query) {
                      languageQueriesMap.set(queryType, query);
                    }
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
   * 从查询字符串中提取特定关键词的模式
   */
  private static extractPatterns(query: string, keywords: string[]): string[] {
    try {
      const lines = query.split('\n');
      const patterns: string[] = [];
      let currentPattern: string[] = [];
      let inPattern = false;
      let parenDepth = 0;

      for (const line of lines) {
        const trimmedLine = line.trim();

        // 跳过空行和注释
        if (!trimmedLine || trimmedLine.startsWith(';') || trimmedLine.startsWith('//')) {
          if (currentPattern.length > 0 && parenDepth === 0) {
            patterns.push(currentPattern.join('\n'));
            currentPattern = [];
            inPattern = false;
          }
          continue;
        }

        // 检查是否包含目标关键词
        const hasKeyword = keywords.some(keyword =>
          trimmedLine.includes(`(${keyword}`) ||
          trimmedLine.includes(` ${keyword} `) ||
          trimmedLine.includes(`@${keyword}`)
        );

        if (hasKeyword || inPattern) {
          currentPattern.push(line);
          inPattern = true;

          // 计算括号深度
          parenDepth += (line.match(/\(/g) || []).length;
          parenDepth -= (line.match(/\)/g) || []).length;

          // 如果括号平衡，可能是一个完整的模式
          if (parenDepth === 0 && currentPattern.length > 0) {
            patterns.push(currentPattern.join('\n'));
            currentPattern = [];
            inPattern = false;
          }
        }
      }

      // 处理未完成的模式
      if (currentPattern.length > 0 && parenDepth === 0) {
        patterns.push(currentPattern.join('\n'));
      }

      return patterns;
    } catch (error) {
      console.error('QueryManager.extractPatterns error:', error);
      return []; // 返回空数组以避免错误传播
    }
  }

  /**
   * 根据查询类型和关键词映射提取所有模式
   */
  private static extractAllPatterns(
    query: string,
    queryPatterns: Record<string, string[]>
  ): Map<string, string> {
    try {
      const result = new Map<string, string>();

      for (const [queryType, keywords] of Object.entries(queryPatterns)) {
        const patterns = this.extractPatterns(query, keywords);
        if (patterns.length > 0) {
          result.set(queryType, patterns.join('\n\n'));
        }
      }

      return result;
    } catch (error) {
      console.error('QueryManager.extractAllPatterns error:', error);
      return new Map<string, string>(); // 返回空映射以避免错误传播
    }
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.patterns.clear();
    this.loadedLanguages.clear();
    this.initialized = false;
    this.logger.info('QueryManager 缓存已清除');
  }

  /**
   * 获取查询加载器统计信息
   */
  static getLoaderStats() {
    return this.getStats();
  }
}

// 为了保持向后兼容性，导出别名
export const QueryRegistryImpl = QueryManager;