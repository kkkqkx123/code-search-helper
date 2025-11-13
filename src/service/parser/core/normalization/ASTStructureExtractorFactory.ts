import { injectable, inject } from 'inversify';
import { ASTStructureExtractor } from './ASTStructureExtractor';
import { QueryResultNormalizer } from './QueryResultNormalizer';
import { TreeSitterCoreService } from '../parse/TreeSitterCoreService';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';

/**
 * AST结构提取器工厂选项
 */
export interface ASTStructureExtractorOptions {
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 缓存大小 */
  cacheSize?: number;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
}

/**
 * AST结构提取器工厂
 * 负责创建和管理ASTStructureExtractor实例
 * 提供依赖注入支持和配置管理
 */
@injectable()
export class ASTStructureExtractorFactory {
  private logger: LoggerService;
  private instance: ASTStructureExtractor | null = null;
  private options: Required<ASTStructureExtractorOptions>;

  constructor(
    @inject(TYPES.QueryResultNormalizer)
    private queryNormalizer: QueryResultNormalizer,
    @inject(TYPES.TreeSitterCoreService)
    private treeSitterService: TreeSitterCoreService
  ) {
    this.logger = new LoggerService();
    this.options = {
      enableCache: true,
      cacheSize: 100,
      enablePerformanceMonitoring: true,
      debug: false
    };
  }

  /**
   * 创建ASTStructureExtractor实例
   * @param options 配置选项
   * @returns ASTStructureExtractor实例
   */
  createInstance(options?: ASTStructureExtractorOptions): ASTStructureExtractor {
    // 合并选项
    const mergedOptions = { ...this.options, ...options };
    
    this.logger.debug('创建ASTStructureExtractor实例', mergedOptions);
    
    // 创建实例
    const extractor = new ASTStructureExtractor(
      this.queryNormalizer,
      this.treeSitterService
    );
    
    // 应用配置
    this.applyConfiguration(extractor, mergedOptions);
    
    return extractor;
  }

  /**
   * 获取单例实例
   * @param options 配置选项（仅在首次创建时使用）
   * @returns ASTStructureExtractor实例
   */
  getInstance(options?: ASTStructureExtractorOptions): ASTStructureExtractor {
    if (!this.instance) {
      this.instance = this.createInstance(options);
    }
    return this.instance;
  }

  /**
   * 重置单例实例
   */
  resetInstance(): void {
    if (this.instance) {
      // 清理资源
      this.instance.clearCache();
      this.instance = null;
      this.logger.debug('ASTStructureExtractor单例实例已重置');
    }
  }

  /**
   * 更新工厂默认配置
   * @param options 新的配置选项
   */
  updateOptions(options: Partial<ASTStructureExtractorOptions>): void {
    this.options = { ...this.options, ...options };
    this.logger.debug('ASTStructureExtractor工厂配置已更新', this.options);
    
    // 如果存在实例，应用新配置
    if (this.instance) {
      this.applyConfiguration(this.instance, this.options);
    }
  }

  /**
   * 获取当前配置
   * @returns 当前配置选项
   */
  getOptions(): Required<ASTStructureExtractorOptions> {
    return { ...this.options };
  }

  /**
   * 应用配置到实例
   * @param extractor ASTStructureExtractor实例
   * @param options 配置选项
   */
  private applyConfiguration(
    extractor: ASTStructureExtractor,
    options: Required<ASTStructureExtractorOptions>
  ): void {
    // 应用缓存配置
    if (!options.enableCache) {
      extractor.clearCache();
    }
    
    // 应用调试模式
    if (options.debug) {
      this.logger.debug('调试模式已启用');
    }
    
    this.logger.debug('配置已应用到ASTStructureExtractor实例', options);
  }

  /**
   * 获取工厂统计信息
   * @returns 统计信息
   */
  getStats(): {
    hasInstance: boolean;
    options: Required<ASTStructureExtractorOptions>;
    cacheStats?: any;
    performanceStats?: any;
  } {
    const stats: any = {
      hasInstance: this.instance !== null,
      options: this.options
    };
    
    if (this.instance) {
      try {
        stats.cacheStats = this.instance.getCacheStats();
        stats.performanceStats = this.instance.getPerformanceStats();
      } catch (error) {
        this.logger.warn('获取实例统计信息失败:', error);
      }
    }
    
    return stats;
  }

  /**
   * 清理所有资源
   */
  dispose(): void {
    this.resetInstance();
    this.logger.debug('ASTStructureExtractor工厂已清理');
  }

  /**
   * 健康检查
   * @returns 健康状态
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    details: {
      queryNormalizer: boolean;
      treeSitterService: boolean;
      instance: boolean;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    const details = {
      queryNormalizer: false,
      treeSitterService: false,
      instance: false
    };
    
    // 检查QueryResultNormalizer
    try {
      if (this.queryNormalizer && typeof this.queryNormalizer.normalize === 'function') {
        details.queryNormalizer = true;
      } else {
        errors.push('QueryResultNormalizer不可用');
      }
    } catch (error) {
      errors.push(`QueryResultNormalizer检查失败: ${error}`);
    }
    
    // 检查TreeSitterCoreService
    try {
      if (this.treeSitterService && typeof this.treeSitterService.parseCode === 'function') {
        details.treeSitterService = true;
      } else {
        errors.push('TreeSitterCoreService不可用');
      }
    } catch (error) {
      errors.push(`TreeSitterCoreService检查失败: ${error}`);
    }
    
    // 检查实例
    try {
      if (this.instance) {
        details.instance = true;
      }
    } catch (error) {
      errors.push(`实例检查失败: ${error}`);
    }
    
    return {
      healthy: errors.length === 0,
      details,
      errors
    };
  }

  /**
   * 预热工厂
   * 创建实例以预热缓存和初始化资源
   */
  async warmup(): Promise<void> {
    this.logger.debug('预热ASTStructureExtractor工厂');
    
    try {
      // 创建实例
      const instance = this.getInstance();
      
      // 执行健康检查
      const health = await this.healthCheck();
      
      if (!health.healthy) {
        this.logger.warn('工厂预热完成，但存在警告:', health.errors);
      } else {
        this.logger.debug('工厂预热完成，所有组件正常');
      }
    } catch (error) {
      this.logger.error('工厂预热失败:', error);
      throw error;
    }
  }

  /**
   * 创建用于静态方法的工厂实例
   * 这是一个内部方法，用于支持静态方法调用
   */
  static createStaticFactory(
    queryNormalizer: QueryResultNormalizer,
    treeSitterService: TreeSitterCoreService
  ): ASTStructureExtractorFactory {
    const factory = new ASTStructureExtractorFactory(queryNormalizer, treeSitterService);
    return factory;
  }
}

/**
 * 全局工厂实例管理器
 * 用于管理全局唯一的工厂实例
 */
export class GlobalASTStructureExtractorFactory {
  private static factory: ASTStructureExtractorFactory | null = null;
  private static initialized: boolean = false;

  /**
   * 初始化全局工厂
   * @param queryNormalizer QueryResultNormalizer实例
   * @param treeSitterService TreeSitterCoreService实例
   * @param options 配置选项
   */
  static initialize(
    queryNormalizer: QueryResultNormalizer,
    treeSitterService: TreeSitterCoreService,
    options?: ASTStructureExtractorOptions
  ): void {
    if (this.initialized) {
      throw new Error('GlobalASTStructureExtractorFactory已经初始化');
    }
    
    this.factory = new ASTStructureExtractorFactory(queryNormalizer, treeSitterService);
    
    if (options) {
      this.factory.updateOptions(options);
    }
    
    this.initialized = true;
  }

  /**
   * 获取全局工厂实例
   * @returns ASTStructureExtractorFactory实例
   */
  static getFactory(): ASTStructureExtractorFactory {
    if (!this.factory || !this.initialized) {
      throw new Error('GlobalASTStructureExtractorFactory未初始化');
    }
    return this.factory;
  }

  /**
   * 重置全局工厂
   */
  static reset(): void {
    if (this.factory) {
      this.factory.dispose();
      this.factory = null;
    }
    this.initialized = false;
  }

  /**
   * 检查是否已初始化
   * @returns 是否已初始化
   */
  static isInitialized(): boolean {
    return this.initialized && this.factory !== null;
  }
}