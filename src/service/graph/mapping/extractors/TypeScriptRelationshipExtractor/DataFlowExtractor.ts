import {
  DataFlowRelationship,
  SymbolResolver,
  Symbol,
  Parser,
  BaseJavaScriptRelationshipExtractor,
  injectable
} from '../types';

@injectable()
export class DataFlowExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractDataFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DataFlowRelationship[]> {
    const relationships: DataFlowRelationship[] = [];
    
    // 使用TreeSitterService查找数据流相关的节点
    const dataFlowNodes = this.treeSitterService.findNodesByTypes(ast, [
      'assignment_expression',
      'call_expression',
      'return_statement',
      'variable_declarator'
    ]);
    
    for (const node of dataFlowNodes) {
      const flowRelationships = this.extractDataFlowFromNode(node, filePath, symbolResolver);
      relationships.push(...flowRelationships);
    }
    
    return relationships;
  }
  
  private extractDataFlowFromNode(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): DataFlowRelationship[] {
    const relationships: DataFlowRelationship[] = [];
    
    switch (node.type) {
      case 'assignment_expression':
        const left = node.childForFieldName('left');
        const right = node.childForFieldName('right');
        
        if (left?.text && right?.text) {
          relationships.push({
            sourceId: this.generateNodeId(right.text, 'variable', filePath),
            targetId: this.generateNodeId(left.text, 'variable', filePath),
            flowType: 'variable_assignment',
            flowPath: [right.text, left.text],
            location: {
              filePath,
              lineNumber: node.startPosition.row + 1,
              columnNumber: node.startPosition.column + 1
            }
          });
        }
        break;
        
      case 'call_expression':
        const func = node.childForFieldName('function');
        const args = node.childForFieldName('arguments');
        
        if (func?.text && args?.children) {
          for (const arg of args.children) {
            if (arg.type === 'identifier' && arg.text) {
              relationships.push({
                sourceId: this.generateNodeId(arg.text, 'variable', filePath),
                targetId: this.generateNodeId(func.text, 'function', filePath),
                flowType: 'parameter_passing',
                flowPath: [arg.text, func.text],
                location: {
                  filePath,
                  lineNumber: node.startPosition.row + 1,
                  columnNumber: node.startPosition.column + 1
                }
              });
            }
          }
        }
        break;
        
      case 'return_statement':
        const value = node.childForFieldName('value');
        
        if (value?.text) {
          relationships.push({
            sourceId: this.generateNodeId(value.text, 'variable', filePath),
            targetId: this.generateNodeId('return', 'function', filePath),
            flowType: 'return_value',
            flowPath: [value.text, 'return'],
            location: {
              filePath,
              lineNumber: node.startPosition.row + 1,
              columnNumber: node.startPosition.column + 1
            }
          });
        }
        break;
    }
    
    return relationships;
  }
}