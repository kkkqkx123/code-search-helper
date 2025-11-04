import {
  AnnotationRelationship,
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
export class AnnotationExtractor extends BaseRustRelationshipExtractor {
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

    // 查找属性声明
    const attributeDeclarations = this.treeSitterService.findNodeByType(ast, 'attribute_item');

    for (const attrDecl of attributeDeclarations) {
      const attributeName = this.extractAttributeName(attrDecl);
      const attributeParameters = this.extractAttributeParameters(attrDecl);

      if (attributeName) {
        // 查找属性应用的目标
        const targetNode = this.findAttributeTarget(attrDecl);

        if (targetNode) {
          const targetSymbol = symbolResolver.resolveSymbol(targetNode.text || 'target', filePath, targetNode);

          relationships.push({
            sourceId: this.generateNodeId(attributeName, 'annotation', filePath),
            targetId: targetSymbol ? this.generateSymbolId(targetSymbol) : this.generateNodeId(targetNode.text || 'target', 'target', filePath),
            annotationType: 'attribute',
            annotationName: attributeName,
            parameters: attributeParameters,
            location: {
              filePath,
              lineNumber: attrDecl.startPosition.row + 1,
              columnNumber: attrDecl.startPosition.column + 1
            },
            resolvedAnnotationSymbol: targetSymbol || undefined
          });
        }
      }
    }

    return relationships;
  }

  protected findAttributeTarget(attributeDecl: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 查找属性应用的目标节点
    // 在 Rust 中，属性通常应用在函数、结构体等声明上
    let currentNode: Parser.SyntaxNode | null = attributeDecl;

    // 向上查找直到找到目标声明
    while (currentNode) {
      if (currentNode.type === 'function_item' ||
          currentNode.type === 'struct_item' ||
          currentNode.type === 'enum_item' ||
          currentNode.type === 'impl_item') {
        return currentNode;
      }
      currentNode = currentNode.parent;
    }

    return null;
  }
}
