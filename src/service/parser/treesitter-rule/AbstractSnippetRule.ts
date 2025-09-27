import * as Parser from 'tree-sitter';
import { SnippetChunk, SnippetMetadata } from '../types';
import { SnippetValidationService } from '../analysis/SnippetValidationService';
import { SnippetExtractionRule } from './SnippetExtractionRule';

// Configuration interface for rule behavior
interface RuleConfig {
  maxDepth?: number;
  minComplexity?: number;
  maxComplexity?: number;
  minLines?: number;
  maxLines?: number;
}

/**
 * 抽象基础规则类，提供通用功能实现
 */
export abstract class AbstractSnippetRule implements SnippetExtractionRule {
  abstract readonly name: string;
  abstract readonly supportedNodeTypes: Set<string>;
  protected abstract readonly snippetType:
    | 'control_structure'
    | 'error_handling'
    | 'function_call_chain'
    | 'expression_sequence'
    | 'comment_marked'
    | 'logic_block'
    | 'object_array_literal'
    | 'arithmetic_logical_expression'
    | 'template_literal'
    | 'destructuring_assignment'
    | 'generic_pattern'
    | 'decorator_pattern'
    | 'async_pattern'
    | 'python_comprehension'
    | 'java_stream'
    | 'java_lambda'
    | 'functional_programming'
    | 'go_goroutine'
    | 'go_interface'
    | 'react_component'
    | 'django_model'
    | 'django_view'
    | 'spring_boot_controller'
    | 'pytorch_neural_network'
    | 'vue_component'
    | 'express_route'
    | 'pytest_test'
    | 'junit_test'
    | 'angular_component'
    | 'fastapi_route'
    | 'data_manipulation'
    | 'go_web_framework'
    | 'build_configuration'
    | 'package_management'
    | 'docker_containerization'
    | 'cicd_configuration';

  protected readonly config: RuleConfig = {
    maxDepth: 50,
    minComplexity: 2,
    maxComplexity: 100,
    minLines: 1,
    maxLines: 50,
  };

  constructor(config?: Partial<RuleConfig>) {
    this.config = { ...this.config, ...config };
  }

  extract(ast: Parser.SyntaxNode, sourceCode: string): SnippetChunk[] {
    const snippets: SnippetChunk[] = [];

    const traverse = (node: Parser.SyntaxNode, nestingLevel: number = 0, depth: number = 0) => {
      if (depth > this.config.maxDepth!) return;

      if (this.shouldProcessNode(node, sourceCode)) {
        const snippet = this.createSnippet(node, sourceCode, nestingLevel);
        if (snippet && this.validateSnippet(snippet)) {
          snippets.push(snippet);
        }
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, nestingLevel + 1, depth + 1);
        }
      }
    };

    traverse(ast);
    return snippets;
  }

  /**
   * 判断是否应该处理该节点
   */
  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    return this.supportedNodeTypes.has(node.type) && this.isValidNodeType(node, sourceCode);
  }

  /**
   * 验证节点类型是否有效（可被子类重写）
   */
  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    return true;
  }

  /**
   * 验证代码片段是否有效
   */
  protected validateSnippet(snippet: SnippetChunk): boolean {
    return SnippetValidationService.enhancedIsValidSnippet(
      snippet.content,
      this.snippetType as Extract<
        typeof this.snippetType,
        | 'control_structure'
        | 'error_handling'
        | 'function_call_chain'
        | 'expression_sequence'
        | 'comment_marked'
        | 'logic_block'
        | 'object_array_literal'
        | 'arithmetic_logical_expression'
        | 'template_literal'
        | 'destructuring_assignment'
        | 'generic_pattern'
        | 'decorator_pattern'
        | 'async_pattern'
        | 'python_comprehension'
        | 'java_stream'
        | 'java_lambda'
        | 'functional_programming'
        | 'go_goroutine'
        | 'go_interface'
        | 'react_component'
        | 'django_model'
        | 'django_view'
        | 'spring_boot_controller'
        | 'pytorch_neural_network'
        | 'vue_component'
        | 'express_route'
        | 'pytest_test'
        | 'junit_test'
        | 'angular_component'
        | 'fastapi_route'
        | 'data_manipulation'
        | 'go_web_framework'
        | 'build_configuration'
        | 'package_management'
        | 'docker_containerization'
        | 'cicd_configuration'
      >
    );
  }

  /**
   * 创建代码片段（必须由子类实现）
   */
  protected abstract createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null;

  /**
   * 获取节点文本内容
   */
  protected getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }

  /**
   * 获取节点位置信息
   */
  protected getNodeLocation(node: Parser.SyntaxNode): {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  } {
    return {
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endColumn: node.endPosition.column + 1,
    };
  }

  /**
   * 提取上下文信息
   */
  protected extractContextInfo(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetMetadata['contextInfo'] {
    const context: SnippetMetadata['contextInfo'] = { nestingLevel };

    // 查找父函数
    let parent = node.parent;
    let depth = 0;
    while (parent && depth < this.config.maxDepth!) {
      const functionTypes = [
        'function_declaration',
        'function_definition',
        'method_definition',
        'arrow_function',
        'function_expression',
      ];

      if (functionTypes.includes(parent.type)) {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) {
          context.parentFunction = this.getNodeText(nameNode, sourceCode);
          break;
        }
      }
      parent = parent.parent;
      depth++;
    }

    // 查找父类
    parent = node.parent;
    depth = 0;
    while (parent && depth < this.config.maxDepth!) {
      if (parent.type === 'class_declaration' || parent.type === 'class_definition') {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) {
          context.parentClass = this.getNodeText(nameNode, sourceCode);
          break;
        }
      }
      parent = parent.parent;
      depth++;
    }

    return context;
  }

  /**
   * 计算代码复杂度
   */
  protected calculateComplexity(content: string): number {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const cyclomatic = Math.max(
      1,
      (content.match(/\b(if|else|while|for|switch|case|catch|&&|\|\||\?)/g) || []).length
    );

    return lines.length + cyclomatic;
  }

  /**
   * 分析语言特性
   */
  protected analyzeLanguageFeatures(content: string): {
    usesAsync?: boolean;
    usesGenerators?: boolean;
    usesDestructuring?: boolean;
    usesSpread?: boolean;
    usesTemplateLiterals?: boolean;
  } {
    return {
      usesAsync: /\basync\s+function\b|\bawait\s+\w+/i.test(content),
      usesGenerators: /\bfunction\s*\*\s*\w+|\byield\s+\*?\w*/i.test(content),
      usesDestructuring: /\{\s*\w+|\[\s*\w+/i.test(content),
      usesSpread: /\.\.\./.test(content),
      usesTemplateLiterals: /`[^`]*\${[^}]*}/.test(content),
    };
  }

  /**
   * 判断是否有副作用
   */
  protected hasSideEffects(content: string): boolean {
    const sideEffectPatterns = [
      /\bconsole\./,
      /\bdocument\./,
      /\bwindow\./,
      /\bglobalThis\./,
      /\.write\(/,
      /\.appendChild\(/,
      /\.removeChild\(/,
      /\.insertBefore\(/,
      /\.replaceChild\(/,
      /\.setAttribute\(/,
      /\.removeAttribute\(/,
      /\.addEventListener\(/,
      /\.removeEventListener\(/,
      /\.dispatchEvent\(/,
      /\.postMessage\(/,
      /fetch\(/,
      /XMLHttpRequest/,
      /localStorage\./,
      /sessionStorage\./,
      /indexedDB\./,
      /alert\(/,
      /confirm\(/,
      /prompt\(/,
    ];

    return sideEffectPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 生成唯一的片段ID
   */
  protected generateSnippetId(content: string, startLine: number): string {
    const hash = this.simpleHash(content).substring(0, 8);
    return `${this.snippetType}_${startLine}_${hash}`;
  }

  /**
   * 简单的哈希函数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

/**
 * 改进版的解构赋值规则
 */
export class ImprovedDestructuringRule extends AbstractSnippetRule {
  readonly name = 'ImprovedDestructuringRule';
  readonly supportedNodeTypes = new Set([
    'object_pattern',
    'array_pattern',
    'assignment_expression',
  ]);
  protected readonly snippetType = 'destructuring_assignment';

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (node.type === 'assignment_expression') {
      const left = node.childForFieldName('left');
      return left?.type === 'object_pattern' || left?.type === 'array_pattern';
    }
    return true;
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
      },
    };
  }
}

/**
 * 改进版的控制结构规则
 */
export class ImprovedControlStructureRule extends AbstractSnippetRule {
  readonly name = 'ImprovedControlStructureRule';
  readonly supportedNodeTypes = new Set([
    'if_statement',
    'else_clause',
    'else_if_clause',
    'for_statement',
    'for_in_statement',
    'for_of_statement',
    'while_statement',
    'do_statement',
    'switch_statement',
    'case_clause',
    'default_clause',
    'conditional_expression',
  ]);
  protected readonly snippetType = 'control_structure';

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);

    // 过滤过于简单的控制结构
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    return lines.length > 1 || content.length > 30;
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
      },
    };
  }
}

/**
 * 改进版的函数调用链规则
 */
export class ImprovedFunctionCallRule extends AbstractSnippetRule {
  readonly name = 'ImprovedFunctionCallRule';
  readonly supportedNodeTypes = new Set([
    'call_expression',
    'method_call',
    'function_call',
    'await_expression',
  ]);
  protected readonly snippetType = 'function_call_chain';

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);

    // 确保是有意义的调用
    return this.isMeaningfulCall(content) && content.length > 10;
  }

  private isMeaningfulCall(content: string): boolean {
    // 检查链式调用、异步调用等
    return content.includes('.') || content.includes('await') || content.includes('=>');
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: this.hasSideEffects(content),
      },
    };
  }

  private countCallChainLength(content: string): number {
    return (content.match(/\./g) || []).length + 1;
  }
}

/**
 * 规则工厂，用于创建和管理规则实例
 */
export class RuleFactory {
  static createDefaultRules(): SnippetExtractionRule[] {
    return [
      new ImprovedDestructuringRule(),
      new ImprovedControlStructureRule(),
      new ImprovedFunctionCallRule(),
      // 可以添加更多改进后的规则
    ];
  }

  static createRulesForLanguage(language: string): SnippetExtractionRule[] {
    const baseRules = this.createDefaultRules();

    // 根据语言添加特定规则
    switch (language.toLowerCase()) {
      case 'python':
        // 添加Python特定规则
        break;
      case 'java':
        // 添加Java特定规则
        break;
      case 'go':
        // 添加Go特定规则
        break;
    }

    return baseRules;
  }
}

export default AbstractSnippetRule;
