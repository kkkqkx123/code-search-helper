import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from '../impl/IProcessingStrategy';
import { DetectionResult, ProcessingStrategyType } from '../../../universal/UnifiedDetectionCenter';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { MarkdownTextSplitter } from '../../utils/md/MarkdownTextSplitter';
import { XMLTextSplitter } from '../../utils/xml/XMLTextSplitter';
import { ASTStrategy } from '../impl/ASTStrategy';
import { BracketSegmentationStrategy } from '../impl/BracketSegmentationStrategy';
import { LineSegmentationStrategy } from '../impl/LineSegmentationStrategy';
import { MarkdownSegmentationStrategy } from '../impl/MarkdownSegmentationStrategy';
import { SemanticSegmentationStrategy } from '../impl/SemanticSegmentationStrategy';
import { XMLStrategy } from '../impl/XMLStrategy';

@injectable()
export class ProcessingStrategyFactory {
  private logger?: LoggerService;
  private treeSitterService?: TreeSitterService;
  private markdownSplitter: MarkdownTextSplitter | undefined;
  private xmlSplitter: XMLTextSplitter | undefined;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.TreeSitterService) treeSitterService?: TreeSitterService,
    @inject(TYPES.MarkdownTextSplitter) markdownSplitter?: MarkdownTextSplitter,
    @inject(TYPES.XMLTextSplitter) xmlSplitter?: XMLTextSplitter
  ) {
    this.logger = logger;
    this.treeSitterService = treeSitterService;
    this.markdownSplitter = markdownSplitter;
    this.xmlSplitter = xmlSplitter;
  }

  createStrategy(detection: DetectionResult): IProcessingStrategy {
    switch (detection.processingStrategy) {
      case ProcessingStrategyType.TREESITTER_AST:
        return new ASTStrategy(this.treeSitterService, this.logger);

      case ProcessingStrategyType.MARKDOWN_SPECIALIZED:
        return new MarkdownSegmentationStrategy(this.logger);

      case ProcessingStrategyType.XML_SPECIALIZED:
        return new XMLStrategy(this.xmlSplitter, this.logger);

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
      universalTextSplitter?: any;
      markdownSplitter?: any;
      xmlSplitter?: any;
    }
  ): IProcessingStrategy {
    // 创建带有依赖的策略
    switch (detection.processingStrategy) {
      case ProcessingStrategyType.TREESITTER_AST:
        return new ASTStrategy(dependencies.treeSitterService || this.treeSitterService, this.logger);

      case ProcessingStrategyType.MARKDOWN_SPECIALIZED:
        return new MarkdownSegmentationStrategy(this.logger);

      case ProcessingStrategyType.XML_SPECIALIZED:
        return new XMLStrategy(dependencies.xmlSplitter || this.xmlSplitter, this.logger);

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