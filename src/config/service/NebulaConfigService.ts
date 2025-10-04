import { injectable, inject } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { TYPES } from '../../types';

export interface NebulaConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  timeout?: number;
  maxConnections?: number;
  retryAttempts?: number;
  retryDelay?: number;
  space?: string;
  bufferSize?: number;
  pingInterval?: number;
  vidTypeLength?: number;
}

@injectable()
export class NebulaConfigService extends BaseConfigService<NebulaConfig> {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService
  ) {
    super();
  }

  loadConfig(): NebulaConfig {
    try {
      const rawConfig = {
        host: process.env.NEBULA_HOST || 'localhost',
        port: parseInt(process.env.NEBULA_PORT || '9669'),
        username: process.env.NEBULA_USERNAME || 'root',
        password: process.env.NEBULA_PASSWORD || 'nebula',
        timeout: parseInt(process.env.NEBULA_TIMEOUT || '30000'),
        maxConnections: parseInt(process.env.NEBULA_MAX_CONNECTIONS || '10'),
        retryAttempts: parseInt(process.env.NEBULA_RETRY_ATTEMPTS || '3'),
        retryDelay: parseInt(process.env.NEBULA_RETRY_DELAY || '30000'),
        bufferSize: parseInt(process.env.NEBULA_BUFFER_SIZE || '2000'),
        pingInterval: parseInt(process.env.NEBULA_PING_INTERVAL || '3000'),
        space: this.getSpaceName(), // 使用增强的配置逻辑
        vidTypeLength: parseInt(process.env.NEBULA_VID_TYPE_LENGTH || '128'),
      };

      return this.validateConfig(rawConfig);
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error in NebulaConfigService'),
        { component: 'NebulaConfigService', operation: 'loadConfig' }
      );
      throw error;
    }
  }

  /**
   * 获取空间名称，实现配置优先级逻辑
   * 1. 检查显式环境配置
   * 2. 否则使用默认值（项目隔离的动态命名在使用时确定）
   */
  private getSpaceName(): string | undefined {
    try {
      // 检查显式环境配置
      const explicitName = process.env.NEBULA_SPACE;
      if (explicitName && explicitName !== 'code_graphs') {
        // 显式设置的配置，记录警告日志
        this.logger.warn('Using explicit NEBULA_SPACE configuration, this will override project isolation');
        // 验证显式配置的命名是否符合规范
        if (!this.validateNamingConvention(explicitName)) {
          this.logger.warn(`Explicit space name "${explicitName}" does not follow naming conventions, this may cause issues.`);
        }
        return explicitName;
      }

      // 默认使用项目隔离的动态命名（在实际使用时确定）
      return undefined; // 不设置默认space，实际使用时会被替换
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error in getSpaceName'),
        { component: 'NebulaConfigService', operation: 'getSpaceName' }
      );
      // 返回默认值以确保服务可用
      return undefined;
    }
  }

  /**
   * 验证命名约定是否符合数据库要求
   *
   * @param name 要验证的名称
   * @returns 如果名称符合约定则返回true，否则返回false
   */
  validateNamingConvention(name: string): boolean {
    try {
      // 验证命名符合数据库约束
      const pattern = /^[a-zA-Z0-9_-]{1,63}$/;
      const isValid = pattern.test(name) && !name.startsWith('_');

      if (!isValid) {
        this.logger.warn(`Invalid naming convention detected: "${name}" does not match pattern ${pattern}`);
      }

      return isValid;
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error in validateNamingConvention'),
        { component: 'NebulaConfigService', operation: 'validateNamingConvention' }
      );
      return false;
    }
  }

  /**
   * 获取空间名称，支持显式配置或动态生成（供外部使用）
   *
   * @param projectId 项目ID，用于生成动态空间名称
   * @returns 对应的空间名称，优先使用显式环境配置，否则使用项目隔离的动态命名
   * @throws 如果生成的名称不符合命名约定，则抛出错误
   */
  getSpaceNameForProject(projectId: string): string {
    try {
      // 1. 检查显式环境配置
      const explicitName = process.env.NEBULA_SPACE;
      if (explicitName && explicitName !== 'code_graphs') {
        this.logger.warn('Using explicit NEBULA_SPACE configuration, which may override project isolation');
        // 验证显式配置的命名是否符合规范
        if (!this.validateNamingConvention(explicitName)) {
          this.logger.error(`Explicit NEBULA_SPACE name "${explicitName}" does not follow naming conventions, this may cause issues.`);
        }
        return explicitName;
      }

      // 2. 使用项目隔离的动态命名
      const dynamicName = `project_${projectId}`;

      // 验证动态生成的命名是否符合规范
      if (!this.validateNamingConvention(dynamicName)) {
        this.logger.error(`Generated space name "${dynamicName}" does not follow naming conventions.`);
        throw new Error(`Generated space name "${dynamicName}" is invalid`);
      }

      return dynamicName;
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error in getSpaceNameForProject'),
        { component: 'NebulaConfigService', operation: 'getSpaceNameForProject', projectId }
      );
      throw error;
    }
  }

  /**
   * 检查配置是否冲突
   * @param explicitName 显式配置的名称
   * @param projectId 项目ID
   * @returns 是否存在冲突
   */
  public static checkConfigurationConflict(explicitName: string | undefined, projectId: string): boolean {
    // 如果没有显式配置，则无冲突
    if (!explicitName) {
      return false;
    }

    // 检查显式配置是否与项目隔离命名冲突
    const projectSpecificName = `project_${projectId}`;
    return explicitName !== projectSpecificName;
  }

  validateConfig(config: any): NebulaConfig {
    try {
      const schema = Joi.object({
        host: Joi.string().hostname().default('localhost'),
        port: Joi.number().port().default(9669),
        username: Joi.string().default('root'),
        password: Joi.string().default('nebula'),
        timeout: Joi.number().default(300),
        maxConnections: Joi.number().default(10),
        retryAttempts: Joi.number().default(3),
        retryDelay: Joi.number().default(1000),
        space: Joi.string().optional(),
        bufferSize: Joi.number().default(10),
        pingInterval: Joi.number().default(3000),
        vidTypeLength: Joi.number().min(8).max(256).default(128),
      });

      const { error, value } = schema.validate(config);
      if (error) {
        this.logger.error(`Nebula config validation error: ${error.message}`);
        throw new Error(`Nebula config validation error: ${error.message}`);
      }

      // 验证空间名称格式（如果提供了空间名称）
      if (value.space && !this.validateNamingConvention(value.space)) {
        this.logger.error(`Invalid space name format: ${value.space}`);
        throw new Error(`Invalid space name format: ${value.space}`);
      }

      return value;
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error in validateConfig'),
        { component: 'NebulaConfigService', operation: 'validateConfig' }
      );
      throw error;
    }
  }

  getDefaultConfig(): NebulaConfig {
    return {
      host: 'localhost',
      port: 9669,
      username: 'root',
      password: 'nebula',
      timeout: 30000,
      maxConnections: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      space: 'codebase',
      bufferSize: 10,
      pingInterval: 3000,
      vidTypeLength: 128,
    };
  }
}