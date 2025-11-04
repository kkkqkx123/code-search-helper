import {
  ReferenceRelationship,
  SymbolResolver,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  BaseCRelationshipExtractor,
  injectable
} from '../types';

@injectable()
export class ReferenceExtractor extends BaseCRelationshipExtractor {
  async extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ReferenceRelationship[]> {
    const relationships: ReferenceRelationship[] = [];

    // 查找所有标识符引用和字段标识符
    const identifiers = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].propertyIdentifier
    );

    for (const identifier of identifiers) {
      const identifierName = identifier.text;

      // 使用符号解析器解析引用的符号
      const resolvedSymbol = symbolResolver.resolveSymbol(identifierName, filePath, identifier);

      if (resolvedSymbol) {
        // 确定引用类型
        const referenceType = this.determineReferenceType(identifier, resolvedSymbol) as 'variable' | 'constant' | 'parameter' | 'field' | 'type' | 'enum';

        relationships.push({
          sourceId: this.generateNodeId(identifierName, 'reference', filePath),
          targetId: this.generateSymbolId(resolvedSymbol),
          referenceType,
          referenceName: identifierName,
          location: {
            filePath,
            lineNumber: identifier.startPosition.row + 1,
            columnNumber: identifier.startPosition.column + 1
          },
          resolvedSymbol
        });
      }
    }

    // 查找字段表达式引用
    const fieldExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].memberExpression
    );

    for (const fieldExpr of fieldExpressions) {
      const fieldName = this.extractFieldNameFromFieldExpression(fieldExpr);

      if (fieldName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(fieldName, filePath, fieldExpr);

        if (resolvedSymbol) {
          // 确定引用类型
          const referenceType = this.determineReferenceType(fieldExpr, resolvedSymbol) as 'variable' | 'constant' | 'parameter' | 'field';

          relationships.push({
            sourceId: this.generateNodeId(fieldName, 'reference', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType,
            referenceName: fieldName,
            location: {
              filePath,
              lineNumber: fieldExpr.startPosition.row + 1,
              columnNumber: fieldExpr.startPosition.column + 1
            },
            resolvedSymbol
          });
        }
      }
    }

    // 查找函数声明的引用
    const functionDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].functionDeclaration
    );

    for (const funcDecl of functionDeclarations) {
      const funcName = this.extractFunctionName(funcDecl);
      if (funcName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(funcName, filePath, funcDecl);

        if (resolvedSymbol) {
          relationships.push({
            sourceId: this.generateNodeId(funcName, 'function_ref', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType: 'function',
            referenceName: funcName,
            location: {
              filePath,
              lineNumber: funcDecl.startPosition.row + 1,
              columnNumber: funcDecl.startPosition.column + 1
            },
            resolvedSymbol
          });
        }
      }
    }

    // 查找变量声明的引用
    const variableDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].variableDeclaration
    );

    for (const varDecl of variableDeclarations) {
      const varName = this.extractVariableName(varDecl);
      if (varName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(varName, filePath, varDecl);

        if (resolvedSymbol) {
          relationships.push({
            sourceId: this.generateNodeId(varName, 'variable_ref', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType: 'variable',
            referenceName: varName,
            location: {
              filePath,
              lineNumber: varDecl.startPosition.row + 1,
              columnNumber: varDecl.startPosition.column + 1
            },
            resolvedSymbol
          });
        }
      }
    }

    // 查找类型引用
    const typeIdentifiers = this.treeSitterService.findNodeByType(ast, 'type_identifier');
    for (const typeIdentifier of typeIdentifiers) {
      const typeName = typeIdentifier.text;

      // 使用符号解析器解析类型符号
      const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, typeIdentifier);

      if (resolvedSymbol) {
        relationships.push({
          sourceId: this.generateNodeId(typeName, 'typeref', filePath),
          targetId: this.generateSymbolId(resolvedSymbol),
          referenceType: 'type',
          referenceName: typeName,
          location: {
            filePath,
            lineNumber: typeIdentifier.startPosition.row + 1,
            columnNumber: typeIdentifier.startPosition.column + 1
          },
          resolvedSymbol
        });
      }
    }

    // 查找原生类型引用
    const primitiveTypes = this.treeSitterService.findNodeByType(ast, 'primitive_type');
    for (const primitiveType of primitiveTypes) {
      const typeName = primitiveType.text;

      // 使用符号解析器解析类型符号
      const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, primitiveType);

      if (resolvedSymbol) {
        relationships.push({
          sourceId: this.generateNodeId(typeName, 'primitive_typeref', filePath),
          targetId: this.generateSymbolId(resolvedSymbol),
          referenceType: 'type',
          referenceName: typeName,
          location: {
            filePath,
            lineNumber: primitiveType.startPosition.row + 1,
            columnNumber: primitiveType.startPosition.column + 1
          },
          resolvedSymbol
        });
      }
    }

    return relationships;
  }
}