import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { CSharpHelperMethods } from './CSharpHelperMethods';
import Parser from 'tree-sitter';

/**
 * C# 生命周期关系提取器
 * 从 CSharpLanguageAdapter 迁移
 */
export class LifecycleRelationshipExtractor {
  /**
   * 提取生命周期关系元数据
   */
  extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const lifecycleType = this.determineLifecycleType(astNode);
    const resourceNode = this.extractResourceNode(astNode);
    const managerNode = this.extractManagerNode(astNode);

    return {
      type: 'lifecycle',
      lifecycleType,
      fromNodeId: managerNode ? generateDeterministicNodeId(managerNode) : 'unknown',
      toNodeId: resourceNode ? generateDeterministicNodeId(resourceNode) : 'unknown',
      resourceType: this.extractResourceType(astNode),
      location: {
        filePath: symbolTable?.filePath || 'current_file.cs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
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

    const nodeType = mainNode.type;
    
    // 检查对象实例化
    if (nodeType.includes('object_creation_expression') || 
        (nodeType.includes('assignment') && mainNode.text.includes('new'))) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('constructed.class')) {
          const target = capture.node?.text || '';
          const sourceCapture = result.captures?.find((c: any) => 
            c.name.includes('target.variable') || 
            c.name.includes('object_creation_expression'));
          const source = sourceCapture?.node?.childForFieldName?.('left')?.text || 'unknown';

          if (source && target) {
            relationships.push({
              source,
              target,
              type: 'instantiates'
            });
          }
        }
      }
    }
    // 检查using语句（资源管理）
    else if (nodeType.includes('using')) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('resource.to.dispose')) {
          const source = capture.node?.text || '';
          const targetCapture = result.captures?.find((c: any) =>
            c.name.includes('using.body') || c.name.includes('using.declaration'));
          const target = (targetCapture?.node as Parser.SyntaxNode | null)?.text || '';

          if (source && target) {
            relationships.push({
              source,
              target,
              type: 'manages'
            });
          }
        }
      }
    }
    // 检查Dispose调用
    else if (nodeType.includes('invocation') && mainNode.text.includes('Dispose')) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('resource.object')) {
          const source = capture.node?.text || '';
          
          relationships.push({
            source,
            target: 'resource',
            type: 'destroys'
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 确定生命周期类型
   */
  private determineLifecycleType(node: Parser.SyntaxNode): 'instantiates' | 'initializes' | 'destroys' | 'manages' | 'disposes' | 'finalizes' {
    const text = node.text;
    
    if (node.type === 'object_creation_expression' || text.includes('new')) {
      return 'instantiates';
    } else if (node.type === 'constructor_declaration') {
      return 'initializes';
    } else if (node.type === 'destructor_declaration') {
      return 'destroys';
    } else if (node.type === 'using_statement' || node.type === 'using_directive') {
      return 'manages';
    } else if (text.includes('Dispose')) {
      return 'disposes';
    } else if (text.includes('Finalize') || text.includes('~')) {
      return 'finalizes';
    }
    
    return 'instantiates';
  }

  /**
   * 提取资源节点
   */
  private extractResourceNode(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    switch (node.type) {
      case 'object_creation_expression':
        return node.childForFieldName('type');
      case 'constructor_declaration':
        return node.childForFieldName('name');
      case 'destructor_declaration':
        return node.childForFieldName('name');
      case 'using_statement':
        return node.childForFieldName('declaration');
      case 'invocation_expression':
        if (node.text.includes('Dispose')) {
          return node.childForFieldName('arguments');
        }
        break;
    }
    
    return null;
  }

  /**
   * 提取管理器节点
   */
  private extractManagerNode(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    switch (node.type) {
      case 'object_creation_expression':
        return node.parent?.childForFieldName('left');
      case 'using_statement':
        return node.childForFieldName('body');
      case 'invocation_expression':
        if (node.text.includes('Dispose')) {
          return node.childForFieldName('function');
        }
        break;
    }
    
    return null;
  }

  /**
   * 提取资源类型
   */
  private extractResourceType(node: Parser.SyntaxNode): string | null {
    switch (node.type) {
      case 'object_creation_expression':
        const typeNode = node.childForFieldName('type');
        return typeNode?.text || null;
      case 'using_statement':
        const declaration = node.childForFieldName('declaration');
        if (declaration) {
          const typeNode = declaration.childForFieldName('type');
          return typeNode?.text || null;
        }
        break;
    }
    
    return null;
  }

  /**
   * 分析对象初始化模式
   */
  analyzeObjectInitialization(node: Parser.SyntaxNode): Array<{
    objectType: string;
    initializationType: 'constructor' | 'factory' | 'dependency_injection' | 'reflection';
    parameters: string[];
    properties: string[];
  }> {
    const initializations: Array<{
      objectType: string;
      initializationType: 'constructor' | 'factory' | 'dependency_injection' | 'reflection';
      parameters: string[];
      properties: string[];
    }> = [];

    if (node.type !== 'object_creation_expression') {
      return initializations;
    }

    const typeNode = node.childForFieldName('type');
    const objectType = typeNode?.text || 'unknown';
    
    const initializationType = this.determineInitializationType(node);
    const parameters = this.extractConstructorParameters(node);
    const properties = this.extractObjectInitializerProperties(node);

    initializations.push({
      objectType,
      initializationType,
      parameters,
      properties
    });

    return initializations;
  }

  /**
   * 确定初始化类型
   */
  private determineInitializationType(node: Parser.SyntaxNode): 'constructor' | 'factory' | 'dependency_injection' | 'reflection' {
    const text = node.text;
    
    if (text.includes('Activator.CreateInstance') || text.includes('CreateInstance')) {
      return 'reflection';
    } else if (this.isFactoryMethod(node)) {
      return 'factory';
    } else if (this.isDependencyInjection(node)) {
      return 'dependency_injection';
    }
    
    return 'constructor';
  }

  /**
   * 判断是否为工厂方法
   */
  private isFactoryMethod(node: Parser.SyntaxNode): boolean {
    const parent = node.parent;
    if (!parent) {
      return false;
    }

    // 检查是否是工厂方法的调用
    const functionNode = parent.childForFieldName('function');
    if (functionNode?.text) {
      const factoryPatterns = ['Create', 'Build', 'Make', 'Get', 'New'];
      return factoryPatterns.some(pattern => functionNode.text.includes(pattern));
    }

    return false;
  }

  /**
   * 判断是否为依赖注入
   */
  private isDependencyInjection(node: Parser.SyntaxNode): boolean {
    const parent = node.parent;
    if (!parent) {
      return false;
    }

    // 检查是否在依赖注入容器中
    const functionNode = parent.childForFieldName('function');
    if (functionNode?.text) {
      const diPatterns = ['Resolve', 'GetService', 'CreateScope', 'ServiceProvider'];
      return diPatterns.some(pattern => functionNode.text.includes(pattern));
    }

    return false;
  }

  /**
   * 提取构造函数参数
   */
  private extractConstructorParameters(node: Parser.SyntaxNode): string[] {
    const argumentsNode = node.childForFieldName('arguments');
    if (!argumentsNode) {
      return [];
    }

    const parameters: string[] = [];
    for (const child of argumentsNode.children) {
      if (child.text) {
        parameters.push(child.text);
      }
    }

    return parameters;
  }

  /**
   * 提取对象初始化器属性
   */
  private extractObjectInitializerProperties(node: Parser.SyntaxNode): string[] {
    const properties: string[] = [];
    
    // 查找对象初始化器
    for (const child of node.children) {
      if (child.type === 'initializer_expression') {
        for (const assignment of child.children) {
          if (assignment.type === 'assignment_expression') {
            const left = assignment.childForFieldName('left');
            if (left?.text) {
              properties.push(left.text);
            }
          }
        }
      }
    }

    return properties;
  }

  /**
   * 分析资源管理模式
   */
  analyzeResourceManagement(node: Parser.SyntaxNode): Array<{
    resourceType: string;
    managementPattern: 'using_statement' | 'try_finally' | 'dispose_pattern' | 'finalizer';
    acquisitionPoint: string;
    releasePoint: string;
  }> {
    const patterns: Array<{
      resourceType: string;
      managementPattern: 'using_statement' | 'try_finally' | 'dispose_pattern' | 'finalizer';
      acquisitionPoint: string;
      releasePoint: string;
    }> = [];

    if (node.type === 'using_statement') {
      const resourceType = this.extractResourceType(node);
      const acquisitionPoint = node.childForFieldName('declaration')?.text || 'unknown';
      const releasePoint = 'implicit_dispose';

      patterns.push({
        resourceType: resourceType || 'unknown',
        managementPattern: 'using_statement',
        acquisitionPoint,
        releasePoint
      });
    } else if (node.type === 'try_statement') {
      // 检查try-finally模式
      const finallyClause = node.children.find(child => child.type === 'finally_clause');
      if (finallyClause && this.containsDisposeCall(finallyClause)) {
        const resourceType = this.findResourceInTryBlock(node);
        const acquisitionPoint = 'try_block';
        const releasePoint = 'finally_block';

        patterns.push({
          resourceType: resourceType || 'unknown',
          managementPattern: 'try_finally',
          acquisitionPoint,
          releasePoint
        });
      }
    }

    return patterns;
  }

  /**
   * 检查是否包含Dispose调用
   */
  private containsDisposeCall(node: Parser.SyntaxNode): boolean {
    return node.text.includes('Dispose');
  }

  /**
   * 在try块中查找资源
   */
  private findResourceInTryBlock(tryNode: Parser.SyntaxNode): string | null {
    const block = tryNode.childForFieldName('body');
    if (!block) {
      return null;
    }

    // 简化实现：查找第一个对象创建
    for (const child of block.children) {
      if (child.type === 'object_creation_expression') {
        const typeNode = child.childForFieldName('type');
        return typeNode?.text || null;
      }
    }

    return null;
  }

  /**
   * 分析IDisposable实现
   */
  analyzeIDisposableImplementation(node: Parser.SyntaxNode): {
    implementsDispose: boolean;
    hasFinalizer: boolean;
    disposePattern: 'standard' | 'virtual' | 'sealed' | 'none';
    resourceFields: string[];
  } | null {
    if (!CSharpHelperMethods.isClassNode(node)) {
      return null;
    }

    let implementsDispose = false;
    let hasFinalizer = false;
    let disposePattern: 'standard' | 'virtual' | 'sealed' | 'none' = 'none';
    const resourceFields: string[] = [];

    // 检查是否实现IDisposable
    const baseList = node.childForFieldName('base_list');
    if (baseList?.text.includes('IDisposable')) {
      implementsDispose = true;
    }

    // 查找Dispose方法和终结器
    for (const child of node.children) {
      if (child.type === 'method_declaration') {
        const nameNode = child.childForFieldName('name');
        if (nameNode?.text === 'Dispose') {
          disposePattern = this.determineDisposePattern(child);
        }
      } else if (child.type === 'destructor_declaration') {
        hasFinalizer = true;
      } else if (child.type === 'field_declaration') {
        // 查找可能需要释放的资源字段
        const typeNode = child.childForFieldName('type');
        if (typeNode?.text && this.isDisposableType(typeNode.text)) {
          const variableNode = child.childForFieldName('declarator');
          if (variableNode?.text) {
            resourceFields.push(variableNode.text);
          }
        }
      }
    }

    return {
      implementsDispose,
      hasFinalizer,
      disposePattern,
      resourceFields
    };
  }

  /**
   * 确定Dispose模式
   */
  private determineDisposePattern(disposeMethod: Parser.SyntaxNode): 'standard' | 'virtual' | 'sealed' | 'none' {
    const modifiers = disposeMethod.childForFieldName('modifiers');
    if (!modifiers) {
      return 'standard';
    }

    const text = modifiers.text;
    if (text.includes('sealed')) {
      return 'sealed';
    } else if (text.includes('virtual')) {
      return 'virtual';
    }
    
    return 'standard';
  }

  /**
   * 判断是否为可释放类型
   */
  private isDisposableType(typeName: string): boolean {
    const disposableTypes = [
      'Stream', 'FileStream', 'MemoryStream', 'NetworkStream',
      'SqlConnection', 'NpgsqlConnection', 'MongoClient',
      'HttpClient', 'WebResponse', 'Socket',
      'Mutex', 'Semaphore', 'EventWaitHandle',
      'Bitmap', 'Graphics', 'Font', 'Brush',
      'IDisposable', 'IAsyncDisposable'
    ];

    return disposableTypes.some(disposableType => 
      typeName.includes(disposableType) || typeName.endsWith(disposableType)
    );
  }
}