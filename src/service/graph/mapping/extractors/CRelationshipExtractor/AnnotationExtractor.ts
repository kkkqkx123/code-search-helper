import {
  AnnotationRelationship,
  SymbolResolver,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  BaseCRelationshipExtractor,
  injectable
} from '../types';

@injectable()
export class AnnotationExtractor extends BaseCRelationshipExtractor {
  async extractAnnotationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<AnnotationRelationship[]> {
    const relationships: AnnotationRelationship[] = [];

    // 查找属性说明符（C11 attributes）
    const attributes = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].decorator
    );

    for (const attribute of attributes) {
      const attributeName = this.extractAttributeName(attribute);
      const parameters = this.extractAttributeParameters(attribute);

      if (attributeName) {
        // 使用符号解析器解析属性符号
        const resolvedSymbol = symbolResolver.resolveSymbol(attributeName, filePath, attribute);

        relationships.push({
          sourceId: this.generateNodeId(`attribute_${attribute.startPosition.row}`, 'annotation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(attributeName, 'attribute', filePath),
          annotationType: 'attribute',
          annotationName: attributeName,
          parameters,
          location: {
            filePath,
            lineNumber: attribute.startPosition.row + 1,
            columnNumber: attribute.startPosition.column + 1
          },
          resolvedAnnotationSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找类型注解（如类型别名等）
    const typeAnnotations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].typeAnnotation
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

    return relationships;
  }
}