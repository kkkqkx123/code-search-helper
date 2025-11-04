import {
  CreationRelationship,
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
export class CreationExtractor extends BaseRustRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super(treeSitterService, logger);
  }

  async extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]> {
    const relationships: CreationRelationship[] = [];

    // 查找结构体实例化（类似类创建）
    const structLiterals = this.treeSitterService.findNodeByType(ast, 'struct_expression');

    for (const structLiteral of structLiterals) {
      const structName = this.extractStructNameFromLiteral(structLiteral);
      if (structName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(structName, filePath, structLiteral);

        relationships.push({
          sourceId: this.generateNodeId(`struct_creation_${structLiteral.startPosition.row}`, 'creation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(structName, 'struct', filePath),
          creationType: 'instantiation',
          targetName: structName,
          location: {
            filePath,
            lineNumber: structLiteral.startPosition.row + 1,
            columnNumber: structLiteral.startPosition.column + 1
          },
          resolvedTargetSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找数组字面量创建
    const arrayLiterals = this.treeSitterService.findNodeByType(ast, 'array_expression');
    for (const arrayLiteral of arrayLiterals) {
      relationships.push({
        sourceId: this.generateNodeId(`array_creation_${arrayLiteral.startPosition.row}`, 'creation', filePath),
        targetId: this.generateNodeId('Array', 'builtin', filePath),
        creationType: 'instantiation',
        targetName: 'Array',
        location: {
          filePath,
          lineNumber: arrayLiteral.startPosition.row + 1,
          columnNumber: arrayLiteral.startPosition.column + 1
        },
        resolvedTargetSymbol: undefined
      });
    }

    // 查找闭包表达式创建
    const closureExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].lambdaExpression
    );

    for (const closureExpr of closureExpressions) {
      relationships.push({
        sourceId: this.generateNodeId(`closure_creation_${closureExpr.startPosition.row}`, 'creation', filePath),
        targetId: this.generateNodeId('Function', 'builtin', filePath),
        creationType: 'instantiation',
        targetName: 'Function',
        location: {
          filePath,
          lineNumber: closureExpr.startPosition.row + 1,
          columnNumber: closureExpr.startPosition.column + 1
        },
        resolvedTargetSymbol: undefined
      });
    }

    return relationships;
  }

  protected extractStructNameFromLiteral(structLiteral: Parser.SyntaxNode): string | null {
    // 从结构体字面量中提取结构体名
    for (const child of structLiteral.children) {
      if (child.type === 'type_identifier') {
        return child.text || null;
      }
    }
    return null;
  }
}
