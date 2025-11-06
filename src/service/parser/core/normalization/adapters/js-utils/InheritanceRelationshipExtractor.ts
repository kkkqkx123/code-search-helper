import Parser from 'tree-sitter';
import { JsHelperMethods } from './JsHelperMethods';

/**
 * JavaScript/TypeScript继承关系提取器
 * 提取类继承、接口实现等关系
 */
export class InheritanceRelationshipExtractor {
 /**
   * 提取继承关系的元数据
   */
  extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode, language: string | null): any {
    const metadata: any = {};
    
    // 提取父类和子类信息
    const parentInfo = this.extractParentInfo(astNode);
    const childInfo = this.extractChildInfo(astNode);
    
    if (parentInfo) {
      metadata.parent = parentInfo;
    }
    
    if (childInfo) {
      metadata.child = childInfo;
    }
    
    // 提取继承类型
    metadata.inheritanceType = this.extractInheritanceType(astNode);
    
    // 提取继承修饰符
    metadata.modifiers = this.extractInheritanceModifiers(astNode);
    
    return metadata;
  }

 /**
   * 提取父类/父接口信息
   */
  private extractParentInfo(astNode: Parser.SyntaxNode): any | null {
    if (!astNode) return null;

    let parentNode = null;
    
    if (astNode.type === 'class_declaration' || astNode.type === 'class') {
      // 查找继承的父类
      const superClass = astNode.childForFieldName('superclass');
      if (superClass) {
        parentNode = superClass;
      } else {
        // 查找实现的接口（extends/implements）
        const heritageClauses = this.findHeritageClauses(astNode);
        if (heritageClauses.length > 0) {
          parentNode = heritageClauses[0]; // 取第一个继承的类或接口
        }
      }
    } else if (astNode.type === 'interface_declaration') {
      // 接口继承其他接口
      const heritageClauses = this.findHeritageClauses(astNode);
      if (heritageClauses.length > 0) {
        parentNode = heritageClauses[0]; // 取第一个继承的接口
      }
    }
    
    if (parentNode) {
      return {
        text: parentNode.text,
        type: parentNode.type,
        range: {
          start: { row: parentNode.startPosition.row, column: parentNode.startPosition.column },
          end: { row: parentNode.endPosition.row, column: parentNode.endPosition.column }
        }
      };
    }
    
    return null;
  }

 /**
   * 提取子类信息
   */
  private extractChildInfo(astNode: Parser.SyntaxNode): any | null {
    if (!astNode) return null;

    let childNode = null;
    
    if (astNode.type === 'class_declaration' || astNode.type === 'class') {
      // 类声明本身是子类
      const className = astNode.childForFieldName('name');
      if (className) {
        childNode = className;
      } else {
        childNode = astNode; // 如果没有名称，使用整个类节点
      }
    } else if (astNode.type === 'interface_declaration') {
      // 接口声明本身
      const interfaceName = astNode.childForFieldName('name');
      if (interfaceName) {
        childNode = interfaceName;
      } else {
        childNode = astNode;
      }
    }
    
    if (childNode) {
      return {
        text: childNode.text,
        type: childNode.type,
        range: {
          start: { row: childNode.startPosition.row, column: childNode.startPosition.column },
          end: { row: childNode.endPosition.row, column: childNode.endPosition.column }
        }
      };
    }
    
    return null;
  }

 /**
   * 提取继承类型
   */
  private extractInheritanceType(astNode: Parser.SyntaxNode): string {
    if (!astNode) return 'unknown';

    if (astNode.type === 'class_declaration' || astNode.type === 'class') {
      // 检查是否有extends关键字
      if (astNode.childForFieldName('superclass')) {
        return 'class_inheritance';
      }
      
      // 检查是否有implements关键字（TypeScript）
      const body = astNode.childForFieldName('body');
      if (body && this.hasImplementsClause(astNode)) {
        return 'interface_implementation';
      }
    } else if (astNode.type === 'interface_declaration') {
      return 'interface_inheritance';
    }
    
    return 'unknown';
  }

 /**
   * 提取继承修饰符
   */
  private extractInheritanceModifiers(astNode: Parser.SyntaxNode): string[] {
    const modifiers: string[] = [];
    
    if (!astNode) return modifiers;

    // 检查访问修饰符
    const classBody = astNode.type === 'class' || astNode.type === 'class_declaration' ? 
                     astNode : this.findClassNode(astNode);
    
    if (classBody) {
      // 遍历类体中的成员以查找访问修饰符
      this.findAccessModifiers(classBody, modifiers);
    }
    
    // 检查是否为抽象类
    if (this.isAbstractClass(astNode)) {
      modifiers.push('abstract');
    }
    
    return modifiers;
  }

 /**
   * 查找继承子句（extends/implements）
   */
  private findHeritageClauses(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const clauses: Parser.SyntaxNode[] = [];
    
    if (node.children) {
      for (const child of node.children) {
        if (child.type === 'extends_clause' || child.type === 'implements_clause') {
          // 在继承子句中查找具体的类型
          if (child.children) {
            for (const clauseChild of child.children) {
              if (clauseChild.type === 'identifier' || clauseChild.type === 'member_expression') {
                clauses.push(clauseChild);
              }
            }
          }
        }
      }
    }
    
    return clauses;
  }

  /**
   * 检查是否包含implements子句
   */
  private hasImplementsClause(node: Parser.SyntaxNode): boolean {
    if (node.children) {
      for (const child of node.children) {
        if (child.type === 'implements_clause') {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 查找类节点
   */
  private findClassNode(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    if (!node) return null;
    
    if (node.type === 'class' || node.type === 'class_declaration') {
      return node;
    }
    
    return this.findClassNode(node.parent!);
  }

  /**
   * 查找访问修饰符
   */
  private findAccessModifiers(node: Parser.SyntaxNode, modifiers: string[]): void {
    if (!node || !node.children) return;
    
    for (const child of node.children) {
      if (child.type === 'public_field_definition' || 
          child.type === 'private_field_definition' || 
          child.type === 'protected_field_definition' ||
          child.type === 'method_definition') {
        // 检查字段或方法的访问修饰符
        if (child.children) {
          for (const grandChild of child.children) {
            if (grandChild.type === 'public' || 
                grandChild.type === 'private' || 
                grandChild.type === 'protected') {
              modifiers.push(grandChild.type);
            }
          }
        }
      }
      
      this.findAccessModifiers(child, modifiers);
    }
  }

  /**
   * 检查是否为抽象类
   */
  private isAbstractClass(node: Parser.SyntaxNode): boolean {
    // 检查父节点是否包含abstract关键字
    if (node.parent && node.parent.children) {
      for (const child of node.parent.children) {
        if (child.type === 'abstract') {
          return true;
        }
      }
    }
    
    // 检查当前节点的前一个兄弟节点（在类声明的情况下）
    if (node.previousSibling?.type === 'abstract') {
      return true;
    }
    
    return false;
  }
}