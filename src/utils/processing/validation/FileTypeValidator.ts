/**
 * 文件类型验证器
 * 专门验证不同文件类型的结构和内容
 */

import { BaseValidator, ValidationResult } from './BaseValidator';
import { LineLocation } from './index';

/**
 * 语义边界类型枚举
 */
export enum SemanticBoundaryType {
  FUNCTION = 'function',
  CLASS = 'class',
  MODULE = 'module',
  BLOCK = 'block',
  SCOPE = 'scope'
}

/**
 * 处理上下文接口
 */
export interface IProcessingContext {
  /** 文件路径 */
  filePath?: string;
  /** 编程语言 */
  language?: string;
  /** 文件内容 */
  content?: string;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 验证需求接口
 */
export interface ValidationRequirements {
  /** 必需的块类型 */
  requiredTypes?: string[];
  /** 禁止的块类型 */
  forbiddenTypes?: string[];
  /** 最小复杂度 */
  minComplexity?: number;
  /** 最大复杂度 */
  maxComplexity?: number;
  /** 自定义验证函数 */
  customValidators?: Array<(content: string, location: LineLocation) => boolean>;
}

/**
 * 文件类型验证器
 */
export class FileTypeValidator extends BaseValidator {
  /**
   * 验证是否为代码文件
   */
  static isCodeFile(language: string): boolean {
    const codeLanguages = [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
      'scala', 'haskell', 'lua', 'perl', 'r', 'matlab'
    ];
    
    return codeLanguages.includes(language.toLowerCase());
  }

  /**
   * 验证是否具有Markdown结构
   */
  static hasMarkdownStructure(content: string): boolean {
    const markdownPatterns = [
      /^#{1,6}\s+/m,           // 标题
      /^\*{1,3}.+$/m,          // 列表
      /^\d+\.\s+/m,            // 有序列表
      /```[\s\S]*?```/,        // 代码块
      /^\|.*\|$/m,             // 表格
      /^\[.*\]\(.*\)$/m        // 链接
    ];
    
    return markdownPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 验证是否具有XML结构
   */
  static hasXmlStructure(content: string): boolean {
    const xmlPatterns = [
      /<[^>]+>/,               // 标签
      /<\/[^>]+>/,             // 闭合标签
      /<[^>]+\/>/,             // 自闭合标签
      /<\?xml.*\?>/,           // XML声明
      /<!--.*-->/              // 注释
    ];
    
    return xmlPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 验证是否具有JSON结构
   */
  static hasJsonStructure(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证是否具有YAML结构
   */
  static hasYamlStructure(content: string): boolean {
    const yamlPatterns = [
      /^\s*[\w-]+:\s*.*$/m,    // 键值对
      /^\s*-\s+.*$/m,          // 列表项
      /^\s*#[^#]*$/m,          // 注释
      /^\s*\w+:\s*\n\s+/m      // 嵌套结构
    ];
    
    return yamlPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 验证语义边界
   */
  static validateSemanticBoundary(
    content: string, 
    boundaryType: SemanticBoundaryType
  ): boolean {
    switch (boundaryType) {
      case SemanticBoundaryType.FUNCTION:
        return this.hasFunctionBoundary(content);
      case SemanticBoundaryType.CLASS:
        return this.hasClassBoundary(content);
      case SemanticBoundaryType.MODULE:
        return this.hasModuleBoundary(content);
      case SemanticBoundaryType.BLOCK:
        return this.hasBlockBoundary(content);
      case SemanticBoundaryType.SCOPE:
        return this.hasScopeBoundary(content);
      default:
        return false;
    }
  }

  /**
   * 验证处理上下文
   */
  static validateContext(
    context: IProcessingContext, 
    requirements: ValidationRequirements
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: Record<string, any> = {};

    // 验证必需字段
    if (!context.content) {
      errors.push('Content is required');
    }

    if (!context.language) {
      errors.push('Language is required');
    }

    // 验证内容长度
    if (context.content) {
      const lineCount = context.content.split('\n').length;
      details.lineCount = lineCount;
      details.contentLength = context.content.length;

      if (requirements.minComplexity && lineCount < requirements.minComplexity) {
        errors.push(`Content too simple: ${lineCount} lines < ${requirements.minComplexity}`);
      }

      if (requirements.maxComplexity && lineCount > requirements.maxComplexity) {
        warnings.push(`Content too complex: ${lineCount} lines > ${requirements.maxComplexity}`);
      }
    }

    // 自定义验证器
    if (requirements.customValidators && context.content) {
      for (const validator of requirements.customValidators) {
        try {
          const location = {
            startLine: 1,
            endLine: context.content!.split('\n').length
          };
          if (!validator(context.content, location)) {
            errors.push('Custom validation failed');
          }
        } catch (error) {
          warnings.push(`Custom validator error: ${error}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      details
    };
  }

  /**
   * 验证结构是否有效（通用方法）
   */
  static isValidStructure(structure: any): boolean {
    if (!structure || typeof structure !== 'object') return false;
    
    // 检查必需属性
    if (!structure.type || !structure.content || !structure.location) return false;
    
    // 检查位置信息
    const { startLine, endLine } = structure.location;
    if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) return false;
    if (startLine < 1 || endLine < startLine) return false;
    
    // 检查内容
    if (typeof structure.content !== 'string' || structure.content.trim().length === 0) return false;
    
    return true;
  }

  /**
   * 检测文件类型
   */
  static detectFileType(content: string, language?: string): string {
    // 如果提供了语言信息，优先使用
    if (language) {
      if (this.isCodeFile(language)) return 'code';
      if (language.includes('markdown') || language.includes('md')) return 'markdown';
      if (language.includes('xml') || language.includes('html')) return 'xml';
      if (language.includes('json')) return 'json';
      if (language.includes('yaml') || language.includes('yml')) return 'yaml';
    }

    // 基于内容检测
    if (this.hasJsonStructure(content)) return 'json';
    if (this.hasYamlStructure(content)) return 'yaml';
    if (this.hasMarkdownStructure(content)) return 'markdown';
    if (this.hasXmlStructure(content)) return 'xml';
    
    // 默认为代码文件
    return 'code';
  }

  // 私有辅助方法

  /**
   * 检查是否具有函数边界
   */
  private static hasFunctionBoundary(content: string): boolean {
    const patterns = [
      /\b(function|func|def)\s+\w+/,
      /\w+\s*\([^)]*\)\s*[:{]/,
      /\basync\s+(function|def)\s+\w+/
    ];
    
    return patterns.some(pattern => pattern.test(content));
  }

  /**
   * 检查是否具有类边界
   */
  private static hasClassBoundary(content: string): boolean {
    const patterns = [
      /\bclass\s+\w+/,
      /\binterface\s+\w+/,
      /\bstruct\s+\w+/,
      /\benum\s+\w+/
    ];
    
    return patterns.some(pattern => pattern.test(content));
  }

  /**
   * 检查是否具有模块边界
   */
  private static hasModuleBoundary(content: string): boolean {
    const patterns = [
      /\bmodule\s+\w+/,
      /\bnamespace\s+\w+/,
      /\bpackage\s+\w+/
    ];
    
    return patterns.some(pattern => pattern.test(content));
  }

  /**
   * 检查是否具有块边界
   */
  private static hasBlockBoundary(content: string): boolean {
    return /\{[^}]*\}/.test(content);
  }

  /**
   * 检查是否具有作用域边界
   */
  private static hasScopeBoundary(content: string): boolean {
    const patterns = [
      /\{[^}]*\}/,              // 大括号
      /\([^)]*\)/,              // 圆括号
      /\[[^\]]*\]/              // 方括号
    ];
    
    return patterns.some(pattern => pattern.test(content));
  }
}