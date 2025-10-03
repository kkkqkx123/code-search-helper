import { Container } from 'inversify';
import { TYPES } from '../types';

// 导入服务注册器
import { ConfigServiceRegistrar } from './registrars/ConfigServiceRegistrar';
import { InfrastructureServiceRegistrar } from './registrars/InfrastructureServiceRegistrar';
import { DatabaseServiceRegistrar } from './registrars/DatabaseServiceRegistrar';
import { BusinessServiceRegistrar } from './registrars/BusinessServiceRegistrar';
import { EmbedderServiceRegistrar } from './registrars/EmbedderServiceRegistrar';

// 创建依赖注入容器
const diContainer = new Container();

// 按依赖层次注册服务
ConfigServiceRegistrar.register(diContainer);              // 配置服务
InfrastructureServiceRegistrar.register(diContainer);     // 基础设施服务
DatabaseServiceRegistrar.register(diContainer);           // 数据库服务
BusinessServiceRegistrar.register(diContainer);          // 业务服务
EmbedderServiceRegistrar.register(diContainer);           // 嵌入器服务

// 注意：ConfigFactory 不再通过 DI 容器注册，因为它需要手动创建以确保 ConfigService 已初始化

export { diContainer };