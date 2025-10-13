import { CodeChunk } from '../types';

/**
 * 代码质量评估工具类
 * 提供评估代码块和重叠内容质量的方法
 */
export class CodeQualityAssessmentUtils {
  /**
   * 计算重叠内容的质量评分
   * @param lines 重叠内容的行数组
   * @param currentChunk 当前代码块
   * @param nextChunk 下一个代码块
   * @returns 质量评分 (0-1)
   */
  static calculateOverlapQuality(lines: string[], currentChunk: CodeChunk, nextChunk: CodeChunk): number {
    if (lines.length === 0) return 0;

    let quality = 0;
    const firstLine = lines[0]?.trim() || '';
    const lastLine = lines[lines.length - 1]?.trim() || '';

    if (this.isFunctionStart(firstLine) || this.isClassStart(firstLine)) {
      quality += 0.3;
    }

    if (lastLine.match(/^[}\])];?]?$/)) {
      quality += 0.2;
    }

    if (firstLine.match(/^\/\//) || firstLine.match(/^\/\*/)) {
      quality += 0.1;
    }

    if (lines.length > 0 && lines.length < 10) {
      quality += 0.2;
    }

    const meaningfulLines = lines.filter(line =>
      line.trim() !== '' &&
      !line.trim().match(/^\/\//) &&
      !line.trim().match(/^\/\*/)
    );

    if (meaningfulLines.length / lines.length > 0.5) {
      quality += 0.2;
    }

    return Math.min(quality, 1.0);
  }

 /**
   * 检查行是否为函数开始
   */
  static isFunctionStart(line: string): boolean {
    return /^function\s+\w+\s*\(/.test(line) ||
      /^\w+\s*=\s*\([^)]*\)\s*=>/.test(line) ||
      /^\s*async\s+function/.test(line) ||
      /^\s*static\s+\w+\s*\(/.test(line) ||
      /^\s*\w+\s*\([^)]*\)\s*\{/.test(line);
  }

  /**
   * 检查行是否为类开始
   */
  static isClassStart(line: string): boolean {
    return /^class\s+\w+/.test(line) ||
      /^export\s+default\s+class/.test(line) ||
      /^export\s+class/.test(line);
  }

  /**
   * 检查行是否为函数签名
   */
  static isFunctionSignature(line: string): boolean {
    const trimmed = line.trim();
    return /^function\s+\w+\s*\(/.test(trimmed) ||
      /^\w+\s*=\s*\([^)]*\)\s*=>/.test(trimmed) ||
      /^\s*\w+\s*\([^)]*\)\s*:\s*\w+\s*=>/.test(trimmed) ||
      /^\s*\w+\s*:\s*\([^)]*\)\s*=>/.test(trimmed);
  }

 /**
   * 检查两个代码块是否为连续函数
   */
  static isSequentialFunctions(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    const currentLines = currentChunk.content.split('\n');
    const nextLines = nextChunk.content.split('\n');

    const lastLineOfCurrent = currentLines[currentLines.length - 1]?.trim() || '';
    const firstLineOfNext = nextLines[0]?.trim() || '';

    return (lastLineOfCurrent.endsWith('}') &&
      (firstLineOfNext.startsWith('function') ||
        !!firstLineOfNext.match(/^\w+\s*\([^)]*\)\s*{/)));
  }

  /**
   * 检查代码块是否为复杂结构
   */
  static isComplexStructure(chunk: CodeChunk): boolean {
    const lines = chunk.content.split('\n');
    let braceDepth = 0;
    let maxDepth = 0;

    for (const line of lines) {
      for (const char of line) {
        if (char === '{') {
          braceDepth++;
          maxDepth = Math.max(maxDepth, braceDepth);
        } else if (char === '}') {
          braceDepth--;
        }
      }
    }

    return maxDepth > 2;
  }

  /**
   * 检查代码是否为简单代码
   */
  static isSimpleCode(currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    const currentLines = currentChunk.content.split('\n');
    const nextLines = nextChunk.content.split('\n');

    const allLines = [...currentLines, ...nextLines];
    return allLines.every(line =>
      line.trim().startsWith('const') ||
      line.trim().startsWith('let') ||
      line.trim().startsWith('var') ||
      line.trim().startsWith('import') ||
      line.trim().startsWith('export') ||
      line.trim().match(/^\w+\s*=/)
    );
  }
}