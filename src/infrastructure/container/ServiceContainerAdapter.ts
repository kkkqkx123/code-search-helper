import { Container } from 'inversify';
import { IServiceContainer } from '../../interfaces/IServiceContainer';

/**
 * Inversify容器的适配器实现
 * 将Inversify容器包装为IServiceContainer接口
 */
export class ServiceContainerAdapter implements IServiceContainer {
  private container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  /**
   * 获取指定类型的依赖
   * @param serviceIdentifier 服务标识符
   * @returns 服务实例
   */
  get<T>(serviceIdentifier: any): T {
    return this.container.get<T>(serviceIdentifier);
  }

  /**
   * 检查指定类型的服务是否已注册
   * @param serviceIdentifier 服务标识符
   * @returns 是否已注册
   */
  isBound(serviceIdentifier: any): boolean {
    return this.container.isBound(serviceIdentifier);
  }

  /**
   * 获取原始的Inversify容器实例
   * @returns Inversify容器实例
   */
  getContainer(): Container {
    return this.container;
  }
}