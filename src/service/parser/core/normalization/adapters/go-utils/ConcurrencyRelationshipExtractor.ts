import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { GoHelperMethods } from './GoHelperMethods';
import Parser from 'tree-sitter';

/**
 * Go 并发关系提取器
 * 从 GoLanguageAdapter 迁移的并发关系提取逻辑
 */
export class ConcurrencyRelationshipExtractor {
  /**
   * 提取并发关系元数据
   */
  extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const concurrencyType = this.determineConcurrencyType(astNode);
    const sourceNode = this.extractSourceNode(astNode);
    const targetNode = this.extractTargetNode(astNode);

    return {
      type: 'concurrency',
      fromNodeId: sourceNode ? NodeIdGenerator.forAstNode(sourceNode) : 'unknown',
      toNodeId: targetNode ? NodeIdGenerator.forAstNode(targetNode) : 'unknown',
      concurrencyType,
      synchronizationMechanism: this.extractSynchronizationMechanism(astNode),
      sharedResources: this.extractSharedResources(astNode),
      location: {
        filePath: symbolTable?.filePath || 'current_file.go',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 确定并发类型
   */
  private determineConcurrencyType(astNode: Parser.SyntaxNode): 'synchronizes' | 'locks' | 'communicates' | 'races' | 'waits' | 'coordinates' {
    const nodeType = astNode.type;
    
    if (nodeType === 'go_statement') {
      return 'coordinates';
    } else if (nodeType === 'send_statement' || nodeType === 'unary_expression') {
      return 'communicates';
    } else if (nodeType === 'call_expression') {
      const funcNode = astNode.childForFieldName('function');
      if (funcNode?.text) {
        const funcText = funcNode.text.toLowerCase();
        if (funcText.includes('lock') || funcText.includes('unlock')) {
          return 'locks';
        } else if (funcText.includes('wait') || funcText.includes('done') || funcText.includes('add')) {
          return 'waits';
        }
      }
    } else if (nodeType === 'select_statement') {
      return 'coordinates';
    }
    
    return 'synchronizes';
  }

  /**
   * 提取源节点
   */
  private extractSourceNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'go_statement') {
      // 对于goroutine，调用的函数是源
      return astNode.childForFieldName('call');
    } else if (nodeType === 'send_statement') {
      // 对于channel发送，发送的值是源
      return astNode.childForFieldName('value');
    } else if (nodeType === 'unary_expression' && astNode.text.includes('<-')) {
      // 对于channel接收，channel是源
      return astNode.childForFieldName('operand');
    } else if (nodeType === 'call_expression') {
      // 对于同步调用，调用者是源
      return GoHelperMethods.findCallerFunctionContext(astNode);
    }
    
    return null;
  }

  /**
   * 提取目标节点
   */
  private extractTargetNode(astNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'go_statement') {
      // 对于goroutine，目标是goroutine本身
      return astNode;
    } else if (nodeType === 'send_statement') {
      // 对于channel发送，channel是目标
      return astNode.childForFieldName('channel');
    } else if (nodeType === 'unary_expression' && astNode.text.includes('<-')) {
      // 对于channel接收，接收的变量是目标
      return astNode.parent;
    } else if (nodeType === 'call_expression') {
      // 对于同步调用，被调用的函数是目标
      return astNode.childForFieldName('function');
    }
    
    return null;
  }

  /**
   * 提取同步机制
   */
  private extractSynchronizationMechanism(astNode: Parser.SyntaxNode): string | null {
    const nodeType = astNode.type;
    
    if (nodeType === 'go_statement') {
      return 'goroutine';
    } else if (nodeType === 'send_statement' || nodeType === 'unary_expression') {
      return 'channel';
    } else if (nodeType === 'call_expression') {
      const funcNode = astNode.childForFieldName('function');
      if (funcNode?.text) {
        const funcText = funcNode.text.toLowerCase();
        if (funcText.includes('mutex')) {
          return 'mutex';
        } else if (funcText.includes('waitgroup')) {
          return 'waitgroup';
        } else if (funcText.includes('cond')) {
          return 'condition_variable';
        } else if (funcText.includes('once')) {
          return 'once';
        } else if (funcText.includes('pool')) {
          return 'pool';
        }
      }
    } else if (nodeType === 'select_statement') {
      return 'select';
    }
    
    return null;
  }

  /**
   * 提取共享资源
   */
  private extractSharedResources(astNode: Parser.SyntaxNode): string[] {
    const sharedResources: string[] = [];
    
    // 分析AST节点，查找可能的共享资源
    this.findSharedResources(astNode, sharedResources);
    
    return sharedResources;
  }

  /**
   * 递归查找共享资源
   */
  private findSharedResources(node: Parser.SyntaxNode, resources: string[]): void {
    if (!node) {
      return;
    }

    // 查找可能的共享资源标识符
    if (node.type === 'identifier') {
      const text = node.text;
      // 简单启发式：全局变量、共享数据结构等
      if (this.isLikelySharedResource(text)) {
        resources.push(text);
      }
    }

    // 递归检查子节点
    for (const child of node.children) {
      this.findSharedResources(child, resources);
    }
  }

  /**
   * 判断是否可能是共享资源
   */
  private isLikelySharedResource(identifier: string): boolean {
    // 简单启发式规则
    const sharedPatterns = [
      /^mutex/i,
      /^wait/i,
      /^cond/i,
      /^pool/i,
      /^cache/i,
      /^queue/i,
      /^map/i,
      /^slice/i,
      /^channel/i,
      /^chan/i,
      /^sync/i,
      /^atomic/i,
      /^global/i,
      /^shared/i
    ];

    return sharedPatterns.some(pattern => pattern.test(identifier));
  }

  /**
   * 提取并发关系数组
   */
  extractConcurrencyRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'synchronizes' | 'locks' | 'communicates' | 'races' | 'waits' | 'coordinates';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'synchronizes' | 'locks' | 'communicates' | 'races' | 'waits' | 'coordinates';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    const concurrencyType = this.determineConcurrencyType(mainNode);
    const sourceNode = this.extractSourceNode(mainNode);
    const targetNode = this.extractTargetNode(mainNode);

    if (sourceNode && targetNode) {
      const sourceName = GoHelperMethods.extractNameFromNode(sourceNode) || sourceNode.text;
      const targetName = GoHelperMethods.extractNameFromNode(targetNode) || targetNode.text;
      
      if (sourceName && targetName) {
        relationships.push({
          source: sourceName,
          target: targetName,
          type: concurrencyType
        });
      }
    }

    return relationships;
  }

  /**
   * 分析goroutine关系
   */
  private analyzeGoroutineRelationship(goStmt: Parser.SyntaxNode): {
    callerFunction: string;
    goroutineFunction: string;
    coordinationType: 'spawn' | 'join';
  } | null {
    if (goStmt.type !== 'go_statement') {
      return null;
    }

    const callNode = goStmt.childForFieldName('call');
    if (!callNode) {
      return null;
    }

    const funcNode = callNode.childForFieldName('function');
    if (!funcNode) {
      return null;
    }

    const callerNode = GoHelperMethods.findCallerFunctionContext(goStmt);
    const callerFunction = callerNode ? GoHelperMethods.extractNameFromNode(callerNode) || 'unknown' : 'unknown';
    const goroutineFunction = funcNode.text;

    return {
      callerFunction,
      goroutineFunction,
      coordinationType: 'spawn'
    };
  }

  /**
   * 分析channel通信关系
   */
  private analyzeChannelCommunication(channelNode: Parser.SyntaxNode): {
    channel: string;
    direction: 'send' | 'receive';
    dataType?: string;
    sender?: string;
    receiver?: string;
  } | null {
    if (channelNode.type === 'send_statement') {
      const channel = channelNode.childForFieldName('channel');
      const value = channelNode.childForFieldName('value');
      
      return {
        channel: channel?.text || 'unknown',
        direction: 'send',
        dataType: value?.type,
        sender: channelNode.parent ? GoHelperMethods.extractNameFromNode(channelNode.parent) || 'unknown' : 'unknown'
      };
    } else if (channelNode.type === 'unary_expression' && channelNode.text.includes('<-')) {
      const channel = channelNode.childForFieldName('operand');
      
      return {
        channel: channel?.text || 'unknown',
        direction: 'receive',
        receiver: channelNode.parent ? GoHelperMethods.extractNameFromNode(channelNode.parent) || 'unknown' : 'unknown'
      };
    }
    
    return null;
  }

  /**
   * 分析同步原语关系
   */
  private analyzeSynchronizationPrimitive(syncCall: Parser.SyntaxNode): {
    primitiveType: 'mutex' | 'waitgroup' | 'condition' | 'once' | 'atomic' | 'pool';
    operation: 'lock' | 'unlock' | 'wait' | 'signal' | 'add' | 'done' | 'do' | 'load' | 'store';
    target: string;
  } | null {
    if (syncCall.type !== 'call_expression') {
      return null;
    }

    const funcNode = syncCall.childForFieldName('function');
    if (!funcNode) {
      return null;
    }

    const funcText = funcNode.text.toLowerCase();
    let primitiveType: 'mutex' | 'waitgroup' | 'condition' | 'once' | 'atomic' | 'pool' = 'mutex';
    let operation: 'lock' | 'unlock' | 'wait' | 'signal' | 'add' | 'done' | 'do' | 'load' | 'store' = 'lock';

    if (funcText.includes('mutex')) {
      primitiveType = 'mutex';
      if (funcText.includes('lock')) {
        operation = 'lock';
      } else if (funcText.includes('unlock')) {
        operation = 'unlock';
      }
    } else if (funcText.includes('waitgroup')) {
      primitiveType = 'waitgroup';
      if (funcText.includes('wait')) {
        operation = 'wait';
      } else if (funcText.includes('add')) {
        operation = 'add';
      } else if (funcText.includes('done')) {
        operation = 'done';
      }
    } else if (funcText.includes('cond')) {
      primitiveType = 'condition';
      if (funcText.includes('wait')) {
        operation = 'wait';
      } else if (funcText.includes('signal') || funcText.includes('broadcast')) {
        operation = 'signal';
      }
    } else if (funcText.includes('once')) {
      primitiveType = 'once';
      if (funcText.includes('do')) {
        operation = 'do';
      }
    } else if (funcText.includes('atomic')) {
      primitiveType = 'atomic';
      if (funcText.includes('load')) {
        operation = 'load';
      } else if (funcText.includes('store')) {
        operation = 'store';
      }
    } else if (funcText.includes('pool')) {
      primitiveType = 'pool';
    }

    // 提取同步原语的目标对象
    const selectorExpr = funcNode.childForFieldName('operand');
    const target = selectorExpr ? GoHelperMethods.extractNameFromNode(selectorExpr) || 'unknown' : 'unknown';

    return {
      primitiveType,
      operation,
      target
    };
  }
}