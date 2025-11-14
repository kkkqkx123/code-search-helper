/**
 * 全局文件内容检测工具类
 * 提供统一的文件内容分析功能，包括二进制检测、代码检测、缩进检测等
 */

import { PythonIndentChecker } from './structure/PythonIndentChecker';
import { SYNTAX_PATTERNS } from '../service/parser/constants/processing-constants';

/**
 * 换行符类型枚举
 */
export enum LineEndingType {
  CRLF = 'crlf', // Windows
  LF = 'lf',     // Unix/Linux/Mac
  CR = 'cr',     // Old Mac
  MIXED = 'mixed' // 混合
}

/**
 * 缩进类型枚举
 */
export enum IndentType {
  SPACES = 'spaces',
  TABS = 'tabs',
  MIXED = 'mixed',
  NONE = 'none'
}

/**
 * 二进制检测结果接口
 */
export interface BinaryDetectionResult {
  /** 是否为二进制文件 */
  isBinary: boolean;
  /** null字节比例 */
  nullByteRatio: number;
  /** 不可打印字符比例 */
  nonPrintableRatio: number;
  /** 检测的字节数 */
  bytesChecked: number;
}

/**
 * 代码检测结果接口
 */
export interface CodeDetectionResult {
  /** 是否为代码文件 */
  isCode: boolean;
  /** 匹配的语言类型 */
  detectedLanguages: string[];
  /** 匹配的模式数量 */
  matchedPatterns: number;
}

/**
 * 缩进检测结果接口
 */
export interface IndentDetectionResult {
  /** 缩进类型 */
  type: IndentType;
  /** 缩进大小 */
  size: number;
  /** 是否一致 */
  isConsistent: boolean;
}

/**
 * 文件内容检测结果接口
 */
export interface FileContentAnalysisResult {
  /** 二进制检测结果 */
  binaryDetection: BinaryDetectionResult;
  /** 代码检测结果 */
  codeDetection: CodeDetectionResult;
  /** 换行符类型 */
  lineEndingType: LineEndingType;
  /** 缩进检测结果 */
  indentDetection: IndentDetectionResult;
}

/**
 * 全局文件内容检测工具类
 */
export class FileContentDetector {
  /**
   * 检测是否为二进制内容
   * 使用增强的检测算法，不仅检查null字节，还检查不可打印字符比例
   * 
   * @param content 文件内容，可以是字符串或Buffer
   * @param checkBytes 检查的字节数，默认1024
   * @returns 二进制检测结果
   */
  static detectBinaryContent(content: string | Buffer, checkBytes: number = 1024): BinaryDetectionResult {
    // 如果是字符串，转换为Buffer
    const buffer = typeof content === 'string' 
      ? Buffer.from(content, 'utf8') 
      : content;

    // 检查前N个字节
    const checkLength = Math.min(buffer.length, checkBytes);
    let nullByteCount = 0;
    let nonPrintableCount = 0;

    for (let i = 0; i < checkLength; i++) {
      const byte = buffer[i];

      // 检查null字节
      if (byte === 0) {
        nullByteCount++;
      }

      // 检查不可打印字符 (ASCII < 32 且不是常见的控制字符)
      // 允许的控制字符: 9(TAB), 10(LF), 13(CR)
      if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
        nonPrintableCount++;
      }

      // 检查高位字节 (可能的多字节字符或二进制数据)
      if (byte > 127) {
        // 这里可以添加UTF-8编码有效性检查
        // 简单起见，暂时只统计
        nonPrintableCount += 0.5; // 给高位字符较低的权重
      }
    }

    const nullByteRatio = nullByteCount / checkLength;
    const nonPrintableRatio = nonPrintableCount / checkLength;

    // 判断标准：
    // 1. null字节比例超过1%
    // 2. 不可打印字符比例超过5%
    // 3. 或者同时有null字节和不可打印字符
    const isBinary = nullByteRatio > 0.01 || 
                    nonPrintableRatio > 0.05 || 
                    (nullByteRatio > 0 && nonPrintableRatio > 0.02);

    return {
      isBinary,
      nullByteRatio,
      nonPrintableRatio,
      bytesChecked: checkLength
    };
  }

  /**
   * 检测是否为代码内容
   * 使用 processing-constants.ts 中定义的语法模式进行检测
   * 
   * @param content 文件内容
   * @param languageHint 语言提示（可选）
   * @returns 代码检测结果
   */
  static detectCodeContent(content: string, languageHint?: string): CodeDetectionResult {
    const detectedLanguages: string[] = [];
    let totalMatchedPatterns = 0;

    // 如果提供了语言提示，优先检查该语言
    if (languageHint && SYNTAX_PATTERNS[languageHint]) {
      const patterns = SYNTAX_PATTERNS[languageHint];
      const matchedPatterns = patterns.filter(pattern => pattern.test(content));
      
      if (matchedPatterns.length > 0) {
        detectedLanguages.push(languageHint);
        totalMatchedPatterns += matchedPatterns.length;
      }
    } else {
      // 检查所有语言模式
      for (const [language, patterns] of Object.entries(SYNTAX_PATTERNS)) {
        const matchedPatterns = patterns.filter(pattern => pattern.test(content));
        
        if (matchedPatterns.length > 0) {
          detectedLanguages.push(language);
          totalMatchedPatterns += matchedPatterns.length;
        }
      }
    }

    // 如果匹配的模式数量超过阈值，认为是代码文件
    // 降低阈值以便更好地检测代码
    const isCode = totalMatchedPatterns >= 1 || 
                   (detectedLanguages.length > 0 && totalMatchedPatterns > 0);

    return {
      isCode,
      detectedLanguages,
      matchedPatterns: totalMatchedPatterns
    };
  }

  /**
   * 检测换行符类型
   * 
   * @param content 文件内容
   * @returns 换行符类型
   */
  static detectLineEndingType(content: string): LineEndingType {
    const crlfCount = (content.match(/\r\n/g) || []).length;
    const lfCount = (content.match(/(?<!\r)\n/g) || []).length;
    const crCount = (content.match(/\r(?!\n)/g) || []).length;

    if (crlfCount > 0 && lfCount === 0 && crCount === 0) {
      return LineEndingType.CRLF;
    } else if (lfCount > 0 && crlfCount === 0 && crCount === 0) {
      return LineEndingType.LF;
    } else if (crCount > 0 && crlfCount === 0 && lfCount === 0) {
      return LineEndingType.CR;
    } else {
      return LineEndingType.MIXED;
    }
  }

  /**
   * 检测缩进类型和大小
   * 复用 PythonIndentChecker 的实现，并优化缩进大小计算
   * 
   * @param content 文件内容
   * @returns 缩进检测结果
   */
  static detectIndentationType(content: string): IndentDetectionResult {
    // 使用 PythonIndentChecker 的检测功能
    const indentStyle = PythonIndentChecker.detectIndentStyle(content);
    const isConsistent = PythonIndentChecker.isIndentConsistent(content);

    // 转换为接口期望的格式
    let type: IndentType;
    switch (indentStyle.type) {
      case 'spaces':
        type = IndentType.SPACES;
        break;
      case 'tabs':
        type = IndentType.TABS;
        break;
      case 'mixed':
        type = IndentType.MIXED;
        break;
      default:
        type = IndentType.NONE;
    }

    // 优化缩进大小计算：使用最常见的缩进大小而不是平均值
    let optimizedSize = indentStyle.size;
    if (type === IndentType.SPACES && indentStyle.size > 0) {
      const lines = content.split('\n');
      const indentSizes: number[] = [];
      
      for (const line of lines) {
        const match = line.match(/^(\s+)/);
        if (match && match[1].length > 0) {
          indentSizes.push(match[1].length);
        }
      }
      
      if (indentSizes.length > 0) {
        // 找出最常见的缩进大小
        const sizeFrequency: Record<number, number> = {};
        indentSizes.forEach(size => {
          sizeFrequency[size] = (sizeFrequency[size] || 0) + 1;
        });
        
        // 找出出现频率最高的缩进大小
        let maxFrequency = 0;
        let mostCommonSize = 0;
        for (const [size, frequency] of Object.entries(sizeFrequency)) {
          if (frequency > maxFrequency) {
            maxFrequency = frequency;
            mostCommonSize = parseInt(size);
          }
        }
        
        // 如果最常见的缩进大小是2的倍数，优先使用它
        if (mostCommonSize > 0 && mostCommonSize % 2 === 0) {
          optimizedSize = mostCommonSize;
        }
      }
    }

    // 处理无缩进内容的情况
    if (optimizedSize === 0 && type === IndentType.SPACES) {
      // 检查是否真的没有缩进
      const hasAnyIndentation = /^\s/m.test(content);
      if (!hasAnyIndentation) {
        type = IndentType.NONE;
      }
    }

    return {
      type,
      size: optimizedSize,
      isConsistent
    };
  }

  /**
   * 全面分析文件内容
   * 
   * @param content 文件内容
   * @param languageHint 语言提示（可选）
   * @returns 完整的文件内容分析结果
   */
  static analyzeFileContent(content: string | Buffer, languageHint?: string): FileContentAnalysisResult {
    // 确保内容是字符串格式（除了二进制检测）
    const stringContent = typeof content === 'string' ? content : content.toString('utf8');

    return {
      binaryDetection: this.detectBinaryContent(content),
      codeDetection: this.detectCodeContent(stringContent, languageHint),
      lineEndingType: this.detectLineEndingType(stringContent),
      indentDetection: this.detectIndentationType(stringContent)
    };
  }

  /**
   * 快速检查是否为二进制文件
   * 只返回布尔值，用于快速判断
   * 
   * @param content 文件内容
   * @returns 是否为二进制文件
   */
  static isBinaryContent(content: string | Buffer): boolean {
    return this.detectBinaryContent(content).isBinary;
  }

  /**
   * 快速检查是否为代码文件
   * 只返回布尔值，用于快速判断
   * 
   * @param content 文件内容
   * @param languageHint 语言提示（可选）
   * @returns 是否为代码文件
   */
  static isCodeContent(content: string, languageHint?: string): boolean {
    return this.detectCodeContent(content, languageHint).isCode;
  }
}