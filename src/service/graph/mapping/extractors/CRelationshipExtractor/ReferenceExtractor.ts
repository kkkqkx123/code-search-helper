import {
  ReferenceRelationship,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  BaseCRelationshipExtractor,
  injectable,
  generateDeterministicNodeId
} from '../types';

@injectable()
export class ReferenceExtractor extends BaseCRelationshipExtractor {
  async extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<ReferenceRelationship[]> {
    const relationships: ReferenceRelationship[] = [];

    // 查找所有标识符引用和字段标识符
    const identifiers = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].propertyIdentifier
    );

    for (const identifier of identifiers) {
      const identifierName = identifier.text;

      // 确定引用类型
      const referenceType = this.determineReferenceType(identifier) as 'variable' | 'constant' | 'parameter' | 'field' | 'type' | 'enum';

      relationships.push({
        sourceId: generateDeterministicNodeId(identifier),
        targetId: this.generateNodeId(identifierName, 'identifier', filePath),
        referenceType,
        referenceName: identifierName,
        location: {
          filePath,
          lineNumber: identifier.startPosition.row + 1,
          columnNumber: identifier.startPosition.column + 1
        }
      });
    }

    // 查找字段表达式引用
    const fieldExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].memberExpression
    );

    for (const fieldExpr of fieldExpressions) {
      const fieldName = this.extractFieldNameFromFieldExpression(fieldExpr);

      if (fieldName) {
        // 确定引用类型
        const referenceType = this.determineReferenceType(fieldExpr) as 'variable' | 'constant' | 'parameter' | 'field';

        relationships.push({
          sourceId: generateDeterministicNodeId(fieldExpr),
          targetId: this.generateNodeId(fieldName, 'field', filePath),
          referenceType,
          referenceName: fieldName,
          location: {
            filePath,
            lineNumber: fieldExpr.startPosition.row + 1,
            columnNumber: fieldExpr.startPosition.column + 1
          }
        });
      }
    }

    // 查找函数声明的引用
    const functionDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].functionDeclaration
    );

    for (const funcDecl of functionDeclarations) {
      const funcName = this.extractFunctionName(funcDecl);
      if (funcName) {
        relationships.push({
          sourceId: generateDeterministicNodeId(funcDecl),
          targetId: this.generateNodeId(funcName, 'function', filePath),
          referenceType: 'function',
          referenceName: funcName,
          location: {
            filePath,
            lineNumber: funcDecl.startPosition.row + 1,
            columnNumber: funcDecl.startPosition.column + 1
          }
        });
      }
    }

    // 查找变量声明的引用
    const variableDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].variableDeclaration
    );

    for (const varDecl of variableDeclarations) {
      const varName = this.extractVariableName(varDecl);
      if (varName) {
        relationships.push({
          sourceId: generateDeterministicNodeId(varDecl),
          targetId: this.generateNodeId(varName, 'variable', filePath),
          referenceType: 'variable',
          referenceName: varName,
          location: {
            filePath,
            lineNumber: varDecl.startPosition.row + 1,
            columnNumber: varDecl.startPosition.column + 1
          }
        });
      }
    }

    // 查找类型引用
    const typeIdentifiers = this.treeSitterService.findNodeByType(ast, 'type_identifier');
    for (const typeIdentifier of typeIdentifiers) {
      const typeName = typeIdentifier.text;

      relationships.push({
        sourceId: generateDeterministicNodeId(typeIdentifier),
        targetId: this.generateNodeId(typeName, 'type', filePath),
        referenceType: 'type',
        referenceName: typeName,
        location: {
          filePath,
          lineNumber: typeIdentifier.startPosition.row + 1,
          columnNumber: typeIdentifier.startPosition.column + 1
        }
      });
    }

    // 查找原生类型引用
    const primitiveTypes = this.treeSitterService.findNodeByType(ast, 'primitive_type');
    for (const primitiveType of primitiveTypes) {
      const typeName = primitiveType.text;

      relationships.push({
        sourceId: generateDeterministicNodeId(primitiveType),
        targetId: this.generateNodeId(typeName, 'primitive_type', filePath),
        referenceType: 'type',
        referenceName: typeName,
        location: {
          filePath,
          lineNumber: primitiveType.startPosition.row + 1,
          columnNumber: primitiveType.startPosition.column + 1
        }
      });
    }

    return relationships;
  }
}