import { SyntaxValidator as SyntaxValidatorInterface } from '..';
import { BalancedChunker } from './chunking/BalancedChunker';

export class SyntaxValidator implements SyntaxValidatorInterface {
  private balancedChunker: BalancedChunker;

  constructor(balancedChunker: BalancedChunker) {
    this.balancedChunker = balancedChunker;
  }

  /**
   * 验证代码段语法完整性
   * @param content 代码内容
   * @param language 编程语言
   */
  validate(content: string, language: string): boolean {
    try {
      // 使用BalancedChunker验证符号平衡
      if (!this.balancedChunker.validateCodeBalance(content)) {
        return false;
      }

      // 对于JavaScript/TypeScript，进行额外的语法检查
      if (language === 'javascript' || language === 'typescript') {
        const bracketBalance = this.checkBracketBalance(content);
        const braceBalance = this.checkBraceBalance(content);

        if (bracketBalance !== 0 || braceBalance !== 0) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查括号平衡
   * @param content 代码内容
   */
  checkBracketBalance(content: string): number {
    let balance = 0;
    for (const char of content) {
      if (char === '(') balance++;
      if (char === ')') balance--;
    }
    return balance;
  }

  /**
   * 检查花括号平衡
   * @param content 代码内容
   */
  checkBraceBalance(content: string): number {
    let balance = 0;
    for (const char of content) {
      if (char === '{') balance++;
      if (char === '}') balance--;
    }
    return balance;
  }

  /**
   * 检查符号平衡（使用BalancedChunker）
   * @param content 代码内容
   */
  checkSymbolBalance(content: string): boolean {
    return this.balancedChunker.validateCodeBalance(content);
  }
}