import { Container } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';

export class InfrastructureServiceRegistrar {
  static register(container: Container): void {
    // 基础设施服务
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
  }
}