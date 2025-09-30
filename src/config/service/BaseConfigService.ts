import { injectable } from 'inversify';

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
}