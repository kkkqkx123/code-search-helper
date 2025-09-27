import { Container, ContainerModule } from 'inversify';
import { ConfigService } from '../config/ConfigService';
import { QdrantService } from '../database/QdrantService';
import { LoggerService } from '../utils/LoggerService';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { ProjectIdManager } from '../database/ProjectIdManager';
import { ProjectLookupService } from '../database/ProjectLookupService';
import { TYPES } from '../types';

// 创建依赖注入容器
const diContainer = new Container();

// 注册服务
diContainer.bind<ConfigService>(TYPES.ConfigService).toConstantValue(ConfigService.getInstance());
diContainer.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
diContainer.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
diContainer.bind<QdrantService>(TYPES.QdrantService).to(QdrantService).inSingletonScope();
diContainer.bind<ProjectIdManager>(TYPES.ProjectIdManager).to(ProjectIdManager).inSingletonScope();
diContainer.bind<ProjectLookupService>(TYPES.ProjectLookupService).to(ProjectLookupService).inSingletonScope();

export { diContainer };