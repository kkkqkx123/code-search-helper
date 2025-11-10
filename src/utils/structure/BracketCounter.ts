/**
 * 括号计数结果接口
 */
export interface BracketCountResult {
  open: number;
  close: number;
  balanced: boolean;
  depth: number;
}

/**
 * 括号计数工具类
 * 提供统一的括号平衡检查和嵌套深度计算
 */
export class BracketCounter {
  /**
   * 计算大括号的平衡和深度（仅计算 {}）
   * 用于单行处理
   */
  static countCurlyBrackets(line: string): BracketCountResult {
    const openBrackets = (line.match(/\{/g) || []).length;
    const closeBrackets = (line.match(/\}/g) || []).length;
    
    let currentDepth = 0;
    let maxDepth = 0;

    for (const char of line) {
      if (char === '{') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}') {
        currentDepth--;
      }
    }

    return {
      open: openBrackets,
      close: closeBrackets,
      balanced: openBrackets === closeBrackets,
      depth: maxDepth
    };
  }

  /**
   * 计算所有类型括号的最大嵌套深度
   * 用于整个内容处理，支持 {}()[]
   */
  static calculateMaxNestingDepth(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (const char of content) {
      if (char === '{' || char === '(' || char === '[') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '}' || char === ')' || char === ']') {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    return maxDepth;
  }

  /**
   * 检查括号是否平衡
   */
  static areBracketsBalanced(content: string): boolean {
    let braceCount = 0;
    let parenCount = 0;
    let bracketCount = 0;

    for (const char of content) {
      switch (char) {
        case '{': braceCount++; break;
        case '}': braceCount--; break;
        case '(': parenCount++; break;
        case ')': parenCount--; break;
        case '[': bracketCount++; break;
        case ']': bracketCount--; break;
      }
    }

    return braceCount === 0 && parenCount === 0 && bracketCount === 0;
  }
}