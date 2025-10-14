import { CodeChunk } from '../types';
import { structureDetector } from '../../utils';

/**
 * 代码质量评估工具类
 * 提供评估代码块和重叠内容质量的方法
 * 此类现在完全使用公共的结构检测器
 */
export class CodeQualityAssessmentUtils {
  private static structureDetector = structureDetector;

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

    if (this.structureDetector.isFunctionStart(firstLine) || this.structureDetector.isClassStart(firstLine)) {
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
   * @param line 代码行
   * @returns 是否为函数开始
   */
  static isFunctionStart(line: string): boolean {
    return this.structureDetector.isFunctionStart(line);
  }

  /**
   * 检查行是否为类开始
   * @param line 代码行
   * @returns 是否为类开始
   */
  static isClassStart(line: string): boolean {
    return this.structureDetector.isClassStart(line);
  }

  /**
   * 检查行是否为函数签名
   * @param line 代码行
   * @returns 是否为函数签名
   */
  static isFunctionSignature(line: string): boolean {
    return this.structureDetector.isFunctionSignature(line);
  }

  /**
   * 检查两个代码块是否为连续函数
   * @param currentChunk 当前代码块
   * @param nextChunk 下一个代码块
   * @returns 是否为连续函数
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
   * @param chunk 代码块
   * @returns 是否为复杂结构
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
   * @param currentChunk 当前代码块
   * @param nextChunk 下一个代码块
   * @returns 是否为简单代码
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

  /**
   * 检测代码结构类型
   * @param line 代码行
   * @returns 结构类型名称或null
   */
  static detectStructureType(line: string): string | null {
    return this.structureDetector.detectStructureType(line);
  }

  /**
   * 检查行是否为变量声明
   * @param line 代码行
   * @returns 是否为变量声明
   */
  static isVariableDeclaration(line: string): boolean {
    return this.structureDetector.isVariableDeclaration(line);
  }

  /**
   * 检查行是否为控制流语句
   * @param line 代码行
   * @returns 是否为控制流语句
   */
  static isControlFlowStatement(line: string): boolean {
    return this.structureDetector.isControlFlowStatement(line);
  }

  /**
   * 检查行是否为空行
   * @param line 代码行
   * @returns 是否为空行
   */
  static isEmptyLine(line: string): boolean {
    return this.structureDetector.isEmptyLine(line);
  }

  /**
   * 检查行是否包含错误标记
   * @param line 代码行
   * @returns 是否包含错误标记
   */
  static hasErrorMarkers(line: string): boolean {
    return this.structureDetector.hasErrorMarkers(line);
  }

  /**
   * 评估代码块的整体质量
   * @param chunk 代码块
   * @returns 质量评分 (0-1)
   */
  static assessCodeQuality(chunk: CodeChunk): number {
    const lines = chunk.content.split('\n');
    let quality = 0;

    // 检查代码结构完整性
    if (this.hasBalancedBraces(chunk.content)) {
      quality += 0.3;
    }

    // 检查注释覆盖率
    const commentLines = lines.filter(line =>
      line.trim().startsWith('//') ||
      line.trim().startsWith('/*') ||
      line.trim().startsWith('*')
    );
    const commentRatio = commentLines.length / lines.length;
    quality += Math.min(commentRatio * 0.5, 0.2);

    // 检查函数和类的命名规范
    const hasWellNamedStructures = this.checkNamingConventions(lines);
    if (hasWellNamedStructures) {
      quality += 0.2;
    }

    // 检查代码复杂度
    if (!this.isComplexStructure(chunk)) {
      quality += 0.1;
    }

    // 检查错误标记
    const hasErrorMarkers = lines.some(line => this.hasErrorMarkers(line));
    if (!hasErrorMarkers) {
      quality += 0.2;
    }

    return Math.min(quality, 1.0);
  }

  /**
   * 检查代码是否具有平衡的括号
   * @param content 代码内容
   * @returns 是否有平衡的括号
   */
  private static hasBalancedBraces(content: string): boolean {
    let braceCount = 0;
    let bracketCount = 0;
    let squareCount = 0;

    for (const char of content) {
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      else if (char === '(') bracketCount++;
      else if (char === ')') bracketCount--;
      else if (char === '[') squareCount++;
      else if (char === ']') squareCount--;
    }

    return braceCount === 0 && bracketCount === 0 && squareCount === 0;
  }

  /**
   * 检查命名约定
   * @param lines 代码行数组
   * @returns 是否遵循命名约定
   */
  private static checkNamingConventions(lines: string[]): boolean {
    const functionNames: string[] = [];
    const classNames: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      // 提取函数名
      const functionMatch = trimmedLine.match(/(?:function\s+(\w+)|(\w+)\s*=\s*(?:function|\([^)]*\)\s*=>))/);
      if (functionMatch) {
        const name = functionMatch[1] || functionMatch[2];
        if (name) functionNames.push(name);
      }

      // 提取类名
      const classMatch = trimmedLine.match(/class\s+(\w+)/);
      if (classMatch) {
        classNames.push(classMatch[1]);
      }
    }

    // 检查函数命名（驼峰命名）
    const functionNamesValid = functionNames.every(name =>
      /^[a-z][a-zA-Z0-9]*$/.test(name)
    );

    // 检查类命名（帕斯卡命名）
    const classNamesValid = classNames.every(name =>
      /^[A-Z][a-zA-Z0-9]*$/.test(name)
    );

    return functionNamesValid && classNamesValid;
  }
}