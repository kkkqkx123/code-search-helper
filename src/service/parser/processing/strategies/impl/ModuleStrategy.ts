import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { CodeChunk, DEFAULT_CHUNKING_OPTIONS } from '../../../processing';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { ContentHashIDGenerator } from '../../utils/ContentHashIDGenerator';
import { ComplexityCalculator } from '../../utils/calculation/ComplexityCalculator';
import { BaseSplitStrategy } from './base/BaseASTStrategy';

/**
 * 模块分割策略
 * 专注于提取和分割模块级别的定义（如导入、导出等）
 */
@injectable()
export class ModuleStrategy extends BaseSplitStrategy {
  private complexityCalculator: ComplexityCalculator;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.TreeSitterService) treeSitterService?: TreeSitterService
  ) {
    super({ ...DEFAULT_CHUNKING_OPTIONS });
    this.complexityCalculator = new ComplexityCalculator();
    if (logger) {
      this.setLogger(logger);
    }
    if (treeSitterService) {
      this.setTreeSitterService(treeSitterService);
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
    // 验证输入
    if (!this.validateInput(content, language)) {
      return [];
    }

    if (!this.treeSitterService) {
      this.logger?.warn('TreeSitterService is required for ModuleStrategy');
      return [];
    }

    try {
      // 使用传入的AST或重新解析
      let parseResult = ast;
      if (!parseResult) {
        parseResult = await this.treeSitterService.parseCode(content, language);
      }

      if (parseResult && parseResult.success && parseResult.ast) {
        return this.extractModuleInfo(content, parseResult.ast, language, filePath, nodeTracker);
      } else {
        this.logger?.warn('Failed to parse code for module extraction');
        return [];
      }
    } catch (error) {
      this.logger?.warn(`Module splitting failed: ${error}`);
      return [];
    }
  }

  getName(): string {
    return 'ModuleStrategy';
  }

  getDescription(): string {
    return 'Module Strategy that extracts module-level information like imports and exports';
  }

  supportsLanguage(language: string): boolean {
    return this.treeSitterService?.detectLanguage(language) !== null || false;
  }

  getPriority(): number {
    return 0; // 最高优先级
  }

  /**
   * 提取模块信息 - 改为public以便测试
   */
  async extractModuleInfo(
    content: string,
    ast: any,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    try {
      // 提取导入语句
      const imports = this.treeSitterService!.extractImports(ast);

      if (imports && imports.length > 0) {
        this.logger?.debug(`Found ${imports.length} imports to process`);

        for (const importNode of imports) {
          const importChunks = this.processImportNode(importNode, content, language, filePath, nodeTracker);
          chunks.push(...importChunks);
        }
      }

      // 提取导出语句
      const exports = this.treeSitterService!.extractExports(ast);

      if (exports && (await exports).length > 0) {
        this.logger?.debug(`Found ${(await exports).length} exports to process`);

        for (const exportNode of await exports) {
          const exportChunks = this.processExportNode(exportNode, content, language, filePath, nodeTracker);
          chunks.push(...exportChunks);
        }
      }

    } catch (error) {
      this.logger?.warn(`Failed to extract module chunks: ${error}`);
    }

    return chunks;
  }

  /**
   * 处理单个导入节点
   */
  private processImportNode(
    importNode: any,
    content: string,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // 获取导入文本和位置信息
    const importText = this.treeSitterService!.getNodeText(importNode, content);
    const location = this.treeSitterService!.getNodeLocation(importNode);

    // 验证基本信息
    if (!location) {
      this.logger?.warn('Failed to get import location');
      return chunks;
    }

    const lineCount = location.endLine - location.startLine + 1;
    const complexity = this.complexityCalculator.calculate(importText);

    // 创建代码块
    const metadata = {
      startLine: location.startLine,
      endLine: location.endLine,
      language,
      filePath,
      type: 'import' as const,
      complexity,
      lineCount
    };

    chunks.push(this.createChunk(importText, metadata));

    return chunks;
  }

  /**
   * 处理单个导出节点
   */
  private processExportNode(
    exportNode: any,
    content: string,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // 获取导出文本和位置信息
    const exportText = this.treeSitterService!.getNodeText(exportNode, content);
    const location = this.treeSitterService!.getNodeLocation(exportNode);

    // 验证基本信息
    if (!location) {
      this.logger?.warn('Failed to get export location');
      return chunks;
    }

    const lineCount = location.endLine - location.startLine + 1;
    const complexity = this.complexityCalculator.calculate(exportText);

    // 创建代码块
    const metadata = {
      startLine: location.startLine,
      endLine: location.endLine,
      language,
      filePath,
      type: 'code' as const,
      complexity,
      lineCount
    };

    chunks.push(this.createChunk(exportText, metadata));

    return chunks;
  }
}

/**
 * 模块策略提供者
 */
@injectable()
export class ModuleStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService
  ) { }

  getName(): string {
    return 'ModuleStrategyProvider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new ModuleStrategy(this.logger, this.treeSitterService);
  }

  getDependencies(): string[] {
    return ['TreeSitterService'];
  }

  supportsLanguage(language: string): boolean {
    const strategy = this.createStrategy();
    return strategy.supportsLanguage(language);
  }

  getPriority(): number {
    return 0; // 最高优先级
  }

  getDescription(): string {
    return 'Provides module-level information extraction strategy';
  }
}