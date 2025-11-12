import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { GoHelperMethods } from './GoHelperMethods';
import Parser from 'tree-sitter';

/**
 * Go引用关系提取器
 * 处理变量引用、函数调用、类型引用等引用关系
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
    const target = this.extractTarget(astNode);
    const referenceKind = this.determineReferenceKind(astNode);
    const scopeInfo = this.extractScopeInfo(astNode);

    return {
      type: 'reference',
      fromNodeId,
      toNodeId,
      referenceType,
      referenceKind,
      target,
      scopeInfo,
      location: {
        filePath: symbolTable?.filePath || 'current_file.go',
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
  private determineReferenceType(astNode: Parser.SyntaxNode): 'variable' | 'function' | 'type' | 'field' | null {
    const nodeType = astNode.type;

    if (nodeType === 'identifier') {
      // 需要根据上下文来确定引用类型
      return this.determineIdentifierReferenceType(astNode);
    } else if (nodeType === 'field_identifier') {
      return 'field';
    } else if (nodeType === 'type_identifier') {
      return 'type';
    } else if (nodeType === 'parameter_declaration') {
      return 'variable';
    }

    return null;
  }

  /**
  * 根据上下文确定标识符引用类型
  */
  private determineIdentifierReferenceType(identifierNode: Parser.SyntaxNode): 'variable' | 'function' | 'type' | 'field' | null {
    // 检查父节点类型来确定标识符的上下文
    const parent = identifierNode.parent;
    if (!parent) return 'variable'; // 默认为变量引用

    if (parent.type === 'call_expression' && parent.children[0] === identifierNode) {
      // 如果是调用表达式的第一个子节点，这是函数调用
      return 'function';
    } else if (parent.type === 'short_var_declaration' || parent.type === 'var_declaration') {
      // 在变量声明中，这是变量定义
      return 'variable';
    } else if (parent.type === 'type_declaration') {
      // 在类型声明中，这是类型定义
      return 'type';
    } else if (parent.type === 'parameter_declaration') {
      // 在参数声明中，这是参数定义，视为变量
      return 'variable';
    } else if (parent.type === 'field_declaration') {
      // 在字段声明中，这可能是字段名
      return 'field';
    } else if (parent.type === 'expression_statement' || parent.type === 'assignment_statement') {
      // 在表达式或赋值语句中，这可能是变量使用
      return 'variable';
    }

    return 'variable'; // 默认
  }

  /**
  * 确定引用种类
  */
  private determineReferenceKind(astNode: Parser.SyntaxNode): 'read' | 'write' | 'declaration' {
    if (astNode.parent) {
      if (astNode.parent.type === 'short_var_declaration' ||
        astNode.parent.type === 'var_declaration' ||
        astNode.parent.type === 'parameter_declaration' ||
        astNode.parent.type === 'field_declaration') {
        return 'declaration';
      } else if (astNode.parent.type === 'assignment_statement' &&
        astNode.parent.children[0]?.type === 'identifier' &&
        astNode.parent.children[0] === astNode) {
        // 在赋值语句的左侧，这是写操作
        return 'write';
      } else {
        // 其他情况通常为读操作
        return 'read';
      }
    }
    return 'read';
  }

  /**
   * 提取引用关系的节点
   */
  private extractReferenceNodes(astNode: Parser.SyntaxNode, referenceType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = NodeIdGenerator.forAstNode(GoHelperMethods.findContainingFunction(astNode) || astNode);
    let toNodeId = NodeIdGenerator.forAstNode(astNode);

    // 根据引用类型确定节点关系
    if (referenceType === 'function') {
      // 对于函数引用，目标节点是函数本身，源是引用位置
      const functionDecl = GoHelperMethods.findParentFunctionDeclaration(astNode);
      if (functionDecl) {
        toNodeId = NodeIdGenerator.forAstNode(functionDecl);
      }
    } else if (referenceType === 'variable') {
      // 对于变量引用，找到对应的变量声明
      const varDecl = GoHelperMethods.findVariableDeclaration(astNode);
      if (varDecl) {
        toNodeId = NodeIdGenerator.forAstNode(varDecl);
      }
    } else if (referenceType === 'type') {
      // 对于类型引用，找到对应的类型声明
      const typeDecl = GoHelperMethods.findTypeDeclaration(astNode);
      if (typeDecl) {
        toNodeId = NodeIdGenerator.forAstNode(typeDecl);
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取目标
   */
  private extractTarget(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'identifier' || astNode.type === 'field_identifier' || astNode.type === 'type_identifier') {
      return astNode.text || null;
    }

    // 检查是否有标识符类型的子节点
    for (const child of astNode.children) {
      if (child.type === 'identifier' || child.type === 'field_identifier' || child.type === 'type_identifier') {
        return child.text || null;
      }
    }

    return null;
  }

  /**
   * 提取作用域信息
   */
  private extractScopeInfo(astNode: Parser.SyntaxNode): any {
    const containingFunction = GoHelperMethods.findContainingFunction(astNode);
    const containingBlock = GoHelperMethods.findContainingBlock(astNode);

    return {
      function: containingFunction ? GoHelperMethods.extractNameFromNode(containingFunction) : null,
      block: containingBlock ? containingBlock.type : null,
      scopeDepth: this.calculateScopeDepth(astNode)
    };
  }

  /**
   * 计算作用域深度
   */
  private calculateScopeDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node.parent;

    while (current) {
      if (current.type === 'function_declaration' || current.type === 'block') {
        depth++;
      }
      current = current.parent;
    }

    return depth;
  }

  /**
   * 判断是否为引用关系节点
   */
  private isReferenceNode(astNode: Parser.SyntaxNode): boolean {
    const referenceNodeTypes = [
      'identifier',
      'field_identifier',
      'type_identifier',
      'parameter_declaration',
      'expression_statement',
      'assignment_statement',
      'call_expression'
    ];

    return referenceNodeTypes.includes(astNode.type);
  }

  /**
  * 提取标识符引用信息
  */
  extractIdentifierInfo(identifierNode: Parser.SyntaxNode): {
    name: string;
    type: string;
    kind: 'read' | 'write' | 'declaration';
    scope: string | null;
  } | null {
    const name = identifierNode.text || '';
    if (!name) return null;

    const type = this.determineIdentifierReferenceType(identifierNode) || 'variable';
    const kind = this.determineReferenceKind(identifierNode);
    const scope = GoHelperMethods.findContainingFunction(identifierNode)?.text || null;

    return {
      name,
      type,
      kind,
      scope
    };
  }

  /**
   * 查找变量引用
   */
  findVariableReferences(ast: Parser.SyntaxNode): Array<{
    node: Parser.SyntaxNode;
    name: string;
    kind: 'read' | 'write' | 'declaration';
    location: { row: number; column: number }
  }> {
    const references: Array<{
      node: Parser.SyntaxNode;
      name: string;
      kind: 'read' | 'write' | 'declaration';
      location: { row: number; column: number }
    }> = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'identifier') {
        const context = this.determineIdentifierReferenceType(node);
        if (context === 'variable' || context === 'function' || context === 'type') {
          references.push({
            node,
            name: node.text || '',
            kind: this.determineReferenceKind(node),
            location: {
              row: node.startPosition.row,
              column: node.startPosition.column
            }
          });
        }
      }
    });

    return references;
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
    referenceKind: string;
    target: string;
    scopeInfo: any;
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const references: Array<any> = [];
    const identifierNodes: Parser.SyntaxNode[] = [];

    // 收集所有相关的标识符节点
    this.traverseTree(ast, (node) => {
      if (this.isReferenceNode(node)) {
        identifierNodes.push(node);
      }
    });

    // 处理每个标识符节点
    for (const identifierNode of identifierNodes) {
      const referenceMetadata = this.extractReferenceMetadata(
        { captures: [{ node: identifierNode }] },
        identifierNode,
        { filePath }
      );

      if (referenceMetadata) {
        references.push({
          sourceId: referenceMetadata.fromNodeId,
          targetId: referenceMetadata.toNodeId,
          referenceType: referenceMetadata.referenceType,
          referenceKind: referenceMetadata.referenceKind,
          target: referenceMetadata.target,
          scopeInfo: referenceMetadata.scopeInfo,
          location: referenceMetadata.location
        });
      }
    }

    return references;
  }
}