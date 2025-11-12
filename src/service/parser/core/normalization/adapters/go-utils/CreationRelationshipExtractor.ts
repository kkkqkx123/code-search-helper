import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { GoHelperMethods } from './GoHelperMethods';
import Parser from 'tree-sitter';

/**
 * Go创建关系提取器
 * 处理Go中的对象创建、复合字面量、make/new调用等创建关系
 */
export class CreationRelationshipExtractor {
  /**
   * 提取创建关系元数据
   */
  extractCreationMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const creationType = this.determineCreationType(astNode);

    if (!creationType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractCreationNodes(astNode, creationType);
    const target = this.extractTarget(astNode);
    const creationKind = this.determineCreationKind(astNode);
    const creationDetails = this.extractCreationDetails(astNode);

    return {
      type: 'creation',
      fromNodeId,
      toNodeId,
      creationType,
      creationKind,
      target,
      creationDetails,
      location: {
        filePath: symbolTable?.filePath || 'current_file.go',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取创建关系数组
   */
  extractCreationRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为创建相关的节点类型
    if (!this.isCreationNode(astNode)) {
      return relationships;
    }

    const creationMetadata = this.extractCreationMetadata(result, astNode, null);
    if (creationMetadata) {
      relationships.push(creationMetadata);
    }

    return relationships;
  }

  /**
   * 确定创建类型
   */
  private determineCreationType(astNode: Parser.SyntaxNode): 'composite_literal' | 'make_call' | 'new_call' | 'function_literal' | 'goroutine' | null {
    const nodeType = astNode.type;

    if (nodeType === 'composite_literal') {
      return 'composite_literal';
    } else if (nodeType === 'call_expression') {
      const funcName = this.extractFunctionName(astNode);
      if (funcName === 'make') {
        return 'make_call';
      } else if (funcName === 'new') {
        return 'new_call';
      }
    } else if (nodeType === 'func_literal') {
      return 'function_literal';
    } else if (nodeType === 'go_statement') {
      return 'goroutine';
    }

    return null;
  }

  /**
   * 确定创建种类
   */
  private determineCreationKind(astNode: Parser.SyntaxNode): 'struct_instance' | 'slice' | 'map' | 'channel' | 'function' | 'goroutine_instance' {
    const creationType = this.determineCreationType(astNode);

    if (creationType === 'composite_literal') {
      // 检查复合字面量的类型
      const typeNode = this.getCompositeLiteralType(astNode);
      if (typeNode) {
        if (typeNode.type === 'struct_type') {
          return 'struct_instance';
        } else if (typeNode.type === 'slice_type' || typeNode.type === 'array_type') {
          return 'slice';
        } else if (typeNode.type === 'map_type') {
          return 'map';
        }
      }
      return 'struct_instance'; // 默认
    } else if (creationType === 'make_call') {
      const args = this.getCallArguments(astNode);
      if (args.length > 0) {
        const typeArg = args[0];
        if (typeArg.type === 'slice_type') {
          return 'slice';
        } else if (typeArg.type === 'map_type') {
          return 'map';
        } else if (typeArg.type === 'channel_type') {
          return 'channel';
        }
      }
      return 'slice'; // 默认
    } else if (creationType === 'new_call') {
      return 'struct_instance'; // new通常用于创建指针
    } else if (creationType === 'function_literal') {
      return 'function';
    } else if (creationType === 'goroutine') {
      return 'goroutine_instance';
    }

    return 'struct_instance'; // 默认
  }

  /**
   * 提取创建关系的节点
   */
  private extractCreationNodes(astNode: Parser.SyntaxNode, creationType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = NodeIdGenerator.forAstNode(GoHelperMethods.findContainingFunction(astNode) || astNode);
    let toNodeId = NodeIdGenerator.forAstNode(astNode);

    // 对于创建操作，from是创建者，to是被创建的对象
    // 在这个情况下，astNode就是被创建的对象，所以toNodeId是它本身
    // fromNodeId是创建上下文的节点（通常是包含函数）

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取目标
   */
  private extractTarget(astNode: Parser.SyntaxNode): string | null {
    const creationType = this.determineCreationType(astNode);

    if (creationType === 'composite_literal') {
      const typeNode = this.getCompositeLiteralType(astNode);
      if (typeNode) {
        return this.getTypeName(typeNode);
      }
    } else if (creationType === 'make_call' || creationType === 'new_call') {
      const funcName = this.extractFunctionName(astNode);
      const args = this.getCallArguments(astNode);
      if (args.length > 0 && args[0]) {
        return this.getTypeName(args[0]);
      }
      return funcName || 'unknown';
    } else if (creationType === 'function_literal') {
      // 对于函数字面量，返回"function literal"
      return 'function_literal';
    } else if (creationType === 'goroutine') {
      // 对于goroutine，返回调用的目标
      if (astNode.children.length > 0) {
        const callExpr = astNode.children[0]; // go语句的第一个子节点应该是调用表达式
        if (callExpr.type === 'call_expression') {
          return this.extractFunctionName(callExpr);
        }
      }
    }

    return astNode.type;
  }

  /**
   * 提取创建详情
   */
  private extractCreationDetails(astNode: Parser.SyntaxNode): any {
    const creationType = this.determineCreationType(astNode);

    if (creationType === 'composite_literal') {
      const compositeType = this.getCompositeLiteralType(astNode);
      return {
        type: compositeType ? this.getTypeName(compositeType) : 'unknown',
        fields: this.extractCompositeLiteralFields(astNode)
      };
    } else if (creationType === 'make_call' || creationType === 'new_call') {
      const args = this.getCallArguments(astNode);
      const details: any = {
        functionName: this.extractFunctionName(astNode),
        arguments: args.map(arg => arg ? this.getTypeName(arg) : 'unknown')
      };

      // 如果是make调用，可能包含额外的参数
      if (creationType === 'make_call' && args.length > 1) {
        details.initCapacity = args[1] ? args[1].text : null;
        details.initLength = args[1] ? args[1].text : null;
        if (args.length > 2) {
          details.initLength = args[2] ? args[2].text : null; // 对于make(slice, length, capacity)，第二个参数是长度
        }
      }

      return details;
    } else if (creationType === 'function_literal') {
      return {
        parameters: this.extractFunctionParameters(astNode),
        returnType: this.extractFunctionReturnType(astNode)
      };
    } else if (creationType === 'goroutine') {
      if (astNode.children.length > 0) {
        const callExpr = astNode.children[0];
        if (callExpr.type === 'call_expression') {
          return {
            targetFunction: this.extractFunctionName(callExpr),
            arguments: this.getCallArguments(callExpr).map(arg => arg ? arg.text : '')
          };
        }
      }
    }

    return {};
  }

  /**
   * 获取复合字面量的类型
   */
  private getCompositeLiteralType(compositeLiteral: Parser.SyntaxNode): Parser.SyntaxNode | null {
    for (const child of compositeLiteral.children) {
      if (child.type === 'type_identifier' ||
        child.type === 'struct_type' ||
        child.type === 'slice_type' ||
        child.type === 'map_type' ||
        child.type === 'array_type' ||
        child.type === 'channel_type') {
        return child;
      }
    }
    return null;
  }

  /**
   * 获取调用表达式的参数
   */
  private getCallArguments(callExpr: Parser.SyntaxNode): Parser.SyntaxNode[] {
    for (const child of callExpr.children) {
      if (child.type === 'argument_list') {
        return child.children.filter(arg =>
          arg.type !== ',' // 过滤掉逗号分隔符
        );
      }
    }
    return [];
  }

  /**
   * 提取函数名
   */
  private extractFunctionName(callExpr: Parser.SyntaxNode): string | null {
    if (callExpr.type === 'call_expression' && callExpr.children.length > 0) {
      const funcNode = callExpr.children[0];
      if (funcNode.type === 'identifier') {
        return funcNode.text;
      } else if (funcNode.type === 'selector_expression') {
        // 处理包.函数调用形式
        const selectorChildren = funcNode.children;
        if (selectorChildren.length >= 2) {
          return selectorChildren[selectorChildren.length - 1].text; // 获取最后一个节点（方法名）
        }
      }
    }
    return null;
  }

  /**
   * 获取类型名称
   */
  private getTypeName(typeNode: Parser.SyntaxNode | null): string {
    if (!typeNode) return 'unknown';

    if (typeNode.type === 'type_identifier' ||
      typeNode.type === 'identifier' ||
      typeNode.type === 'field_identifier') {
      return typeNode.text || 'unknown';
    } else if (typeNode.type === 'slice_type' ||
      typeNode.type === 'array_type' ||
      typeNode.type === 'map_type' ||
      typeNode.type === 'channel_type' ||
      typeNode.type === 'pointer_type') {
      // 递归构建类型名称
      let typeName = typeNode.type.replace('_type', '');
      if (typeNode.children.length > 0) {
        const childTypes = typeNode.children
          .filter(child => child.type !== '[' && child.type !== ']' && child.type !== '*' && child.type !== '<-' && child.type !== ',')
          .map(child => this.getTypeName(child));
        if (childTypes.length > 0) {
          typeName += `<${childTypes.join(', ')}>`;
        }
      }
      return typeName;
    } else if (typeNode.type === 'struct_type') {
      return 'struct';
    } else if (typeNode.type === 'function_type') {
      return 'function';
    }

    return typeNode.type;
  }

  /**
   * 提取复合字面量字段
   */
  private extractCompositeLiteralFields(compositeLiteral: Parser.SyntaxNode): Array<{ name: string; value: string }> {
    const fields: Array<{ name: string; value: string }> = [];

    for (const child of compositeLiteral.children) {
      if (child.type === 'literal_value') {
        // 处理字面量值，可能是键值对或仅值
        for (const field of child.children) {
          if (field.type === 'keyed_element') {
            const keyNode = field.children.find(c => c.type === 'field_identifier' || c.type === 'identifier');
            const valueNode = field.children.find(c => c.type !== 'field_identifier' && c.type !== 'identifier' && c.type !== ':');

            if (keyNode && valueNode) {
              fields.push({
                name: keyNode.text || '',
                value: valueNode.text || ''
              });
            }
          } else if (field.type !== ',' && field.type !== '{' && field.type !== '}') {
            // 仅值，使用索引作为名称
            fields.push({
              name: `field_${fields.length}`,
              value: field.text || ''
            });
          }
        }
      }
    }

    return fields;
  }

  /**
   * 提取函数参数
   */
  private extractFunctionParameters(funcLiteral: Parser.SyntaxNode): Array<{ name: string; type: string }> {
    for (const child of funcLiteral.children) {
      if (child.type === 'parameter_list') {
        const params: Array<{ name: string; type: string }> = [];

        const paramDecls = child.children.filter(c => c.type === 'parameter_declaration');
        for (const param of paramDecls) {
          const nameNode = param.children.find(c => c.type === 'identifier');
          const typeNode = param.children.find(c => c.type === 'type_identifier' || c.type.includes('_type'));

          params.push({
            name: nameNode?.text || '',
            type: typeNode ? this.getTypeName(typeNode) : 'unknown'
          });
        }

        return params;
      }
    }

    return [];
  }

  /**
   * 提取函数返回类型
   */
  private extractFunctionReturnType(funcLiteral: Parser.SyntaxNode): string {
    for (const child of funcLiteral.children) {
      if (child.type === 'type_identifier' || child.type.includes('_type')) {
        // 可能是返回类型
        if (child.type !== 'parameter_list') {
          return this.getTypeName(child);
        }
      }
    }

    return 'void'; // 没有显式返回类型
  }

  /**
   * 判断是否为创建关系节点
   */
  private isCreationNode(astNode: Parser.SyntaxNode): boolean {
    const creationNodeTypes = [
      'composite_literal',
      'call_expression', // make/new调用
      'func_literal',
      'go_statement',
      'slice_type',
      'map_type',
      'channel_type',
      'struct_type',
      'array_type'
    ];

    return creationNodeTypes.includes(astNode.type);
  }

  /**
   * 提取创建信息
   */
  extractCreationInfo(creationNode: Parser.SyntaxNode): {
    type: string;
    kind: string;
    target: string;
    details: any;
  } | null {
    const creationType = this.determineCreationType(creationNode);
    if (!creationType) return null;

    const creationKind = this.determineCreationKind(creationNode);
    const target = this.extractTarget(creationNode);
    const details = this.extractCreationDetails(creationNode);

    return {
      type: creationType,
      kind: creationKind,
      target: target || 'unknown',
      details
    };
  }

  /**
   * 查找创建节点
   */
  findCreationNodes(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const creationNodes: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (this.isCreationNode(node)) {
        creationNodes.push(node);
      }
    });

    return creationNodes;
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
   * 分析创建关系
   */
  analyzeCreations(ast: Parser.SyntaxNode, filePath: string): Array<{
    sourceId: string;
    targetId: string;
    creationType: string;
    creationKind: string;
    target: string;
    creationDetails: any;
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const creations: Array<any> = [];
    const creationNodes = this.findCreationNodes(ast);

    // 处理每个创建节点
    for (const creationNode of creationNodes) {
      const creationMetadata = this.extractCreationMetadata(
        { captures: [{ node: creationNode }] },
        creationNode,
        { filePath }
      );

      if (creationMetadata) {
        creations.push({
          sourceId: creationMetadata.fromNodeId,
          targetId: creationMetadata.toNodeId,
          creationType: creationMetadata.creationType,
          creationKind: creationMetadata.creationKind,
          target: creationMetadata.target,
          creationDetails: creationMetadata.creationDetails,
          location: creationMetadata.location
        });
      }
    }

    return creations;
  }
}