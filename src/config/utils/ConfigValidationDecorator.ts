import * as Joi from 'joi';
import { ValidationUtils } from './ValidationUtils';

/**
 * 配置验证装饰器
 * 提供基于装饰器的配置验证机制
 * 进一步简化配置验证
 */
export class ConfigValidationDecorator {
  /**
   * 验证配置对象
   * @param target 配置对象
   * @param schemaMap 模式映射
   * @returns 验证后的配置对象
   */
  static validate<T extends Record<string, any>>(target: T, schemaMap: Record<string, Joi.Schema>): T {
    const schema = Joi.object(schemaMap);
    return ValidationUtils.validateConfig(target, schema);
  }

  /**
   * 创建必填字符串验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static requiredString(defaultValue?: string) {
    return defaultValue !== undefined
      ? Joi.string().required().default(defaultValue)
      : Joi.string().required();
  }

  /**
   * 创建可选字符串验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static optionalString(defaultValue?: string) {
    return defaultValue !== undefined
      ? Joi.string().optional().default(defaultValue)
      : Joi.string().optional();
  }

  /**
   * 创建必填数字验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static requiredNumber(defaultValue?: number) {
    return defaultValue !== undefined
      ? Joi.number().required().default(defaultValue)
      : Joi.number().required();
  }

  /**
   * 创建可选数字验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static optionalNumber(defaultValue?: number) {
    return defaultValue !== undefined
      ? Joi.number().optional().default(defaultValue)
      : Joi.number().optional();
  }

  /**
   * 创建必填布尔验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static requiredBoolean(defaultValue?: boolean) {
    return defaultValue !== undefined
      ? Joi.boolean().required().default(defaultValue)
      : Joi.boolean().required();
  }

  /**
   * 创建可选布尔验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static optionalBoolean(defaultValue?: boolean) {
    return defaultValue !== undefined
      ? Joi.boolean().optional().default(defaultValue)
      : Joi.boolean().optional();
  }

  /**
   * 创建端口验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static port(defaultValue?: number) {
    return defaultValue !== undefined
      ? Joi.number().port().default(defaultValue)
      : Joi.number().port();
  }

  /**
   * 创建正数验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static positiveNumber(defaultValue?: number) {
    return defaultValue !== undefined
      ? Joi.number().positive().default(defaultValue)
      : Joi.number().positive();
  }

  /**
   * 创建范围数字验证模式
   * @param min 最小值
   * @param max 最大值
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static rangeNumber(min: number, max: number, defaultValue?: number) {
    return defaultValue !== undefined
      ? Joi.number().min(min).max(max).default(defaultValue)
      : Joi.number().min(min).max(max);
  }

  /**
   * 创建URI验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static uri(defaultValue?: string) {
    return defaultValue !== undefined
      ? Joi.string().uri().default(defaultValue)
      : Joi.string().uri();
  }

  /**
   * 创建枚举验证模式
   * @param allowedValues 允许的值列表
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static enum<T extends string>(allowedValues: readonly T[], defaultValue?: T) {
    return defaultValue !== undefined
      ? Joi.string().valid(...allowedValues).default(defaultValue)
      : Joi.string().valid(...allowedValues);
  }
}