import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Rust引用关系提取器
 * 处理变量引用、字段访问、模块引用等
 */
export class ReferenceRelationshipExtractor {
  /**
   * 提取引用关系元数据
   */
  extractReferenceMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const referenceType = this.determineReferenceType(astNode);

    if (!referenceType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractReferenceNodes(astNode, referenceType);
    const referenceName = this.extractReferenceName(astNode);
    const referenceInfo = this.extractReferenceInfo(astNode);

    return {
      type: 'reference',
      fromNodeId,
      toNodeId,
      referenceType,
      referenceName,
      referenceInfo,
      location: {
        filePath: symbolTable?.filePath || 'current_file.rs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取引用关系数组
   */
  extractReferenceRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为引用相关的节点类型
    if (!this.isReferenceNode(astNode)) {
      return relationships;
    }

    const referenceMetadata = this.extractReferenceMetadata(result, astNode, null);
    if (referenceMetadata) {
      relationships.push(referenceMetadata);
    }

    return relationships;
  }

  /**
   * 确定引用类型
   */
  private determineReferenceType(astNode: Parser.SyntaxNode): 'read' | 'write' | 'declaration' | 'usage' | 'field' | 'method' | 'module' | 'type' | null {
    const nodeType = astNode.type;
    const parentType = astNode.parent?.type;

    if (nodeType === 'identifier') {
      // 检查是否是赋值目标（写引用）
      if (parentType === 'let_declaration' && this.isChildOfField(astNode.parent, 'pattern', astNode)) {
        return 'declaration';
      } else if (parentType === 'assignment_expression' && this.isChildOfField(astNode.parent, 'left', astNode)) {
        return 'write';
      }
      // 检查是否是函数参数（声明）
      else if (parentType === 'parameters' || parentType === 'parameter') {
        return 'declaration';
      }
      // 检查是否是模块引用
      else if (parentType === 'scoped_identifier' && this.isChildOfField(astNode.parent, 'path', astNode)) {
        return 'module';
      }
      // 检查是否是类型引用
      else if (parentType === 'type_identifier' || parentType === 'scoped_type_identifier') {
        return 'type';
      }
      // 默认为读引用
      else {
        return 'read';
      }
    } else if (nodeType === 'field_expression') {
      return 'field';
    } else if (nodeType === 'method_call_expression') {
      return 'method';
    } else if (nodeType === 'scoped_identifier') {
      return 'module';
    } else if (nodeType === 'type_identifier' || nodeType === 'scoped_type_identifier') {
      return 'type';
    }

    return null;
  }

  /**
   * 提取引用关系的节点
   */
  private extractReferenceNodes(astNode: Parser.SyntaxNode, referenceType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = NodeIdGenerator.forAstNode(astNode);
    let toNodeId = 'unknown';

    const referenceName = this.extractReferenceName(astNode);
    if (referenceName) {
      toNodeId = NodeIdGenerator.forSymbol(referenceName, 'reference', 'current_file.rs', astNode.startPosition.row);
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取引用名称
   */
  private extractReferenceName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'identifier') {
      return astNode.text || null;
    } else if (astNode.type === 'field_expression') {
      const fieldNode = astNode.childForFieldName('field');
      const valueNode = astNode.childForFieldName('value');
      if (fieldNode?.type === 'field_identifier' && valueNode?.text) {
        return `${valueNode.text}.${fieldNode.text}`;
      }
    } else if (astNode.type === 'method_call_expression') {
      const methodNode = astNode.childForFieldName('method');
      const objectNode = astNode.childForFieldName('object');
      if (methodNode?.type === 'identifier' && objectNode?.text) {
        return `${objectNode.text}.${methodNode.text}`;
      }
    } else if (astNode.type === 'scoped_identifier') {
      return astNode.text || null;
    } else if (astNode.type === 'type_identifier' || astNode.type === 'scoped_type_identifier') {
      return astNode.text || null;
    }

    return null;
  }

  /**
   * 提取引用信息
   */
  private extractReferenceInfo(astNode: Parser.SyntaxNode): any {
    const referenceInfo: any = {};
    const referenceType = this.determineReferenceType(astNode);

    referenceInfo.referenceType = referenceType;
    referenceInfo.isLocal = this.isLocalReference(astNode);
    referenceInfo.isGlobal = this.isGlobalReference(astNode);
    referenceInfo.isBuiltin = this.isBuiltinReference(astNode);
    referenceInfo.scope = this.determineScope(astNode);
    referenceInfo.context = this.determineContext(astNode);
    referenceInfo.isMutable = this.isMutableReference(astNode);
    referenceInfo.isReference = this.isReferenceType(astNode);
    referenceInfo.isRawPointer = this.isRawPointer(astNode);

    if (astNode.type === 'field_expression') {
      referenceInfo.isFieldAccess = true;
      referenceInfo.objectName = this.extractObjectName(astNode);
      referenceInfo.fieldName = this.extractFieldName(astNode);
    }

    if (astNode.type === 'method_call_expression') {
      referenceInfo.isMethodCall = true;
      referenceInfo.objectName = this.extractMethodObjectName(astNode);
      referenceInfo.methodName = this.extractMethodName(astNode);
    }

    if (astNode.type === 'scoped_identifier') {
      referenceInfo.isScopedReference = true;
      referenceInfo.pathComponents = this.extractPathComponents(astNode);
    }

    return referenceInfo;
  }

  /**
   * 判断是否为本地引用
   */
  private isLocalReference(astNode: Parser.SyntaxNode): boolean {
    // 简化实现：检查是否在函数内部
    let current = astNode.parent;
    while (current) {
      if (current.type === 'function_item' || current.type === 'async_function') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 判断是否为全局引用
   */
  private isGlobalReference(astNode: Parser.SyntaxNode): boolean {
    // 简化实现：检查是否在模块级别
    let current = astNode.parent;
    while (current) {
      if (current.type === 'source_file') {
        return true;
      }
      if (current.type === 'function_item' || current.type === 'async_function' || 
          current.type === 'impl_item' || current.type === 'trait_item') {
        return false;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 判断是否为内置引用
   */
  private isBuiltinReference(astNode: Parser.SyntaxNode): boolean {
    const builtinTypes = [
      'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
      'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
      'f32', 'f64', 'bool', 'char', 'str', 'String',
      'Box', 'Vec', 'HashMap', 'HashSet', 'Option', 'Result',
      'Some', 'None', 'Ok', 'Err', 'Self', 'self'
    ];

    const builtinFunctions = [
      'print', 'println', 'eprint', 'eprintln', 'format', 'panic',
      'assert', 'debug_assert', 'unreachable', 'todo', 'unimplemented'
    ];

    const referenceName = this.extractReferenceName(astNode);
    if (!referenceName) return false;

    const baseName = referenceName.split('::').pop(); // 处理作用域标识符
    return baseName ? (builtinTypes.includes(baseName) || builtinFunctions.includes(baseName)) : false;
  }

  /**
   * 确定作用域
   */
  private determineScope(astNode: Parser.SyntaxNode): 'global' | 'function' | 'impl' | 'trait' | 'module' {
    let current = astNode.parent;
    while (current) {
      if (current.type === 'function_item' || current.type === 'async_function') {
        // 检查是否在impl或trait内部
        let parent = current.parent;
        while (parent) {
          if (parent.type === 'impl_item') {
            return 'impl';
          } else if (parent.type === 'trait_item') {
            return 'trait';
          }
          parent = parent.parent;
        }
        return 'function';
      } else if (current.type === 'impl_item') {
        return 'impl';
      } else if (current.type === 'trait_item') {
        return 'trait';
      } else if (current.type === 'mod_item') {
        return 'module';
      }
      current = current.parent;
    }
    return 'global';
  }

  /**
   * 确定上下文
   */
  private determineContext(astNode: Parser.SyntaxNode): string {
    const parent = astNode.parent;
    if (!parent) return 'unknown';

    if (parent.type === 'call_expression' || parent.type === 'method_call_expression') {
      return 'function_call';
    } else if (parent.type === 'assignment_expression') {
      return 'assignment';
    } else if (parent.type === 'field_expression') {
      return 'field_access';
    } else if (parent.type === 'let_declaration') {
      return 'declaration';
    } else if (parent.type === 'match_expression' || parent.type === 'match_arm') {
      return 'pattern_matching';
    } else if (parent.type === 'if_expression' || parent.type === 'while_expression' || 
               parent.type === 'for_expression' || parent.type === 'loop_expression') {
      return 'control_flow';
    } else if (parent.type === 'return_expression') {
      return 'return';
    }

    return 'expression';
  }

  /**
   * 判断是否为可变引用
   */
  private isMutableReference(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';
    const parent = astNode.parent;
    
    // 检查是否有mut关键字
    if (parent?.type === 'let_declaration' && parent.text?.includes('mut')) {
      return true;
    }
    
    // 检查是否是可变引用
    if (text.includes('&mut')) {
      return true;
    }
    
    return false;
  }

  /**
   * 判断是否为引用类型
   */
  private isReferenceType(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';
    return text.includes('&') && !text.includes('&mut');
  }

  /**
   * 判断是否为原始指针
   */
  private isRawPointer(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';
    return text.includes('*const') || text.includes('*mut');
  }

  /**
   * 提取对象名称
   */
  private extractObjectName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'field_expression') {
      const valueNode = astNode.childForFieldName('value');
      return valueNode?.text || null;
    }
    return null;
  }

  /**
   * 提取字段名称
   */
  private extractFieldName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'field_expression') {
      const fieldNode = astNode.childForFieldName('field');
      return fieldNode?.text || null;
    }
    return null;
  }

  /**
   * 提取方法对象名称
   */
  private extractMethodObjectName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'method_call_expression') {
      const objectNode = astNode.childForFieldName('object');
      return objectNode?.text || null;
    }
    return null;
  }

  /**
   * 提取方法名称
   */
  private extractMethodName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'method_call_expression') {
      const methodNode = astNode.childForFieldName('method');
      return methodNode?.text || null;
    }
    return null;
  }

  /**
   * 提取路径组件
   */
  private extractPathComponents(astNode: Parser.SyntaxNode): string[] {
    if (astNode.type === 'scoped_identifier') {
      return astNode.text?.split('::') || [];
    }
    return [];
  }

  /**
   * 判断是否为引用关系节点
   */
  private isReferenceNode(astNode: Parser.SyntaxNode): boolean {
    const referenceNodeTypes = [
      'identifier',
      'field_expression',
      'method_call_expression',
      'scoped_identifier',
      'type_identifier',
      'scoped_type_identifier'
    ];

    return referenceNodeTypes.includes(astNode.type);
  }

  /**
   * 生成节点ID
   */

  /**
   * 查找标识符引用
   */
  findIdentifierReferences(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const identifierReferences: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'identifier') {
        identifierReferences.push(node);
      }
    });

    return identifierReferences;
  }

  /**
   * 查找字段访问
   */
  findFieldAccesses(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const fieldAccesses: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'field_expression') {
        fieldAccesses.push(node);
      }
    });

    return fieldAccesses;
  }

  /**
   * 查找方法调用
   */
  findMethodCalls(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const methodCalls: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'method_call_expression') {
        methodCalls.push(node);
      }
    });

    return methodCalls;
  }

  /**
   * 查找作用域标识符
   */
  findScopedIdentifiers(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const scopedIdentifiers: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'scoped_identifier') {
        scopedIdentifiers.push(node);
      }
    });

    return scopedIdentifiers;
  }

  /**
   * 遍历AST树
   */
  private traverseTree(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void): void {
    callback(node);

    if (node.children) {
      for (const child of node.children) {
        this.traverseTree(child, callback);
      }
    }
  }

  /**
   * 分析引用关系
   */
  analyzeReferences(ast: Parser.SyntaxNode, filePath: string): Array<{
    sourceId: string;
    targetId: string;
    referenceType: string;
    referenceName: string;
    referenceInfo: any;
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const references: Array<any> = [];
    const identifierReferences = this.findIdentifierReferences(ast);
    const fieldAccesses = this.findFieldAccesses(ast);
    const methodCalls = this.findMethodCalls(ast);
    const scopedIdentifiers = this.findScopedIdentifiers(ast);

    // 处理标识符引用
    for (const identifier of identifierReferences) {
      const referenceType = this.determineReferenceType(identifier);
      const referenceName = this.extractReferenceName(identifier);
      const referenceInfo = this.extractReferenceInfo(identifier);

      if (referenceType && referenceName) {
        references.push({
          sourceId: NodeIdGenerator.forAstNode(identifier),
          targetId: NodeIdGenerator.forSymbol(referenceName, 'reference', filePath, identifier.startPosition.row + 1),
          referenceType,
          referenceName,
          referenceInfo,
          location: {
            filePath,
            lineNumber: identifier.startPosition.row + 1,
            columnNumber: identifier.startPosition.column + 1
          }
        });
      }
    }

    // 处理字段访问
    for (const fieldAccess of fieldAccesses) {
      const referenceType = this.determineReferenceType(fieldAccess);
      const referenceName = this.extractReferenceName(fieldAccess);
      const referenceInfo = this.extractReferenceInfo(fieldAccess);

      if (referenceType && referenceName) {
        references.push({
          sourceId: NodeIdGenerator.forAstNode(fieldAccess),
          targetId: NodeIdGenerator.forSymbol(referenceName, 'reference', filePath, fieldAccess.startPosition.row + 1),
          referenceType,
          referenceName,
          referenceInfo,
          location: {
            filePath,
            lineNumber: fieldAccess.startPosition.row + 1,
            columnNumber: fieldAccess.startPosition.column + 1
          }
        });
      }
    }

    // 处理方法调用
    for (const methodCall of methodCalls) {
      const referenceType = this.determineReferenceType(methodCall);
      const referenceName = this.extractReferenceName(methodCall);
      const referenceInfo = this.extractReferenceInfo(methodCall);

      if (referenceType && referenceName) {
        references.push({
          sourceId: NodeIdGenerator.forAstNode(methodCall),
          targetId: NodeIdGenerator.forSymbol(referenceName, 'reference', filePath, methodCall.startPosition.row + 1),
          referenceType,
          referenceName,
          referenceInfo,
          location: {
            filePath,
            lineNumber: methodCall.startPosition.row + 1,
            columnNumber: methodCall.startPosition.column + 1
          }
        });
      }
    }

    // 处理作用域标识符
    for (const scopedIdentifier of scopedIdentifiers) {
      const referenceType = this.determineReferenceType(scopedIdentifier);
      const referenceName = this.extractReferenceName(scopedIdentifier);
      const referenceInfo = this.extractReferenceInfo(scopedIdentifier);

      if (referenceType && referenceName) {
        references.push({
          sourceId: NodeIdGenerator.forAstNode(scopedIdentifier),
          targetId: NodeIdGenerator.forSymbol(referenceName, 'reference', filePath, scopedIdentifier.startPosition.row + 1),
          referenceType,
          referenceName,
          referenceInfo,
          location: {
            filePath,
            lineNumber: scopedIdentifier.startPosition.row + 1,
            columnNumber: scopedIdentifier.startPosition.column + 1
          }
        });
      }
    }

    return references;
  }

  /**
   * 检查节点是否是指定字段的子节点
   */
  private isChildOfField(parent: Parser.SyntaxNode | null, fieldName: string, child: Parser.SyntaxNode): boolean {
    if (!parent) return false;
    
    const fieldChild = parent.childForFieldName(fieldName);
    if (!fieldChild) return false;
    
    // 如果字段子节点是数组，检查是否包含目标节点
    if (Array.isArray(fieldChild)) {
      return fieldChild.includes(child);
    }
    
    // 如果字段子节点是单个节点，检查是否等于目标节点
    return fieldChild === child;
  }
}