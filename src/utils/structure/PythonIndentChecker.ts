/**
 * Python缩进检查工具类
 * 专注于计算缩进层级和深度，用于代码结构分析
 */

/**
 * 缩进分析结果接口
 */
export interface IndentAnalysisResult {
  /** 缩进层级 */
  level: number;
  /** 缩进类型 */
  indentType: 'spaces' | 'tabs' | 'mixed';
  /** 缩进大小 */
  indentSize: number;
  /** 是否有效缩进 */
  isValid: boolean;
}

/**
 * 缩进层级信息接口
 */
export interface IndentLevelInfo {
  /** 行号 */
  lineNumber: number;
  /** 缩进层级 */
  level: number;
  /** 缩进内容 */
  indentContent: string;
  /** 是否为空行 */
  isEmpty: boolean;
  /** 是否为注释行 */
  isComment: boolean;
  /** 行内容 */
  content: string;
}

/**
 * 缩进结构分析结果接口
 */
export interface IndentStructureResult {
  /** 最大缩进深度 */
  maxDepth: number;
  /** 缩进层级信息 */
  levels: IndentLevelInfo[];
  /** 缩进类型 */
  indentType: 'spaces' | 'tabs' | 'mixed';
  /** 平均缩进大小 */
  averageIndentSize: number;
  /** 是否缩进一致 */
  isConsistent: boolean;
  /** 总行数 */
  totalLines: number;
  /** 有效代码行数 */
  codeLines: number;
}

/**
 * Python缩进检查工具类
 */
export class PythonIndentChecker {
  /**
   * 分析单行缩进
   * @param line 代码行
   * @param lineNumber 行号
   * @returns 缩进分析结果
   */
  static analyzeLineIndent(line: string, lineNumber: number): IndentAnalysisResult {
    const trimmedLine = line.trimEnd();
    const isEmpty = trimmedLine.length === 0;
    const isComment = trimmedLine.startsWith('#');
    
    // 提取缩进部分
    const indentMatch = line.match(/^([\s]*)/);
    const indentContent = indentMatch ? indentMatch[1] : '';
    
    // 检测缩进类型
    const hasTabs = indentContent.includes('\t');
    // 检查是否包含半角空格
    const hasRegularSpaces = indentContent.includes(' ');
    // 检查是否包含其他空白字符（如全角空格等）
    const hasOtherWhitespace = /[\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000]/.test(indentContent);
    
    let indentType: 'spaces' | 'tabs' | 'mixed';
    if (hasTabs && (hasRegularSpaces || hasOtherWhitespace)) {
      indentType = 'mixed';
    } else if (hasRegularSpaces && hasOtherWhitespace) {
      indentType = 'mixed';
    } else if (hasTabs) {
      indentType = 'tabs';
    } else if (hasRegularSpaces || hasOtherWhitespace) {
      indentType = 'spaces';
    } else {
      indentType = 'spaces'; // 空行或无缩进
    }
    
    // 计算缩进层级（基于空格数量，假设4个空格为一个层级）
    let indentSize = 0;
    let level = 0;
    
    if (indentType === 'spaces') {
      indentSize = indentContent.length;
      level = Math.floor(indentSize / 4);
    } else if (indentType === 'tabs') {
      indentSize = indentContent.length;
      level = indentSize; // 每个tab算一个层级
    } else if (indentType === 'mixed') {
      // 混合缩进：将tab转换为4个空格计算
      const tabCount = (indentContent.match(/\t/g) || []).length;
      const spaceCount = (indentContent.match(/ /g) || []).length;
      indentSize = tabCount * 4 + spaceCount;
      level = Math.floor(indentSize / 4);
    }
    
    // 检查缩进是否有效
    const isValid = this.isValidIndent(indentContent, indentType);
    
    return {
      level,
      indentType,
      indentSize,
      isValid
    };
  }

  /**
   * 计算整个代码的缩进结构
   * @param content Python代码内容
   * @returns 缩进结构分析结果
   */
  static calculateIndentStructure(content: string): IndentStructureResult {
    const lines = content.split('\n');
    const levels: IndentLevelInfo[] = [];
    const indentTypes: Set<'spaces' | 'tabs' | 'mixed'> = new Set();
    const indentSizes: number[] = [];
    let maxDepth = 0;
    let codeLines = 0;

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();
      const isEmpty = trimmedLine.length === 0;
      const isComment = trimmedLine.startsWith('#');
      
      const indentAnalysis = this.analyzeLineIndent(line, lineNumber);
      
      const levelInfo: IndentLevelInfo = {
        lineNumber,
        level: indentAnalysis.level,
        indentContent: line.match(/^([\s]*)/)?.[1] || '',
        isEmpty,
        isComment,
        content: line
      };
      
      levels.push(levelInfo);
      
      if (!isEmpty && !isComment) {
        // 所有非空非注释行都是代码行
        codeLines++;
        
        // 只有当有缩进时才添加到indentTypes中
        if (indentAnalysis.indentSize > 0) {
          indentTypes.add(indentAnalysis.indentType);
          indentSizes.push(indentAnalysis.indentSize);
        }
        
        maxDepth = Math.max(maxDepth, indentAnalysis.level);
      }
    });

    // 确定主要缩进类型
    let indentType: 'spaces' | 'tabs' | 'mixed';
    if (indentTypes.size === 1) {
      indentType = Array.from(indentTypes)[0];
    } else if (indentTypes.size === 0) {
      indentType = 'spaces'; // 默认值
    } else {
      indentType = 'mixed';
    }
    
    // 特殊处理：检查是否在整个代码中混合使用了不同类型的空白字符
    if (indentType === 'spaces') {
      let hasRegularSpacesInCode = false;
      let hasOtherWhitespaceInCode = false;
      
      for (const level of levels) {
        if (!level.isEmpty && !level.isComment && level.indentContent.length > 0) {
          const indentContent = level.indentContent;
          const hasRegularSpaces = indentContent.includes(' ');
          const hasOtherWhitespace = /[\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000]/.test(indentContent);
          
          if (hasRegularSpaces) {
            hasRegularSpacesInCode = true;
          }
          if (hasOtherWhitespace) {
            hasOtherWhitespaceInCode = true;
          }
          
          // 检查同一行中是否混合使用了不同类型的空白字符
          if (hasRegularSpaces && hasOtherWhitespace) {
            indentType = 'mixed';
            break;
          }
        }
      }
      
      // 如果在整个代码中同时使用了regular spaces和other whitespace，则为mixed
      if (indentType !== 'mixed' && hasRegularSpacesInCode && hasOtherWhitespaceInCode) {
        indentType = 'mixed';
      }
    }

    // 计算平均缩进大小（只计算有缩进的行）
    const averageIndentSize = indentSizes.length > 0
      ? Math.round(indentSizes.reduce((sum, size) => sum + size, 0) / indentSizes.length)
      : 0;

    // 检查缩进一致性
    const isConsistent = this.checkIndentConsistency(levels);

    return {
      maxDepth,
      levels,
      indentType,
      averageIndentSize,
      isConsistent,
      totalLines: lines.length,
      codeLines
    };
  }

  /**
   * 获取最大缩进深度
   * @param content Python代码内容
   * @returns 最大缩进深度
   */
  static getMaxIndentDepth(content: string): number {
    const structure = this.calculateIndentStructure(content);
    return structure.maxDepth;
  }

  /**
   * 检测缩进类型和大小
   * @param content Python代码内容
   * @returns 缩进类型和大小
   */
  static detectIndentStyle(content: string): { type: 'spaces' | 'tabs' | 'mixed'; size: number } {
    const structure = this.calculateIndentStructure(content);
    return {
      type: structure.indentType,
      size: structure.averageIndentSize
    };
  }

  /**
   * 检查缩进一致性
   * @param content Python代码内容
   * @returns 是否缩进一致
   */
  static isIndentConsistent(content: string): boolean {
    const structure = this.calculateIndentStructure(content);
    return structure.isConsistent;
  }

  /**
   * 获取指定层级的代码块
   * @param content Python代码内容
   * @param targetLevel 目标缩进层级
   * @returns 指定层级的代码行
   */
  static getLinesAtLevel(content: string, targetLevel: number): IndentLevelInfo[] {
    const structure = this.calculateIndentStructure(content);
    return structure.levels.filter(level => level.level === targetLevel);
  }

  /**
   * 获取代码块的缩进层级范围
   * @param content Python代码内容
   * @param startLine 起始行号
   * @param endLine 结束行号
   * @returns 缩进层级范围
   */
  static getIndentRange(content: string, startLine: number, endLine: number): { minLevel: number; maxLevel: number } {
    const structure = this.calculateIndentStructure(content);
    const targetLevels = structure.levels.filter(
      level => level.lineNumber >= startLine && level.lineNumber <= endLine
    );
    
    if (targetLevels.length === 0) {
      return { minLevel: 0, maxLevel: 0 };
    }
    
    const levels = targetLevels.map(level => level.level);
    return {
      minLevel: Math.min(...levels),
      maxLevel: Math.max(...levels)
    };
  }

  /**
   * 分析缩进变化模式
   * @param content Python代码内容
   * @returns 缩进变化模式
   */
  static analyzeIndentPatterns(content: string): {
    increases: number[];  // 缩进增加的行号
    decreases: number[];  // 缩进减少的行号
    consistent: boolean;  // 是否遵循一致的缩进模式
  } {
    const structure = this.calculateIndentStructure(content);
    const increases: number[] = [];
    const decreases: number[] = [];
    let consistent = true;
    
    for (let i = 1; i < structure.levels.length; i++) {
      const current = structure.levels[i];
      const previous = structure.levels[i - 1];
      
      if (current.isEmpty || current.isComment) continue;
      if (previous.isEmpty || previous.isComment) continue;
      
      if (current.level > previous.level) {
        increases.push(current.lineNumber);
      } else if (current.level < previous.level) {
        decreases.push(current.lineNumber);
      }
      
      // 检查缩进变化是否合理（每次变化应该是4的倍数或1个tab）
      // 以及检查相邻行的缩进大小是否一致
      const levelDiff = Math.abs(current.level - previous.level);
      if (levelDiff > 1 && structure.indentType === 'tabs') {
        consistent = false;
      } else if (levelDiff > 0 && structure.indentType === 'spaces') {
        const sizeDiff = Math.abs(current.indentContent.length - previous.indentContent.length);
        if (sizeDiff % 4 !== 0) {
          consistent = false;
        }
      }
      
      // 检查相邻行的缩进大小是否符合规范（对于空格缩进，每个缩进应该是4的倍数）
      if (structure.indentType === 'spaces') {
        if (previous.indentContent.length > 0 && previous.indentContent.length % 4 !== 0) {
          consistent = false;
        }
        if (current.indentContent.length > 0 && current.indentContent.length % 4 !== 0) {
          consistent = false;
        }
      }
      
      // 检查是否混合了不同类型的缩进
      if (structure.indentType === 'mixed') {
        consistent = false;
      }
    }
    
    return { increases, decreases, consistent };
  }

  // 私有辅助方法

  /**
   * 检查缩进是否有效
   * @param indentContent 缩进内容
   * @param indentType 缩进类型
   * @returns 是否有效
   */
  private static isValidIndent(indentContent: string, indentType: 'spaces' | 'tabs' | 'mixed'): boolean {
    if (indentType === 'mixed') {
      return false; // 混合缩进通常被认为是不好的实践
    }
    
    if (indentType === 'spaces') {
      // 空格缩进应该是4的倍数
      return indentContent.length % 4 === 0;
    }
    
    return true; // tab缩进总是有效的
  }

  /**
   * 检查缩进一致性
   * @param levels 缩进层级信息数组
   * @returns 是否一致
   */
  private static checkIndentConsistency(levels: IndentLevelInfo[]): boolean {
    const indentTypes = new Set<string>();
    const indentSizes = new Set<number>();
    let validSpaces = true;
    let hasMixedWhitespace = false;
    
    levels.forEach(level => {
      if (!level.isEmpty && !level.isComment) {
        const analysis = this.analyzeLineIndent(level.content, level.lineNumber);
        
        // 检查是否有混合空白字符
        if (analysis.indentType === 'mixed') {
          hasMixedWhitespace = true;
        }
        
        // 只有当有缩进时才添加到indentTypes中
        if (analysis.indentSize > 0) {
          indentTypes.add(analysis.indentType);
          
          if (analysis.indentType === 'spaces') {
            // 对于空格缩进，检查是否都是4的倍数
            if (analysis.indentSize % 4 !== 0) {
              validSpaces = false;
            }
            indentSizes.add(analysis.indentSize);
          } else if (analysis.indentType === 'tabs') {
            indentSizes.add(analysis.indentSize);
          }
        }
      }
    });
    
    // 如果有混合空白字符，则不一致
    if (hasMixedWhitespace) {
      return false;
    }
    
    // 如果有多种缩进类型，则不一致
    if (indentTypes.size > 1) {
      return false;
    }
    
    // 对于空格缩进，检查是否都是4的倍数
    if (indentTypes.size === 1 && Array.from(indentTypes)[0] === 'spaces' && !validSpaces) {
      return false;
    }
    
    // 如果有多种缩进大小，则不一致（但允许相同大小的重复）
    // 但只在有多个不同大小时才认为不一致
    if (indentSizes.size > 1) {
      // 检查是否所有缩进大小都是4的倍数（对于空格缩进）
      if (indentTypes.size === 1 && Array.from(indentTypes)[0] === 'spaces') {
        const allMultiplesOf4 = Array.from(indentSizes).every(size => size % 4 === 0);
        if (!allMultiplesOf4) {
          return false;
        }
      } else if (indentTypes.size === 1 && Array.from(indentTypes)[0] === 'tabs') {
        // 对于tab缩进，允许不同的tab数量
        return true;
      } else {
        return false;
      }
    }
    
    return true;
  }
}