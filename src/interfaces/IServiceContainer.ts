import { Container } from 'inversify';

/**
 * 服务容器接口
 * 提供依赖注入容器的抽象接口，用于延迟依赖获取
 */
export interface IServiceContainer {
  /**
   * 获取指定类型的依赖
   * @param serviceIdentifier 服务标识符
   * @returns 服务实例
   */
  get<T>(serviceIdentifier: any): T;

  /**
   * 检查指定类型的服务是否已注册
   * @param serviceIdentifier 服务标识符
   * @returns 是否已注册
   */
  isBound(serviceIdentifier: any): boolean;

  /**
   * 获取原始的Inversify容器实例（如果需要）
   * @returns Inversify容器实例
   */
  getContainer(): Container;
}