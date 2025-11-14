import { GitignoreParser } from '../../service/ignore/GitignoreParser';
import { LoggerService } from '../LoggerService';
import { DEFAULT_IGNORE_PATTERNS } from '../../service/ignore/defaultIgnorePatterns';

export interface TraversalOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  respectGitignore?: boolean;
}

/**
 * 忽略规则管理器，负责处理各种忽略规则的加载和缓存
 */
export class IgnoreRulesManager {
  private cachedIgnorePatterns: Map<string, string[]> = new Map(); // 按根路径缓存忽略模式

  constructor(private logger?: LoggerService) {}

  /**
   * 刷新特定根路径的忽略模式
   * 这允许对忽略规则进行热更新（例如，当 .gitignore 或 .indexignore 文件更改时）
   */
  async refreshIgnoreRules(rootPath: string, options?: TraversalOptions): Promise<void> {
    const allIgnorePatterns: string[] = [];

    // 1. 添加默认忽略模式
    allIgnorePatterns.push(...this.getDefaultIgnorePatterns());

    // 2. 添加 .gitignore 规则（如果启用）
    let gitignorePatterns: string[] = [];
    if (options?.respectGitignore) {
      gitignorePatterns = await GitignoreParser.getAllGitignorePatterns(rootPath);
      if (Array.isArray(gitignorePatterns)) {
        allIgnorePatterns.push(...gitignorePatterns);
      }
    }

    // 3. 添加 .indexignore 规则
    const indexignorePatterns = await GitignoreParser.parseIndexignore(rootPath);
    if (Array.isArray(indexignorePatterns)) {
      allIgnorePatterns.push(...indexignorePatterns);
    }

    // 4. 添加用户自定义排除规则
    if (options?.excludePatterns) {
      allIgnorePatterns.push(...options.excludePatterns);
    }

    // 将模式存储在缓存中
    const uniquePatterns = Array.from(new Set(allIgnorePatterns));
    this.cachedIgnorePatterns.set(rootPath, uniquePatterns); // 去除重复项

    // 记录规则信息（用于调试）
    if (this.logger) {
      this.logger.debug(`[DEBUG] Refreshed ignore patterns for ${rootPath}`, {
        defaultPatterns: this.getDefaultIgnorePatterns().length,
        gitignorePatterns: gitignorePatterns.length,
        indexignorePatterns: Array.isArray(indexignorePatterns) ? indexignorePatterns.length : 0,
        customPatterns: options?.excludePatterns?.length || 0,
        totalPatterns: allIgnorePatterns.length
      });
    }
  }

  /**
   * 获取特定根路径的缓存忽略模式
   */
  getIgnorePatternsForPath(rootPath: string): string[] {
    return this.cachedIgnorePatterns.get(rootPath) || [];
  }

  /**
   * 获取默认忽略模式
   * @returns 默认忽略模式数组
   */
  private getDefaultIgnorePatterns(): string[] {
    // Use the unified default ignore patterns
    return DEFAULT_IGNORE_PATTERNS;
  }

  /**
   * 清除特定路径的缓存忽略模式
   */
  clearCacheForPath(rootPath: string): void {
    this.cachedIgnorePatterns.delete(rootPath);
  }

  /**
   * 清除所有缓存的忽略模式
   */
  clearAllCache(): void {
    this.cachedIgnorePatterns.clear();
  }

  /**
   * 获取已缓存的路径列表
   */
  getCachedPaths(): string[] {
    return Array.from(this.cachedIgnorePatterns.keys());
  }

  /**
   * 检查路径是否已缓存
   */
  isPathCached(rootPath: string): boolean {
    return this.cachedIgnorePatterns.has(rootPath);
  }
}