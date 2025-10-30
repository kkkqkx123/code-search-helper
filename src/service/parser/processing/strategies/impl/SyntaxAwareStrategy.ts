import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/CoreISplitStrategy';
import { CodeChunk, DEFAULT_CHUNKING_OPTIONS, ChunkingPreset, ChunkingPresetFactory, EnhancedChunkingOptions, DEFAULT_ENHANCED_CHUNKING_OPTIONS } from '../../types/splitting-types';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { ChunkOptimizer } from '../../utils/chunk-processing/ChunkOptimizer';
import { strategyFactory } from '../factory/SplitStrategyFactory';
import { ISplitStrategy as OldISplitStrategy } from '../../../interfaces/CoreISplitStrategy';

export class SyntaxAwareStrategy implements ISplitStrategy {
  private options: Required<ChunkingOptions>;
  private treeSitterService?: TreeSitterService;
  private logger?: LoggerService;
  private functionStrategy?: OldISplitStrategy;
  private classStrategy?: OldISplitStrategy;
  private importStrategy?: OldISplitStrategy;
  private chunkOptimizer?: ChunkOptimizer;

  constructor(options?: ChunkingOptions) {
    // 使用预设工厂创建基础配置，然后合并用户选项
    const baseOptions = options?.preset ?
      ChunkingPresetFactory.createPreset(options.preset) :
      DEFAULT_CHUNKING_OPTIONS;
    
    this.options = {
      ...baseOptions,
      ...options
    } as Required<ChunkingOptions>;
  }

  setTreeSitterService(treeSitterService: TreeSitterService): void {
    this.treeSitterService = treeSitterService;
    // 如果子分割器已创建，也设置TreeSitterService
    if (this.functionStrategy && typeof (this.functionStrategy as any).setTreeSitterService === 'function') {
      (this.functionStrategy as any).setTreeSitterService(treeSitterService);
    }
    if (this.classStrategy && typeof (this.classStrategy as any).setTreeSitterService === 'function') {
      (this.classStrategy as any).setTreeSitterService(treeSitterService);
    }
    if (this.importStrategy && typeof (this.importStrategy as any).setTreeSitterService === 'function') {
      (this.importStrategy as any).setTreeSitterService(treeSitterService);
    }
  }

  setLogger(logger: LoggerService): void {
    this.logger = logger;
    // 如果子分割器已创建，也设置Logger
    if (this.functionStrategy && typeof (this.functionStrategy as any).setLogger === 'function') {
      (this.functionStrategy as any).setLogger(logger);
    }
    if (this.classStrategy && typeof (this.classStrategy as any).setLogger === 'function') {
      (this.classStrategy as any).setLogger(logger);
    }
    if (this.importStrategy && typeof (this.importStrategy as any).setLogger === 'function') {
      (this.importStrategy as any).setLogger(logger);
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
    const mergedOptions = { ...this.options, ...options };

    if (!this.treeSitterService) {
      throw new Error('TreeSitterService is required for SyntaxAwareStrategy');
    }

    const parseResult = ast || await this.treeSitterService.parseCode(content, language);

    if (parseResult.success && parseResult.ast) {
      return await this.createEnhancedSyntaxAwareChunks(
        content, parseResult, language, filePath, mergedOptions, nodeTracker
      );
    } else {
      // 如果解析失败，返回空数组或使用备用方案
      return [];
    }
  }

  private async createEnhancedSyntaxAwareChunks(
    content: string,
    parseResult: any,
    language: string,
    filePath: string | undefined,
    options: Required<ChunkingOptions>,
    nodeTracker?: any
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    // 使用策略工厂创建子分割器，避免直接导入
    this.functionStrategy = this.functionStrategy || strategyFactory.create('FunctionStrategy', options) as OldISplitStrategy;
    this.classStrategy = this.classStrategy || strategyFactory.create('ClassStrategy', options) as OldISplitStrategy;
    this.importStrategy = this.importStrategy || strategyFactory.create('ImportStrategy', options) as OldISplitStrategy;

    // 设置必要的服务
    if (this.treeSitterService) {
      if (this.functionStrategy && typeof (this.functionStrategy as any).setTreeSitterService === 'function') {
        (this.functionStrategy as any).setTreeSitterService(this.treeSitterService);
      }
      if (this.classStrategy && typeof (this.classStrategy as any).setTreeSitterService === 'function') {
        (this.classStrategy as any).setTreeSitterService(this.treeSitterService);
      }
      if (this.importStrategy && typeof (this.importStrategy as any).setTreeSitterService === 'function') {
        (this.importStrategy as any).setTreeSitterService(this.treeSitterService);
      }
    }

    if (this.logger) {
      if (this.functionStrategy && typeof (this.functionStrategy as any).setLogger === 'function') {
        (this.functionStrategy as any).setLogger(this.logger);
      }
      if (this.classStrategy && typeof (this.classStrategy as any).setLogger === 'function') {
        (this.classStrategy as any).setLogger(this.logger);
      }
      if (this.importStrategy && typeof (this.importStrategy as any).setLogger === 'function') {
        (this.importStrategy as any).setLogger(this.logger);
      }
    }

    try {
      // 1. 函数和方法分段（包含嵌套函数）
      if (this.functionStrategy && typeof (this.functionStrategy as any).extractFunctions === 'function') {
        const functionChunks = (this.functionStrategy as any).extractFunctions(content, parseResult.ast, language, filePath);
        if (functionChunks && functionChunks.length > 0) {
          chunks.push(...functionChunks);
        }
      }

      // 2. 类和接口分段
      if (this.classStrategy && typeof (this.classStrategy as any).extractClasses === 'function') {
        const classChunks = (this.classStrategy as any).extractClasses(content, parseResult.ast, language, filePath);
        if (classChunks && classChunks.length > 0) {
          chunks.push(...classChunks);
        }
      }

      // 3. 导入导出语句分段
      if (this.importStrategy && typeof (this.importStrategy as any).extractImports === 'function') {
        const importChunks = (this.importStrategy as any).extractImports(content, parseResult.ast, language, filePath);
        if (importChunks && importChunks.length > 0) {
          chunks.push(...importChunks);
        }
      }
    } catch (error) {
      this.logger?.error(`Error in syntax-aware chunking: ${error}`);
      // 如果某个步骤失败，继续处理其他步骤
    }

    // 4. 优化块大小
    if (!this.chunkOptimizer) {
      // 将 ChunkingOptions 转换为 EnhancedChunkingOptions
      const enhancedOptions: EnhancedChunkingOptions = {
        ...DEFAULT_ENHANCED_CHUNKING_OPTIONS,
        ...options
      };
      this.chunkOptimizer = new ChunkOptimizer(enhancedOptions);
    }
    return this.chunkOptimizer.optimize(chunks, content);
  }

  getName(): string {
    return 'SyntaxAwareStrategy';
  }

  getDescription(): string {
    return 'Syntax-aware Strategy that combines function, class, and import Strategys';
  }

  supportsLanguage(language: string): boolean {
    if (!this.treeSitterService) {
      return false;
    }

    const supportedLanguages = this.treeSitterService.getSupportedLanguages();
    return supportedLanguages.some(lang =>
      lang.name.toLowerCase() === language.toLowerCase() && lang.supported
    );
  }
}

/**
 * 语法感知策略提供者
 */
@injectable()
export class SyntaxAwareStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService
  ) { }

  getName(): string {
    return 'SyntaxAwareStrategyProvider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    const strategy = new SyntaxAwareStrategy(options);
    if (this.treeSitterService) {
      strategy.setTreeSitterService(this.treeSitterService);
    }
    if (this.logger) {
      strategy.setLogger(this.logger);
    }
    return strategy;
  }

  getDependencies(): string[] {
    return ['TreeSitterService'];
  }

  supportsLanguage(language: string): boolean {
    const strategy = this.createStrategy();
    return strategy.supportsLanguage(language);
  }

  getDescription(): string {
    return 'Provides syntax-aware code splitting strategy';
  }
}