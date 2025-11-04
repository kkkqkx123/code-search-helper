import {
  ControlFlowRelationship,
  SymbolResolver,
  BaseRustRelationshipExtractor,
  TreeSitterService,
  LoggerService,
  inject,
  injectable,
  TYPES,
  Parser
} from '../types';

@injectable()
export class ControlFlowExtractor extends BaseRustRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super(treeSitterService, logger);
  }

  async extractControlFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ControlFlowRelationship[]> {
    const relationships: ControlFlowRelationship[] = [];

    // 使用Tree-Sitter查询提取控制流关系
    const queryResult = this.treeSitterService.queryTree(ast, `
      ; Match表达式控制流
      (match_expression
        value: (_) @match.value) @control.flow.match

      ; Loop表达式控制流
      (loop_expression) @control.flow.loop

      ; While循环控制流
      (while_expression
        condition: (_) @condition) @control.flow.while

      ; For循环控制流
      (for_expression
        pattern: (_) @loop.pattern
        iterable: (_) @loop.iterable) @control.flow.for

      ; If表达式控制流
      (if_expression
        condition: (_) @condition) @control.flow.conditional

      ; Try表达式控制流
      (try_expression) @control.flow.exception

      ; Unsafe块控制流
      (unsafe_block) @control.flow.unsafe

      ; 异步块控制流
      (async_block) @control.flow.async_await
    `);

    if (queryResult && Array.isArray(queryResult)) {
      for (const result of queryResult) {
        const captures = result.captures || [];
        let sourceId = '';
        let targetId = '';
        let flowType: 'conditional' | 'loop' | 'exception' | 'callback' | 'async_await' = 'conditional';
        let condition = '';
        let isExceptional = false;

        // 解析捕获的节点
        for (const capture of captures) {
          const captureName = capture.name;
          const node = capture.node;

          if (captureName === 'condition' || captureName === 'match.value') {
            condition = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(condition, filePath, node);
            sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(condition, 'condition', filePath);
          }

          // 确定控制流类型
          if (captureName.includes('conditional') || captureName.includes('match')) {
            flowType = 'conditional';
          } else if (captureName.includes('loop') || captureName.includes('for') || captureName.includes('while')) {
            flowType = 'loop';
          } else if (captureName.includes('exception') || captureName.includes('try')) {
            flowType = 'exception';
            isExceptional = true;
          } else if (captureName.includes('async_await') || captureName.includes('async')) {
            flowType = 'async_await';
          } else if (captureName.includes('unsafe')) {
            flowType = 'conditional';
          }
        }

        if (sourceId) {
          targetId = this.generateNodeId(`control_flow_target_${result.captures[0]?.node?.startPosition.row}`, 'control_flow_target', filePath);
          relationships.push({
            sourceId,
            targetId,
            flowType,
            condition,
            isExceptional,
            location: {
              filePath,
              lineNumber: captures[0]?.node?.startPosition.row + 1 || 0,
              columnNumber: captures[0]?.node?.startPosition.column + 1 || 0
            }
          });
        } else {
          // 如果没有条件，仍然创建控制流关系
          sourceId = this.generateNodeId(`control_flow_source_${result.captures[0]?.node?.startPosition.row}`, 'control_flow_source', filePath);
          targetId = this.generateNodeId(`control_flow_target_${result.captures[0]?.node?.startPosition.row}`, 'control_flow_target', filePath);

          // 确定控制流类型
          const captureName = captures[0]?.name || '';
          if (captureName.includes('conditional') || captureName.includes('match')) {
            flowType = 'conditional';
          } else if (captureName.includes('loop') || captureName.includes('for') || captureName.includes('while')) {
            flowType = 'loop';
          } else if (captureName.includes('exception') || captureName.includes('try')) {
            flowType = 'exception';
            isExceptional = true;
          } else if (captureName.includes('async_await') || captureName.includes('async')) {
            flowType = 'async_await';
          } else if (captureName.includes('unsafe')) {
            flowType = 'conditional';
          }

          relationships.push({
            sourceId,
            targetId,
            flowType,
            condition,
            isExceptional,
            location: {
              filePath,
              lineNumber: captures[0]?.node?.startPosition.row + 1 || 0,
              columnNumber: captures[0]?.node?.startPosition.column + 1 || 0
            }
          });
        }
      }
    }

    return relationships;
  }
}
