import { injectable } from 'inversify';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

@injectable()
export class GraphQueryValidator {
  private readonly maxQueryLength: number = 10000;
  private readonly dangerousKeywords: string[] = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE USER', 'GRANT', 'REVOKE'];

  validateQuery(query: string): ValidationResult {
    // 检查查询长度
    if (query.length > this.maxQueryLength) {
      return {
        valid: false,
        error: `Query too long. Maximum length is ${this.maxQueryLength} characters.`
      };
    }

    // 检查危险关键字
    const upperQuery = query.toUpperCase();
    for (const keyword of this.dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        return {
          valid: false,
          error: `Dangerous keyword detected: ${keyword}`
        };
      }
    }

    // 基本语法检查 - 检查是否有匹配的括号
    const openParenCount = (query.match(/\(/g) || []).length;
    const closeParenCount = (query.match(/\)/g) || []).length;
    if (openParenCount !== closeParenCount) {
      return {
        valid: false,
        error: 'Unmatched parentheses in query'
      };
    }

    return { valid: true };
  }

  validateProjectId(projectId: string): ValidationResult {
    // 检查项目ID格式 - 只允许字母、数字、连字符和下划线
    if (!/^[a-zA-Z0-9-_]+$/.test(projectId)) {
      return {
        valid: false,
        error: 'Invalid project ID format. Only letters, numbers, hyphens, and underscores are allowed.'
      };
    }

    if (projectId.length < 3 || projectId.length > 50) {
      return {
        valid: false,
        error: 'Project ID must be between 3 and 50 characters long.'
      };
    }

    return { valid: true };
  }

  validateNodeId(nodeId: string): ValidationResult {
    if (!nodeId || nodeId.length === 0) {
      return {
        valid: false,
        error: 'Node ID cannot be empty.'
      };
    }

    if (nodeId.length > 1000) {
      return {
        valid: false,
        error: 'Node ID is too long. Maximum length is 1000 characters.'
      };
    }

    return { valid: true };
  }
}