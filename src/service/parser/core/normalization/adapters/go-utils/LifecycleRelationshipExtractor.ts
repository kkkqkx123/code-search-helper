import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { GoHelperMethods } from './GoHelperMethods';
import Parser from 'tree-sitter';

/**
 * Go 生命周期关系提取器
 * 从 GoLanguageAdapter 迁移的生命周期关系提取逻辑
 */
export class LifecycleRelationshipExtractor {
  /**
   * 提取生命周期关系元数据
   */
  extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const lifecycleType = this.determineLifecycleType(astNode);
    const sourceNode = this.extractSourceNode(astNode);
    const targetNode = this.extractTargetNode(astNode);

    return {
      type: 'lifecycle',
      fromNodeId: sourceNode ? NodeIdGenerator.forAstNode(sourceNode) : 'unknown',
      toNodeId: targetNode ? NodeIdGenerator.forAstNode(targetNode) : 'unknown',
      lifecycleType,
      resourceType: this.extractResourceType(astNode),
      cleanupMechanism: this.extractCleanupMechanism(astNode),
      location: {
        filePath: symbolTable?.filePath || 'current_file.go',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 确定生命周期类型
   */
  private determineLifecycleType(astNode: Parser.SyntaxNode): 'instantiates' | 'initializes' | 'destroys' | 'manages' | 'allocates' | 'releases' {
    const nodeType = astNode.type;
    
    if (nodeType === 'call_expression') {
      const funcNode = astNode.childForFieldName('function');
      if (funcNode?.text) {
        const funcText = funcNode.text.toLowerCase();
        if (funcText === 'make' || funcText === 'new') {
          return 'instantiates';
        } else if (funcText.includes('close') || funcText.includes('destroy') || funcText.includes('free')) {
          return 'destroys';
        } else if (funcText.includes('init') || funcText.includes('setup')) {
          return 'initializes';
        }
      }
    } else if (nodeType === 'defer_statement') {
      return 'releases';
    } else if (nodeType === 'var_declaration' || nodeType === 'short_var_declaration') {
      return 'initializes';
    } else if (nodeType === 'assignment_statement') {
      // 检查是否是资源管理相关的赋值
      const rightNode = astNode.childForFieldName('right');
      if (rightNode?.type === 'call_expression') {
        const funcNode = rightNode.childForFieldName('function');
        if (funcNode?.text) {
          const funcText = funcNode.text.toLowerCase();
          if (funcText === 'make' || funcText === 'new') {
            return 'instantiates';
          }
        }
      }
      return 'manages';
    }
    
    return 'manages';
  }

  /**
   * 提取源节点
   */
  private extractSourceNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'call_expression') {
      // 对于函数调用，调用者是源
      return GoHelperMethods.findCallerFunctionContext(astNode);
    } else if (nodeType === 'defer_statement') {
      // 对于defer语句，当前函数是源
      return GoHelperMethods.findCallerFunctionContext(astNode);
    } else if (nodeType === 'var_declaration' || nodeType === 'short_var_declaration') {
      // 对于变量声明，变量名是源
      return astNode.childForFieldName('name');
    } else if (nodeType === 'assignment_statement') {
      // 对于赋值语句，左侧是源
      return astNode.childForFieldName('left');
    }
    
    return null;
  }

  /**
   * 提取目标节点
   */
  private extractTargetNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'call_expression') {
      // 对于函数调用，被调用的函数是目标
      return astNode.childForFieldName('function');
    } else if (nodeType === 'defer_statement') {
      // 对于defer语句，被defer的函数是目标
      return astNode.childForFieldName('call');
    } else if (nodeType === 'var_declaration' || nodeType === 'short_var_declaration') {
      // 对于变量声明，初始值是目标
      return astNode.childForFieldName('value');
    } else if (nodeType === 'assignment_statement') {
      // 对于赋值语句，右侧是目标
      return astNode.childForFieldName('right');
    }
    
    return null;
  }

  /**
   * 提取资源类型
   */
  private extractResourceType(astNode: Parser.SyntaxNode): string | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'call_expression') {
      const funcNode = astNode.childForFieldName('function');
      if (funcNode?.text) {
        const funcText = funcNode.text.toLowerCase();
        if (funcText === 'make' || funcText === 'new') {
          // 分析make/new的参数来确定资源类型
          const argList = astNode.childForFieldName('arguments');
          if (argList && argList.children.length > 0) {
            const typeNode = argList.children[0];
            return this.determineResourceTypeFromTypeNode(typeNode);
          }
        }
      }
    } else if (nodeType === 'var_declaration' || nodeType === 'short_var_declaration') {
      // 从类型注解中提取资源类型
      const typeNode = astNode.childForFieldName('type');
      if (typeNode) {
        return this.determineResourceTypeFromTypeNode(typeNode);
      }
    }
    
    return null;
  }

  /**
   * 从类型节点确定资源类型
   */
  private determineResourceTypeFromTypeNode(typeNode: Parser.SyntaxNode): string {
    const nodeType = typeNode.type;
    
    if (nodeType === 'slice_type') {
      return 'slice';
    } else if (nodeType === 'map_type') {
      return 'map';
    } else if (nodeType === 'channel_type') {
      return 'channel';
    } else if (nodeType === 'pointer_type') {
      return 'pointer';
    } else if (nodeType === 'struct_type') {
      return 'struct';
    } else if (nodeType === 'interface_type') {
      return 'interface';
    } else if (nodeType === 'identifier') {
      // 可能是自定义类型
      return typeNode.text;
    }
    
    return 'unknown';
  }

  /**
   * 提取清理机制
   */
  private extractCleanupMechanism(astNode: Parser.SyntaxNode): string | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'defer_statement') {
      return 'defer';
    } else if (nodeType === 'call_expression') {
      const funcNode = astNode.childForFieldName('function');
      if (funcNode?.text) {
        const funcText = funcNode.text.toLowerCase();
        if (funcText.includes('close')) {
          return 'close';
        } else if (funcText.includes('destroy') || funcText.includes('free')) {
          return 'destroy';
        }
      }
    }
    
    return null;
  }

  /**
   * 提取生命周期关系数组
   */
  extractLifecycleRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'instantiates' | 'initializes' | 'destroys' | 'manages' | 'allocates' | 'releases';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'instantiates' | 'initializes' | 'destroys' | 'manages' | 'allocates' | 'releases';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    const lifecycleType = this.determineLifecycleType(mainNode);
    const sourceNode = this.extractSourceNode(mainNode);
    const targetNode = this.extractTargetNode(mainNode);

    if (sourceNode && targetNode) {
      const sourceName = GoHelperMethods.extractNameFromNode(sourceNode) || sourceNode.text;
      const targetName = GoHelperMethods.extractNameFromNode(targetNode) || targetNode.text;
      
      if (sourceName && targetName) {
        relationships.push({
          source: sourceName,
          target: targetName,
          type: lifecycleType
        });
      }
    }

    return relationships;
  }

  /**
   * 分析对象实例化关系
   */
  private analyzeObjectInstantiation(callExpr: Parser.SyntaxNode): {
    allocatedType: string;
    variableName?: string;
    allocationMethod: 'make' | 'new' | 'literal';
  } | null {
    if (callExpr.type !== 'call_expression') {
      return null;
    }

    const funcNode = callExpr.childForFieldName('function');
    if (!funcNode) {
      return null;
    }

    const funcText = funcNode.text.toLowerCase();
    let allocationMethod: 'make' | 'new' | 'literal' = 'make';
    
    if (funcText === 'make') {
      allocationMethod = 'make';
    } else if (funcText === 'new') {
      allocationMethod = 'new';
    } else {
      return null;
    }

    // 提取分配的类型
    const argList = callExpr.childForFieldName('arguments');
    if (!argList || argList.children.length === 0) {
      return null;
    }

    const typeNode = argList.children[0];
    const allocatedType = this.determineResourceTypeFromTypeNode(typeNode);

    // 查找变量名
    let variableName: string | undefined;
    const parent = callExpr.parent;
    if (parent) {
      if (parent.type === 'short_var_declaration' || parent.type === 'var_declaration') {
        const nameNode = parent.childForFieldName('name');
        if (nameNode) {
          variableName = nameNode.text;
        }
      } else if (parent.type === 'assignment_statement') {
        const leftNode = parent.childForFieldName('left');
        if (leftNode) {
          variableName = leftNode.text;
        }
      }
    }

    return {
      allocatedType,
      variableName,
      allocationMethod
    };
  }

  /**
   * 分析资源清理关系
   */
  private analyzeResourceCleanup(cleanupNode: Parser.SyntaxNode): {
    resourceName: string;
    cleanupMethod: 'defer' | 'close' | 'destroy' | 'return';
    cleanupFunction?: string;
  } | null {
    if (cleanupNode.type === 'defer_statement') {
      const callNode = cleanupNode.childForFieldName('call');
      if (callNode) {
        const funcNode = callNode.childForFieldName('function');
        if (funcNode) {
          const funcText = funcNode.text;
          let resourceName: string | undefined;
          
          // 尝试从函数调用中提取资源名
          if (funcText.includes('Close')) {
            const selectorExpr = funcNode.childForFieldName('operand');
            if (selectorExpr) {
              resourceName = selectorExpr.text;
            }
          }
          
          return {
            resourceName: resourceName || 'unknown',
            cleanupMethod: 'defer',
            cleanupFunction: funcText
          };
        }
      }
    } else if (cleanupNode.type === 'call_expression') {
      const funcNode = cleanupNode.childForFieldName('function');
      if (funcNode) {
        const funcText = funcNode.text.toLowerCase();
        if (funcText.includes('close') || funcText.includes('destroy') || funcText.includes('free')) {
          let resourceName: string | undefined;
          
          // 尝试从函数调用中提取资源名
          const selectorExpr = funcNode.childForFieldName('operand');
          if (selectorExpr) {
            resourceName = selectorExpr.text;
          }
          
          return {
            resourceName: resourceName || 'unknown',
            cleanupMethod: funcText.includes('close') ? 'close' : 'destroy',
            cleanupFunction: funcText
          };
        }
      }
    }
    
    return null;
  }

  /**
   * 分析初始化关系
   */
  private analyzeInitialization(initNode: Parser.SyntaxNode): {
    initializedResource: string;
    initialValue?: string;
    initMethod: 'declaration' | 'assignment' | 'function_call';
  } | null {
    if (initNode.type === 'var_declaration' || initNode.type === 'short_var_declaration') {
      const nameNode = initNode.childForFieldName('name');
      const valueNode = initNode.childForFieldName('value');
      
      return {
        initializedResource: nameNode?.text || 'unknown',
        initialValue: valueNode?.text,
        initMethod: 'declaration'
      };
    } else if (initNode.type === 'assignment_statement') {
      const leftNode = initNode.childForFieldName('left');
      const rightNode = initNode.childForFieldName('right');
      
      return {
        initializedResource: leftNode?.text || 'unknown',
        initialValue: rightNode?.text,
        initMethod: 'assignment'
      };
    } else if (initNode.type === 'call_expression') {
      const funcNode = initNode.childForFieldName('function');
      if (funcNode?.text.toLowerCase().includes('init')) {
        return {
          initializedResource: 'unknown',
          initMethod: 'function_call'
        };
      }
    }
    
    return null;
  }
}