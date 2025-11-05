import {
  ControlFlowRelationship,
  Parser,
  injectable,
  generateDeterministicNodeId
} from '../types';
import { BaseJavaScriptRelationshipExtractor } from './BaseJavaScriptRelationshipExtractor';

@injectable()
export class ControlFlowExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractControlFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<ControlFlowRelationship[]> {
    const relationships: ControlFlowRelationship[] = [];
    
    // 使用Tree-Sitter查询提取控制流关系
    const queryResult = this.queryTree(ast, `
      ; If语句控制流
      (if_statement
        condition: (parenthesized_expression) @condition) @control.flow.conditional
      
      ; For循环控制流
      (for_statement
        condition: (parenthesized_expression) @condition) @control.flow.loop
      
      ; While循环控制流
      (while_statement
        condition: (parenthesized_expression) @condition) @control.flow.loop
      
      ; Do-while循环控制流
      (do_statement
        condition: (parenthesized_expression) @condition) @control.flow.loop
      
      ; Switch语句控制流
      (switch_statement
        value: (identifier) @condition) @control.flow.switch
      
      ; Try-catch异常控制流
      (try_statement) @control.flow.exception
      
      ; Catch子句
      (catch_clause) @control.flow.exception
      
      ; Throw语句
      (throw_statement) @control.flow.exception
      
      ; Return语句
      (return_statement) @control.flow.return
      
      ; Break语句
      (break_statement) @control.flow.break
      
      ; Continue语句
      (continue_statement) @control.flow.continue
      
      ; Await表达式控制流
      (await_expression) @control.flow.async_await
      
      ; Yield表达式控制流
      (yield_expression) @control.flow.yield
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
          
          if (captureName === 'condition') {
            condition = node.text;
            sourceId = generateDeterministicNodeId(node);
          }
          
          // 确定控制流类型
          if (captureName.includes('conditional')) {
            flowType = 'conditional';
          } else if (captureName.includes('loop')) {
            flowType = 'loop';
          } else if (captureName.includes('exception')) {
            flowType = 'exception';
            isExceptional = true;
          } else if (captureName.includes('async_await') || captureName.includes('await')) {
            flowType = 'async_await';
          } else if (captureName.includes('yield')) {
            flowType = 'callback';
          }
        }
        
        if (sourceId) {
          targetId = generateDeterministicNodeId(result.captures[0]?.node);
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
          sourceId = generateDeterministicNodeId(result.captures[0]?.node);
          targetId = generateDeterministicNodeId(result.captures[0]?.node);
          
          // 确定控制流类型
          const captureName = captures[0]?.name || '';
          if (captureName.includes('conditional')) {
            flowType = 'conditional';
          } else if (captureName.includes('loop')) {
            flowType = 'loop';
          } else if (captureName.includes('exception')) {
            flowType = 'exception';
            isExceptional = true;
          } else if (captureName.includes('async_await') || captureName.includes('await')) {
            flowType = 'async_await';
          } else if (captureName.includes('yield')) {
            flowType = 'callback';
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

  // 辅助方法：执行Tree-Sitter查询
  private queryTree(ast: Parser.SyntaxNode, query: string): any[] {
    // 这里应该实现Tree-Sitter查询逻辑
    // 由于我们移除了TreeSitterService，这里需要一个简化的实现
    // 在实际应用中，你可能需要重新引入Tree-Sitter查询功能
    return [];
  }
}