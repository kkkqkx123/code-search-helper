import {
  AnnotationRelationship,
  SymbolResolver,
  Symbol,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  BaseJavaScriptRelationshipExtractor,
  injectable,
  inject,
  TYPES,
  TreeSitterService,
  LoggerService
} from '../types';

@injectable()
export class AnnotationExtractor extends BaseJavaScriptRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super(treeSitterService, logger);
  }
  async extractAnnotationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<AnnotationRelationship[]> {
    const relationships: AnnotationRelationship[] = [];

    // 查找装饰器
    const decorators = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].decorator
    );

    for (const decorator of decorators) {
      const annotationName = this.extractAnnotationName(decorator);
      const parameters = this.extractAnnotationParameters(decorator);

      if (annotationName) {
        // 使用符号解析器解析注解符号
        const resolvedSymbol = symbolResolver.resolveSymbol(annotationName, filePath, decorator);

        relationships.push({
          sourceId: this.generateNodeId(`annotation_${decorator.startPosition.row}`, 'annotation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(annotationName, 'decorator', filePath),
          annotationType: 'decorator',
          annotationName,
          parameters,
          location: {
            filePath,
            lineNumber: decorator.startPosition.row + 1,
            columnNumber: decorator.startPosition.column + 1
          },
          resolvedAnnotationSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找类型注解、类型别名和命名空间声明
    const typeAnnotations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].typeAnnotation
    );

    for (const typeAnnotation of typeAnnotations) {
      const annotationName = this.extractTypeName(typeAnnotation);
      if (annotationName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(annotationName, filePath, typeAnnotation);

        relationships.push({
          sourceId: this.generateNodeId(`type_annotation_${typeAnnotation.startPosition.row}`, 'annotation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(annotationName, 'type', filePath),
          annotationType: 'type_annotation',
          annotationName,
          parameters: {},
          location: {
            filePath,
            lineNumber: typeAnnotation.startPosition.row + 1,
            columnNumber: typeAnnotation.startPosition.column + 1
          },
          resolvedAnnotationSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找类型注解中的泛型参数 (TypeScript specific)
    const genericTypes = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].genericTypes
    );

    for (const genericType of genericTypes) {
      const typeName = this.extractGenericTypeName(genericType);
      const typeArguments = this.extractTypeArguments(genericType);

      if (typeName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, genericType);

        relationships.push({
          sourceId: this.generateNodeId(`generic_${genericType.startPosition.row}`, 'annotation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(typeName, 'type', filePath),
          annotationType: 'annotation',
          annotationName: typeName,
          parameters: { typeArguments },
          location: {
            filePath,
            lineNumber: genericType.startPosition.row + 1,
            columnNumber: genericType.startPosition.column + 1
          },
          resolvedAnnotationSymbol: resolvedSymbol || undefined
        });

        // Also add relationships for type arguments
        for (const typeArg of typeArguments) {
          const argResolvedSymbol = symbolResolver.resolveSymbol(typeArg, filePath, genericType);
          if (argResolvedSymbol) {
            relationships.push({
              sourceId: this.generateNodeId(`generic_arg_${genericType.startPosition.row}`, 'annotation', filePath),
              targetId: this.generateSymbolId(argResolvedSymbol),
              annotationType: 'annotation',
              annotationName: typeArg,
              parameters: { genericType: typeName },
              location: {
                filePath,
                lineNumber: genericType.startPosition.row + 1,
                columnNumber: genericType.startPosition.column + 1
              },
              resolvedAnnotationSymbol: argResolvedSymbol
            });
          }
        }
      }
    }

    return relationships;
  }

  // TypeScript特定的辅助方法
  protected extractGenericTypeName(genericType: Parser.SyntaxNode): string | null {
    // 提取泛型类型名
    if (genericType.children && genericType.children.length > 0) {
      const typeNode = genericType.children[0];
      if (typeNode.type === 'type_identifier' || typeNode.type === 'identifier') {
        return typeNode.text || null;
      }
    }
    return null;
  }

  protected extractTypeArguments(genericType: Parser.SyntaxNode): string[] {
    // 提取泛型参数
    const args: string[] = [];

    for (const child of genericType.children) {
      if (child.type === 'type_arguments' || child.type === 'type_parameters') {
        for (const arg of child.children) {
          if (arg.type === 'type_identifier' || arg.type === 'identifier' || arg.type === 'generic_type') {
            args.push(arg.text);
          }
        }
        break;
      }
    }

    return args;
  }
}