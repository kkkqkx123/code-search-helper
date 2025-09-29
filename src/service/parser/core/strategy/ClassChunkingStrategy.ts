import Parser from 'tree-sitter';
import { BaseChunkingStrategy, StrategyConfiguration } from './ChunkingStrategy';
import { TreeSitterQueryEngine } from '../query/TreeSitterQueryEngine';
import { LanguageConfigManager } from '../config/LanguageConfigManager';
import { CodeChunk } from '../types';

/**
 * 类分段策略
 * 专门用于提取和处理类定义的分段策略
 */
export class ClassChunkingStrategy extends BaseChunkingStrategy {
  readonly name = 'class_chunking';
  readonly priority = 2;
  readonly description = 'Extract class definitions and their members';
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

    const classTypes = this.getClassTypes(language);
    return classTypes.has(node.type);
  }

  chunk(node: Parser.SyntaxNode, content: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    if (this.canHandle(this.detectLanguage(node), node)) {
      const chunk = this.createClassChunk(node, content);
      if (chunk) {
        chunks.push(chunk);
      }

      // 可选：提取类成员作为独立分段
      if (this.shouldExtractMembers(node)) {
        const memberChunks = this.extractClassMembers(node, content);
        chunks.push(...memberChunks);
      }
    }

    return chunks;
  }

  getSupportedNodeTypes(language: string): Set<string> {
    return this.getClassTypes(language);
  }

  /**
   * 获取特定语言的类类型
   */
  private getClassTypes(language: string): Set<string> {
    const typeMap: Record<string, string[]> = {
      typescript: [
        'class_declaration',
        'class_expression',
        'interface_declaration',
        'type_alias_declaration'
      ],
      javascript: [
        'class_declaration',
        'class_expression'
      ],
      python: [
        'class_definition'
      ],
      java: [
        'class_declaration',
        'interface_declaration',
        'enum_declaration'
      ],
      go: [
        'struct_type',
        'interface_type'
      ],
      rust: [
        'struct_item',
        'enum_item',
        'trait_item'
      ],
      c: [
        'struct_specifier',
        'union_specifier',
        'enum_specifier'
      ],
      cpp: [
        'class_specifier',
        'struct_specifier',
        'union_specifier',
        'enum_specifier'
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
   * 创建类分段
   */
  private createClassChunk(node: Parser.SyntaxNode, content: string): CodeChunk | null {
    const nodeContent = this.extractNodeContent(node, content);
    const location = this.getNodeLocation(node);

    // 验证分段大小
    if (nodeContent.length < this.config.minChunkSize ||
      nodeContent.length > this.config.maxChunkSize) {
      return null;
    }

    // 提取类信息
    const className = this.extractClassName(node, content);
    const inheritance = this.extractInheritance(node, content);
    const members = this.extractMembers(node, content);
    const complexity = this.calculateComplexity(nodeContent);

    const chunk: CodeChunk = {
      content: nodeContent,
      metadata: {
        startLine: location.startLine,
        endLine: location.endLine,
        language: this.detectLanguage(node),
        type: 'class',
        className,
        inheritance,
        members: {
          count: members.count,
          methods: members.methods,
          properties: members.properties,
          constructors: members.constructors
        },
        complexity,
        nestingLevel: this.calculateNestingLevel(node),
        isAbstract: this.isAbstractClass(node),
        isGeneric: this.isGenericClass(node),
        accessModifiers: this.extractAccessModifiers(node),
        decorators: this.extractDecorators(node, content)
      }
    };

    return chunk;
  }

  /**
   * 提取类名称
   */
  private extractClassName(node: Parser.SyntaxNode, content: string): string {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return this.extractNodeContent(nameNode, content);
    }

    // 处理匿名类
    if (node.type === 'class_expression') {
      return 'anonymous';
    }

    // 处理接口和类型别名
    if (node.type === 'interface_declaration' || node.type === 'type_alias_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        return this.extractNodeContent(nameNode, content);
      }
    }

    return 'unknown';
  }

  /**
   * 提取继承信息
   */
  private extractInheritance(node: Parser.SyntaxNode, content: string): string[] {
    const inheritance: string[] = [];

    // 处理extends
    const extendsNode = node.childForFieldName('extends');
    if (extendsNode) {
      const extendsText = this.extractNodeContent(extendsNode, content);
      inheritance.push(...this.parseInheritanceList(extendsText));
    }

    // 处理implements
    const implementsNode = node.childForFieldName('implements');
    if (implementsNode) {
      const implementsText = this.extractNodeContent(implementsNode, content);
      inheritance.push(...this.parseInheritanceList(implementsText));
    }

    // 处理with（Python混入）
    const withNode = node.childForFieldName('with');
    if (withNode) {
      const withText = this.extractNodeContent(withNode, content);
      inheritance.push(...this.parseInheritanceList(withText));
    }

    return inheritance;
  }

  /**
   * 解析继承列表
   */
  private parseInheritanceList(text: string): string[] {
    // 移除关键字和括号
    const cleanText = text
      .replace(/extends|implements|with/g, '')
      .replace(/[{}()]/g, '')
      .trim();

    if (!cleanText) {
      return [];
    }

    // 分割逗号分隔的列表
    return cleanText
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  /**
   * 提取成员信息
   */
  private extractMembers(node: Parser.SyntaxNode, content: string): {
    count: number;
    methods: number;
    properties: number;
    constructors: number;
  } {
    const members = {
      count: 0,
      methods: 0,
      properties: 0,
      constructors: 0
    };

    const bodyNode = node.childForFieldName('body');
    if (!bodyNode) {
      return members;
    }

    // 遍历类体中的成员
    const traverseMembers = (memberNode: Parser.SyntaxNode) => {
      members.count++;

      // 判断成员类型
      if (this.isMethod(memberNode)) {
        members.methods++;
      } else if (this.isProperty(memberNode)) {
        members.properties++;
      } else if (this.isConstructor(memberNode)) {
        members.constructors++;
      }

      if (memberNode.children && Array.isArray(memberNode.children)) {
        for (const child of memberNode.children) {
          traverseMembers(child);
        }
      }
    };

    traverseMembers(bodyNode);
    return members;
  }

  /**
   * 判断是否为方法
   */
  private isMethod(node: Parser.SyntaxNode): boolean {
    const methodTypes = [
      'method_definition',
      'method_declaration',
      'function_declaration',
      'function_definition'
    ];

    return methodTypes.includes(node.type);
  }

  /**
   * 判断是否为属性
   */
  private isProperty(node: Parser.SyntaxNode): boolean {
    const propertyTypes = [
      'property_declaration',
      'field_declaration',
      'variable_declaration',
      'public_field_definition',
      'private_field_definition'
    ];

    return propertyTypes.includes(node.type);
  }

  /**
   * 判断是否为构造函数
   */
  private isConstructor(node: Parser.SyntaxNode): boolean {
    return node.type === 'constructor_declaration' ||
      node.type === 'constructor_definition' ||
      (node.type === 'method_definition' &&
        this.extractNodeContent(node, '').includes('constructor'));
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
   * 检查是否为抽象类
   */
  private isAbstractClass(node: Parser.SyntaxNode): boolean {
    // 检查abstract修饰符
    const abstractNode = node.childForFieldName('abstract');
    if (abstractNode) {
      return true;
    }

    // 检查类内容中的abstract关键字
    const nodeText = node.text || '';
    return nodeText.includes('abstract');
  }

  /**
   * 检查是否为泛型类
   */
  private isGenericClass(node: Parser.SyntaxNode): boolean {
    // 检查类型参数
    const typeParametersNode = node.childForFieldName('type_parameters');
    if (typeParametersNode) {
      return true;
    }

    // 检查类内容中的泛型语法
    const nodeText = node.text || '';
    return /<[^>]+>/.test(nodeText);
  }

  /**
   * 提取访问修饰符
   */
  private extractAccessModifiers(node: Parser.SyntaxNode): string[] {
    const modifiers: string[] = [];

    // 检查常见的访问修饰符
    const modifierTypes = [
      'public',
      'private',
      'protected',
      'internal',
      'static',
      'readonly',
      'final',
      'const'
    ];

    // 遍历子节点查找修饰符
    const traverseModifiers = (childNode: Parser.SyntaxNode) => {
      if (modifierTypes.includes(childNode.type)) {
        modifiers.push(childNode.type);
      }

      if (childNode.children && Array.isArray(childNode.children)) {
        for (const child of childNode.children) {
          traverseModifiers(child);
        }
      }
    };

    traverseModifiers(node);
    return modifiers;
  }

  /**
   * 提取装饰器
   */
  private extractDecorators(node: Parser.SyntaxNode, content: string): string[] {
    const decorators: string[] = [];

    // 查找装饰器节点
    const decoratorNodes = this.findNodesByType(node, 'decorator');
    for (const decoratorNode of decoratorNodes) {
      const decoratorText = this.extractNodeContent(decoratorNode, content);
      decorators.push(decoratorText);
    }

    return decorators;
  }

  /**
   * 按类型查找节点
   */
  private findNodesByType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];

    const traverse = (currentNode: Parser.SyntaxNode) => {
      if (currentNode.type === type) {
        nodes.push(currentNode);
      }

      if (currentNode.children && Array.isArray(currentNode.children)) {
        for (const child of currentNode.children) {
          traverse(child);
        }
      }
    };

    traverse(node);
    return nodes;
  }

  /**
   * 判断是否应该提取类成员
   */
  private shouldExtractMembers(node: Parser.SyntaxNode): boolean {
    // 如果类体很大，则提取成员作为独立分段
    const bodyNode = node.childForFieldName('body');
    if (!bodyNode) {
      return false;
    }

    const bodyContent = this.extractNodeContent(bodyNode, '');
    return bodyContent.length > this.config.maxChunkSize * 0.8;
  }

  /**
   * 提取类成员作为独立分段
   */
  private extractClassMembers(node: Parser.SyntaxNode, content: string): CodeChunk[] {
    const memberChunks: CodeChunk[] = [];
    const bodyNode = node.childForFieldName('body');

    if (!bodyNode) {
      return memberChunks;
    }

    const className = this.extractClassName(node, content);
    const location = this.getNodeLocation(node);

    // 遍历类体中的成员
    const traverseMembers = (memberNode: Parser.SyntaxNode) => {
      if (this.isMethod(memberNode) || this.isProperty(memberNode)) {
        const memberContent = this.extractNodeContent(memberNode, content);
        const memberLocation = this.getNodeLocation(memberNode);

        if (memberContent.length >= this.config.minChunkSize) {
          const memberChunk: CodeChunk = {
            content: memberContent,
            metadata: {
              startLine: memberLocation.startLine,
              endLine: memberLocation.endLine,
              language: this.detectLanguage(node),
              type: this.isMethod(memberNode) ? 'method' : 'property',
              className,
              complexity: this.calculateComplexity(memberContent),
              isStatic: this.isStaticMember(memberNode),
              accessModifiers: this.extractAccessModifiers(memberNode)
            }
          };

          memberChunks.push(memberChunk);
        }
      }

      if (memberNode.children && Array.isArray(memberNode.children)) {
        for (const child of memberNode.children) {
          traverseMembers(child);
        }
      }
    };

    traverseMembers(bodyNode);
    return memberChunks;
  }

  /**
   * 检查是否为静态成员
   */
  private isStaticMember(node: Parser.SyntaxNode): boolean {
    const staticNode = node.childForFieldName('static');
    if (staticNode) {
      return true;
    }

    const nodeText = node.text || '';
    return nodeText.includes('static');
  }

  /**
   * 使用查询引擎提取类
   */
  async extractClassesUsingQuery(
    ast: Parser.SyntaxNode,
    language: string,
    content: string
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    // 根据语言选择查询模式
    let queryPattern = 'class_declaration';
    if (language === 'python') {
      queryPattern = 'python_class';
    } else if (language === 'java') {
      queryPattern = 'class_declaration';
    } else if (language === 'go') {
      queryPattern = 'go_struct';
    }

    const queryResult = await this.queryEngine.executeQuery(ast, queryPattern, language);

    if (queryResult.success) {
      for (const match of queryResult.matches) {
        const chunk = this.createClassChunk(match.node, content);
        if (chunk) {
          chunks.push(chunk);
        }
      }
    }

    return chunks;
  }

  /**
   * 优化类分段
   */
  optimizeClassChunks(chunks: CodeChunk[]): CodeChunk[] {
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
      if (chunk.metadata.complexity && chunk.metadata.complexity > 30) {
        return false;
      }

      return true;
    });
  }

  /**
   * 按优先级排序类
   */
  sortClassesByPriority(chunks: CodeChunk[]): CodeChunk[] {
    return chunks.sort((a, b) => {
      // 优先级：公共类 > 内部类 > 匿名类
      const aPriority = this.getClassPriority(a);
      const bPriority = this.getClassPriority(b);

      return bPriority - aPriority;
    });
  }

  /**
   * 获取类优先级
   */
  private getClassPriority(chunk: CodeChunk): number {
    const name = chunk.metadata.className || '';

    // 公共类优先级最高
    if (!name.startsWith('_') && name !== 'anonymous') {
      return 3;
    }

    // 内部类
    if (name.startsWith('_') && !name.startsWith('__')) {
      return 2;
    }

    // 特殊类和匿名类
    return 1;
  }
}