import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { IProcessingStrategy } from '../../processing/strategies/providers/IProcessingStrategy';
import { DetectionResult, ProcessingStrategyType } from '../UnifiedDetectionCenter';
import { ProcessingStrategyFactory } from '../strategy/ProcessingStrategyFactory';
import { FileFeatureDetector } from '../utils/FileFeatureDetector';

/**
 * 策略管理器
 * 职责：统一管理策略选择逻辑，协调策略工厂和特征检测器
 */
@injectable()
export class StrategyManager {
  private logger?: LoggerService;
  private strategyFactory: ProcessingStrategyFactory;
  private fileFeatureDetector: FileFeatureDetector;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.ProcessingStrategyFactory) strategyFactory?: ProcessingStrategyFactory
  ) {
    this.logger = logger;
    this.strategyFactory = strategyFactory || new ProcessingStrategyFactory(logger);
    this.fileFeatureDetector = new FileFeatureDetector(logger);
  }

  /**
   * 根据检测结果选择最佳策略
   */
  selectOptimalStrategy(
    detection: DetectionResult,
    dependencies?: {
      treeSitterService?: any;
      universalTextSplitter?: any;
      markdownSplitter?: any;
      xmlSplitter?: any;
    }
  ): IProcessingStrategy {
    this.logger?.debug(`Selecting optimal strategy for ${detection.language} (${detection.processingStrategy})`);

    // 如果提供了依赖，使用带依赖的策略创建方法
    if (dependencies) {
      return this.strategyFactory.createStrategyWithDependencies(detection, dependencies);
    }

    // 否则使用基本的策略创建方法
    return this.strategyFactory.createStrategy(detection);
  }

  /**
   * 智能策略选择（基于文件特征和性能考虑）
   */
  selectStrategyWithHeuristics(
    filePath: string,
    content: string,
    detection: DetectionResult,
    dependencies?: {
      treeSitterService?: any;
      universalTextSplitter?: any;
      markdownSplitter?: any;
      xmlSplitter?: any;
    }
  ): IProcessingStrategy {
    this.logger?.debug(`Performing heuristic strategy selection for ${filePath}`);

    // 基于文件大小调整策略
    if (detection.contentLength && detection.contentLength < 500) {
      this.logger?.info('Very small file detected, using line-based strategy');
      const lineDetection = { ...detection, processingStrategy: ProcessingStrategyType.UNIVERSAL_LINE };
      return this.selectOptimalStrategy(lineDetection, dependencies);
    }

    // 基于文件复杂度调整策略
    const complexity = this.fileFeatureDetector.calculateComplexity(content);
    if (complexity > 50) {
      this.logger?.info('High complexity file detected, preferring semantic strategies');
      if (detection.processingStrategy === ProcessingStrategyType.UNIVERSAL_LINE) {
        const semanticDetection = { ...detection, processingStrategy: ProcessingStrategyType.UNIVERSAL_SEMANTIC };
        return this.selectOptimalStrategy(semanticDetection, dependencies);
      }
    }

    // 基于语言特性调整策略
    if (this.fileFeatureDetector.isCodeLanguage(detection.language)) {
      // 对于代码文件，如果当前策略不是AST且支持TreeSitter，优先使用AST
      if (detection.processingStrategy !== ProcessingStrategyType.TREESITTER_AST &&
        this.fileFeatureDetector.canUseTreeSitter(detection.language) &&
        dependencies?.treeSitterService) {
        this.logger?.info(`Code language ${detection.language} with TreeSitter support, upgrading to AST strategy`);
        const astDetection = { ...detection, processingStrategy: ProcessingStrategyType.TREESITTER_AST };
        return this.selectOptimalStrategy(astDetection, dependencies);
      }
    }

    return this.selectOptimalStrategy(detection, dependencies);
  }

  /**
   * 获取策略降级路径
   */
  getFallbackPath(currentStrategy: ProcessingStrategyType): ProcessingStrategyType[] {
    const fallbackPaths: Record<ProcessingStrategyType, ProcessingStrategyType[]> = {
      [ProcessingStrategyType.TREESITTER_AST]: [
        ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE,
        ProcessingStrategyType.UNIVERSAL_SEMANTIC,
        ProcessingStrategyType.UNIVERSAL_BRACKET,
        ProcessingStrategyType.UNIVERSAL_LINE
      ],
      [ProcessingStrategyType.MARKDOWN_SPECIALIZED]: [
        ProcessingStrategyType.UNIVERSAL_SEMANTIC,
        ProcessingStrategyType.UNIVERSAL_LINE
      ],
      [ProcessingStrategyType.XML_SPECIALIZED]: [
        ProcessingStrategyType.UNIVERSAL_BRACKET,
        ProcessingStrategyType.UNIVERSAL_LINE
      ],
      [ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE]: [
        ProcessingStrategyType.UNIVERSAL_SEMANTIC,
        ProcessingStrategyType.UNIVERSAL_BRACKET,
        ProcessingStrategyType.UNIVERSAL_LINE
      ],
      [ProcessingStrategyType.UNIVERSAL_SEMANTIC]: [
        ProcessingStrategyType.UNIVERSAL_BRACKET,
        ProcessingStrategyType.UNIVERSAL_LINE
      ],
      [ProcessingStrategyType.UNIVERSAL_BRACKET]: [
        ProcessingStrategyType.UNIVERSAL_LINE
      ],
      [ProcessingStrategyType.UNIVERSAL_LINE]: [
        ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK
      ],
      [ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK]: []
    };

    return fallbackPaths[currentStrategy] || [ProcessingStrategyType.UNIVERSAL_LINE];
  }

  /**
   * 创建降级策略
   */
  createFallbackStrategy(
    originalDetection: DetectionResult,
    fallbackStrategyType: ProcessingStrategyType,
    dependencies?: {
      treeSitterService?: any;
      universalTextSplitter?: any;
      markdownSplitter?: any;
      xmlSplitter?: any;
    }
  ): IProcessingStrategy {
    this.logger?.info(`Creating fallback strategy: ${fallbackStrategyType} (original: ${originalDetection.processingStrategy})`);

    const fallbackDetection = { ...originalDetection, processingStrategy: fallbackStrategyType };
    return this.selectOptimalStrategy(fallbackDetection, dependencies);
  }

  /**
   * 获取所有可用策略信息
   */
  getAvailableStrategies(): Array<{
    type: ProcessingStrategyType;
    name: string;
    description: string;
    supported: boolean;
  }> {
    const availableTypes = this.strategyFactory.getAvailableStrategyTypes();

    return availableTypes.map((type: string) => ({
      type,
      name: type.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      description: this.getStrategyDescription(type),
      supported: this.strategyFactory.isStrategyTypeSupported(type)
    }));
  }

  /**
   * 获取策略描述
   */
  private getStrategyDescription(strategyType: ProcessingStrategyType): string {
    const descriptions: Record<ProcessingStrategyType, string> = {
      [ProcessingStrategyType.TREESITTER_AST]: 'Uses TreeSitter AST parsing for precise code structure analysis',
      [ProcessingStrategyType.MARKDOWN_SPECIALIZED]: 'Specialized processing for Markdown documents',
      [ProcessingStrategyType.XML_SPECIALIZED]: 'Specialized processing for XML and HTML documents',
      [ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE]: 'Fine-grained semantic segmentation with smaller chunks',
      [ProcessingStrategyType.UNIVERSAL_SEMANTIC]: 'Semantic boundary detection for intelligent code splitting',
      [ProcessingStrategyType.UNIVERSAL_BRACKET]: 'Bracket-balanced segmentation for structured content',
      [ProcessingStrategyType.UNIVERSAL_LINE]: 'Simple line-based segmentation as a reliable fallback',
      [ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK]: 'Emergency fallback that returns entire content as single chunk'
    };

    return descriptions[strategyType] || 'Unknown strategy type';
  }
}