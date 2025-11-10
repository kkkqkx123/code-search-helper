import { injectable, inject } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { TYPES } from '../../types';
import { EnvironmentUtils } from '../utils/EnvironmentUtils';
import { ValidationUtils } from '../utils/ValidationUtils';
import { HashUtils } from '../../utils/cache/HashUtils';
import { ProjectPathMappingService } from '../../database/ProjectPathMappingService';

export interface QdrantConfig {
  host: string;
  port: number;
  collection: string;
  apiKey?: string;
  useHttps: boolean;
  timeout: number;
}

@injectable()
export class QdrantConfigService extends BaseConfigService<QdrantConfig> {
  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ErrorHandlerService) private errorHandler: ErrorHandlerService,
    @inject(TYPES.ProjectPathMappingService) private projectPathMappingService?: ProjectPathMappingService
  ) {
    super();
  }

  loadConfig(): QdrantConfig {
    try {
      const rawConfig = {
        host: EnvironmentUtils.parseString('QDRANT_HOST', 'localhost'),
        port: EnvironmentUtils.parsePort('QDRANT_PORT', 6333),
        collection: this.getCollectionName(), // 使用增强的配置逻辑
        apiKey: EnvironmentUtils.parseOptionalString('QDRANT_API_KEY'),
        useHttps: EnvironmentUtils.parseBoolean('QDRANT_USE_HTTPS', false),
        timeout: EnvironmentUtils.parseNumber('QDRANT_TIMEOUT', 30000),
      };

      return this.validateConfig(rawConfig);
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error in QdrantConfigService'),
        { component: 'QdrantConfigService', operation: 'loadConfig' }
      );
      throw error;
    }
  }

  /**
   * 获取集合名称，实现配置优先级逻辑
   * 1. 检查显式环境配置
   * 2. 否则使用默认值（项目隔离的动态命名在使用时确定）
   */
  private getCollectionName(): string {
    try {
      // 检查显式环境配置
      const explicitName = process.env.QDRANT_COLLECTION;
      if (explicitName && explicitName !== 'code-snippets') {
        // 显式设置的配置，记录警告日志
        this.logger.warn('Using explicit QDRANT_COLLECTION configuration, this will override project isolation');
        // 验证显式配置的命名是否符合规范
        if (!this.validateNamingConvention(explicitName)) {
          this.logger.warn(`Explicit collection name "${explicitName}" does not follow naming conventions, this may cause issues.`);
        }
        return explicitName;
      }

      // 默认使用项目隔离的动态命名（在实际使用时确定）
      return 'code-snippets'; // 占位符，实际使用时会被替换
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error in getCollectionName'),
        { component: 'QdrantConfigService', operation: 'getCollectionName' }
      );
      // 返回默认值以确保服务可用
      return 'code-snippets';
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
        { component: 'QdrantConfigService', operation: 'validateNamingConvention' }
      );
      return false;
    }
  }

  /**
   * 获取集合名称，支持显式配置或动态生成（供外部使用）
   *
   * @param projectId 项目ID，用于生成动态集合名称
   * @returns 对应的集合名称，优先使用显式环境配置，否则使用项目隔离的动态命名
   * @throws 如果生成的名称不符合命名约定，则抛出错误
   */
  getCollectionNameForProject(projectId: string): string {
    try {
      // 1. 检查显式环境配置
      const explicitName = process.env.QDRANT_COLLECTION;
      if (explicitName && explicitName !== 'code-snippets') {
        this.logger.warn('Using explicit QDRANT_COLLECTION configuration, which may override project isolation');
        // 验证显式配置的命名是否符合规范
        if (!this.validateNamingConvention(explicitName)) {
          this.logger.error(`Explicit QDRANT_COLLECTION name "${explicitName}" does not follow naming conventions, this may cause issues.`);
        }
        return explicitName;
      }

      // 2. 使用项目隔离的动态命名，确保符合命名规范
      const dynamicName = HashUtils.generateSafeProjectName(
        projectId,
        'project',
        63,
        true,
        this.projectPathMappingService
      );

      // 验证动态生成的命名是否符合规范（应该总是通过，但作为双重检查）
      if (!this.validateNamingConvention(dynamicName)) {
        this.logger.error(`Generated collection name "${dynamicName}" does not follow naming conventions.`);
        throw new Error(`Generated collection name "${dynamicName}" is invalid`);
      }

      return dynamicName;
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error in getCollectionNameForProject'),
        { component: 'QdrantConfigService', operation: 'getCollectionNameForProject', projectId }
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
    const projectSpecificName = `project-${projectId}`;
    return explicitName !== projectSpecificName;
  }

  validateConfig(config: any): QdrantConfig {
    try {
      const schema = Joi.object({
        host: Joi.string().hostname().default('localhost'),
        port: ValidationUtils.portSchema(6333),
        collection: Joi.string().default('code-snippets'),
        apiKey: Joi.string().optional(),
        useHttps: ValidationUtils.booleanSchema(false),
        timeout: ValidationUtils.positiveNumberSchema(30000),
      });

      const value = ValidationUtils.validateConfig(config, schema);

      // 验证集合名称格式
      if (value.collection && !this.validateNamingConvention(value.collection)) {
        this.logger.error(`Invalid collection name format: ${value.collection}`);
        throw new Error(`Invalid collection name format: ${value.collection}`);
      }

      return value;
    } catch (error) {
      this.errorHandler.handleError(
        error instanceof Error ? error : new Error('Unknown error in validateConfig'),
        { component: 'QdrantConfigService', operation: 'validateConfig' }
      );
      throw error;
    }
  }

  getDefaultConfig(): QdrantConfig {
    return {
      host: 'localhost',
      port: 6333,
      collection: 'code-snippets',
      useHttps: false,
      timeout: 30000,
    };
  }
}