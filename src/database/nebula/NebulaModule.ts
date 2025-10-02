import { ContainerModule } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { ErrorHandlerService } from '../../utils/ErrorHandlerService';
import { ConfigService } from '../../config/ConfigService';
import { NebulaService } from './NebulaService';
import { NebulaConnectionManager } from './NebulaConnectionManager';
import { NebulaQueryBuilder } from './NebulaQueryBuilder';
import { NebulaSpaceManager } from './NebulaSpaceManager';
import { NebulaGraphOperations } from './NebulaGraphOperations';

// 创建 Nebula 服务模块
export const NebulaModule = new ContainerModule((bindObj: any) => {
  const { bind } = bindObj;

  // 注意：所有 Nebula 相关的服务已经在 DatabaseServiceRegistrar 中注册
  // 此模块保留用于未来可能需要的特殊绑定配置
  // 当前为空模块，避免重复绑定问题

  // 不再在此模块中绑定任何服务，避免重复绑定
  // 这些服务已经在 DatabaseServiceRegistrar.ts 中绑定
});