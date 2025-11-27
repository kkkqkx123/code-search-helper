/**
 * 查询类型映射配置
 * 定义不同语言的查询类型映射关系
 */

// 语言查询映射配置
export const LANGUAGE_QUERY_MAPPINGS: Record<string, Record<string, string>> = {
  javascript: {
    'graph-functions': 'functions',
    'graph-classes': 'classes',
    'graph-imports': 'imports',
    'graph-exports': 'exports'
  },
  typescript: {
    'graph-functions': 'functions',
    'graph-classes': 'classes',
    'graph-interfaces': 'interfaces',
    'graph-types': 'types',
    'graph-imports': 'imports',
    'graph-exports': 'exports'
  },
  python: {
    'graph-functions': 'functions',
    'graph-classes': 'classes',
    'graph-imports': 'imports'
  },
  java: {
    'graph-functions': 'functions',
    'graph-classes': 'classes',
    'graph-interfaces': 'interfaces',
    'graph-imports': 'imports'
  },
  go: {
    'graph-functions': 'functions',
    'graph-types': 'types',
    'graph-imports': 'imports'
  },
  rust: {
    'graph-functions': 'functions',
    'graph-types': 'types',
    'graph-imports': 'imports'
  },
  cpp: {
    'graph-functions': 'functions',
    'graph-classes': 'classes',
    'graph-types': 'types'
  },
  c: {
    'graph-functions': 'functions',
    'graph-types': 'types'
  }
};

/**
 * 查询类型映射器
 * 提供查询类型转换和映射功能
 */
export class QueryTypeMapper {
  /**
   * 获取语言的查询映射
   * @param language 语言名称
   * @returns 查询映射对象
   */
  static getLanguageMapping(language: string): Record<string, string> {
    return LANGUAGE_QUERY_MAPPINGS[language.toLowerCase()] || {};
  }

  /**
   * 获取语言的图查询类型
   * @param language 语言名称
   * @returns 图查询类型数组
   */
  static getGraphQueryTypes(language: string): string[] {
    const mapping = this.getLanguageMapping(language);
    return Object.keys(mapping).filter(key => key.startsWith('graph-'));
  }

  /**
   * 转换图查询类型为标准查询类型
   * @param language 语言名称
   * @param graphType 图查询类型
   * @returns 标准查询类型
   */
  static convertGraphType(language: string, graphType: string): string | null {
    const mapping = this.getLanguageMapping(language);
    return mapping[graphType] || null;
  }

  /**
   * 检查语言是否支持指定的查询类型
   * @param language 语言名称
   * @param queryType 查询类型
   * @returns 是否支持
   */
  static supportsQueryType(language: string, queryType: string): boolean {
    const mapping = this.getLanguageMapping(language);
    return Object.values(mapping).includes(queryType);
  }

  /**
   * 获取语言支持的所有查询类型
   * @param language 语言名称
   * @returns 查询类型数组
   */
  static getSupportedQueryTypes(language: string): string[] {
    const mapping = this.getLanguageMapping(language);
    return [...new Set(Object.values(mapping))];
  }
}