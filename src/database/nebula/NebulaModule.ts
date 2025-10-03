import { ContainerModule } from 'inversify';
import { TYPES } from '../../types';
import { NebulaConfigService } from '../../config/service/NebulaConfigService';

// 创建 Nebula 服务模块
export const NebulaModule = new ContainerModule((bind: any) => {
  // 绑定 Nebula 配置服务
  bind(TYPES.NebulaConfigService).to(NebulaConfigService).inSingletonScope();
});