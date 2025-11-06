import Parser from 'tree-sitter';
import { JsHelperMethods } from './JsHelperMethods';

/**
 * JavaScript/TypeScript生命周期关系提取器
 * 提取组件生命周期方法、构造函数、析构函数等关系
 */
export class LifecycleRelationshipExtractor {
  /**
   * 提取生命周期关系的元数据
   */
  extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode, language: string | null): any {
    const metadata: any = {};
    
    // 提取生命周期阶段信息
    const stageInfo = this.extractStageInfo(astNode);
    if (stageInfo) {
      metadata.stage = stageInfo;
    }
    
    // 提取生命周期类型
    metadata.lifecycleType = this.extractLifecycleType(astNode);
    
    // 提取生命周期上下文
    metadata.context = this.extractLifecycleContext(astNode);
    
    // 提取依赖关系
    metadata.dependencies = this.extractLifecycleDependencies(astNode);
    
    // 标记是否为关键生命周期方法
    metadata.isCritical = this.isCriticalLifecycle(astNode);
    
    return metadata;
 }

  /**
   * 提取生命周期阶段信息
   */
  private extractStageInfo(astNode: Parser.SyntaxNode): any | null {
    if (!astNode) return null;

    let stageNode = null;
    let stageType = '';
    
    if (astNode.type === 'function_declaration' || astNode.type === 'method_definition') {
      const methodName = this.getMethodName(astNode);
      
      // 检查是否为生命周期方法
      const stage = this.getLifecycleStage(methodName);
      if (stage) {
        stageNode = astNode;
        stageType = stage;
      }
    } else if (astNode.type === 'class') {
      // 构造函数是初始化阶段
      stageNode = astNode;
      stageType = 'initialization';
    }
    
    if (stageNode) {
      return {
        text: stageNode.text,
        type: stageType,
        range: {
          start: { row: stageNode.startPosition.row, column: stageNode.startPosition.column },
          end: { row: stageNode.endPosition.row, column: stageNode.endPosition.column }
        }
      };
    }
    
    return null;
  }

 /**
   * 提取生命周期类型
   */
  private extractLifecycleType(astNode: Parser.SyntaxNode): string {
    if (!astNode) return 'unknown';

    if (astNode.type === 'function_declaration' || astNode.type === 'method_definition') {
      const methodName = this.getMethodName(astNode);
      return this.getLifecycleStage(methodName) || 'custom';
    } else if (astNode.type === 'call_expression') {
      const functionName = this.getFunctionName(astNode);
      if (functionName.includes('addEventListener') || functionName.includes('removeEventListener')) {
        return 'event_lifecycle';
      }
    } else if (astNode.type === 'class') {
      return 'class_lifecycle';
    }
    
    return 'unknown';
  }

 /**
   * 提取生命周期上下文
   */
  private extractLifecycleContext(astNode: Parser.SyntaxNode): any {
    const context: any = {};
    
    // 查找所属的类或对象
    const parentClass = this.findParentClass(astNode);
    if (parentClass) {
      context.parentClass = parentClass.text;
      context.parentClassName = this.getClassName(parentClass);
    }
    
    // 查找所属的组件（React等）
    const parentComponent = this.findParentComponent(astNode);
    if (parentComponent) {
      context.parentComponent = parentComponent.text;
      context.parentComponentName = this.getComponentName(parentComponent);
    }
    
    return context;
 }

  /**
   * 提取生命周期依赖关系
   */
  private extractLifecycleDependencies(astNode: Parser.SyntaxNode): string[] {
    const dependencies: string[] = [];
    
    if (!astNode) return dependencies;

    // 查找生命周期方法中的函数调用
    JsHelperMethods.findFunctionCalls(astNode, dependencies);
    JsHelperMethods.findVariableReferences(astNode, dependencies);
    
    return [...new Set(dependencies)]; // 去重
 }

  /**
   * 检查是否为关键生命周期方法
   */
  private isCriticalLifecycle(astNode: Parser.SyntaxNode): boolean {
    if (!astNode) return false;

    if (astNode.type === 'function_declaration' || astNode.type === 'method_definition') {
      const methodName = this.getMethodName(astNode);
      return this.isCriticalLifecycleMethod(methodName);
    }
    
    return false;
  }

 /**
   * 获取方法名
   */
  private getMethodName(node: Parser.SyntaxNode): string {
    if (!node) return '';

    // 查找方法名
    if (node.type === 'method_definition' || node.type === 'function_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        return nameNode.text;
      }
      
      // 如果没有name字段，查找第一个标识符
      if (node.children) {
        for (const child of node.children) {
          if (child.type === 'identifier') {
            return child.text;
          }
        }
      }
    }
    
    return '';
  }

  /**
   * 获取函数名（对于调用表达式）
   */
  private getFunctionName(node: Parser.SyntaxNode): string {
    if (!node || node.type !== 'call_expression') return '';

    const funcNode = node.childForFieldName('function');
    if (!funcNode) return '';

    if (funcNode.type === 'member_expression') {
      // 处理 obj.method() 形式
      const property = funcNode.childForFieldName('property');
      if (property) {
        const object = funcNode.childForFieldName('object');
        return `${object?.text || ''}.${property.text}`;
      }
    } else {
      return funcNode.text;
    }

    return '';
  }

  /**
   * 获取类名
   */
  private getClassName(node: Parser.SyntaxNode): string {
    if (!node) return '';

    if (node.type === 'class' || node.type === 'class_declaration') {
      const nameNode = node.childForFieldName('name');
      if (nameNode) {
        return nameNode.text;
      }
    }
    
    return '';
  }

  /**
   * 获取组件名
   */
 private getComponentName(node: Parser.SyntaxNode): string {
    return this.getClassName(node); // 对于JS/TS，组件通常也是类或函数
  }

  /**
   * 获取生命周期阶段
   */
  private getLifecycleStage(methodName: string): string | null {
    const lifecycleMap: Record<string, string> = {
      // React生命周期方法
      'constructor': 'initialization',
      'componentDidMount': 'mount',
      'componentDidUpdate': 'update',
      'componentWillUnmount': 'unmount',
      'render': 'render',
      'getDerivedStateFromProps': 'update',
      'shouldComponentUpdate': 'update',
      'getSnapshotBeforeUpdate': 'update',
      'componentDidCatch': 'error',
      
      // Vue生命周期方法
      'beforeCreate': 'initialization',
      'created': 'initialization',
      'beforeMount': 'mount',
      'mounted': 'mount',
      'beforeUpdate': 'update',
      'updated': 'update',
      'beforeDestroy': 'unmount',
      'destroyed': 'unmount',
      'activated': 'activation',
      'deactivated': 'deactivation',
      
      // Angular生命周期方法
      'ngOnInit': 'initialization',
      'ngOnChanges': 'update',
      'ngDoCheck': 'update',
      'ngAfterContentInit': 'mount',
      'ngAfterContentChecked': 'update',
      'ngAfterViewInit': 'mount',
      'ngAfterViewChecked': 'update',
      'ngOnDestroy': 'unmount',
      
      // 通用生命周期方法
      'init': 'initialization',
      'initialize': 'initialization',
      'setup': 'initialization',
      'destroy': 'unmount',
      'cleanup': 'unmount',
      'dispose': 'unmount'
    };
    
    return lifecycleMap[methodName] || null;
  }

  /**
   * 检查是否为关键生命周期方法
   */
  private isCriticalLifecycleMethod(methodName: string): boolean {
    const criticalMethods = [
      'constructor',
      'componentDidMount',
      'componentWillUnmount',
      'ngOnInit',
      'ngOnDestroy',
      'init',
      'destroy'
    ];
    
    return criticalMethods.includes(methodName);
  }

 /**
   * 查找父类
   */
  private findParentClass(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (!node) return null;
    
    let currentNode = node.parent;
    while (currentNode) {
      if (currentNode.type === 'class' || currentNode.type === 'class_declaration') {
        return currentNode;
      }
      currentNode = currentNode.parent;
    }
    
    return null;
  }

  /**
   * 查找父组件
   */
  private findParentComponent(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (!node) return null;
    
    let currentNode = node.parent;
    while (currentNode) {
      if (currentNode.type === 'class' || currentNode.type === 'class_declaration' || 
          currentNode.type === 'function_declaration') {
        // 检查是否为组件类或函数
        const name = this.getClassName(currentNode) || this.getMethodName(currentNode);
        if (this.isComponentName(name)) {
          return currentNode;
        }
      }
      currentNode = currentNode.parent;
    }
    
    return null;
  }

  /**
   * 检查是否为组件名称
   */
  private isComponentName(name: string): boolean {
    // 组件名称通常以大写字母开头
    return name.length > 0 && name[0] === name[0].toUpperCase();
  }
}