import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from '../impl/base/IProcessingStrategy';
import { DetectionResult, ProcessingStrategyType } from '../../detection/UnifiedDetectionCenter';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { MarkdownTextStrategy } from '../../utils/md/MarkdownTextStrategy';
import { XMLTextStrategy } from '../../utils/xml/XMLTextStrategy';
import { ASTStrategy } from '../impl/ASTStrategy';
import { BracketSegmentationStrategy } from '../segmentation/BracketSegmentationStrategy';
import { LineSegmentationStrategy } from '../segmentation/LineSegmentationStrategy';
import { MarkdownSegmentationStrategy } from '../segmentation/MarkdownSegmentationStrategy';
import { SemanticSegmentationStrategy } from '../segmentation/SemanticSegmentationStrategy';
import { XMLStrategy } from '../segmentation/XMLSegmentationStrategy';

@injectable()
export class ProcessingStrategyFactory {
  private logger?: LoggerService;
  private treeSitterService?: TreeSitterService;
  private markdownStrategy: MarkdownTextStrategy | undefined;
  private xmlStrategy: XMLTextStrategy | undefined;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.TreeSitterService) treeSitterService?: TreeSitterService,
    @inject(TYPES.MarkdownTextStrategy) markdownStrategy?: MarkdownTextStrategy,
    @inject(TYPES.XMLTextStrategy) xmlStrategy?: XMLTextStrategy
  ) {
    this.logger = logger;
    this.treeSitterService = treeSitterService;
    this.markdownStrategy = markdownStrategy;
    this.xmlStrategy = xmlStrategy;
  }

  createStrategy(detection: DetectionResult): IProcessingStrategy {
    switch (detection.processingStrategy) {
      case ProcessingStrategyType.TREESITTER_AST:
        return new ASTStrategy(this.treeSitterService, this.logger);

      case ProcessingStrategyType.MARKDOWN_SPECIALIZED:
        return new MarkdownSegmentationStrategy(this.logger);

      case ProcessingStrategyType.XML_SPECIALIZED:
        return new XMLStrategy(this.xmlStrategy, this.logger);

      case ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE:
        // 使用精细模式的语义分段策略
        const fineSemanticStrategy = new SemanticSegmentationStrategy(this.logger);
        // 通过设置标志来启用精细模式
        (fineSemanticStrategy as any).fineMode = true;
        return fineSemanticStrategy;

      case ProcessingStrategyType.UNIVERSAL_SEMANTIC:
        return new SemanticSegmentationStrategy(this.logger);

      case ProcessingStrategyType.UNIVERSAL_BRACKET:
        return new BracketSegmentationStrategy(undefined, this.logger);

      case ProcessingStrategyType.UNIVERSAL_LINE:
      case ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK:
      default:
        return new LineSegmentationStrategy(this.logger);
    }
  }

  getAvailableStrategyTypes(): string[] {
    return Object.values(ProcessingStrategyType);
  }

  isStrategyTypeSupported(strategyType: string): boolean {
    return Object.values(ProcessingStrategyType).includes(strategyType as ProcessingStrategyType);
  }

  createStrategyWithDependencies(
    detection: DetectionResult,
    dependencies: {
      treeSitterService?: any;
      universalTextStrategy?: any;
      markdownStrategy?: any;
      xmlStrategy?: any;
    }
  ): IProcessingStrategy {
    // 创建带有依赖的策略
    switch (detection.processingStrategy) {
      case ProcessingStrategyType.TREESITTER_AST:
        return new ASTStrategy(dependencies.treeSitterService || this.treeSitterService, this.logger);

      case ProcessingStrategyType.MARKDOWN_SPECIALIZED:
        return new MarkdownSegmentationStrategy(this.logger);

      case ProcessingStrategyType.XML_SPECIALIZED:
        return new XMLStrategy(dependencies.xmlStrategy || this.xmlStrategy, this.logger);

      case ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE:
        const fineSemanticStrategy = new SemanticSegmentationStrategy(this.logger);
        (fineSemanticStrategy as any).fineMode = true;
        return fineSemanticStrategy;

      case ProcessingStrategyType.UNIVERSAL_SEMANTIC:
        return new SemanticSegmentationStrategy(this.logger);

      case ProcessingStrategyType.UNIVERSAL_BRACKET:
        return new BracketSegmentationStrategy(undefined, this.logger);

      case ProcessingStrategyType.UNIVERSAL_LINE:
      case ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK:
      default:
        return new LineSegmentationStrategy(this.logger);
    }
  }
}