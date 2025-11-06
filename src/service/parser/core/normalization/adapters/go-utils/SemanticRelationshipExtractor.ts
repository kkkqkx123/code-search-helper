import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { GoHelperMethods } from './GoHelperMethods';
import Parser from 'tree-sitter';

/**
 * Go 语义关系提取器
 * 从 GoLanguageAdapter 迁移的语义关系提取逻辑
 */
export class SemanticRelationshipExtractor {
  /**
   * 提取语义关系元数据
   */
  extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const semanticType = this.determineSemanticType(astNode);
    const sourceNode = this.extractSourceNode(astNode);
    const targetNode = this.extractTargetNode(astNode);

    return {
      type: 'semantic',
      fromNodeId: sourceNode ? generateDeterministicNodeId(sourceNode) : 'unknown',
      toNodeId: targetNode ? generateDeterministicNodeId(targetNode) : 'unknown',
      semanticType,
      pattern: this.extractDesignPattern(astNode),
      context: this.extractSemanticContext(astNode),
      location: {
        filePath: symbolTable?.filePath || 'current_file.go',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 确定语义类型
   */
  private determineSemanticType(astNode: Parser.SyntaxNode): 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures' | 'implements' | 'decorates' | 'composes' {
    const nodeType = astNode.type;
    
    if (nodeType === 'type_declaration') {
      const typeSpec = astNode.childForFieldName('type');
      if (typeSpec) {
        if (typeSpec.type === 'interface_type') {
          return 'configures';
        } else if (typeSpec.type === 'struct_type') {
          // 检查是否有嵌入字段
          const body = typeSpec.childForFieldName('body');
          if (body) {
            for (const child of body.children) {
              if (child.type === 'field_declaration' && this.isEmbeddedField(child)) {
                return 'composes';
              }
            }
          }
        }
      }
    } else if (nodeType === 'assignment_statement') {
      // 检查是否是函数赋值（委托）
      const rightNode = astNode.childForFieldName('right');
      if (rightNode?.type === 'func_literal' || rightNode?.type === 'identifier') {
        return 'delegates';
      }
    } else if (nodeType === 'function_declaration' || nodeType === 'method_declaration') {
      // 检查是否是接口方法实现
      return this.analyzeMethodImplementation(astNode);
    }
    
    return 'configures';
  }

  /**
   * 提取源节点
   */
  private extractSourceNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'type_declaration') {
      return astNode;
    } else if (nodeType === 'assignment_statement') {
      return astNode.childForFieldName('left');
    } else if (nodeType === 'function_declaration' || nodeType === 'method_declaration') {
      return astNode;
    }
    
    return null;
  }

  /**
   * 提取目标节点
   */
  private extractTargetNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'type_declaration') {
      const typeSpec = astNode.childForFieldName('type');
      if (typeSpec?.type === 'struct_type') {
        // 查找嵌入的字段
        const body = typeSpec.childForFieldName('body');
        if (body) {
          for (const child of body.children) {
            if (child.type === 'field_declaration' && this.isEmbeddedField(child)) {
              return child.childForFieldName('type');
            }
          }
        }
      }
    } else if (nodeType === 'assignment_statement') {
      return astNode.childForFieldName('right');
    } else if (nodeType === 'function_declaration' || nodeType === 'method_declaration') {
      // 对于方法实现，目标是接口方法
      return this.findInterfaceMethod(astNode);
    }
    
    return null;
  }

  /**
   * 提取设计模式
   */
  private extractDesignPattern(astNode: Parser.SyntaxNode): string | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'type_declaration') {
      const typeSpec = astNode.childForFieldName('type');
      if (typeSpec) {
        if (typeSpec.type === 'interface_type') {
          // 检查是否是策略模式
          if (this.isStrategyPattern(astNode)) {
            return 'strategy';
          }
          // 检查是否是观察者模式
          if (this.isObserverPattern(astNode)) {
            return 'observer';
          }
        } else if (typeSpec.type === 'struct_type') {
          // 检查是否是装饰器模式
          if (this.isDecoratorPattern(astNode)) {
            return 'decorator';
          }
          // 检查是否是组合模式
          if (this.isCompositePattern(astNode)) {
            return 'composite';
          }
        }
      }
    } else if (nodeType === 'function_declaration') {
      // 检查是否是工厂方法
      if (this.isFactoryMethod(astNode)) {
        return 'factory-method';
      }
      // 检查是否是单例模式
      if (this.isSingletonPattern(astNode)) {
        return 'singleton';
      }
    }
    
    return null;
  }

  /**
   * 提取语义上下文
   */
  private extractSemanticContext(astNode: Parser.SyntaxNode): Record<string, any> {
    const context: Record<string, any> = {};
    
    // 提取包信息
    let current = astNode;
    while (current) {
      if (current.type === 'source_file') {
        const packageClause = current.childForFieldName('package');
        if (packageClause) {
          const packageIdentifier = packageClause.childForFieldName('name');
          if (packageIdentifier) {
            context.package = packageIdentifier.text;
          }
        }
        break;
      }
      current = current.parent;
    }
    
    // 提取导入信息
    const imports = this.extractImports(astNode);
    if (imports.length > 0) {
      context.imports = imports;
    }
    
    // 提取注释信息
    const comments = this.extractComments(astNode);
    if (comments.length > 0) {
      context.comments = comments;
    }
    
    return context;
  }

  /**
   * 判断是否为嵌入字段
   */
  private isEmbeddedField(fieldNode: Parser.SyntaxNode): boolean {
    const nameNode = fieldNode.childForFieldName('name');
    return !nameNode;
  }

  /**
   * 分析方法实现
   */
  private analyzeMethodImplementation(methodNode: Parser.SyntaxNode): 'implements' | 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures' | 'decorates' | 'composes' {
    // 在Go中，方法实现通常是隐式的接口实现
    return 'implements';
  }

  /**
   * 查找接口方法
   */
  private findInterfaceMethod(methodNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 在实际实现中，这里需要查找该方法实现的接口方法
    // 目前返回null，表示需要进一步分析
    return null;
  }

  /**
   * 判断是否是策略模式
   */
  private isStrategyPattern(typeDecl: Parser.SyntaxNode): boolean {
    const typeSpec = typeDecl.childForFieldName('type');
    if (!typeSpec || typeSpec.type !== 'interface_type') {
      return false;
    }
    
    // 简单启发式：接口名包含"Strategy"或"Handler"
    const nameNode = typeDecl.childForFieldName('name');
    if (nameNode) {
      const name = nameNode.text.toLowerCase();
      return name.includes('strategy') || name.includes('handler');
    }
    
    return false;
  }

  /**
   * 判断是否是观察者模式
   */
  private isObserverPattern(typeDecl: Parser.SyntaxNode): boolean {
    const typeSpec = typeDecl.childForFieldName('type');
    if (!typeSpec || typeSpec.type !== 'interface_type') {
      return false;
    }
    
    // 简单启发式：接口名包含"Observer"或"Listener"，或包含Update/Notify方法
    const nameNode = typeDecl.childForFieldName('name');
    if (nameNode) {
      const name = nameNode.text.toLowerCase();
      if (name.includes('observer') || name.includes('listener')) {
        return true;
      }
    }
    
    // 检查方法
    const body = typeSpec.childForFieldName('body');
    if (body) {
      for (const child of body.children) {
        if (child.type === 'method_spec') {
          const methodName = child.childForFieldName('name');
          if (methodName) {
            const methodText = methodName.text.toLowerCase();
            if (methodText.includes('update') || methodText.includes('notify')) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * 判断是否是装饰器模式
   */
  private isDecoratorPattern(typeDecl: Parser.SyntaxNode): boolean {
    const typeSpec = typeDecl.childForFieldName('type');
    if (!typeSpec || typeSpec.type !== 'struct_type') {
      return false;
    }
    
    // 简单启发式：结构体名包含"Decorator"或"Wrapper"
    const nameNode = typeDecl.childForFieldName('name');
    if (nameNode) {
      const name = nameNode.text.toLowerCase();
      if (name.includes('decorator') || name.includes('wrapper')) {
        return true;
      }
    }
    
    // 检查是否有嵌入字段
    const body = typeSpec.childForFieldName('body');
    if (body) {
      for (const child of body.children) {
        if (child.type === 'field_declaration' && this.isEmbeddedField(child)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * 判断是否是组合模式
   */
  private isCompositePattern(typeDecl: Parser.SyntaxNode): boolean {
    const typeSpec = typeDecl.childForFieldName('type');
    if (!typeSpec || typeSpec.type !== 'struct_type') {
      return false;
    }
    
    // 简单启发式：结构体名包含"Composite"或"Component"
    const nameNode = typeDecl.childForFieldName('name');
    if (nameNode) {
      const name = nameNode.text.toLowerCase();
      if (name.includes('composite') || name.includes('component')) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 判断是否是工厂方法
   */
  private isFactoryMethod(funcDecl: Parser.SyntaxNode): boolean {
    const nameNode = funcDecl.childForFieldName('name');
    if (nameNode) {
      const name = nameNode.text.toLowerCase();
      return name.includes('new') || name.includes('create') || name.includes('make');
    }
    
    return false;
  }

  /**
   * 判断是否是单例模式
   */
  private isSingletonPattern(funcDecl: Parser.SyntaxNode): boolean {
    const nameNode = funcDecl.childForFieldName('name');
    if (nameNode) {
      const name = nameNode.text.toLowerCase();
      return name.includes('getinstance') || name.includes('instance');
    }
    
    return false;
  }

  /**
   * 提取导入信息
   */
  private extractImports(astNode: Parser.SyntaxNode): string[] {
    const imports: string[] = [];
    let current = astNode;
    
    // 向上遍历到文件级别
    while (current && current.type !== 'source_file') {
      current = current.parent;
    }
    
    if (current) {
      for (const child of current.children) {
        if (child.type === 'import_declaration') {
          const importSpec = child.childForFieldName('path');
          if (importSpec) {
            imports.push(importSpec.text.replace(/"/g, ''));
          }
        }
      }
    }
    
    return imports;
  }

  /**
   * 提取注释信息
   */
  private extractComments(astNode: Parser.SyntaxNode): string[] {
    const comments: string[] = [];
    
    // 查找前置注释
    let prevSibling = astNode.previousSibling;
    while (prevSibling) {
      if (prevSibling.type === 'comment') {
        comments.unshift(prevSibling.text);
      } else {
        break;
      }
      prevSibling = prevSibling.previousSibling;
    }
    
    return comments;
  }

  /**
   * 提取语义关系数组
   */
  extractSemanticRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures' | 'implements' | 'decorates' | 'composes';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures' | 'implements' | 'decorates' | 'composes';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    const semanticType = this.determineSemanticType(mainNode);
    const sourceNode = this.extractSourceNode(mainNode);
    const targetNode = this.extractTargetNode(mainNode);

    if (sourceNode && targetNode) {
      const sourceName = GoHelperMethods.extractNameFromNode(sourceNode) || 'unknown';
      const targetName = GoHelperMethods.extractNameFromNode(targetNode) || targetNode.text;
      
      if (sourceName && targetName) {
        relationships.push({
          source: sourceName,
          target: targetName,
          type: semanticType
        });
      }
    }

    return relationships;
  }
}