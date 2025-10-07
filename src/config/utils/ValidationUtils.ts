import * as Joi from 'joi';

/**
 * 配置验证工具类
 * 提供通用的Joi验证模式和验证方法
 * 遵循 DRY 原则，减少重复代码
 */
export class ValidationUtils {
  /**
   * 创建端口验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static portSchema(defaultValue: number) {
    return Joi.number().port().default(defaultValue);
  }

  /**
   * 创建正数验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static positiveNumberSchema(defaultValue: number) {
    return Joi.number().positive().default(defaultValue);
  }

  /**
   * 创建可选正数验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static optionalPositiveNumberSchema(defaultValue?: number) {
    const schema = Joi.number().positive();
    return defaultValue !== undefined ? schema.default(defaultValue) : schema.optional();
  }

  /**
   * 创建布尔验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static booleanSchema(defaultValue: boolean) {
    return Joi.boolean().default(defaultValue);
  }

  /**
   * 创建字符串枚举验证模式
   * @param allowedValues 允许的值列表
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static enumSchema<T extends string>(allowedValues: readonly T[], defaultValue: T) {
    return Joi.string().valid(...allowedValues).default(defaultValue);
  }

  /**
   * 创建可选字符串验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static optionalStringSchema(defaultValue?: string) {
    const schema = Joi.string();
    return defaultValue !== undefined ? schema.default(defaultValue) : schema.optional();
  }

  /**
   * 创建URI验证模式
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static uriSchema(defaultValue?: string) {
    const schema = Joi.string().uri();
    return defaultValue !== undefined ? schema.default(defaultValue) : schema.optional();
  }

  /**
   * 创建范围数字验证模式
   * @param min 最小值
   * @param max 最大值
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static rangeNumberSchema(min: number, max: number, defaultValue: number) {
    return Joi.number().min(min).max(max).default(defaultValue);
  }

  /**
   * 创建可选范围数字验证模式
   * @param min 最小值
   * @param max 最大值
   * @param defaultValue 默认值
   * @returns Joi验证模式
   */
  static optionalRangeNumberSchema(min: number, max: number, defaultValue?: number) {
    const schema = Joi.number().min(min).max(max);
    return defaultValue !== undefined ? schema.default(defaultValue) : schema.optional();
  }

  /**
   * 验证配置对象
   * @param config 配置对象
   * @param schema Joi验证模式
   * @returns 验证后的配置对象
   */
  static validateConfig<T>(config: any, schema: Joi.ObjectSchema<T>): T {
    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Config validation error: ${error.message}`);
    }
    return value;
  }

  /**
   * 创建嵌套对象验证模式
   * @param schemaMap 模式映射
   * @returns Joi验证模式
   */
  static objectSchema(schemaMap: Joi.SchemaMap) {
    return Joi.object(schemaMap);
  }

  /**
   * 创建可选嵌套对象验证模式
   * @param schemaMap 模式映射
   * @returns Joi验证模式
   */
  static optionalObjectSchema(schemaMap: Joi.SchemaMap) {
    return Joi.object(schemaMap).optional();
  }
}