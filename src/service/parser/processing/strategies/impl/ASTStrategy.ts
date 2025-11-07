import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from './base/IProcessingStrategy';
import { DetectionResult } from '../../detection/UnifiedDetectionService';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { ISplitStrategy, ChunkingOptions } from '../../../interfaces/CoreISplitStrategy';
import { CodeChunk } from '../../../types';

/**
 * AST策略实现
 * 使用TreeSitter进行AST解析
 */
@injectable()
export class ASTStrategy implements IProcessingStrategy, ISplitStrategy {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService,
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) { }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.info(`ASTStrategy.execute called with filePath: ${filePath}`);
    
    if (!this.treeSitterService) {
      this.logger?.warn('TreeSitterService not available, falling back to semantic strategy');
      throw new Error('TreeSitterService not available');
    }

    try {
      // 检测语言支持
      this.logger?.info(`开始处理文件: ${filePath}`);
      const detectedLanguage = await this.treeSitterService.detectLanguage(filePath);
      if (!detectedLanguage) {
        this.logger?.warn(`Language not supported by TreeSitter for ${filePath}`);
        throw new Error(`Language not supported by TreeSitter for ${filePath}`);
      }

      this.logger?.info(`Using TreeSitter AST parsing for ${detectedLanguage.name}`);

      // 使用TreeSitter解析代码
      const parseResult = await this.treeSitterService.parseCode(content, detectedLanguage.name);

      if (!parseResult.success || !parseResult.ast) {
        this.logger?.warn(`TreeSitter parsing failed for ${filePath}`);
        throw new Error(`TreeSitter parsing failed for ${filePath}`);
      }

      this.logger?.info(`TreeSitter parsing successful, AST available`);

      // 提取函数和类定义
      this.logger?.info(`开始提取函数和类定义`);
      const functions = await this.treeSitterService.extractFunctions(parseResult.ast, detectedLanguage.name);
      const classes = await this.treeSitterService.extractClasses(parseResult.ast, detectedLanguage.name);

      this.logger?.info(`TreeSitter extracted ${functions.length} functions and ${classes.length} classes`);

      // 将AST节点转换为CodeChunk
      const chunks: any[] = [];

      // 处理函数定义
      this.logger?.info(`开始处理 ${functions.length} 个函数`);
      for (let i = 0; i < functions.length; i++) {
        const func = functions[i];
        try {
          // 检查节点是否有效
          if (!func) {
            this.logger?.warn(`发现空函数节点 #${i+1}，跳过`);
            continue;
          }
          
          this.logger?.debug(`处理函数节点 #${i+1}: ${func.type}, start: ${func.startIndex}, end: ${func.endIndex}`);
          const location = this.treeSitterService.getNodeLocation(func);
          const funcText = this.treeSitterService.getNodeText(func, content);

          this.logger?.debug(`函数 #${i+1} 文本长度: ${funcText.length}`);
          
          // 检查提取的文本是否有效
          if (!funcText || funcText.trim().length === 0) {
            this.logger?.warn(`函数节点 #${i+1} 提取的文本为空或仅空白字符，跳过`);
            continue;
          }
          
          chunks.push({
            content: funcText,
            metadata: {
             startLine: location.startLine,
             endLine: location.endLine,
             language: detectedLanguage.name,
             filePath: filePath,
             type: 'function',
             complexity: this.calculateComplexity(funcText)
           }
         });
        } catch (error) {
          this.logger?.error(`处理函数节点 #${i+1} 时出错: ${error}, 错误详情:`, error);
          continue; // 跳过有问题的节点，继续处理其他节点
        }
      }

      // 处理类定义
      this.logger?.info(`开始处理 ${classes.length} 个类`);
      for (let i = 0; i < classes.length; i++) {
        const cls = classes[i];
        try {
          // 检查节点是否有效
          if (!cls) {
            this.logger?.warn(`发现空类节点 #${i+1}，跳过`);
            continue;
          }
          
          this.logger?.debug(`处理类节点 #${i+1}: ${cls.type}, start: ${cls.startIndex}, end: ${cls.endIndex}`);
          const location = this.treeSitterService.getNodeLocation(cls);
          const clsText = this.treeSitterService.getNodeText(cls, content);

          this.logger?.debug(`类 #${i+1} 文本长度: ${clsText.length}`);
          
          // 检查提取的文本是否有效
          if (!clsText || clsText.trim().length === 0) {
            this.logger?.warn(`类节点 #${i+1} 提取的文本为空或仅空白字符，跳过`);
            continue;
          }
          
          chunks.push({
            content: clsText,
            metadata: {
             startLine: location.startLine,
             endLine: location.endLine,
             language: detectedLanguage.name,
             filePath: filePath,
             type: 'class',
             complexity: this.calculateComplexity(clsText)
           }
         });
        } catch (error) {
          this.logger?.error(`处理类节点 #${i+1} 时出错: ${error}, 错误详情:`, error);
          continue; // 跳过有问题的节点，继续处理其他节点
        }
      }

      this.logger?.info(`总共生成了 ${chunks.length} 个分段`);
      
      // 如果没有提取到任何函数或类，返回空数组以触发后备策略
      if (chunks.length === 0) {
        this.logger?.info('No functions or classes found by TreeSitter');
        throw new Error('No functions or classes found by TreeSitter');
      }

      this.logger?.info(`ASTStrategy.execute returning ${chunks.length} chunks`);
      return { chunks, metadata: { strategy: 'ASTStrategy', language: detectedLanguage.name } };
    } catch (error) {
      this.logger?.error(`AST strategy failed: ${error}, 错误详情:`, error);
      this.logger?.error(`错误堆栈: ${(error as Error).stack}`);

      // 如果失败，返回一个简单的块
      return {
        chunks: [{
          content,
          metadata: {
            startLine: 1,
            endLine: content.split('\n').length,
            language: detection.language,
            filePath,
            fallback: true
          }
        }],
        metadata: { strategy: 'ASTStrategy', error: (error as Error).message }
      };
    }
  }

  getName(): string {
    return 'ASTStrategy';
  }

  getDescription(): string {
    return 'Uses TreeSitter AST parsing to extract functions and classes';
  }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    this.logger?.info(`ASTStrategy.split called with language: ${language}, filePath: ${filePath}`);
    
    // 创建一个模拟的DetectionResult对象
    const detection: DetectionResult = {
      language,
      confidence: 0.9,
      processingStrategy: 'treesitter_ast',
      detectionMethod: 'extension',
      metadata: {
        processingStrategy: 'treesitter_ast',
        fileFeatures: {
          isCodeFile: true,
          isTextFile: false,
          isMarkdownFile: false,
          isXMLFile: false,
          isStructuredFile: true,
          isHighlyStructured: true,
          complexity: 0,
          lineCount: content.split('\n').length,
          size: content.length,
          hasImports: true,
          hasExports: false,
          hasFunctions: true,
          hasClasses: true
        }
      }
    };

    // 调用execute方法
    this.logger?.info(`Calling execute method with filePath: ${filePath || ''}`);
    const result = await this.execute(filePath || '', content, detection);
    this.logger?.info(`Execute method returned ${result.chunks.length} chunks`);
    
    // 返回chunks数组
    return result.chunks;
  }

  supportsLanguage(language: string): boolean {
    // AST策略支持大多数编程语言
    const supportedLanguages = [
      'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
    ];
    return supportedLanguages.includes(language.toLowerCase());
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