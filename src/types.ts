import { interfaces } from 'inversify';
import { ConfigService } from './config/ConfigService';
import { QdrantService } from './database/QdrantService';
import { LoggerService } from './utils/LoggerService';
import { ErrorHandlerService } from './utils/ErrorHandlerService';

export const TYPES = {
  ConfigService: Symbol.for('ConfigService'),
  QdrantService: Symbol.for('QdrantService'),
  LoggerService: Symbol.for('LoggerService'),
  ErrorHandlerService: Symbol.for('ErrorHandlerService'),
  // 添加其他类型定义
};

// 定义接口类型用于依赖注入
export interface IConfigService extends ConfigService {}
export interface IQdrantService extends QdrantService {}
export interface ILoggerService extends LoggerService {}
export interface IErrorHandlerService extends ErrorHandlerService {}