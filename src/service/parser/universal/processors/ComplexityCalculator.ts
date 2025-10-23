import { injectable, inject } from 'inversify';
import { IComplexityCalculator } from '../types/SegmentationTypes';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';

/**
 * 复杂度计算器实现
 * 职责：计算代码片段的复杂度
 */
@injectable()
export class ComplexityCalculator implements IComplexityCalculator {
  private logger?: LoggerService;
  
  constructor(@inject(TYPES.LoggerService) logger?: LoggerService) {
    this.logger = logger;
    this.logger?.debug('ComplexityCalculator initialized');
  }
  
  /**
   * 计算内容复杂度
   */
  calculate(content: string): number {
    let complexity = 0;
    
    // 基于代码结构计算复杂度
    complexity += this.countControlStructures(content) * 2;
    complexity += this.countFunctionDeclarations(content) * 3;
    complexity += this.countClassDeclarations(content) * 3;
    complexity += this.countBrackets(content);
    complexity += this.countParentheses(content) * 0.5;
    
    // 基于代码长度调整
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1) * 2;
    
    // 基于嵌套深度调整
    const maxNestingDepth = this.calculateMaxNestingDepth(content);
    complexity += maxNestingDepth * 1.5;
    
    return Math.round(complexity);
  }
  
  /**
   * 计算控制结构数量
   */
  private countControlStructures(content: string): number {
    const controlStructures = /\b(if|else|while|for|switch|case|try|catch|finally|do|break|continue|return|throw)\b/g;
    const matches = content.match(controlStructures);
    return matches ? matches.length : 0;
  }
  
  /**
   * 计算函数声明数量
   */
  private countFunctionDeclarations(content: string): number {
    const functionPatterns = [
      /\bfunction\s+\w+/g,
      /\bconst\s+\w+\s*=\s*\([^)]*\)\s*=>/g,
      /\blet\s+\w+\s*=\s*\([^)]*\)\s*=>/g,
      /\bvar\s+\w+\s*=\s*function/g,
      /\bdef\s+\w+/g,
      /\bpublic\s+\w+\s*\(/g,
      /\bprivate\s+\w+\s*\(/g,
      /\bprotected\s+\w+\s*\(/g
    ];
    
    let count = 0;
    for (const pattern of functionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }
    
    return count;
  }
  
  /**
   * 计算类声明数量
   */
  private countClassDeclarations(content: string): number {
    const classPatterns = [
      /\bclass\s+\w+/g,
      /\binterface\s+\w+/g,
      /\bstruct\s+\w+/g,
      /\benum\s+\w+/g
    ];
    
    let count = 0;
    for (const pattern of classPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }
    
    return count;
  }
  
  /**
   * 计算括号数量
   */
  private countBrackets(content: string): number {
    const openBrackets = (content.match(/\{/g) || []).length;
    const closeBrackets = (content.match(/\}/g) || []).length;
    return Math.max(openBrackets, closeBrackets);
  }
  
  /**
   * 计算圆括号数量
   */
  private countParentheses(content: string): number {
    const openParentheses = (content.match(/\(/g) || []).length;
    const closeParentheses = (content.match(/\)/g) || []).length;
    return Math.max(openParentheses, closeParentheses);
  }
  
  /**
   * 计算最大嵌套深度
   */
  private calculateMaxNestingDepth(content: string): number {
    const lines = content.split('\n');
    let maxDepth = 0;
    let currentDepth = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // 增加嵌套深度
      if (this.isOpeningStatement(trimmedLine)) {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      }
      
      // 减少嵌套深度
      if (this.isClosingStatement(trimmedLine)) {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }
    
    return maxDepth;
  }
  
  /**
   * 判断是否为开始语句
   */
  private isOpeningStatement(line: string): boolean {
    // 检查是否包含开始括号或关键字
    return line.includes('{') || 
           /\b(if|while|for|switch|try|catch|finally)\b/.test(line) ||
           line.endsWith(':'); // Python风格的控制结构
  }
  
  /**
   * 判断是否为结束语句
   */
  private isClosingStatement(line: string): boolean {
    // 检查是否包含结束括号
    return line.includes('}') || 
           (line.includes('else') && !line.includes('if')) ||
           line.startsWith('except') ||
           line.startsWith('finally') ||
           line.startsWith('elif');
  }
  
  /**
   * 计算语言特定的复杂度调整因子
   */
  private getLanguageSpecificFactor(content: string, language?: string): number {
    // 这里可以根据不同语言调整复杂度计算
    // 暂时返回默认值
    return 1.0;
  }
  
  /**
   * 计算注释复杂度（注释通常降低整体复杂度）
   */
  private calculateCommentComplexity(content: string): number {
    const commentPatterns = [
      /\/\/.*$/gm,           // 单行注释
      /\/\*[\s\S]*?\*\//g,   // 多行注释
      /#.*$/gm,              // Python风格注释
      /<!--[\s\S]*?-->/g     // HTML/XML注释
    ];
    
    let commentLines = 0;
    for (const pattern of commentPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        commentLines += matches.length;
      }
    }
    
    // 注释行数越多，复杂度调整因子越小
    const totalLines = content.split('\n').length;
    const commentRatio = totalLines > 0 ? commentLines / totalLines : 0;
    
    return Math.max(0.1, 1 - commentRatio * 0.3); // 最多降低30%复杂度
  }
}