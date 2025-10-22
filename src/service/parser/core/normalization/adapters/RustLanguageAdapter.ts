import { ILanguageAdapter, StandardizedQueryResult } from '../types';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * Rust语言适配器
 * 处理Rust特定的查询结果标准化
 */
export class RustLanguageAdapter implements ILanguageAdapter {
  private logger: LoggerService;

  constructor() {
    this.logger = new LoggerService();
  }

  normalize(queryResults: any[], queryType: string, language: string): StandardizedQueryResult[] {
    const results: StandardizedQueryResult[] = [];
    
    for (const result of queryResults) {
      try {
        const extraInfo = this.extractExtraInfo(result);
        const normalizedResult: StandardizedQueryResult = {
          type: this.mapQueryTypeToStandardType(queryType),
          name: this.extractName(result),
          startLine: this.extractStartLine(result),
          endLine: this.extractEndLine(result),
          content: this.extractContent(result),
          metadata: {
            language,
            complexity: this.calculateComplexity(result),
            dependencies: this.extractDependencies(result),
            modifiers: this.extractModifiers(result),
            extra: Object.keys(extraInfo).length > 0 ? extraInfo : undefined
          }
        };
        results.push(normalizedResult);
      } catch (error) {
        this.logger.warn(`Failed to normalize Rust result for ${queryType}:`, error);
        // 即使有错误，我们也记录警告但不添加null结果
      }
    }
    
    return results;
  }

 getSupportedQueryTypes(): string[] {
    return [
      'functions',
      'classes',        // 对应Rust的struct、enum、union
      'methods',        // 对应impl块中的函数
      'imports',        // 对应use声明和extern crate
      'variables',      // 对应变量声明、常量、静态变量
      'control-flow',   // 对应match、if、loop等控制流
      'types',          // 对应类型别名、trait、类型参数
      'expressions',    // 对应各种表达式
      'macros',         // 对应宏定义和宏调用
      'modules'         // 对应模块定义
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      // Function definitions
      'function_item': 'function',
      'function_signature_item': 'function',
      'async_function': 'function',
      'closure_expression': 'function',
      
      // Struct/class-like definitions
      'struct_item': 'class',
      'unit_struct_item': 'class',
      'tuple_struct_item': 'class',
      'enum_item': 'class',
      'union_item': 'class',
      'trait_item': 'interface',
      
      // Implementation blocks
      'impl_item': 'class', // 代表impl块，通常与struct/enum相关
      
      // Methods (inside impl blocks)
      'method_definition': 'method', // 这个可能需要根据tree-sitter输出调整
      
      // Module and import statements
      'mod_item': 'import',
      'use_declaration': 'import',
      'extern_crate_declaration': 'import',
      'foreign_item_fn': 'import',
      'foreign_static_item': 'import',
      
      // Variables and constants
      'const_item': 'variable',
      'static_item': 'variable',
      'let_declaration': 'variable',
      'assignment_expression': 'variable',
      
      // Type definitions
      'type_item': 'type',
      'type_parameter': 'type',
      'associated_type': 'type',
      'associated_constant': 'variable',
      
      // Macros
      'macro_definition': 'function', // 宏定义类似函数
      'macro_invocation': 'expression', // 宏调用是表达式
      
      // Control flow
      'match_expression': 'control-flow',
      'if_expression': 'control-flow',
      'loop_expression': 'control-flow',
      'while_expression': 'control-flow',
      'for_expression': 'control-flow',
      'unsafe_block': 'control-flow',
      
      // Expressions
      'call_expression': 'expression',
      'field_expression': 'expression',
      'binary_expression': 'expression',
      'unary_expression': 'expression',
      'array_expression': 'expression',
      'tuple_expression': 'expression',
      'cast_expression': 'expression',
      'index_expression': 'expression',
      'range_expression': 'expression',
      'await_expression': 'expression',
      'return_expression': 'expression',
      'continue_expression': 'expression',
      'break_expression': 'expression',
      'try_expression': 'expression',
      'reference_expression': 'expression',
      'literal': 'expression',
      'integer_literal': 'expression',
      'float_literal': 'expression',
      'string_literal': 'expression',
      'char_literal': 'expression',
      'boolean_literal': 'expression',
      'unit_expression': 'expression',
      
      // Attributes
      'attribute_item': 'type', // 属性可以影响类型或函数的行为
    };
    
    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    try {
      // 尝试从不同的捕获中提取名称
      const nameCaptures = [
        'name.definition.function',
        'name.definition.struct',
        'name.definition.enum',
        'name.definition.trait',
        'name.definition.constant',
        'name.definition.static',
        'name.definition.variable',
        'name.definition.module',
        'name.definition.type_alias',
        'name.definition.macro',
        'name.definition.extern_crate',
        'name',
        'identifier',
        'type_identifier'
      ];

      for (const captureName of nameCaptures) {
        const capture = result.captures?.find((c: any) => c.name === captureName);
        if (capture?.node) {
          // 优先尝试从node的特定字段中提取名称
          if (capture.node.childForFieldName) {
            const nameNode = capture.node.childForFieldName('name');
            if (nameNode?.text) {
              return nameNode.text;
            }
            
            // 尝试获取标识符
            const identifier = capture.node.childForFieldName('identifier') ||
                              capture.node.childForFieldName('type_identifier') ||
                              capture.node.childForFieldName('field_identifier');
            if (identifier?.text) {
              return identifier.text;
            }
          }
          
          // 如果特定字段没有找到，使用节点文本
          if (capture.node.text) {
            return capture.node.text;
          }
        }
      }

      // 如果没有找到名称捕获，尝试从主节点提取
      if (result.captures?.[0]?.node) {
        const mainNode = result.captures[0].node;
        
        // 尝试从特定字段提取名称
        if (mainNode.childForFieldName) {
          const nameNode = mainNode.childForFieldName('name');
          if (nameNode?.text) {
            return nameNode.text;
          }
          
          // 尝试获取标识符
          const identifier = mainNode.childForFieldName('identifier') ||
                            mainNode.childForFieldName('type_identifier') ||
                            mainNode.childForFieldName('field_identifier');
          if (identifier?.text) {
            return identifier.text;
          }
        }
        
        // 如果以上都失败，返回节点文本
        if (mainNode.text) {
          return mainNode.text;
        }
      }

      return 'unnamed';
    } catch (error) {
      this.logger.warn('Error in extractName:', error);
      return 'unnamed';
    }
  }

  extractContent(result: any): string {
    try {
      const mainNode = result.captures?.[0]?.node;
      if (!mainNode) {
        return '';
      }
      
      return mainNode.text || '';
    } catch (error) {
      this.logger.warn('Error in extractContent:', error);
      return '';
    }
  }

 extractStartLine(result: any): number {
    try {
      const mainNode = result.captures?.[0]?.node;
      if (!mainNode) {
        return 1;
      }
      
      return (mainNode.startPosition?.row || 0) + 1; // 转换为1-based
    } catch (error) {
      this.logger.warn('Error in extractStartLine:', error);
      return 1;
    }
  }

 extractEndLine(result: any): number {
    try {
      const mainNode = result.captures?.[0]?.node;
      if (!mainNode) {
        return 1;
      }
      
      return (mainNode.endPosition?.row || 0) + 1; // 转换为1-based
    } catch (error) {
      this.logger.warn('Error in extractEndLine:', error);
      return 1;
    }
  }

  calculateComplexity(result: any): number {
    try {
      let complexity = 1; // 基础复杂度
      
      const mainNode = result.captures?.[0]?.node;
      if (!mainNode) {
        return complexity;
      }

      // 基于节点类型增加复杂度
      const nodeType = mainNode.type || '';
      if (nodeType.includes('struct') || nodeType.includes('enum') || nodeType.includes('trait')) complexity += 1;
      if (nodeType.includes('function') || nodeType.includes('method')) complexity += 1;
      if (nodeType.includes('impl')) complexity += 1;
      if (nodeType.includes('macro')) complexity += 2; // 宏通常更复杂
      if (nodeType.includes('match')) complexity += 1; // match表达式可能很复杂

      // 基于代码行数增加复杂度
      const lineCount = this.extractEndLine(result) - this.extractStartLine(result) + 1;
      complexity += Math.floor(lineCount / 10);

      // 基于嵌套深度增加复杂度
      const nestingDepth = this.calculateNestingDepth(mainNode);
      complexity += nestingDepth;

      // Rust特有的复杂度因素
      const text = mainNode.text || '';
      if (text.includes('unsafe')) complexity += 1; // 不安全代码更复杂
      if (text.includes('async') || text.includes('await')) complexity += 1; // 异步代码
      if (text.includes('where')) complexity += 1; // where子句增加复杂度
      if (text.includes('impl')) complexity += 1; // trait实现增加复杂度
      if (text.includes('trait')) complexity += 1; // trait定义增加复杂度

      return complexity;
    } catch (error) {
      this.logger.warn('Error in calculateComplexity:', error);
      return 1; // 返回基础复杂度
    }
  }

  extractDependencies(result: any): string[] {
    try {
      const dependencies: string[] = [];
      const mainNode = result.captures?.[0]?.node;
      
      if (!mainNode) {
        return dependencies;
      }

      // 查找类型引用
      this.findTypeReferences(mainNode, dependencies);
      
      // 查找函数调用引用
      this.findFunctionCalls(mainNode, dependencies);
      
      // 查找模块/路径引用
      this.findPathReferences(mainNode, dependencies);

      return [...new Set(dependencies)]; // 去重
    } catch (error) {
      this.logger.warn('Error in extractDependencies:', error);
      return [];
    }
  }

 extractModifiers(result: any): string[] {
    try {
      const modifiers: string[] = [];
      const mainNode = result.captures?.[0]?.node;
      
      if (!mainNode) {
        return modifiers;
      }

      // 检查Rust特有的修饰符
      const text = mainNode.text || '';
      
      if (text.includes('unsafe')) modifiers.push('unsafe');
      if (text.includes('async')) modifiers.push('async');
      if (text.includes('const')) modifiers.push('const');
      if (text.includes('static')) modifiers.push('static');
      if (text.includes('extern')) modifiers.push('extern');
      if (text.includes('pub')) modifiers.push('public');
      if (text.includes('pub(crate)')) modifiers.push('crate-public');
      if (text.includes('pub(super)')) modifiers.push('super-public');
      if (text.includes('pub(self)')) modifiers.push('self-public');
      if (text.includes('mut')) modifiers.push('mutable');
      if (text.includes('ref')) modifiers.push('reference');
      if (text.includes('move')) modifiers.push('move');
      if (text.includes('crate::')) modifiers.push('crate-scoped');
      if (text.includes('super::')) modifiers.push('super-scoped');
      if (text.includes('self::')) modifiers.push('self-scoped');
      
      // 检查是否是trait实现
      if (text.includes('impl')) {
        if (text.includes('for')) {
          modifiers.push('trait-impl');
        } else {
          modifiers.push('inherent-impl');
        }
      }

      return modifiers;
    } catch (error) {
      this.logger.warn('Error in extractModifiers:', error);
      return [];
    }
 }

  extractExtraInfo(result: any): Record<string, any> {
    try {
      const extra: Record<string, any> = {};
      const mainNode = result.captures?.[0]?.node;
      
      if (!mainNode) {
        return extra;
      }

      // 提取泛型参数信息
      const genericParameters = this.findGenericParameters(mainNode);
      if (genericParameters.length > 0) {
        extra.hasGenerics = true;
        extra.genericParameters = genericParameters;
      }

      // 提取trait约束信息
      const traitBounds = this.findTraitBounds(mainNode);
      if (traitBounds.length > 0) {
        extra.hasTraitBounds = true;
        extra.traitBounds = traitBounds;
      }

      // 提取生命周期信息
      const lifetimes = this.findLifetimes(mainNode);
      if (lifetimes.length > 0) {
        extra.hasLifetimes = true;
        extra.lifetimes = lifetimes;
      }

      // 提取参数信息（对于函数）
      if (mainNode.childForFieldName) {
        const parameters = mainNode.childForFieldName('parameters');
        if (parameters && typeof parameters === 'object' && parameters.childCount !== undefined) {
          extra.parameterCount = parameters.childCount;
        }
      }

      // 提取返回类型
      const returnType = this.findReturnType(mainNode);
      if (returnType) {
        extra.returnType = returnType;
      }

      // 提取可见性
      const visibility = this.findVisibility(mainNode);
      if (visibility) {
        extra.visibility = visibility;
      }

      return extra;
    } catch (error) {
      this.logger.warn('Error in extractExtraInfo:', error);
      return {};
    }
  }

  private mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression'> = {
      'functions': 'function',
      'classes': 'class',         // 对应struct、enum、union
      'methods': 'method',
      'imports': 'import',        // 对应use、extern crate等
      'variables': 'variable',    // 对应const、static、let等
      'control-flow': 'control-flow',
      'types': 'type',            // 对应type alias、trait等
      'expressions': 'expression',
      'macros': 'function',       // 宏类似函数
      'modules': 'import',        // 模块导入
      'patterns': 'expression',   // 模式匹配
    };
    
    return mapping[queryType] || 'expression';
  }

  private calculateNestingDepth(node: any, currentDepth: number = 0): number {
    if (!node || !node.children) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    
    for (const child of node.children) {
      if (this.isBlockNode(child)) {
        const childDepth = this.calculateNestingDepth(child, currentDepth + 1);
        maxDepth = Math.max(maxDepth, childDepth);
      }
    }

    return maxDepth;
  }

  private isBlockNode(node: any): boolean {
    const blockTypes = [
      'block', 'function_body', 'match_arm', 'match_block', 
      'loop_expression', 'while_expression', 'for_expression',
      'if_expression', 'unsafe_block', 'const_block', 'async_block'
    ];
    return blockTypes.includes(node.type);
  }

  private findTypeReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找类型引用模式
      if (child.type === 'type_identifier' || child.type === 'identifier') {
        const text = child.text;
        if (text && text[0] === text[0].toUpperCase()) {
          // 仅当名称以大写字母开头时才添加到依赖项（通常表示类型名）
          dependencies.push(text);
        } else if (text && text !== 'self' && text !== 'Self' && text !== 'super' && text !== 'crate') {
          // 添加其他标识符，但排除关键字
          dependencies.push(text);
        }
      } else if (child.type === 'scoped_identifier' || child.type === 'field_identifier') {
        // 处理命名空间或类名引用
        const text = child.text;
        if (text) {
          dependencies.push(text);
        }
      }
      
      this.findTypeReferences(child, dependencies);
    }
  }

  private findFunctionCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找函数调用
      if (child.type === 'call_expression' || child.type === 'macro_invocation') {
        const functionNode = child.childForFieldName('function') ||
                            child.childForFieldName('name') ||
                            child.childForFieldName('path');
        if (functionNode?.text) {
          dependencies.push(functionNode.text);
        }
      }
      
      this.findFunctionCalls(child, dependencies);
    }
  }

  private findPathReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找路径引用
      if (child.type === 'scoped_identifier' || child.type === 'use_path' || child.type === 'path_segment') {
        const text = child.text;
        if (text) {
          dependencies.push(text);
        }
      }
      
      this.findPathReferences(child, dependencies);
    }
  }

  private findGenericParameters(node: any): string[] {
    const generics: string[] = [];
    
    if (!node || !node.children) {
      return generics;
    }

    for (const child of node.children) {
      if (child.type === 'type_parameters' || child.type === 'type_arguments') {
        generics.push(child.text);
      }
      generics.push(...this.findGenericParameters(child));
    }

    return generics;
  }

  private findTraitBounds(node: any): string[] {
    const bounds: string[] = [];
    
    if (!node || !node.children) {
      return bounds;
    }

    for (const child of node.children) {
      if (child.type === 'trait_bound' || child.type === 'type_bound') {
        bounds.push(child.text);
      }
      bounds.push(...this.findTraitBounds(child));
    }

    return bounds;
  }

  private findLifetimes(node: any): string[] {
    const lifetimes: string[] = [];
    
    if (!node || !node.children) {
      return lifetimes;
    }

    for (const child of node.children) {
      if (child.type === 'lifetime') {
        lifetimes.push(child.text);
      }
      lifetimes.push(...this.findLifetimes(child));
    }

    return lifetimes;
  }

  private findReturnType(node: any): string | null {
    if (!node || !node.children) {
      return null;
    }

    // 寻找返回类型
    for (const child of node.children) {
      if (child.type === 'return_type' || child.type === 'type') {
        return child.text;
      }
    }

    return null;
  }

 private findVisibility(node: any): string | null {
    if (!node || !node.children) {
      return null;
    }

    // 寻找可见性修饰符
    for (const child of node.children) {
      if (child.type === 'visibility_modifier') {
        return child.text;
      }
    }

    return null;
 }
}