/**
 * 工具类型定义
 * 定义文件特征、语言特征、复杂度指标等工具类型
 */

/**
 * 文件特征接口
 */
export interface FileFeatures {
  /** 文件大小（字节） */
  size: number;
  /** 行数 */
  lineCount: number;
  /** 字符数 */
  characterCount: number;
  /** 是否为二进制文件 */
  isBinary: boolean;
  /** 是否为文本文件 */
  isText: boolean;
  /** 是否为代码文件 */
  isCode: boolean;
  /** 文件扩展名 */
  extension: string;
  /** MIME类型 */
  mimeType?: string;
  /** 编码格式 */
  encoding?: string;
  /** 是否包含非ASCII字符 */
  hasNonASCII: boolean;
  /** 是否包含BOM */
  hasBOM: boolean;
  /** 换行符类型 */
  lineEndingType: LineEndingType;
  /** 缩进类型 */
  indentType: IndentType;
  /** 平均缩进大小 */
  averageIndentSize: number;
  /** 扩展属性 */
  [key: string]: any;
}

/**
 * 语言特征接口
 */
export interface LanguageFeatures {
  /** 语言名称 */
  language: string;
  /** 语言家族 */
  languageFamily: LanguageFamily;
  /** 是否为编译型语言 */
  isCompiled: boolean;
  /** 是否为解释型语言 */
  isInterpreted: boolean;
  /** 是否为脚本语言 */
  isScripting: boolean;
  /** 是否为标记语言 */
  isMarkup: boolean;
  /** 是否为样式语言 */
  isStyle: boolean;
  /** 是否支持面向对象 */
  supportsOOP: boolean;
  /** 是否支持函数式编程 */
  supportsFunctional: boolean;
  /** 是否支持异步编程 */
  supportsAsync: boolean;
  /** 是否支持泛型 */
  supportsGenerics: boolean;
  /** 是否支持模块系统 */
  supportsModules: boolean;
  /** 关键字列表 */
  keywords: string[];
  /** 操作符列表 */
  operators: string[];
  /** 注释语法 */
  commentSyntax: CommentSyntax;
  /** 字符串语法 */
  stringSyntax: StringSyntax;
  /** 扩展属性 */
  [key: string]: any;
}

/**
 * 复杂度指标接口
 */
export interface ComplexityMetrics {
  /** 圈复杂度 */
  cyclomaticComplexity: number;
  /** 认知复杂度 */
  cognitiveComplexity: number;
  /** 嵌套深度 */
  nestingDepth: number;
  /** 函数数量 */
  functionCount: number;
  /** 类数量 */
  classCount: number;
  /** 接口数量 */
  interfaceCount: number;
  /** 依赖数量 */
  dependencyCount: number;
  /** 代码行数 */
  linesOfCode: number;
  /** 注释行数 */
  linesOfComments: number;
  /** 空行数 */
  linesOfWhitespace: number;
  /** 最大函数长度 */
  maxFunctionLength: number;
  /** 最大类长度 */
  maxClassLength: number;
  /** 平均函数长度 */
  averageFunctionLength: number;
  /** 平均类长度 */
  averageClassLength: number;
  /** 重复代码比例 */
  duplicationRatio: number;
  /** 测试覆盖率 */
  testCoverage?: number;
  /** 技术债务评分 */
  technicalDebtScore: number;
  /** 可维护性指数 */
  maintainabilityIndex: number;
  /** 扩展属性 */
  [key: string]: any;
}

/**
 * 代码质量指标接口
 */
export interface CodeQualityMetrics {
  /** 代码质量评分（0-100） */
  qualityScore: number;
  /** 可读性评分 */
  readabilityScore: number;
  /** 可维护性评分 */
  maintainabilityScore: number;
  /** 可测试性评分 */
  testabilityScore: number;
  /** 复杂度评分 */
  complexityScore: number;
  /** 一致性评分 */
  consistencyScore: number;
  /** 文档完整性评分 */
  documentationScore: number;
  /** 错误处理评分 */
  errorHandlingScore: number;
  /** 性能评分 */
  performanceScore: number;
  /** 安全性评分 */
  securityScore: number;
  /** 质量问题列表 */
  issues: CodeQualityIssue[];
  /** 建议改进列表 */
  suggestions: string[];
  /** 扩展属性 */
  [key: string]: any;
}

/**
 * 代码质量问题接口
 */
export interface CodeQualityIssue {
  /** 问题类型 */
  type: QualityIssueType;
  /** 严重程度 */
  severity: IssueSeverity;
  /** 问题描述 */
  description: string;
  /** 所在行号 */
  line?: number;
  /** 所在列号 */
  column?: number;
  /** 规则名称 */
  rule?: string;
  /** 修复建议 */
  suggestion?: string;
  /** 是否可自动修复 */
  autoFixable: boolean;
}

/**
 * 换行符类型枚举
 */
export enum LineEndingType {
  CRLF = 'crlf', // Windows
  LF = 'lf',     // Unix/Linux/Mac
  CR = 'cr',     // Old Mac
  MIXED = 'mixed' // 混合
}

/**
 * 缩进类型枚举
 */
export enum IndentType {
  SPACES = 'spaces',
  TABS = 'tabs',
  MIXED = 'mixed',
  NONE = 'none'
}

/**
 * 语言家族枚举
 */
export enum LanguageFamily {
  C = 'c',
  JAVA = 'java',
  PYTHON = 'python',
  JAVASCRIPT = 'javascript',
  FUNCTIONAL = 'functional',
  SCRIPTING = 'scripting',
  MARKUP = 'markup',
  STYLE = 'style',
  DATA = 'data',
  CONFIG = 'config',
  UNKNOWN = 'unknown'
}

/**
 * 注释语法接口
 */
export interface CommentSyntax {
  /** 单行注释符号 */
  singleLine: string[];
  /** 多行注释开始符号 */
  multiLineStart: string;
  /** 多行注释结束符号 */
  multiLineEnd: string;
  /** 文档注释开始符号 */
  docStart?: string;
  /** 文档注释结束符号 */
  docEnd?: string;
}

/**
 * 字符串语法接口
 */
export interface StringSyntax {
  /** 单引号字符串 */
  singleQuote: boolean;
  /** 双引号字符串 */
  doubleQuote: boolean;
  /** 反引号字符串 */
  backtick: boolean;
  /** 原始字符串 */
  rawString: boolean;
  /** 多行字符串 */
  multiLine: boolean;
  /** 字符串插值 */
  interpolation: boolean;
}

/**
 * 质量问题类型枚举
 */
export enum QualityIssueType {
  SYNTAX_ERROR = 'syntax_error',
  LOGIC_ERROR = 'logic_error',
  STYLE_VIOLATION = 'style_violation',
  PERFORMANCE_ISSUE = 'performance_issue',
  SECURITY_ISSUE = 'security_issue',
  MAINTAINABILITY_ISSUE = 'maintainability_issue',
  DOCUMENTATION_ISSUE = 'documentation_issue',
  TESTING_ISSUE = 'testing_issue',
  DUPLICATION = 'duplication',
  COMPLEXITY = 'complexity',
  NAMING = 'naming',
  UNUSED_CODE = 'unused_code'
}

/**
 * 问题严重程度枚举
 */
export enum IssueSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  HINT = 'hint'
}

/**
 * 文件特征检测器接口
 */
export interface IFileFeatureDetector {
  /**
   * 检测文件特征
   * @param content 文件内容
   * @param filePath 文件路径
   * @returns 文件特征
   */
  detectFeatures(content: string, filePath?: string): FileFeatures;
  
  /**
   * 检测语言
   * @param content 文件内容
   * @param filePath 文件路径
   * @returns 语言名称
   */
  detectLanguage(content: string, filePath?: string): string;
  
  /**
   * 检测编码
   * @param content 文件内容
   * @returns 编码格式
   */
  detectEncoding(content: string): string;
  
  /**
   * 检测换行符类型
   * @param content 文件内容
   * @returns 换行符类型
   */
  detectLineEnding(content: string): LineEndingType;
  
  /**
   * 检测缩进类型
   * @param content 文件内容
   * @returns 缩进类型和大小
   */
  detectIndentation(content: string): { type: IndentType; size: number };
}

/**
 * 复杂度分析器接口
 */
export interface IComplexityAnalyzer {
  /**
   * 分析代码复杂度
   * @param content 代码内容
   * @param language 编程语言
   * @returns 复杂度指标
   */
  analyzeComplexity(content: string, language: string): ComplexityMetrics;
  
  /**
   * 计算圈复杂度
   * @param content 代码内容
   * @param language 编程语言
   * @returns 圈复杂度
   */
  calculateCyclomaticComplexity(content: string, language: string): number;
  
  /**
   * 计算认知复杂度
   * @param content 代码内容
   * @param language 编程语言
   * @returns 认知复杂度
   */
  calculateCognitiveComplexity(content: string, language: string): number;
  
  /**
   * 分析嵌套深度
   * @param content 代码内容
   * @param language 编程语言
   * @returns 最大嵌套深度
   */
  analyzeNestingDepth(content: string, language: string): number;
}

/**
 * 代码质量分析器接口
 */
export interface ICodeQualityAnalyzer {
  /**
   * 分析代码质量
   * @param content 代码内容
   * @param language 编程语言
   * @returns 代码质量指标
   */
  analyzeQuality(content: string, language: string): CodeQualityMetrics;
  
  /**
   * 检测质量问题
   * @param content 代码内容
   * @param language 编程语言
   * @returns 质量问题列表
   */
  detectIssues(content: string, language: string): CodeQualityIssue[];
  
  /**
   * 计算质量评分
   * @param metrics 复杂度指标
   * @param issues 质量问题列表
   * @returns 质量评分
   */
  calculateQualityScore(
    metrics: ComplexityMetrics,
    issues: CodeQualityIssue[]
  ): number;
}

/**
 * 工具函数类
 */
export class FeatureUtils {
  /**
   * 创建基本文件特征
   */
  static createBasicFileFeatures(
    content: string,
    filePath?: string
  ): FileFeatures {
    const lines = content.split('\n');
    const lineCount = lines.length;
    const characterCount = content.length;
    const size = new Blob([content]).size;
    const extension = filePath ? filePath.split('.').pop()?.toLowerCase() || '' : '';
    
    // 检测换行符类型
    const lineEndingType = this.detectLineEndingType(content);
    
    // 检测缩进类型
    const { type: indentType, size: averageIndentSize } = this.detectIndentationType(content);
    
    // 检测是否为二进制文件
    const isBinary = this.isBinaryContent(content);
    
    // 检测是否包含非ASCII字符
    const hasNonASCII = /[^\x00-\x7F]/.test(content);
    
    // 检测是否包含BOM
    const hasBOM = content.charCodeAt(0) === 0xFEFF || 
                   content.charCodeAt(0) === 0xFFFE;
    
    return {
      size,
      lineCount,
      characterCount,
      isBinary,
      isText: !isBinary,
      isCode: this.isCodeContent(content, extension),
      extension,
      hasNonASCII,
      hasBOM,
      lineEndingType,
      indentType,
      averageIndentSize
    };
  }

  /**
   * 检测换行符类型
   */
  static detectLineEndingType(content: string): LineEndingType {
    const crlfCount = (content.match(/\r\n/g) || []).length;
    const lfCount = (content.match(/(?<!\r)\n/g) || []).length;
    const crCount = (content.match(/\r(?!\n)/g) || []).length;
    
    if (crlfCount > 0 && lfCount === 0 && crCount === 0) {
      return LineEndingType.CRLF;
    } else if (lfCount > 0 && crlfCount === 0 && crCount === 0) {
      return LineEndingType.LF;
    } else if (crCount > 0 && crlfCount === 0 && lfCount === 0) {
      return LineEndingType.CR;
    } else {
      return LineEndingType.MIXED;
    }
  }

  /**
   * 检测缩进类型
   */
  static detectIndentationType(content: string): { type: IndentType; size: number } {
    const lines = content.split('\n');
    const indentPatterns: string[] = [];
    
    for (const line of lines) {
      const match = line.match(/^(\s+)/);
      if (match) {
        indentPatterns.push(match[1]);
      }
    }
    
    if (indentPatterns.length === 0) {
      return { type: IndentType.NONE, size: 0 };
    }
    
    const tabCount = indentPatterns.filter(pattern => pattern.includes('\t')).length;
    const spaceCount = indentPatterns.filter(pattern => /^[ ]+$/.test(pattern)).length;
    
    let type: IndentType;
    if (tabCount > 0 && spaceCount === 0) {
      type = IndentType.TABS;
    } else if (spaceCount > 0 && tabCount === 0) {
      type = IndentType.SPACES;
    } else if (tabCount > 0 && spaceCount > 0) {
      type = IndentType.MIXED;
    } else {
      type = IndentType.NONE;
    }
    
    // 计算平均缩进大小
    const spaceIndents = indentPatterns.filter(pattern => /^[ ]+$/.test(pattern));
    const averageIndentSize = spaceIndents.length > 0 
      ? spaceIndents.reduce((sum, pattern) => sum + pattern.length, 0) / spaceIndents.length 
      : 0;
    
    return { type, size: Math.round(averageIndentSize) };
  }

  /**
   * 检测是否为二进制内容
   */
  static isBinaryContent(content: string): boolean {
    // 简单的二进制检测：检查是否包含null字节
    return content.includes('\0');
  }

  /**
   * 检测是否为代码内容
   */
  static isCodeContent(content: string, extension: string): boolean {
    // 常见代码文件扩展名
    const codeExtensions = [
      'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'hpp',
      'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt', 'scala', 'dart',
      'html', 'css', 'scss', 'less', 'xml', 'json', 'yaml', 'yml',
      'sh', 'bat', 'ps1', 'sql', 'pl', 'r', 'm', 'vue', 'svelte'
    ];
    
    if (codeExtensions.includes(extension)) {
      return true;
    }
    
    // 基于内容的检测
    const codePatterns = [
      /function\s+\w+/,
      /class\s+\w+/,
      /def\s+\w+/,
      /import\s+/,
      /export\s+/,
      /#include/,
      /using\s+/,
      /public\s+class/,
      /private\s+\w+/,
      /if\s*\(/,
      /for\s*\(/,
      /while\s*\(/,
      /var\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /const\s+\w+\s*=/
    ];
    
    return codePatterns.some(pattern => pattern.test(content));
  }

  /**
   * 创建基本语言特征
   */
  static createBasicLanguageFeatures(language: string): LanguageFeatures {
    const languageFamily = this.getLanguageFamily(language);
    
    return {
      language,
      languageFamily,
      isCompiled: this.isCompiledLanguage(language),
      isInterpreted: this.isInterpretedLanguage(language),
      isScripting: this.isScriptingLanguage(language),
      isMarkup: this.isMarkupLanguage(language),
      isStyle: this.isStyleLanguage(language),
      supportsOOP: this.supportsOOP(language),
      supportsFunctional: this.supportsFunctional(language),
      supportsAsync: this.supportsAsync(language),
      supportsGenerics: this.supportsGenerics(language),
      supportsModules: this.supportsModules(language),
      keywords: [],
      operators: [],
      commentSyntax: this.getDefaultCommentSyntax(language),
      stringSyntax: this.getDefaultStringSyntax(language)
    };
  }

  /**
   * 获取语言家族
   */
  static getLanguageFamily(language: string): LanguageFamily {
    const familyMap: Record<string, LanguageFamily> = {
      javascript: LanguageFamily.JAVASCRIPT,
      typescript: LanguageFamily.JAVASCRIPT,
      java: LanguageFamily.JAVA,
      c: LanguageFamily.C,
      cpp: LanguageFamily.C,
      csharp: LanguageFamily.C,
      python: LanguageFamily.PYTHON,
      ruby: LanguageFamily.SCRIPTING,
      php: LanguageFamily.SCRIPTING,
      perl: LanguageFamily.SCRIPTING,
      html: LanguageFamily.MARKUP,
      xml: LanguageFamily.MARKUP,
      css: LanguageFamily.STYLE,
      scss: LanguageFamily.STYLE,
      less: LanguageFamily.STYLE,
      json: LanguageFamily.DATA,
      yaml: LanguageFamily.DATA,
      yml: LanguageFamily.DATA,
      sql: LanguageFamily.DATA,
      haskell: LanguageFamily.FUNCTIONAL,
      lisp: LanguageFamily.FUNCTIONAL,
      clojure: LanguageFamily.FUNCTIONAL,
      fsharp: LanguageFamily.FUNCTIONAL
    };
    
    return familyMap[language.toLowerCase()] || LanguageFamily.UNKNOWN;
  }

  /**
   * 检测是否为编译型语言
   */
  static isCompiledLanguage(language: string): boolean {
    const compiledLanguages = [
      'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'swift', 'kotlin',
      'scala', 'dart', 'haskell', 'c', 'cpp', 'objc'
    ];
    
    return compiledLanguages.includes(language.toLowerCase());
  }

  /**
   * 检测是否为解释型语言
   */
  static isInterpretedLanguage(language: string): boolean {
    const interpretedLanguages = [
      'javascript', 'typescript', 'python', 'ruby', 'php', 'perl',
      'lua', 'bash', 'sh', 'powershell', 'r', 'matlab'
    ];
    
    return interpretedLanguages.includes(language.toLowerCase());
  }

  /**
   * 检测是否为脚本语言
   */
  static isScriptingLanguage(language: string): boolean {
    const scriptingLanguages = [
      'javascript', 'typescript', 'python', 'ruby', 'php', 'perl',
      'lua', 'bash', 'sh', 'powershell'
    ];
    
    return scriptingLanguages.includes(language.toLowerCase());
  }

  /**
   * 检测是否为标记语言
   */
  static isMarkupLanguage(language: string): boolean {
    const markupLanguages = ['html', 'xml', 'svg', 'xhtml'];
    
    return markupLanguages.includes(language.toLowerCase());
  }

  /**
   * 检测是否为样式语言
   */
  static isStyleLanguage(language: string): boolean {
    const styleLanguages = ['css', 'scss', 'sass', 'less', 'stylus'];
    
    return styleLanguages.includes(language.toLowerCase());
  }

  /**
   * 检测是否支持面向对象
   */
  static supportsOOP(language: string): boolean {
    const oopLanguages = [
      'java', 'cpp', 'csharp', 'python', 'ruby', 'php', 'javascript',
      'typescript', 'swift', 'kotlin', 'scala', 'dart', 'go'
    ];
    
    return oopLanguages.includes(language.toLowerCase());
  }

  /**
   * 检测是否支持函数式编程
   */
  static supportsFunctional(language: string): boolean {
    const functionalLanguages = [
      'javascript', 'typescript', 'python', 'haskell', 'lisp', 'clojure',
      'fsharp', 'scala', 'swift', 'kotlin', 'rust', 'go'
    ];
    
    return functionalLanguages.includes(language.toLowerCase());
  }

  /**
   * 检测是否支持异步编程
   */
  static supportsAsync(language: string): boolean {
    const asyncLanguages = [
      'javascript', 'typescript', 'python', 'csharp', 'java', 'rust',
      'go', 'swift', 'kotlin', 'dart'
    ];
    
    return asyncLanguages.includes(language.toLowerCase());
  }

  /**
   * 检测是否支持泛型
   */
  static supportsGenerics(language: string): boolean {
    const genericLanguages = [
      'java', 'cpp', 'csharp', 'typescript', 'swift', 'kotlin',
      'scala', 'dart', 'rust', 'fsharp', 'haskell'
    ];
    
    return genericLanguages.includes(language.toLowerCase());
  }

  /**
   * 检测是否支持模块系统
   */
  static supportsModules(language: string): boolean {
    const moduleLanguages = [
      'javascript', 'typescript', 'python', 'java', 'csharp', 'rust',
      'go', 'swift', 'kotlin', 'scala', 'dart', 'php'
    ];
    
    return moduleLanguages.includes(language.toLowerCase());
  }

  /**
   * 获取默认注释语法
   */
  static getDefaultCommentSyntax(language: string): CommentSyntax {
    const commentSyntaxMap: Record<string, CommentSyntax> = {
      javascript: {
        singleLine: ['//'],
        multiLineStart: '/*',
        multiLineEnd: '*/',
        docStart: '/**',
        docEnd: '*/'
      },
      typescript: {
        singleLine: ['//'],
        multiLineStart: '/*',
        multiLineEnd: '*/',
        docStart: '/**',
        docEnd: '*/'
      },
      python: {
        singleLine: ['#'],
        multiLineStart: '"""',
        multiLineEnd: '"""',
        docStart: '"""',
        docEnd: '"""'
      },
      java: {
        singleLine: ['//'],
        multiLineStart: '/*',
        multiLineEnd: '*/',
        docStart: '/**',
        docEnd: '*/'
      },
      cpp: {
        singleLine: ['//'],
        multiLineStart: '/*',
        multiLineEnd: '*/',
        docStart: '/**',
        docEnd: '*/'
      },
      csharp: {
        singleLine: ['//'],
        multiLineStart: '/*',
        multiLineEnd: '*/',
        docStart: '///',
        docEnd: ''
      },
      html: {
        singleLine: [],
        multiLineStart: '<!--',
        multiLineEnd: '-->'
      },
      css: {
        singleLine: [],
        multiLineStart: '/*',
        multiLineEnd: '*/'
      },
      sql: {
        singleLine: ['--'],
        multiLineStart: '/*',
        multiLineEnd: '*/'
      }
    };
    
    return commentSyntaxMap[language.toLowerCase()] || {
      singleLine: ['//'],
      multiLineStart: '/*',
      multiLineEnd: '*/'
    };
  }

  /**
   * 获取默认字符串语法
   */
  static getDefaultStringSyntax(language: string): StringSyntax {
    const stringSyntaxMap: Record<string, StringSyntax> = {
      javascript: {
        singleQuote: true,
        doubleQuote: true,
        backtick: true,
        rawString: false,
        multiLine: true,
        interpolation: true
      },
      typescript: {
        singleQuote: true,
        doubleQuote: true,
        backtick: true,
        rawString: false,
        multiLine: true,
        interpolation: true
      },
      python: {
        singleQuote: true,
        doubleQuote: true,
        backtick: false,
        rawString: true,
        multiLine: true,
        interpolation: false
      },
      java: {
        singleQuote: true,
        doubleQuote: true,
        backtick: false,
        rawString: false,
        multiLine: true,
        interpolation: true
      },
      cpp: {
        singleQuote: true,
        doubleQuote: true,
        backtick: false,
        rawString: true,
        multiLine: true,
        interpolation: false
      },
      csharp: {
        singleQuote: true,
        doubleQuote: true,
        backtick: true,
        rawString: true,
        multiLine: true,
        interpolation: true
      }
    };
    
    return stringSyntaxMap[language.toLowerCase()] || {
      singleQuote: true,
      doubleQuote: true,
      backtick: false,
      rawString: false,
      multiLine: false,
      interpolation: false
    };
  }
}