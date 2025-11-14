import * as path from 'path';

export interface TraversalOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  ignoreHiddenFiles?: boolean;
  ignoreDirectories?: string[];
}

/**
 * 模式匹配工具类，用于处理文件和目录的忽略规则
 */
export class PatternMatcher {
  /**
   * 检查目录是否应该被忽略
   */
  static shouldIgnoreDirectory(dirName: string, options: Required<TraversalOptions>): boolean {
    if (options.ignoreHiddenFiles && dirName.startsWith('.')) {
      return true;
    }

    return options.ignoreDirectories.includes(dirName);
  }

  /**
   * 检查文件是否应该被忽略
   */
  static shouldIgnoreFile(relativePath: string, options: Required<TraversalOptions>): boolean {
    if (options.ignoreHiddenFiles && path.basename(relativePath).startsWith('.')) {
      return true;
    }

    const fileName = path.basename(relativePath).toLowerCase();

    // 检查 excludePatterns 是否为数组，然后再进行迭代
    if (Array.isArray(options.excludePatterns)) {
      for (const pattern of options.excludePatterns) {
        if (this.matchesPattern(relativePath, pattern)) {
          return true;
        }
      }
    }

    // 如果未指定包含模式，则不过滤包含模式
    if (!Array.isArray(options.includePatterns) || options.includePatterns.length === 0) {
      return false;
    }

    // 如果指定了包含模式，则文件必须匹配至少一个
    for (const pattern of options.includePatterns) {
      if (this.matchesPattern(relativePath, pattern)) {
        return false;
      }
    }
    return true;
  }

  /**
   * 检查文件路径是否匹配给定的模式
   */
  static matchesPattern(filePath: string, pattern: string): boolean {
    try {
      // 将 glob 模式转换为正则表达式
      let regexPattern = pattern
        .replace(/\*\*/g, '__DOUBLE_ASTERISK__')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]')
        .replace(/\./g, '\\.')
        .replace(/__DOUBLE_ASTERISK__/g, '.*');

      // 确保模式匹配整个路径
      if (!regexPattern.startsWith('^')) {
        regexPattern = '^' + regexPattern;
      }
      if (!regexPattern.endsWith('$')) {
        regexPattern = regexPattern + '$';
      }

      const regex = new RegExp(regexPattern);
      if (regex.test(filePath)) {
        return true;
      }

      // 特殊情况：对于像 **/*.js 这样的模式 - 也尝试不带路径部分的匹配
      if (pattern.startsWith('**/') && pattern.includes('/') && !filePath.includes('/')) {
        const filenameOnlyPattern = pattern.replace(/^\*\*\//, '');
        let filenameRegexPattern = filenameOnlyPattern
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '[^/]')
          .replace(/\./g, '\\.');

        if (!filenameRegexPattern.startsWith('^')) {
          filenameRegexPattern = '^' + filenameRegexPattern;
        }
        if (!filenameRegexPattern.endsWith('$')) {
          filenameRegexPattern = filenameRegexPattern + '$';
        }

        const filenameRegex = new RegExp(filenameRegexPattern);
        if (filenameRegex.test(filePath)) {
          return true;
        }
      }

      // 对于期望目录路径的模式（如 **/*.js），也检查模式是否仅匹配文件名部分
      // 对于 filePath 只是文件名的情况
      if (pattern.includes('/') && !filePath.includes('/')) {
        // 从模式中提取文件名部分（最后一个 / 之后）
        const lastSlashIndex = pattern.lastIndexOf('/');
        if (lastSlashIndex !== -1) {
          const filenamePattern = pattern.substring(lastSlashIndex + 1);
          // 将此文件名模式转换为正则表达式并测试 filePath
          // 对于像 *.js 这样的文件名模式，我们希望匹配以 .js 结尾的文件
          // 我们需要小心转义 - 只转义字面量点号
          let filenameRegexPattern = filenamePattern
            .replace(/\*/g, '.*')   // 将 * 替换为 .*
            .replace(/\?/g, '.')    // 将 ? 替换为 .
            .replace(/\./g, '\\.'); // 转义字面量点号（这需要最后执行以避免转义我们刚添加的点号）

          if (!filenameRegexPattern.startsWith('^')) {
            filenameRegexPattern = '^' + filenameRegexPattern;
          }
          if (!filenameRegexPattern.endsWith('$')) {
            filenameRegexPattern = filenameRegexPattern + '$';
          }

          const filenameRegex = new RegExp(filenameRegexPattern);
          if (filenameRegex.test(filePath)) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      // 如果模式无效，则返回 false
      return false;
    }
  }
}