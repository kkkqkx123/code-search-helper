// 策略接口定义
import { SplitStrategy, CodeChunk, ChunkingOptions } from '../types';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { BalancedChunker } from '../BalancedChunker';
import { ComplexityCalculator } from '../utils/ComplexityCalculator';

export interface SyntaxAwareSplitter extends SplitStrategy {
  /**
   * 设置TreeSitter服务
   * @param treeSitterService TreeSitter服务实例
   */
  setTreeSitterService(treeSitterService: TreeSitterService): void;

  /**
   * 设置日志服务
   * @param logger 日志服务实例
   */
  setLogger(logger: LoggerService): void;
}

export interface FunctionSplitter extends SplitStrategy {
  /**
   * 提取函数块
   * @param content 源代码
   * @param ast AST树
   * @param language 编程语言
   * @param filePath 文件路径
   */
  extractFunctions(
    content: string,
    ast: any,
    language: string,
    filePath?: string
  ): CodeChunk[];
}

export interface ClassSplitter extends SplitStrategy {
  /**
   * 提取类块
   * @param content 源代码
   * @param ast AST树
   * @param language 编程语言
   * @param filePath 文件路径
   */
  extractClasses(
    content: string,
    ast: any,
    language: string,
    filePath?: string
  ): CodeChunk[];
}

export interface ImportSplitter extends SplitStrategy {
  /**
   * 提取导入语句块
   * @param content 源代码
   * @param ast AST树
   * @param language 编程语言
   * @param filePath 文件路径
   */
  extractImports(
    content: string,
    ast: any,
    language: string,
    filePath?: string
  ): CodeChunk[];
}

export interface IntelligentSplitter extends SplitStrategy {
  /**
   * 设置符号平衡检查器
   * @param balancedChunker 平衡检查器实例
   */
  setBalancedChunker(balancedChunker: BalancedChunker): void;

  /**
   * 设置优化级别
   * @param level 优化级别
   */
  setOptimizationLevel(level: 'low' | 'medium' | 'high'): void;
}

export interface SemanticSplitter extends SplitStrategy {
  /**
   * 设置复杂度计算器
   * @param complexityCalculator 复杂度计算器实例
   */
  setComplexityCalculator(complexityCalculator: ComplexityCalculator): void;

  /**
   * 设置最大处理行数（内存保护）
   * @param maxLines 最大行数
   */
  setMaxLines(maxLines: number): void;
}