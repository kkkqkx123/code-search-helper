import { BalancedChunker } from './chunking/BalancedChunker';
import { languageWeightsProvider, structureDetector } from '../../utils';

export interface BoundaryScore {
  score: number; // 0-1之间的分数，越高越适合作为边界
  components: {
    syntactic: boolean;
    semantic: boolean;
    logical: boolean;
    comment: boolean;
  };
}

export interface LanguageWeights {
  syntactic: number;
  function: number;
  class: number;
  method: number;
  import: number;
  logical: number;
  comment: number;
}

export interface PreAnalysisResult {
  boundaryCandidates: Array<{
    line: number;
    score: number;
    properties: any;
  }>;
  estimatedComplexity: number;
}

/**
 * 语义边界分析器
 * 负责分析代码边界，确定最佳的分割点
 * 
 * 重构完成：此类现在完全使用公共工具类，所有旧实现已移除
 */
export class SemanticBoundaryAnalyzer {
  private balancedChunker: BalancedChunker;
  private weightsProvider = languageWeightsProvider;
  private structureDetector = structureDetector;

  constructor() {
    this.balancedChunker = new BalancedChunker();
  }

  /**
   * 计算行作为分割边界的合适度
   * 返回 0-1 的分数，越高越适合作为边界
   * @param line 代码行
   * @param context 上下文行数组
   * @param language 编程语言名称
   * @returns 边界分数
   */
  calculateBoundaryScore(line: string, context: string[], language: string): BoundaryScore {
    // 使用公共的权重配置
    const weights = this.weightsProvider.getWeights(language);

    let score = 0;

    // 1. 基础语法完整性检查 (权重: 0.3)
    if (this.isSyntacticallySafe(line)) {
      score += weights.syntactic * 0.3;
    }

    // 2. 语义边界检查 (权重: 0.4)
    if (this.isFunctionEnd(line)) score += weights.function * 0.4;
    if (this.isClassEnd(line)) score += weights.class * 0.4;
    if (this.isMethodEnd(line)) score += weights.method * 0.35;
    if (this.isImportEnd(line)) score += weights.import * 0.2;

    // 3. 逻辑分组检查 (权重: 0.5)
    if (this.isEmptyLine(line) && this.hasLogicalSeparation(context)) {
      score += weights.logical * 0.5;
    }

    // 4. 注释边界检查 (权重: 0.1)
    if (this.isCommentBlockEnd(line)) score += weights.comment * 0.1;

    return {
      score: Math.min(score, 1.0),
      components: {
        syntactic: this.isSyntacticallySafe(line),
        semantic: this.isSemanticBoundary(line),
        logical: this.isLogicalBoundary(line, context),
        comment: this.isCommentBoundary(line)
      }
    };
  }

  /**
   * 检查是否语法安全
   * @param line 代码行
   * @returns 是否语法安全
   */
  private isSyntacticallySafe(line: string): boolean {
    // 检查是否有完整的语法结构，例如闭合的括号、花括号等
    const trimmedLine = line.trim();
    if (!trimmedLine) return true;

    // 对于简单的语法符号，直接检查
    if (/^[\s\]\}\);]*$/.test(trimmedLine)) {
      return true;
    }

    // 使用balanced chunker来检查符号平衡
    const originalState = this.balancedChunker.getCurrentState();
    this.balancedChunker.analyzeLineSymbols(trimmedLine);
    const isBalanced = this.balancedChunker.canSafelySplit();
    this.balancedChunker.setCurrentState(originalState);
    return isBalanced;
  }

  /**
   * 检查是否为函数结束
   * @param line 代码行
   * @returns 是否为函数结束
   */
  private isFunctionEnd(line: string): boolean {
    return this.structureDetector.isFunctionEnd(line);
  }

  /**
   * 检查是否为类结束
   * @param line 代码行
   * @returns 是否为类结束
   */
  private isClassEnd(line: string): boolean {
    return this.structureDetector.isClassEnd(line);
  }

  /**
   * 检查是否为方法结束
   * @param line 代码行
   * @returns 是否为方法结束
   */
  private isMethodEnd(line: string): boolean {
    return this.structureDetector.isMethodEnd(line);
  }

  /**
   * 检查是否为导入结束
   * @param line 代码行
   * @returns 是否为导入结束
   */
  private isImportEnd(line: string): boolean {
    return this.structureDetector.isImportEnd(line);
  }

  /**
   * 检查是否为空行
   * @param line 代码行
   * @returns 是否为空行
   */
  private isEmptyLine(line: string): boolean {
    return this.structureDetector.isEmptyLine(line);
  }

  /**
   * 检查是否有逻辑分离
   * @param context 上下文行数组
   * @returns 是否有逻辑分离
   */
  private hasLogicalSeparation(context: string[]): boolean {
    // 检查上下文中的逻辑分离
    if (context.length < 3) return false;

    // 检查前后是否有相关的函数、类或语句
    const prevLine = context[context.length - 3] || '';
    const currentLine = context[context.length - 2] || ''; // 当前行应该是空行
    const nextLine = context[context.length - 1] || '';

    // 确保当前行是空行
    if (currentLine.trim() !== '') return false;

    // 对于测试用例，我们需要检查是否是变量声明的分离
    const isPrevVarDeclaration = this.structureDetector.isVariableDeclaration(prevLine);
    const isNextVarDeclaration = this.structureDetector.isVariableDeclaration(nextLine);

    return (this.isFunctionStart(prevLine) || this.isClassStart(prevLine) ||
      this.isFunctionStart(nextLine) || this.isClassStart(nextLine)) ||
      (isPrevVarDeclaration && isNextVarDeclaration);
  }

  /**
   * 检查是否为函数开始
   * @param line 代码行
   * @returns 是否为函数开始
   */
  private isFunctionStart(line: string): boolean {
    return this.structureDetector.isFunctionStart(line);
  }

  /**
   * 检查是否为类开始
   * @param line 代码行
   * @returns 是否为类开始
   */
  private isClassStart(line: string): boolean {
    return this.structureDetector.isClassStart(line);
  }

  /**
   * 检查是否为注释块结束
   * @param line 代码行
   * @returns 是否为注释块结束
   */
  private isCommentBlockEnd(line: string): boolean {
    return this.structureDetector.isCommentBlockEnd(line);
  }

  /**
   * 检查是否为语义边界
   * @param line 代码行
   * @returns 是否为语义边界
   */
  private isSemanticBoundary(line: string): boolean {
    return this.isFunctionEnd(line) ||
      this.isClassEnd(line) ||
      this.isMethodEnd(line) ||
      this.isImportEnd(line);
  }

  /**
   * 检查是否为逻辑边界
   * @param line 代码行
   * @param context 上下文行数组
   * @returns 是否为逻辑边界
   */
  private isLogicalBoundary(line: string, context: string[]): boolean {
    return this.isEmptyLine(line) && this.hasLogicalSeparation(context);
  }

  /**
   * 检查是否为注释边界
   * @param line 代码行
   * @returns 是否为注释边界
   */
  private isCommentBoundary(line: string): boolean {
    return this.isCommentBlockEnd(line);
  }

  /**
   * 设置自定义权重配置
   * @param language 编程语言名称
   * @param weights 权重配置
   */
  setCustomWeights(language: string, weights: LanguageWeights): void {
    this.weightsProvider.setCustomWeights(language, weights);
  }

  /**
   * 清除自定义权重配置
   * @param language 编程语言名称，如果不提供则清除所有
   */
  clearCustomWeights(language?: string): void {
    this.weightsProvider.clearCustomWeights(language);
  }

  /**
   * 获取语言权重配置
   * @param language 编程语言名称
   * @returns 权重配置
   */
  getWeights(language: string): LanguageWeights {
    return this.weightsProvider.getWeights(language);
  }

  /**
   * 检测代码结构类型
   * @param line 代码行
   * @returns 结构类型名称或null
   */
  detectStructureType(line: string): string | null {
    return this.structureDetector.detectStructureType(line);
  }
}