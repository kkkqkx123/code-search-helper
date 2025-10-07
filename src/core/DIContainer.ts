import { Container } from 'inversify';
import { TYPES } from '../types';

// 导入服务注册器
import { ConfigServiceRegistrar } from './registrars/ConfigServiceRegistrar';
import { InfrastructureServiceRegistrar } from './registrars/InfrastructureServiceRegistrar';
import { DatabaseServiceRegistrar } from './registrars/DatabaseServiceRegistrar';
import { BusinessServiceRegistrar } from './registrars/BusinessServiceRegistrar';
import { EmbedderServiceRegistrar } from './registrars/EmbedderServiceRegistrar';

// 导入服务模块
import { GraphModule } from '../service/graph/core/GraphModule';

// 创建依赖注入容器
console.log('Creating DI container...');
const diContainer = new Container();

// 按依赖层次注册服务
console.log('Registering ConfigServiceRegistrar...');
ConfigServiceRegistrar.register(diContainer);              // 配置服务
console.log('ConfigServiceRegistrar registered');

console.log('Registering InfrastructureServiceRegistrar...');
InfrastructureServiceRegistrar.register(diContainer);     // 基础设施服务
console.log('InfrastructureServiceRegistrar registered');

console.log('Registering DatabaseServiceRegistrar...');
DatabaseServiceRegistrar.register(diContainer);           // 数据库服务
console.log('DatabaseServiceRegistrar registered');

console.log('Registering BusinessServiceRegistrar...');
BusinessServiceRegistrar.register(diContainer);          // 业务服务
console.log('BusinessServiceRegistrar registered');

console.log('Registering EmbedderServiceRegistrar...');
EmbedderServiceRegistrar.register(diContainer);           // 嵌入器服务
console.log('EmbedderServiceRegistrar registered');

// 加载服务模块
console.log('Loading GraphModule...');
diContainer.load(GraphModule);                            // 图服务模块
console.log('GraphModule loaded');

// 注意：ConfigFactory 不再通过 DI 容器注册，因为它需要手动创建以确保 ConfigService 已初始化

console.log('DI Container initialization complete.');
export { diContainer };