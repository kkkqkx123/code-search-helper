import Parser from 'tree-sitter';
import { BaseChunkingStrategy, StrategyConfiguration, StrategyExecutionResult } from './ChunkingStrategy';
import { TreeSitterQueryEngine, QueryResult } from '../query/TreeSitterQueryEngine';
import { LanguageConfigManager } from '../config/LanguageConfigManager';
import { CodeChunk } from '../types';

/**
 * 函数分段策略
 * 专门用于提取和处理函数定义的分段策略
 */
export class FunctionChunkingStrategy extends BaseChunkingStrategy {
  readonly name = 'function_chunking';
  readonly priority = 1;
  readonly description = 'Extract function definitions and their bodies';
  readonly supportedLanguages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'c', 'cpp'];

  private queryEngine: TreeSitterQueryEngine;
  private configManager: LanguageConfigManager;

  constructor(config?: Partial<StrategyConfiguration>) {
    super(config);
    this.queryEngine = new TreeSitterQueryEngine();
    this.configManager = new LanguageConfigManager();
  }

  canHandle(language: string, node: Parser.SyntaxNode): boolean {
    if (!this.supportedLanguages.includes(language)) {
      return false;
    }

    const functionTypes = this.getFunctionTypes(language);
    return functionTypes.has(node.type);
  }

  chunk(node: Parser.SyntaxNode, content: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    if (this.canHandle(this.detectLanguage(node), node)) {
      const chunk = this.createFunctionChunk(node, content);
      if (chunk) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  getSupportedNodeTypes(language: string): Set<string> {
    return this.getFunctionTypes(language);
  }

  /**
   * 获取特定语言的函数类型
   */
  private getFunctionTypes(language: string): Set<string> {
    const typeMap: Record<string, string[]> = {
      typescript: [
        'function_declaration',
        'function_definition',
        'method_definition',
        'arrow_function',
        'function_expression',
        'generator_function',
        'generator_function_declaration'
      ],
      javascript: [
        'function_declaration',
        'function_definition',
        'method_definition',
        'arrow_function',
        'function_expression',
        'generator_function'
      ],
      python: [
        'function_definition',
        'lambda_function'
      ],
      java: [
        'method_declaration',
        'constructor_declaration',
        'method_definition'
      ],
      go: [
        'function_declaration',
        'method_declaration'
      ],
      rust: [
        'function_item',
        'method_item',
        'closure_expression'
      ],
      c: [
        'function_definition',
        'declaration'
      ],
      cpp: [
        'function_definition',
        'method_definition',
        'constructor_definition',
        'destructor_definition',
        'lambda_expression'
      ]
    };

    return new Set(typeMap[language] || []);
  }

  /**
   * 检测语言
   */
  private detectLanguage(node: Parser.SyntaxNode): string {
    // 简化的语言检测逻辑
    // 实际实现中应该从上下文或其他方式获取语言信息
    return 'typescript'; // 默认值
  }

  /**
   * 创建函数分段
   */
  private createFunctionChunk(node: Parser.SyntaxNode, content: string): CodeChunk | null {
    const nodeContent = this.extractNodeContent(node, content);
    const location = this.getNodeLocation(node);

    // 验证分段大小
    if (nodeContent.length < this.config.minChunkSize ||
      nodeContent.length > this.config.maxChunkSize) {
      return null;
    }

    // 提取函数信息
    const functionName = this.extractFunctionName(node, content);
    const parameters = this.extractParameters(node, content);
    const returnType = this.extractReturnType(node, content);
    const complexity = this.calculateComplexity(nodeContent);

    const chunk: CodeChunk = {
      content: nodeContent,
      metadata: {
        startLine: location.startLine,
        endLine: location.endLine,
        language: this.detectLanguage(node),
        type: 'function',
        functionName,
        parameters,
        returnType,
        complexity,
        isAsync: this.isAsyncFunction(node),
        isGenerator: this.isGeneratorFunction(node),
        nestingLevel: this.calculateNestingLevel(node),
        hasSideEffects: this.hasSideEffects(nodeContent)
      }
    };

    return chunk;
  }

  /**
   * 提取函数名称
   */
  private extractFunctionName(node: Parser.SyntaxNode, content: string): string {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return this.extractNodeContent(nameNode, content);
    }

    // 处理匿名函数
    if (node.type === 'arrow_function' || node.type === 'function_expression') {
      return 'anonymous';
    }

    // 处理构造函数
    if (node.type === 'constructor_declaration') {
      return 'constructor';
    }

    return 'unknown';
  }

  /**
   * 提取参数
   */
  private extractParameters(node: Parser.SyntaxNode, content: string): string[] {
    const parametersNode = node.childForFieldName('parameters');
    if (!parametersNode) {
      return [];
    }

    const parameters: string[] = [];

    // 遍历参数节点
    const traverseParameters = (paramNode: Parser.SyntaxNode) => {
      if (paramNode.type === 'identifier' ||
        paramNode.type === 'parameter' ||
        paramNode.type === 'required_parameter' ||
        paramNode.type === 'optional_parameter') {
        parameters.push(this.extractNodeContent(paramNode, content));
      }

      if (paramNode.children && Array.isArray(paramNode.children)) {
        for (const child of paramNode.children) {
          traverseParameters(child);
        }
      }
    };

    traverseParameters(parametersNode);
    return parameters;
  }

  /**
   * 提取返回类型
   */
  private extractReturnType(node: Parser.SyntaxNode, content: string): string {
    const returnTypeNode = node.childForFieldName('return_type');
    if (returnTypeNode) {
      return this.extractNodeContent(returnTypeNode, content);
    }

    // 处理TypeScript的返回类型注解
    const typeAnnotationNode = node.childForFieldName('type_annotation');
    if (typeAnnotationNode) {
      return this.extractNodeContent(typeAnnotationNode, content);
    }

    return 'unknown';
  }

  /**
   * 检查是否为异步函数
   */
  private isAsyncFunction(node: Parser.SyntaxNode): boolean {
    // 检查async修饰符
    const asyncNode = node.childForFieldName('async');
    if (asyncNode) {
      return true;
    }

    // 检查函数内容中的async关键字
    const nodeText = node.text || '';
    return nodeText.includes('async');
  }

  /**
   * 检查是否为生成器函数
   */
  private isGeneratorFunction(node: Parser.SyntaxNode): boolean {
    // 检查*修饰符
    const generatorNode = node.childForFieldName('generator');
    if (generatorNode) {
      return true;
    }

    // 检查函数类型
    return node.type.includes('generator');
  }

  /**
   * 计算嵌套层级
   */
  private calculateNestingLevel(node: Parser.SyntaxNode): number {
    let level = 0;
    let current = node.parent;

    while (current && level < this.config.maxNestingLevel) {
      level++;
      current = current.parent;
    }

    return level;
  }

  /**
   * 检查是否有副作用
   */
  private hasSideEffects(content: string): boolean {
    const sideEffectPatterns = [
      /\bconsole\./g,
      /\bdocument\./g,
      /\bwindow\./g,
      /\bglobal\./g,
      /\bprocess\./g,
      /\bfs\./g,
      /\bfetch\(/g,
      /\baxios\./g,
      /\bXMLHttpRequest/g,
      /\blocalStorage/g,
      /\bsessionStorage/g,
      /\balert\(/g,
      /\bconfirm\(/g,
      /\bprompt\(/g
    ];

    for (const pattern of sideEffectPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 使用查询引擎提取函数
   */
  async extractFunctionsUsingQuery(
    ast: Parser.SyntaxNode,
    language: string,
    content: string
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    // 根据语言选择查询模式
    let queryPattern = 'function_declaration';
    if (language === 'python') {
      queryPattern = 'python_function';
    } else if (language === 'java') {
      queryPattern = 'method_declaration';
    }

    const queryResult = await this.queryEngine.executeQuery(ast, queryPattern, language);

    if (queryResult.success) {
      for (const match of queryResult.matches) {
        const chunk = this.createFunctionChunk(match.node, content);
        if (chunk) {
          chunks.push(chunk);
        }
      }
    }

    return chunks;
  }

  /**
   * 批量处理函数提取
   */
  async batchExtractFunctions(
    nodes: Parser.SyntaxNode[],
    language: string,
    content: string
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    for (const node of nodes) {
      if (this.canHandle(language, node)) {
        const chunk = this.createFunctionChunk(node, content);
        if (chunk) {
          chunks.push(chunk);
        }
      }
    }

    return chunks;
  }

  /**
   * 优化函数分段
   */
  optimizeFunctionChunks(chunks: CodeChunk[]): CodeChunk[] {
    return chunks.filter(chunk => {
      // 过滤掉过小的分段
      if (chunk.content.length < this.config.minChunkSize) {
        return false;
      }

      // 过滤掉过大的分段
      if (chunk.content.length > this.config.maxChunkSize) {
        return false;
      }

      // 过滤掉复杂度过高的分段
      if (chunk.metadata.complexity && chunk.metadata.complexity > 20) {
        return false;
      }

      return true;
    });
  }

  /**
   * 按优先级排序函数
   */
  sortFunctionsByPriority(chunks: CodeChunk[]): CodeChunk[] {
    return chunks.sort((a, b) => {
      // 优先级：公共函数 > 私有函数 > 匿名函数
      const aPriority = this.getFunctionPriority(a);
      const bPriority = this.getFunctionPriority(b);

      return bPriority - aPriority;
    });
  }

  /**
   * 获取函数优先级
   */
  private getFunctionPriority(chunk: CodeChunk): number {
    const name = chunk.metadata.functionName || '';

    // 公共函数优先级最高
    if (!name.startsWith('_') && name !== 'anonymous') {
      return 3;
    }

    // 私有函数
    if (name.startsWith('_') && !name.startsWith('__')) {
      return 2;
    }

    // 特殊函数和匿名函数
    return 1;
  }
}