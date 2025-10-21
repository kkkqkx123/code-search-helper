import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 查询转换器 - 负责将完整的查询语句转换为特定类型的简化查询模式
 */
export class QueryTransformer {
  private static patternTypeMappings: Map<string, string[]> = new Map();
  private static queryCache: Map<string, Map<string, string>> = new Map();
  private static logger = new LoggerService();
  private static initialized = false;

  /**
   * 初始化模式类型映射
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }
    
    this.initializePatternMappings();
    this.initialized = true;
    this.logger.info('QueryTransformer 初始化完成');
  }

  /**
   * 从完整查询中提取特定类型的模式
   * @param fullQuery 完整的查询字符串
   * @param patternType 模式类型（functions, classes等）
   * @param language 语言名称
   * @returns 提取的查询模式
   */
  static extractPatternType(fullQuery: string, patternType: string, language: string): string {
    if (!this.initialized) {
      this.initialize();
    }

    const cacheKey = `${language}:${patternType}`;
    
    // 检查缓存
    if (this.queryCache.has(language) && this.queryCache.get(language)!.has(patternType)) {
      return this.queryCache.get(language)!.get(patternType)!;
    }

    const patterns = this.extractPatterns(fullQuery, patternType, language);
    const result = patterns.join('\n\n');

    // 缓存结果
    if (!this.queryCache.has(language)) {
      this.queryCache.set(language, new Map());
    }
    this.queryCache.get(language)!.set(patternType, result);

    this.logger.debug(`提取 ${language}.${patternType} 模式，长度: ${result.length}`);
    return result;
  }

  /**
   * 获取所有支持的模式类型
   * @returns 模式类型数组
   */
  static getSupportedPatternTypes(): string[] {
    if (!this.initialized) {
      this.initialize();
    }
    
    return Array.from(this.patternTypeMappings.keys());
  }

  /**
   * 获取指定语言支持的模式类型
   * @param language 语言名称
   * @returns 支持的模式类型数组
   */
  static getSupportedPatternTypesForLanguage(language: string): string[] {
    if (!this.initialized) {
      this.initialize();
    }
    
    // 基于语言类型返回通用支持的模式类型
    const languageBasedTypes: Record<string, string[]> = {
      'javascript': ['functions', 'classes', 'imports', 'exports', 'methods', 'variables'],
      'typescript': ['functions', 'classes', 'imports', 'exports', 'methods', 'interfaces', 'types', 'variables'],
      'python': ['functions', 'classes', 'imports', 'methods', 'variables'],
      'java': ['functions', 'classes', 'methods', 'interfaces', 'types', 'variables'],
      'go': ['functions', 'types', 'variables'],
      'rust': ['functions', 'types', 'variables'],
      'cpp': ['functions', 'classes', 'methods', 'types', 'variables'],
      'c': ['functions', 'types', 'variables'],
    };
    
    // 检查是否为特定语言，否则返回所有支持的类型
    if (languageBasedTypes[language]) {
      // 验证这些类型确实存在于映射中
      return languageBasedTypes[language].filter(type => this.patternTypeMappings.has(type));
    } else {
      // 对于不明确支持的语言，返回所有存在的类型
      return Array.from(this.patternTypeMappings.keys());
    }
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.queryCache.clear();
    this.logger.info('QueryTransformer 缓存已清除');
  }

  /**
   * 获取缓存统计信息
   * @returns 缓存统计信息
   */
  static getCacheStats() {
    let totalQueries = 0;
    const languageStats: Record<string, number> = {};

    for (const [language, patterns] of this.queryCache) {
      const count = patterns.size;
      languageStats[language] = count;
      totalQueries += count;
    }

    return {
      totalQueries,
      cachedLanguages: Object.keys(languageStats).length,
      languageStats
    };
  }

  /**
   * 初始化模式类型映射
   */
  private static initializePatternMappings(): void {
    // 函数相关模式
    this.patternTypeMappings.set('functions', [
      'function_declaration',
      'function_definition', 
      'function_signature',
      'method_definition',
      'method_signature',
      'arrow_function',
      'function_expression',
      'generator_function_declaration',
      'generator_function',
      'abstract_method_signature'
    ]);

    // 类相关模式
    this.patternTypeMappings.set('classes', [
      'class_declaration',
      'class_definition',
      'abstract_class_declaration',
      'struct_declaration',
      'struct_definition',
      'enum_declaration',
      'interface_declaration',
      'class',
      'trait_definition',
      'object_definition'
    ]);

    // 导入相关模式
    this.patternTypeMappings.set('imports', [
      'import_statement',
      'import_from_statement',
      'import_declaration',
      'using_directive',
      'use_statement',
      'import_spec'
    ]);

    // 导出相关模式
    this.patternTypeMappings.set('exports', [
      'export_statement',
      'export_declaration',
      'export_default_declaration',
      'export_named_declaration',
      'export_all_declaration'
    ]);

    // 方法相关模式
    this.patternTypeMappings.set('methods', [
      'method_definition',
      'method_signature',
      'abstract_method_signature'
    ]);

    // 接口相关模式
    this.patternTypeMappings.set('interfaces', [
      'interface_declaration',
      'interface_definition'
    ]);

    // 类型相关模式
    this.patternTypeMappings.set('types', [
      'type_alias_declaration',
      'type_definition',
      'type_annotation'
    ]);

    // 属性相关模式
    this.patternTypeMappings.set('properties', [
      'property_definition',
      'public_field_definition',
      'private_field_definition',
      'protected_field_definition'
    ]);

    // 变量相关模式
    this.patternTypeMappings.set('variables', [
      'variable_declaration',
      'lexical_declaration',
      'const_declaration',
      'let_declaration',
      'assignment_expression'
    ]);
  }

  /**
   * 从完整查询中提取特定模式的实现
   * @param fullQuery 完整的查询字符串
   * @param patternType 模式类型
   * @param language 语言名称
   * @returns 提取的模式数组
   */
  private static extractPatterns(fullQuery: string, patternType: string, language: string): string[] {
    const targetKeywords = this.patternTypeMappings.get(patternType) || [];
    const lines = fullQuery.split('\n');
    const patterns: string[] = [];
    let currentPattern: string[] = [];
    let inPattern = false;
    let inComment = false;
    let braceDepth = 0;
    let parenDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // 跳过空行和注释
      if (!trimmedLine || trimmedLine.startsWith(';')) {
        continue;
      }

      // 检查是否包含目标关键词
      const hasKeyword = targetKeywords.some(keyword => 
        trimmedLine.includes(`(${keyword}`) || 
        trimmedLine.includes(`[${keyword}`) ||
        trimmedLine.includes(` ${keyword} `) ||
        trimmedLine.includes(`@${keyword}`)
      );

      if (hasKeyword || inPattern) {
        currentPattern.push(line);
        inPattern = true;

        // 计算括号深度
        braceDepth += this.countChar(line, '{');
        braceDepth -= this.countChar(line, '}');
        parenDepth += this.countChar(line, '(');
        parenDepth -= this.countChar(line, ')');

        // 如果括号平衡且不在注释中，可能是一个完整的模式
        if (braceDepth === 0 && parenDepth === 0 && !inComment) {
          const patternText = currentPattern.join('\n');
          if (this.isValidPattern(patternText)) {
            patterns.push(patternText);
          }
          currentPattern = [];
          inPattern = false;
        }
      }
    }

    // 处理未完成的模式
    if (currentPattern.length > 0 && braceDepth === 0 && parenDepth === 0) {
      const patternText = currentPattern.join('\n');
      if (this.isValidPattern(patternText)) {
        patterns.push(patternText);
      }
    }

    // 如果没有找到模式，尝试简化的匹配逻辑
    if (patterns.length === 0) {
      return this.fallbackExtractPatterns(fullQuery, patternType, targetKeywords);
    }

    return patterns;
  }

  /**
   * 回退模式提取逻辑
   * @param fullQuery 完整查询
   * @param patternType 模式类型
   * @param targetKeywords 目标关键词
   * @returns 提取的模式
   */
  private static fallbackExtractPatterns(fullQuery: string, patternType: string, targetKeywords: string[]): string[] {
    const patterns: string[] = [];
    const lines = fullQuery.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // 检查是否包含目标关键词
      const hasKeyword = targetKeywords.some(keyword => 
        trimmedLine.includes(keyword)
      );

      if (hasKeyword) {
        // 尝试构建简单的模式
        let pattern = line;
        
        // 如果行以括号开始，可能是一个完整的模式
        if (trimmedLine.startsWith('(')) {
          // 查找匹配的右括号
          let parenDepth = 1;
          let j = i + 1;
          
          while (j < lines.length && parenDepth > 0) {
            const nextLine = lines[j];
            parenDepth += this.countChar(nextLine, '(');
            parenDepth -= this.countChar(nextLine, ')');
            pattern += '\n' + nextLine;
            j++;
          }
          
          if (parenDepth === 0) {
            patterns.push(pattern);
          }
        }
      }
    }
    
    return patterns;
  }

  /**
   * 计算字符在字符串中出现的次数
   * @param text 文本
   * @param char 字符
   * @returns 出现次数
   */
  private static countChar(text: string, char: string): number {
    return text.split(char).length - 1;
  }

  /**
   * 验证模式是否有效
   * @param pattern 模式字符串
   * @returns 是否有效
   */
  private static isValidPattern(pattern: string): boolean {
    // 基本验证：检查括号平衡和基本结构
    const openParens = (pattern.match(/\(/g) || []).length;
    const closeParens = (pattern.match(/\)/g) || []).length;
    
    if (openParens !== closeParens) {
      return false;
    }

    // 检查是否包含有效的查询结构
    return pattern.includes('@') && pattern.includes('(');
  }
}