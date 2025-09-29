import Parser from 'tree-sitter';
import { CodeChunk } from '../types';

/**
 * 智能分段策略接口
 * 定义所有分段策略必须实现的方法和属性
 */
export interface ChunkingStrategy {
  /** 策略名称 */
  readonly name: string;

  /** 策略优先级，数值越小优先级越高 */
  readonly priority: number;

  /** 策略描述 */
  readonly description: string;

  /** 支持的语言列表 */
  readonly supportedLanguages: string[];

  /**
   * 检查策略是否可以处理给定的语言和节点
   */
  canHandle(language: string, node: Parser.SyntaxNode): boolean;

  /**
   * 执行分段操作
   */
  chunk(node: Parser.SyntaxNode, content: string): CodeChunk[];

  /**
   * 获取策略支持的节点类型
   */
  getSupportedNodeTypes(language: string): Set<string>;

  /**
   * 验证分段结果的合理性
   */
  validateChunks(chunks: CodeChunk[]): boolean;

  /**
   * 获取策略的配置选项
   */
  getConfiguration(): StrategyConfiguration;
}

/**
 * 策略配置接口
 */
export interface StrategyConfiguration {
  /** 最大分段大小（字符数） */
  maxChunkSize: number;

  /** 最小分段大小（字符数） */
  minChunkSize: number;

  /** 是否保留注释 */
  preserveComments: boolean;

  /** 是否保留空行 */
  preserveEmptyLines: boolean;

  /** 嵌套深度限制 */
  maxNestingLevel: number;

  /** 其他自定义配置 */
  [key: string]: any;
}

/**
 * 策略执行结果
 */
export interface StrategyExecutionResult {
  /** 生成的分段 */
  chunks: CodeChunk[];

  /** 执行时间（毫秒） */
  executionTime: number;

  /** 处理的节点数量 */
  processedNodes: number;

  /** 策略名称 */
  strategyName: string;

  /** 是否成功 */
  success: boolean;

  /** 错误信息（如果失败） */
  error?: string;
}

/**
 * 抽象基础策略类
 * 提供通用的策略实现基础
 */
export abstract class BaseChunkingStrategy implements ChunkingStrategy {
  abstract readonly name: string;
  abstract readonly priority: number;
  abstract readonly description: string;
  abstract readonly supportedLanguages: string[];

  protected config: StrategyConfiguration;

  constructor(config?: Partial<StrategyConfiguration>) {
    this.config = {
      maxChunkSize: 2000,
      minChunkSize: 100,
      preserveComments: true,
      preserveEmptyLines: false,
      maxNestingLevel: 10,
      ...config
    };
  }

  abstract canHandle(language: string, node: Parser.SyntaxNode): boolean;
  abstract chunk(node: Parser.SyntaxNode, content: string): CodeChunk[];
  abstract getSupportedNodeTypes(language: string): Set<string>;

  validateChunks(chunks: CodeChunk[]): boolean {
    if (!chunks || chunks.length === 0) {
      return false;
    }

    // 验证分段大小
    for (const chunk of chunks) {
      if (chunk.content.length < this.config.minChunkSize) {
        return false;
      }
      if (chunk.content.length > this.config.maxChunkSize) {
        return false;
      }
    }

    return true;
  }

  getConfiguration(): StrategyConfiguration {
    return { ...this.config };
  }

  protected extractNodeContent(node: Parser.SyntaxNode, content: string): string {
    return content.substring(node.startIndex, node.endIndex);
  }

  protected getNodeLocation(node: Parser.SyntaxNode): {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  } {
    return {
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endColumn: node.endPosition.column + 1,
    };
  }

  protected calculateComplexity(content: string): number {
    const complexityPatterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\btry\b/g,
      /\bcatch\b/g,
      /\?\./g,
      /\|\|/g,
      /&&/g,
    ];

    let complexity = 1;
    const combinedPattern = /\b(if|else|for|while|switch|case|try|catch)\b|\?\.|&&|\|\|/g;
    const matches = content.match(combinedPattern);

    if (matches) {
      complexity += matches.length;
    }

    return Math.min(complexity, 50); // 限制最大复杂度
  }
}