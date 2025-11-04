import {
  ControlFlowRelationship,
  SymbolResolver,
  Symbol,
  Parser,
  BaseJavaScriptRelationshipExtractor,
  injectable
} from '../types';

@injectable()
export class ControlFlowExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractControlFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ControlFlowRelationship[]> {
    const relationships: ControlFlowRelationship[] = [];
    
    // 使用TreeSitterService查找控制流相关的节点
    const controlFlowNodes = this.treeSitterService.findNodesByTypes(ast, [
      'if_statement',
      'for_statement',
      'while_statement',
      'do_statement',
      'switch_statement',
      'try_statement',
      'catch_clause',
      'finally_clause'
    ]);
    
    for (const node of controlFlowNodes) {
      const flowRelationships = this.extractControlFlowFromNode(node, filePath, symbolResolver);
      relationships.push(...flowRelationships);
    }
    
    return relationships;
  }
  
  private extractControlFlowFromNode(
    node: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ControlFlowRelationship[] {
    const relationships: ControlFlowRelationship[] = [];
    
    switch (node.type) {
      case 'if_statement':
        const condition = node.childForFieldName('condition');
        const consequence = node.childForFieldName('consequence');
        const alternative = node.childForFieldName('alternative');
        
        if (condition?.text) {
          if (consequence?.text) {
            relationships.push({
              sourceId: this.generateNodeId(condition.text, 'condition', filePath),
              targetId: this.generateNodeId('if-consequence', 'block', filePath),
              flowType: 'conditional',
              condition: condition.text,
              isExceptional: false,
              location: {
                filePath,
                lineNumber: node.startPosition.row + 1,
                columnNumber: node.startPosition.column + 1
              }
            });
          }
          
          if (alternative?.text) {
            relationships.push({
              sourceId: this.generateNodeId(condition.text, 'condition', filePath),
              targetId: this.generateNodeId('if-alternative', 'block', filePath),
              flowType: 'conditional',
              condition: condition.text,
              isExceptional: false,
              location: {
                filePath,
                lineNumber: node.startPosition.row + 1,
                columnNumber: node.startPosition.column + 1
              }
            });
          }
        }
        break;
        
      case 'for_statement':
      case 'while_statement':
        const loopCondition = node.childForFieldName('condition');
        const loopBody = node.childForFieldName('body');
        
        if (loopCondition?.text && loopBody?.text) {
          relationships.push({
            sourceId: this.generateNodeId(loopCondition.text, 'condition', filePath),
            targetId: this.generateNodeId(`${node.type}-body`, 'block', filePath),
            flowType: 'loop',
            condition: loopCondition.text,
            isExceptional: false,
            location: {
              filePath,
              lineNumber: node.startPosition.row + 1,
              columnNumber: node.startPosition.column + 1
            }
          });
        }
        break;
        
      case 'try_statement':
        const tryBody = node.childForFieldName('body');
        const catchClause = node.childForFieldName('catch_clause');
        const finallyClause = node.childForFieldName('finally_clause');
        
        if (tryBody?.text && catchClause?.text) {
          relationships.push({
            sourceId: this.generateNodeId('try-body', 'block', filePath),
            targetId: this.generateNodeId('catch-body', 'block', filePath),
            flowType: 'exception',
            isExceptional: true,
            location: {
              filePath,
              lineNumber: node.startPosition.row + 1,
              columnNumber: node.startPosition.column + 1
            }
          });
        }
        
        if (tryBody?.text && finallyClause?.text) {
          relationships.push({
            sourceId: this.generateNodeId('try-body', 'block', filePath),
            targetId: this.generateNodeId('finally-body', 'block', filePath),
            flowType: 'exception',
            isExceptional: false,
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