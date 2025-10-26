import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { CodeChunk, DEFAULT_CHUNKING_OPTIONS } from '../../../splitting';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { ChunkOptimizer } from '../../../splitting/utils/chunk-processing/ChunkOptimizer';
import { strategyFactory } from '../../../splitting/core/SplitStrategyFactory';
import { ISplitStrategy as OldISplitStrategy } from '../../../splitting/interfaces/ISplitStrategy';

export class SyntaxAwareSplitter implements ISplitStrategy {
  private options: Required<ChunkingOptions>;
  private treeSitterService?: TreeSitterService;
  private logger?: LoggerService;
  private functionSplitter?: OldISplitStrategy;
  private classSplitter?: OldISplitStrategy;
  private importSplitter?: OldISplitStrategy;
  private chunkOptimizer?: ChunkOptimizer;

  constructor(options?: ChunkingOptions) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  }

  setTreeSitterService(treeSitterService: TreeSitterService): void {
    this.treeSitterService = treeSitterService;
    // 如果子分割器已创建，也设置TreeSitterService
    if (this.functionSplitter && typeof (this.functionSplitter as any).setTreeSitterService === 'function') {
      (this.functionSplitter as any).setTreeSitterService(treeSitterService);
    }
    if (this.classSplitter && typeof (this.classSplitter as any).setTreeSitterService === 'function') {
      (this.classSplitter as any).setTreeSitterService(treeSitterService);
    }
    if (this.importSplitter && typeof (this.importSplitter as any).setTreeSitterService === 'function') {
      (this.importSplitter as any).setTreeSitterService(treeSitterService);
    }
  }

  setLogger(logger: LoggerService): void {
    this.logger = logger;
    // 如果子分割器已创建，也设置Logger
    if (this.functionSplitter && typeof (this.functionSplitter as any).setLogger === 'function') {
      (this.functionSplitter as any).setLogger(logger);
    }
    if (this.classSplitter && typeof (this.classSplitter as any).setLogger === 'function') {
      (this.classSplitter as any).setLogger(logger);
    }
    if (this.importSplitter && typeof (this.importSplitter as any).setLogger === 'function') {
      (this.importSplitter as any).setLogger(logger);
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
      throw new Error('TreeSitterService is required for SyntaxAwareSplitter');
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
    this.functionSplitter = this.functionSplitter || strategyFactory.create('FunctionSplitter', options);
    this.classSplitter = this.classSplitter || strategyFactory.create('ClassSplitter', options);
    this.importSplitter = this.importSplitter || strategyFactory.create('ImportSplitter', options);

    // 设置必要的服务
    if (this.treeSitterService) {
      if (this.functionSplitter && typeof (this.functionSplitter as any).setTreeSitterService === 'function') {
        (this.functionSplitter as any).setTreeSitterService(this.treeSitterService);
      }
      if (this.classSplitter && typeof (this.classSplitter as any).setTreeSitterService === 'function') {
        (this.classSplitter as any).setTreeSitterService(this.treeSitterService);
      }
      if (this.importSplitter && typeof (this.importSplitter as any).setTreeSitterService === 'function') {
        (this.importSplitter as any).setTreeSitterService(this.treeSitterService);
      }
    }

    if (this.logger) {
      if (this.functionSplitter && typeof (this.functionSplitter as any).setLogger === 'function') {
        (this.functionSplitter as any).setLogger(this.logger);
      }
      if (this.classSplitter && typeof (this.classSplitter as any).setLogger === 'function') {
        (this.classSplitter as any).setLogger(this.logger);
      }
      if (this.importSplitter && typeof (this.importSplitter as any).setLogger === 'function') {
        (this.importSplitter as any).setLogger(this.logger);
      }
    }

    try {
      // 1. 函数和方法分段（包含嵌套函数）
      if (this.functionSplitter && typeof (this.functionSplitter as any).extractFunctions === 'function') {
        const functionChunks = (this.functionSplitter as any).extractFunctions(content, parseResult.ast, language, filePath);
        if (functionChunks && functionChunks.length > 0) {
          chunks.push(...functionChunks);
        }
      }

      // 2. 类和接口分段
      if (this.classSplitter && typeof (this.classSplitter as any).extractClasses === 'function') {
        const classChunks = (this.classSplitter as any).extractClasses(content, parseResult.ast, language, filePath);
        if (classChunks && classChunks.length > 0) {
          chunks.push(...classChunks);
        }
      }

      // 3. 导入导出语句分段
      if (this.importSplitter && typeof (this.importSplitter as any).extractImports === 'function') {
        const importChunks = (this.importSplitter as any).extractImports(content, parseResult.ast, language, filePath);
        if (importChunks && importChunks.length > 0) {
          chunks.push(...importChunks);
        }
      }
    } catch (error) {
      this.logger?.error(`Error in syntax-aware chunking: ${error}`);
      // 如果某个步骤失败，继续处理其他步骤
    }

    // 4. 优化块大小
    this.chunkOptimizer = this.chunkOptimizer || new ChunkOptimizer(options);
    return this.chunkOptimizer.optimize(chunks, content);
  }

  getName(): string {
    return 'SyntaxAwareSplitter';
  }

  getDescription(): string {
    return 'Syntax-aware splitter that combines function, class, and import splitters';
  }

  supportsLanguage(language: string): boolean {
    // 检查TreeSitterService是否支持该语言
    return this.treeSitterService?.detectLanguage(language) !== null || false;
  }

  getPriority(): number {
    return 1; // 高优先级
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
  ) {}

  getName(): string {
    return 'SyntaxAwareStrategyProvider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    const strategy = new SyntaxAwareSplitter(options);
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

  getPriority(): number {
    return 1; // 高优先级
  }

  getDescription(): string {
    return 'Provides syntax-aware code splitting strategy';
  }
}