import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { PythonHelperMethods } from './PythonHelperMethods';
import Parser from 'tree-sitter';

/**
 * Python 生命周期关系提取器
 * 专门处理Python语言的生命周期关系提取，如对象实例化、初始化、销毁、生命周期管理等
 */
export class LifecycleRelationshipExtractor {
  /**
   * 提取生命周期关系元数据
   */
  extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const lifecycleType = this.determineLifecycleType(astNode);
    const lifecycleDetails = this.extractLifecycleDetails(astNode);

    return {
      type: 'lifecycle',
      lifecycleType,
      fromNodeId: this.extractSourceNodeId(astNode),
      toNodeId: this.extractTargetNodeId(astNode),
      lifecycleDetails,
      location: {
        filePath: symbolTable?.filePath || 'current_file.py',
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
    type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取对象实例化关系
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      const args = mainNode.childForFieldName('arguments');
      
      if (func?.text && args) {
        // 检查是否是类的实例化
        if (this.isClassInstantiation(func)) {
          relationships.push({
            source: 'new-instance',
            target: func.text,
            type: 'instantiates'
          });
        }
      }
    }

    // 提取构造函数调用关系
    if (mainNode.type === 'class_definition') {
      const className = mainNode.childForFieldName('name')?.text;
      if (className) {
        // 查找__init__方法
        const body = mainNode.childForFieldName('body');
        if (body) {
          for (const child of body.children || []) {
            if (child.type === 'function_definition') {
              const methodName = child.childForFieldName('name')?.text;
              if (methodName === '__init__') {
                relationships.push({
                  source: className,
                  target: `${className}.__init__`,
                  type: 'initializes'
                });
              }
            }
          }
        }
      }
    }

    // 提取初始化方法调用
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.type === 'attribute') {
        const object = func.childForFieldName('object');
        const attribute = func.childForFieldName('attribute');
        
        if (object?.text && attribute?.text && this.isInitializationMethod(attribute.text)) {
          relationships.push({
            source: object.text,
            target: `${object.text}.${attribute.text}`,
            type: 'initializes'
          });
        }
      }
    }

    // 提取析构函数定义
    if (mainNode.type === 'class_definition') {
      const className = mainNode.childForFieldName('name')?.text;
      if (className) {
        // 查找__del__方法
        const body = mainNode.childForFieldName('body');
        if (body) {
          for (const child of body.children || []) {
            if (child.type === 'function_definition') {
              const methodName = child.childForFieldName('name')?.text;
              if (methodName === '__del__') {
                relationships.push({
                  source: `${className}.__del__`,
                  target: className,
                  type: 'destroys'
                });
              }
            }
          }
        }
      }
    }

    // 提取上下文管理器入口
    if (mainNode.type === 'class_definition') {
      const className = mainNode.childForFieldName('name')?.text;
      if (className) {
        // 查找__enter__方法
        const body = mainNode.childForFieldName('body');
        if (body) {
          for (const child of body.children || []) {
            if (child.type === 'function_definition') {
              const methodName = child.childForFieldName('name')?.text;
              if (methodName === '__enter__') {
                relationships.push({
                  source: className,
                  target: `${className}.__enter__`,
                  type: 'manages'
                });
              }
            }
          }
        }
      }
    }

    // 提取上下文管理器出口
    if (mainNode.type === 'class_definition') {
      const className = mainNode.childForFieldName('name')?.text;
      if (className) {
        // 查找__exit__方法
        const body = mainNode.childForFieldName('body');
        if (body) {
          for (const child of body.children || []) {
            if (child.type === 'function_definition') {
              const methodName = child.childForFieldName('name')?.text;
              if (methodName === '__exit__') {
                relationships.push({
                  source: `${className}.__exit__`,
                  target: className,
                  type: 'manages'
                });
              }
            }
          }
        }
      }
    }

    // 提取异步上下文管理器入口
    if (mainNode.type === 'class_definition') {
      const className = mainNode.childForFieldName('name')?.text;
      if (className) {
        // 查找__aenter__方法
        const body = mainNode.childForFieldName('body');
        if (body) {
          for (const child of body.children || []) {
            if (child.type === 'function_definition') {
              const methodName = child.childForFieldName('name')?.text;
              if (methodName === '__aenter__') {
                relationships.push({
                  source: className,
                  target: `${className}.__aenter__`,
                  type: 'manages'
                });
              }
            }
          }
        }
      }
    }

    // 提取异步上下文管理器出口
    if (mainNode.type === 'class_definition') {
      const className = mainNode.childForFieldName('name')?.text;
      if (className) {
        // 查找__aexit__方法
        const body = mainNode.childForFieldName('body');
        if (body) {
          for (const child of body.children || []) {
            if (child.type === 'function_definition') {
              const methodName = child.childForFieldName('name')?.text;
              if (methodName === '__aexit__') {
                relationships.push({
                  source: `${className}.__aexit__`,
                  target: className,
                  type: 'manages'
                });
              }
            }
          }
        }
      }
    }

    // 提取迭代器协议入口
    if (mainNode.type === 'class_definition') {
      const className = mainNode.childForFieldName('name')?.text;
      if (className) {
        // 查找__iter__方法
        const body = mainNode.childForFieldName('body');
        if (body) {
          for (const child of body.children || []) {
            if (child.type === 'function_definition') {
              const methodName = child.childForFieldName('name')?.text;
              if (methodName === '__iter__') {
                relationships.push({
                  source: className,
                  target: `${className}.__iter__`,
                  type: 'manages'
                });
              }
            }
          }
        }
      }
    }

    // 提取迭代器协议出口
    if (mainNode.type === 'class_definition') {
      const className = mainNode.childForFieldName('name')?.text;
      if (className) {
        // 查找__next__方法
        const body = mainNode.childForFieldName('body');
        if (body) {
          for (const child of body.children || []) {
            if (child.type === 'function_definition') {
              const methodName = child.childForFieldName('name')?.text;
              if (methodName === '__next__') {
                relationships.push({
                  source: `${className}.__next__`,
                  target: className,
                  type: 'manages'
                });
              }
            }
          }
        }
      }
    }

    // 提取异步迭代器协议入口
    if (mainNode.type === 'class_definition') {
      const className = mainNode.childForFieldName('name')?.text;
      if (className) {
        // 查找__aiter__方法
        const body = mainNode.childForFieldName('body');
        if (body) {
          for (const child of body.children || []) {
            if (child.type === 'function_definition') {
              const methodName = child.childForFieldName('name')?.text;
              if (methodName === '__aiter__') {
                relationships.push({
                  source: className,
                  target: `${className}.__aiter__`,
                  type: 'manages'
                });
              }
            }
          }
        }
      }
    }

    // 提取异步迭代器协议出口
    if (mainNode.type === 'class_definition') {
      const className = mainNode.childForFieldName('name')?.text;
      if (className) {
        // 查找__anext__方法
        const body = mainNode.childForFieldName('body');
        if (body) {
          for (const child of body.children || []) {
            if (child.type === 'function_definition') {
              const methodName = child.childForFieldName('name')?.text;
              if (methodName === '__anext__') {
                relationships.push({
                  source: `${className}.__anext__`,
                  target: className,
                  type: 'manages'
                });
              }
            }
          }
        }
      }
    }

    // 提取资源获取方法
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.type === 'attribute') {
        const object = func.childForFieldName('object');
        const attribute = func.childForFieldName('attribute');
        
        if (object?.text && attribute?.text && this.isAcquisitionMethod(attribute.text)) {
          relationships.push({
            source: object.text,
            target: `${object.text}.${attribute.text}`,
            type: 'manages'
          });
        }
      }
    }

    // 提取资源释放方法
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.type === 'attribute') {
        const object = func.childForFieldName('object');
        const attribute = func.childForFieldName('attribute');
        
        if (object?.text && attribute?.text && this.isReleaseMethod(attribute.text)) {
          relationships.push({
            source: `${object.text}.${attribute.text}`,
            target: object.text,
            type: 'destroys'
          });
        }
      }
    }

    // 提取生成器创建
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.text && this.isGeneratorFunction(func.text)) {
        relationships.push({
          source: 'generator-factory',
          target: func.text,
          type: 'instantiates'
        });
      }
    }

    // 提取生成器销毁
    if (mainNode.type === 'call') {
      const func = mainNode.childForFieldName('function');
      if (func?.type === 'attribute') {
        const object = func.childForFieldName('object');
        const attribute = func.childForFieldName('attribute');
        
        if (object?.text && attribute?.text && this.isGeneratorDestructionMethod(attribute.text)) {
          relationships.push({
            source: `${object.text}.${attribute.text}`,
            target: object.text,
            type: 'destroys'
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 确定生命周期类型
   */
  private determineLifecycleType(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'call':
        const func = astNode.childForFieldName('function');
        if (func?.type === 'attribute') {
          const attribute = func.childForFieldName('attribute');
          if (attribute?.text) {
            if (this.isInitializationMethod(attribute.text)) return 'initialization';
            if (this.isAcquisitionMethod(attribute.text)) return 'resource_acquisition';
            if (this.isReleaseMethod(attribute.text)) return 'resource_release';
            if (this.isGeneratorDestructionMethod(attribute.text)) return 'generator_destruction';
          }
        }
        if (this.isClassInstantiation(func)) return 'instantiation';
        if (this.isGeneratorFunction(func?.text || '')) return 'generator_creation';
        return 'method_call';
        
      case 'class_definition':
        return 'class_lifecycle';
        
      case 'function_definition':
        const methodName = astNode.childForFieldName('name')?.text;
        if (methodName === '__init__') return 'constructor';
        if (methodName === '__del__') return 'destructor';
        if (methodName === '__enter__' || methodName === '__exit__') return 'context_management';
        if (methodName === '__aenter__' || methodName === '__aexit__') return 'async_context_management';
        if (methodName === '__iter__' || methodName === '__next__') return 'iterator_protocol';
        if (methodName === '__aiter__' || methodName === '__anext__') return 'async_iterator_protocol';
        return 'method_lifecycle';
        
      default:
        return 'unknown_lifecycle';
    }
  }

  /**
   * 提取生命周期详细信息
   */
  private extractLifecycleDetails(astNode: Parser.SyntaxNode): any {
    const details: any = {};

    switch (astNode.type) {
      case 'call':
        const func = astNode.childForFieldName('function');
        const args = astNode.childForFieldName('arguments');
        details.functionName = func?.text;
        details.argumentCount = args?.childCount || 0;
        
        if (func?.type === 'attribute') {
          const object = func.childForFieldName('object');
          const attribute = func.childForFieldName('attribute');
          details.objectName = object?.text;
          details.methodName = attribute?.text;
        }
        break;
        
      case 'class_definition':
        const className = astNode.childForFieldName('name');
        details.className = className?.text;
        details.methodCount = this.countMethods(astNode);
        details.hasSpecialMethods = this.hasSpecialMethods(astNode);
        break;
        
      case 'function_definition':
        const methodName = astNode.childForFieldName('name');
        details.methodName = methodName?.text;
        details.parameterCount = this.countParameters(astNode);
        details.isAsync = PythonHelperMethods.isAsyncFunction(astNode);
        break;
    }

    return details;
  }

  /**
   * 提取源节点ID
   */
  private extractSourceNodeId(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'call':
        const func = astNode.childForFieldName('function');
        if (func?.type === 'attribute') {
          const object = func.childForFieldName('object');
          return object ? NodeIdGenerator.forAstNode(object) : 'unknown';
        }
        return 'caller';
        
      case 'class_definition':
        return 'class-definition';
        
      case 'function_definition':
        const methodName = astNode.childForFieldName('name');
        return methodName ? NodeIdGenerator.forAstNode(methodName) : 'unknown';
        
      default:
        return NodeIdGenerator.forAstNode(astNode);
    }
  }

  /**
   * 提取目标节点ID
   */
  private extractTargetNodeId(astNode: Parser.SyntaxNode): string {
    switch (astNode.type) {
      case 'call':
        const func = astNode.childForFieldName('function');
        return func ? NodeIdGenerator.forAstNode(func) : 'unknown';
        
      case 'class_definition':
        const className = astNode.childForFieldName('name');
        return className ? NodeIdGenerator.forAstNode(className) : 'unknown';
        
      case 'function_definition':
        return NodeIdGenerator.forAstNode(astNode);
        
      default:
        return 'unknown';
    }
  }

  // 辅助方法

  private isClassInstantiation(func: Parser.SyntaxNode | null): boolean {
    if (!func) return false;
    
    // 简单的启发式：如果函数名首字母大写，可能是类实例化
    if (func.type === 'identifier') {
      return func.text[0] === func.text[0].toUpperCase();
    }
    
    // 检查是否是属性调用中的构造函数
    if (func.type === 'attribute') {
      const attribute = func.childForFieldName('attribute');
      return attribute?.text === '__call__';
    }
    
    return false;
  }

  private isInitializationMethod(methodName: string): boolean {
    const initMethods = ['initialize', 'setup', 'configure', 'init', 'start', 'open', 'connect'];
    return initMethods.some(method => methodName.toLowerCase().includes(method));
  }

  private isAcquisitionMethod(methodName: string): boolean {
    const acquireMethods = ['acquire', 'open', 'start', 'connect', 'begin', 'create'];
    return acquireMethods.some(method => methodName.toLowerCase().includes(method));
  }

  private isReleaseMethod(methodName: string): boolean {
    const releaseMethods = ['release', 'close', 'stop', 'disconnect', 'end', 'destroy', 'cleanup'];
    return releaseMethods.some(method => methodName.toLowerCase().includes(method));
  }

  private isGeneratorFunction(funcName: string): boolean {
    // 简单的启发式：检查函数名是否包含generator相关关键词
    return funcName.toLowerCase().includes('generator') || 
           funcName.toLowerCase().includes('iter');
  }

  private isGeneratorDestructionMethod(methodName: string): boolean {
    return methodName === 'close' || methodName === 'throw' || methodName === 'send';
  }

  private countMethods(classNode: Parser.SyntaxNode): number {
    let count = 0;
    const body = classNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'function_definition') {
          count++;
        }
      }
    }
    return count;
  }

  private hasSpecialMethods(classNode: Parser.SyntaxNode): boolean {
    const body = classNode.childForFieldName('body');
    if (body) {
      for (const child of body.children || []) {
        if (child.type === 'function_definition') {
          const methodName = child.childForFieldName('name')?.text;
          if (methodName && methodName.startsWith('__') && methodName.endsWith('__')) {
            return true;
          }
        }
      }
    }
    return false;
  }

  private countParameters(funcNode: Parser.SyntaxNode): number {
    const parameters = funcNode.childForFieldName('parameters');
    return parameters?.childCount || 0;
  }

  /**
   * 提取上下文管理器关系
   */
  extractContextManagerRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'enter' | 'exit';
    isAsync: boolean;
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'enter' | 'exit';
      isAsync: boolean;
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 查找with语句
    if (mainNode.type === 'with_statement') {
      const context = mainNode.childForFieldName('context');
      if (context?.text) {
        relationships.push({
          source: context.text,
          target: 'with-block',
          type: 'enter',
          isAsync: false
        });
      }
    }

    return relationships;
  }

  /**
   * 提取迭代器关系
   */
  extractIteratorRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'iter' | 'next';
    isAsync: boolean;
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'iter' | 'next';
      isAsync: boolean;
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 查找for循环
    if (mainNode.type === 'for_statement') {
      const iter = mainNode.childForFieldName('iter');
      if (iter?.text) {
        relationships.push({
          source: iter.text,
          target: 'loop-body',
          type: 'iter',
          isAsync: false
        });
      }
    }

    return relationships;
  }
}