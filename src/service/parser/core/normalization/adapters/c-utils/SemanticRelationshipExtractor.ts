import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C语言语义关系提取器
 * 分析设计模式、错误处理、代码结构等语义关系
 */
export class CSemanticRelationshipExtractor {
  /**
   * 提取语义关系元数据
   */
  extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const pattern = this.determineSemanticPattern(astNode);

    if (!pattern) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractSemanticNodes(astNode, pattern);

    return {
      type: 'semantic',
      pattern,
      fromNodeId,
      toNodeId,
      confidence: this.calculateConfidence(astNode, pattern),
      description: this.generateDescription(astNode, pattern),
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取语义关系数组
   */
  extractSemanticRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为语义相关的节点类型
    if (!this.isSemanticNode(astNode)) {
      return relationships;
    }

    const semanticMetadata = this.extractSemanticMetadata(result, astNode, null);
    if (semanticMetadata) {
      relationships.push(semanticMetadata);
    }

    return relationships;
  }

  /**
   * 确定语义模式
   */
  private determineSemanticPattern(astNode: Parser.SyntaxNode): 'singleton' | 'factory' | 'observer' | 'strategy' | 'error_handling' | 'resource_management' | 'callback' | 'state_machine' | null {
    const text = astNode.text || '';

    // 单例模式检测
    if (this.isSingletonPattern(astNode)) {
      return 'singleton';
    }

    // 工厂模式检测
    if (this.isFactoryPattern(astNode)) {
      return 'factory';
    }

    // 观察者模式检测
    if (this.isObserverPattern(astNode)) {
      return 'observer';
    }

    // 策略模式检测
    if (this.isStrategyPattern(astNode)) {
      return 'strategy';
    }

    // 错误处理模式检测
    if (this.isErrorHandlingPattern(astNode)) {
      return 'error_handling';
    }

    // 资源管理模式检测
    if (this.isResourceManagementPattern(astNode)) {
      return 'resource_management';
    }

    // 回调模式检测
    if (this.isCallbackPattern(astNode)) {
      return 'callback';
    }

    // 状态机模式检测
    if (this.isStateMachinePattern(astNode)) {
      return 'state_machine';
    }

    return null;
  }

  /**
   * 提取语义关系的节点
   */
  private extractSemanticNodes(astNode: Parser.SyntaxNode, pattern: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    // 根据模式类型提取相关节点
    switch (pattern) {
      case 'singleton':
        toNodeId = this.extractSingletonInstanceNode(astNode);
        break;
      case 'factory':
        toNodeId = this.extractFactoryProductNode(astNode);
        break;
      case 'observer':
        toNodeId = this.extractObserverSubjectNode(astNode);
        break;
      case 'strategy':
        toNodeId = this.extractStrategyContextNode(astNode);
        break;
      case 'error_handling':
        toNodeId = this.extractErrorHandlerNode(astNode);
        break;
      case 'resource_management':
        toNodeId = this.extractResourceNode(astNode);
        break;
      case 'callback':
        toNodeId = this.extractCallbackFunctionNode(astNode);
        break;
      case 'state_machine':
        toNodeId = this.extractStateMachineNode(astNode);
        break;
    }

    return { fromNodeId, toNodeId: toNodeId || 'unknown' };
  }

  /**
   * 检测单例模式
   */
  private isSingletonPattern(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';

    // 检查静态变量和全局访问点
    return (text.includes('static') && text.includes('instance')) ||
      (text.includes('static') && text.includes('getInstance'));
  }

  /**
   * 检测工厂模式
   */
  private isFactoryPattern(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';

    // 检查创建函数和返回类型
    return (text.includes('create') || text.includes('factory')) &&
      (text.includes('return') || text.includes('malloc'));
  }

  /**
   * 检测观察者模式
   */
  private isObserverPattern(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';

    // 检查注册、通知、回调函数
    return (text.includes('register') || text.includes('subscribe') || text.includes('attach')) &&
      (text.includes('notify') || text.includes('update') || text.includes('callback'));
  }

  /**
   * 检测策略模式
   */
  private isStrategyPattern(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';

    // 检查函数指针和策略选择
    return (text.includes('strategy') || text.includes('algorithm')) &&
      (text.includes('function') && text.includes('pointer'));
  }

  /**
   * 检测错误处理模式
   */
  private isErrorHandlingPattern(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';

    // 检查错误码、异常处理
    return (text.includes('error') || text.includes('fail') || text.includes('errno')) &&
      (text.includes('if') || text.includes('return') || text.includes('goto'));
  }

  /**
   * 检测资源管理模式
   */
  private isResourceManagementPattern(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';

    // 检查资源获取和释放
    return (text.includes('malloc') || text.includes('fopen') || text.includes('open')) &&
      (text.includes('free') || text.includes('fclose') || text.includes('close'));
  }

  /**
   * 检测回调模式
   */
  private isCallbackPattern(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';

    // 检查函数指针和回调参数
    return (text.includes('callback') || text.includes('handler')) &&
      (text.includes('function') && text.includes('pointer'));
  }

  /**
   * 检测状态机模式
   */
  private isStateMachinePattern(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';

    // 检查状态变量和状态转换
    return (text.includes('state') || text.includes('status')) &&
      (text.includes('switch') || text.includes('enum'));
  }

  /**
   * 提取单例实例节点
   */
  private extractSingletonInstanceNode(astNode: Parser.SyntaxNode): string {
    // 查找静态实例变量
    const text = astNode.text || '';
    const instanceMatch = text.match(/static\s+\w+\s+(\w+)/);
    if (instanceMatch) {
      return instanceMatch[1];
    }
    return 'unknown';
  }

  /**
   * 提取工厂产品节点
   */
  private extractFactoryProductNode(astNode: Parser.SyntaxNode): string {
    // 查找返回类型
    const text = astNode.text || '';
    const returnMatch = text.match(/(\w+)\s*\*\s*\w+\s*\(/);
    if (returnMatch) {
      return returnMatch[1];
    }
    return 'unknown';
  }

  /**
   * 提取观察者主题节点
   */
  private extractObserverSubjectNode(astNode: Parser.SyntaxNode): string {
    // 查找主题对象
    const text = astNode.text || '';
    const subjectMatch = text.match(/(\w+)\s*->\s*(register|notify|subscribe)/);
    if (subjectMatch) {
      return subjectMatch[1];
    }
    return 'unknown';
  }

  /**
   * 提取策略上下文节点
   */
  private extractStrategyContextNode(astNode: Parser.SyntaxNode): string {
    // 查找策略上下文
    const text = astNode.text || '';
    const contextMatch = text.match(/(\w+)\s*->\s*execute/);
    if (contextMatch) {
      return contextMatch[1];
    }
    return 'unknown';
  }

  /**
   * 提取错误处理器节点
   */
  private extractErrorHandlerNode(astNode: Parser.SyntaxNode): string {
    // 查找错误处理函数
    const text = astNode.text || '';
    const handlerMatch = text.match(/(\w+)\s*\([^)]*error[^)]*\)/);
    if (handlerMatch) {
      return handlerMatch[1];
    }
    return 'unknown';
  }

  /**
   * 提取资源节点
   */
  private extractResourceNode(astNode: Parser.SyntaxNode): string {
    // 查找资源变量
    const text = astNode.text || '';
    const resourceMatch = text.match(/(\w+)\s*=\s*(malloc|fopen|open)/);
    if (resourceMatch) {
      return resourceMatch[1];
    }
    return 'unknown';
  }

  /**
   * 提取回调函数节点
   */
  private extractCallbackFunctionNode(astNode: Parser.SyntaxNode): string {
    // 查找回调函数
    const text = astNode.text || '';
    const callbackMatch = text.match(/(\w+)\s*\([^)]*callback[^)]*\)/);
    if (callbackMatch) {
      return callbackMatch[1];
    }
    return 'unknown';
  }

  /**
   * 提取状态机节点
   */
  private extractStateMachineNode(astNode: Parser.SyntaxNode): string {
    // 查找状态变量
    const text = astNode.text || '';
    const stateMatch = text.match(/(\w+)\s*->\s*state/);
    if (stateMatch) {
      return stateMatch[1];
    }
    return 'unknown';
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(astNode: Parser.SyntaxNode, pattern: string): number {
    // 基于模式特征计算置信度
    const text = astNode.text || '';
    let confidence = 0.5; // 基础置信度

    // 根据模式类型调整置信度
    switch (pattern) {
      case 'singleton':
        if (text.includes('static') && text.includes('instance')) confidence += 0.3;
        if (text.includes('getInstance')) confidence += 0.2;
        break;
      case 'factory':
        if (text.includes('create')) confidence += 0.3;
        if (text.includes('return')) confidence += 0.2;
        break;
      case 'error_handling':
        if (text.includes('error')) confidence += 0.3;
        if (text.includes('if') && text.includes('return')) confidence += 0.2;
        break;
      // 其他模式的置信度计算...
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * 生成描述
   */
  private generateDescription(astNode: Parser.SyntaxNode, pattern: string): string {
    const descriptions: Record<string, string> = {
      'singleton': '单例模式实现',
      'factory': '工厂模式实现',
      'observer': '观察者模式实现',
      'strategy': '策略模式实现',
      'error_handling': '错误处理模式',
      'resource_management': '资源管理模式',
      'callback': '回调模式实现',
      'state_machine': '状态机模式实现'
    };

    return descriptions[pattern] || '未知语义模式';
  }

  /**
   * 判断是否为语义关系节点
   */
  private isSemanticNode(astNode: Parser.SyntaxNode): boolean {
    const text = astNode.text || '';

    // 检查是否包含语义相关的关键词
    const semanticKeywords = [
      'instance', 'create', 'factory', 'register', 'notify', 'subscribe',
      'strategy', 'algorithm', 'error', 'fail', 'callback', 'handler',
      'state', 'status', 'malloc', 'free', 'fopen', 'fclose'
    ];

    return semanticKeywords.some(keyword => text.includes(keyword));
  }
}