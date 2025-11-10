/**
 * 代码结构验证器
 * 专门验证函数、类、命名空间等代码结构
 */

import { BaseValidator, ValidationResult, BaseValidationConfig } from './BaseValidator';
import { LineLocation } from './index';
import { PythonIndentChecker } from '../../structure/PythonIndentChecker';
import { CodeChunk } from '../../../service/parser/processing/types/CodeChunk';

/**
 * 函数验证配置接口
 */
export interface FunctionValidationConfig extends BaseValidationConfig {
  /** 是否必须包含return语句 */
  requireReturn?: boolean;
  /** 是否允许空函数体 */
  allowEmptyBody?: boolean;
}

/**
 * 类验证配置接口
 */
export interface ClassValidationConfig extends BaseValidationConfig {
  /** 是否必须包含方法 */
  requireMethods?: boolean;
  /** 是否允许空类体 */
  allowEmptyBody?: boolean;
}

/**
 * 命名空间验证配置接口
 */
export interface NamespaceValidationConfig extends BaseValidationConfig {
  /** 是否必须包含导出 */
  requireExports?: boolean;
}

/**
 * 模板验证配置接口
 */
export interface TemplateValidationConfig extends BaseValidationConfig {
  /** 是否必须包含类型参数 */
  requireTypeParams?: boolean;
}

/**
 * 导入验证配置接口
 */
export interface ImportValidationConfig {
  /** 是否允许动态导入 */
  allowDynamic?: boolean;
  /** 是否必须包含路径 */
  requirePath?: boolean;
  /** 是否验证路径存在性 */
  validatePath?: boolean;
}

/**
 * Python验证配置接口
 */
export interface PythonValidationConfig extends BaseValidationConfig {
  /** 是否要求缩进一致 */
  requireConsistentIndent?: boolean;
  /** 是否允许混合缩进（空格和制表符） */
  allowMixedIndent?: boolean;
  /** 是否验证Python语法 */
  validatePythonSyntax?: boolean;
  /** 是否验证代码质量 */
  validateCodeQuality?: boolean;
  /** 最大缩进深度 */
  maxIndentDepth?: number;
  /** 是否检查函数文档字符串 */
  requireDocstrings?: boolean;
}

/**
 * 增强验证结果接口
 */
export interface EnhancedValidationResult extends ValidationResult {
  /** 缩进分析结果 */
  indentAnalysis?: {
    indentType: 'spaces' | 'tabs' | 'mixed';
    isConsistent: boolean;
    maxDepth: number;
    averageIndentSize: number;
  };
  /** Python特定验证结果 */
  pythonSpecific?: {
    hasDocstrings: boolean;
    syntaxIssues: string[];
    qualityIssues: string[];
  };
}

/**
 * 代码结构验证器
 */
export class CodeStructureValidator extends BaseValidator {
  /**
   * 验证函数是否有效
   */
  static isValidFunction(
    content: string,
    location: LineLocation,
    config: FunctionValidationConfig = {}
  ): boolean {
    const {
      minLines = 3,
      maxChars = 1000,
      minChars = 10,
      requireReturn = false,
      allowEmptyBody = false
    } = config;

    // 基础验证
    const baseResult = this.validateBase(content, location, { minLines, maxChars, minChars });
    if (!baseResult.isValid) return false;

    // 空函数体验证
    if (!allowEmptyBody && this.isEmptyFunctionBody(content)) return false;

    // Return语句验证
    if (requireReturn && !this.hasReturnStatement(content)) return false;

    return true;
  }

  /**
   * 验证类是否有效
   */
  static isValidClass(
    content: string,
    location: LineLocation,
    config: ClassValidationConfig = {}
  ): boolean {
    const {
      minLines = 2,
      maxChars = 2000,
      minChars = 10,
      requireMethods = false,
      allowEmptyBody = false
    } = config;

    // 基础验证
    const baseResult = this.validateBase(content, location, { minLines, maxChars, minChars });
    if (!baseResult.isValid) return false;

    // 空类体验证
    if (!allowEmptyBody && this.isEmptyClassBody(content)) return false;

    // 方法验证
    if (requireMethods && !this.hasMethods(content)) return false;

    return true;
  }

  /**
   * 验证命名空间是否有效
   */
  static isValidNamespace(
    content: string,
    location: LineLocation,
    config: NamespaceValidationConfig = {}
  ): boolean {
    const {
      minLines = 1,
      maxChars = 3000,
      minChars = 5,
      requireExports = false
    } = config;

    // 基础验证
    const baseResult = this.validateBase(content, location, { minLines, maxChars, minChars });
    if (!baseResult.isValid) return false;

    // 导出验证
    if (requireExports && !this.hasExports(content)) return false;

    return true;
  }

  /**
   * 验证模板是否有效
   */
  static isValidTemplate(
    content: string,
    location: LineLocation,
    config: TemplateValidationConfig = {}
  ): boolean {
    const {
      minLines = 1,
      maxChars = 1500,
      minChars = 5,
      requireTypeParams = true
    } = config;

    // 基础验证
    const baseResult = this.validateBase(content, location, { minLines, maxChars, minChars });
    if (!baseResult.isValid) return false;

    // 类型参数验证
    if (requireTypeParams && !this.hasTypeParameters(content)) return false;

    return true;
  }

  /**
   * 验证导入是否有效
   */
  static isValidImport(
    content: string,
    location: LineLocation,
    config: ImportValidationConfig = {}
  ): boolean {
    const {
      allowDynamic = true,
      requirePath = true,
      validatePath = false
    } = config;

    // 基础验证
    const baseResult = this.validateBase(content, location, { minLines: 1, minChars: 5 });
    if (!baseResult.isValid) return false;

    // 动态导入验证
    if (!allowDynamic && this.isDynamicImport(content)) return false;

    // 路径验证
    if (requirePath && !this.hasImportPath(content)) return false;

    // 路径存在性验证（简化实现）
    if (validatePath && !this.isValidImportPath(content)) return false;

    return true;
  }

  /**
   * 验证嵌套级别
   */
  static validateNestingLevel(node: any, maxLevel: number): boolean {
    if (!node || typeof node !== 'object') return false;
    
    let currentLevel = 0;
    let currentNode = node;
    
    while (currentNode && currentLevel <= maxLevel) {
      currentLevel++;
      currentNode = currentNode.parent;
    }
    
    return currentLevel <= maxLevel;
  }

  // 私有辅助方法

  /**
   * 检查是否为空函数体
   */
  private static isEmptyFunctionBody(content: string): boolean {
    const patterns = [
      /\{\s*\}/,               // {}
    ];
    
    return patterns.some(pattern => pattern.test(content));
  }

  /**
   * 检查是否包含return语句
   */
  private static hasReturnStatement(content: string): boolean {
    return /\breturn\b/.test(content);
  }

  /**
   * 检查是否为空类体
   */
  private static isEmptyClassBody(content: string): boolean {
    const patterns = [
      /\{\s*\}/,               // {}
    ];
    
    return patterns.some(pattern => pattern.test(content));
  }

  /**
   * 检查是否包含方法
   */
  private static hasMethods(content: string): boolean {
    const patterns = [
      /\b(function|func|def)\s+\w+/,
      /\w+\s*\([^)]*\)\s*[:{]/,
      /\basync\s+(function|def)\s+\w+/
    ];
    
    return patterns.some(pattern => pattern.test(content));
  }

  /**
   * 检查是否包含导出
   */
  private static hasExports(content: string): boolean {
    const patterns = [
      /\bexport\b/,
      /\bmodule\.exports\b/,
      /\bexports\./,
      /\b__export__\b/
    ];
    
    return patterns.some(pattern => pattern.test(content));
  }

  /**
   * 检查是否包含类型参数
   */
  private static hasTypeParameters(content: string): boolean {
    return /<[^>]+>/.test(content);
  }

  /**
   * 检查是否为动态导入
   */
  private static isDynamicImport(content: string): boolean {
    return /import\s*\(/.test(content);
  }

  /**
   * 检查是否包含导入路径
   */
  private static hasImportPath(content: string): boolean {
    const patterns = [
      /from\s+['"][^'"]+['"]/,  // from 'path'
      /require\s*\(['"][^'"]+['"]\)/,  // require('path')
      /import\s+['"][^'"]+['"]/,  // import 'path'
    ];
    
    return patterns.some(pattern => pattern.test(content));
  }

  /**
   * 检查导入路径是否有效（简化实现）
   */
  private static isValidImportPath(content: string): boolean {
    // 简化实现，实际应该检查文件系统
    const pathPattern = /['"]([^'"]+)['"]/;
    const match = content.match(pathPattern);
    
    if (!match) return false;
    
    const path = match[1];
    
    // 基本路径验证
    if (path.length === 0) return false;
    if (path.includes(' ')) return false;
    
    return true;
  }

  /**
   * 验证Python代码结构
   */
  static validatePythonStructure(
    content: string,
    location: LineLocation,
    config: PythonValidationConfig = {}
  ): EnhancedValidationResult {
    return this.validateStructureWithLanguage(content, location, 'python', config);
  }

  /**
   * 根据语言验证代码结构
   */
  static validateStructureWithLanguage(
    content: string,
    location: LineLocation,
    language: string,
    config: BaseValidationConfig = {}
  ): EnhancedValidationResult {
    // 根据语言选择适当的验证方法
    switch (language.toLowerCase()) {
      case 'python':
        return this.validatePythonStructureInternal(content, location, config as PythonValidationConfig);
      
      case 'javascript':
      case 'typescript':
        return this.validateJSTypeScriptStructure(content, location, config);
      
      case 'java':
        return this.validateJavaStructure(content, location, config);
      
      case 'cpp':
      case 'c++':
        return this.validateCppStructure(content, location, config);
      
      default:
        // 对于未知语言，使用通用验证
        return this.validateGenericStructure(content, location, config);
    }
  }

  /**
   * 从CodeChunk验证代码结构
   */
  static validateStructureFromChunk(
    chunk: CodeChunk,
    config: BaseValidationConfig = {}
  ): EnhancedValidationResult {
    const location = {
      startLine: chunk.metadata.startLine,
      endLine: chunk.metadata.endLine
    };
    
    return this.validateStructureWithLanguage(
      chunk.content,
      location,
      chunk.metadata.language,
      config
    );
  }

  /**
   * Python代码结构内部验证方法
   */
  private static validatePythonStructureInternal(
    content: string,
    location: LineLocation,
    config: PythonValidationConfig = {}
  ): EnhancedValidationResult {
    const {
      minLines = 1,
      maxChars = 3000,
      minChars = 1,
      requireConsistentIndent = true,
      allowMixedIndent = false,
      validatePythonSyntax = true,
      validateCodeQuality = true,
      maxIndentDepth = 8,
      requireDocstrings = false
    } = config;

    const errors: string[] = [];
    const warnings: string[] = [];
    const details: Record<string, any> = {};

    // 基础验证
    const baseResult = this.validateBase(content, location, { minLines, maxChars, minChars });
    if (!baseResult.isValid) {
      errors.push(...(baseResult.errors || []));
    }
    warnings.push(...(baseResult.warnings || []));
    Object.assign(details, baseResult.details || {});

    // 缩进验证
    const indentResult = this.validatePythonIndent(content, {
      requireConsistent: requireConsistentIndent,
      allowMixed: allowMixedIndent,
      maxDepth: maxIndentDepth
    });

    if (!indentResult.isValid) {
      errors.push(...(indentResult.errors || []));
    }
    warnings.push(...(indentResult.warnings || []));

    // Python语法验证
    let syntaxIssues: string[] = [];
    if (validatePythonSyntax) {
      const syntaxResult = this.validatePythonSyntax(content);
      if (!syntaxResult.isValid) {
        errors.push(...(syntaxResult.errors || []));
      }
      syntaxIssues = syntaxResult.errors || [];
    }

    // 代码质量验证
    let qualityIssues: string[] = [];
    if (validateCodeQuality) {
      const qualityResult = this.validatePythonQuality(content, { requireDocstrings });
      if (!qualityResult.isValid) {
        warnings.push(...(qualityResult.errors || []));
      }
      qualityIssues = qualityResult.errors || [];
    }

    // 检查文档字符串
    const hasDocstrings = this.checkPythonDocstrings(content);

    // 构建增强验证结果
    const enhancedResult: EnhancedValidationResult = {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      details,
      indentAnalysis: {
        indentType: indentResult.details?.indentType || 'spaces',
        isConsistent: indentResult.details?.isConsistent || false,
        maxDepth: indentResult.details?.maxDepth || 0,
        averageIndentSize: indentResult.details?.averageIndentSize || 0
      },
      pythonSpecific: {
        hasDocstrings,
        syntaxIssues,
        qualityIssues
      }
    };

    return enhancedResult;
  }

  /**
   * 验证JavaScript/TypeScript代码结构
   */
  private static validateJSTypeScriptStructure(
    content: string,
    location: LineLocation,
    config: BaseValidationConfig = {}
  ): EnhancedValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: Record<string, any> = {};

    // 基础验证
    const baseResult = this.validateBase(content, location, config);
    if (!baseResult.isValid) {
      errors.push(...(baseResult.errors || []));
    }
    warnings.push(...(baseResult.warnings || []));
    Object.assign(details, baseResult.details || {});

    // JavaScript/TypeScript特定验证
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // 检查未闭合的括号
      const openBrackets = (line.match(/\(/g) || []).length;
      const closeBrackets = (line.match(/\)/g) || []).length;
      if (openBrackets !== closeBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched parentheses`);
      }

      // 检查未闭合的方括号
      const openSquareBrackets = (line.match(/\[/g) || []).length;
      const closeSquareBrackets = (line.match(/\]/g) || []).length;
      if (openSquareBrackets !== closeSquareBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched square brackets`);
      }

      // 检查未闭合的花括号
      const openCurlyBrackets = (line.match(/\{/g) || []).length;
      const closeCurlyBrackets = (line.match(/\}/g) || []).length;
      if (openCurlyBrackets !== closeCurlyBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched curly brackets`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      details
    };
  }

  /**
   * 验证Java代码结构
   */
  private static validateJavaStructure(
    content: string,
    location: LineLocation,
    config: BaseValidationConfig = {}
  ): EnhancedValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: Record<string, any> = {};

    // 基础验证
    const baseResult = this.validateBase(content, location, config);
    if (!baseResult.isValid) {
      errors.push(...(baseResult.errors || []));
    }
    warnings.push(...(baseResult.warnings || []));
    Object.assign(details, baseResult.details || {});

    // Java特定验证
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // 检查未闭合的括号
      const openBrackets = (line.match(/\(/g) || []).length;
      const closeBrackets = (line.match(/\)/g) || []).length;
      if (openBrackets !== closeBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched parentheses`);
      }

      // 检查未闭合的方括号
      const openSquareBrackets = (line.match(/\[/g) || []).length;
      const closeSquareBrackets = (line.match(/\]/g) || []).length;
      if (openSquareBrackets !== closeSquareBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched square brackets`);
      }

      // 检查未闭合的花括号
      const openCurlyBrackets = (line.match(/\{/g) || []).length;
      const closeCurlyBrackets = (line.match(/\}/g) || []).length;
      if (openCurlyBrackets !== closeCurlyBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched curly brackets`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      details
    };
  }

  /**
   * 验证C++代码结构
   */
  private static validateCppStructure(
    content: string,
    location: LineLocation,
    config: BaseValidationConfig = {}
  ): EnhancedValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: Record<string, any> = {};

    // 基础验证
    const baseResult = this.validateBase(content, location, config);
    if (!baseResult.isValid) {
      errors.push(...(baseResult.errors || []));
    }
    warnings.push(...(baseResult.warnings || []));
    Object.assign(details, baseResult.details || {});

    // C++特定验证
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // 检查未闭合的括号
      const openBrackets = (line.match(/\(/g) || []).length;
      const closeBrackets = (line.match(/\)/g) || []).length;
      if (openBrackets !== closeBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched parentheses`);
      }

      // 检查未闭合的方括号
      const openSquareBrackets = (line.match(/\[/g) || []).length;
      const closeSquareBrackets = (line.match(/\]/g) || []).length;
      if (openSquareBrackets !== closeSquareBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched square brackets`);
      }

      // 检查未闭合的花括号
      const openCurlyBrackets = (line.match(/\{/g) || []).length;
      const closeCurlyBrackets = (line.match(/\}/g) || []).length;
      if (openCurlyBrackets !== closeCurlyBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched curly brackets`);
      }

      // 检查未闭合的尖括号（模板）
      const openAngleBrackets = (line.match(/</g) || []).length;
      const closeAngleBrackets = (line.match(/>/g) || []).length;
      if (openAngleBrackets !== closeAngleBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched angle brackets`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      details
    };
  }

  /**
   * 通用代码结构验证
   */
  private static validateGenericStructure(
    content: string,
    location: LineLocation,
    config: BaseValidationConfig = {}
  ): EnhancedValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: Record<string, any> = {};

    // 基础验证
    const baseResult = this.validateBase(content, location, config);
    if (!baseResult.isValid) {
      errors.push(...(baseResult.errors || []));
    }
    warnings.push(...(baseResult.warnings || []));
    Object.assign(details, baseResult.details || {});

    // 通用验证：检查括号匹配
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // 检查未闭合的括号
      const openBrackets = (line.match(/\(/g) || []).length;
      const closeBrackets = (line.match(/\)/g) || []).length;
      if (openBrackets !== closeBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched parentheses`);
      }

      // 检查未闭合的方括号
      const openSquareBrackets = (line.match(/\[/g) || []).length;
      const closeSquareBrackets = (line.match(/\]/g) || []).length;
      if (openSquareBrackets !== closeSquareBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched square brackets`);
      }

      // 检查未闭合的花括号
      const openCurlyBrackets = (line.match(/\{/g) || []).length;
      const closeCurlyBrackets = (line.match(/\}/g) || []).length;
      if (openCurlyBrackets !== closeCurlyBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched curly brackets`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      details
    };
  }

  /**
   * 验证Python缩进
   */
  private static validatePythonIndent(
    content: string,
    config: { requireConsistent: boolean; allowMixed: boolean; maxDepth: number }
  ): ValidationResult {
    const { requireConsistent, allowMixed, maxDepth } = config;
    const errors: string[] = [];
    const warnings: string[] = [];

    const indentStructure = PythonIndentChecker.calculateIndentStructure(content);

    // 检查缩进一致性
    if (requireConsistent && !indentStructure.isConsistent) {
      errors.push('Python code has inconsistent indentation');
    }

    // 检查混合缩进
    if (!allowMixed && indentStructure.indentType === 'mixed') {
      errors.push('Python code uses mixed indentation (spaces and tabs)');
    }

    // 检查缩进深度
    if (indentStructure.maxDepth > maxDepth) {
      warnings.push(`Python code has deep nesting (${indentStructure.maxDepth} levels, max recommended: ${maxDepth})`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      details: {
        indentType: indentStructure.indentType,
        isConsistent: indentStructure.isConsistent,
        maxDepth: indentStructure.maxDepth,
        averageIndentSize: indentStructure.averageIndentSize
      }
    };
  }

  /**
   * 验证Python语法
   */
  private static validatePythonSyntax(content: string): ValidationResult {
    const errors: string[] = [];

    // 检查常见的Python语法错误
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // 跳过空行和注释
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return;
      }

      // 检查是否缺少冒号
      const keywordPatterns = [
        /^\s*if\s+[^:]+$/,
        /^\s*elif\s+[^:]+$/,
        /^\s*for\s+[^:]+$/,
        /^\s*while\s+[^:]+$/,
        /^\s*try\s*$/,
        /^\s*except\s+[^:]+$/,
        /^\s*finally\s*$/,
        /^\s*with\s+[^:]+$/,
        /^\s*def\s+\w+\s*\([^)]*\)$/,
        /^\s*class\s+\w+\s*(\([^)]*\))?$/
      ];

      const hasMissingColon = keywordPatterns.some(pattern => pattern.test(trimmedLine));
      if (hasMissingColon) {
        errors.push(`Line ${lineNumber}: Missing colon at end of statement`);
      }

      // 检查冒号后是否有内容
      if (/:/.test(trimmedLine) && !trimmedLine.endsWith(':')) {
        // 检查是否是单行if/for/while/try/def/class语句
        const singleLinePatterns = [
          /^\s*if\s+.*:\s*.*$/,
          /^\s*for\s+.*:\s*.*$/,
          /^\s*while\s+.*:\s*.*$/,
          /^\s*try\s*:\s*.*$/,
          /^\s*def\s+.*:\s*.*$/,
          /^\s*class\s+.*:\s*.*$/,
          /^\s*elif\s+.*:\s*.*$/,
          /^\s*except\s+.*:\s*.*$/,
          /^\s*finally\s*:\s*.*$/,
          /^\s*with\s+.*:\s*.*$/
        ];

        const isSingleLineStatement = singleLinePatterns.some(pattern => pattern.test(trimmedLine));
        if (!isSingleLineStatement) {
          errors.push(`Line ${lineNumber}: Statement with colon should be on its own line`);
        }
      }

      // 检查未闭合的括号
      const openBrackets = (line.match(/\(/g) || []).length;
      const closeBrackets = (line.match(/\)/g) || []).length;
      if (openBrackets !== closeBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched parentheses`);
      }

      // 检查未闭合的方括号
      const openSquareBrackets = (line.match(/\[/g) || []).length;
      const closeSquareBrackets = (line.match(/\]/g) || []).length;
      if (openSquareBrackets !== closeSquareBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched square brackets`);
      }

      // 检查未闭合的花括号
      const openCurlyBrackets = (line.match(/\{/g) || []).length;
      const closeCurlyBrackets = (line.match(/\}/g) || []).length;
      if (openCurlyBrackets !== closeCurlyBrackets) {
        errors.push(`Line ${lineNumber}: Unmatched curly brackets`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 验证Python代码质量
   */
  private static validatePythonQuality(
    content: string,
    config: { requireDocstrings: boolean }
  ): ValidationResult {
    const { requireDocstrings } = config;
    const errors: string[] = [];

    // 检查函数和类是否有文档字符串
    if (requireDocstrings) {
      const hasDocstrings = this.checkPythonDocstrings(content);
      if (!hasDocstrings) {
        errors.push('Functions or classes should have docstrings');
      }
    }

    // 检查行长度（PEP 8建议不超过79字符）
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      if (line.length > 79) {
        errors.push(`Line ${lineNumber}: Line too long (${line.length} characters, max recommended: 79)`);
      }
    });

    // 检查是否有多个空行
    let consecutiveEmptyLines = 0;
    lines.forEach((line, index) => {
      if (line.trim() === '') {
        consecutiveEmptyLines++;
        if (consecutiveEmptyLines > 2) {
          errors.push(`Line ${index + 1}: Too many consecutive empty lines`);
        }
      } else {
        consecutiveEmptyLines = 0;
      }
    });

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 检查Python代码是否有文档字符串
   */
  private static checkPythonDocstrings(content: string): boolean {
    // 查找函数和类定义
    const functionPattern = /^\s*def\s+\w+/gm;
    const classPattern = /^\s*class\s+\w+/gm;

    const functions = content.match(functionPattern) || [];
    const classes = content.match(classPattern) || [];

    // 如果没有函数或类，认为不需要文档字符串
    if (functions.length === 0 && classes.length === 0) {
      return true;
    }

    // 检查是否有文档字符串
    const docstringPattern = /("""[\s\S]*?"""|'''[\s\S]*?''')/;
    return docstringPattern.test(content);
  }
}