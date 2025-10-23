/**
 * 统一查询类型映射配置
 * 定义各语言查询文件与标准查询类型的映射关系
 */

/**
 * 语言查询映射接口
 */
export interface LanguageQueryMapping {
  [queryFile: string]: string[];
}

/**
 * 语言映射接口
 */
export interface LanguageMappings {
  [language: string]: LanguageQueryMapping;
}

/**
 * 统一语言查询类型映射配置
 */
export const LANGUAGE_QUERY_MAPPINGS: LanguageMappings = {
  'rust': {
    'functions-structs': ['functions', 'classes'],
    'modules-imports': ['imports', 'modules'],
    'variables-expressions': ['variables', 'expressions'],
    'types-macros': ['types', 'macros'],
    'control-flow': ['control-flow']
  },
  'typescript': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'exports': ['exports'],
    'interfaces': ['interfaces'],
    'types': ['types'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'expressions': ['expressions']
  },
  'python': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'data-structures': ['classes'],
    'types-decorators': ['types']
  },
  'java': {
    'classes-interfaces': ['classes', 'interfaces'],
    'methods-variables': ['methods', 'variables'],
    'control-flow-patterns': ['control-flow'],
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'types': ['types'],
    'interfaces': ['interfaces'],
    'enums': ['types'],
    'records': ['classes'],
    'annotations': ['types']
  },
  'cpp': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'types': ['types']
  },
  'go': {
    'functions': ['functions'],
    'types': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow']
  },
  'c': {
    'functions': ['functions'],
    'variables': ['variables'],
    'imports': ['imports'],
    'control-flow': ['control-flow'],
    'types': ['types']
  },
  'csharp': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'types': ['types'],
    'interfaces': ['interfaces']
  },
  'kotlin': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'types': ['types'],
    'interfaces': ['interfaces']
  },
  'swift': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'types': ['types'],
    'protocols': ['interfaces']
  }
};

/**
 * 查询类型映射器类
 * 提供查询类型映射和验证功能
 */
export class QueryTypeMapper {
  /**
   * 获取映射后的查询类型
   * @param language 编程语言
   * @param discoveredTypes 发现的查询类型
   * @returns 映射后的标准查询类型数组
   */
  static getMappedQueryTypes(language: string, discoveredTypes: string[]): string[] {
    const mapping = LANGUAGE_QUERY_MAPPINGS[language.toLowerCase()];
    
    if (!mapping) {
      return discoveredTypes;
    }
    
    const mappedTypes: string[] = [];
    
    for (const discoveredType of discoveredTypes) {
      const mapped = mapping[discoveredType];
      if (mapped) {
        mappedTypes.push(...mapped);
      } else {
        mappedTypes.push(discoveredType);
      }
    }
    
    return [...new Set(mappedTypes)];
  }
  
  /**
   * 验证查询类型
   * @param language 编程语言
   * @param queryTypes 查询类型数组
   * @returns 是否所有查询类型都有效
   */
  static validateQueryTypes(language: string, queryTypes: string[]): boolean {
    const supportedTypes = this.getSupportedQueryTypes(language);
    return queryTypes.every(type => supportedTypes.includes(type));
  }
  
  /**
   * 获取支持的查询类型
   * @param language 编程语言
   * @returns 支持的查询类型数组
   */
  static getSupportedQueryTypes(language: string): string[] {
    const mapping = LANGUAGE_QUERY_MAPPINGS[language.toLowerCase()];
    if (!mapping) {
      return [];
    }
    
    return [...new Set(Object.values(mapping).flat())];
  }
  
  /**
   * 添加语言映射
   * @param language 编程语言
   * @param mapping 查询映射
   */
  static addLanguageMapping(language: string, mapping: LanguageQueryMapping): void {
    LANGUAGE_QUERY_MAPPINGS[language.toLowerCase()] = mapping;
  }
  
  /**
   * 更新语言映射
   * @param language 编程语言
   * @param queryFile 查询文件名
   * @param types 查询类型数组
   */
  static updateLanguageMapping(language: string, queryFile: string, types: string[]): void {
    const mapping = LANGUAGE_QUERY_MAPPINGS[language.toLowerCase()];
    if (mapping) {
      mapping[queryFile] = types;
    }
  }

  /**
   * 获取所有支持的语言
   * @returns 支持的语言数组
   */
  static getSupportedLanguages(): string[] {
    return Object.keys(LANGUAGE_QUERY_MAPPINGS);
  }

  /**
   * 检查语言是否支持
   * @param language 编程语言
   * @returns 是否支持该语言
   */
  static isLanguageSupported(language: string): boolean {
    return LANGUAGE_QUERY_MAPPINGS.hasOwnProperty(language.toLowerCase());
  }

  /**
   * 获取语言的查询文件映射
   * @param language 编程语言
   * @returns 查询文件映射对象
   */
  static getLanguageMapping(language: string): LanguageQueryMapping | null {
    return LANGUAGE_QUERY_MAPPINGS[language.toLowerCase()] || null;
  }

  /**
   * 根据查询文件获取对应的查询类型
   * @param language 编程语言
   * @param queryFile 查询文件名
   * @returns 查询类型数组
   */
  static getQueryTypesForFile(language: string, queryFile: string): string[] {
    const mapping = LANGUAGE_QUERY_MAPPINGS[language.toLowerCase()];
    if (!mapping || !mapping[queryFile]) {
      return [];
    }
    
    return [...mapping[queryFile]];
  }

  /**
   * 获取标准查询类型到查询文件的逆向映射
   * @param language 编程语言
   * @param queryType 标准查询类型
   * @returns 包含该查询类型的文件名数组
   */
  static getFilesForQueryType(language: string, queryType: string): string[] {
    const mapping = LANGUAGE_QUERY_MAPPINGS[language.toLowerCase()];
    if (!mapping) {
      return [];
    }
    
    const files: string[] = [];
    for (const [file, types] of Object.entries(mapping)) {
      if (types.includes(queryType)) {
        files.push(file);
      }
    }
    
    return files;
  }
}