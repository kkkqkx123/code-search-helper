import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy } from '../../../splitting/interfaces/ISplitStrategy';
import { IStrategyProvider, ChunkingOptions } from '../../../splitting/interfaces/IStrategyProvider';
import { CodeChunk } from '../../../splitting';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { IntelligentSplitter } from '../impl/IntelligentStrategy';
import { BalancedChunker } from '../../../splitting/BalancedChunker';
import { SemanticBoundaryAnalyzer } from '../../utils/SemanticBoundaryAnalyzer';
import { UnifiedOverlapCalculator } from '../../utils/overlap/UnifiedOverlapCalculator';

/**
 * 智能分段策略实现
 * 实现ISplitStrategy接口，使用语义边界评分和复杂度计算进行智能分割
 */
@injectable()
export class IntelligentStrategy implements ISplitStrategy {
  private intelligentSplitter: IntelligentSplitter;

  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    this.intelligentSplitter = new IntelligentSplitter();
    if (this.logger) {
      this.intelligentSplitter.setLogger(this.logger);
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
      // 使用IntelligentSplitter进行分割
      return await this.intelligentSplitter.split(content, language, filePath, options, nodeTracker);
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
    return this.intelligentSplitter.supportsLanguage(language);
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
    const strategy = new IntelligentStrategy(
      this.treeSitterService,
      this.logger
    );

    // 如果提供了选项，也应用到内部的IntelligentSplitter
    if (options) {
      const intelligentSplitter = (strategy as any).intelligentSplitter as IntelligentSplitter;
      // 重新创建IntelligentSplitter以应用选项
      const newIntelligentSplitter = new IntelligentSplitter(options);
      if (this.logger) {
        newIntelligentSplitter.setLogger(this.logger);
      }
      // 如果有其他可配置组件，也设置它们
      const balancedChunker = new BalancedChunker(this.logger);
      newIntelligentSplitter.setBalancedChunker(balancedChunker);
      newIntelligentSplitter.setSemanticBoundaryAnalyzer(new SemanticBoundaryAnalyzer());
      newIntelligentSplitter.setUnifiedOverlapCalculator(new UnifiedOverlapCalculator({
        maxSize: options.overlapSize || 50,
        minLines: 1,
        maxOverlapRatio: 0.3,
        enableASTBoundaryDetection: false
      }));
      (strategy as any).intelligentSplitter = newIntelligentSplitter;
    }

    return strategy;
  }

  getDependencies(): string[] {
    return ['LoggerService']; // IntelligentSplitter主要依赖内部组件
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