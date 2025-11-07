/**
 * 配置管理器接口
 * 定义了处理配置管理的基本契约
 */
export interface IConfigManager {
  /**
   * 获取当前处理配置
   * @returns 处理配置
   */
  getConfig(): ProcessingConfig;

  /**
   * 获取指定语言的配置
   * @param language 编程语言
   * @returns 语言配置
   */
  getLanguageConfig(language: string): LanguageConfig;

  /**
   * 更新配置
   * @param updates 配置更新
   */
  updateConfig(updates: Partial<ProcessingConfig>): void;

  /**
   * 重置为默认配置
   */
  resetToDefaults(): void;

  /**
   * 验证配置
   * @param config 要验证的配置
   * @returns 验证结果
   */
  validateConfig(config: ProcessingConfig): ConfigValidationResult;

  /**
   * 添加配置变更监听器
   * @param listener 监听器函数
   */
  addConfigListener(listener: ConfigChangeListener): void;

  /**
   * 移除配置变更监听器
   * @param listener 监听器函数
   */
  removeConfigListener(listener: ConfigChangeListener): void;

  /**
   * 保存配置到持久化存储（可选实现）
   */
  saveConfig?(): Promise<void>;

  /**
   * 从持久化存储加载配置（可选实现）
   */
  loadConfig?(): Promise<void>;
}

/**
 * 配置验证结果接口
 */
export interface ConfigValidationResult {
  /** 是否有效 */
  isValid: boolean;

  /** 错误信息列表 */
  errors: ConfigValidationError[];

  /** 警告信息列表 */
  warnings: ConfigValidationWarning[];
}

/**
 * 配置验证错误接口
 */
export interface ConfigValidationError {
  /** 错误路径 */
  path: string;

  /** 错误消息 */
  message: string;

  /** 错误代码 */
  code: string;
}

/**
 * 配置验证警告接口
 */
export interface ConfigValidationWarning {
  /** 警告路径 */
  path: string;

  /** 警告消息 */
  message: string;

  /** 警告代码 */
  code: string;
}

/**
 * 配置变更监听器类型
 */
export type ConfigChangeListener = (
  oldConfig: ProcessingConfig,
  newConfig: ProcessingConfig,
  changes: ConfigChange[]
) => void;

/**
 * 配置变更接口
 */
export interface ConfigChange {
  /** 变更路径 */
  path: string;

  /** 旧值 */
  oldValue: any;

  /** 新值 */
  newValue: any;

  /** 变更类型 */
  type: 'add' | 'update' | 'delete';
}

// 导入相关类型，避免循环依赖
import type { ProcessingConfig, LanguageConfig } from '../types/ConfigTypes';