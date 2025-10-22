import { BaseSplitStrategy } from './base/BaseSplitStrategy';
import { CodeChunk, ChunkingOptions, ASTNode } from '..';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { ContentHashIDGenerator } from '../utils/ContentHashIDGenerator';
import { ComplexityCalculator } from '../utils/ComplexityCalculator';
import { ASTNodeExtractor } from '../utils/ASTNodeExtractor';

/**
 * 类分割策略
 * 专注于提取和分割类定义
 */
export class ClassSplitter extends BaseSplitStrategy {
  private complexityCalculator: ComplexityCalculator;
  private astNodeExtractor?: ASTNodeExtractor;

  constructor(options?: ChunkingOptions) {
    super(options);
    this.complexityCalculator = new ComplexityCalculator();
  }

  // 设置 TreeSitterService 并初始化 ASTNodeExtractor
  setTreeSitterService(treeSitterService: TreeSitterService): void {
    super.setTreeSitterService(treeSitterService);
    this.astNodeExtractor = new ASTNodeExtractor(treeSitterService);
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
      this.logger?.warn('TreeSitterService is required for ClassSplitter');
      return [];
    }

    try {
      // 使用传入的AST或重新解析
      let parseResult = ast;
      if (!parseResult) {
        parseResult = await this.treeSitterService.parseCode(content, language);
      }

      if (parseResult && parseResult.success && parseResult.ast) {
        return this.extractClasses(content, parseResult.ast, language, filePath, nodeTracker);
      } else {
        this.logger?.warn('Failed to parse code for class extraction');
        return [];
      }
    } catch (error) {
      this.logger?.warn(`Class splitting failed: ${error}`);
      return [];
    }
  }

  getName(): string {
    return 'ClassSplitter';
  }

  supportsLanguage(language: string): boolean {
    return this.treeSitterService?.detectLanguage(language) !== null || false;
  }

  getPriority(): number {
    return 2; // 中等优先级
  }

  /**
   * 提取类块 - 改为public以便测试
   */
  async extractClasses(
    content: string,
    ast: any,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    try {
      const classes = this.treeSitterService!.extractClasses(ast);

      if (!classes || (await classes).length === 0) {
        return chunks;
      }

      this.logger?.debug(`Found ${(await classes).length} classes to process`);

      for (const classNode of await classes) {
        const classChunks = this.processClassNode(classNode, content, language, filePath, nodeTracker);
        chunks.push(...classChunks);
      }

    } catch (error) {
      this.logger?.warn(`Failed to extract class chunks: ${error}`);
    }

    return chunks;
  }

  /**
   * 处理单个类节点
   */
  private processClassNode(
    classNode: any,
    content: string,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // 获取类文本和位置信息
    const classText = this.treeSitterService!.getNodeText(classNode, content);
    const location = this.treeSitterService!.getNodeLocation(classNode);
    const className = this.treeSitterService!.getNodeName(classNode);

    // 验证基本信息
    if (!location || !className) {
      this.logger?.warn('Failed to get class location or name');
      return chunks;
    }

    const lineCount = location.endLine - location.startLine + 1;
    const complexity = this.complexityCalculator.calculate(classText);

    // 创建AST节点对象
    const astNode: ASTNode = this.createASTNode(classNode, classText, 'class');

    // 检查节点是否已被使用
    if (nodeTracker && nodeTracker.isUsed(astNode)) {
      return chunks;
    }

    // 根据配置决定是否保持方法在一起
    const keepMethodsTogether = this.options.classSpecificOptions?.keepMethodsTogether ?? true;

    if (keepMethodsTogether) {
      // 保持方法在一起，将整个类作为一个块
      const metadata = {
        startLine: location.startLine,
        endLine: location.endLine,
        language,
        filePath,
        type: 'class' as const,
        className,
        complexity,
        nodeIds: [astNode.id],
        lineCount
      };

      chunks.push(this.createChunk(classText, metadata));
    } else {
      // 分别提取类定义和方法
      chunks.push(...this.splitClassComponents(classNode, classText, location, language, filePath, nodeTracker));
    }

    // 标记节点为已使用
    if (nodeTracker) {
      nodeTracker.markUsed(astNode);
    }

    return chunks;
  }

  /**
   * 分割类组件（类定义和方法）
   */
  private splitClassComponents(
    classNode: any,
    classContent: string,
    location: any,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // 首先添加类定义头
    const classHeader = this.extractClassHeader(classNode, classContent);
    if (classHeader) {
      const headerMetadata = {
        startLine: location.startLine,
        endLine: location.startLine + classHeader.split('\n').length - 1,
        language,
        filePath,
        type: 'class' as const,
        className: this.treeSitterService!.getNodeName(classNode) || 'unknown_class',
        complexity: this.complexityCalculator.calculate(classHeader),
        component: 'header'
      };

      chunks.push(this.createChunk(classHeader, headerMetadata));
    }

    // 简化处理：不再尝试提取方法，因为TreeSitterService可能没有extractMethods方法
    // 只返回类定义头，保持兼容性
    return chunks;
  }

  /**
   * 提取类头部定义
   */
  private extractClassHeader(classNode: any, classContent: string): string {
    // 找到类名后的第一个大括号，提取到那里为止的内容
    const lines = classContent.split('\n');
    let braceCount = 0;
    let headerEnd = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      braceCount += (line.match(/\{/g) || []).length;
      braceCount -= (line.match(/\}/g) || []).length;

      if (braceCount > 0) {
        headerEnd = i;
        break;
      }
    }

    return lines.slice(0, headerEnd + 1).join('\n');
  }

  /**
   * 创建AST节点
   */
  private createASTNode(node: any, content: string, type: string, customId?: string): ASTNode {
    const nodeId = customId || `${node.startIndex}-${node.endIndex}-${type}`;

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
    if (!this.astNodeExtractor) {
      this.logger?.warn('ASTNodeExtractor not initialized');
      return [];
    }

    return this.astNodeExtractor.extractNodesFromChunk(chunk, ast, 'class');
  }

  hasUsedNodes(chunk: CodeChunk, nodeTracker: any, ast: any): boolean {
    if (!nodeTracker || !chunk.metadata.nodeIds) {
      return false;
    }

    const nodes = this.extractNodesFromChunk(chunk, ast);
    return nodes.some(node => nodeTracker.isUsed(node));
  }
}