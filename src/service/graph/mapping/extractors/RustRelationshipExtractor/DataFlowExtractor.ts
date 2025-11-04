import {
  DataFlowRelationship,
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
export class DataFlowExtractor extends BaseRustRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super(treeSitterService, logger);
  }

  async extractDataFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DataFlowRelationship[]> {
    const relationships: DataFlowRelationship[] = [];

    // 使用Tree-Sitter查询提取数据流关系
    const queryResult = this.treeSitterService.queryTree(ast, `
      ; 变量赋值数据流
      (assignment_expression
        left: (identifier) @source.variable
        right: (identifier) @target.variable) @data.flow.assignment

      ; 字段赋值数据流
      (assignment_expression
        left: (field_expression
          value: (identifier) @source.object
          field: (field_identifier) @source.field)
        right: (identifier) @target.variable) @data.flow.field.assignment

      ; 数组元素赋值数据流
      (assignment_expression
        left: (index_expression
          value: (identifier) @source.array
          index: (identifier) @source.index)
        right: (identifier) @target.variable) @data.flow.array.assignment

      ; 函数调用参数传递数据流
      (call_expression
        function: (identifier) @target.function
        arguments: (arguments
          (identifier) @source.parameter)) @data.flow.parameter

      ; 方法调用参数传递数据流
      (call_expression
        function: (field_expression
          value: (identifier) @target.object
          field: (field_identifier) @target.method)
        arguments: (arguments
          (identifier) @source.parameter)) @data.flow.method.parameter

      ; 返回值数据流
      (return_expression
        (identifier) @source.variable) @data.flow.return

      ; 字段返回数据流
      (return_expression
        (field_expression
          value: (identifier) @source.object
          field: (field_identifier) @source.field)) @data.flow.field.return

      ; 闭包赋值数据流
      (assignment_expression
        left: (identifier) @source.variable
        right: (closure_expression) @target.closure) @data.flow.closure.assignment

      ; 结构体实例化数据流
      (struct_expression
        type: (type_identifier) @target.struct
        (field_initializer_list
          (field_initializer
            name: (field_identifier) @source.field
            value: (identifier) @source.variable))) @data.flow.struct.initialization

      ; 元组解构赋值数据流
      (assignment_expression
        left: (tuple_pattern
          (identifier) @target.variable1)
        right: (identifier) @source.variable) @data.flow.tuple.destructuring

      ; 模式匹配数据流
      (match_expression
        value: (identifier) @source.variable
        body: (match_block
          (match_arm
            pattern: (match_pattern
              (identifier) @target.variable)
            value: (identifier) @target.value))) @data.flow.match.pattern

      ; 引用表达式数据流
      (reference_expression
        (identifier) @source.variable) @data.flow.reference

      ; 解引用表达式数据流
      (dereference_expression
        (identifier) @source.variable) @data.flow.dereference

      ; 类型转换数据流
      (type_cast_expression
        value: (identifier) @source.variable
        type: (type_identifier) @target.type) @data.flow.cast

      ; 宏调用参数数据流
      (macro_invocation
        macro: (identifier) @target.macro
        arguments: (token_tree
          (identifier) @source.parameter)) @data.flow.macro.parameter
    `);

    if (queryResult && Array.isArray(queryResult)) {
      for (const result of queryResult) {
        const captures = result.captures || [];
        let sourceId = '';
        let targetId = '';
        let flowType: 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access' = 'variable_assignment';

        // 解析捕获的节点
        for (const capture of captures) {
          const captureName = capture.name;
          const node = capture.node;

          if (captureName === 'source.variable' || captureName === 'source.parameter') {
            const sourceName = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(sourceName, filePath, node);
            sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(sourceName, 'variable', filePath);
          } else if (captureName === 'target.variable' || captureName === 'target.function') {
            const targetName = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(targetName, filePath, node);
            targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(targetName, 'variable', filePath);
          } else if (captureName === 'source.object' || captureName === 'source.field') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            if (!sourceId) {
              sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'field', filePath);
            } else if (!targetId) {
              targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'field', filePath);
            }
          }

          // 确定数据流类型
          if (captureName.includes('assignment')) {
            flowType = 'variable_assignment';
          } else if (captureName.includes('parameter')) {
            flowType = 'parameter_passing';
          } else if (captureName.includes('return')) {
            flowType = 'return_value';
          } else if (captureName.includes('field')) {
            flowType = 'field_access';
          }
        }

        if (sourceId && targetId) {
          relationships.push({
            sourceId,
            targetId,
            flowType,
            flowPath: [sourceId, targetId],
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
