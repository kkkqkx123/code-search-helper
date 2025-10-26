import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { IProcessingStrategy } from './IProcessingStrategy';
import { DetectionResult, ProcessingStrategyType } from '../UnifiedDetectionCenter';
import { ASTStrategy } from './ASTStrategy';
import { MarkdownStrategy } from './MarkdownStrategy';
import { XMLStrategy } from './XMLStrategy';
import { SemanticFineStrategy } from './SemanticFineStrategy';
import { SemanticStrategy } from './SemanticStrategy';
import { BracketStrategy } from './BracketStrategy';
import { LineStrategy } from './LineStrategy';

/**
 * 处理策略工厂
 * 职责：根据检测结果创建合适的策略实例
 */
@injectable()
export class ProcessingStrategyFactory {
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.TreeSitterService) treeSitterService?: any,
    @inject(TYPES.UniversalTextSplitter) universalTextSplitter?: any,
    @inject(TYPES.MarkdownTextSplitter) markdownSplitter?: any,
    @inject(TYPES.XMLTextSplitter) xmlSplitter?: any
  ) {
    this.logger = logger;
  }

  createStrategy(detection: DetectionResult): IProcessingStrategy {
    switch (detection.processingStrategy) {
      case ProcessingStrategyType.TREESITTER_AST:
        return new ASTStrategy(undefined, this.logger);

      case ProcessingStrategyType.MARKDOWN_SPECIALIZED:
        return new MarkdownStrategy(undefined, this.logger);

      case ProcessingStrategyType.XML_SPECIALIZED:
        return new XMLStrategy(undefined, this.logger);

      case ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE:
        return new SemanticFineStrategy(undefined, this.logger);

      case ProcessingStrategyType.UNIVERSAL_SEMANTIC:
        return new SemanticStrategy(undefined, this.logger);

      case ProcessingStrategyType.UNIVERSAL_BRACKET:
        return new BracketStrategy(undefined, this.logger);

      case ProcessingStrategyType.UNIVERSAL_LINE:
      case ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK:
      default:
        return new LineStrategy(undefined, this.logger);
    }
  }

  /**
   * 创建带依赖注入的策略实例
   */
  createStrategyWithDependencies(
    detection: DetectionResult,
    dependencies: {
      treeSitterService?: any;
      universalTextSplitter?: any;
      markdownSplitter?: any;
      xmlSplitter?: any;
    }
  ): IProcessingStrategy {
    const { treeSitterService, universalTextSplitter, markdownSplitter, xmlSplitter } = dependencies;

    switch (detection.processingStrategy) {
      case ProcessingStrategyType.TREESITTER_AST:
        return new ASTStrategy(treeSitterService, this.logger);

      case ProcessingStrategyType.MARKDOWN_SPECIALIZED:
        return new MarkdownStrategy(markdownSplitter, this.logger);

      case ProcessingStrategyType.XML_SPECIALIZED:
        return new XMLStrategy(xmlSplitter, this.logger);

      case ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE:
        return new SemanticFineStrategy(universalTextSplitter, this.logger);

      case ProcessingStrategyType.UNIVERSAL_SEMANTIC:
        return new SemanticStrategy(universalTextSplitter, this.logger);

      case ProcessingStrategyType.UNIVERSAL_BRACKET:
        return new BracketStrategy(universalTextSplitter, this.logger);

      case ProcessingStrategyType.UNIVERSAL_LINE:
      case ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK:
      default:
        return new LineStrategy(universalTextSplitter, this.logger);
    }
  }

  /**
   * 获取所有可用的策略类型
   */
  getAvailableStrategyTypes(): ProcessingStrategyType[] {
    return [
      ProcessingStrategyType.TREESITTER_AST,
      ProcessingStrategyType.MARKDOWN_SPECIALIZED,
      ProcessingStrategyType.XML_SPECIALIZED,
      ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE,
      ProcessingStrategyType.UNIVERSAL_SEMANTIC,
      ProcessingStrategyType.UNIVERSAL_BRACKET,
      ProcessingStrategyType.UNIVERSAL_LINE,
      ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK
    ];
  }

  /**
   * 检查策略类型是否支持
   */
  isStrategyTypeSupported(strategyType: ProcessingStrategyType): boolean {
    return this.getAvailableStrategyTypes().includes(strategyType);
  }
}