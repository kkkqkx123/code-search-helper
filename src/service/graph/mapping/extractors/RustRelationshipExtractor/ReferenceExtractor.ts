import {
  ReferenceRelationship,
  SymbolResolver,
  BaseRustRelationshipExtractor,
  TreeSitterService,
  LoggerService,
  inject,
  injectable,
  TYPES,
  Parser,
  LANGUAGE_NODE_MAPPINGS
} from '../types';

@injectable()
export class ReferenceExtractor extends BaseRustRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super(treeSitterService, logger);
  }

  async extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ReferenceRelationship[]> {
    const relationships: ReferenceRelationship[] = [];

    // 查找所有标识符引用和属性标识符
    const identifiers = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].propertyIdentifier
    );

    for (const identifier of identifiers) {
      const identifierName = identifier.text || null;

      if (identifierName) {
        // 使用符号解析器解析引用的符号
        const resolvedSymbol = symbolResolver.resolveSymbol(identifierName, filePath, identifier);

        if (resolvedSymbol) {
          // 确定引用类型
          const referenceType = this.determineReferenceType(identifier, resolvedSymbol);

          relationships.push({
            sourceId: this.generateNodeId(identifierName, 'reference', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType: referenceType as 'variable' | 'constant' | 'parameter' | 'field' | 'function' | 'method' | 'type' | 'enum' | 'class' | 'interface' | 'namespace',
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
    }

    // 查找成员表达式引用 (field_expression in Rust)
    const fieldExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].memberExpression
    );

    for (const fieldExpr of fieldExpressions) {
      const fieldName = this.extractFieldNameFromFieldExpression(fieldExpr);

      if (fieldName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(fieldName, filePath, fieldExpr);

        if (resolvedSymbol) {
          // 确定引用类型
          const referenceType = this.determineReferenceType(fieldExpr, resolvedSymbol);

          relationships.push({
            sourceId: this.generateNodeId(fieldName, 'reference', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType: referenceType as 'variable' | 'constant' | 'parameter' | 'field' | 'function' | 'method' | 'type' | 'enum' | 'class' | 'interface' | 'namespace',
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

    // 查找函数声明和方法声明的引用
    const functionDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].functionDeclaration
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

    // 查找方法声明的引用
    const methodDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].methodDeclaration
    );

    for (const methodDecl of methodDeclarations) {
      const methodName = this.extractMethodName(methodDecl);
      if (methodName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(methodName, filePath, methodDecl);

        if (resolvedSymbol) {
          relationships.push({
            sourceId: this.generateNodeId(methodName, 'method_ref', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType: 'method',
            referenceName: methodName,
            location: {
              filePath,
              lineNumber: methodDecl.startPosition.row + 1,
              columnNumber: methodDecl.startPosition.column + 1
            },
            resolvedSymbol
          });
        }
      }
    }

    // 查找类型引用
    const typeAnnotations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].typeAnnotation
    );

    for (const typeAnnotation of typeAnnotations) {
      const typeIdentifier = typeAnnotation;
      const typeName = typeIdentifier.text;
      const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, typeIdentifier);

      if (resolvedSymbol) {
        relationships.push({
          sourceId: this.generateNodeId(typeName, 'annotation', filePath),
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

    // 查找泛型类型引用
    const genericTypes = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].genericTypes
    );

    for (const genericType of genericTypes) {
      const typeIdentifier = this.treeSitterService.findNodeByType(genericType, 'type_identifier')[0];
      if (typeIdentifier) {
        const typeName = typeIdentifier.text;
        const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, typeIdentifier);

        if (resolvedSymbol) {
          relationships.push({
            sourceId: this.generateNodeId(typeName, 'generic_type', filePath),
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
    }

    return relationships;
  }
}
