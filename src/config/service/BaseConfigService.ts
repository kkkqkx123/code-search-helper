import { injectable } from 'inversify';
import { ValidationUtils } from '../utils/ValidationUtils';

export interface ConfigServiceInterface<T> {
  loadConfig(): T;
  validateConfig(config: any): T;
  getDefaultConfig(): T;
}

@injectable()
export abstract class BaseConfigService<T> implements ConfigServiceInterface<T> {
  protected config: T;

  constructor() {
    this.config = this.loadConfig();
  }

  abstract loadConfig(): T;
  abstract validateConfig(config: any): T;
  abstract getDefaultConfig(): T;

  getConfig(): T {
    return this.config;
  }

  updateConfig(newConfig: Partial<T>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 验证配置对象的通用方法
   * @param config 配置对象
   * @param schema Joi验证模式
   * @returns 验证后的配置对象
   */
  protected validateWithSchema(config: any, schema: any): T {
    return ValidationUtils.validateConfig(config, schema);
  }
}