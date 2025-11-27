import Parser from 'tree-sitter';
import { CacheKeyUtils } from '../../../../utils/cache/CacheKeyUtils';
import { HashUtils } from '../../../../utils/cache/HashUtils';

/**
 * 统一的缓存键生成器
 * 为不同查询引擎提供一致的缓存键生成策略，避免键冲突
 */
export class CacheKeyGenerator {
  // 缓存键前缀，用于区分不同引擎
  private static readonly SIMPLE_QUERY_PREFIX = 'simple:';
  private static readonly TREE_SITTER_QUERY_PREFIX = 'treesitter:';
  private static readonly BATCH_QUERY_PREFIX = 'batch:';
  private static readonly AST_PREFIX = 'ast:';

  /**
   * 为SimpleQueryEngine生成缓存键
   * @param ast AST节点
   * @param queryType 查询类型
   * @param language 语言
   * @returns 缓存键
   */
  static forSimpleQuery(ast: Parser.SyntaxNode, queryType: string, language: string): string {
    const contentHash = this.generateContentHash(ast);
    return `${this.SIMPLE_QUERY_PREFIX}${contentHash}:${queryType}:${language}`;
  }

  /**
   * 为TreeSitterQueryEngine生成缓存键
   * @param ast AST节点
   * @param patternName 模式名称
   * @param language 语言
   * @returns 缓存键
   */
  static forTreeSitterQuery(ast: Parser.SyntaxNode, patternName: string, language: string): string {
    const contentHash = this.generateContentHash(ast);
    return `${this.TREE_SITTER_QUERY_PREFIX}${contentHash}:${patternName}:${language}`;
  }

  /**
   * 为批量查询生成缓存键
   * @param ast AST节点
   * @param types 查询类型数组
   * @param language 语言
   * @returns 缓存键
   */
  static forBatchQuery(ast: Parser.SyntaxNode, types: string[], language: string): string {
    const contentHash = this.generateContentHash(ast);
    const typesKey = CacheKeyUtils.generateCacheKey(types.sort());
    return `${this.BATCH_QUERY_PREFIX}${contentHash}:batch:${typesKey}:${language}`;
  }

  /**
   * 为AST对象生成缓存键
   * @param filePath 文件路径
   * @param contentHash 文件内容哈希
   * @returns 缓存键
   */
  static forAst(filePath: string, contentHash: string): string {
    // 使用CacheKeyUtils标准化文件路径和内容哈希的组合
    const normalizedKey = CacheKeyUtils.generateCacheKey(filePath, contentHash);
    return `${this.AST_PREFIX}${normalizedKey}`;
  }

  /**
   * 生成AST内容的哈希值
   * @param ast AST节点
   * @returns 内容哈希
   */
  private static generateContentHash(ast: Parser.SyntaxNode): string {
    // 检查AST是否有效
    if (!ast) {
      return 'invalid-ast';
    }

    // 如果AST有稳定标识符，优先使用
    if ((ast as any)._stableId) {
      return (ast as any)._stableId;
    }

    // 否则基于AST内容生成哈希
    const text = ast.text || '';
    const structure = this.extractNodeStructure(ast);
    const combined = `${ast.type}:${text.length}:${structure}`;

    // 使用标准化的哈希算法（FNV-1a比简单哈希更可靠）
    return HashUtils.fnv1aHash(combined);
  }

  /**
   * 提取节点结构信息用于哈希计算
   * @param node 节点
   * @param depth 深度
   * @param maxDepth 最大深度
   * @returns 结构字符串
   */
  private static extractNodeStructure(node: Parser.SyntaxNode, depth: number = 0, maxDepth: number = 3): string {
    if (depth > maxDepth) return '...';

    let structure = `${node.type}[${node.childCount}]`;
    if (node.childCount > 0 && depth < maxDepth) {
      const childTypes = Array.from(node.children).slice(0, 5).map(child => child.type);
      structure += `(${childTypes.join(',')})`;
    }

    return structure;
  }

  /**
   * 验证缓存键格式
   * @param cacheKey 缓存键
   * @returns 是否为有效的缓存键
   */
  static isValidCacheKey(cacheKey: string): boolean {
    const validPrefixes = [
      this.SIMPLE_QUERY_PREFIX,
      this.TREE_SITTER_QUERY_PREFIX,
      this.BATCH_QUERY_PREFIX,
      this.AST_PREFIX
    ];

    return validPrefixes.some(prefix => cacheKey.startsWith(prefix));
  }

  /**
   * 从缓存键中提取查询类型
   * @param cacheKey 缓存键
   * @returns 查询类型或null
   */
  static extractQueryType(cacheKey: string): string | null {
    if (!this.isValidCacheKey(cacheKey)) {
      return null;
    }

    const parts = cacheKey.split(':');
    if (parts.length >= 3) {
      return parts[2]; // 第三部分是查询类型
    }

    return null;
  }

  /**
   * 从缓存键中提取语言
   * @param cacheKey 缓存键
   * @returns 语言或null
   */
  static extractLanguage(cacheKey: string): string | null {
    if (!this.isValidCacheKey(cacheKey)) {
      return null;
    }

    const parts = cacheKey.split(':');
    if (parts.length >= 4) {
      return parts[3]; // 第四部分是语言
    }

    return null;
  }
}