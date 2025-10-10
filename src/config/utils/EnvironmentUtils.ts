import { injectable } from 'inversify';

/**
 * 环境变量解析工具类
 * 提供统一的环境变量解析和验证方法
 * 遵循 DRY 原则，减少重复代码
 */
@injectable()
export class EnvironmentUtils {
  /**
   * 解析字符串类型的环境变量
   * @param key 环境变量键名
   * @param defaultValue 默认值
   * @returns 解析后的字符串值
   */
  static parseString(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
  }

  /**
   * 解析数字类型的环境变量
   * @param key 环境变量键名
   * @param defaultValue 默认值
   * @returns 解析后的数字值
   */
  static parseNumber(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) {
      return defaultValue;
    }
    
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * 解析浮点数类型的环境变量
   * @param key 环境变量键名
   * @param defaultValue 默认值
   * @returns 解析后的浮点数值
   */
  static parseFloat(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) {
      return defaultValue;
    }
    
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * 解析布尔类型的环境变量
   * @param key 环境变量键名
   * @param defaultValue 默认值
   * @returns 解析后的布尔值
   */
  static parseBoolean(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (!value) {
      return defaultValue;
    }
    
    return value === 'true' ? true : value === 'false' ? false : defaultValue;
  }

  /**
   * 解析可选字符串类型的环境变量
   * @param key 环境变量键名
   * @returns 解析后的字符串值或undefined
   */
  static parseOptionalString(key: string): string | undefined {
    return process.env[key] || undefined;
  }

  /**
   * 解析可选数字类型的环境变量
   * @param key 环境变量键名
   * @returns 解析后的数字值或undefined
   */
  static parseOptionalNumber(key: string): number | undefined {
    const value = process.env[key];
    if (!value) {
      return undefined;
    }
    
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  }

  /**
   * 解析可选布尔类型的环境变量
   * @param key 环境变量键名
   * @returns 解析后的布尔值或undefined
   */
  static parseOptionalBoolean(key: string): boolean | undefined {
    const value = process.env[key];
    if (!value) {
      return undefined;
    }
    
    return value === 'true' ? true : value === 'false' ? false : undefined;
  }

  /**
   * 检查特定嵌入器提供者是否被禁用
   * @param provider 提供者名称
   * @returns 如果提供者被禁用则返回true，否则返回false
   */
  static isEmbeddingProviderDisabled(provider: string): boolean {
    // 将提供者名称转换为环境变量格式
    const envVarName = `${provider.toUpperCase()}_ENABLED`;
    const envValue = process.env[envVarName];
    
    // 如果环境变量未设置，默认为启用（false）
    if (envValue === undefined) {
      return false;
    }
    
    // 如果环境变量设置为 'false'，则提供者被禁用
    return envValue === 'false';
  }

  /**
   * 验证环境变量值是否在允许的值列表中
   * @param key 环境变量键名
   * @param allowedValues 允许的值列表
   * @param defaultValue 默认值
   * @returns 验证后的值
   */
  static validateEnum<T extends string>(
    key: string,
    allowedValues: readonly T[],
    defaultValue: T
  ): T {
    const value = process.env[key] as T | undefined;
    
    if (!value) {
      return defaultValue;
    }
    
    return allowedValues.includes(value) ? value : defaultValue;
  }

  /**
   * 解析端口类型的环境变量
   * @param key 环境变量键名
   * @param defaultValue 默认值
   * @returns 解析后的端口号
   */
  static parsePort(key: string, defaultValue: number): number {
    const value = process.env[key];
    if (!value) {
      return defaultValue;
    }
    
    const parsed = parseInt(value, 10);
    return isNaN(parsed) || parsed < 1 || parsed > 65535 ? defaultValue : parsed;
  }
}