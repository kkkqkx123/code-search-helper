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
    'expressions': ['expressions'],
    'properties': ['variables'],
    // 新增图索引映射
    'graph-classes': ['classes', 'interfaces'],
    'graph-functions': ['functions', 'methods'],
    'graph-calls': ['expressions'],
    'graph-imports': ['imports'],
    'graph-exports': ['exports']
  },
  'python': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'data-structures': ['classes'],
    'types-decorators': ['types'],
    // 新增图索引映射
    'graph-classes': ['classes'],
    'graph-functions': ['functions', 'methods'],
    'graph-calls': ['expressions'],
    'graph-imports': ['imports'],
    'graph-exports': ['variables'] // Python中导出通常作为变量
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
    'annotations': ['types'],
    // 新增图索引映射
    'graph-classes': ['classes', 'interfaces'],
    'graph-functions': ['methods'], // Java中方法是类的成员
    'graph-calls': ['expressions'],
    'graph-imports': ['imports'],
    'graph-exports': ['types'] // Java中导出通常作为类型
  },
  'cpp': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'types': ['types'],
    'namespaces': ['modules'],
    'preprocessor': ['imports'],
    'modern-features': ['types'],
    // 新增图索引映射
    'graph-classes': ['classes'],
    'graph-functions': ['functions', 'methods'],
    'graph-calls': ['expressions'],
    'graph-imports': ['imports', 'preprocessor'], // C++中预处理器指令类似导入
    'graph-exports': ['types'] // C++中导出通常作为类型声明
  },
  'go': {
    'functions-types': ['functions', 'classes'],
    'variables-imports': ['variables', 'imports'],
    'expressions-control-flow': ['expressions', 'control-flow'],
    'functions': ['functions'],
    'types': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    // 新增图索引映射
    'graph-classes': ['types'], // Go中结构体作为类
    'graph-functions': ['functions', 'methods'],
    'graph-calls': ['expressions'],
    'graph-imports': ['imports'],
    'graph-exports': ['functions', 'types'] // Go中导出函数和类型
  },
  'c': {
    'functions': ['functions'],
    'variables': ['variables'],
    'imports': ['imports'],
    'control-flow': ['control-flow'],
    'types': ['types'],
    // 新增图索引映射
    'graph-classes': ['types'], // C中结构体作为类
    'graph-functions': ['functions'],
    'graph-calls': ['expressions'],
    'graph-imports': ['imports'], // C中头文件包含
    'graph-exports': ['types', 'functions'] // C中导出类型和函数
  },
  'csharp': {
    'classes': ['classes'],
    'methods': ['methods'],
    'properties': ['variables'],
    'functions': ['functions'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'types': ['types'],
    'interfaces': ['interfaces'],
    'linq': ['expressions'],
    'patterns': ['control-flow'],
    'expressions': ['expressions'],
    // 新增图索引映射
    'graph-classes': ['classes', 'interfaces'],
    'graph-functions': ['methods'],
    'graph-calls': ['expressions'],
    'graph-imports': ['imports'], // C#中使用using导入
    'graph-exports': ['types'], // C#中导出通常作为类型
  },
  'kotlin': {
    'classes-functions': ['classes', 'functions'],
    'constructors-properties': ['methods', 'variables'],
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
    // 新增图索引映射
    'graph-classes': ['classes', 'interfaces'],
    'graph-functions': ['functions', 'methods'],
    'graph-calls': ['expressions'],
    'graph-imports': ['imports'],
    'graph-exports': ['types', 'functions'] // Kotlin中导出类型和函数
  },
  'swift': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'types': ['types'],
    'protocols': ['interfaces'],
    // 新增图索引映射
    'graph-classes': ['classes', 'protocols'], // Swift中协议类似接口
    'graph-functions': ['functions', 'methods'],
    'graph-calls': ['expressions'],
    'graph-imports': ['imports'],
    'graph-exports': ['types', 'functions'] // Swift中导出类型和函数
  },
  'css': {
    'selectors': ['classes'],
    'properties': ['variables'],
    'rules': ['functions']
  },
  'html': {
    'elements': ['classes'],
    'attributes-content': ['variables']
  },
  'javascript': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'exports': ['exports'],
    'interfaces': ['interfaces'],
    'types': ['types'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'expressions': ['expressions'],
    'properties': ['variables'],
    // 新增图索引映射
    'graph-classes': ['classes'],
    'graph-functions': ['functions', 'methods'],
    'graph-calls': ['expressions'],
    'graph-imports': ['imports'],
    'graph-exports': ['exports']
  },
  'tsx': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'exports': ['exports'],
    'interfaces': ['interfaces'],
    'types': ['types'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'expressions': ['expressions'],
    'components': ['classes'],
    'jsx': ['expressions'],
    'types-hooks': ['types', 'functions'],
    // 新增图索引映射
    'graph-classes': ['classes', 'components'],
    'graph-functions': ['functions', 'methods', 'types-hooks'],
    'graph-calls': ['jsx', 'expressions'],
    'graph-imports': ['imports'],
    'graph-exports': ['exports']
  },
  'vue': {
    'components': ['classes'],
    'template-directives': ['functions'],
    // 新增图索引映射
    'graph-classes': ['components'],
    'graph-functions': ['template-directives'],
    'graph-calls': [],
    'graph-imports': [],
    'graph-exports': []
  },
  'json': {
    'objects-arrays': ['tables', 'arrays'],
    'key-value-pairs': ['config-items'],
    'values': ['values'],
    'strings': ['values'],
    'numbers': ['values'],
    'booleans': ['values'],
    'nulls': ['values'],
    // 新增图索引映射 - JSON不包含代码结构，但可以映射为图节点
    'graph-classes': ['objects-arrays'],
    'graph-functions': [],
    'graph-calls': [],
    'graph-imports': [],
    'graph-exports': ['key-value-pairs']
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