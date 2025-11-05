import {
  ReferenceRelationship,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  injectable,
  generateDeterministicNodeId
} from '../types';
import { BaseJavaScriptRelationshipExtractor } from './BaseJavaScriptRelationshipExtractor';

@injectable()
export class ReferenceExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<ReferenceRelationship[]> {
    const relationships: ReferenceRelationship[] = [];

    // 查找所有标识符引用和属性标识符
    const identifiers = this.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].propertyIdentifier
    );

    for (const identifier of identifiers) {
      const identifierName = identifier.text;

      // 确定引用类型
      const referenceType = this.determineReferenceType(identifier, null) as 'variable' | 'constant' | 'parameter' | 'field';

      relationships.push({
        sourceId: generateDeterministicNodeId(identifier),
        targetId: this.generateNodeId(identifierName, 'reference', filePath),
        referenceType,
        referenceName: identifierName,
        location: {
          filePath,
          lineNumber: identifier.startPosition.row + 1,
          columnNumber: identifier.startPosition.column + 1
        },
        resolvedSymbol: undefined
      });
    }

    // 查找成员表达式引用
    const memberExpressions = this.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].memberExpression
    );

    for (const memberExpr of memberExpressions) {
      const memberName = this.extractMemberExpressionName(memberExpr);

      if (memberName) {
        // 确定引用类型
        const referenceType = this.determineReferenceType(memberExpr, null) as 'variable' | 'constant' | 'parameter' | 'field';

        relationships.push({
          sourceId: generateDeterministicNodeId(memberExpr),
          targetId: this.generateNodeId(memberName, 'reference', filePath),
          referenceType,
          referenceName: memberName,
          location: {
            filePath,
            lineNumber: memberExpr.startPosition.row + 1,
            columnNumber: memberExpr.startPosition.column + 1
          },
          resolvedSymbol: undefined
        });
      }
    }

    // 查找函数声明和方法声明的引用
    const functionDeclarations = this.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].functionDeclaration
    );

    for (const funcDecl of functionDeclarations) {
      const funcName = this.extractFunctionName(funcDecl);
      if (funcName) {
        relationships.push({
          sourceId: generateDeterministicNodeId(funcDecl),
          targetId: this.generateNodeId(funcName, 'function_ref', filePath),
          referenceType: 'function',
          referenceName: funcName,
          location: {
            filePath,
            lineNumber: funcDecl.startPosition.row + 1,
            columnNumber: funcDecl.startPosition.column + 1
          },
          resolvedSymbol: undefined
        });
      }
    }

    // 查找方法声明的引用
    const methodDeclarations = this.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].methodDeclaration
    );

    for (const methodDecl of methodDeclarations) {
      const methodName = this.extractMethodName(methodDecl);
      if (methodName) {
        relationships.push({
          sourceId: generateDeterministicNodeId(methodDecl),
          targetId: this.generateNodeId(methodName, 'method_ref', filePath),
          referenceType: 'method',
          referenceName: methodName,
          location: {
            filePath,
            lineNumber: methodDecl.startPosition.row + 1,
            columnNumber: methodDecl.startPosition.column + 1
          },
          resolvedSymbol: undefined
        });
      }
    }

    // 查找类型注解
    const typeAnnotations = this.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].typeAnnotation
    );

    for (const typeAnnotation of typeAnnotations) {
      const typeIdentifiers = this.findNodeByType(typeAnnotation, 'type_identifier');
      if (typeIdentifiers.length > 0) {
        const typeIdentifier = typeIdentifiers[0];
        const typeName = typeIdentifier.text;

        relationships.push({
          sourceId: generateDeterministicNodeId(typeIdentifier),
          targetId: this.generateNodeId(typeName, 'annotation', filePath),
          referenceType: 'type',
          referenceName: typeName,
          location: {
            filePath,
            lineNumber: typeIdentifier.startPosition.row + 1,
            columnNumber: typeIdentifier.startPosition.column + 1
          },
          resolvedSymbol: undefined
        });
      }
    }

    return relationships;
  }

  // 辅助方法：按类型查找节点
  private findNodesByTypes(ast: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];
    
    function traverse(node: Parser.SyntaxNode) {
      if (types.includes(node.type)) {
        nodes.push(node);
      }
      for (const child of node.children) {
        traverse(child);
      }
    }
    
    traverse(ast);
    return nodes;
  }

  // 辅助方法：按类型查找单个节点
  private findNodeByType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];
    
    function traverse(currentNode: Parser.SyntaxNode) {
      if (currentNode.type === type) {
        nodes.push(currentNode);
      }
      for (const child of currentNode.children) {
        traverse(child);
      }
    }
    
    traverse(node);
    return nodes;
  }
}