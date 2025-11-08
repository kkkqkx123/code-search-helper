/**
 * 代码结构验证器
 * 专门验证函数、类、命名空间等代码结构
 */

import { BaseValidator, ValidationResult, BaseValidationConfig } from './BaseValidator';
import { LineLocation } from './index';

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
}