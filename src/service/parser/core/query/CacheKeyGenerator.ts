import Parser from 'tree-sitter';

/**
 * 统一的缓存键生成器
 * 为不同查询引擎提供一致的缓存键生成策略，避免键冲突
 */
export class CacheKeyGenerator {
  // 缓存键前缀，用于区分不同引擎
  private static readonly SIMPLE_QUERY_PREFIX = 'simple:';
  private static readonly TREE_SITTER_QUERY_PREFIX = 'treesitter:';
  private static readonly BATCH_QUERY_PREFIX = 'batch:';

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
    const typesKey = types.sort().join(',');
    return `${this.BATCH_QUERY_PREFIX}${contentHash}:batch:${typesKey}:${language}`;
  }

  /**
   * 生成AST内容的哈希值
   * @param ast AST节点
   * @returns 内容哈希
   */
  private static generateContentHash(ast: Parser.SyntaxNode): string {
    // 如果AST有稳定标识符，优先使用
    if ((ast as any)._stableId) {
      return (ast as any)._stableId;
    }

    // 否则基于AST内容生成哈希
    const text = ast.text || '';
    const structure = this.extractNodeStructure(ast);
    const combined = `${ast.type}:${text.length}:${structure}`;
    
    // 简单哈希算法
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString();
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
      this.BATCH_QUERY_PREFIX
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