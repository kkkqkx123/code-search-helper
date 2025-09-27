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