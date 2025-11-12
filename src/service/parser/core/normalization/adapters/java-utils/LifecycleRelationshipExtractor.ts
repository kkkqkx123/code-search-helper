import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { JavaHelperMethods } from './JavaHelperMethods';
import Parser from 'tree-sitter';

/**
 * Java 生命周期关系提取器
 * 从 JavaLanguageAdapter 迁移生命周期关系提取逻辑
 */
export class LifecycleRelationshipExtractor {
  /**
   * 提取生命周期关系元数据
   */
  extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const captures = result.captures || [];
    const metadata: any = {
      type: 'lifecycle',
      location: {
        filePath: symbolTable?.filePath || 'current_file.java',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column
      }
    };

    // 提取生命周期操作类型
    for (const capture of captures) {
      if (capture.name.includes('instantiated') || capture.name.includes('constructor')) {
        metadata.lifecycleType = 'instantiates';
        metadata.instantiatedClass = capture.node.text;
        metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
        metadata.toNodeId = NodeIdGenerator.forAstNode(capture.node);
      } else if (capture.name.includes('close') || capture.name.includes('destroy')) {
        metadata.lifecycleType = 'destroys';
        metadata.destroyedResource = capture.node.text;
        metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
        metadata.toNodeId = NodeIdGenerator.forAstNode(capture.node);
      } else if (capture.name.includes('init') || capture.name.includes('initialize')) {
        metadata.lifecycleType = 'initializes';
        metadata.initializedResource = capture.node.text;
        metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
        metadata.toNodeId = NodeIdGenerator.forAstNode(capture.node);
      }
    }

    // 如果没有从捕获中获取到信息，尝试从AST节点分析
    if (!metadata.lifecycleType) {
      this.analyzeLifecycleFromAST(astNode, metadata);
    }

    return metadata;
  }

  /**
   * 从AST节点分析生命周期关系
   */
  private analyzeLifecycleFromAST(astNode: Parser.SyntaxNode, metadata: any): void {
    // 提取实例化关系
    if (astNode.type === 'object_creation_expression') {
      const type = astNode.childForFieldName('type');
      if (type?.text) {
        metadata.lifecycleType = 'instantiates';
        metadata.instantiatedClass = type.text;
        metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
        metadata.toNodeId = NodeIdGenerator.forAstNode(type);
      }
    }

    // 提取初始化关系
    if (astNode.type === 'constructor_declaration') {
      metadata.lifecycleType = 'initializes';
      const constructorName = astNode.childForFieldName('name');
      if (constructorName?.text) {
        metadata.initializedResource = constructorName.text;
        metadata.toNodeId = NodeIdGenerator.forAstNode(constructorName);
      }
      metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
    }

    // 提取析构关系（finalizer）
    if (astNode.type === 'method_declaration' && astNode.text?.includes('finalize')) {
      metadata.lifecycleType = 'destroys';
      const methodName = astNode.childForFieldName('name');
      if (methodName?.text) {
        metadata.destroyedResource = methodName.text;
        metadata.toNodeId = NodeIdGenerator.forAstNode(methodName);
      }
      metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
    }

    // 检查资源管理
    const text = astNode.text || '';
    if (text.includes('try-with-resources') || text.includes('AutoCloseable')) {
      metadata.lifecycleType = 'manages';
      metadata.managedResource = this.extractManagedResource(astNode);
      metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
    }

    // 检查Spring生命周期
    if (text.includes('@PostConstruct') || text.includes('@PreDestroy')) {
      metadata.lifecycleType = text.includes('@PostConstruct') ? 'initializes' : 'destroys';
      metadata.lifecycleAnnotation = text.includes('@PostConstruct') ? '@PostConstruct' : '@PreDestroy';
      metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
    }

    // 检查初始化块
    if (astNode.type === 'block' && astNode.parent?.type === 'class_body') {
      metadata.lifecycleType = 'initializes';
      metadata.initializationBlock = 'static';
      metadata.fromNodeId = NodeIdGenerator.forAstNode(astNode);
    }
  }

  /**
   * 提取管理的资源
   */
  private extractManagedResource(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'try_with_resources_statement') {
      const resources = astNode.childForFieldName('resources');
      if (resources?.text) {
        return resources.text;
      }
    } else if (astNode.type === 'method_invocation') {
      const method = astNode.childForFieldName('name');
      if (method?.text && (method.text.includes('close') || method.text.includes('shutdown'))) {
        const object = astNode.childForFieldName('object');
        return object?.text || method.text;
      }
    }
    return null;
  }

  /**
   * 提取生命周期关系数组
   */
  extractLifecycleRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取实例化关系
    if (mainNode.type === 'object_creation_expression') {
      const type = mainNode.childForFieldName('type');
      if (type?.text) {
        relationships.push({
          source: 'new-instance',
          target: type.text,
          type: 'instantiates'
        });
      }
    }

    // 提取初始化关系
    if (mainNode.type === 'constructor_declaration') {
      relationships.push({
        source: 'constructor',
        target: 'instance',
        type: 'initializes'
      });
    }

    // 提取析构关系（finalizer）
    if (mainNode.type === 'method_declaration' && mainNode.text?.includes('finalize')) {
      relationships.push({
        source: 'instance',
        target: 'finalize',
        type: 'destroys'
      });
    }

    // 检查资源管理
    const text = mainNode.text || '';
    if (text.includes('try-with-resources') || text.includes('AutoCloseable')) {
      relationships.push({
        source: 'resource-manager',
        target: 'managed-resource',
        type: 'manages'
      });
    }

    // 检查Spring生命周期
    if (text.includes('@PostConstruct')) {
      relationships.push({
        source: 'container',
        target: 'bean',
        type: 'initializes'
      });
    }

    if (text.includes('@PreDestroy')) {
      relationships.push({
        source: 'container',
        target: 'bean',
        type: 'destroys'
      });
    }

    // 检查初始化块
    if (mainNode.type === 'block' && mainNode.parent?.type === 'class_body') {
      relationships.push({
        source: 'class-loader',
        target: 'class',
        type: 'initializes'
      });
    }

    // 检查静态初始化块
    if (mainNode.type === 'block' && mainNode.parent?.type === 'class_body') {
      const prevSibling = mainNode.previousSibling;
      if (prevSibling?.type === 'modifiers' && prevSibling.text?.includes('static')) {
        relationships.push({
          source: 'class-loader',
          target: 'static-block',
          type: 'initializes'
        });
      }
    }

    return relationships;
  }
}