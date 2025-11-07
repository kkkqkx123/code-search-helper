import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/CoreISplitStrategy';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';

/**
 * AST策略实现
 * 实现ISplitStrategy接口，使用TreeSitter进行AST解析
 */
@injectable()
export class ASTSplitStrategy implements ISplitStrategy {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ) {
    this.logger?.info(`ASTSplitStrategy.split called with language: ${language}, filePath: ${filePath}`);
    this.logger?.info(`ASTSplitStrategy.split - treeSitterService available: ${!!this.treeSitterService}`);
    
    // 确保logger存在
    if (!this.logger) {
      console.log('ASTSplitStrategy: Logger is not available');
    }
    
    if (!this.treeSitterService) {
      this.logger?.warn('TreeSitterService not available, falling back to semantic strategy');
      this.logger?.info('TreeSitterService is undefined, returning fallback chunk');
      throw new Error('TreeSitterService not available');
    }

    try {
      // 如果提供了AST，直接使用
      let parseResult = ast ? { success: true, ast } : null;
      let detectedLanguage = null;

      // 如果没有提供AST，尝试解析
      if (!parseResult) {
        this.logger?.debug(`Starting AST parsing for file: ${filePath}, language: ${language}`);
        
        try {
          detectedLanguage = await this.treeSitterService.detectLanguage(filePath || '');
          this.logger?.debug(`Language detection from file path: ${JSON.stringify(detectedLanguage)}`);
        } catch (detectError) {
          this.logger?.warn(`Language detection from file path failed: ${detectError}`);
        }
        
        // 如果基于文件路径的检测失败，尝试使用传入的语言参数
        if (!detectedLanguage && language) {
          this.logger?.info(`Using provided language parameter: ${language}`);
          detectedLanguage = {
            name: language,
            fileExtensions: [],
            supported: true
          };
        }
        
        if (!detectedLanguage) {
          this.logger?.warn(`Language not supported by TreeSitter for ${filePath}`);
          throw new Error(`Language not supported by TreeSitter for ${filePath}`);
        }

        this.logger?.info(`Using TreeSitter AST parsing for ${detectedLanguage.name}`);
        try {
          parseResult = await this.treeSitterService.parseCode(content, detectedLanguage.name);
          if (!parseResult.success || !parseResult.ast) {
            this.logger?.warn(`Parse failed for language ${detectedLanguage.name}, success: ${parseResult.success}, ast: ${!!parseResult.ast}`);
            throw new Error(`TreeSitter parsing failed for ${filePath}`);
          }
        } catch (parseError) {
          this.logger?.error(`Failed to parse code with TreeSitter: ${parseError}`);
          throw new Error(`TreeSitter parsing failed for ${filePath}: ${parseError}`);
        }
      }

      if (!parseResult.success || !parseResult.ast) {
        this.logger?.warn(`TreeSitter parsing failed for ${filePath}`);
        throw new Error(`TreeSitter parsing failed for ${filePath}`);
      }

      // 如果没有检测到语言但有AST，使用传入的语言参数
      if (!detectedLanguage && language) {
        detectedLanguage = {
          name: language,
          fileExtensions: [],
          supported: true
        };
      }

      // 提取函数和类定义
      const languageName = detectedLanguage?.name || language;
      this.logger?.info(`Extracting functions and classes with language: ${languageName}`);
      this.logger?.info(`detectedLanguage.name: ${detectedLanguage?.name}, fallback language: ${language}`);
      this.logger?.info(`Parse result success: ${parseResult.success}, AST exists: ${!!parseResult.ast}`);
      
      // 传递语言参数以确保正确提取
      this.logger?.info(`Using language-specific extraction for ${languageName}...`);
      const functions = await this.treeSitterService.extractFunctions(parseResult.ast, languageName);
      const classes = await this.treeSitterService.extractClasses(parseResult.ast, languageName);
      this.logger?.info(`Extracted ${functions.length} functions and ${classes.length} classes using language-specific extraction`);

      this.logger?.info(`TreeSitter extracted ${functions.length} functions and ${classes.length} classes`);
      
      // 添加详细的调试信息
      this.logger?.info(`Function nodes: ${functions.length}, Class nodes: ${classes.length}`);
      if (functions.length > 0) {
        this.logger?.info(`First function node type: ${functions[0]?.type}`);
        this.logger?.info(`First function node has startPosition: ${!!functions[0]?.startPosition}`);
        this.logger?.info(`First function node has endPosition: ${!!functions[0]?.endPosition}`);
      }
      if (classes.length > 0) {
        this.logger?.info(`First class node type: ${classes[0]?.type}`);
      }

      // 将AST节点转换为CodeChunk
      const chunks: any[] = [];

      // 处理函数定义
      this.logger?.info(`Processing ${functions.length} functions...`);
      for (let i = 0; i < functions.length; i++) {
        const func = functions[i];
        let location;
        let funcText;

        this.logger?.debug(`Processing function ${i + 1}/${functions.length}, type: ${func.type}`);

        try {
          // 尝试获取节点位置和文本
          location = this.treeSitterService.getNodeLocation(func);
          funcText = this.treeSitterService.getNodeText(func, content);
          
          this.logger?.info(`Function ${i + 1} - Location: ${JSON.stringify(location)}, text length: ${funcText.length}`);
        } catch (error) {
          this.logger?.error(`Failed to get function location or text for function ${i + 1}: ${error}`);
          this.logger?.error(`Error stack: ${(error as Error).stack}`);
          continue;
        }

        this.logger?.info(`Function ${i + 1} location: ${JSON.stringify(location)}, text length: ${funcText.length}, node type: ${func.type}`);
        
        // 检查节点文本是否为空
        if (!funcText || funcText.trim().length === 0) {
          this.logger?.warn(`Function ${i + 1} node has empty text, skipping`);
          continue;
        }

        chunks.push({
          id: `func_${Date.now()}_${chunks.length}`,
          content: funcText,
          metadata: {
            startLine: location.startLine,
            endLine: location.endLine,
            language: language,
            filePath: filePath,
            type: 'function',
            complexity: this.calculateComplexity(funcText)
          }
        });
      }

      // 处理类定义
      for (const cls of classes) {
        let location;
        let clsText;

        try {
          // 尝试获取节点位置和文本
          location = this.treeSitterService.getNodeLocation(cls);
          clsText = this.treeSitterService.getNodeText(cls, content);
        } catch (error) {
          this.logger?.warn(`Failed to get class location or text: ${error}`);
          continue;
        }

        this.logger?.debug(`Class location: ${JSON.stringify(location)}, text length: ${clsText.length}`);
        
        // 检查节点文本是否为空
        if (!clsText || clsText.trim().length === 0) {
          this.logger?.warn(`Class node has empty text, skipping`);
          continue;
        }

        chunks.push({
          id: `class_${Date.now()}_${chunks.length}`,
          content: clsText,
          metadata: {
            startLine: location.startLine,
            endLine: location.endLine,
            language: language,
            filePath: filePath,
            type: 'class',
            complexity: this.calculateComplexity(clsText)
          }
        });
      }

      this.logger?.debug(`Generated ${chunks.length} chunks from AST`);
      
      // 如果没有提取到任何函数或类，返回包含整个文件的chunk
      if (chunks.length === 0) {
        this.logger?.info('No functions or classes found by TreeSitter, returning full content as single chunk');
        chunks.push({
          id: `full_content_${Date.now()}`,
          content: content,
          metadata: {
            startLine: 1,
            endLine: content.split('\n').length,
            language: language,
            filePath: filePath,
            type: 'full_content',
            complexity: this.calculateComplexity(content),
            reason: 'no_functions_or_classes_found'
          }
        });
      }

      this.logger?.info(`Successfully created ${chunks.length} chunks from AST extraction`);
      this.logger?.info(`ASTSplitStrategy.split returning ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger?.error(`AST strategy failed: ${error}`);
      this.logger?.error(`Error stack: ${(error as Error).stack}`);
      this.logger?.error(`Error name: ${(error as Error).name}`);
      this.logger?.error(`Error message: ${(error as Error).message}`);

      // 如果失败，返回一个简单的块
      const fallbackChunk = [{
        id: `fallback_${Date.now()}`,
        content,
        metadata: {
          startLine: 1,
          endLine: content.split('\n').length,
          language: language,
          filePath: filePath,
          type: 'fallback',
          fallback: true,
          error: (error as Error).message
        }
      }];
      
      this.logger?.warn(`Returning fallback chunk due to AST strategy failure`);
      return fallbackChunk;
    }
  }

  getName(): string {
    return 'ASTStrategy';
  }

  getDescription(): string {
    return 'Uses TreeSitter AST parsing to extract functions and classes';
  }

  supportsLanguage(language: string): boolean {
    // AST策略支持大多数编程语言
    const supportedLanguages = [
      'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
    ];
    return supportedLanguages.includes(language.toLowerCase());
  }



  canHandleNode(language: string, node: any): boolean {
    return this.supportsLanguage(language) && node !== undefined;
  }

  private calculateComplexity(content: string): number {
    let complexity = 0;

    // 基于代码结构计算复杂度
    complexity += (content.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/g) || []).length * 2;
    complexity += (content.match(/\b(function|method|class|interface)\b/g) || []).length * 3;
    complexity += (content.match(/[{}]/g) || []).length;
    complexity += (content.match(/[()]/g) || []).length * 0.5;

    // 基于代码长度调整
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1) * 2;

    return Math.round(complexity);
  }
}

/**
 * AST策略提供者
 * 负责创建AST策略实例
 */
@injectable()
export class ASTStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  getName(): string {
    return 'treesitter_ast';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    this.logger?.info('Creating ASTSplitStrategy instance with treeSitterService:', !!this.treeSitterService);
    return new ASTSplitStrategy(
      this.treeSitterService,
      this.logger
    );
  }

  getDependencies(): string[] {
    return ['TreeSitterService'];
  }

  supportsLanguage(language: string): boolean {
    const strategy = this.createStrategy();
    return strategy.supportsLanguage(language);
  }



  getDescription(): string {
    return 'Provides AST-based code splitting using TreeSitter';
  }
}