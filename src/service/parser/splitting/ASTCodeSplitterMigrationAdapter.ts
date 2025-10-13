import { injectable, inject } from 'inversify';
import { Splitter, CodeChunk } from './Splitter';
import { RefactoredASTCodeSplitter } from './core/RefactoredASTCodeSplitter';
import { TreeSitterService } from '../core/parse/TreeSitterService';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { strategyFactory } from './core/SplitStrategyFactory';
import { FunctionSplitter } from './strategies/FunctionSplitter';
import { ClassSplitter } from './strategies/ClassSplitter';
import { ImportSplitter } from './strategies/ImportSplitter';
import { SyntaxAwareSplitter } from './strategies/SyntaxAwareSplitter';
import { IntelligentSplitter } from './strategies/IntelligentSplitter';
import { SemanticSplitter } from './strategies/SemanticSplitter';

/**
 * ASTCodeSplitter迁移适配器
 * 提供与原有ASTCodeSplitter相同的接口，但内部使用新的重构架构
 */
@injectable()
export class ASTCodeSplitterMigrationAdapter implements Splitter {
  private refactoredSplitter: RefactoredASTCodeSplitter;

  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    // 注册所有策略到工厂
    this.registerStrategies();
    
    // 创建重构后的分割器
    this.refactoredSplitter = new RefactoredASTCodeSplitter(treeSitterService, logger);
  }

  async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
    // 使用重构后的分割器，但保持原有的接口
    return await this.refactoredSplitter.split(code, language, filePath);
  }

  setChunkSize(chunkSize: number): void {
    this.refactoredSplitter.setChunkSize(chunkSize);
  }

  setChunkOverlap(chunkOverlap: number): void {
    this.refactoredSplitter.setChunkOverlap(chunkOverlap);
  }

  /**
   * 获取重构后的分割器实例（用于高级用法）
   */
  getRefactoredSplitter(): RefactoredASTCodeSplitter {
    return this.refactoredSplitter;
  }

  /**
   * 注册所有策略到工厂
   */
  private registerStrategies(): void {
    try {
      strategyFactory.registerStrategy('FunctionSplitter', FunctionSplitter);
      strategyFactory.registerStrategy('ClassSplitter', ClassSplitter);
      strategyFactory.registerStrategy('ImportSplitter', ImportSplitter);
      strategyFactory.registerStrategy('SyntaxAwareSplitter', SyntaxAwareSplitter);
      strategyFactory.registerStrategy('IntelligentSplitter', IntelligentSplitter);
      strategyFactory.registerStrategy('SemanticSplitter', SemanticSplitter);
    } catch (error) {
      console.warn('Failed to register some strategies:', error);
    }
  }

  /**
   * 获取迁移统计信息
   */
  getMigrationStats(): {
    isUsingRefactored: boolean;
    refactoredStats: any;
    factoryStats: any;
  } {
    return {
      isUsingRefactored: true,
      refactoredStats: this.refactoredSplitter.getStats(),
      factoryStats: strategyFactory.getFactoryStats()
    };
  }
}

/**
 * 兼容性导出，保持原有接口
 */
export const ASTCodeSplitter = ASTCodeSplitterMigrationAdapter;