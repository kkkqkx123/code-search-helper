import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { JavaHelperMethods } from './JavaHelperMethods';
import Parser from 'tree-sitter';

/**
 * Java 语义关系提取器
 * 从 JavaLanguageAdapter 迁移语义关系提取逻辑
 */
export class SemanticRelationshipExtractor {
  /**
   * 提取语义关系元数据
   */
  extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const captures = result.captures || [];
    const metadata: any = {
      type: 'semantic',
      location: {
        filePath: symbolTable?.filePath || 'current_file.java',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column
      }
    };

    // 提取语义关系类型
    for (const capture of captures) {
      if (capture.name.includes('override')) {
        metadata.semanticType = 'overrides';
        metadata.overriddenMethod = capture.node.text;
        metadata.fromNodeId = generateDeterministicNodeId(astNode);
        metadata.toNodeId = generateDeterministicNodeId(capture.node);
      } else if (capture.name.includes('implement')) {
        metadata.semanticType = 'implements';
        metadata.implementedInterface = capture.node.text;
        metadata.fromNodeId = generateDeterministicNodeId(astNode);
        metadata.toNodeId = generateDeterministicNodeId(capture.node);
      } else if (capture.name.includes('annotation')) {
        metadata.annotation = capture.node.text;
        metadata.fromNodeId = generateDeterministicNodeId(astNode);
        metadata.toNodeId = generateDeterministicNodeId(capture.node);
      }
    }

    // 如果没有从捕获中获取到信息，尝试从AST节点分析
    if (!metadata.semanticType) {
      this.analyzeSemanticFromAST(astNode, metadata);
    }

    return metadata;
  }

  /**
   * 从AST节点分析语义关系
   */
  private analyzeSemanticFromAST(astNode: Parser.SyntaxNode, metadata: any): void {
    const text = astNode.text || '';
    
    // 检查是否是重写方法（包含@Overide注解）
    if (text.includes('@Override')) {
      metadata.semanticType = 'overrides';
      const methodName = astNode.childForFieldName('name');
      if (methodName?.text) {
        metadata.overriddenMethod = methodName.text;
        metadata.toNodeId = generateDeterministicNodeId(methodName);
      }
      metadata.fromNodeId = generateDeterministicNodeId(astNode);
    }

    // 检查是否是重载方法
    if (astNode.type === 'method_declaration') {
      const methodName = astNode.childForFieldName('name');
      if (methodName?.text) {
        // 检查是否有同名方法（重载）
        const parentClass = this.findParentClass(astNode);
        if (parentClass) {
          const overloadedMethods = this.findOverloadedMethods(parentClass, methodName.text);
          if (overloadedMethods.length > 0) {
            metadata.semanticType = 'overloads';
            metadata.overloadedMethod = methodName.text;
            metadata.fromNodeId = generateDeterministicNodeId(astNode);
            metadata.toNodeId = generateDeterministicNodeId(overloadedMethods[0]);
          }
        }
      }
    }

    // 检查是否是配置或观察者模式（通过注解）
    if (text.includes('@Configuration') || text.includes('@Bean')) {
      metadata.semanticType = 'configures';
      metadata.configuredComponent = this.extractConfiguredComponent(astNode);
      metadata.fromNodeId = generateDeterministicNodeId(astNode);
    }

    if (text.includes('@EventListener') || text.includes('@Subscribe') || 
        text.includes('@Observer') || text.includes('@EventHandler')) {
      metadata.semanticType = 'observes';
      metadata.observedEvent = this.extractObservedEvent(astNode);
      metadata.fromNodeId = generateDeterministicNodeId(astNode);
    }

    // 检查是否是委托模式
    if (text.includes('@Delegate') || this.isDelegatePattern(astNode)) {
      metadata.semanticType = 'delegates';
      metadata.delegatedMethod = this.extractDelegatedMethod(astNode);
      metadata.fromNodeId = generateDeterministicNodeId(astNode);
    }

    // 检查是否是依赖注入
    if (text.includes('@Autowired') || text.includes('@Inject') || 
        text.includes('@Resource') || text.includes('@Value')) {
      metadata.semanticType = 'configures'; // 将depends-on映射为configures以匹配基类类型
      metadata.dependency = this.extractDependency(astNode);
      metadata.fromNodeId = generateDeterministicNodeId(astNode);
    }
  }

  /**
   * 查找父类
   */
  private findParentClass(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = node.parent;
    while (current) {
      if (current.type === 'class_declaration' || current.type === 'interface_declaration') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * 查找重载方法
   */
  private findOverloadedMethods(parentClass: Parser.SyntaxNode, methodName: string): Parser.SyntaxNode[] {
    const overloadedMethods: Parser.SyntaxNode[] = [];
    
    for (const child of parentClass.children) {
      if (child.type === 'class_body' || child.type === 'interface_body') {
        for (const methodChild of child.children) {
          if (methodChild.type === 'method_declaration') {
            const nameNode = methodChild.childForFieldName('name');
            if (nameNode?.text === methodName) {
              overloadedMethods.push(methodChild);
            }
          }
        }
      }
    }
    
    return overloadedMethods;
  }

  /**
   * 检查是否是委托模式
   */
  private isDelegatePattern(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'method_declaration') {
      return false;
    }
    
    const body = node.childForFieldName('body');
    if (!body) {
      return false;
    }
    
    // 检查方法体是否只有一个方法调用
    const statements = body.children;
    if (statements.length === 1) {
      const statement = statements[0];
      if (statement.type === 'expression_statement') {
        const expression = statement.childForFieldName('expression');
        if (expression?.type === 'method_invocation') {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * 提取配置的组件
   */
  private extractConfiguredComponent(node: Parser.SyntaxNode): string | null {
    if (node.type === 'method_declaration') {
      const returnType = node.childForFieldName('type');
      if (returnType?.text) {
        return returnType.text;
      }
    }
    return null;
  }

  /**
   * 提取观察的事件
   */
  private extractObservedEvent(node: Parser.SyntaxNode): string | null {
    if (node.type === 'method_declaration') {
      const parameters = node.childForFieldName('parameters');
      if (parameters?.children) {
        for (const param of parameters.children) {
          if (param.type === 'formal_parameter') {
            const paramType = param.childForFieldName('type');
            if (paramType?.text) {
              return paramType.text;
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * 提取委托的方法
   */
  private extractDelegatedMethod(node: Parser.SyntaxNode): string | null {
    if (node.type === 'method_declaration') {
      const body = node.childForFieldName('body');
      if (body?.children) {
        const statement = body.children[0];
        if (statement.type === 'expression_statement') {
          const expression = statement.childForFieldName('expression');
          if (expression?.type === 'method_invocation') {
            const method = expression.childForFieldName('name');
            return method?.text || null;
          }
        }
      }
    }
    return null;
  }

  /**
   * 提取依赖
   */
  private extractDependency(node: Parser.SyntaxNode): string | null {
    if (node.type === 'field_declaration') {
      const type = node.childForFieldName('type');
      if (type?.text) {
        return type.text;
      }
    } else if (node.type === 'method_declaration') {
      const parameters = node.childForFieldName('parameters');
      if (parameters?.children) {
        for (const param of parameters.children) {
          if (param.type === 'formal_parameter') {
            const paramType = param.childForFieldName('type');
            if (paramType?.text) {
              return paramType.text;
            }
          }
        }
      }
    }
    return null;
  }

  /**
   * 提取语义关系数组
   */
  extractSemanticRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取Java中的语义关系
    const text = mainNode.text || '';
    
    // 检查是否是重写方法（包含@Overide注解）
    if (text.includes('@Override')) {
      relationships.push({
        source: 'base-method',
        target: 'overriding-method',
        type: 'overrides'
      });
    }

    // 检查是否是配置或观察者模式（通过注解）
    if (text.includes('@Configuration') || text.includes('@Bean')) {
      relationships.push({
        source: 'configuration',
        target: 'configurable',
        type: 'configures'
      });
    }

    if (text.includes('@EventListener') || text.includes('@Subscribe')) {
      relationships.push({
        source: 'event-emitter',
        target: 'listener',
        type: 'observes'
      });
    }

    // 检查是否是委托模式
    if (text.includes('@Delegate') || this.isDelegatePattern(mainNode)) {
      relationships.push({
        source: 'delegator',
        target: 'delegatee',
        type: 'delegates'
      });
    }

    // 检查是否是依赖注入
    if (text.includes('@Autowired') || text.includes('@Inject') || 
        text.includes('@Resource') || text.includes('@Value')) {
      relationships.push({
        source: 'dependent',
        target: 'dependency',
        type: 'configures' // 将depends-on映射为configures以匹配基类类型
      });
    }

    return relationships;
  }
}