import * as Parser from 'tree-sitter';
import * as crypto from 'crypto';

/**
 * 中央ID生成服务
 * 提供统一的ID生成策略，满足项目中各个模块的差异化需求
 */

/**
 * ID类型枚举
 */
export enum IdType {
  AST_NODE = 'ast',
  RELATIONSHIP = 'rel',
  FILE = 'file',
  CHUNK = 'chunk',
  CONFIG = 'config',
  ERROR = 'error',
  DATABASE = 'db',
  SYMBOL = 'symbol'
}

/**
 * 为任意AST节点生成唯一且可预测的确定性ID。
 * ID生成策略为 `ast:node.type:node.startPosition.row:node.startPosition.column`。
 * 这确保了对于同一个文件中的同一个节点，无论何时计算，结果都完全一样。
 *
 * @param node Tree-sitter AST节点
 * @returns 确定性的节点ID字符串
 */
export function generateDeterministicNodeId(node: Parser.SyntaxNode): string {
  if (!node) {
    throw new Error('Cannot generate ID for a null or undefined node.');
  }

  const { type, startPosition } = node;

  // startPosition is an object with { row, column }
  // row and column are 0-indexed, we use them directly.
  const id = `${IdType.AST_NODE}:${type}:${startPosition.row}:${startPosition.column}`;

  return id;
}

/**
 * 生成关系节点ID
 * 格式：rel:sourceId->targetId:relationshipType
 *
 * @param sourceId 源节点ID
 * @param targetId 目标节点ID
 * @param relationshipType 关系类型
 * @returns 关系节点ID
 */
export function generateRelationshipId(sourceId: string, targetId: string, relationshipType: string): string {
  if (!sourceId || !targetId || !relationshipType) {
    throw new Error('Source ID, target ID, and relationship type are required.');
  }

  // 简化ID，避免过长
  const shortSource = sourceId.length > 50 ? sourceId.substring(0, 50) : sourceId;
  const shortTarget = targetId.length > 50 ? targetId.substring(0, 50) : targetId;

  return `${IdType.RELATIONSHIP}:${shortSource}->${shortTarget}:${relationshipType}`;
}

/**
 * 生成文件节点ID
 * 格式：file:filePath:projectId?
 *
 * @param filePath 文件路径
 * @param projectId 项目ID（可选）
 * @returns 文件节点ID
 */
export function generateFileId(filePath: string, projectId?: string): string {
  if (!filePath) {
    throw new Error('File path is required.');
  }

  // 标准化文件路径，使用正斜杠
  const normalizedPath = filePath.replace(/\\/g, '/');

  if (projectId) {
    return `${IdType.FILE}:${normalizedPath}:${projectId}`;
  }

  return `${IdType.FILE}:${normalizedPath}`;
}

/**
 * 生成代码块节点ID
 * 格式：chunk:filePath:startLine-endLine:hash
 *
 * @param filePath 文件路径
 * @param startLine 起始行号
 * @param endLine 结束行号
 * @param content 代码块内容（可选，用于生成哈希）
 * @returns 代码块节点ID
 */
export function generateChunkId(filePath: string, startLine: number, endLine: number, content?: string): string {
  if (!filePath || startLine === undefined || endLine === undefined) {
    throw new Error('File path, start line, and end line are required.');
  }

  const normalizedPath = filePath.replace(/\\/g, '/');
  const baseId = `${IdType.CHUNK}:${normalizedPath}:${startLine}-${endLine}`;

  if (content) {
    const hash = generateContentHash(content);
    return `${baseId}:${hash}`;
  }

  return baseId;
}

/**
 * 生成配置项节点ID
 * 格式：config:type:name:startLine-endLine:contentHash
 *
 * @param type 配置类型
 * @param name 配置名称
 * @param startLine 起始行号
 * @param endLine 结束行号
 * @param content 配置内容
 * @returns 配置项节点ID
 */
export function generateConfigId(type: string, name: string, startLine: number, endLine: number, content: string): string {
  if (!type || !name || startLine === undefined || endLine === undefined || !content) {
    throw new Error('Type, name, start line, end line, and content are required.');
  }

  const contentHash = generateContentHash(content);
  return `${IdType.CONFIG}:${type}:${name}:${startLine}-${endLine}:${contentHash}`;
}

/**
 * 生成错误节点ID
 * 格式：error:context:timestamp:random
 *
 * @param context 错误上下文
 * @returns 错误节点ID
 */
export function generateErrorId(context: string): string {
  if (!context) {
    throw new Error('Error context is required.');
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${IdType.ERROR}:${context}:${timestamp}:${random}`;
}

/**
 * 生成数据库节点ID
 * 格式：db:label:timestamp:random
 *
 * @param label 节点标签
 * @returns 数据库节点ID
 */
export function generateDatabaseId(label: string): string {
  if (!label) {
    throw new Error('Label is required.');
  }

  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${IdType.DATABASE}:${label}:${timestamp}:${random}`;
}

/**
 * 生成符号节点ID
 * 格式：symbol:name:type:filePath:line
 *
 * @param name 符号名称
 * @param type 符号类型
 * @param filePath 文件路径
 * @param line 行号
 * @returns 符号节点ID
 */
export function generateSymbolId(name: string, type: string, filePath: string, line: number): string {
  if (!name || !type || !filePath || line === undefined) {
    throw new Error('Name, type, file path, and line are required.');
  }

  const normalizedPath = filePath.replace(/\\/g, '/');
  return `${IdType.SYMBOL}:${name}:${type}:${normalizedPath}:${line}`;
}

/**
 * 生成回退ID（当无法生成确定性ID时使用）
 * 格式：fallback:type:name:timestamp
 *
 * @param type 类型
 * @param name 名称
 * @returns 回退ID
 */
export function generateFallbackId(type: string, name: string): string {
  if (!type || !name) {
    throw new Error('Type and name are required.');
  }

  const timestamp = Date.now();
  return `fallback:${type}:${name}:${timestamp}`;
}

/**
 * 生成内容哈希
 *
 * @param content 内容
 * @returns 哈希值
 */
function generateContentHash(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

/**
 * 中央ID生成器类
 * 提供统一的ID生成接口
 */
export class NodeIdGenerator {
  /**
   * 为AST节点生成确定性ID
   */
  static forAstNode(node: Parser.SyntaxNode): string {
    return generateDeterministicNodeId(node);
  }

  /**
   * 为关系生成ID
   */
  static forRelationship(sourceId: string, targetId: string, relationshipType: string): string {
    return generateRelationshipId(sourceId, targetId, relationshipType);
  }

  /**
   * 为文件生成ID
   */
  static forFile(filePath: string, projectId?: string): string {
    return generateFileId(filePath, projectId);
  }

  /**
   * 为代码块生成ID
   */
  static forChunk(filePath: string, startLine: number, endLine: number, content?: string): string {
    return generateChunkId(filePath, startLine, endLine, content);
  }

  /**
   * 为配置项生成ID
   */
  static forConfig(type: string, name: string, startLine: number, endLine: number, content: string): string {
    return generateConfigId(type, name, startLine, endLine, content);
  }

  /**
   * 为错误生成ID
   */
  static forError(context: string): string {
    return generateErrorId(context);
  }

  /**
   * 为数据库节点生成ID
   */
  static forDatabase(label: string): string {
    return generateDatabaseId(label);
  }

  /**
   * 为符号生成ID
   */
  static forSymbol(name: string, type: string, filePath: string, line: number): string {
    return generateSymbolId(name, type, filePath, line);
  }

  /**
   * 生成回退ID
   */
  static forFallback(type: string, name: string): string {
    return generateFallbackId(type, name);
  }

  /**
   * 安全生成AST节点ID（带回退机制）
   */
  static safeForAstNode(node: Parser.SyntaxNode | null | undefined, fallbackType: string, fallbackName: string): string {
    if (!node) {
      return this.forFallback(fallbackType, fallbackName);
    }

    try {
      return this.forAstNode(node);
    } catch (error) {
      return this.forFallback(fallbackType, fallbackName);
    }
  }
}
