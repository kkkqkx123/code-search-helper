import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { CHelperMethods } from '.';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';

/**
 * C语言生命周期关系提取器
 * 用于提取内存、文件、线程等资源的生命周期管理关系
 */
export class LifecycleRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取生命周期关系元数据
   */
  extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    if (!astNode) {
      return null;
    }

    const lifecycleType = this.determineLifecycleType(astNode);
    const operationType = this.determineOperationType(astNode);
    const resourceInfo = this.extractResourceInfo(astNode);

    return {
      type: 'lifecycle',
      fromNodeId: NodeIdGenerator.forAstNode(astNode),
      toNodeId: resourceInfo.resourceId || 'unknown',
      lifecycleType,
      operationType,
      resourceInfo,
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取生命周期关系数组
   */
  extractLifecycleRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => this.isLifecycleNode(node),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractLifecycleMetadata(result, astNode, symbolTable)
    );
  }

  /**
   * 确定生命周期类型
   */
  private determineLifecycleType(astNode: Parser.SyntaxNode): string {
    if (astNode.type === 'call_expression') {
      const functionName = CHelperMethods.extractCalleeName(astNode);
      if (!functionName) {
        return 'unknown';
      }
      
      // 内存管理
      const memoryPatterns = ['malloc', 'calloc', 'realloc', 'free', 'alloca'];
      // 文件操作
      const filePatterns = ['fopen', 'fclose', 'fread', 'fwrite', 'fgets', 'fprintf', 'open', 'close', 'read', 'write'];
      // 线程操作
      const threadPatterns = ['pthread_create', 'pthread_join', 'pthread_detach', 'pthread_exit'];
      // 互斥锁操作
      const mutexPatterns = ['pthread_mutex_lock', 'pthread_mutex_unlock', 'pthread_mutex_destroy', 'pthread_mutex_init'];
      // 条件变量操作
      const conditionPatterns = ['pthread_cond_wait', 'pthread_cond_signal', 'pthread_cond_destroy', 'pthread_cond_init'];

      if (memoryPatterns.some(pattern => functionName.includes(pattern))) {
        return 'memory';
      } else if (filePatterns.some(pattern => functionName.includes(pattern))) {
        return 'file';
      } else if (threadPatterns.some(pattern => functionName.includes(pattern))) {
        return 'thread';
      } else if (mutexPatterns.some(pattern => functionName.includes(pattern))) {
        return 'mutex';
      } else if (conditionPatterns.some(pattern => functionName.includes(pattern))) {
        return 'condition';
      }
    } else if (astNode.type === 'declaration') {
      // 检查是否为资源变量绑定
      const declaratorNode = astNode.childForFieldName('declarator');
      if (declaratorNode) {
        const initNode = declaratorNode.childForFieldName('value');
        if (initNode && initNode.type === 'call_expression') {
          return 'resource_binding';
        }
      }
      
      // 检查作用域相关
      const storageClassNode = astNode.childForFieldName('storage_class_specifier');
      if (storageClassNode) {
        if (storageClassNode.text === 'static') {
          return 'scope_static';
        }
      }
      
      return 'scope_local';
    } else if (astNode.type === 'function_definition') {
      return 'function_scope';
    }

    return 'unknown';
  }

  /**
   * 确定操作类型
   */
  private determineOperationType(astNode: Parser.SyntaxNode): string {
    if (astNode.type === 'call_expression') {
      const functionName = CHelperMethods.extractCalleeName(astNode);
      if (!functionName) {
        return 'unknown';
      }
      
      const allocatePatterns = ['malloc', 'calloc', 'realloc', 'alloca', 'fopen', 'open', 'pthread_create', 'pthread_mutex_init', 'pthread_cond_init'];
      const deallocatePatterns = ['free', 'fclose', 'close', 'pthread_join', 'pthread_detach', 'pthread_mutex_destroy', 'pthread_cond_destroy'];
      const readPatterns = ['fread', 'read', 'fgets', 'getline'];
      const writePatterns = ['fwrite', 'write', 'fputs', 'fprintf'];
      const lockPatterns = ['pthread_mutex_lock', 'pthread_cond_wait'];
      const unlockPatterns = ['pthread_mutex_unlock', 'pthread_cond_signal'];

      if (allocatePatterns.some(pattern => functionName.includes(pattern))) {
        return 'allocate';
      } else if (deallocatePatterns.some(pattern => functionName.includes(pattern))) {
        return 'deallocate';
      } else if (readPatterns.some(pattern => functionName.includes(pattern))) {
        return 'read';
      } else if (writePatterns.some(pattern => functionName.includes(pattern))) {
        return 'write';
      } else if (lockPatterns.some(pattern => functionName.includes(pattern))) {
        return 'lock';
      } else if (unlockPatterns.some(pattern => functionName.includes(pattern))) {
        return 'unlock';
      }
    } else if (astNode.type === 'declaration') {
      const declaratorNode = astNode.childForFieldName('declarator');
      if (declaratorNode) {
        const initNode = declaratorNode.childForFieldName('value');
        if (initNode && initNode.type === 'call_expression') {
          return 'bind';
        }
      }
      
      return 'declare';
    } else if (astNode.type === 'function_definition') {
      return 'define';
    }

    return 'unknown';
  }

  /**
   * 提取资源信息
   */
  private extractResourceInfo(astNode: Parser.SyntaxNode): any {
    const resourceInfo: any = {
      resourceId: 'unknown',
      resourceType: 'unknown',
      size: undefined,
      attributes: []
    };

    if (astNode.type === 'call_expression') {
      const functionName = CHelperMethods.extractCalleeName(astNode);
      const argumentsNode = astNode.childForFieldName('arguments');
      
      if (functionName) {
        resourceInfo.functionName = functionName;
      }

      if (argumentsNode) {
        // 提取第一个参数作为资源ID
        const firstArg = argumentsNode.childForFieldName('0');
        if (firstArg) {
          if (firstArg.type === 'pointer_expression') {
            const pointerArg = firstArg.childForFieldName('argument');
            if (pointerArg) {
              resourceInfo.resourceId = pointerArg.text;
            }
          } else {
            resourceInfo.resourceId = firstArg.text;
          }
        }

        // 提取大小信息（对于内存分配）
        const sizeArg = argumentsNode.childForFieldName('1');
        if (sizeArg) {
          resourceInfo.size = sizeArg.text;
        }

        // 提取其他参数
        for (let i = 2; i < argumentsNode.childCount; i++) {
          const arg = argumentsNode.childForFieldName(i.toString());
          if (arg) {
            resourceInfo.attributes.push({
              index: i,
              value: arg.text,
              type: arg.type
            });
          }
        }
      }
    } else if (astNode.type === 'declaration') {
      const declaratorNode = astNode.childForFieldName('declarator');
      const typeNode = astNode.childForFieldName('type');
      
      if (declaratorNode) {
        resourceInfo.resourceId = CHelperMethods.extractName({ captures: [{ node: declaratorNode }] }) || 'unknown';
        
        // 检查是否有初始化值
        const initNode = declaratorNode.childForFieldName('value');
        if (initNode) {
          resourceInfo.initialValue = initNode.text;
          
          // 如果是函数调用，提取函数信息
          if (initNode.type === 'call_expression') {
            const initFunctionNode = initNode.childForFieldName('function');
            if (initFunctionNode) {
              resourceInfo.allocationFunction = initFunctionNode.text;
            }
          }
        }
      }
      
      if (typeNode) {
        resourceInfo.resourceType = typeNode.text;
      }
    } else if (astNode.type === 'function_definition') {
      const declaratorNode = astNode.childForFieldName('declarator');
      if (declaratorNode) {
        resourceInfo.resourceId = CHelperMethods.extractName({ captures: [{ node: declaratorNode }] }) || 'unknown';
        resourceInfo.resourceType = 'function';
      }
    }

    return resourceInfo;
  }

  /**
   * 判断是否为生命周期相关节点
   */
  private isLifecycleNode(astNode: Parser.SyntaxNode): boolean {
    if (astNode.type === 'call_expression') {
      const functionName = CHelperMethods.extractCalleeName(astNode);
      if (!functionName) {
        return false;
      }
      const lifecyclePatterns = [
        'malloc', 'calloc', 'realloc', 'free', 'alloca',
        'fopen', 'fclose', 'fread', 'fwrite', 'fgets', 'fprintf', 'open', 'close', 'read', 'write',
        'pthread_create', 'pthread_join', 'pthread_detach', 'pthread_exit',
        'pthread_mutex_lock', 'pthread_mutex_unlock', 'pthread_mutex_destroy', 'pthread_mutex_init',
        'pthread_cond_wait', 'pthread_cond_signal', 'pthread_cond_destroy', 'pthread_cond_init'
      ];

      return lifecyclePatterns.some(pattern => functionName.includes(pattern));
    } else if (astNode.type === 'declaration') {
      // 检查是否为资源绑定声明
      const declaratorNode = astNode.childForFieldName('declarator');
      if (declaratorNode) {
        const initNode = declaratorNode.childForFieldName('value');
        if (initNode && initNode.type === 'call_expression') {
          return true;
        }
      }
      
      // 检查是否有存储类说明符
      const storageClassNode = astNode.childForFieldName('storage_class_specifier');
      if (storageClassNode) {
        return true;
      }
      
      return true; // 所有声明都可能与生命周期相关
    } else if (astNode.type === 'function_definition') {
      return true; // 函数定义定义了作用域
    }

    return false;
  }

  /**
   * 提取作用域关系元数据
   */
  extractScopeMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    if (!astNode) {
      return null;
    }

    const scopeType = this.determineScopeType(astNode);
    const scopeInfo = this.extractScopeInfo(astNode);

    return {
      type: 'scope',
      fromNodeId: NodeIdGenerator.forAstNode(astNode),
      toNodeId: scopeType,
      scopeType,
      scopeInfo,
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 确定作用域类型
   */
  private determineScopeType(astNode: Parser.SyntaxNode): string {
    if (astNode.type === 'function_definition') {
      return 'function';
    } else if (astNode.type === 'compound_statement') {
      return 'block';
    } else if (astNode.type === 'declaration') {
      const storageClassNode = astNode.childForFieldName('storage_class_specifier');
      if (storageClassNode) {
        if (storageClassNode.text === 'static') {
          return 'static';
        }
      }
      
      // 检查是否在全局作用域
      const parent = astNode.parent;
      if (parent && (parent.type === 'translation_unit' || parent.type === 'external_declaration')) {
        return 'global';
      }
      
      return 'local';
    }

    return 'unknown';
  }

  /**
   * 提取作用域信息
   */
  private extractScopeInfo(astNode: Parser.SyntaxNode): any {
    const scopeInfo: any = {
      variables: [],
      functions: [],
      nestedScopes: []
    };

    if (astNode.type === 'declaration') {
      const declaratorNode = astNode.childForFieldName('declarator');
      const typeNode = astNode.childForFieldName('type');
      
      if (declaratorNode) {
        scopeInfo.variables.push({
          name: this.extractNameFromNode(declaratorNode) || 'unknown',
          type: typeNode?.text || 'unknown'
        });
      }
    } else if (astNode.type === 'function_definition') {
      const declaratorNode = astNode.childForFieldName('declarator');
      if (declaratorNode) {
        scopeInfo.functions.push({
          name: this.extractNameFromNode(declaratorNode) || 'unknown'
        });
      }
      
      // 提取函数体内的变量
      const bodyNode = astNode.childForFieldName('body');
      if (bodyNode) {
        this.extractVariablesFromScope(bodyNode, scopeInfo);
      }
    } else if (astNode.type === 'compound_statement') {
      this.extractVariablesFromScope(astNode, scopeInfo);
    }

    return scopeInfo;
  }

  /**
   * 从作用域中提取变量
   */
  private extractVariablesFromScope(scopeNode: Parser.SyntaxNode, scopeInfo: any): void {
    if (!scopeNode.children) {
      return;
    }

    for (const child of scopeNode.children) {
      if (child.type === 'declaration') {
        const declaratorNode = child.childForFieldName('declarator');
        const typeNode = child.childForFieldName('type');
        
        if (declaratorNode) {
          scopeInfo.variables.push({
            name: this.extractNameFromNode(declaratorNode) || 'unknown',
            type: typeNode?.text || 'unknown'
          });
        }
      } else if (child.type === 'compound_statement') {
        scopeInfo.nestedScopes.push({
          nodeId: NodeIdGenerator.forAstNode(child),
          type: 'block'
        });
      }
    }
  }

  /**
   * 提取作用域关系
   */
  extractScopeRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => ['declaration', 'function_definition', 'compound_statement'].includes(node.type),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractScopeMetadata(result, astNode, symbolTable)
    );
  }
}