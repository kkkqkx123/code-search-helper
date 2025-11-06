import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { RustHelperMethods } from './RustHelperMethods';
import Parser from 'tree-sitter';

/**
 * Rust 生命周期关系提取器
 * 专门处理Rust语言的生命周期关系提取
 */
export class LifecycleRelationshipExtractor {
  /**
   * 提取生命周期关系元数据
   */
  extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const lifecycleInfo = this.extractLifecycleInfo(astNode);

    return {
      type: 'lifecycle',
      operation: lifecycleInfo.operation,
      fromNodeId: lifecycleInfo.fromNodeId,
      toNodeId: lifecycleInfo.toNodeId,
      lifetimeName: lifecycleInfo.lifetimeName,
      lifetimeType: lifecycleInfo.lifetimeType,
      isStatic: lifecycleInfo.isStatic,
      location: {
        filePath: symbolTable?.filePath || 'current_file.rs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取生命周期关系
   */
  extractLifecycleRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'lifetime_annotation' | 'lifetime_bound' | 'lifetime_subtyping' | 'static_lifetime' | 'elided_lifetime';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'lifetime_annotation' | 'lifetime_bound' | 'lifetime_subtyping' | 'static_lifetime' | 'elided_lifetime';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取生命周期注解关系
    if (this.hasLifetimeAnnotation(mainNode)) {
      const annotations = this.extractLifetimeAnnotations(mainNode);
      for (const annotation of annotations) {
        relationships.push({
          source: annotation.variable,
          target: annotation.lifetime,
          type: 'lifetime_annotation'
        });
      }
    }

    // 提取生命周期约束关系
    if (this.hasLifetimeBound(mainNode)) {
      const bounds = this.extractLifetimeBounds(mainNode);
      for (const bound of bounds) {
        relationships.push({
          source: bound.lifetime,
          target: bound.bound,
          type: 'lifetime_bound'
        });
      }
    }

    // 提取生命周期子类型关系
    if (this.hasLifetimeSubtyping(mainNode)) {
      const subtypes = this.extractLifetimeSubtypes(mainNode);
      for (const subtype of subtypes) {
        relationships.push({
          source: subtype.lifetime,
          target: subtype.supertype,
          type: 'lifetime_subtyping'
        });
      }
    }

    // 提取静态生命周期关系
    if (this.hasStaticLifetime(mainNode)) {
      const staticRefs = this.extractStaticLifetimeReferences(mainNode);
      for (const ref of staticRefs) {
        relationships.push({
          source: ref.variable,
          target: "'static",
          type: 'static_lifetime'
        });
      }
    }

    // 提取省略生命周期关系
    if (this.hasElidedLifetime(mainNode)) {
      const elided = this.extractElidedLifetimes(mainNode);
      for (const elision of elided) {
        relationships.push({
          source: elision.variable,
          target: 'elided',
          type: 'elided_lifetime'
        });
      }
    }

    return relationships;
  }

  /**
   * 提取生命周期信息
   */
  private extractLifecycleInfo(node: Parser.SyntaxNode): {
    operation: string;
    fromNodeId: string;
    toNodeId: string;
    lifetimeName?: string;
    lifetimeType: string;
    isStatic: boolean;
  } {
    if (this.hasLifetimeAnnotation(node)) {
      const annotations = this.extractLifetimeAnnotations(node);
      const firstAnnotation = annotations[0];
      
      return {
        operation: 'lifetime_annotation',
        fromNodeId: firstAnnotation ? this.generateDeterministicNodeIdFromString(firstAnnotation.variable) : 'unknown',
        toNodeId: firstAnnotation ? this.generateDeterministicNodeIdFromString(firstAnnotation.lifetime) : 'unknown',
        lifetimeName: firstAnnotation?.lifetime,
        lifetimeType: 'annotation',
        isStatic: firstAnnotation?.lifetime === "'static"
      };
    }

    if (this.hasLifetimeBound(node)) {
      const bounds = this.extractLifetimeBounds(node);
      const firstBound = bounds[0];
      
      return {
        operation: 'lifetime_bound',
        fromNodeId: firstBound ? this.generateDeterministicNodeIdFromString(firstBound.lifetime) : 'unknown',
        toNodeId: firstBound ? this.generateDeterministicNodeIdFromString(firstBound.bound) : 'unknown',
        lifetimeName: firstBound?.lifetime,
        lifetimeType: 'bound',
        isStatic: firstBound?.bound === "'static"
      };
    }

    if (this.hasStaticLifetime(node)) {
      return {
        operation: 'static_lifetime',
        fromNodeId: generateDeterministicNodeId(node),
        toNodeId: 'static',
        lifetimeName: "'static",
        lifetimeType: 'static',
        isStatic: true
      };
    }

    return {
      operation: 'unknown',
      fromNodeId: 'unknown',
      toNodeId: 'unknown',
      lifetimeType: 'unknown',
      isStatic: false
    };
  }

  /**
   * 判断是否有生命周期注解
   */
  private hasLifetimeAnnotation(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return /'[a-zA-Z]/.test(text);
  }

  /**
   * 提取生命周期注解
   */
  private extractLifetimeAnnotations(node: Parser.SyntaxNode): Array<{
    variable: string;
    lifetime: string;
    position: string;
  }> {
    const annotations: Array<{
      variable: string;
      lifetime: string;
      position: string;
    }> = [];

    // 查找函数参数中的生命周期注解
    if (node.type === 'function_item' || node.type === 'function_signature_item') {
      const parameters = node.childForFieldName('parameters');
      if (parameters) {
        this.extractLifetimeAnnotationsFromParameters(parameters, annotations);
      }
    }

    // 查找结构体字段中的生命周期注解
    if (node.type === 'struct_item') {
      const fields = node.childForFieldName('body');
      if (fields) {
        this.extractLifetimeAnnotationsFromFields(fields, annotations);
      }
    }

    // 查找枚举变体中的生命周期注解
    if (node.type === 'enum_item') {
      const variants = node.childForFieldName('body');
      if (variants) {
        this.extractLifetimeAnnotationsFromVariants(variants, annotations);
      }
    }

    // 查找impl块中的生命周期注解
    if (node.type === 'impl_item') {
      this.extractLifetimeAnnotationsFromImpl(node, annotations);
    }

    return annotations;
  }

  /**
   * 从参数中提取生命周期注解
   */
  private extractLifetimeAnnotationsFromParameters(
    parameters: Parser.SyntaxNode, 
    annotations: Array<{variable: string, lifetime: string, position: string}>
  ): void {
    for (const child of parameters.children || []) {
      if (child.type === 'parameter') {
        const paramType = child.childForFieldName('type');
        const paramName = child.childForFieldName('name');
        
        if (paramType?.text && paramName?.text) {
          const lifetimeMatches = paramType.text.match(/'([a-zA-Z]+)/g);
          if (lifetimeMatches) {
            for (const lifetime of lifetimeMatches) {
              annotations.push({
                variable: paramName.text,
                lifetime,
                position: 'parameter'
              });
            }
          }
        }
      }
    }
  }

  /**
   * 从字段中提取生命周期注解
   */
  private extractLifetimeAnnotationsFromFields(
    fields: Parser.SyntaxNode, 
    annotations: Array<{variable: string, lifetime: string, position: string}>
  ): void {
    for (const child of fields.children || []) {
      if (child.type === 'field_declaration') {
        const fieldName = child.childForFieldName('name');
        const fieldType = child.childForFieldName('type');
        
        if (fieldName?.text && fieldType?.text) {
          const lifetimeMatches = fieldType.text.match(/'([a-zA-Z]+)/g);
          if (lifetimeMatches) {
            for (const lifetime of lifetimeMatches) {
              annotations.push({
                variable: fieldName.text,
                lifetime,
                position: 'field'
              });
            }
          }
        }
      }
    }
  }

  /**
   * 从变体中提取生命周期注解
   */
  private extractLifetimeAnnotationsFromVariants(
    variants: Parser.SyntaxNode, 
    annotations: Array<{variable: string, lifetime: string, position: string}>
  ): void {
    for (const child of variants.children || []) {
      if (child.type === 'enum_variant') {
        const variantName = child.childForFieldName('name');
        const variantType = child.childForFieldName('type');
        
        if (variantName?.text && variantType?.text) {
          const lifetimeMatches = variantType.text.match(/'([a-zA-Z]+)/g);
          if (lifetimeMatches) {
            for (const lifetime of lifetimeMatches) {
              annotations.push({
                variable: variantName.text,
                lifetime,
                position: 'variant'
              });
            }
          }
        }
      }
    }
  }

  /**
   * 从impl块中提取生命周期注解
   */
  private extractLifetimeAnnotationsFromImpl(
    implNode: Parser.SyntaxNode, 
    annotations: Array<{variable: string, lifetime: string, position: string}>
  ): void {
    const typeNode = implNode.childForFieldName('type');
    const traitNode = implNode.childForFieldName('trait');
    
    if (typeNode?.text) {
      const lifetimeMatches = typeNode.text.match(/'([a-zA-Z]+)/g);
      if (lifetimeMatches) {
        for (const lifetime of lifetimeMatches) {
          annotations.push({
            variable: typeNode.text,
            lifetime,
            position: 'impl_type'
          });
        }
      }
    }
    
    if (traitNode?.text) {
      const lifetimeMatches = traitNode.text.match(/'([a-zA-Z]+)/g);
      if (lifetimeMatches) {
        for (const lifetime of lifetimeMatches) {
          annotations.push({
            variable: traitNode.text,
            lifetime,
            position: 'impl_trait'
          });
        }
      }
    }
  }

  /**
   * 判断是否有生命周期约束
   */
  private hasLifetimeBound(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes(': ') && /'[a-zA-Z]/.test(text);
  }

  /**
   * 提取生命周期约束
   */
  private extractLifetimeBounds(node: Parser.SyntaxNode): Array<{
    lifetime: string;
    bound: string;
  }> {
    const bounds: Array<{lifetime: string, bound: string}> = [];
    
    // 从where子句中提取生命周期约束
    if (node.type === 'where_clause') {
      for (const child of node.children || []) {
        if (child.type === 'where_predicate') {
          const bound = this.extractLifetimeBoundFromPredicate(child);
          if (bound) bounds.push(bound);
        }
      }
    }
    
    // 从泛型参数中提取生命周期约束
    if (node.type === 'type_parameters') {
      for (const child of node.children || []) {
        if (child.type === 'lifetime_parameter') {
          const bound = this.extractLifetimeBoundFromParameter(child);
          if (bound) bounds.push(bound);
        }
      }
    }
    
    return bounds;
  }

  /**
   * 从where谓词中提取生命周期约束
   */
  private extractLifetimeBoundFromPredicate(predicate: Parser.SyntaxNode): {
    lifetime: string;
    bound: string;
  } | null {
    const text = predicate.text || '';
    const match = text.match(/'([a-zA-Z]+)\s*:\s*([^,]+)/);
    
    if (match) {
      return {
        lifetime: `'${match[1]}`,
        bound: match[2].trim()
      };
    }
    
    return null;
  }

  /**
   * 从参数中提取生命周期约束
   */
  private extractLifetimeBoundFromParameter(parameter: Parser.SyntaxNode): {
    lifetime: string;
    bound: string;
  } | null {
    const text = parameter.text || '';
    const match = text.match(/'([a-zA-Z]+)(?::\s*([^>]+))?/);
    
    if (match) {
      return {
        lifetime: `'${match[1]}`,
        bound: match[2] ? match[2].trim() : "'static"
      };
    }
    
    return null;
  }

  /**
   * 判断是否有生命周期子类型关系
   */
  private hasLifetimeSubtyping(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes('where') && /'[a-zA-Z]/.test(text);
  }

  /**
   * 提取生命周期子类型关系
   */
  private extractLifetimeSubtypes(node: Parser.SyntaxNode): Array<{
    lifetime: string;
    supertype: string;
  }> {
    const subtypes: Array<{lifetime: string, supertype: string}> = [];
    
    // 简化实现：从where子句中提取子类型关系
    if (node.type === 'where_clause') {
      for (const child of node.children || []) {
        if (child.type === 'where_predicate') {
          const subtype = this.extractLifetimeSubtypeFromPredicate(child);
          if (subtype) subtypes.push(subtype);
        }
      }
    }
    
    return subtypes;
  }

  /**
   * 从where谓词中提取生命周期子类型关系
   */
  private extractLifetimeSubtypeFromPredicate(predicate: Parser.SyntaxNode): {
    lifetime: string;
    supertype: string;
  } | null {
    const text = predicate.text || '';
    const match = text.match(/'([a-zA-Z]+)\s*:\s*'([a-zA-Z]+)/);
    
    if (match) {
      return {
        lifetime: `'${match[1]}`,
        supertype: `'${match[2]}`
      };
    }
    
    return null;
  }

  /**
   * 判断是否有静态生命周期
   */
  private hasStaticLifetime(node: Parser.SyntaxNode): boolean {
    const text = node.text || '';
    return text.includes("'static");
  }

  /**
   * 提取静态生命周期引用
   */
  private extractStaticLifetimeReferences(node: Parser.SyntaxNode): Array<{
    variable: string;
  }> {
    const refs: Array<{variable: string}> = [];
    
    // 查找所有'static引用
    this.findStaticLifetimeReferences(node, refs);
    
    return refs;
  }

  /**
   * 递归查找静态生命周期引用
   */
  private findStaticLifetimeReferences(node: Parser.SyntaxNode, refs: Array<{variable: string}>): void {
    if (!node) return;
    
    const text = node.text || '';
    if (text.includes("'static")) {
      // 尝试提取关联的变量名
      const variable = this.extractVariableFromStaticReference(node);
      if (variable) {
        refs.push({ variable });
      }
    }
    
    for (const child of node.children || []) {
      this.findStaticLifetimeReferences(child, refs);
    }
  }

  /**
   * 从静态引用中提取变量名
   */
  private extractVariableFromStaticReference(node: Parser.SyntaxNode): string | null {
    // 简化实现：尝试从父节点中提取变量名
    let current = node.parent;
    while (current) {
      if (current.type === 'let_declaration') {
        const pattern = current.childForFieldName('pattern');
        return pattern?.text || null;
      }
      if (current.type === 'function_item') {
        const name = current.childForFieldName('name');
        return name?.text || null;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * 判断是否有省略的生命周期
   */
  private hasElidedLifetime(node: Parser.SyntaxNode): boolean {
    // 省略的生命周期通常出现在引用类型中，但没有显式标注
    const text = node.text || '';
    return (text.includes('&') && !text.includes("'")) || 
           (text.includes('str') && !text.includes("'static"));
  }

  /**
   * 提取省略的生命周期
   */
  private extractElidedLifetimes(node: Parser.SyntaxNode): Array<{
    variable: string;
  }> {
    const elided: Array<{variable: string}> = [];
    
    // 查找可能的省略生命周期
    this.findElidedLifetimes(node, elided);
    
    return elided;
  }

  /**
   * 递归查找省略的生命周期
   */
  private findElidedLifetimes(node: Parser.SyntaxNode, elided: Array<{variable: string}>): void {
    if (!node) return;
    
    // 检查引用类型但没有生命周期注解
    if (node.type === 'reference_expression' || 
        (node.type === 'type_identifier' && node.text === 'str')) {
      const variable = this.extractVariableFromElidedReference(node);
      if (variable) {
        elided.push({ variable });
      }
    }
    
    for (const child of node.children || []) {
      this.findElidedLifetimes(child, elided);
    }
  }

  /**
   * 从省略引用中提取变量名
   */
  private extractVariableFromElidedReference(node: Parser.SyntaxNode): string | null {
    if (node.type === 'reference_expression') {
      const valueNode = node.childForFieldName('value');
      return valueNode?.text || null;
    }
    
    if (node.type === 'type_identifier' && node.text === 'str') {
      return 'str';
    }
    
    return null;
  }

  /**
   * 从字符串生成确定性节点ID
   */
  private generateDeterministicNodeIdFromString(text: string): string {
    return `string:${text.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * 分析生命周期复杂性
   */
  private analyzeLifetimeComplexity(node: Parser.SyntaxNode): {
    hasExplicitLifetimes: boolean;
    hasStaticLifetimes: boolean;
    hasLifetimeBounds: boolean;
    hasElidedLifetimes: boolean;
    lifetimeCount: number;
  } {
    const text = node.text || '';
    const lifetimeMatches = text.match(/'([a-zA-Z]+)/g) || [];
    
    return {
      hasExplicitLifetimes: lifetimeMatches.length > 0,
      hasStaticLifetimes: text.includes("'static"),
      hasLifetimeBounds: text.includes(': ') && /'[a-zA-Z]/.test(text),
      hasElidedLifetimes: (text.includes('&') && !text.includes("'")) || 
                         (text.includes('str') && !text.includes("'static")),
      lifetimeCount: lifetimeMatches.length
    };
  }
}