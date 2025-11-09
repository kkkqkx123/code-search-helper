/**
 * 处理上下文接口
 * 定义了代码处理过程中所需的上下文信息
 */
import { LanguageClassificationUtils } from '../../../constants/language-classification';
import { CommentSyntaxUtils } from '../../../constants/comment-syntax';

export interface IProcessingContext {
  /** 要处理的代码内容 */
  content: string;

  /** 编程语言 */
  language: string;

  /** 文件路径（可选） */
  filePath?: string;

  /** 处理配置 */
  config: ProcessingConfig;

  /** 文件特征信息 */
  features: FileFeatures;

  /** 上下文元数据 */
  metadata: ContextMetadata;

  /** AST节点（如果可用） */
  ast?: any;

  /** 节点跟踪器（如果可用） */
  nodeTracker?: any;

  /** 额外的上下文数据 */
  [key: string]: any;
}

/**
 * 文件特征接口
 */
export interface FileFeatures {
  /** 文件大小（字节） */
  size: number;

  /** 行数 */
  lineCount: number;

  /** 是否为小文件 */
  isSmallFile: boolean;

  /** 是否为代码文件 */
  isCodeFile: boolean;

  /** 是否为结构化文件 */
  isStructuredFile: boolean;

  /** 复杂度评分 */
  complexity: number;

  /** 是否包含导入语句 */
  hasImports: boolean;

  /** 是否包含导出语句 */
  hasExports: boolean;

  /** 是否包含函数定义 */
  hasFunctions: boolean;

  /** 是否包含类定义 */
  hasClasses: boolean;

  /** 语言特定特征 */
  languageFeatures?: Record<string, any>;
}

/**
 * 上下文元数据接口
 */
export interface ContextMetadata {
  /** 内容长度 */
  contentLength: number;

  /** 行数 */
  lineCount: number;

  /** 文件大小 */
  size: number;

  /** 是否为小文件 */
  isSmallFile: boolean;

  /** 是否为代码文件 */
  isCodeFile: boolean;

  /** 是否为结构化文件 */
  isStructuredFile: boolean;

  /** 复杂度 */
  complexity: number;

  /** 是否有导入 */
  hasImports: boolean;

  /** 是否有导出 */
  hasExports: boolean;

  /** 是否有函数 */
  hasFunctions: boolean;

  /** 是否有类 */
  hasClasses: boolean;

  /** 创建时间戳 */
  timestamp: number;

  /** 额外的元数据 */
  [key: string]: any;
}

/**
 * 文件特征接口（详细版本）
 */
export interface DetailedFileFeatures {
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

// 从独立文件导入 LanguageFamily 枚举
import { LanguageFamily } from '../../../constants/language-family';

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
 * 工具函数类
 */
export class FeatureUtils {
  /**
   * 创建基本文件特征
   */
  static createBasicFileFeatures(
    content: string,
    filePath?: string
  ): DetailedFileFeatures {
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
    const crlfCount = (content.match(/\\r\\n/g) || []).length;
    const lfCount = (content.match(/(?<!\\r)\\n/g) || []).length;
    const crCount = (content.match(/\\r(?!\\n)/g) || []).length;

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
      const match = line.match(/^(\\s+)/);
      if (match) {
        indentPatterns.push(match[1]);
      }
    }

    if (indentPatterns.length === 0) {
      return { type: IndentType.NONE, size: 0 };
    }

    const tabCount = indentPatterns.filter(pattern => pattern.includes('\\t')).length;
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
    return content.includes('\\0');
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
    const languageFamily = LanguageClassificationUtils.getLanguageFamily(language);

    return {
      language,
      languageFamily,
      isCompiled: LanguageClassificationUtils.isCompiledLanguage(language),
      isInterpreted: LanguageClassificationUtils.isInterpretedLanguage(language),
      isScripting: LanguageClassificationUtils.isScriptingLanguage(language),
      isMarkup: LanguageClassificationUtils.isMarkupLanguage(language),
      isStyle: LanguageClassificationUtils.isStyleLanguage(language),
      supportsOOP: LanguageClassificationUtils.supportsOOP(language),
      supportsFunctional: LanguageClassificationUtils.supportsFunctional(language),
      supportsAsync: LanguageClassificationUtils.supportsAsync(language),
      supportsGenerics: LanguageClassificationUtils.supportsGenerics(language),
      supportsModules: LanguageClassificationUtils.supportsModules(language),
      keywords: [],
      operators: [],
      commentSyntax: CommentSyntaxUtils.getDefaultCommentSyntax(language),
      stringSyntax: this.getDefaultStringSyntax(language)
    };
  }

  /**
   * 获取语言家族

  /**
   * 获取默认注释语法

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

// 导入相关类型，避免循环依赖
import type { ProcessingConfig } from '../types/ConfigTypes';