import { Container } from 'inversify';
import { NebulaModule } from '../../database/nebula/NebulaModule';
import { GraphModule } from '../../service/graph/core/GraphModule';

export class ModuleServiceRegistrar {
  static register(container: Container): void {
    // 集中加载所有模块，确保依赖关系正确
    container.load(NebulaModule);  // 图数据库模块
    container.load(GraphModule);   // 图服务模块
  }
}