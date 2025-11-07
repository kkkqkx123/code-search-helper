import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from '../impl/base/IProcessingStrategy';
import { DetectionResult, ProcessingStrategyType } from '../../detection/UnifiedDetectionService';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { MarkdownTextStrategy } from '../../utils/md/MarkdownTextStrategy';
import { XMLTextStrategy } from '../../utils/xml/XMLTextStrategy';
import { ASTStrategy } from '../impl/ASTStrategy';
import { BracketSegmentationStrategy } from '../segmentation/BracketSegmentationStrategy';
import { LineSegmentationStrategy } from '../segmentation/LineSegmentationStrategy';
import { MarkdownSegmentationStrategy } from '../segmentation/MarkdownSegmentationStrategy';
import { SemanticSegmentationStrategy } from '../segmentation/SemanticSegmentationStrategy';
import { XMLStrategy } from '../segmentation/XMLSegmentationStrategy';
import { LayeredHTMLStrategy } from '../segmentation/LayeredHTMLStrategy';
import { IStrategyRegistry } from './IStrategyRegistry';

@injectable()
export class ProcessingStrategyFactory {
  private logger?: LoggerService;
  private treeSitterService?: TreeSitterService;
  private markdownStrategy: MarkdownTextStrategy | undefined;
  private xmlStrategy: XMLTextStrategy | undefined;

  constructor(
    @inject(TYPES.StrategyRegistry) private registry: IStrategyRegistry,
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.TreeSitterService) treeSitterService?: TreeSitterService,
    @inject(TYPES.MarkdownTextStrategy) markdownStrategy?: MarkdownTextStrategy,
    @inject(TYPES.XMLTextStrategy) xmlStrategy?: XMLTextStrategy
  ) {
    this.logger = logger;
    this.treeSitterService = treeSitterService;
    this.markdownStrategy = markdownStrategy;
    this.xmlStrategy = xmlStrategy;
    
    // 初始化策略注册
    this.initializeStrategies();
  }

  /**
   * 初始化策略注册
   */
  private initializeStrategies(): void {
    // 注册TreeSitter AST策略
    this.registry.registerStrategy(ProcessingStrategyType.TREESITTER_AST, () =>
      new ASTStrategy(this.treeSitterService, this.logger)
    );

    // 注册Markdown专门策略
    this.registry.registerStrategy(ProcessingStrategyType.MARKDOWN_SPECIALIZED, () =>
      new MarkdownSegmentationStrategy(this.logger)
    );

    // 注册XML专门策略
    this.registry.registerStrategy(ProcessingStrategyType.XML_SPECIALIZED, () =>
      new XMLStrategy(this.xmlStrategy, this.logger)
    );

    // 注册HTML分层策略
    this.registry.registerStrategy(ProcessingStrategyType.HTML_LAYERED, () =>
      new LayeredHTMLStrategy(this.logger, this.xmlStrategy)
    );

    // 注册精细语义分段策略
    this.registry.registerStrategy(ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE, () => {
      const fineSemanticStrategy = new SemanticSegmentationStrategy(this.logger);
      (fineSemanticStrategy as any).fineMode = true;
      return fineSemanticStrategy;
    });

    // 注册通用语义分段策略
    this.registry.registerStrategy(ProcessingStrategyType.UNIVERSAL_SEMANTIC, () =>
      new SemanticSegmentationStrategy(this.logger)
    );

    // 注册通用括号分段策略
    this.registry.registerStrategy(ProcessingStrategyType.UNIVERSAL_BRACKET, () =>
      new BracketSegmentationStrategy(undefined, this.logger)
    );

    // 注册通用行分段策略（默认策略）
    this.registry.registerStrategy(ProcessingStrategyType.UNIVERSAL_LINE, () =>
      new LineSegmentationStrategy(this.logger)
    );

    // 注册紧急单一块策略
    this.registry.registerStrategy(ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK, () =>
      new LineSegmentationStrategy(this.logger)
    );

    this.logger?.debug('All strategies registered successfully');
  }

  createStrategy(detection: DetectionResult): IProcessingStrategy {
    const strategyType = detection.processingStrategy || ProcessingStrategyType.UNIVERSAL_LINE;
    
    try {
      return this.registry.createStrategy(strategyType);
    } catch (error) {
      this.logger?.warn(`Failed to create strategy '${strategyType}', falling back to line strategy: ${error}`);
      // 降级到默认策略
      return this.registry.createStrategy(ProcessingStrategyType.UNIVERSAL_LINE);
    }
  }

  getAvailableStrategyTypes(): string[] {
    return this.registry.getSupportedTypes();
  }

  isStrategyTypeSupported(strategyType: string): boolean {
    return this.registry.isStrategyTypeSupported(strategyType);
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
    // 注意：在注册表模式下，依赖在初始化时已经注入
    // 这个方法保留是为了向后兼容，但不再使用dependencies参数
    this.logger?.warn('createStrategyWithDependencies is deprecated in registry-based mode, using standard createStrategy');
    return this.createStrategy(detection);
  }

  /**
   * 获取注册表统计信息
   * @returns 统计信息
   */
  getRegistryStats(): { totalStrategies: number; strategyTypes: string[] } {
    if ('getStats' in this.registry) {
      return (this.registry as any).getStats();
    }
    return {
      totalStrategies: this.registry.getSupportedTypes().length,
      strategyTypes: this.registry.getSupportedTypes()
    };
  }

  /**
   * 注册新策略（用于插件扩展）
   * @param type 策略类型
   * @param factory 策略工厂函数
   */
  registerCustomStrategy(type: string, factory: () => IProcessingStrategy): void {
    this.registry.registerStrategy(type, factory);
    this.logger?.info(`Custom strategy '${type}' registered`);
  }

  /**
   * 注销策略
   * @param type 策略类型
   */
  unregisterStrategy(type: string): void {
    this.registry.unregisterStrategy(type);
    this.logger?.info(`Strategy '${type}' unregistered`);
  }
}