/**
 * 基础验证器
 * 提供通用的验证功能
 */

import { LineLocation } from './index';

/**
 * 验证结果接口
 */
export interface ValidationResult {
  /** 是否有效 */
  isValid: boolean;
  /** 错误消息 */
  errors?: string[];
  /** 警告消息 */
  warnings?: string[];
  /** 验证详情 */
  details?: Record<string, any>;
}

/**
 * 基础验证配置接口
 */
export interface BaseValidationConfig {
  /** 最小行数 */
  minLines?: number;
  /** 最大字符数 */
  maxChars?: number;
  /** 最小字符数 */
  minChars?: number;
}

/**
 * 基础验证器类
 */
export class BaseValidator {
  /**
   * 基础验证
   */
  public static validateBase(
    content: string,
    location: LineLocation,
    config: BaseValidationConfig
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const details: Record<string, any> = {};

    const {
      minLines = 1,
      maxChars = 3000,
      minChars = 1
    } = config;

    const lineCount = location.endLine - location.startLine + 1;
    const size = content.length;

    details.lineCount = lineCount;
    details.size = size;

    // 行数验证
    if (lineCount < minLines) {
      errors.push(`Too few lines: ${lineCount} < ${minLines}`);
    }

    // 字符数验证
    if (size > maxChars) {
      errors.push(`Too many characters: ${size} > ${maxChars}`);
    }

    if (size < minChars) {
      errors.push(`Too few characters: ${size} < ${minChars}`);
    }

    // 内容验证
    if (!content || content.trim().length === 0) {
      errors.push('Content is empty or whitespace only');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      details
    };
  }

  /**
   * 验证位置信息
   */
  public static validateLocation(location: LineLocation): ValidationResult {
    const errors: string[] = [];

    if (!Number.isInteger(location.startLine) || location.startLine < 1) {
      errors.push('Invalid start line: must be positive integer');
    }

    if (!Number.isInteger(location.endLine) || location.endLine < location.startLine) {
      errors.push('Invalid end line: must be positive integer >= start line');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * 验证字符串内容
   */
  public static validateContent(content: string): ValidationResult {
    const errors: string[] = [];

    if (typeof content !== 'string') {
      errors.push('Content must be a string');
      return { isValid: false, errors };
    }

    if (content.length === 0) {
      errors.push('Content cannot be empty');
    }

    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}