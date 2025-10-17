import { ISplitStrategy } from './ISplitStrategy';
import { ChunkingOptions } from '..';

/**
 * 策略提供者接口
 * 用于创建和管理分割策略实例
 */
export interface IStrategyProvider {
  /**
   * 获取策略提供者名称
   */
  getName(): string;

  /**
   * 创建策略实例
   * @param options 配置选项
   */
  createStrategy(options?: ChunkingOptions): ISplitStrategy;

  /**
   * 获取策略依赖的服务列表
   */
  getDependencies(): string[];
}