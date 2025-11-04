import {
  LifecycleRelationship,
  SymbolResolver,
  BaseJavaScriptRelationshipExtractor,
  TreeSitterService,
  LoggerService,
  inject,
  injectable,
  TYPES,
  Parser
} from '../types';

/**
 * TypeScript生命周期关系提取器
 * 提取如实例化、初始化、销毁、管理等生命周期关系
 */
@injectable()
export class LifecycleExtractor extends BaseJavaScriptRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super(treeSitterService, logger);
  }
  
  /**
   * 提取生命周期关系
   */
  async extractLifecycleRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<LifecycleRelationship[]> {
    const relationships: LifecycleRelationship[] = [];
    
    // 遍历AST查找生命周期关系
    this.traverseAST(ast, (node) => {
      // 检查实例化关系
      if (this.isInstantiation(node)) {
        const relationship = this.extractInstantiationRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
      
      // 检查初始化关系
      if (this.isInitialization(node)) {
        const relationship = this.extractInitializationRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
      
      // 检查销毁关系
      if (this.isDestruction(node)) {
        const relationship = this.extractDestructionRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
      
      // 检查管理关系
      if (this.isManagement(node)) {
        const relationship = this.extractManagementRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
    });
    
    return relationships;
  }
  
  /**
   * 遍历AST节点
   */
  protected traverseAST(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void): void {
    callback(node);
    for (const child of node.children) {
      this.traverseAST(child, callback);
    }
  }
  
  /**
   * 检查是否为实例化关系
   */
  protected isInstantiation(node: Parser.SyntaxNode): boolean {
    // 检查new表达式
    return node.type === 'new_expression';
  }
  
  /**
   * 提取实例化关系
   */
  protected extractInstantiationRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): LifecycleRelationship | null {
    const className = this.extractClassNameFromNewExpression(node);
    if (!className) return null;
    
    // 查找实例化者
    const instantiatorSymbol = this.findInstantiatorSymbol(node, symbolResolver, filePath);
    if (!instantiatorSymbol) return null;
    
    // 查找被实例化的类
    const classSymbol = symbolResolver.resolveSymbol(className, filePath, node);
    if (!classSymbol) return null;
    
    return {
      sourceId: this.generateSymbolId(instantiatorSymbol),
      targetId: this.generateSymbolId(classSymbol),
      lifecycleType: 'instantiates',
      lifecyclePhase: 'creation',
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedTargetSymbol: classSymbol
    };
  }
  
  /**
   * 检查是否为初始化关系
   */
  protected isInitialization(node: Parser.SyntaxNode): boolean {
    // 检查构造函数调用或初始化方法调用
    if (node.type === 'call_expression') {
      const methodName = this.extractCalleeName(node);
      return methodName === 'constructor' || 
             methodName === 'init' || 
             methodName === 'initialize' || 
             methodName === 'setup' ||
             methodName === 'configure';
    }
    
    // 检查构造函数定义
    if (node.type === 'method_definition') {
      for (const child of node.children) {
        if (child.type === 'property_identifier' && child.text === 'constructor') {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * 提取初始化关系
   */
  protected extractInitializationRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): LifecycleRelationship | null {
    let initializerSymbol: any;
    let targetSymbol: any;
    
    if (node.type === 'call_expression') {
      // 方法调用形式的初始化
      const methodName = this.extractCalleeName(node);
      if (!methodName) return null;
      
      initializerSymbol = this.findCallerSymbol(node, symbolResolver, filePath);
      if (!initializerSymbol) return null;
      
      const targetName = this.extractTargetObject(node);
      if (!targetName) return null;
      
      targetSymbol = symbolResolver.resolveSymbol(targetName, filePath, node);
      if (!targetSymbol) return null;
    } else if (node.type === 'method_definition') {
      // 构造函数定义形式的初始化
      const className = this.findContainingClassName(node, filePath);
      if (!className) return null;
      
      targetSymbol = symbolResolver.resolveSymbol(className, filePath, node);
      if (!targetSymbol) return null;
      
      // 构造函数的初始化者是类本身
      initializerSymbol = targetSymbol;
    } else {
      return null;
    }
    
    return {
      sourceId: this.generateSymbolId(initializerSymbol),
      targetId: this.generateSymbolId(targetSymbol),
      lifecycleType: 'initializes',
      lifecyclePhase: 'setup',
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedTargetSymbol: targetSymbol
    };
  }
  
  /**
   * 检查是否为销毁关系
   */
  protected isDestruction(node: Parser.SyntaxNode): boolean {
    // 检查销毁方法调用
    if (node.type === 'call_expression') {
      const methodName = this.extractCalleeName(node);
      return methodName === 'destroy' || 
             methodName === 'dispose' || 
             methodName === 'cleanup' || 
             methodName === 'close' ||
             methodName === 'terminate';
    }
    
    // 检查析构函数定义
    if (node.type === 'method_definition') {
      for (const child of node.children) {
        if (child.type === 'property_identifier' && 
            (child.text === 'destroy' || child.text === 'dispose' || child.text === 'cleanup')) {
          return true;
        }
      }
    }
    
    // 检查delete操作符
    if (node.type === 'delete_expression') {
      return true;
    }
    
    return false;
  }
  
  /**
   * 提取销毁关系
   */
  protected extractDestructionRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): LifecycleRelationship | null {
    let destroyerSymbol: any;
    let targetSymbol: any;
    
    if (node.type === 'call_expression') {
      // 方法调用形式的销毁
      const methodName = this.extractCalleeName(node);
      if (!methodName) return null;
      
      destroyerSymbol = this.findCallerSymbol(node, symbolResolver, filePath);
      if (!destroyerSymbol) return null;
      
      const targetName = this.extractTargetObject(node);
      if (!targetName) return null;
      
      targetSymbol = symbolResolver.resolveSymbol(targetName, filePath, node);
      if (!targetSymbol) return null;
    } else if (node.type === 'method_definition') {
      // 析构函数定义形式的销毁
      const className = this.findContainingClassName(node, filePath);
      if (!className) return null;
      
      targetSymbol = symbolResolver.resolveSymbol(className, filePath, node);
      if (!targetSymbol) return null;
      
      // 析构函数的销毁者是类本身
      destroyerSymbol = targetSymbol;
    } else if (node.type === 'delete_expression') {
      // delete操作符形式的销毁
      destroyerSymbol = this.findCallerSymbol(node, symbolResolver, filePath);
      if (!destroyerSymbol) return null;
      
      const targetName = this.extractTargetFromDeleteExpression(node);
      if (!targetName) return null;
      
      targetSymbol = symbolResolver.resolveSymbol(targetName, filePath, node);
      if (!targetSymbol) return null;
    } else {
      return null;
    }
    
    return {
      sourceId: this.generateSymbolId(destroyerSymbol),
      targetId: this.generateSymbolId(targetSymbol),
      lifecycleType: 'destroys',
      lifecyclePhase: 'teardown',
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedTargetSymbol: targetSymbol
    };
  }
  
  /**
   * 检查是否为管理关系
   */
  protected isManagement(node: Parser.SyntaxNode): boolean {
    // 检查管理方法调用
    if (node.type === 'call_expression') {
      const methodName = this.extractCalleeName(node);
      return methodName === 'manage' || 
             methodName === 'maintain' || 
             methodName === 'update' || 
             methodName === 'refresh' ||
             methodName === 'restart';
    }
    
    // 检查管理器类定义
    if (node.type === 'class_declaration') {
      const className = this.extractClassName(node);
      if (!className) return false;
      
      // 检查类名是否包含Manager、Controller等管理相关词汇
      return className.includes('Manager') || 
             className.includes('Controller') || 
             className.includes('Service') ||
             className.includes('Handler');
    }
    
    return false;
  }
  
  /**
   * 提取管理关系
   */
  protected extractManagementRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): LifecycleRelationship | null {
    let managerSymbol: any;
    let targetSymbol: any;
    
    if (node.type === 'call_expression') {
      // 方法调用形式的管理
      const methodName = this.extractCalleeName(node);
      if (!methodName) return null;
      
      managerSymbol = this.findCallerSymbol(node, symbolResolver, filePath);
      if (!managerSymbol) return null;
      
      const targetName = this.extractTargetObject(node);
      if (!targetName) return null;
      
      targetSymbol = symbolResolver.resolveSymbol(targetName, filePath, node);
      if (!targetSymbol) return null;
    } else if (node.type === 'class_declaration') {
      // 管理器类形式的管理
      const className = this.extractClassName(node);
      if (!className) return null;
      
      managerSymbol = symbolResolver.resolveSymbol(className, filePath, node);
      if (!managerSymbol) return null;
      
      // 查找管理的目标类型
      const managedType = this.extractManagedType(node);
      if (!managedType) return null;
      
      targetSymbol = symbolResolver.resolveSymbol(managedType, filePath, node);
      if (!targetSymbol) return null;
    } else {
      return null;
    }
    
    return {
      sourceId: this.generateSymbolId(managerSymbol),
      targetId: this.generateSymbolId(targetSymbol),
      lifecycleType: 'manages',
      lifecyclePhase: 'maintenance',
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedTargetSymbol: targetSymbol
    };
  }
  
  // 辅助方法
  protected generateSymbolId(symbol: any): string {
    return `${symbol.type}_${Buffer.from(`${symbol.filePath}_${symbol.name}`).toString('hex')}`;
  }
  
  protected extractClassNameFromNewExpression(node: Parser.SyntaxNode): string | null {
    if (node.children && node.children.length > 0) {
      const classNode = node.children[0];
      if (classNode.type === 'identifier' || classNode.type === 'type_identifier') {
        return classNode.text;
      } else if (classNode.type === 'member_expression') {
        return this.extractMemberExpressionName(classNode);
      }
    }
    return null;
  }
  
  protected extractMemberExpressionName(memberExpr: Parser.SyntaxNode): string | null {
    const parts: string[] = [];
    this.collectMemberExpressionParts(memberExpr, parts);
    return parts.join('.');
  }
  
  protected collectMemberExpressionParts(memberExpr: Parser.SyntaxNode, parts: string[]): void {
    for (const child of memberExpr.children) {
      if (child.type === 'identifier' || child.type === 'property_identifier' || child.type === 'type_identifier') {
        parts.unshift(child.text);
      } else if (child.type === 'member_expression') {
        this.collectMemberExpressionParts(child, parts);
      }
    }
  }
  
  protected findInstantiatorSymbol(node: Parser.SyntaxNode, symbolResolver: SymbolResolver, filePath: string): any {
    let currentNode: Parser.SyntaxNode | null = node.parent;
    while (currentNode) {
      if (currentNode.type === 'function_declaration' ||
          currentNode.type === 'method_definition' ||
          currentNode.type === 'arrow_function' ||
          currentNode.type === 'function') {
        for (const child of currentNode.children) {
          if (child.type === 'identifier' || child.type === 'property_identifier') {
            const funcName = child.text;
            if (funcName) {
              return symbolResolver.resolveSymbol(funcName, filePath, child);
            }
          }
        }
      }
      currentNode = currentNode.parent;
    }
    return null;
  }
  
  protected extractCalleeName(node: Parser.SyntaxNode): string | null {
    if (node.children && node.children.length > 0) {
      const funcNode = node.children[0];
      if (funcNode.type === 'identifier') {
        return funcNode.text;
      } else if (funcNode.type === 'member_expression') {
        return this.extractMethodNameFromMemberExpression(funcNode);
      }
    }
    return null;
  }
  
  protected extractMethodNameFromMemberExpression(memberExpr: Parser.SyntaxNode): string | null {
    if (memberExpr.children && memberExpr.children.length > 0) {
      const lastChild = memberExpr.children[memberExpr.children.length - 1];
      if (lastChild.type === 'property_identifier' || lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }
  
  protected findCallerSymbol(callExpr: Parser.SyntaxNode, symbolResolver: SymbolResolver, filePath: string): any {
    let currentNode: Parser.SyntaxNode | null = callExpr.parent;
    while (currentNode) {
      if (currentNode.type === 'function_declaration' ||
          currentNode.type === 'method_definition' ||
          currentNode.type === 'arrow_function' ||
          currentNode.type === 'function') {
        for (const child of currentNode.children) {
          if (child.type === 'identifier' || child.type === 'property_identifier') {
            const funcName = child.text;
            if (funcName) {
              return symbolResolver.resolveSymbol(funcName, filePath, child);
            }
          }
        }
      }
      currentNode = currentNode.parent;
    }
    return null;
  }
  
  protected extractTargetObject(node: Parser.SyntaxNode): string | null {
    if (node.children && node.children.length > 0) {
      const funcNode = node.children[0];
      if (funcNode.type === 'member_expression') {
        return funcNode.children[0]?.text || null;
      }
    }
    return null;
  }
  
  protected findContainingClassName(node: Parser.SyntaxNode, filePath: string): string | null {
    let currentNode: Parser.SyntaxNode | null = node.parent;
    while (currentNode) {
      if (currentNode.type === 'class_declaration' || currentNode.type === 'class') {
        return this.extractClassName(currentNode);
      }
      currentNode = currentNode.parent;
    }
    return null;
  }
  
  protected extractClassName(node: Parser.SyntaxNode): string | null {
    for (const child of node.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return child.text;
      }
    }
    return null;
  }
  
  protected extractTargetFromDeleteExpression(node: Parser.SyntaxNode): string | null {
    if (node.children && node.children.length > 0) {
      const targetNode = node.children[0];
      if (targetNode.type === 'identifier') {
        return targetNode.text;
      } else if (targetNode.type === 'member_expression') {
        return this.extractMemberExpressionName(targetNode);
      }
    }
    return null;
  }
  
  protected extractManagedType(node: Parser.SyntaxNode): string | null {
    // 从类定义中提取管理的类型
    // 这里简化处理，实际需要分析类的字段、方法等
    for (const child of node.children) {
      if (child.type === 'class_body') {
        for (const grandChild of child.children) {
          if (grandChild.type === 'field_declaration') {
            // 查找字段类型
            for (const fieldChild of grandChild.children) {
              if (fieldChild.type === 'type_annotation') {
                return this.extractTypeName(fieldChild);
              }
            }
          }
        }
      }
    }
    return null;
  }
  
  protected extractTypeName(typeNode: Parser.SyntaxNode): string | null {
    for (const child of typeNode.children) {
      if (child.type === 'type_identifier' || child.type === 'identifier') {
        return child.text;
      }
    }
    return null;
  }
}