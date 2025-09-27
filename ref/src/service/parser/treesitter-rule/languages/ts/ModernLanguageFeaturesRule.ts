import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../types';
import { AbstractSnippetRule } from '../../AbstractSnippetRule';

/**
 * 现代语言特性规则
 * 支持现代JavaScript/TypeScript特性，如async/await、装饰器、可选链等
 */
export class ModernLanguageFeaturesRule extends AbstractSnippetRule {
  readonly name = 'ModernLanguageFeaturesRule';
  readonly supportedNodeTypes = new Set([
    // 异步特性
    'async_function',
    'await_expression',
    'async_arrow_function',

    // 装饰器
    'decorator',
    'decorated_statement',
    'decorated_class_declaration',

    // 可选链和空值合并
    'optional_member_expression',
    'optional_call_expression',
    'nullish_coalescing_expression',
    'logical_or_expression',

    // 私有字段和方法
    'private_identifier',
    'private_field_definition',
    'private_method_definition',
    'private_property_identifier',

    // 解构和展开
    'rest_pattern',
    'spread_element',
    'spread_pattern',

    // 类型特性
    'type_annotation',
    'type_alias_declaration',
    'interface_declaration',
    'generic_type',
    'type_parameter_declaration',
    'type_assertion',

    // 模块特性
    'import_statement',
    'export_statement',
    'export_named_declaration',
    'export_default_declaration',
    'export_all_declaration',

    // 类特性
    'class_declaration',
    'class_expression',
    'extends_clause',
    'implements_clause',
    'constructor_declaration',

    // 高级特性
    'generator_function',
    'yield_expression',
    'for_await_statement',
    'dynamic_import',
    'import_expression',
    'big_int_literal',
  ]);

  protected readonly snippetType:
    | 'control_structure'
    | 'error_handling'
    | 'function_call_chain'
    | 'expression_sequence'
    | 'comment_marked'
    | 'logic_block'
    | 'object_array_literal'
    | 'arithmetic_logical_expression'
    | 'template_literal'
    | 'destructuring_assignment' = 'expression_sequence';

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);

    // 过滤过于简单的表达式
    if (content.length < 15) return false;

    // 检查是否包含现代特性
    return this.containsModernFeature(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const featureType = this.identifyFeatureType(node, content);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractImports(node, sourceCode),
      exports: this.extractExports(node, sourceCode),
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateComplexity(content),
        isStandalone: this.isStandaloneSnippet(node),
        hasSideEffects: this.hasSideEffects(content),
      },
    };
  }

  private containsModernFeature(content: string): boolean {
    const modernPatterns = [
      /async\s+function/i,
      /await\s+\w+/i,
      /\?\./, // 可选链
      /\?\?/, // 空值合并
      /@\w+/, // 装饰器
      /private\s+\w+/i,
      /#\w+/, // 私有字段
      /\.\.\./, // 展开运算符
      /import\s*\(/, // 动态导入
      /yield\s+\*?\w*/i,
      /type\s+\w+\s*=/i,
      /interface\s+\w+/i,
      /class\s+\w+/i,
      /extends\s+\w+/i,
      /implements\s+\w+/i,
      /BigInt\(/,
      /\d+n/, // BigInt字面量
    ];

    return modernPatterns.some(pattern => pattern.test(content));
  }

  private identifyFeatureType(node: Parser.SyntaxNode, content: string): string {
    const featureMap: Record<string, string> = {
      async_function: 'async_function',
      await_expression: 'await_expression',
      decorator: 'decorator',
      optional_member_expression: 'optional_chaining',
      optional_call_expression: 'optional_chaining',
      nullish_coalescing_expression: 'nullish_coalescing',
      private_identifier: 'private_field',
      private_field_definition: 'private_field',
      type_annotation: 'type_annotation',
      type_alias_declaration: 'type_alias',
      interface_declaration: 'interface',
      class_declaration: 'class_declaration',
      extends_clause: 'inheritance',
      implements_clause: 'interface_implementation',
      generator_function: 'generator_function',
      yield_expression: 'yield_expression',
      dynamic_import: 'dynamic_import',
      import_expression: 'dynamic_import',
      big_int_literal: 'bigint_literal',
    };

    return featureMap[node.type] || 'unknown_modern_feature';
  }

  private extractModernFeatures(content: string): {
    usesAsync?: boolean;
    usesGenerators?: boolean;
    usesDestructuring?: boolean;
    usesSpread?: boolean;
    usesTemplateLiterals?: boolean;
  } {
    return this.analyzeLanguageFeatures(content);
  }

  private extractImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    // 查找相关的import语句
    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement') {
        const importText = this.getNodeText(n, sourceCode);
        imports.push(importText);
      }

      if (n.children) {
        n.children.forEach(traverse);
      }
    };

    // 从根节点开始查找
    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return imports;
  }

  private extractExports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const exports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'export_statement' || n.type === 'export_named_declaration') {
        const exportText = this.getNodeText(n, sourceCode);
        exports.push(exportText);
      }

      if (n.children) {
        n.children.forEach(traverse);
      }
    };

    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return exports;
  }

  private isStandaloneSnippet(node: Parser.SyntaxNode): boolean {
    // 判断是否可以独立使用
    const standaloneTypes = [
      'class_declaration',
      'function_declaration',
      'type_alias_declaration',
      'interface_declaration',
      'async_function',
      'generator_function',
    ];

    return standaloneTypes.includes(node.type);
  }
}

/**
 * 响应式编程规则
 * 支持RxJS、Promise、异步流等响应式编程模式
 */
export class ReactiveProgrammingRule extends AbstractSnippetRule {
  readonly name = 'ReactiveProgrammingRule';
  readonly supportedNodeTypes = new Set([
    'call_expression',
    'method_call',
    'property_access_expression',
    'pipe_expression',
    'subscription_expression',
  ]);
  protected readonly snippetType:
    | 'control_structure'
    | 'error_handling'
    | 'function_call_chain'
    | 'expression_sequence'
    | 'comment_marked'
    | 'logic_block'
    | 'object_array_literal'
    | 'arithmetic_logical_expression'
    | 'template_literal'
    | 'destructuring_assignment' = 'logic_block';

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);
    return this.isReactiveCode(content);
  }

  private isReactiveCode(content: string): boolean {
    const reactivePatterns = [
      /\.(pipe|subscribe|map|filter|reduce|merge|switchMap)/,
      /Observable/,
      /Subject/,
      /BehaviorSubject/,
      /ReplaySubject/,
      /AsyncSubject/,
      /of\(/,
      /from\(/,
      /interval\(/,
      /timer\(/,
      /mergeMap/,
      /concatMap/,
      /exhaustMap/,
      /debounceTime/,
      /distinctUntilChanged/,
      /catchError/,
      /retry/,
      /shareReplay/,
    ];

    return reactivePatterns.some(pattern => pattern.test(content));
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
      imports: this.extractReactiveImports(node, sourceCode),
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateComplexity(content),
        isStandalone: false,
        hasSideEffects: this.hasSideEffects(content),
      },
    };
  }

  private extractReactiveImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    // 查找RxJS相关的import
    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement') {
        const importText = this.getNodeText(n, sourceCode);
        if (importText.includes('rxjs') || importText.includes('Observable')) {
          imports.push(importText);
        }
      }

      if (n.children) {
        n.children.forEach(traverse);
      }
    };

    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return imports;
  }

  private identifyReactiveType(content: string): string {
    if (content.includes('.pipe')) return 'pipe_chain';
    if (content.includes('.subscribe')) return 'subscription';
    if (content.includes('Observable')) return 'observable_creation';
    if (content.includes('Subject')) return 'subject_usage';
    return 'reactive_operation';
  }
}

/**
 * 测试用例规则
 * 识别测试代码和断言
 */
export class TestCodeRule extends AbstractSnippetRule {
  readonly name = 'TestCodeRule';
  readonly supportedNodeTypes = new Set([
    'call_expression',
    'method_call',
    'function_call',
    'arrow_function',
  ]);
  protected readonly snippetType:
    | 'control_structure'
    | 'error_handling'
    | 'function_call_chain'
    | 'expression_sequence'
    | 'comment_marked'
    | 'logic_block'
    | 'object_array_literal'
    | 'arithmetic_logical_expression'
    | 'template_literal'
    | 'destructuring_assignment' = 'comment_marked';

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const content = this.getNodeText(node, sourceCode);
    return this.isTestCode(content);
  }

  private isTestCode(content: string): boolean {
    const testPatterns = [
      /describe\s*\(/,
      /it\s*\(/,
      /test\s*\(/,
      /expect\s*\(/,
      /assert\s*\(/,
      /should\s*\(/,
      /mock\s*\(/,
      /spyOn\s*\(/,
      /jest\./,
      /mocha/,
      /chai/,
      /sinon/,
      /vitest/,
    ];

    return testPatterns.some(pattern => pattern.test(content));
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
      imports: this.extractTestImports(node, sourceCode),
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateComplexity(content),
        isStandalone: true,
        hasSideEffects: false,
      },
    };
  }

  private extractTestImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement') {
        const importText = this.getNodeText(n, sourceCode);
        const testLibs = ['jest', 'mocha', 'chai', 'sinon', 'vitest', '@testing-library'];
        if (testLibs.some(lib => importText.includes(lib))) {
          imports.push(importText);
        }
      }

      if (n.children) {
        n.children.forEach(traverse);
      }
    };

    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return imports;
  }

  private identifyTestType(content: string): string {
    if (content.includes('describe')) return 'test_suite';
    if (content.includes('it') || content.includes('test')) return 'test_case';
    if (content.includes('expect') || content.includes('assert')) return 'assertion';
    if (content.includes('mock') || content.includes('spyOn')) return 'mock_setup';
    return 'test_helper';
  }
}
