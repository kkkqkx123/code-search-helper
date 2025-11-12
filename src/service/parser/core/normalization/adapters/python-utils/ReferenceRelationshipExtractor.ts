import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Python引用关系提取器
 * 处理变量引用、属性访问、成员访问等
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
        filePath: symbolTable?.filePath || 'current_file.py',
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
  private determineReferenceType(astNode: Parser.SyntaxNode): 'read' | 'write' | 'declaration' | 'usage' | 'attribute' | 'import' | null {
    const nodeType = astNode.type;
    const parentType = astNode.parent?.type;

    if (nodeType === 'identifier') {
      // 检查是否是赋值目标（写引用）
      if (parentType === 'assignment' && astNode.parent?.childForFieldName('left') === astNode) {
        return 'write';
      }
      // 检查是否是函数参数（声明）
      else if (parentType === 'parameters' || parentType === 'typed_parameter' || parentType === 'default_parameter') {
        return 'declaration';
      }
      // 检查是否是导入名称
      else if (parentType === 'import_statement' || parentType === 'import_from_statement') {
        return 'import';
      }
      // 检查是否是属性访问的一部分
      else if (parentType === 'attribute' && astNode.parent?.childForFieldName('object') === astNode) {
        return 'attribute';
      }
      // 默认为读引用
      else {
        return 'read';
      }
    } else if (nodeType === 'attribute') {
      return 'attribute';
    } else if (nodeType === 'subscript') {
      return 'read';
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
      toNodeId = NodeIdGenerator.forSymbol(referenceName, 'reference', 'current_file.py');
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取引用名称
   */
  private extractReferenceName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'identifier') {
      return astNode.text || null;
    } else if (astNode.type === 'attribute') {
      const attributeNode = astNode.childForFieldName('attribute');
      if (attributeNode?.type === 'identifier') {
        const objectNode = astNode.childForFieldName('object');
        const objectName = objectNode?.text || '';
        const attributeName = attributeNode.text || '';
        return `${objectName}.${attributeName}`;
      }
    } else if (astNode.type === 'subscript') {
      const valueNode = astNode.childForFieldName('value');
      if (valueNode?.text) {
        return `${valueNode.text}[]`;
      }
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

    if (astNode.type === 'attribute') {
      referenceInfo.isAttributeAccess = true;
      referenceInfo.objectName = this.extractObjectName(astNode);
      referenceInfo.attributeName = this.extractAttributeName(astNode);
    }

    if (astNode.type === 'subscript') {
      referenceInfo.isSubscriptAccess = true;
      referenceInfo.collectionName = this.extractCollectionName(astNode);
      referenceInfo.indexExpression = this.extractIndexExpression(astNode);
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
      if (current.type === 'function_definition' || current.type === 'async_function_definition') {
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
    // 简化实现：检查是否有global声明
    let current = astNode.parent;
    while (current) {
      if (current.type === 'global_statement') {
        return true;
      }
      current = current.parent;
    }
    return false;
  }

  /**
   * 判断是否为内置引用
   */
  private isBuiltinReference(astNode: Parser.SyntaxNode): boolean {
    const builtinFunctions = [
      'abs', 'all', 'any', 'bin', 'bool', 'bytearray', 'bytes', 'callable',
      'chr', 'classmethod', 'compile', 'complex', 'delattr', 'dict', 'dir',
      'divmod', 'enumerate', 'eval', 'exec', 'filter', 'float', 'format',
      'frozenset', 'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex',
      'id', 'input', 'int', 'isinstance', 'issubclass', 'iter', 'len',
      'list', 'locals', 'map', 'max', 'memoryview', 'min', 'next', 'object',
      'oct', 'open', 'ord', 'pow', 'print', 'property', 'range', 'repr',
      'reversed', 'round', 'set', 'setattr', 'slice', 'sorted', 'staticmethod',
      'str', 'sum', 'super', 'tuple', 'type', 'vars', 'zip'
    ];

    const builtinTypes = [
      'bool', 'int', 'float', 'complex', 'str', 'bytes', 'bytearray',
      'list', 'tuple', 'range', 'dict', 'set', 'frozenset', 'object',
      'None', 'NotImplemented', 'Ellipsis'
    ];

    const referenceName = this.extractReferenceName(astNode);
    if (!referenceName) return false;

    const baseName = referenceName.split('.')[0]; // 处理属性访问
    return builtinFunctions.includes(baseName) || builtinTypes.includes(baseName);
  }

  /**
   * 确定作用域
   */
  private determineScope(astNode: Parser.SyntaxNode): 'global' | 'function' | 'class' | 'method' {
    let current = astNode.parent;
    while (current) {
      if (current.type === 'function_definition' || current.type === 'async_function_definition') {
        // 检查是否在类内部（方法）
        let parent = current.parent;
        while (parent) {
          if (parent.type === 'class_definition') {
            return 'method';
          }
          parent = parent.parent;
        }
        return 'function';
      } else if (current.type === 'class_definition') {
        return 'class';
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

    if (parent.type === 'call') {
      return 'function_call';
    } else if (parent.type === 'assignment') {
      return 'assignment';
    } else if (parent.type === 'attribute') {
      return 'attribute_access';
    } else if (parent.type === 'subscript') {
      return 'subscript_access';
    } else if (parent.type === 'import_statement' || parent.type === 'import_from_statement') {
      return 'import';
    } else if (parent.type === 'for_statement') {
      return 'loop';
    } else if (parent.type === 'if_statement' || parent.type === 'while_statement') {
      return 'condition';
    }

    return 'expression';
  }

  /**
   * 提取对象名称
   */
  private extractObjectName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'attribute') {
      const objectNode = astNode.childForFieldName('object');
      return objectNode?.text || null;
    }
    return null;
  }

  /**
   * 提取属性名称
   */
  private extractAttributeName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'attribute') {
      const attributeNode = astNode.childForFieldName('attribute');
      return attributeNode?.text || null;
    }
    return null;
  }

  /**
   * 提取集合名称
   */
  private extractCollectionName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'subscript') {
      const valueNode = astNode.childForFieldName('value');
      return valueNode?.text || null;
    }
    return null;
  }

  /**
   * 提取索引表达式
   */
  private extractIndexExpression(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'subscript') {
      const subscriptNode = astNode.childForFieldName('subscript');
      return subscriptNode?.text || null;
    }
    return null;
  }

  /**
   * 判断是否为引用关系节点
   */
  private isReferenceNode(astNode: Parser.SyntaxNode): boolean {
    const referenceNodeTypes = [
      'identifier',
      'attribute',
      'subscript'
    ];

    return referenceNodeTypes.includes(astNode.type);
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }

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
   * 查找属性访问
   */
  findAttributeAccesses(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const attributeAccesses: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'attribute') {
        attributeAccesses.push(node);
      }
    });

    return attributeAccesses;
  }

  /**
   * 查找下标访问
   */
  findSubscriptAccesses(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const subscriptAccesses: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'subscript') {
        subscriptAccesses.push(node);
      }
    });

    return subscriptAccesses;
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
    const attributeAccesses = this.findAttributeAccesses(ast);
    const subscriptAccesses = this.findSubscriptAccesses(ast);

    // 处理标识符引用
    for (const identifier of identifierReferences) {
      const referenceType = this.determineReferenceType(identifier);
      const referenceName = this.extractReferenceName(identifier);
      const referenceInfo = this.extractReferenceInfo(identifier);

      if (referenceType && referenceName) {
        references.push({
          sourceId: NodeIdGenerator.forAstNode(identifier),
          targetId: NodeIdGenerator.forSymbol(referenceName, 'reference', filePath),
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

    // 处理属性访问
    for (const attribute of attributeAccesses) {
      const referenceType = this.determineReferenceType(attribute);
      const referenceName = this.extractReferenceName(attribute);
      const referenceInfo = this.extractReferenceInfo(attribute);

      if (referenceType && referenceName) {
        references.push({
          sourceId: NodeIdGenerator.forAstNode(attribute),
          targetId: NodeIdGenerator.forSymbol(referenceName, 'reference', filePath),
          referenceType,
          referenceName,
          referenceInfo,
          location: {
            filePath,
            lineNumber: attribute.startPosition.row + 1,
            columnNumber: attribute.startPosition.column + 1
          }
        });
      }
    }

    // 处理下标访问
    for (const subscript of subscriptAccesses) {
      const referenceType = this.determineReferenceType(subscript);
      const referenceName = this.extractReferenceName(subscript);
      const referenceInfo = this.extractReferenceInfo(subscript);

      if (referenceType && referenceName) {
        references.push({
          sourceId: NodeIdGenerator.forAstNode(subscript),
          targetId: NodeIdGenerator.forSymbol(referenceName, 'reference', filePath),
          referenceType,
          referenceName,
          referenceInfo,
          location: {
            filePath,
            lineNumber: subscript.startPosition.row + 1,
            columnNumber: subscript.startPosition.column + 1
          }
        });
      }
    }

    return references;
  }
}