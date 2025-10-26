// 统一处理层工具函数
// 整合了各种工具函数和辅助方法

import { CodeChunk, CodeChunkMetadata, ChunkingOptions } from '../../interfaces/ISplitStrategy';
import { ProcessingMetrics, ProcessingError } from '../types';

/**
 * 内容分析工具
 */
class ContentAnalyzer {
  /**
   * 计算内容复杂度
   */
  static calculateComplexity(content: string, language: string): number {
    const lines = content.split('\n');
    let complexity = lines.length;

    // 嵌套结构
    const nestedBrackets = (content.match(/\{[^{}]*\{/g) || []).length;
    const nestedParens = (content.match(/\([^()]*\(/g) || []).length;
    complexity += nestedBrackets * 2 + nestedParens;

    // 控制结构
    const controlStructures = (content.match(/if|for|while|switch|case|try|catch/g) || []).length;
    complexity += controlStructures;

    // 语言特定复杂度
    switch (language.toLowerCase()) {
      case 'typescript':
      case 'javascript':
        complexity += this.calculateJSComplexity(content);
        break;
      case 'python':
        complexity += this.calculatePythonComplexity(content);
        break;
      case 'java':
        complexity += this.calculateJavaComplexity(content);
        break;
    }

    return complexity;
  }

  /**
   * 计算JavaScript/TypeScript复杂度
   */
  private static calculateJSComplexity(content: string): number {
    let complexity = 0;
    
    // 箭头函数
    complexity += (content.match(/=>\s*\{/g) || []).length * 2;
    
    // 异步函数
    complexity += (content.match(/async\s+|await\s+/g) || []).length * 2;
    
    // 解构赋值
    complexity += (content.match(/\{[^}]*\}\s*=/g) || []).length;
    
    // 模板字符串
    complexity += (content.match(/`[^`]*`/g) || []).length;
    
    return complexity;
  }

  /**
   * 计算Python复杂度
   */
  private static calculatePythonComplexity(content: string): number {
    let complexity = 0;
    
    // 装饰器
    complexity += (content.match(/@\w+/g) || []).length * 2;
    
    // 列表推导式
    complexity += (content.match(/\[.*for.*in.*\]/g) || []).length * 2;
    
    // 生成器表达式
    complexity += (content.match(/\(.*for.*in.*\)/g) || []).length * 2;
    
    // 上下文管理器
    complexity += (content.match(/with\s+/g) || []).length;
    
    return complexity;
  }

  /**
   * 计算Java复杂度
   */
  private static calculateJavaComplexity(content: string): number {
    let complexity = 0;
    
    // 注解
    complexity += (content.match(/@\w+/g) || []).length;
    
    // 泛型
    complexity += (content.match(/<[^>]+>/g) || []).length;
    
    // Lambda表达式
    complexity += (content.match(/\([^)]*\)\s*->/g) || []).length * 2;
    
    // 流式API
    complexity += (content.match(/\.stream\(\)|\.collect\(/g) || []).length * 2;
    
    return complexity;
  }

  /**
   * 分析内容特征
   */
  static analyzeFeatures(content: string, language: string): {
    hasImports: boolean;
    hasExports: boolean;
    hasFunctions: boolean;
    hasClasses: boolean;
    hasComments: boolean;
    hasStrings: boolean;
    hasNumbers: boolean;
    lineCount: number;
    charCount: number;
    wordCount: number;
  } {
    const lines = content.split('\n');
    
    return {
      hasImports: this.hasImports(content, language),
      hasExports: this.hasExports(content, language),
      hasFunctions: this.hasFunctions(content, language),
      hasClasses: this.hasClasses(content, language),
      hasComments: this.hasComments(content, language),
      hasStrings: this.hasStrings(content),
      hasNumbers: this.hasNumbers(content),
      lineCount: lines.length,
      charCount: content.length,
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length
    };
  }

  private static hasImports(content: string, language: string): boolean {
    const patterns: Record<string, RegExp> = {
      typescript: /import\s+|require\s*\(/,
      javascript: /import\s+|require\s*\(/,
      python: /import\s+|from\s+.*\s+import/,
      java: /import\s+/,
      go: /import\s+/,
      rust: /use\s+/,
      c: /#include/,
      cpp: /#include|using\s+namespace/
    };

    const pattern = patterns[language.toLowerCase()];
    return pattern ? pattern.test(content) : false;
  }

  private static hasExports(content: string, language: string): boolean {
    const patterns: Record<string, RegExp> = {
      typescript: /export\s+/,
      javascript: /export\s+|module\.exports/,
      python: /__all__\s*=/
    };

    const pattern = patterns[language.toLowerCase()];
    return pattern ? pattern.test(content) : false;
  }

  private static hasFunctions(content: string, language: string): boolean {
    const patterns: Record<string, RegExp> = {
      typescript: /function\s+\w+|=>\s*\{|const\s+\w+\s*=\s*\(/,
      javascript: /function\s+\w+|=>\s*\{|const\s+\w+\s*=\s*\(/,
      python: /def\s+\w+/,
      java: /\w+\s+\w+\s*\([^)]*\)\s*\{/,
      go: /func\s+\w+/,
      rust: /fn\s+\w+/
    };

    const pattern = patterns[language.toLowerCase()];
    return pattern ? pattern.test(content) : false;
  }

  private static hasClasses(content: string, language: string): boolean {
    const patterns: Record<string, RegExp> = {
      typescript: /class\s+\w+/,
      javascript: /class\s+\w+/,
      python: /class\s+\w+/,
      java: /class\s+\w+/,
      go: /type\s+\w+\s+struct/,
      rust: /struct\s+\w+/
    };

    const pattern = patterns[language.toLowerCase()];
    return pattern ? pattern.test(content) : false;
  }

  private static hasComments(content: string, language: string): boolean {
    const patterns: Record<string, RegExp> = {
      typescript: /\/\/.*|\/\*[\s\S]*?\*\//,
      javascript: /\/\/.*|\/\*[\s\S]*?\*\//,
      python: /#.*|'''[\s\S]*?'''|"""[\s\S]*?"""/,
      java: /\/\/.*|\/\*[\s\S]*?\*\//,
      go: /\/\/.*|\/\*[\s\S]*?\*\//,
      rust: /\/\/.*|\/\*[\s\S]*?\*\//,
      c: /\/\/.*|\/\*[\s\S]*?\*\//,
      cpp: /\/\/.*|\/\*[\s\S]*?\*\//,
      html: /<!--[\s\S]*?-->/,
      css: /\/\*[\s\S]*?\*\//,
      yaml: /#.*/
    };

    const pattern = patterns[language.toLowerCase()];
    return pattern ? pattern.test(content) : false;
  }

  private static hasStrings(content: string): boolean {
    return /["'].*["']/.test(content);
  }

  private static hasNumbers(content: string): boolean {
    return /\d+/.test(content);
  }
}

/**
 * 代码块处理工具
 */
class ChunkProcessor {
  /**
   * 验证代码块
   */
  static validateChunk(chunk: CodeChunk): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!chunk.content || typeof chunk.content !== 'string') {
      errors.push('Invalid chunk content');
    }

    if (!chunk.metadata || typeof chunk.metadata !== 'object') {
      errors.push('Invalid chunk metadata');
    } else {
      if (!chunk.metadata.startLine || chunk.metadata.startLine < 1) {
        errors.push('Invalid startLine');
      }
      if (!chunk.metadata.endLine || chunk.metadata.endLine < chunk.metadata.startLine) {
        errors.push('Invalid endLine');
      }
      if (!chunk.metadata.language) {
        errors.push('Missing language');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 合并相邻的代码块
   */
  static mergeChunks(chunks: CodeChunk[], options: {
    maxChunkSize?: number;
    preserveBoundaries?: boolean;
  } = {}): CodeChunk[] {
    const { maxChunkSize = Infinity, preserveBoundaries = true } = options;
    const merged: CodeChunk[] = [];
    let current: CodeChunk | null = null;

    for (const chunk of chunks) {
      if (!current) {
        current = { ...chunk };
        continue;
      }

      const shouldMerge = !preserveBoundaries || 
        (current.metadata.endLine + 1 === chunk.metadata.startLine);

      if (shouldMerge && current.content.length + chunk.content.length <= maxChunkSize) {
        // 合并块
        current.content += '\n' + chunk.content;
        current.metadata.endLine = chunk.metadata.endLine;
        current.metadata.startByte = Math.min(current.metadata.startByte || 0, chunk.metadata.startByte || 0);
        current.metadata.endByte = Math.max(current.metadata.endByte || 0, chunk.metadata.endByte || 0);
      } else {
        // 保存当前块，开始新块
        merged.push(current);
        current = { ...chunk };
      }
    }

    if (current) {
      merged.push(current);
    }

    return merged;
  }

  /**
   * 过滤代码块
   */
  static filterChunks(chunks: CodeChunk[], filter: (chunk: CodeChunk) => boolean): CodeChunk[] {
    return chunks.filter(filter);
  }

  /**
   * 排序代码块
   */
  static sortChunks(chunks: CodeChunk[], sortBy: 'startLine' | 'size' | 'complexity' = 'startLine'): CodeChunk[] {
    return [...chunks].sort((a, b) => {
      switch (sortBy) {
        case 'startLine':
          return a.metadata.startLine - b.metadata.startLine;
        case 'size':
          return a.content.length - b.content.length;
        case 'complexity':
          return (a.metadata.complexity || 0) - (b.metadata.complexity || 0);
        default:
          return 0;
      }
    });
  }

  /**
   * 计算代码块统计信息
   */
  static calculateChunkStats(chunks: CodeChunk[]): {
    totalChunks: number;
    totalSize: number;
    averageSize: number;
    minSize: number;
    maxSize: number;
    totalLines: number;
    averageLines: number;
    minLines: number;
    maxLines: number;
    languageDistribution: Map<string, number>;
    typeDistribution: Map<string, number>;
  } {
    if (chunks.length === 0) {
      return {
        totalChunks: 0,
        totalSize: 0,
        averageSize: 0,
        minSize: 0,
        maxSize: 0,
        totalLines: 0,
        averageLines: 0,
        minLines: 0,
        maxLines: 0,
        languageDistribution: new Map(),
        typeDistribution: new Map()
      };
    }

    const sizes = chunks.map(chunk => chunk.content.length);
    const lineCounts = chunks.map(chunk => chunk.metadata.endLine - chunk.metadata.startLine + 1);
    const languageDistribution = new Map<string, number>();
    const typeDistribution = new Map<string, number>();

    for (const chunk of chunks) {
      const lang = chunk.metadata.language || 'unknown';
      languageDistribution.set(lang, (languageDistribution.get(lang) || 0) + 1);

      const type = chunk.metadata.type || 'unknown';
      typeDistribution.set(type, (typeDistribution.get(type) || 0) + 1);
    }

    return {
      totalChunks: chunks.length,
      totalSize: sizes.reduce((sum, size) => sum + size, 0),
      averageSize: sizes.reduce((sum, size) => sum + size, 0) / chunks.length,
      minSize: Math.min(...sizes),
      maxSize: Math.max(...sizes),
      totalLines: lineCounts.reduce((sum, count) => sum + count, 0),
      averageLines: lineCounts.reduce((sum, count) => sum + count, 0) / chunks.length,
      minLines: Math.min(...lineCounts),
      maxLines: Math.max(...lineCounts),
      languageDistribution,
      typeDistribution
    };
  }
}

/**
 * 性能监控工具
 */
class PerformanceMonitor {
  private static timers: Map<string, number> = new Map();
  private static metrics: Map<string, number[]> = new Map();

  /**
   * 开始计时
   */
  static startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  /**
   * 结束计时并返回耗时
   */
  static endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      throw new ProcessingError(`Timer '${name}' not found`, 'TIMER_NOT_FOUND');
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    // 记录指标
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);

    return duration;
  }

  /**
   * 获取指标统计
   */
  static getMetrics(name: string): {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
  } | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    return {
      count: values.length,
      total: values.reduce((sum, val) => sum + val, 0),
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  /**
   * 获取所有指标
   */
  static getAllMetrics(): Map<string, {
    count: number;
    total: number;
    average: number;
    min: number;
    max: number;
  }> {
    const result = new Map();
    for (const name of this.metrics.keys()) {
      const metrics = this.getMetrics(name);
      if (metrics) {
        result.set(name, metrics);
      }
    }
    return result;
  }

  /**
   * 清除指标
   */
  static clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name);
      this.timers.delete(name);
    } else {
      this.metrics.clear();
      this.timers.clear();
    }
  }

  /**
   * 创建处理指标
   */
  static createProcessingMetrics(
    processingTime: number,
    detectionTime: number,
    strategySelectionTime: number,
    executionTime: number,
    chunks: CodeChunk[]
  ): ProcessingMetrics {
    const chunkStats = ChunkProcessor.calculateChunkStats(chunks);
    const memoryUsage = process.memoryUsage();

    return {
      processingTime,
      detectionTime,
      strategySelectionTime,
      executionTime,
      memoryUsage,
      peakMemoryUsage: memoryUsage.heapUsed,
      chunkCount: chunkStats.totalChunks,
      averageChunkSize: chunkStats.averageSize,
      totalChunkSize: chunkStats.totalSize,
      compressionRatio: chunks.length > 0 ? chunkStats.totalSize / chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) : 1,
      errorCount: 0,
      warningCount: 0,
      retryCount: 0,
      fallbackCount: 0
    };
  }
}

/**
 * 字符串处理工具
 */
class StringUtils {
  /**
   * 安全地截取字符串
   */
  static safeSubstring(str: string, start: number, end?: number): string {
    if (start < 0) start = 0;
    if (start >= str.length) return '';
    if (end === undefined) end = str.length;
    if (end < 0) end = 0;
    if (end > str.length) end = str.length;
    if (start >= end) return '';
    
    return str.substring(start, end);
  }

  /**
   * 计算字符串哈希
   */
  static hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(36);
  }

  /**
   * 计算字符串相似度
   */
  static similarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 计算编辑距离
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * 规范化字符串
   */
  static normalize(str: string): string {
    return str
      .replace(/\r\n/g, '\n') // 统一换行符
      .replace(/\t/g, '  ') // 制表符转空格
      .replace(/\s+$/gm, '') // 移除行尾空格
      .trim(); // 移除首尾空格
  }

  /**
   * 提取字符串前缀
   */
  static extractPrefix(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return this.safeSubstring(str, 0, maxLength - 3) + '...';
  }

  /**
   * 提取字符串后缀
   */
  static extractSuffix(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return '...' + this.safeSubstring(str, str.length - maxLength + 3);
  }
}

/**
 * 数组处理工具
 */
class ArrayUtils {
  /**
   * 批处理数组
   */
  static batch<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 去重
   */
  static unique<T>(array: T[], keyFn?: (item: T) => any): T[] {
    if (!keyFn) {
      return [...new Set(array)];
    }
    
    const seen = new Set();
    return array.filter(item => {
      const key = keyFn(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 分组
   */
  static groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups, item) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<string, T[]>);
  }

  /**
   * 排序
   */
  static sortBy<T>(array: T[], keyFn: (item: T) => any, direction: 'asc' | 'desc' = 'asc'): T[] {
    return [...array].sort((a, b) => {
      const aVal = keyFn(a);
      const bVal = keyFn(b);
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
}

// 导出所有工具类
export {
  ContentAnalyzer,
  ChunkProcessor,
  PerformanceMonitor,
  StringUtils,
  ArrayUtils
};

// 导出子模块
export * from './chunking';
export * from './context';
export * from './coordination';
export * from './calculation';