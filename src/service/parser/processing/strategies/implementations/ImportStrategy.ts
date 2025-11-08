/**
 * 导入分割策略
 * 专注于提取和分割导入/引入语句的策略
 */

import { BaseStrategy } from '../base/BaseStrategy';
import type { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import type { ProcessingResult } from '../../core/types/ResultTypes';
import type { StrategyConfig } from '../../types/Strategy';
import { ChunkType } from '../../types/CodeChunk';
import { ContentHashUtils } from '../../../../../utils/ContentHashUtils';

/**
 * 导入分割策略实现
 */
export class ImportStrategy extends BaseStrategy {
  constructor(config?: Partial<StrategyConfig>) {
    const defaultConfig: StrategyConfig = {
      name: 'import-strategy',
      priority: 30,
      supportedLanguages: [
        'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
        'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
      ],
      enabled: true,
      description: 'Import statement extraction strategy',
      parameters: {
        groupImports: true,
        maxImportGroupSize: 500,
        includeComments: true,
        extractRequireStatements: true,
        extractIncludeStatements: true,
        extractUsingStatements: true
      }
    };

    super({ ...defaultConfig, ...config });
  }

  /**
   * 判断是否可以处理给定的上下文
   */
  canHandle(context: IProcessingContext): boolean {
    if (!this.validateContext(context)) {
      return false;
    }

    // 检查是否支持该语言
    if (!this.supportsLanguage(context.language)) {
      return false;
    }

    // 检查是否有AST可用
    if (!context.ast) {
      return false;
    }

    // 检查文件是否包含导入语句
    if (!context.metadata.hasImports) {
      return false;
    }

    // 检查文件是否为代码文件
    if (!context.metadata.isCodeFile) {
      return false;
    }

    return true;
  }

  /**
   * 执行代码分割策略
   */
  async execute(context: IProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const chunks = await this.extractImports(context);
      const executionTime = Date.now() - startTime;

      return this.createSuccessResult(
        chunks,
        executionTime,
        {
          language: context.language,
          filePath: context.filePath,
          strategy: this.name,
          chunkCount: chunks.length,
          averageChunkSize: chunks.length > 0 
            ? chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length 
            : 0,
          totalSize: chunks.reduce((sum, chunk) => sum + chunk.content.length, 0)
        }
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return this.createFailureResult(executionTime, errorMessage);
    }
  }

  /**
   * 提取导入语句
   */
  private async extractImports(context: IProcessingContext): Promise<any[]> {
    const { content, language, filePath, ast } = context;
    const chunks: any[] = [];

    try {
      // 这里应该调用TreeSitter服务提取导入语句
      // 由于我们无法直接访问TreeSitter服务，这里提供一个模拟实现
      const imports = this.mockExtractImports(ast);
      
      if (this.config.parameters?.groupImports) {
        // 分组导入语句
        const groupedImports = this.groupImportsByType(imports);
        
        for (const [groupType, groupImports] of Object.entries(groupedImports)) {
          const groupChunks = await this.processImportGroup(
            groupImports,
            content,
            language,
            filePath,
            groupType
          );
          chunks.push(...groupChunks);
        }
      } else {
        // 单独处理每个导入语句
        for (const importNode of imports) {
          const importChunks = await this.processImportNode(
            importNode,
            content,
            language,
            filePath
          );
          chunks.push(...importChunks);
        }
      }

      // 如果没有提取到任何导入语句，创建一个包含整个内容的块
      if (chunks.length === 0) {
        const complexity = this.calculateComplexity(content);
        const chunk = this.createChunk(
          content,
          1,
          content.split('\n').length,
          language,
          ChunkType.GENERIC,
          {
            filePath,
            complexity,
            fallback: true
          }
        );
        chunks.push(chunk);
      }

      return chunks;
    } catch (error) {
      // 如果提取失败，创建一个包含整个内容的块
      const complexity = this.calculateComplexity(content);
      const chunk = this.createChunk(
        content,
        1,
        content.split('\n').length,
        language,
        ChunkType.GENERIC,
        {
          filePath,
          complexity,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      
      return [chunk];
    }
  }

  /**
   * 按类型分组导入语句
   */
  private groupImportsByType(imports: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {
      'import': [],
      'require': [],
      'include': [],
      'using': []
    };

    for (const importNode of imports) {
      const importType = this.detectImportType(importNode);
      if (groups[importType]) {
        groups[importType].push(importNode);
      } else {
        groups['import'].push(importNode); // 默认分组
      }
    }

    // 移除空分组
    Object.keys(groups).forEach(key => {
      if (groups[key].length === 0) {
        delete groups[key];
      }
    });

    return groups;
  }

  /**
   * 检测导入语句类型
   */
  private detectImportType(importNode: any): string {
    const importText = this.getNodeText(importNode, '').trim();
    
    if (importText.startsWith('import ')) {
      return 'import';
    } else if (importText.startsWith('require(')) {
      return 'require';
    } else if (importText.startsWith('#include') || importText.startsWith('include')) {
      return 'include';
    } else if (importText.startsWith('using ')) {
      return 'using';
    }
    
    return 'import'; // 默认类型
  }

  /**
   * 处理导入语句组
   */
  private async processImportGroup(
    importNodes: any[],
    content: string,
    language: string,
    filePath?: string,
    groupType?: string
  ): Promise<any[]> {
    const chunks: any[] = [];

    try {
      // 按位置排序导入语句
      importNodes.sort((a, b) => {
        const locationA = this.getNodeLocation(a);
        const locationB = this.getNodeLocation(b);
        return (locationA?.startLine || 0) - (locationB?.startLine || 0);
      });

      // 根据最大组大小分割
      const maxGroupSize = this.config.parameters?.maxImportGroupSize || 500;
      let currentGroup: any[] = [];
      let currentSize = 0;
      let startLine = 0;
      let endLine = 0;

      for (const importNode of importNodes) {
        const importText = this.getNodeText(importNode, content);
        const location = this.getNodeLocation(importNode);
        
        if (!location || !importText) {
          continue;
        }

        // 如果当前组加上这个导入会超过最大大小，先处理当前组
        if (currentSize + importText.length > maxGroupSize && currentGroup.length > 0) {
          const groupContent = this.buildGroupContent(currentGroup, content);
          const complexity = this.calculateComplexity(groupContent);
          
          const chunk = this.createChunk(
            groupContent,
            startLine,
            endLine,
            language,
            ChunkType.IMPORT,
            {
              filePath,
              complexity,
              importType: groupType,
              importCount: currentGroup.length,
              nodeIds: currentGroup.map(node => node.id)
            }
          );

          chunks.push(chunk);
          
          // 开始新组
          currentGroup = [importNode];
          currentSize = importText.length;
          startLine = location.startLine;
          endLine = location.endLine;
        } else {
          // 添加到当前组
          currentGroup.push(importNode);
          currentSize += importText.length;
          
          if (currentGroup.length === 1) {
            startLine = location.startLine;
          }
          endLine = location.endLine;
        }
      }

      // 处理最后的组
      if (currentGroup.length > 0) {
        const groupContent = this.buildGroupContent(currentGroup, content);
        const complexity = this.calculateComplexity(groupContent);
        
        const chunk = this.createChunk(
          groupContent,
          startLine,
          endLine,
          language,
          ChunkType.IMPORT,
          {
            filePath,
            complexity,
            importType: groupType,
            importCount: currentGroup.length,
            nodeIds: currentGroup.map(node => node.id)
          }
        );

        chunks.push(chunk);
      }
    } catch (error) {
      // 忽略错误，继续处理其他组
    }

    return chunks;
  }

  /**
   * 构建组内容
   */
  private buildGroupContent(importNodes: any[], content: string): string {
    const lines = content.split('\n');
    const groupLines: string[] = [];

    for (const importNode of importNodes) {
      const location = this.getNodeLocation(importNode);
      if (!location) {
        continue;
      }

      // 提取导入语句行
      for (let i = location.startLine - 1; i < location.endLine; i++) {
        if (i >= 0 && i < lines.length) {
          groupLines.push(lines[i]);
        }
      }

      // 如果启用注释包含，尝试包含相关注释
      if (this.config.parameters?.includeComments) {
        this.addRelatedComments(lines, location, groupLines);
      }
    }

    // 去重并排序
    return [...new Set(groupLines)].join('\n');
  }

  /**
   * 添加相关注释
   */
  private addRelatedComments(
    lines: string[],
    location: any,
    groupLines: string[]
  ): void {
    // 查找导入语句上方的注释
    for (let i = location.startLine - 2; i >= Math.max(0, location.startLine - 5); i--) {
      const line = lines[i]?.trim();
      if (line && (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*'))) {
        if (!groupLines.includes(lines[i])) {
          groupLines.unshift(lines[i]);
        }
      } else if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
        break; // 遇到非注释行，停止查找
      }
    }
  }

  /**
   * 处理单个导入节点
   */
  private async processImportNode(
    importNode: any,
    content: string,
    language: string,
    filePath?: string
  ): Promise<any[]> {
    const chunks: any[] = [];

    try {
      const importText = this.getNodeText(importNode, content);
      const location = this.getNodeLocation(importNode);
      
      if (!location || !importText || importText.trim().length === 0) {
        return chunks;
      }

      const complexity = this.calculateComplexity(importText);
      const importType = this.detectImportType(importNode);

      const chunk = this.createChunk(
        importText,
        location.startLine,
        location.endLine,
        language,
        ChunkType.IMPORT,
        {
          filePath,
          complexity,
          importType,
          nodeIds: [importNode.id]
        }
      );

      chunks.push(chunk);
    } catch (error) {
      // 忽略错误，继续处理其他导入语句
    }

    return chunks;
  }

  /**
   * 创建AST节点
   */
  private createASTNode(node: any, content: string, type: string): any {
    const nodeId = `${node.startIndex}-${node.endIndex}-${type}`;

    return {
      id: this.generateNodeId(nodeId),
      type,
      startByte: node.startIndex,
      endByte: node.endIndex,
      startLine: node.startPosition?.row || 0,
      endLine: node.endPosition?.row || 0,
      text: content,
      contentHash: this.generateContentHash(content)
    };
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(nodeId: string): string {
    // 简单的哈希实现，实际项目中应该使用更强大的哈希算法
    let hash = 0;
    for (let i = 0; i < nodeId.length; i++) {
      const char = nodeId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(16);
  }

  /**
   * 生成内容哈希
   */
  private generateContentHash(content: string): string {
    return ContentHashUtils.generateContentHash(content);
  }

  /**
   * 模拟导入提取（实际实现应该使用TreeSitter服务）
   */
  private mockExtractImports(ast: any): any[] {
    // 这是一个模拟实现，实际应该使用TreeSitter服务
    return [];
  }

  /**
   * 获取节点文本（模拟实现）
   */
  private getNodeText(node: any, content: string): string {
    // 这是一个模拟实现，实际应该使用TreeSitter服务
    return '';
  }

  /**
   * 获取节点位置（模拟实现）
   */
  private getNodeLocation(node: any): any {
    // 这是一个模拟实现，实际应该使用TreeSitter服务
    return null;
  }

  /**
   * 验证上下文是否有效
   */
  validateContext(context: IProcessingContext): boolean {
    if (!super.validateContext(context)) {
      return false;
    }

    // 检查是否有AST可用
    if (!context.ast) {
      return false;
    }

    return true;
  }
}