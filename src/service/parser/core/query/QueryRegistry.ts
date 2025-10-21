import {
  SIMPLE_JAVASCRIPT_QUERIES,
  SIMPLE_TYPESCRIPT_QUERIES,
  SIMPLE_PYTHON_QUERIES,
  SIMPLE_JAVA_QUERIES,
  SIMPLE_GO_QUERIES,
  SIMPLE_RUST_QUERIES,
  SIMPLE_CPP_QUERIES,
  SIMPLE_C_QUERIES,
  SIMPLE_CSHARP_QUERIES,
  SIMPLE_SWIFT_QUERIES,
  SIMPLE_KOTLIN_QUERIES,
  SIMPLE_RUBY_QUERIES,
  SIMPLE_PHP_QUERIES,
  SIMPLE_SCALA_QUERIES
} from './SimpleQueryPatterns';

/**
 * 查询注册表 - 管理所有语言的查询模式
 */
export class QueryRegistry {
  private static patterns: Map<string, Map<string, string>> = new Map();

  /**
   * 初始化查询注册表
   */
  static initialize(): void {
    // 注册JavaScript查询模式
    this.registerLanguage('javascript', SIMPLE_JAVASCRIPT_QUERIES);

    // 注册TypeScript查询模式
    this.registerLanguage('typescript', SIMPLE_TYPESCRIPT_QUERIES);

    // 注册Python查询模式
    this.registerLanguage('python', SIMPLE_PYTHON_QUERIES);

    // 注册Java查询模式
    this.registerLanguage('java', SIMPLE_JAVA_QUERIES);

    // 注册Go查询模式
    this.registerLanguage('go', SIMPLE_GO_QUERIES);

    // 注册Rust查询模式
    this.registerLanguage('rust', SIMPLE_RUST_QUERIES);

    // 注册C++查询模式
    this.registerLanguage('cpp', SIMPLE_CPP_QUERIES);

    // 注册C查询模式
    this.registerLanguage('c', SIMPLE_C_QUERIES);

    // 注册C#查询模式
    this.registerLanguage('csharp', SIMPLE_CSHARP_QUERIES);

    // 注册Swift查询模式
    this.registerLanguage('swift', SIMPLE_SWIFT_QUERIES);

    // 注册Kotlin查询模式
    this.registerLanguage('kotlin', SIMPLE_KOTLIN_QUERIES);

    // 注册Ruby查询模式
    this.registerLanguage('ruby', SIMPLE_RUBY_QUERIES);

    // 注册PHP查询模式
    this.registerLanguage('php', SIMPLE_PHP_QUERIES);

    // 注册Scala查询模式
    this.registerLanguage('scala', SIMPLE_SCALA_QUERIES);
  }

  /**
   * 注册语言的查询模式
   * @param language 语言名称
   * @param patterns 查询模式映射
   */
  private static registerLanguage(language: string, patterns: Record<string, string>): void {
    this.patterns.set(language.toLowerCase(), new Map(Object.entries(patterns)));
  }

  /**
   * 获取指定语言的查询模式
   * @param language 语言名称
   * @param queryType 查询类型
   * @returns 查询模式字符串
   */
  static getPattern(language: string, queryType: string): string | null {
    const langPatterns = this.patterns.get(language.toLowerCase());
    return langPatterns ? langPatterns.get(queryType) || null : null;
  }

  /**
   * 获取指定语言的所有查询模式
   * @param language 语言名称
   * @returns 查询模式映射
   */
  static getPatternsForLanguage(language: string): Record<string, string> {
    const langPatterns = this.patterns.get(language.toLowerCase());
    return langPatterns ? Object.fromEntries(langPatterns) : {};
  }

  /**
   * 获取支持的所有语言
   * @returns 支持的语言列表
   */
  static getSupportedLanguages(): string[] {
    return Array.from(this.patterns.keys());
  }

  /**
   * 获取指定语言支持的所有查询类型
   * @param language 语言名称
   * @returns 查询类型列表
   */
  static getQueryTypesForLanguage(language: string): string[] {
    const langPatterns = this.patterns.get(language.toLowerCase());
    return langPatterns ? Array.from(langPatterns.keys()) : [];
  }
}

// 初始化查询注册表
QueryRegistry.initialize();