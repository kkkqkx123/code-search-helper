import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 查询加载器 - 负责动态加载和管理查询文件
 */
export class QueryLoader {
  private static queries = new Map<string, string>();
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

      // 动态导入查询文件
      const queryModule = await import(`../../../constants/queries/${this.getQueryFileName(language)}`);
      const query = queryModule.default || queryModule[`${language}Query`];

      if (query) {
        this.queries.set(language.toLowerCase(), query);
        this.loadedLanguages.add(language.toLowerCase());
        this.logger.info(`${language}语言查询加载成功`);
      } else {
        throw new Error(`未找到${language}语言的查询模式`);
      }
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
   * @returns 查询字符串
   */
  static getQuery(language: string): string {
    const query = this.queries.get(language.toLowerCase());
    if (!query) {
      throw new Error(`${language}语言的查询未加载`);
    }
    return query;
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
    return {
      loadedLanguages: this.loadedLanguages.size,
      totalQueries: this.queries.size,
      languages: Array.from(this.loadedLanguages)
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

  /**
   * 从查询中提取特定的模式类型
   * @param language 语言名称
   * @param patternType 模式类型（functions, classes等）
   * @returns 提取的查询模式
   */
  static extractPatternType(language: string, patternType: string): string {
    const fullQuery = this.getQuery(language);

    // 定义模式类型的关键词
    const patternKeywords: Record<string, string[]> = {
      functions: [
        'function_declaration', 'function_definition', 'function_signature',
        'arrow_function', 'function_expression', 'method_definition'
      ],
      classes: [
        'class_declaration', 'class_definition', 'interface_declaration',
        'struct_definition', 'abstract_class_declaration'
      ],
      imports: [
        'import_statement', 'import_from_statement', 'import_declaration'
      ],
      exports: [
        'export_statement', 'export_declaration', 'export_default_declaration'
      ],
      methods: [
        'method_definition', 'method_signature', 'abstract_method_signature'
      ]
    };

    const keywords = patternKeywords[patternType] || [];
    const lines = fullQuery.split('\n');
    const result: string[] = [];
    let currentPattern: string[] = [];
    let inPattern = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 检查是否包含目标关键词
      const hasKeyword = keywords.some(keyword => trimmedLine.includes(keyword));

      if (hasKeyword || inPattern) {
        currentPattern.push(line);
        inPattern = true;

        // 如果行以右括号结束，可能是一个完整的模式
        if (trimmedLine.endsWith(')') && this.isBalancedParentheses(currentPattern.join('\n'))) {
          result.push(currentPattern.join('\n'));
          currentPattern = [];
          inPattern = false;
        }
      }
    }

    // 添加未完成的模式
    if (currentPattern.length > 0) {
      result.push(currentPattern.join('\n'));
    }

    return result.join('\n\n');
  }

  /**
   * 检查括号是否平衡
   * @param text 文本
   * @returns 是否平衡
   */
  private static isBalancedParentheses(text: string): boolean {
    let balance = 0;
    for (const char of text) {
      if (char === '(') balance++;
      if (char === ')') balance--;
      if (balance < 0) return false;
    }
    return balance === 0;
  }
}