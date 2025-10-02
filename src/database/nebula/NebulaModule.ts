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

  // 绑定 Nebula 服务接口和实现
  bind(TYPES.INebulaService).to(NebulaService).inSingletonScope();
  bind(TYPES.NebulaService).to(NebulaService).inSingletonScope();

  // 绑定 Nebula 连接管理器
  bind(TYPES.NebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();
  bind(TYPES.INebulaConnectionManager).to(NebulaConnectionManager).inSingletonScope();

  // 绑定 Nebula 查询构建器
  bind(TYPES.NebulaQueryBuilder).to(NebulaQueryBuilder).inSingletonScope();
  bind(TYPES.INebulaQueryBuilder).to(NebulaQueryBuilder).inSingletonScope();

  // 绑定 Nebula 空间管理器
  bind(TYPES.INebulaSpaceManager).to(NebulaSpaceManager).inSingletonScope();

  // 绑定 Nebula 图操作服务
  bind(TYPES.INebulaGraphOperations).to(NebulaGraphOperations).inSingletonScope();

  // 不再在此模块中绑定基础设施服务，避免重复绑定
  // 这些服务已经在DIContainer.ts中绑定
});