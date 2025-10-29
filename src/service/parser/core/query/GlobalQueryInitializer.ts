import { QueryRegistryImpl } from './QueryRegistry';
import { QueryManager } from './QueryManager';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 全局查询系统初始化管理器
 * 确保查询系统只初始化一次，避免重复加载
 */
export class GlobalQueryInitializer {
  private static initialized = false;
  private static initializing = false;
  private static logger = new LoggerService();
  
  /**
   * 初始化查询系统（全局单次初始化）
   */
  static async initialize(): Promise<boolean> {
    // 如果已经初始化完成，直接返回
    if (this.initialized) {
      return true;
    }
    
    // 如果正在初始化，等待初始化完成
    if (this.initializing) {
      // 等待最多5秒
      const maxWaitTime = 5000;
      const startTime = Date.now();
      
      while (this.initializing && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      return this.initialized;
    }
    
    // 开始初始化
    this.initializing = true;
    this.logger.info('开始全局查询系统初始化...');
    
    try {
      // 按正确顺序初始化
      await QueryRegistryImpl.initialize();
      // 注意：不要在这里调用QueryManager.initialize()，避免循环依赖
      // QueryManager会在需要时自行调用GlobalQueryInitializer.initialize()
      
      this.initialized = true;
      this.initializing = false;
      this.logger.info('全局查询系统初始化完成');
      return true;
    } catch (error) {
      this.initializing = false;
      this.logger.error('全局查询系统初始化失败:', error);
      return false;
    }
  }
  
  /**
   * 检查是否已初始化
   */
  static isInitialized(): boolean {
    return this.initialized;
  }
  
  /**
   * 重新初始化查询系统
   */
  static async reinitialize(): Promise<boolean> {
    this.initialized = false;
    return await this.initialize();
  }
  
  /**
   * 获取初始化状态
   */
  static getStatus(): { initialized: boolean; initializing: boolean } {
    return {
      initialized: this.initialized,
      initializing: this.initializing
    };
  }
}