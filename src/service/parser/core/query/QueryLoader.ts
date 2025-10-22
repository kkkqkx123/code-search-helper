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

      // 尝试回退到旧的单一文件结构（用于简单语言）
      try {
        const queryModule = await import(`../../constants/queries/${this.getQueryFileName(language)}.ts`);
        const query = queryModule.default || queryModule[`${language}Query`];

        if (query) {
          // 对于简单语言，使用智能分类
          const languageQueriesMap = this.categorizeSimpleLanguageQuery(query, language);

          this.queries.set(language.toLowerCase(), languageQueriesMap);
          this.loadedLanguages.add(language.toLowerCase());
          this.logger.info(`${language}语言查询加载成功（旧结构兼容），共${languageQueriesMap.size}种类型`);
          return;
        }
      } catch (fallbackError) {
        this.logger.error(`旧结构加载也失败: ${fallbackError}`);
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
      'c',
      'embedded-template'
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
}