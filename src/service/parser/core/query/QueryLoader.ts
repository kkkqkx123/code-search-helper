import { LoggerService } from '../../../../utils/LoggerService';

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
      this.logger.debug(`${language}语言的查询已加载，跳过重复加载`);
      return;
    }

    try {
      this.logger.info(`加载${language}语言的查询文件...`);

      const languageQueries = new Map<string, string>();
      const queryFileName = this.getQueryFileName(language);

      try {
        // 首先尝试加载index.ts文件（新结构）
        const importPath = `../../constants/queries/${queryFileName}/index`;
        this.logger.debug(`Attempting to import: ${importPath}`);

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
            for (const [key, value] of categorizedMap) {
              languageQueriesMap.set(key, value);
            }
          }

          this.queries.set(normalizedLanguage, languageQueriesMap);
          this.loadedLanguages.add(normalizedLanguage);
          this.logger.info(`${language}语言查询加载成功，共${languageQueriesMap.size}种类型`);
          return;
        }
      } catch (error) {
        this.logger.debug(`新结构加载失败，尝试旧结构: ${error}`);

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
            this.logger.info(`${language}语言查询加载成功（旧结构兼容），共${languageQueriesMap.size}种类型`);
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
    const commonLanguages = [
      'javascript',
      'typescript',
      'python',
      'java',
      'go',
      'rust',
      'cpp',
      'c',
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
   * 动态发现查询类型
   * @param language 语言名称
   * @returns 查询类型数组
   */
  static async discoverQueryTypes(language: string): Promise<string[]> {
    const queryDir = `../constants/queries/${this.getQueryFileName(language)}`;

    try {
      // 尝试动态读取目录结构
      const fs = await import('fs');
      const path = await import('path');

      const queryDirPath = path.join(__dirname, queryDir);

      // 添加调试信息
      this.logger.debug(`Checking query directory for ${language}: ${queryDirPath}`);

      // 检查目录是否存在
      if (!fs.existsSync(queryDirPath)) {
        this.logger.debug(`Query directory not found for ${language}: ${queryDirPath}`);
        return this.getDefaultQueryTypes();
      }

      // 读取目录内容
      const files = fs.readdirSync(queryDirPath);
      this.logger.debug(`Found files in ${queryDirPath}:`, files);

      // 过滤出TypeScript查询文件
      const queryFiles = files
        .filter(file => file.endsWith('.ts') && file !== 'index.ts')
        .map(file => file.replace('.ts', ''));

      if (queryFiles.length > 0) {
        this.logger.debug(`Discovered ${queryFiles.length} query types for ${language}:`, queryFiles);
        return queryFiles;
      }

      this.logger.debug(`No query files found in directory for ${language}`);
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
    return ['functions', 'classes', 'methods', 'imports', 'variables'];
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
      'c#': 'c-sharp',
      'csharp': 'c-sharp',
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
    const languageQueriesMap = new Map<string, string>();
    const lines = query.split('\n');

    // 定义查询类型的关键词模式
    const queryPatterns = {
      functions: [
        'function_definition', 'function_declaration', 'function_declarator',
        'method_definition', 'method_declaration', 'func_literal',
        'local_function_definition'
      ],
      classes: [
        'class_declaration', 'class_definition', 'struct_specifier',
        'struct_item', 'union_specifier', 'enum_specifier',
        'interface_type', 'struct_type', 'table'
      ],
      variables: [
        'variable_declaration', 'var_declaration', 'let_declaration',
        'assignment_expression', 'local_variable_declaration',
        'variable_assignment', 'declaration'
      ],
      imports: [
        'import_statement', 'import_declaration', 'use_declaration',
        'preproc_include', 'import_declaration'
      ],
      exports: [
        'export_statement', 'export_declaration', 'export_default_declaration'
      ],
      types: [
        'type_declaration', 'type_definition', 'type_alias_declaration',
        'type_definition', 'typedef'
      ],
      interfaces: [
        'interface_declaration', 'interface_definition', 'trait_item',
        'interface_type'
      ],
      methods: [
        'method_definition', 'method_declaration', 'method_spec',
        'function_definition_statement'
      ],
      properties: [
        'field_declaration', 'property_definition', 'public_field_definition',
        'field_declaration'
      ]
    };

    // 为每种查询类型收集相关的查询模式
    for (const [queryType, keywords] of Object.entries(queryPatterns)) {
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

      // 如果找到了模式，添加到映射中
      if (patterns.length > 0) {
        languageQueriesMap.set(queryType, patterns.join('\n\n'));
      }
    }

    // 如果没有找到任何分类，将整个查询作为通用查询
    if (languageQueriesMap.size === 0) {
      languageQueriesMap.set('functions', query);
    }

    this.logger.debug(`${language}语言查询分类完成，共${languageQueriesMap.size}种类型`);
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
      const commonQueryTypes = ['functions', 'classes', 'methods', 'imports', 'exports', 'variables', 'types', 'interfaces'];
      
      for (const queryType of commonQueryTypes) {
        try {
          const importPath = `../../constants/queries/${queryFileName}/${queryType}`;
          const queryModule = await import(importPath);
          const query = queryModule.default;
          
          if (query) {
            languageQueriesMap.set(queryType, query);
            this.logger.debug(`加载${language}语言的${queryType}查询成功`);
          }
        } catch (error) {
          // 某些查询类型可能不存在，这是正常的
          this.logger.debug(`${language}语言的${queryType}查询文件不存在: ${error}`);
        }
      }
      
      // 尝试加载复合查询类型（如functions-types）
      const compoundTypes = [
        { file: 'functions-types', queries: ['functions', 'classes'] },
        { file: 'classes-functions', queries: ['classes', 'functions'] },
        { file: 'methods-variables', queries: ['methods', 'variables'] },
        { file: 'constructors-properties', queries: ['methods', 'properties'] },
        { file: 'control-flow-patterns', queries: ['controlFlow'] },
        { file: 'expressions-control-flow', queries: ['expression', 'controlFlow'] },
        { file: 'types-decorators', queries: ['types', 'decorator'] },
        { file: 'variables-imports', queries: ['variables', 'imports'] }
      ];
      
      for (const compoundType of compoundTypes) {
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
                this.logger.debug(`从${compoundType.file}加载${language}语言的${queryType}查询成功`);
              }
            }
          }
        } catch (error) {
          this.logger.debug(`${language}语言的${compoundType.file}查询文件不存在: ${error}`);
        }
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
      const functionPatterns = this.extractPatternsForType(query, [
        'function_definition', 'function_declaration', 'function_declarator',
        'method_definition', 'method_declaration', 'func_literal',
        'local_function_definition', 'function_declaration'
      ]);
      
      if (functionPatterns.length > 0) {
        languageQueriesMap.set('functions', functionPatterns.join('\n\n'));
        this.logger.debug(`为${language}语言创建functions查询`);
      } else {
        // 如果没有找到函数模式，使用整个查询
        languageQueriesMap.set('functions', query);
        this.logger.debug(`为${language}语言使用默认functions查询`);
      }
    }
    
    // 确保至少有classes查询类型
    if (!languageQueriesMap.has('classes')) {
      // 从完整查询中提取类相关的模式
      const classPatterns = this.extractPatternsForType(query, [
        'class_declaration', 'class_definition', 'struct_specifier',
        'struct_item', 'union_specifier', 'enum_specifier',
        'interface_type', 'struct_type', 'interface_declaration',
        'type_declaration', 'type_definition'
      ]);
      
      if (classPatterns.length > 0) {
        languageQueriesMap.set('classes', classPatterns.join('\n\n'));
        this.logger.debug(`为${language}语言创建classes查询`);
      } else {
        // 如果没有找到类模式，创建一个空的查询
        languageQueriesMap.set('classes', '; No class patterns found for this language');
        this.logger.debug(`为${language}语言创建空classes查询`);
      }
    }
  }

  /**
   * 从查询中提取特定类型的模式
   * @param query 完整查询字符串
   * @param keywords 关键词列表
   * @returns 提取的模式数组
   */
  private static extractPatternsForType(query: string, keywords: string[]): string[] {
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
  }
}