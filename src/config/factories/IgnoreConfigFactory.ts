import { DEFAULT_IGNORE_PATTERNS } from '../../service/ignore/defaultIgnorePatterns';
import { GitignoreParser } from '../../service/ignore/GitignoreParser';

/**
 * 忽略规则配置工厂
 * 负责生成统一的忽略规则配置，避免硬编码和重复定义
 */
export class IgnoreConfigFactory {
  /**
   * 创建默认的忽略规则
   * @returns 统一的默认忽略规则数组
   */
  static createDefaultIgnorePatterns(): string[] {
    return [...DEFAULT_IGNORE_PATTERNS];
  }

  /**
   * 创建项目特定的忽略规则
   * @param projectPath 项目路径
   * @returns 包含默认规则和项目特定规则的合并数组
   */
  static async createProjectIgnorePatterns(projectPath: string): Promise<string[]> {
    const patterns: string[] = [];

    // 1. 添加默认规则
    patterns.push(...DEFAULT_IGNORE_PATTERNS);

    // 2. 添加 .gitignore 规则
    try {
      const gitignorePatterns = await GitignoreParser.getAllGitignorePatterns(projectPath);
      patterns.push(...gitignorePatterns);
    } catch (error) {
      // 忽略错误，继续使用默认规则
    }

    // 3. 添加 .indexignore 规则
    try {
      const indexignorePatterns = await GitignoreParser.parseIndexignore(projectPath);
      patterns.push(...indexignorePatterns);
    } catch (error) {
      // 忽略错误，继续使用默认规则
    }

    // 去重并返回
    return [...new Set(patterns)];
  }

  /**
   * 创建用于热更新的默认忽略规则
   * @returns 适用于热更新的默认忽略规则
   */
  static createHotReloadIgnorePatterns(): string[] {
    // 热更新可能需要更严格的忽略规则，避免监听过多文件
    return [
      ...DEFAULT_IGNORE_PATTERNS,
      // 额外的热更新特定规则
      '**/*.tmp',
      '**/*.temp',
      '**/.#*',
      '**/#*#',
      '**/.*.swp',
      '**/.*.swo',
      '**/.*.swn'
    ];
  }

  /**
   * 验证忽略规则是否有效
   * @param patterns 忽略规则数组
   * @returns 验证结果
   */
  static validateIgnorePatterns(patterns: string[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(patterns)) {
      errors.push('Ignore patterns must be an array');
      return { isValid: false, errors };
    }

    for (const pattern of patterns) {
      if (typeof pattern !== 'string') {
        errors.push(`Ignore pattern must be a string, got ${typeof pattern}: ${pattern}`);
      } else if (pattern.trim() === '') {
        errors.push('Ignore pattern cannot be empty string');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 合并多组忽略规则
   * @param patternSets 多组忽略规则
   * @returns 合并并去重后的忽略规则
   */
  static mergeIgnorePatterns(...patternSets: string[][]): string[] {
    const allPatterns: string[] = [];

    for (const patterns of patternSets) {
      if (Array.isArray(patterns)) {
        allPatterns.push(...patterns);
      }
    }

    // 去重并返回
    return [...new Set(allPatterns)];
  }

  /**
   * 过滤无效的忽略规则
   * @param patterns 忽略规则数组
   * @returns 过滤后的有效忽略规则
   */
  static filterValidPatterns(patterns: string[]): string[] {
    return patterns.filter(pattern =>
      typeof pattern === 'string' &&
      pattern.trim() !== '' &&
      !pattern.trim().startsWith('#') // 排除注释
    );
  }
}