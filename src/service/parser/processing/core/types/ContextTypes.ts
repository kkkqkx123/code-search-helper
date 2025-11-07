/**
 * 上下文类型定义
 * 定义了处理上下文相关的类型
 */

/**
 * 处理上下文实现类
 */
export class ProcessingContext implements IProcessingContext {
  /** 要处理的代码内容 */
  content: string;

  /** 编程语言 */
  language: string;

  /** 文件路径（可选） */
  filePath?: string;

  /** 处理配置 */
  config: ProcessingConfig;

  /** 文件特征信息 */
  features: FileFeatures;

  /** 上下文元数据 */
  metadata: ContextMetadata;

  /** AST节点（如果可用） */
  ast?: any;

  /** 节点跟踪器（如果可用） */
  nodeTracker?: any;

  /**
   * 构造函数
   * @param data 上下文数据
   */
  constructor(data: ProcessingContextData) {
    this.content = data.content;
    this.language = data.language;
    this.filePath = data.filePath;
    this.config = data.config;
    this.features = data.features;
    this.metadata = data.metadata;
    this.ast = data.ast;
    this.nodeTracker = data.nodeTracker;
  }

  /**
   * 克隆上下文
   * @returns 克隆的上下文
   */
  clone(): ProcessingContext {
    return new ProcessingContext({
      ...this,
      metadata: { ...this.metadata },
      features: { ...this.features }
    });
  }

  /**
   * 更新元数据
   * @param updates 更新数据
   */
  updateMetadata(updates: Partial<ContextMetadata>): void {
    this.metadata = { ...this.metadata, ...updates };
  }

  /**
   * 更新特征
   * @param updates 更新数据
   */
  updateFeatures(updates: Partial<FileFeatures>): void {
    this.features = { ...this.features, ...updates };
  }
}

/**
 * 处理上下文数据接口
 */
export interface ProcessingContextData {
  /** 要处理的代码内容 */
  content: string;

  /** 编程语言 */
  language: string;

  /** 文件路径（可选） */
  filePath?: string;

  /** 处理配置 */
  config: ProcessingConfig;

  /** 文件特征信息 */
  features: FileFeatures;

  /** 上下文元数据 */
  metadata: ContextMetadata;

  /** AST节点（如果可用） */
  ast?: any;

  /** 节点跟踪器（如果可用） */
  nodeTracker?: any;
}

/**
 * 上下文构建器类
 */
export class ContextBuilder {
  private context: Partial<ProcessingContextData> = {};

  /**
   * 构造函数
   * @param content 代码内容
   */
  constructor(content: string) {
    this.context.content = content;
    this.context.metadata = this.initializeMetadata(content);
  }

  /**
   * 设置文件路径
   * @param filePath 文件路径
   * @returns 构建器实例
   */
  setFilePath(filePath: string): ContextBuilder {
    this.context.filePath = filePath;
    return this;
  }

  /**
   * 设置编程语言
   * @param language 编程语言
   * @returns 构建器实例
   */
  setLanguage(language: string): ContextBuilder {
    this.context.language = language;
    return this;
  }

  /**
   * 设置配置
   * @param config 处理配置
   * @returns 构建器实例
   */
  setConfig(config: ProcessingConfig): ContextBuilder {
    this.context.config = config;
    return this;
  }

  /**
   * 设置AST
   * @param ast AST节点
   * @returns 构建器实例
   */
  setAST(ast: any): ContextBuilder {
    this.context.ast = ast;
    return this;
  }

  /**
   * 设置节点跟踪器
   * @param nodeTracker 节点跟踪器
   * @returns 构建器实例
   */
  setNodeTracker(nodeTracker: any): ContextBuilder {
    this.context.nodeTracker = nodeTracker;
    return this;
  }

  /**
   * 设置文件特征
   * @param features 文件特征
   * @returns 构建器实例
   */
  setFeatures(features: FileFeatures): ContextBuilder {
    this.context.features = features;
    return this;
  }

  /**
   * 添加元数据
   * @param key 键
   * @param value 值
   * @returns 构建器实例
   */
  addMetadata(key: string, value: any): ContextBuilder {
    if (!this.context.metadata) {
      this.context.metadata = this.initializeMetadata(this.context.content || '');
    }
    (this.context.metadata as any)[key] = value;
    return this;
  }

  /**
   * 构建处理上下文
   * @returns 处理上下文实例
   */
  build(): ProcessingContext {
    if (!this.context.content) {
      throw new Error('Content is required');
    }
    if (!this.context.language) {
      throw new Error('Language is required');
    }
    if (!this.context.config) {
      throw new Error('Config is required');
    }
    if (!this.context.features) {
      this.context.features = this.initializeFeatures(this.context.content, this.context.language);
    }

    return new ProcessingContext(this.context as ProcessingContextData);
  }

  /**
   * 初始化元数据
   * @param content 代码内容
   * @returns 初始元数据
   */
  private initializeMetadata(content: string): ContextMetadata {
    const lines = content.split('\n');
    return {
      contentLength: content.length,
      lineCount: lines.length,
      size: Buffer.byteLength(content, 'utf8'),
      isSmallFile: content.length < 1024 * 10, // 小于10KB
      isCodeFile: true, // 默认为代码文件
      isStructuredFile: false, // 默认为非结构化文件
      complexity: 0, // 将在特征检测时计算
      hasImports: false, // 将在特征检测时计算
      hasExports: false, // 将在特征检测时计算
      hasFunctions: false, // 将在特征检测时计算
      hasClasses: false, // 将在特征检测时计算
      timestamp: Date.now()
    };
  }

  /**
   * 初始化文件特征
   * @param content 代码内容
   * @param language 编程语言
   * @returns 初始文件特征
   */
  private initializeFeatures(content: string, language: string): FileFeatures {
    const lines = content.split('\n');
    return {
      size: Buffer.byteLength(content, 'utf8'),
      lineCount: lines.length,
      isSmallFile: content.length < 1024 * 10, // 小于10KB
      isCodeFile: true, // 默认为代码文件
      isStructuredFile: false, // 默认为非结构化文件
      complexity: 0, // 将在特征检测时计算
      hasImports: false, // 将在特征检测时计算
      hasExports: false, // 将在特征检测时计算
      hasFunctions: false, // 将在特征检测时计算
      hasClasses: false, // 将在特征检测时计算
      languageFeatures: {} // 语言特定特征
    };
  }
}

// 导入相关类型，避免循环依赖
import type { IProcessingContext, FileFeatures, ContextMetadata } from '../interfaces/IProcessingContext';
import type { ProcessingConfig } from './ConfigTypes';