import {
  SemanticRelationship,
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
 * TypeScript语义关系提取器
 * 提取如重写、重载、委托、观察、配置等语义关系
 */
@injectable()
export class SemanticExtractor extends BaseJavaScriptRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super(treeSitterService, logger);
  }
  
  /**
   * 提取语义关系
   */
  async extractSemanticRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<SemanticRelationship[]> {
    const relationships: SemanticRelationship[] = [];
    
    // 遍历AST查找语义关系
    this.traverseAST(ast, (node) => {
      // 检查重写关系 (override)
      if (this.isOverrideMethod(node)) {
        const relationship = this.extractOverrideRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
      
      // 检查重载关系 (overload)
      if (this.isOverloadedMethod(node)) {
        const relationship = this.extractOverloadRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
      
      // 检查委托关系 (delegation)
      if (this.isDelegationPattern(node)) {
        const relationship = this.extractDelegationRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
      
      // 检查观察者模式 (observer)
      if (this.isObserverPattern(node)) {
        const relationship = this.extractObserverRelationship(node, filePath, symbolResolver);
        if (relationship) {
          relationships.push(relationship);
        }
      }
      
      // 检查配置关系 (configuration)
      if (this.isConfigurationPattern(node)) {
        const relationship = this.extractConfigurationRelationship(node, filePath, symbolResolver);
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
   * 检查是否为重写方法
   */
  protected isOverrideMethod(node: Parser.SyntaxNode): boolean {
    // 检查是否有override关键字或装饰器
    if (node.type === 'method_definition') {
      for (const child of node.children) {
        if (child.type === 'override' || 
            (child.type === 'decorator' && child.text.includes('Override'))) {
          return true;
        }
      }
    }
    return false;
  }
  
  /**
   * 提取重写关系
   */
  protected extractOverrideRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): SemanticRelationship | null {
    const methodName = this.extractMethodName(node);
    if (!methodName) return null;
    
    const methodSymbol = symbolResolver.resolveSymbol(methodName, filePath, node);
    if (!methodSymbol) return null;
    
    // 尝试找到父类中的同名方法
    const parentClassSymbol = this.findParentClassSymbol(node, symbolResolver, filePath);
    if (!parentClassSymbol) return null;
    
    const parentMethodSymbol = symbolResolver.resolveSymbol(methodName, parentClassSymbol.filePath || '', node);
    if (!parentMethodSymbol) return null;
    
    return {
      sourceId: this.generateSymbolId(methodSymbol),
      targetId: this.generateSymbolId(parentMethodSymbol),
      semanticType: 'overrides',
      metadata: {
        overrideKeyword: true,
        signatureMatch: this.checkSignatureMatch(node, parentMethodSymbol)
      },
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedSourceSymbol: methodSymbol,
      resolvedTargetSymbol: parentMethodSymbol
    };
  }
  
  /**
   * 检查是否为重载方法
   */
  protected isOverloadedMethod(node: Parser.SyntaxNode): boolean {
    // 在TypeScript中，重载通常通过多个同名方法签名来定义
    // 这里简化处理，检查是否有多个同名方法
    return node.type === 'method_definition' || node.type === 'function_declaration';
  }
  
  /**
   * 提取重载关系
   */
  protected extractOverloadRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): SemanticRelationship | null {
    const methodName = this.extractMethodName(node);
    if (!methodName) return null;
    
    const methodSymbol = symbolResolver.resolveSymbol(methodName, filePath, node);
    if (!methodSymbol) return null;
    
    // 查找同名的其他方法
    // 这里简化处理，实际实现需要更复杂的逻辑
    return {
      sourceId: this.generateSymbolId(methodSymbol),
      targetId: '', // 需要找到另一个重载方法
      semanticType: 'overloads',
      metadata: {
        parameterCount: this.getParameterCount(node),
        returnType: this.getReturnType(node)
      },
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedSourceSymbol: methodSymbol
    };
  }
  
  /**
   * 检查是否为委托模式
   */
  protected isDelegationPattern(node: Parser.SyntaxNode): boolean {
    // 检查方法是否只是调用另一个对象的方法
    if (node.type === 'method_definition') {
      const body = this.findMethodBody(node);
      if (body && this.isSimpleDelegation(body)) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * 提取委托关系
   */
  protected extractDelegationRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): SemanticRelationship | null {
    const methodName = this.extractMethodName(node);
    if (!methodName) return null;
    
    const methodSymbol = symbolResolver.resolveSymbol(methodName, filePath, node);
    if (!methodSymbol) return null;
    
    const body = this.findMethodBody(node);
    if (!body) return null;
    
    const delegatedCall = this.extractDelegatedCall(body);
    if (!delegatedCall) return null;
    
    const delegatedSymbol = symbolResolver.resolveSymbol(delegatedCall.methodName, filePath, delegatedCall.node);
    if (!delegatedSymbol) return null;
    
    return {
      sourceId: this.generateSymbolId(methodSymbol),
      targetId: this.generateSymbolId(delegatedSymbol),
      semanticType: 'delegates',
      metadata: {
        delegatedObject: delegatedCall.objectName,
        delegatedMethod: delegatedCall.methodName
      },
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedSourceSymbol: methodSymbol,
      resolvedTargetSymbol: delegatedSymbol
    };
  }
  
  /**
   * 检查是否为观察者模式
   */
  protected isObserverPattern(node: Parser.SyntaxNode): boolean {
    // 检查是否有订阅/发布模式的方法调用
    if (node.type === 'call_expression') {
      const methodName = this.extractCalleeName(node);
      return methodName === 'subscribe' || methodName === 'addEventListener' || 
             methodName === 'on' || methodName === 'watch';
    }
    return false;
  }
  
  /**
   * 提取观察者关系
   */
  protected extractObserverRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): SemanticRelationship | null {
    const methodName = this.extractCalleeName(node);
    if (!methodName) return null;
    
    // 查找调用者
    const callerSymbol = this.findCallerSymbol(node, symbolResolver, filePath);
    if (!callerSymbol) return null;
    
    // 查找被观察的对象
    const observedObject = this.extractObservedObject(node);
    if (!observedObject) return null;
    
    const observedSymbol = symbolResolver.resolveSymbol(observedObject, filePath, node);
    if (!observedSymbol) return null;
    
    return {
      sourceId: this.generateSymbolId(callerSymbol),
      targetId: this.generateSymbolId(observedSymbol),
      semanticType: 'observes',
      metadata: {
        event: this.extractEventName(node),
        callback: this.extractCallbackFunction(node)
      },
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedSourceSymbol: callerSymbol,
      resolvedTargetSymbol: observedSymbol
    };
  }
  
  /**
   * 检查是否为配置模式
   */
  protected isConfigurationPattern(node: Parser.SyntaxNode): boolean {
    // 检查是否有配置相关的方法调用
    if (node.type === 'call_expression') {
      const methodName = this.extractCalleeName(node);
      return methodName === 'configure' || methodName === 'config' || 
             methodName === 'setup' || methodName === 'initialize';
    }
    return false;
  }
  
  /**
   * 提取配置关系
   */
  protected extractConfigurationRelationship(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): SemanticRelationship | null {
    const methodName = this.extractCalleeName(node);
    if (!methodName) return null;
    
    // 查找配置者
    const configurerSymbol = this.findCallerSymbol(node, symbolResolver, filePath);
    if (!configurerSymbol) return null;
    
    // 查找被配置的对象
    const configuredObject = this.extractConfiguredObject(node);
    if (!configuredObject) return null;
    
    const configuredSymbol = symbolResolver.resolveSymbol(configuredObject, filePath, node);
    if (!configuredSymbol) return null;
    
    return {
      sourceId: this.generateSymbolId(configurerSymbol),
      targetId: this.generateSymbolId(configuredSymbol),
      semanticType: 'configures',
      metadata: {
        configOptions: this.extractConfigOptions(node)
      },
      location: {
        filePath,
        lineNumber: node.startPosition.row + 1,
        columnNumber: node.startPosition.column + 1
      },
      resolvedSourceSymbol: configurerSymbol,
      resolvedTargetSymbol: configuredSymbol
    };
  }
  
  // 辅助方法
  protected extractMethodName(node: Parser.SyntaxNode): string | null {
    for (const child of node.children) {
      if (child.type === 'property_identifier' || child.type === 'identifier') {
        return child.text;
      }
    }
    return null;
  }
  
  protected generateSymbolId(symbol: any): string {
    return `${symbol.type}_${Buffer.from(`${symbol.filePath}_${symbol.name}`).toString('hex')}`;
  }
  
  protected findParentClassSymbol(node: Parser.SyntaxNode, symbolResolver: SymbolResolver, filePath: string): any {
    // 向上遍历AST找到类定义
    let currentNode: Parser.SyntaxNode | null = node.parent;
    while (currentNode) {
      if (currentNode.type === 'class_declaration' || currentNode.type === 'class') {
        const className = this.extractClassName(currentNode);
        if (className) {
          return symbolResolver.resolveSymbol(className, filePath, currentNode);
        }
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
  
  protected checkSignatureMatch(node: Parser.SyntaxNode, parentSymbol: any): boolean {
    // 简化实现，实际需要比较参数类型和返回类型
    return true;
  }
  
  protected getParameterCount(node: Parser.SyntaxNode): number {
    // 提取参数数量
    for (const child of node.children) {
      if (child.type === 'formal_parameters') {
        return child.children.filter(c => c.type === 'formal_parameter').length;
      }
    }
    return 0;
  }
  
  protected getReturnType(node: Parser.SyntaxNode): string | null {
    // 提取返回类型
    for (const child of node.children) {
      if (child.type === 'type_annotation') {
        return child.text;
      }
    }
    return null;
  }
  
  protected findMethodBody(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    for (const child of node.children) {
      if (child.type === 'statement_block') {
        return child;
      }
    }
    return null;
  }
  
  protected isSimpleDelegation(body: Parser.SyntaxNode): boolean {
    // 检查方法体是否只是一个简单的委托调用
    const statements = body.children.filter(c => c.type === 'expression_statement');
    return statements.length === 1 && 
           statements[0].children[0]?.type === 'call_expression';
  }
  
  protected extractDelegatedCall(body: Parser.SyntaxNode): { methodName: string; objectName: string; node: Parser.SyntaxNode } | null {
    const statement = body.children.find(c => c.type === 'expression_statement');
    if (!statement) return null;
    
    const callExpr = statement.children[0];
    if (callExpr?.type !== 'call_expression') return null;
    
    const funcNode = callExpr.children[0];
    if (funcNode?.type !== 'member_expression') return null;
    
    const objectName = funcNode.children[0]?.text;
    const methodName = funcNode.children[2]?.text;
    
    if (objectName && methodName) {
      return { methodName, objectName, node: callExpr };
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
  
  protected extractObservedObject(node: Parser.SyntaxNode): string | null {
    if (node.children && node.children.length > 0) {
      const funcNode = node.children[0];
      if (funcNode.type === 'member_expression') {
        return funcNode.children[0]?.text || null;
      }
    }
    return null;
  }
  
  protected extractEventName(node: Parser.SyntaxNode): string | null {
    // 从参数中提取事件名
    for (const child of node.children) {
      if (child.type === 'arguments') {
        const firstArg = child.children[0];
        if (firstArg && (firstArg.type === 'string' || firstArg.type === 'template_string')) {
          return firstArg.text.replace(/['"`]/g, '');
        }
      }
    }
    return null;
  }
  
  protected extractCallbackFunction(node: Parser.SyntaxNode): string | null {
    // 从参数中提取回调函数
    for (const child of node.children) {
      if (child.type === 'arguments') {
        for (const arg of child.children) {
          if (arg.type === 'function' || arg.type === 'arrow_function') {
            return 'function';
          } else if (arg.type === 'identifier') {
            return arg.text;
          }
        }
      }
    }
    return null;
  }
  
  protected extractConfiguredObject(node: Parser.SyntaxNode): string | null {
    if (node.children && node.children.length > 0) {
      const funcNode = node.children[0];
      if (funcNode.type === 'member_expression') {
        return funcNode.children[0]?.text || null;
      } else if (funcNode.type === 'identifier') {
        return funcNode.text;
      }
    }
    return null;
  }
  
  protected extractConfigOptions(node: Parser.SyntaxNode): Record<string, any> {
    // 从参数中提取配置选项
    const options: Record<string, any> = {};
    
    for (const child of node.children) {
      if (child.type === 'arguments') {
        const firstArg = child.children[0];
        if (firstArg && firstArg.type === 'object') {
          // 简化处理，实际需要解析对象字面量
          options.config = firstArg.text;
        }
      }
    }
    
    return options;
  }
}