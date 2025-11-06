/**
 * 插件接口定义
 * 定义了插件系统的核心接口和类型
 */

import Parser from 'tree-sitter';
import { RelationshipResult, RelationshipType } from './RelationshipTypes';
import { SymbolTable, SymbolInfo } from '../types';

/**
 * 插件状态枚举
 */
export enum PluginState {
  UNLOADED = 'unloaded',
  LOADING = 'loading',
  LOADED = 'loaded',
  ACTIVE = 'active',
  ERROR = 'error',
  DISABLED = 'disabled'
}

/**
 * 插件类型枚举
 */
export enum PluginType {
  RELATIONSHIP_EXTRACTOR = 'relationship-extractor',
  LANGUAGE_HELPER = 'language-helper',
  METADATA_PROCESSOR = 'metadata-processor',
  PERFORMANCE_MONITOR = 'performance-monitor',
  CACHE_PROVIDER = 'cache-provider',
  ERROR_HANDLER = 'error-handler'
}

/**
 * 基础插件接口
 */
export interface IPlugin {
  /** 插件名称 */
  readonly name: string;
  /** 插件版本 */
  readonly version: string;
  /** 插件描述 */
  readonly description: string;
  /** 插件作者 */
  readonly author: string;
  /** 插件类型 */
  readonly type: PluginType;
  /** 支持的语言 */
  readonly supportedLanguages: string[];
  /** 插件依赖 */
  readonly dependencies: string[];
  /** 插件状态 */
  state: PluginState;
  
  /**
   * 初始化插件
   */
  initialize(): Promise<void>;
  
  /**
   * 销毁插件
   */
  destroy(): Promise<void>;
  
  /**
   * 获取插件信息
   */
  getInfo(): PluginInfo;
  
  /**
   * 检查插件是否支持指定语言
   */
  supportsLanguage(language: string): boolean;
  
  /**
   * 健康检查
   */
  healthCheck(): Promise<boolean>;
}

/**
 * 关系提取器插件接口
 */
export interface IRelationshipExtractorPlugin extends IPlugin {
  /** 支持的关系类型 */
  readonly supportedRelationshipTypes: RelationshipType[];
  /** 提取器优先级 */
  readonly priority: number;
  
  /**
   * 提取关系
   */
  extractRelationships(result: any, astNode: Parser.SyntaxNode, symbolTable: SymbolTable): Promise<RelationshipResult[]>;
  
  /**
   * 提取关系元数据
   */
  extractMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: SymbolTable): Promise<any>;
  
  /**
   * 检查是否可以处理指定节点
   */
  canHandle(astNode: Parser.SyntaxNode): boolean;
  
  /**
   * 获取关系类型映射
   */
  getRelationshipTypeMapping(): Record<string, RelationshipType>;
}

/**
 * 语言辅助插件接口
 */
export interface ILanguageHelperPlugin extends IPlugin {
  /**
   * 提取名称
   */
  extractName(astNode: Parser.SyntaxNode): string | null;
  
  /**
   * 提取内容
   */
  extractContent(astNode: Parser.SyntaxNode): string;
  
  /**
   * 计算复杂度
   */
  calculateComplexity(astNode: Parser.SyntaxNode): number;
  
  /**
   * 提取依赖项
   */
  extractDependencies(astNode: Parser.SyntaxNode): string[];
  
  /**
   * 提取修饰符
   */
  extractModifiers(astNode: Parser.SyntaxNode): string[];
  
  /**
   * 映射节点类型
   */
  mapNodeType(nodeType: string): string;
  
  /**
   * 映射查询类型
   */
  mapQueryType(queryType: string): string;
}

/**
 * 元数据处理器插件接口
 */
export interface IMetadataProcessorPlugin extends IPlugin {
  /**
   * 处理元数据
   */
  processMetadata(metadata: any, context: ProcessingContext): Promise<any>;
  
  /**
   * 验证元数据
   */
  validateMetadata(metadata: any): Promise<boolean>;
  
  /**
   * 转换元数据
   */
  transformMetadata(metadata: any, targetFormat: string): Promise<any>;
}

/**
 * 性能监控插件接口
 */
export interface IPerformanceMonitorPlugin extends IPlugin {
  /**
   * 开始监控
   */
  startMonitoring(context: MonitoringContext): Promise<void>;
  
  /**
   * 停止监控
   */
  stopMonitoring(): Promise<MonitoringResult>;
  
  /**
   * 记录指标
   */
  recordMetric(name: string, value: number, unit?: string): void;
  
  /**
   * 获取实时指标
   */
  getRealTimeMetrics(): Promise<Record<string, number>>;
}

/**
 * 缓存提供者插件接口
 */
export interface ICacheProviderPlugin extends IPlugin {
  /**
   * 获取缓存值
   */
  get<T>(key: string): Promise<T | undefined>;
  
  /**
   * 设置缓存值
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  
  /**
   * 删除缓存值
   */
  delete(key: string): Promise<boolean>;
  
  /**
   * 清空缓存
   */
  clear(): Promise<void>;
  
  /**
   * 获取缓存统计
   */
  getStats(): Promise<CacheStats>;
}

/**
 * 错误处理器插件接口
 */
export interface IErrorHandlerPlugin extends IPlugin {
  /**
   * 处理错误
   */
  handleError(error: Error, context: ErrorContext): Promise<ErrorHandlingResult>;
  
  /**
   * 检查是否可以处理指定错误
   */
  canHandle(error: Error): boolean;
  
  /**
   * 获取错误处理策略
   */
  getHandlingStrategy(errorType: string): ErrorHandlingStrategy;
}

/**
 * 插件信息接口
 */
export interface PluginInfo {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version: string;
  /** 插件描述 */
  description: string;
  /** 插件作者 */
  author: string;
  /** 插件类型 */
  type: PluginType;
  /** 支持的语言 */
  supportedLanguages: string[];
  /** 插件依赖 */
  dependencies: string[];
  /** 插件状态 */
  state: PluginState;
  /** 加载时间 */
  loadTime?: Date;
  /** 最后更新时间 */
  lastUpdated?: Date;
  /** 插件配置 */
  config?: Record<string, any>;
}

/**
 * 处理上下文接口
 */
export interface ProcessingContext {
  /** 文件路径 */
  filePath: string;
  /** 编程语言 */
  language: string;
  /** 查询类型 */
  queryType: string;
  /** 符号表 */
  symbolTable: SymbolTable;
  /** 处理选项 */
  options: Record<string, any>;
}

/**
 * 监控上下文接口
 */
export interface MonitoringContext {
  /** 会话ID */
  sessionId: string;
  /** 操作类型 */
  operation: string;
  /** 开始时间 */
  startTime: Date;
  /** 上下文信息 */
  context: Record<string, any>;
}

/**
 * 监控结果接口
 */
export interface MonitoringResult {
  /** 会话ID */
  sessionId: string;
  /** 操作类型 */
  operation: string;
  /** 开始时间 */
  startTime: Date;
  /** 结束时间 */
  endTime: Date;
  /** 持续时间（毫秒） */
  duration: number;
  /** 指标数据 */
  metrics: Record<string, number>;
  /** 错误信息 */
  errors?: Error[];
}

/**
 * 缓存统计接口
 */
export interface CacheStats {
  /** 缓存大小 */
  size: number;
  /** 命中次数 */
  hits: number;
  /** 未命中次数 */
  misses: number;
  /** 命中率 */
  hitRate: number;
  /** 设置次数 */
  sets: number;
  /** 删除次数 */
  deletes: number;
  /** 内存使用（字节） */
  memoryUsage: number;
}

/**
 * 错误上下文接口
 */
export interface ErrorContext {
  /** 错误发生的位置 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  /** 操作类型 */
  operation: string;
  /** 输入数据 */
  input?: any;
  /** 上下文信息 */
  context: Record<string, any>;
}

/**
 * 错误处理结果接口
 */
export interface ErrorHandlingResult {
  /** 是否成功处理 */
  success: boolean;
  /** 处理后的结果 */
  result?: any;
  /** 错误消息 */
  message?: string;
  /** 是否应该重试 */
  shouldRetry: boolean;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
}

/**
 * 错误处理策略枚举
 */
export enum ErrorHandlingStrategy {
  IGNORE = 'ignore',
  LOG = 'log',
  RETRY = 'retry',
  FALLBACK = 'fallback',
  FAIL_FAST = 'fail_fast'
}

/**
 * 插件配置接口
 */
export interface PluginConfig {
  /** 插件名称 */
  name: string;
  /** 是否启用 */
  enabled: boolean;
  /** 插件配置 */
  config: Record<string, any>;
  /** 依赖配置 */
  dependencies: Record<string, any>;
}

/**
 * 插件管理器接口
 */
export interface IPluginManager {
  /**
   * 注册插件
   */
  registerPlugin(plugin: IPlugin): Promise<void>;
  
  /**
   * 注销插件
   */
  unregisterPlugin(name: string): Promise<void>;
  
  /**
   * 获取插件
   */
  getPlugin(name: string): IPlugin | undefined;
  
  /**
   * 获取所有插件
   */
  getAllPlugins(): IPlugin[];
  
  /**
   * 按类型获取插件
   */
  getPluginsByType(type: PluginType): IPlugin[];
  
  /**
   * 按语言获取插件
   */
  getPluginsByLanguage(language: string): IPlugin[];
  
  /**
   * 启用插件
   */
  enablePlugin(name: string): Promise<void>;
  
  /**
   * 禁用插件
   */
  disablePlugin(name: string): Promise<void>;
  
  /**
   * 加载插件
   */
  loadPlugin(pluginPath: string): Promise<IPlugin>;
  
  /**
   * 卸载插件
   */
  unloadPlugin(name: string): Promise<void>;
  
  /**
   * 获取插件状态
   */
  getPluginState(name: string): PluginState;
  
  /**
   * 健康检查所有插件
   */
  healthCheckAll(): Promise<Record<string, boolean>>;
}

/**
 * 插件工厂接口
 */
export interface IPluginFactory {
  /**
   * 创建插件
   */
  createPlugin(config: PluginConfig): Promise<IPlugin>;
  
  /**
   * 获取支持的插件类型
   */
  getSupportedPluginTypes(): PluginType[];
  
  /**
   * 验证插件配置
   */
  validateConfig(config: PluginConfig): boolean;
}

/**
 * 插件加载器接口
 */
export interface IPluginLoader {
  /**
   * 从文件加载插件
   */
  loadFromFile(filePath: string): Promise<IPlugin>;
  
  /**
   * 从目录加载插件
   */
  loadFromDirectory(directoryPath: string): Promise<IPlugin[]>;
  
  /**
   * 从包加载插件
   */
  loadFromPackage(packageName: string): Promise<IPlugin>;
  
  /**
   * 验证插件
   */
  validatePlugin(plugin: IPlugin): Promise<boolean>;
}

/**
 * 插件事件类型
 */
export enum PluginEventType {
  PLUGIN_LOADED = 'plugin_loaded',
  PLUGIN_UNLOADED = 'plugin_unloaded',
  PLUGIN_ENABLED = 'plugin_enabled',
  PLUGIN_DISABLED = 'plugin_disabled',
  PLUGIN_ERROR = 'plugin_error',
  PLUGIN_HEALTH_CHECK = 'plugin_health_check'
}

/**
 * 插件事件接口
 */
export interface PluginEvent {
  /** 事件类型 */
  type: PluginEventType;
  /** 插件名称 */
  pluginName: string;
  /** 时间戳 */
  timestamp: Date;
  /** 事件数据 */
  data?: any;
  /** 错误信息 */
  error?: Error;
}

/**
 * 插件事件监听器类型
 */
export type PluginEventListener = (event: PluginEvent) => void;

/**
 * 插件事件发射器接口
 */
export interface IPluginEventEmitter {
  /**
   * 添加事件监听器
   */
  on(eventType: PluginEventType, listener: PluginEventListener): void;
  
  /**
   * 移除事件监听器
   */
  off(eventType: PluginEventType, listener: PluginEventListener): void;
  
  /**
   * 发射事件
   */
  emit(event: PluginEvent): void;
  
  /**
   * 移除所有监听器
   */
  removeAllListeners(eventType?: PluginEventType): void;
}