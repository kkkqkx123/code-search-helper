import Parser from 'tree-sitter';
import { ChunkingOptions } from '../../types/config-types';
import { UnifiedChunkingOptions } from '../config/UnifiedChunkingOptions';

/**
 * 保护上下文接口
 */
export interface ProtectionContext {
  operation: string;
  segmentationContext?: Context;
  additionalMetadata?: Record<string, any>;
  filePath?: string;
  content?: string;
  language?: string;
  metadata?: {
    contentLength?: number;
    lineCount?: number;
    [key: string]: any;
  };
}

/**
 * 统一分段上下文
 * 整合了 ISplitStrategy 和 ISegmentationStrategy 的上下文信息
 */
export interface Context {
  /** 文件内容 */
  content: string;

  /** 文件路径 */
  filePath?: string;

  /** 编程语言 */
  language?: string;

  /** 统一分块配置 */
  options: ChunkingOptions;

  /** AST 语法树 (可选) */
  ast?: Parser.Tree;

  /** 节点跟踪器 (可选) */
  nodeTracker?: any;

  /** 保护上下文 (可选) */
  protectionContext?: ProtectionContext;

  /** 元数据 */
  metadata: {
    /** 内容长度 */
    contentLength: number;

    /** 行数 */
    lineCount: number;

    /** 是否为小文件 */
    isSmallFile: boolean;

    /** 是否为代码文件 */
    isCodeFile: boolean;

    /** 是否为 Markdown 文件 */
    isMarkdownFile: boolean;

    /** 是否为 XML 文件 */
    isXMLFile: boolean;

    /** 是否为结构化文件 */
    isStructuredFile: boolean;

    /** 是否为高度结构化文件 */
    isHighlyStructured: boolean;

    /** 复杂度 */
    complexity: number;

    /** 是否有导入 */
    hasImports: boolean;

    /** 是否有导出 */
    hasExports: boolean;

    /** 是否有函数 */
    hasFunctions: boolean;

    /** 是否有类 */
    hasClasses: boolean;

    /** 文件大小 */
    size: number;

    /** 其他扩展元数据 */
    [key: string]: any;
  };
}

/**
 * 上下文构建器
 */
export class ContextBuilder {
  private context: Partial<Context> = {};

  constructor(content: string) {
    this.context.content = content;
    this.context.metadata = {
      contentLength: content.length,
      lineCount: content.split('\n').length,
      size: content.length,
      isSmallFile: content.length < 1000,
      isCodeFile: false,
      isMarkdownFile: false,
      isXMLFile: false,
      isStructuredFile: false,
      isHighlyStructured: false,
      complexity: 0,
      hasImports: false,
      hasExports: false,
      hasFunctions: false,
      hasClasses: false
    };
  }

  setFilePath(filePath: string): ContextBuilder {
    this.context.filePath = filePath;

    // 根据文件路径设置文件类型
    if (filePath.endsWith('.md')) {
      this.context.metadata!.isMarkdownFile = true;
    }

    const ext = filePath.split('.').pop()?.toLowerCase();
    if (['xml', 'html', 'xhtml'].includes(ext || '')) {
      this.context.metadata!.isXMLFile = true;
    }

    return this;
  }

  setLanguage(language: string): ContextBuilder {
    this.context.language = language;

    // 根据语言设置文件类型
    const codeLanguages = [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'shell',
      'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'json',
      'yaml', 'sql', 'dockerfile', 'cmake', 'perl', 'r', 'matlab',
      'lua', 'dart', 'elixir', 'erlang', 'haskell', 'ocaml', 'fsharp',
      'visualbasic', 'powershell', 'batch'
    ];

    if (codeLanguages.includes(language)) {
      this.context.metadata!.isCodeFile = true;
    }

    return this;
  }

  setOptions(options: ChunkingOptions): ContextBuilder {
    this.context.options = options;
    return this;
  }

  setAST(ast: Parser.Tree): ContextBuilder {
    this.context.ast = ast;
    return this;
  }

  setNodeTracker(nodeTracker: any): ContextBuilder {
    this.context.nodeTracker = nodeTracker;
    return this;
  }

  setProtectionContext(protectionContext: ProtectionContext): ContextBuilder {
    this.context.protectionContext = protectionContext;
    return this;
  }

  setComplexity(complexity: number): ContextBuilder {
    this.context.metadata!.complexity = complexity;
    this.context.metadata!.isHighlyStructured = complexity > 20;
    this.context.metadata!.isStructuredFile = complexity > 10;
    return this;
  }

  setImports(hasImports: boolean): ContextBuilder {
    this.context.metadata!.hasImports = hasImports;
    return this;
  }

  setExports(hasExports: boolean): ContextBuilder {
    this.context.metadata!.hasExports = hasExports;
    return this;
  }

  setFunctions(hasFunctions: boolean): ContextBuilder {
    this.context.metadata!.hasFunctions = hasFunctions;
    return this;
  }

  setClasses(hasClasses: boolean): ContextBuilder {
    this.context.metadata!.hasClasses = hasClasses;
    return this;
  }

  addMetadata(key: string, value: any): ContextBuilder {
    this.context.metadata![key] = value;
    return this;
  }

  build(): Context {
    // 验证必需字段
    if (!this.context.content) {
      throw new Error('Content is required for Context');
    }

    if (!this.context.options) {
      throw new Error('Options are required for Context');
    }

    return this.context as Context;
  }
}

/**
 * 创建统一上下文的便捷函数
 */
export function createContext(
  content: string,
  filePath?: string,
  language?: string,
  options?: ChunkingOptions
): Context {
  const builder = new ContextBuilder(content);

  if (filePath) builder.setFilePath(filePath);
  if (language) builder.setLanguage(language);
  if (options) builder.setOptions(options);

  return builder.build();
}

/**
 * 从旧的参数创建统一上下文
 */
export function createContextFromLegacy(
  content: string,
  language: string,
  filePath?: string,
  options?: any,
  nodeTracker?: any,
  ast?: any
): Context {
  const builder = new ContextBuilder(content);

  if (filePath) builder.setFilePath(filePath);
  if (language) builder.setLanguage(language);
  if (nodeTracker) builder.setNodeTracker(nodeTracker);
  if (ast) builder.setAST(ast);

  // 转换配置
  if (options) {
    const { convertFromLegacyOptions, convertToLegacyOptions } = require('../config/UnifiedChunkingOptions');
    const unifiedOptions = convertFromLegacyOptions(options);
    // 将 UnifiedChunkingOptions 转换为 ChunkingOptions 格式
    const legacyOptions = convertToLegacyOptions(unifiedOptions);
    builder.setOptions(legacyOptions);
  }

  return builder.build();
}

/**
 * 验证上下文
 */
export function validateContext(context: Context): boolean {
  if (!context) return false;
  if (!context.content) return false;
  if (!context.options) return false;
  if (!context.metadata) return false;

  // 验证元数据
  const requiredMetadata = [
    'contentLength', 'lineCount', 'size', 'isSmallFile',
    'isCodeFile', 'isMarkdownFile', 'isXMLFile', 'isStructuredFile',
    'isHighlyStructured', 'complexity', 'hasImports', 'hasExports',
    'hasFunctions', 'hasClasses'
  ];

  for (const key of requiredMetadata) {
    if (!(key in context.metadata)) {
      return false;
    }
  }

  return true;
}