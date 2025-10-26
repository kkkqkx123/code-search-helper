import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { IProcessingStrategy } from './IProcessingStrategy';
import { DetectionResult, ProcessingStrategyType } from '../UnifiedDetectionCenter';
import { ASTStrategy } from '../../processing/strategies/providers/ASTStrategy';
import { MarkdownStrategy } from '../../processing/strategies/providers/MarkdownStrategy';
import { XMLStrategy } from '../../processing/strategies/providers/XMLStrategy';
import { SemanticFineStrategy } from '../../processing/strategies/providers/SemanticFineStrategy';
import { SemanticStrategy } from '../../processing/strategies/providers/SemanticStrategy';
import { BracketStrategy } from '../../processing/strategies/providers/BracketStrategy';
import { LineStrategy } from '../../processing/strategies/providers/LineStrategy';
import { ISplitStrategy, ChunkingOptions } from '../../interfaces/ISplitStrategy';
import { UnifiedStrategyFactory } from '../../processing/strategies/factory/UnifiedStrategyFactory';

/**
 * 处理策略工厂
 * 职责：根据检测结果创建合适的策略实例
 * 整合了原有的策略创建逻辑和新的统一策略工厂
 */
@injectable()
export class ProcessingStrategyFactory {
  private logger?: LoggerService;
  private unifiedStrategyFactory?: UnifiedStrategyFactory;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.TreeSitterService) treeSitterService?: any,
    @inject(TYPES.UniversalTextSplitter) universalTextSplitter?: any,
    @inject(TYPES.MarkdownTextSplitter) markdownSplitter?: any,
    @inject(TYPES.XMLTextSplitter) xmlSplitter?: any,
    @inject(TYPES.UnifiedStrategyFactory) unifiedStrategyFactory?: UnifiedStrategyFactory
  ) {
    this.logger = logger;
    this.unifiedStrategyFactory = unifiedStrategyFactory;
  }

  /**
   * 根据检测结果创建策略（兼容原有接口）
   */
  createStrategy(detection: DetectionResult): IProcessingStrategy {
    // 如果有统一策略工厂，优先使用
    if (this.unifiedStrategyFactory) {
      try {
        const unifiedStrategy = this.unifiedStrategyFactory.createStrategyFromDetection(detection);
        // 将统一策略转换为处理策略
        return this.convertToProcessingStrategy(unifiedStrategy, detection);
      } catch (error) {
        this.logger?.warn(`Failed to create strategy from unified factory: ${error}, falling back to legacy implementation`);
      }
    }

    // 回退到原有实现
    return this.createLegacyStrategy(detection);
  }

  /**
   * 创建带依赖注入的策略实例（兼容原有接口）
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
    // 如果有统一策略工厂，优先使用
    if (this.unifiedStrategyFactory) {
      try {
        const options: ChunkingOptions = {
          maxChunkSize: 2000,
          overlapSize: 200,
          preserveFunctionBoundaries: true,
          preserveClassBoundaries: true,
          includeComments: true,
          minChunkSize: 100,
          // 将依赖项作为自定义属性传递
          treeSitterService: dependencies.treeSitterService,
          universalTextSplitter: dependencies.universalTextSplitter,
          markdownSplitter: dependencies.markdownSplitter,
          xmlSplitter: dependencies.xmlSplitter
        } as any;
        
        const unifiedStrategy = this.unifiedStrategyFactory.createStrategyFromType(
          detection.processingStrategy || 'universal_line',
          options
        );
        
        // 将统一策略转换为处理策略
        return this.convertToProcessingStrategy(unifiedStrategy, detection);
      } catch (error) {
        this.logger?.warn(`Failed to create strategy from unified factory with dependencies: ${error}, falling back to legacy implementation`);
      }
    }

    // 回退到原有实现
    return this.createLegacyStrategyWithDependencies(detection, dependencies);
  }

  /**
   * 根据策略类型创建策略（新增接口，支持统一策略工厂）
   */
  createStrategyFromType(strategyType: ProcessingStrategyType, options?: any): IProcessingStrategy {
    // 如果有统一策略工厂，优先使用
    if (this.unifiedStrategyFactory) {
      try {
        const unifiedStrategy = this.unifiedStrategyFactory.createStrategyFromType(strategyType, options);
        const detection: DetectionResult = {
          language: 'unknown',
          confidence: 0.5,
          fileType: 'normal',
          processingStrategy: strategyType
        };
        return this.convertToProcessingStrategy(unifiedStrategy, detection);
      } catch (error) {
        this.logger?.warn(`Failed to create strategy from type ${strategyType}: ${error}, falling back to legacy implementation`);
      }
    }

    // 回退到原有实现
    const detection: DetectionResult = {
      language: 'unknown',
      confidence: 0.5,
      fileType: 'normal',
      processingStrategy: strategyType
    };
    return this.createLegacyStrategy(detection);
  }

  /**
   * 根据语言创建策略（新增接口，支持统一策略工厂）
   */
  createStrategyFromLanguage(language: string, options?: any): IProcessingStrategy {
    // 如果有统一策略工厂，优先使用
    if (this.unifiedStrategyFactory) {
      try {
        const unifiedStrategy = this.unifiedStrategyFactory.createStrategyFromLanguage(language, options);
        const detection: DetectionResult = {
          language,
          confidence: 0.8,
          fileType: 'normal',
          processingStrategy: 'universal_semantic'
        };
        return this.convertToProcessingStrategy(unifiedStrategy, detection);
      } catch (error) {
        this.logger?.warn(`Failed to create strategy from language ${language}: ${error}, falling back to legacy implementation`);
      }
    }

    // 回退到原有实现
    const detection: DetectionResult = {
      language,
      confidence: 0.8,
      fileType: 'normal',
      processingStrategy: this.determineStrategyTypeFromLanguage(language)
    };
    return this.createLegacyStrategy(detection);
  }

  /**
   * 获取所有可用的策略类型
   */
  getAvailableStrategyTypes(): ProcessingStrategyType[] {
    // 如果有统一策略工厂，合并两者的策略类型
    if (this.unifiedStrategyFactory) {
      const unifiedProviders = this.unifiedStrategyFactory.getAvailableProviders();
      const legacyTypes = [
        ProcessingStrategyType.TREESITTER_AST,
        ProcessingStrategyType.MARKDOWN_SPECIALIZED,
        ProcessingStrategyType.XML_SPECIALIZED,
        ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE,
        ProcessingStrategyType.UNIVERSAL_SEMANTIC,
        ProcessingStrategyType.UNIVERSAL_BRACKET,
        ProcessingStrategyType.UNIVERSAL_LINE,
        ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK
      ];
      
      // 合并并去重
      const allTypes = new Set<ProcessingStrategyType>([
        ...legacyTypes,
        ...unifiedProviders as ProcessingStrategyType[]
      ]);
      
      return Array.from(allTypes);
    }

    // 返回原有策略类型
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

  /**
   * 将统一策略转换为处理策略
   */
  private convertToProcessingStrategy(unifiedStrategy: ISplitStrategy, detection: DetectionResult): IProcessingStrategy {
    return new UnifiedStrategyAdapter(unifiedStrategy, detection, this.logger);
  }

  /**
   * 创建传统策略（原有实现）
   */
  private createLegacyStrategy(detection: DetectionResult): IProcessingStrategy {
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
   * 创建带依赖的传统策略（原有实现）
   */
  private createLegacyStrategyWithDependencies(
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
   * 根据语言确定策略类型
   */
  private determineStrategyTypeFromLanguage(language: string): ProcessingStrategyType {
    switch (language.toLowerCase()) {
      case 'markdown':
      case 'md':
        return ProcessingStrategyType.MARKDOWN_SPECIALIZED;
      case 'xml':
      case 'html':
        return ProcessingStrategyType.XML_SPECIALIZED;
      case 'typescript':
      case 'javascript':
      case 'python':
      case 'java':
      case 'c':
      case 'cpp':
      case 'csharp':
      case 'go':
      case 'rust':
        return ProcessingStrategyType.TREESITTER_AST;
      default:
        return ProcessingStrategyType.UNIVERSAL_SEMANTIC;
    }
  }
}

/**
 * 统一策略适配器
 * 将ISplitStrategy适配为IProcessingStrategy
 */
class UnifiedStrategyAdapter implements IProcessingStrategy {
  constructor(
    private unifiedStrategy: ISplitStrategy,
    private detection: DetectionResult,
    private logger?: LoggerService
  ) {}

  async execute(filePath: string, content: string, detection: DetectionResult) {
    try {
      this.logger?.debug(`Executing unified strategy: ${this.unifiedStrategy.getName()} for ${filePath}`);
      
      const chunks = await this.unifiedStrategy.split(
        content,
        detection.language,
        filePath,
        undefined, // options
        undefined, // nodeTracker
        detection.metadata?.astInfo
      );

      return {
        chunks,
        metadata: {
          strategy: this.unifiedStrategy.getName(),
          language: detection.language,
          unified: true
        }
      };
    } catch (error) {
      this.logger?.error(`Unified strategy execution failed: ${error}`);
      throw error;
    }
  }

  getName(): string {
    return this.unifiedStrategy.getName();
  }

  getDescription(): string {
    return this.unifiedStrategy.getDescription();
  }
}