import { CodeChunk, ChunkingOptions, ASTNode } from '../types/splitting-types';

/**
 * 分割策略接口
 */
export interface ISplitStrategy {
  /**
   * 执行代码分段
   * @param content 源代码内容
   * @param language 编程语言
   * @param filePath 文件路径（可选）
   * @param options 分段选项
   * @param nodeTracker AST节点跟踪器（可选）
   * @param ast AST树（可选）
   */
  split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]>;

  /**
   * 获取策略名称（用于日志和调试）
   */
  getName(): string;

  /**
   * 检查是否支持该语言
   * @param language 编程语言
   */
  supportsLanguage(language: string): boolean;

  /**
   * 获取策略描述
   */
  getDescription?(): string;

  /**
   * 提取代码块关联的AST节点
   * @param chunk 代码块
   * @param ast AST树
   */
  extractNodesFromChunk?(chunk: CodeChunk, ast: any): ASTNode[];

  /**
   * 检查代码块是否包含已使用的节点
   * @param chunk 代码块
   * @param nodeTracker 节点跟踪器
   * @param ast AST树
   */
  hasUsedNodes?(chunk: CodeChunk, nodeTracker: any, ast: any): boolean;
}

// 重新导出接口
export { IStrategyProvider } from './IStrategyProvider';
export { ChunkingOptions };