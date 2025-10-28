import { SyntaxValidator as SyntaxValidatorInterface } from '..';
import { BalancedChunker } from './chunking/BalancedChunker';

export class SyntaxValidator implements SyntaxValidatorInterface {
  private balancedChunker: BalancedChunker;

  constructor(balancedChunker?: BalancedChunker) {
    this.balancedChunker = balancedChunker || new BalancedChunker();
  }

  /**
   * 设置BalancedChunker实例
   * @param balancedChunker BalancedChunker实例
   */
  setBalancedChunker(balancedChunker: BalancedChunker): void {
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
      return this.balancedChunker.validateCodeBalance(content);
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查符号平衡（使用BalancedChunker）
   * @param content 代码内容
   */
  checkSymbolBalance(content: string): boolean {
    return this.balancedChunker.validateCodeBalance(content);
  }
}