import { NodeIdGenerator } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import {
  QueryMapping,
  RelationshipResult,
  EntityResult,
  QueryPatternType,
  SupportedLanguage
} from './types';

/**
 * 通用关系处理器
 * 一个处理器处理所有类型的关系
 */
export class ASTProcessor {

  /**
   * 处理查询结果
   */
  process(
    result: any,
    mapping: QueryMapping,
    language: SupportedLanguage
  ): RelationshipResult | EntityResult | null {
    // 根据模式类型选择处理策略
    switch (mapping.patternType) {
      case QueryPatternType.RELATIONSHIP:
        return this.processRelationship(result, mapping, language);
      case QueryPatternType.ENTITY:
        return this.processEntity(result, mapping, language);
      case QueryPatternType.SHARED:
        return this.processShared(result, mapping, language);
      default:
        return null;
    }
  }

  /**
   * 处理关系
   */
  private processRelationship(
    result: any,
    mapping: QueryMapping,
    language: SupportedLanguage
  ): RelationshipResult | null {
    const captures = result.captures || [];

    // 提取源和目标节点
    const sourceNode = this.extractSourceNode(captures, mapping);
    const targetNode = this.extractTargetNode(captures, mapping);

    if (!sourceNode) return null;

    // 构建关系对象
    return {
      source: NodeIdGenerator.forAstNode(sourceNode),
      target: targetNode ? NodeIdGenerator.forAstNode(targetNode) : 'unknown',
      type: mapping.relationship?.type || 'unknown',
      category: mapping.relationship?.category || 'unknown',
      metadata: this.buildMetadata(result, mapping, language),
      location: this.extractLocation(sourceNode)
    };
  }

  /**
   * 处理实体
   */
  private processEntity(
    result: any,
    mapping: QueryMapping,
    language: SupportedLanguage
  ): EntityResult | null {
    const captures = result.captures || [];

    // 提取实体节点
    const entityNode = this.extractEntityNode(captures, mapping);
    if (!entityNode) return null;

    // 构建实体对象
    return {
      id: NodeIdGenerator.forAstNode(entityNode),
      type: mapping.entity?.type || 'unknown',
      category: mapping.entity?.category || 'unknown',
      name: entityNode.text || 'unknown',
      metadata: this.buildMetadata(result, mapping, language),
      location: this.extractLocation(entityNode)
    };
  }

  /**
   * 处理共享模式（同时生成关系和实体）
   */
  private processShared(
    result: any,
    mapping: QueryMapping,
    language: SupportedLanguage
  ): RelationshipResult | EntityResult | null {
    // 优先处理关系，如果失败则处理实体
    const relationship = this.processRelationship(result, mapping, language);
    if (relationship) return relationship;

    return this.processEntity(result, mapping, language);
  }

  /**
   * 提取源节点
   */
  private extractSourceNode(captures: any[], mapping: QueryMapping): Parser.SyntaxNode | null {
    if (!mapping.captures.source) return null;

    const sourceCapture = captures.find(c => c.name === mapping.captures.source);
    return sourceCapture?.node || null;
  }

  /**
   * 提取目标节点
   */
  private extractTargetNode(captures: any[], mapping: QueryMapping): Parser.SyntaxNode | null {
    if (!mapping.captures.target) return null;

    const targetCapture = captures.find(c => c.name === mapping.captures.target);
    return targetCapture?.node || null;
  }

  /**
   * 提取实体节点
   */
  private extractEntityNode(captures: any[], mapping: QueryMapping): Parser.SyntaxNode | null {
    if (!mapping.captures.entityType) return null;

    const entityCapture = captures.find(c => c.name === mapping.captures.entityType);
    return entityCapture?.node || null;
  }

  /**
   * 构建元数据
   */
  private buildMetadata(
    result: any,
    mapping: QueryMapping,
    language: SupportedLanguage
  ): Record<string, any> {
    const baseMetadata = mapping.relationship?.metadata || mapping.entity?.metadata || {};

    // 添加处理器配置
    if (mapping.processorConfig) {
      Object.assign(baseMetadata, mapping.processorConfig);
    }

    // 添加语言特定的元数据
    Object.assign(baseMetadata, this.extractLanguageSpecificMetadata(result, language));

    return baseMetadata;
  }

  /**
   * 提取语言特定的元数据
   */
  private extractLanguageSpecificMetadata(result: any, language: SupportedLanguage): Record<string, any> {
    const metadata: Record<string, any> = {
      language,
      extractedAt: Date.now()
    };

    // 根据语言和节点类型提取特定信息
    const astNode = result.captures?.[0]?.node;
    if (astNode) {
      switch (language) {
        case 'c':
        case 'cpp':
          return this.extractCLanguageMetadata(astNode, metadata);
        case 'javascript':
        case 'typescript':
          return this.extractJSLanguageMetadata(astNode, metadata);
        case 'python':
          return this.extractPythonLanguageMetadata(astNode, metadata);
        default:
          return metadata;
      }
    }

    return metadata;
  }

  /**
   * 提取C/C++语言特定元数据
   */
  private extractCLanguageMetadata(astNode: Parser.SyntaxNode, metadata: Record<string, any>): Record<string, any> {
    if (astNode.type === 'call_expression') {
      const functionName = this.extractFunctionName(astNode);
      if (functionName) {
        metadata.functionName = functionName;

        // 识别函数类型
        if (this.isMemoryFunction(functionName)) {
          metadata.functionCategory = 'memory';
        } else if (this.isFileFunction(functionName)) {
          metadata.functionCategory = 'file';
        } else if (this.isThreadFunction(functionName)) {
          metadata.functionCategory = 'thread';
        }
      }
    }

    return metadata;
  }

  /**
    * 提取JavaScript/TypeScript语言特定元数据
    */
  private extractJSLanguageMetadata(astNode: Parser.SyntaxNode, metadata: Record<string, any>): Record<string, any> {
    if (astNode.type === 'call_expression') {
      const functionName = this.extractFunctionName(astNode);
      if (functionName) {
        metadata.functionName = functionName;

        // 识别异步函数
        if (this.isAsyncFunction(functionName)) {
          metadata.isAsync = true;
        }
      }
    }

    return metadata;
  }

  /**
    * 提取Python语言特定元数据
    */
  private extractPythonLanguageMetadata(astNode: Parser.SyntaxNode, metadata: Record<string, any>): Record<string, any> {
    if (astNode.type === 'call') {
      const functionName = this.extractFunctionName(astNode);
      if (functionName) {
        metadata.functionName = functionName;

        // 识别装饰器函数
        if (this.isDecoratorFunction(functionName)) {
          metadata.isDecorator = true;
        }
      }
    }

    return metadata;
  }

  /**
   * 提取位置信息
   */
  private extractLocation(node: Parser.SyntaxNode): { filePath: string; lineNumber: number; columnNumber: number } {
    return {
      filePath: 'current_file',
      lineNumber: node.startPosition.row + 1,
      columnNumber: node.startPosition.column
    };
  }

  /**
   * 辅助方法：提取函数名
   */
  private extractFunctionName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'call_expression') {
      const functionNode = astNode.childForFieldName('function');
      return functionNode?.text || null;
    } else if (astNode.type === 'call') {
      const functionNode = astNode.childForFieldName('function');
      return functionNode?.text || null;
    }
    return null;
  }

  /**
   * 辅助方法：识别内存函数
   */
  private isMemoryFunction(functionName: string): boolean {
    const memoryFunctions = ['malloc', 'calloc', 'realloc', 'free', 'alloca'];
    return memoryFunctions.some(func => functionName.includes(func));
  }

  /**
   * 辅助方法：识别文件函数
   */
  private isFileFunction(functionName: string): boolean {
    const fileFunctions = ['fopen', 'fclose', 'fread', 'fwrite', 'open', 'close'];
    return fileFunctions.some(func => functionName.includes(func));
  }

  /**
   * 辅助方法：识别线程函数
   */
  private isThreadFunction(functionName: string): boolean {
    const threadFunctions = ['pthread_create', 'pthread_join', 'pthread_detach'];
    return threadFunctions.some(func => functionName.includes(func));
  }

  /**
   * 辅助方法：识别异步函数
   */
  private isAsyncFunction(functionName: string): boolean {
    const asyncFunctions = ['setTimeout', 'setInterval', 'Promise', 'async', 'await'];
    return asyncFunctions.some(func => functionName.includes(func));
  }

  /**
   * 辅助方法：识别装饰器函数
   */
  private isDecoratorFunction(functionName: string): boolean {
    const decoratorFunctions = ['property', 'staticmethod', 'classmethod'];
    return decoratorFunctions.some(func => functionName.includes(func));
  }
}