import {
  DependencyRelationship,
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
export class DependencyExtractor extends BaseRustRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super(treeSitterService, logger);
  }

  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DependencyRelationship[]> {
    const relationships: DependencyRelationship[] = [];

    // 查找 use 声明 (importDeclaration in Rust)
    const useDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].importDeclaration
    );

    for (const useStmt of useDeclarations) {
      const importInfo = this.extractUseInfo(useStmt);

      if (importInfo) {
        // 使用符号解析器解析导入的模块
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(importInfo.source, filePath, useStmt);

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(importInfo.source, 'module', importInfo.source),
          dependencyType: 'import',
          target: importInfo.source,
          importedSymbols: importInfo.importedSymbols,
          location: {
            filePath,
            lineNumber: useStmt.startPosition.row + 1
          },
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    // Rust 没有显式的导出声明，但有 pub 关键字
    // 这里可以处理外部 crate 的依赖
    const externCrateDeclarations = this.treeSitterService.findNodeByType(ast, 'extern_crate_declaration');

    for (const externCrate of externCrateDeclarations) {
      const crateName = this.extractCrateName(externCrate, filePath);
      if (crateName) {
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(crateName, filePath, externCrate);

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(crateName, 'module', filePath),
          dependencyType: 'import',
          target: crateName,
          importedSymbols: [],
          location: {
            filePath,
            lineNumber: externCrate.startPosition.row + 1
          },
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    return relationships;
  }
}
