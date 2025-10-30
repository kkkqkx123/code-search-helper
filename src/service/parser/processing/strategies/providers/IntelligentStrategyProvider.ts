import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions, CodeChunk } from '../../../interfaces/CoreISplitStrategy';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { IntelligentStrategy as ImportedIntelligentStrategy } from '../impl/IntelligentStrategy';
import { BalancedChunker } from '../../utils/chunking/BalancedChunker';
import { SemanticBoundaryAnalyzer } from '../../utils/SemanticBoundaryAnalyzer';
import { UnifiedOverlapCalculator } from '../../utils/overlap/UnifiedOverlapCalculator';

/**
 * 智能分段策略实现
 * 实现ISplitStrategy接口，使用语义边界评分和复杂度计算进行智能分割
 */
@injectable()
export class IntelligentSplitStrategy implements ISplitStrategy {
  private intelligentStrategy: ImportedIntelligentStrategy;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.intelligentStrategy = new ImportedIntelligentStrategy();
    if (this.logger) {
      this.intelligentStrategy.setLogger(this.logger);
    }
  }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    try {
      // 使用IntelligentStrategy进行分割
      return await this.intelligentStrategy.split(content, language, filePath, options, nodeTracker);
    } catch (error) {
      this.logger?.error(`Intelligent strategy failed: ${error}`);
      return [];
    }
  }

  getName(): string {
    return 'intelligent_strategy';
  }

  getDescription(): string {
    return 'Uses semantic boundary scoring and complexity calculation for intelligent code splitting';
  }

  supportsLanguage(language: string): boolean {
    return this.intelligentStrategy.supportsLanguage(language);
  }

  getPriority(): number {
    return 4; // 较低优先级（作为后备方案）
  }
}

/**
 * 智能策略提供者
 * 负责创建智能策略实例
 */
@injectable()
export class IntelligentStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'intelligent_provider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    const strategy = new IntelligentSplitStrategy(
      this.treeSitterService,
      this.logger
    );

    // 如果提供了选项，也应用到内部的IntelligentStrategy
    if (options) {
      const intelligentStrategy = (strategy as any).intelligentStrategy as ImportedIntelligentStrategy;
      // 重新创建IntelligentStrategy以应用选项
      const newIntelligentStrategy = new ImportedIntelligentStrategy(options);
      if (this.logger) {
        newIntelligentStrategy.setLogger(this.logger);
      }
      // 如果有其他可配置组件，也设置它们
      const balancedChunker = new BalancedChunker(this.logger);
      newIntelligentStrategy.setBalancedChunker(balancedChunker);
      newIntelligentStrategy.setSemanticBoundaryAnalyzer(new SemanticBoundaryAnalyzer());
      newIntelligentStrategy.setUnifiedOverlapCalculator(new UnifiedOverlapCalculator({
        maxSize: options.basic?.overlapSize || 50,
        minLines: 1,
        maxOverlapRatio: 0.3,
        enableASTBoundaryDetection: false
      }));
      (strategy as any).intelligentStrategy = newIntelligentStrategy;
    }

    return strategy;
  }

  getDependencies(): string[] {
    return ['LoggerService']; // IntelligentStrategy主要依赖内部组件
  }

  supportsLanguage(language: string): boolean {
    const strategy = this.createStrategy();
    return strategy.supportsLanguage(language);
  }

  getPriority(): number {
    return 4; // 较低优先级（作为后备方案）
  }

  getDescription(): string {
    return 'Provides intelligent code splitting using semantic boundary scoring';
  }
}