import { BaseSplitStrategy } from './base/BaseSplitStrategy';
import { CodeChunk, ChunkingOptions, ASTNode } from '../types';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { ContentHashIDGenerator } from '../utils/ContentHashIDGenerator';

/**
 * 导入语句分割策略
 * 专注于提取导入语句
 */
export class ImportSplitter extends BaseSplitStrategy {
  constructor(options?: ChunkingOptions) {
    super(options);
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
      this.logger?.warn('TreeSitterService is required for ImportSplitter');
      return [];
    }

    try {
      // 使用传入的AST或重新解析
      let parseResult = ast;
      if (!parseResult) {
        parseResult = await this.treeSitterService.parseCode(content, language);
      }

      if (parseResult && parseResult.success && parseResult.ast) {
        return this.extractImports(content, parseResult.ast, language, filePath, nodeTracker);
      } else {
        this.logger?.warn('Failed to parse code for import extraction');
        return [];
      }
    } catch (error) {
      this.logger?.warn(`Import splitting failed: ${error}`);
      return [];
    }
  }

  getName(): string {
    return 'ImportSplitter';
  }

  supportsLanguage(language: string): boolean {
    // 导入语句在大多数现代编程语言中都存在
    const supportedLanguages = [
      'javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'c', 'go', 
      'rust', 'kotlin', 'scala', 'php', 'ruby', 'swift', 'dart', 'elixir'
    ];
    
    return supportedLanguages.includes(language.toLowerCase());
  }

  getPriority(): number {
    return 3; // 较低优先级，与测试期望一致
  }

  /**
   * 提取导入语句 - 改为public以便测试
   */
  extractImports(
    content: string,
    ast: any,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    try {
      const imports = this.treeSitterService!.extractImports(ast);

      if (!imports || imports.length === 0) {
        return chunks;
      }

      this.logger?.debug(`Found ${imports.length} imports to process`);

      for (const importNode of imports) {
        const importChunks = this.processImportNode(importNode, content, language, filePath, nodeTracker);
        chunks.push(...importChunks);
      }

    } catch (error) {
      this.logger?.warn(`Failed to extract import chunks: ${error}`);
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

    // 创建AST节点对象
    const astNode: ASTNode = this.createASTNode(importNode, importText, 'import');

    // 检查节点是否已被使用
    if (nodeTracker && nodeTracker.isUsed(astNode)) {
      return chunks;
    }

    // 提取导入的模块信息
    const importInfo = this.extractImportInfo(importText, language);

    const metadata = {
      startLine: location.startLine,
      endLine: location.endLine,
      language,
      filePath,
      type: 'import' as const,
      imports: importInfo.modules,
      nodeIds: [astNode.id],
      lineCount: location.endLine - location.startLine + 1
    };

    chunks.push(this.createChunk(importText, metadata));

    // 标记节点为已使用
    if (nodeTracker) {
      nodeTracker.markUsed(astNode);
    }

    return chunks;
  }

  /**
   * 提取导入信息
   */
  private extractImportInfo(importText: string, language: string): { modules: string[] } {
    const modules: string[] = [];

    try {
      switch (language.toLowerCase()) {
        case 'javascript':
        case 'typescript':
          // JavaScript/TypeScript: import ... from 'module'
          const jsMatch = importText.match(/from\s+['"`]([^'"`]+)['"`]/);
          if (jsMatch) {
            modules.push(jsMatch[1]);
          }
          // 也处理 require('module')
          const requireMatch = importText.match(/require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/);
          if (requireMatch) {
            modules.push(requireMatch[1]);
          }
          break;

        case 'python':
          // Python: import module 或 from module import ...
          const pythonMatch = importText.match(/^(?:import|from)\s+([^\s]+)/);
          if (pythonMatch) {
            modules.push(pythonMatch[1]);
          }
          break;

        case 'java':
        case 'kotlin':
          // Java/Kotlin: import package.Class;
          const javaMatch = importText.match(/import\s+([^;]+);?/);
          if (javaMatch) {
            modules.push(javaMatch[1].trim());
          }
          break;

        case 'csharp':
          // C#: using Namespace;
          const csharpMatch = importText.match(/using\s+([^;]+);?/);
          if (csharpMatch) {
            modules.push(csharpMatch[1].trim());
          }
          break;

        case 'go':
          // Go: import "package"
          const goMatch = importText.match(/import\s+(?:\(\s*)?["`]([^"`]+)["`](?:\s*\))?/);
          if (goMatch) {
            modules.push(goMatch[1]);
          }
          break;

        case 'rust':
          // Rust: use crate::module;
          const rustMatch = importText.match(/use\s+([^;]+);?/);
          if (rustMatch) {
            modules.push(rustMatch[1].trim());
          }
          break;

        case 'php':
          // PHP: use Namespace\Class;
          const phpMatch = importText.match(/use\s+([^;]+);?/);
          if (phpMatch) {
            modules.push(phpMatch[1].trim());
          }
          break;

        default:
          // 通用模式匹配
          const genericMatch = importText.match(/(?:import|using|use|require)\s+['"`]([^'"`]+)['"`]/);
          if (genericMatch) {
            modules.push(genericMatch[1]);
          }
          break;
      }
    } catch (error) {
      this.logger?.warn(`Failed to extract import info: ${error}`);
    }

    return { modules };
  }

  /**
   * 创建AST节点
   */
  private createASTNode(node: any, content: string, type: string): ASTNode {
    const nodeId = `${node.startIndex}-${node.endIndex}-${type}`;
    
    return {
      id: ContentHashIDGenerator.generateNodeId({
        id: nodeId,
        type,
        startByte: node.startIndex,
        endByte: node.endIndex,
        startLine: node.startPosition.row,
        endLine: node.endPosition.row,
        text: content
      }),
      type,
      startByte: node.startIndex,
      endByte: node.endIndex,
      startLine: node.startPosition.row,
      endLine: node.endPosition.row,
      text: content,
      contentHash: ContentHashIDGenerator.getContentHashPrefix(content)
    };
  }

  extractNodesFromChunk(chunk: CodeChunk, ast: any): ASTNode[] {
    if (!chunk.metadata.nodeIds || !ast) {
      return [];
    }

    // 这里需要根据实际的AST结构实现节点查找逻辑
    return [];
  }

  hasUsedNodes(chunk: CodeChunk, nodeTracker: any, ast: any): boolean {
    if (!nodeTracker || !chunk.metadata.nodeIds) {
      return false;
    }

    const nodes = this.extractNodesFromChunk(chunk, ast);
    return nodes.some(node => nodeTracker.isUsed(node));
  }
}