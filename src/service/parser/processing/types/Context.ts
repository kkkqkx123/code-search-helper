/**
 * 上下文类型定义
 * 定义处理上下文、元数据和上下文构建器
 */

import { ProcessingConfig } from './Config';
import { FileFeatures } from '../core/interfaces/IProcessingContext';

/**
 * 上下文元数据接口
 */
export interface ContextMetadata {
  /** 内容长度 */
  contentLength: number;
  /** 行数 */
  lineCount: number;
  /** 大小（字节） */
  size: number;
  /** 是否为小文件 */
  isSmallFile: boolean;
  /** 是否为代码文件 */
  isCodeFile: boolean;
  /** 是否为结构化文件 */
  isStructuredFile: boolean;
  /** 复杂度评分 */
  complexity: number;
  /** 是否包含导入语句 */
  hasImports: boolean;
  /** 是否包含导出语句 */
  hasExports: boolean;
  /** 是否包含函数 */
  hasFunctions: boolean;
  /** 是否包含类 */
  hasClasses: boolean;
  /** 创建时间戳 */
  timestamp: number;
  /** 扩展属性 */
  [key: string]: any;
}

/**
 * 处理上下文接口
 */
export interface ProcessingContext {
  /** 文件内容 */
  content: string;
  /** 编程语言 */
  language: string;
  /** 文件路径（可选） */
  filePath?: string;
  /** 处理配置 */
  config: ProcessingConfig;
  /** 文件特征 */
  features: FileFeatures;
  /** 上下文元数据 */
  metadata: ContextMetadata;
  /** AST（可选） */
  ast?: any;
  /** 节点跟踪器（可选） */
  nodeTracker?: any;
}

/**
 * 上下文构建器类
 */
export class ContextBuilder {
  private context: Partial<ProcessingContext> = {};

  constructor(content: string) {
    this.context.content = content;
    this.context.metadata = this.initializeMetadata(content);
  }

  /**
   * 设置文件路径
   */
  setFilePath(filePath?: string): ContextBuilder {
    this.context.filePath = filePath;
    return this;
  }

  /**
   * 设置编程语言
   */
  setLanguage(language: string): ContextBuilder {
    this.context.language = language;
    return this;
  }

  /**
   * 设置处理配置
   */
  setConfig(config: ProcessingConfig): ContextBuilder {
    this.context.config = config;
    return this;
  }

  /**
   * 设置AST
   */
  setAST(ast: any): ContextBuilder {
    this.context.ast = ast;
    return this;
  }

  /**
   * 设置节点跟踪器
   */
  setNodeTracker(nodeTracker: any): ContextBuilder {
    this.context.nodeTracker = nodeTracker;
    return this;
  }

  /**
   * 设置文件特征
   */
  setFeatures(features: FileFeatures): ContextBuilder {
    this.context.features = features;
    return this;
  }

  /**
   * 添加元数据
   */
  addMetadata(key: string, value: any): ContextBuilder {
    if (this.context.metadata) {
      this.context.metadata[key] = value;
    }
    return this;
  }

  /**
   * 构建处理上下文
   */
  build(): ProcessingContext {
    // 验证必需字段
    if (!this.context.content) {
      throw new Error('ProcessingContext content is required');
    }
    if (!this.context.language) {
      throw new Error('ProcessingContext language is required');
    }
    if (!this.context.config) {
      throw new Error('ProcessingContext config is required');
    }
    if (!this.context.features) {
      throw new Error('ProcessingContext features is required');
    }
    if (!this.context.metadata) {
      throw new Error('ProcessingContext metadata is required');
    }

    return this.context as ProcessingContext;
  }

  /**
   * 初始化基本元数据
   */
  private initializeMetadata(content: string): ContextMetadata {
    const lines = content.split('\n');
    const lineCount = lines.length;
    const contentLength = content.length;
    const size = new Blob([content]).size;
    
    // 基本复杂度计算（简单实现）
    const complexity = this.calculateBasicComplexity(content);
    
    // 检测基本特征
    const hasImports = /import\s+|require\s*\(/.test(content);
    const hasExports = /export\s+|module\.exports/.test(content);
    const hasFunctions = /function\s+\w+|=>\s*{|\w+\s*:\s*function/.test(content);
    const hasClasses = /class\s+\w+/.test(content);
    
    // 判断文件类型
    const isSmallFile = contentLength < 1000;
    const isCodeFile = this.isCodeContent(content);
    const isStructuredFile = hasFunctions || hasClasses || hasImports || hasExports;

    return {
      contentLength,
      lineCount,
      size,
      isSmallFile,
      isCodeFile,
      isStructuredFile,
      complexity,
      hasImports,
      hasExports,
      hasFunctions,
      hasClasses,
      timestamp: Date.now()
    };
  }

  /**
   * 计算基本复杂度
   */
  private calculateBasicComplexity(content: string): number {
    let complexity = 0;
    
    // 基于各种特征的简单复杂度计算
    complexity += (content.match(/if\s*\(/g) || []).length * 2;
    complexity += (content.match(/for\s*\(/g) || []).length * 3;
    complexity += (content.match(/while\s*\(/g) || []).length * 3;
    complexity += (content.match(/function\s+\w+/g) || []).length * 2;
    complexity += (content.match(/class\s+\w+/g) || []).length * 3;
    complexity += (content.match(/try\s*{/g) || []).length * 2;
    complexity += (content.match(/catch\s*\(/g) || []).length * 2;
    
    return Math.max(1, complexity);
  }

  /**
   * 判断是否为代码内容
   */
  private isCodeContent(content: string): boolean {
    // 简单的代码内容检测
    const codePatterns = [
      /function\s+\w+/,
      /class\s+\w+/,
      /var\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /const\s+\w+\s*=/,
      /import\s+/,
      /export\s+/,
      /if\s*\(/,
      /for\s*\(/,
      /while\s*\(/,
      /def\s+\w+/,
      /public\s+class/,
      /private\s+\w+/,
      /public\s+\w+/
    ];
    
    return codePatterns.some(pattern => pattern.test(content));
  }
}

/**
 * 上下文工具函数
 */
export class ContextUtils {
  /**
   * 创建基本上下文
   */
  static createBasicContext(
    content: string,
    language: string,
    config: ProcessingConfig,
    features: FileFeatures,
    filePath?: string
  ): ProcessingContext {
    return new ContextBuilder(content)
      .setLanguage(language)
      .setConfig(config)
      .setFeatures(features)
      .setFilePath(filePath)
      .build();
  }

  /**
   * 验证上下文
   */
  static validateContext(context: ProcessingContext): boolean {
    if (!context) return false;
    if (!context.content || typeof context.content !== 'string') return false;
    if (!context.language || typeof context.language !== 'string') return false;
    if (!context.config) return false;
    if (!context.features) return false;
    if (!context.metadata) return false;
    
    return true;
  }

  /**
   * 克隆上下文
   */
  static cloneContext(context: ProcessingContext): ProcessingContext {
    return {
      content: context.content,
      language: context.language,
      filePath: context.filePath,
      config: { ...context.config },
      features: { ...context.features },
      metadata: { ...context.metadata },
      ast: context.ast,
      nodeTracker: context.nodeTracker
    };
  }

  /**
   * 更新上下文元数据
   */
  static updateMetadata(
    context: ProcessingContext,
    updates: Partial<ContextMetadata>
  ): ProcessingContext {
    const clonedContext = this.cloneContext(context);
    clonedContext.metadata = { ...clonedContext.metadata, ...updates };
    return clonedContext;
  }

  /**
   * 检查上下文是否支持特定策略
   */
  static supportsStrategy(context: ProcessingContext, strategy: string): boolean {
    // 基本策略支持检查
    switch (strategy) {
      case 'line':
        return context.config.chunking.maxLinesPerChunk > 0;
      case 'semantic':
        return context.metadata.isStructuredFile && context.metadata.isCodeFile;
      case 'ast':
        return !!context.ast && context.metadata.isCodeFile;
      case 'bracket':
        return context.metadata.isCodeFile && /[\{\}\(\)\[\]]/.test(context.content);
      case 'hybrid':
        return true; // 混合策略总是可用
      default:
        return false;
    }
  }

  /**
   * 获取上下文摘要
   */
  static getContextSummary(context: ProcessingContext): string {
    const { content, language, metadata } = context;
    const preview = content.length > 100 ? content.substring(0, 100) + '...' : content;
    
    return `Language: ${language}, Lines: ${metadata.lineCount}, ` +
           `Size: ${metadata.size} bytes, Complexity: ${metadata.complexity}, ` +
           `Preview: ${preview.replace(/\n/g, '\\n')}`;
  }
}