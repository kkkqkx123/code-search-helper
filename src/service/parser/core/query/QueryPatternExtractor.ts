/**
 * 查询模式提取器工具类
 * 提供统一的查询模式提取逻辑，避免代码重复
 */
export class QueryPatternExtractor {
  /**
   * 从查询字符串中提取特定关键词的模式
   * @param query 完整查询字符串
   * @param keywords 关键词列表
   * @returns 提取的模式数组
   */
  static extractPatterns(query: string, keywords: string[]): string[] {
    const lines = query.split('\n');
    const patterns: string[] = [];
    let currentPattern: string[] = [];
    let inPattern = false;
    let parenDepth = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 跳过空行和注释
      if (!trimmedLine || trimmedLine.startsWith(';') || trimmedLine.startsWith('//')) {
        if (currentPattern.length > 0 && parenDepth === 0) {
          patterns.push(currentPattern.join('\n'));
          currentPattern = [];
          inPattern = false;
        }
        continue;
      }

      // 检查是否包含目标关键词
      const hasKeyword = keywords.some(keyword =>
        trimmedLine.includes(`(${keyword}`) ||
        trimmedLine.includes(` ${keyword} `) ||
        trimmedLine.includes(`@${keyword}`)
      );

      if (hasKeyword || inPattern) {
        currentPattern.push(line);
        inPattern = true;

        // 计算括号深度
        parenDepth += (line.match(/\(/g) || []).length;
        parenDepth -= (line.match(/\)/g) || []).length;

        // 如果括号平衡，可能是一个完整的模式
        if (parenDepth === 0 && currentPattern.length > 0) {
          patterns.push(currentPattern.join('\n'));
          currentPattern = [];
          inPattern = false;
        }
      }
    }

    // 处理未完成的模式
    if (currentPattern.length > 0 && parenDepth === 0) {
      patterns.push(currentPattern.join('\n'));
    }

    return patterns;
  }

  /**
   * 根据查询类型和关键词映射提取所有模式
   * @param query 完整查询字符串
   * @param queryPatterns 查询类型到关键词的映射
   * @returns 查询类型到模式字符串的映射
   */
  static extractAllPatterns(
    query: string, 
    queryPatterns: Record<string, string[]>
  ): Map<string, string> {
    const result = new Map<string, string>();

    for (const [queryType, keywords] of Object.entries(queryPatterns)) {
      const patterns = this.extractPatterns(query, keywords);
      if (patterns.length > 0) {
        result.set(queryType, patterns.join('\n\n'));
      }
    }

    return result;
  }
}