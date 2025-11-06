import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { RustHelperMethods } from './RustHelperMethods';
import Parser from 'tree-sitter';

/**
 * Rust 控制流关系提取器
 * 专门处理Rust语言的控制流关系提取
 */
export class ControlFlowRelationshipExtractor {
  /**
   * 提取控制流关系元数据
   */
  extractControlFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const controlFlowInfo = this.extractControlFlowInfo(astNode);

    return {
      type: 'control-flow',
      operation: controlFlowInfo.operation,
      fromNodeId: controlFlowInfo.fromNodeId,
      toNodeId: controlFlowInfo.toNodeId,
      controlFlowType: controlFlowInfo.controlFlowType,
      condition: controlFlowInfo.condition,
      isLoop: controlFlowInfo.isLoop,
      location: {
        filePath: symbolTable?.filePath || 'current_file.rs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取控制流关系
   */
  extractControlFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback' | 'branch' | 'iteration';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'conditional' | 'loop' | 'exception' | 'callback' | 'branch' | 'iteration';
    }> = [];

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取条件分支关系
    if (this.isConditionalFlow(mainNode)) {
      const conditionalInfo = this.extractConditionalInfo(mainNode);
      if (conditionalInfo) {
        for (const branch of conditionalInfo.branches) {
          relationships.push({
            source: conditionalInfo.condition,
            target: branch,
            type: 'conditional'
          });
        }
      }
    }

    // 提取循环关系
    if (this.isLoopFlow(mainNode)) {
      const loopInfo = this.extractLoopInfo(mainNode);
      if (loopInfo) {
        relationships.push({
          source: loopInfo.loopVariable || 'loop',
          target: loopInfo.loopBody,
          type: 'loop'
        });
      }
    }

    // 提取异常处理关系
    if (this.isExceptionFlow(mainNode)) {
      const exceptionInfo = this.extractExceptionInfo(mainNode);
      if (exceptionInfo) {
        relationships.push({
          source: exceptionInfo.tryBlock,
          target: exceptionInfo.catchBlock,
          type: 'exception'
        });
      }
    }

    // 提取回调关系
    if (this.isCallbackFlow(mainNode)) {
      const callbackInfo = this.extractCallbackInfo(mainNode);
      if (callbackInfo) {
        relationships.push({
          source: callbackInfo.caller,
          target: callbackInfo.callback,
          type: 'callback'
        });
      }
    }

    // 提取分支关系
    if (this.isBranchFlow(mainNode)) {
      const branchInfo = this.extractBranchInfo(mainNode);
      if (branchInfo) {
        for (const branch of branchInfo.branches) {
          relationships.push({
            source: branchInfo.matcher,
            target: branch,
            type: 'branch'
          });
        }
      }
    }

    // 提取迭代关系
    if (this.isIterationFlow(mainNode)) {
      const iterationInfo = this.extractIterationInfo(mainNode);
      if (iterationInfo) {
        relationships.push({
          source: iterationInfo.iterator,
          target: iterationInfo.iteratee,
          type: 'iteration'
        });
      }
    }

    return relationships;
  }

  /**
   * 提取控制流信息
   */
  private extractControlFlowInfo(node: Parser.SyntaxNode): {
    operation: string;
    fromNodeId: string;
    toNodeId: string;
    controlFlowType: string;
    condition?: string;
    isLoop: boolean;
  } {
    if (this.isConditionalFlow(node)) {
      const conditionalInfo = this.extractConditionalInfo(node);
      return {
        operation: 'conditional_branch',
        fromNodeId: conditionalInfo ? this.generateDeterministicNodeIdFromString(conditionalInfo.condition) : 'unknown',
        toNodeId: conditionalInfo ? this.generateDeterministicNodeIdFromString(conditionalInfo.branches.join('_')) : 'unknown',
        controlFlowType: 'conditional',
        condition: conditionalInfo?.condition,
        isLoop: false
      };
    }

    if (this.isLoopFlow(node)) {
      const loopInfo = this.extractLoopInfo(node);
      return {
        operation: 'loop_iteration',
        fromNodeId: loopInfo ? this.generateDeterministicNodeIdFromString(loopInfo.loopVariable || 'loop') : 'unknown',
        toNodeId: loopInfo ? this.generateDeterministicNodeIdFromString(loopInfo.loopBody) : 'unknown',
        controlFlowType: 'loop',
        condition: loopInfo?.condition,
        isLoop: true
      };
    }

    if (this.isExceptionFlow(node)) {
      const exceptionInfo = this.extractExceptionInfo(node);
      return {
        operation: 'exception_handling',
        fromNodeId: exceptionInfo ? this.generateDeterministicNodeIdFromString(exceptionInfo.tryBlock) : 'unknown',
        toNodeId: exceptionInfo ? this.generateDeterministicNodeIdFromString(exceptionInfo.catchBlock) : 'unknown',
        controlFlowType: 'exception',
        isLoop: false
      };
    }

    if (this.isBranchFlow(node)) {
      const branchInfo = this.extractBranchInfo(node);
      return {
        operation: 'pattern_matching',
        fromNodeId: branchInfo ? this.generateDeterministicNodeIdFromString(branchInfo.matcher) : 'unknown',
        toNodeId: branchInfo ? this.generateDeterministicNodeIdFromString(branchInfo.branches.join('_')) : 'unknown',
        controlFlowType: 'branch',
        condition: branchInfo?.matcher,
        isLoop: false
      };
    }

    return {
      operation: 'unknown',
      fromNodeId: 'unknown',
      toNodeId: 'unknown',
      controlFlowType: 'unknown',
      isLoop: false
    };
  }

  /**
   * 判断是否是条件流
   */
  private isConditionalFlow(node: Parser.SyntaxNode): boolean {
    return node.type === 'if_expression' || 
           node.type === 'if_let_expression' ||
           node.type === 'match_expression';
  }

  /**
   * 提取条件信息
   */
  private extractConditionalInfo(node: Parser.SyntaxNode): {
    condition: string;
    branches: string[];
  } | null {
    if (node.type === 'if_expression') {
      const conditionNode = node.childForFieldName('condition');
      const consequenceNode = node.childForFieldName('consequence');
      const alternativeNode = node.childForFieldName('alternative');
      
      const branches: string[] = [];
      if (consequenceNode?.text) branches.push('then');
      if (alternativeNode?.text) branches.push('else');
      
      return {
        condition: conditionNode?.text || 'unknown',
        branches
      };
    }
    
    if (node.type === 'if_let_expression') {
      const patternNode = node.childForFieldName('pattern');
      const valueNode = node.childForFieldName('value');
      
      return {
        condition: `${patternNode?.text || 'unknown'} = ${valueNode?.text || 'unknown'}`,
        branches: ['let_then', 'let_else']
      };
    }
    
    if (node.type === 'match_expression') {
      const valueNode = node.childForFieldName('value');
      const arms = node.childForFieldName('body');
      
      const branches: string[] = [];
      if (arms) {
        for (const child of arms.children || []) {
          if (child.type === 'match_arm') {
            branches.push(child.text || 'unknown');
          }
        }
      }
      
      return {
        condition: valueNode?.text || 'unknown',
        branches
      };
    }
    
    return null;
  }

  /**
   * 判断是否是循环流
   */
  private isLoopFlow(node: Parser.SyntaxNode): boolean {
    return node.type === 'loop_expression' ||
           node.type === 'while_expression' ||
           node.type === 'while_let_expression' ||
           node.type === 'for_expression';
  }

  /**
   * 提取循环信息
   */
  private extractLoopInfo(node: Parser.SyntaxNode): {
    loopVariable?: string;
    loopBody: string;
    condition?: string;
  } | null {
    if (node.type === 'loop_expression') {
      const bodyNode = node.childForFieldName('body');
      return {
        loopBody: bodyNode?.text || 'unknown'
      };
    }
    
    if (node.type === 'while_expression') {
      const conditionNode = node.childForFieldName('condition');
      const bodyNode = node.childForFieldName('body');
      
      return {
        loopBody: bodyNode?.text || 'unknown',
        condition: conditionNode?.text
      };
    }
    
    if (node.type === 'while_let_expression') {
      const patternNode = node.childForFieldName('pattern');
      const valueNode = node.childForFieldName('value');
      const bodyNode = node.childForFieldName('body');
      
      return {
        loopBody: bodyNode?.text || 'unknown',
        condition: `${patternNode?.text || 'unknown'} = ${valueNode?.text || 'unknown'}`
      };
    }
    
    if (node.type === 'for_expression') {
      const patternNode = node.childForFieldName('pattern');
      const iterableNode = node.childForFieldName('iterable');
      const bodyNode = node.childForFieldName('body');
      
      return {
        loopVariable: patternNode?.text,
        loopBody: bodyNode?.text || 'unknown',
        condition: `${patternNode?.text || 'unknown'} in ${iterableNode?.text || 'unknown'}`
      };
    }
    
    return null;
  }

  /**
   * 判断是否是异常流
   */
  private isExceptionFlow(node: Parser.SyntaxNode): boolean {
    // Rust没有传统的异常处理，但有Result和Option
    const text = node.text || '';
    return text.includes('Result') || text.includes('Option') || 
           text.includes('?') || text.includes('unwrap') ||
           text.includes('expect') || text.includes('match');
  }

  /**
   * 提取异常信息
   */
  private extractExceptionInfo(node: Parser.SyntaxNode): {
    tryBlock: string;
    catchBlock: string;
  } | null {
    // Rust的异常处理通过Result和Option实现
    const text = node.text || '';
    
    if (text.includes('Result')) {
      const match = text.match(/match\s+(\w+)\s*{([^}]+)}/);
      if (match) {
        return {
          tryBlock: match[1],
          catchBlock: match[2]
        };
      }
    }
    
    if (text.includes('?')) {
      // 简化实现：将?操作符视为异常处理
      return {
        tryBlock: 'function_with_question_mark',
        catchBlock: 'error_propagation'
      };
    }
    
    return null;
  }

  /**
   * 判断是否是回调流
   */
  private isCallbackFlow(node: Parser.SyntaxNode): boolean {
    if (node.type !== 'call_expression' && node.type !== 'method_call_expression') {
      return false;
    }
    
    const text = node.text || '';
    return text.includes('closure') || text.includes('|') || 
           text.includes('Fn') || text.includes('FnMut') || text.includes('FnOnce');
  }

  /**
   * 提取回调信息
   */
  private extractCallbackInfo(node: Parser.SyntaxNode): {
    caller: string;
    callback: string;
  } | null {
    const funcNode = node.childForFieldName('function') || node.childForFieldName('method');
    const argsNode = node.childForFieldName('arguments');
    
    if (funcNode?.text && argsNode) {
      // 查找闭包参数
      for (const child of argsNode.children || []) {
        if (child.type === 'closure_expression') {
          return {
            caller: funcNode.text,
            callback: child.text || 'closure'
          };
        }
      }
    }
    
    return null;
  }

  /**
   * 判断是否是分支流
   */
  private isBranchFlow(node: Parser.SyntaxNode): boolean {
    return node.type === 'match_expression';
  }

  /**
   * 提取分支信息
   */
  private extractBranchInfo(node: Parser.SyntaxNode): {
    matcher: string;
    branches: string[];
  } | null {
    if (node.type !== 'match_expression') return null;
    
    const valueNode = node.childForFieldName('value');
    const armsNode = node.childForFieldName('body');
    
    const branches: string[] = [];
    if (armsNode) {
      for (const child of armsNode.children || []) {
        if (child.type === 'match_arm') {
          const patternNode = child.childForFieldName('pattern');
          if (patternNode?.text) {
            branches.push(patternNode.text);
          }
        }
      }
    }
    
    return {
      matcher: valueNode?.text || 'unknown',
      branches
    };
  }

  /**
   * 判断是否是迭代流
   */
  private isIterationFlow(node: Parser.SyntaxNode): boolean {
    return node.type === 'for_expression' ||
           (node.type === 'call_expression' && 
            (node.text?.includes('iter') || node.text?.includes('collect')));
  }

  /**
   * 提取迭代信息
   */
  private extractIterationInfo(node: Parser.SyntaxNode): {
    iterator: string;
    iteratee: string;
  } | null {
    if (node.type === 'for_expression') {
      const patternNode = node.childForFieldName('pattern');
      const iterableNode = node.childForFieldName('iterable');
      
      return {
        iterator: patternNode?.text || 'unknown',
        iteratee: iterableNode?.text || 'unknown'
      };
    }
    
    if (node.type === 'call_expression') {
      const funcNode = node.childForFieldName('function');
      const argsNode = node.childForFieldName('arguments');
      
      if (funcNode?.text && argsNode) {
        if (funcNode.text.includes('iter')) {
          return {
            iterator: 'iterator',
            iteratee: argsNode.text || 'unknown'
          };
        }
        
        if (funcNode.text.includes('collect')) {
          return {
            iterator: argsNode.text || 'unknown',
            iteratee: 'collection'
          };
        }
      }
    }
    
    return null;
  }

  /**
   * 从字符串生成确定性节点ID
   */
  private generateDeterministicNodeIdFromString(text: string): string {
    return `string:${text.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  /**
   * 分析控制流复杂性
   */
  private analyzeControlFlowComplexity(node: Parser.SyntaxNode): {
    cyclomaticComplexity: number;
    nestingDepth: number;
    hasEarlyExit: boolean;
    hasMultiplePaths: boolean;
  } {
    let complexity = 1; // 基础复杂度
    let nestingDepth = 0;
    let hasEarlyExit = false;
    let hasMultiplePaths = false;
    
    // 计算圈复杂度
    if (node.type === 'if_expression') {
      complexity += 1;
      hasMultiplePaths = true;
    }
    
    if (node.type === 'match_expression') {
      const armsNode = node.childForFieldName('body');
      if (armsNode) {
        const armCount = armsNode.children?.filter(child => child.type === 'match_arm').length || 0;
        complexity += armCount;
        if (armCount > 1) hasMultiplePaths = true;
      }
    }
    
    if (node.type === 'loop_expression' || 
        node.type === 'while_expression' || 
        node.type === 'for_expression') {
      complexity += 1;
    }
    
    // 检查嵌套深度
    nestingDepth = this.calculateNestingDepth(node);
    
    // 检查早期退出
    const text = node.text || '';
    hasEarlyExit = text.includes('return') || text.includes('break') || text.includes('continue');
    
    return {
      cyclomaticComplexity: complexity,
      nestingDepth,
      hasEarlyExit,
      hasMultiplePaths
    };
  }

  /**
   * 计算嵌套深度
   */
  private calculateNestingDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node.parent;
    
    while (current) {
      if (this.isConditionalFlow(current) || this.isLoopFlow(current)) {
        depth++;
      }
      current = current.parent;
    }
    
    return depth;
  }

  /**
   * 提取控制流路径
   */
  private extractControlFlowPaths(node: Parser.SyntaxNode): Array<{
    path: string;
    condition?: string;
    probability?: number;
  }> {
    const paths: Array<{
      path: string;
      condition?: string;
      probability?: number;
    }> = [];
    
    if (node.type === 'if_expression') {
      const conditionNode = node.childForFieldName('condition');
      const consequenceNode = node.childForFieldName('consequence');
      const alternativeNode = node.childForFieldName('alternative');
      
      if (conditionNode?.text) {
        paths.push({
          path: 'then',
          condition: conditionNode.text,
          probability: 0.5
        });
        
        if (alternativeNode) {
          paths.push({
            path: 'else',
            condition: `!${conditionNode.text}`,
            probability: 0.5
          });
        }
      }
    }
    
    if (node.type === 'match_expression') {
      const valueNode = node.childForFieldName('value');
      const armsNode = node.childForFieldName('body');
      
      if (armsNode) {
        const armCount = armsNode.children?.filter(child => child.type === 'match_arm').length || 0;
        const probability = armCount > 0 ? 1.0 / armCount : 0;
        
        for (const child of armsNode.children || []) {
          if (child.type === 'match_arm') {
            const patternNode = child.childForFieldName('pattern');
            if (patternNode?.text) {
              paths.push({
                path: patternNode.text,
                condition: `${valueNode?.text || 'unknown'} matches ${patternNode.text}`,
                probability
              });
            }
          }
        }
      }
    }
    
    return paths;
  }
}