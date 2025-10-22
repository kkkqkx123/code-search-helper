import { TreeSitterQueryEngine } from './TreeSitterQueryEngine';

/**
 * 查询引擎工厂类
 * 提供TreeSitterQueryEngine的单例实例
 */
export class QueryEngineFactory {
  private static instance: TreeSitterQueryEngine;

  /**
   * 获取TreeSitterQueryEngine的单例实例
   * @returns TreeSitterQueryEngine实例
   */
  static getInstance(): TreeSitterQueryEngine {
    if (!this.instance) {
      this.instance = new TreeSitterQueryEngine();
    }
    return this.instance;
  }

  /**
   * 重置单例实例（主要用于测试）
   */
  static resetInstance(): void {
    this.instance = null as any;
  }

  /**
   * 检查实例是否已初始化
   * @returns 是否已初始化
   */
  static isInitialized(): boolean {
    return this.instance !== undefined;
  }
}