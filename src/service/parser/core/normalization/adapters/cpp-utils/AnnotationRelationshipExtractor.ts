import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C++注解关系提取器
 * 处理C++属性说明符、现代特性注解和类型注解
 */
export class CppAnnotationRelationshipExtractor {
  /**
   * 提取注解关系元数据
   */
  extractAnnotationMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const annotationType = this.determineAnnotationType(astNode);

    if (!annotationType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractAnnotationNodes(astNode, annotationType);
    const annotationName = this.extractAnnotationName(astNode);
    const parameters = this.extractAnnotationParameters(astNode);

    return {
      type: 'annotation',
      fromNodeId,
      toNodeId,
      annotationType,
      annotationName,
      parameters,
      location: {
        filePath: symbolTable?.filePath || 'current_file.cpp',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取注解关系数组
   */
  extractAnnotationRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为注解相关的节点类型
    if (!this.isAnnotationNode(astNode)) {
      return relationships;
    }

    const annotationMetadata = this.extractAnnotationMetadata(result, astNode, null);
    if (annotationMetadata) {
      relationships.push(annotationMetadata);
    }

    return relationships;
  }

  /**
   * 确定注解类型
   */
  private determineAnnotationType(astNode: Parser.SyntaxNode): 'attribute' | 'type_annotation' | 'modern_feature' | 'alignas' | null {
    const nodeType = astNode.type;

    if (nodeType === 'attribute_declaration' || nodeType === 'attribute_specifier') {
      return 'attribute';
    } else if (nodeType === 'type_definition' || nodeType === 'type_alias_declaration') {
      return 'type_annotation';
    } else if (nodeType === 'alignas_specifier') {
      return 'alignas';
    } else if (nodeType === 'requires_clause' || nodeType === 'concept_definition') {
      return 'modern_feature';
    }

    return null;
  }

  /**
   * 提取注解关系的节点
   */
  private extractAnnotationNodes(astNode: Parser.SyntaxNode, annotationType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    if (annotationType === 'attribute') {
      const attributeName = this.extractAnnotationName(astNode);
      if (attributeName) {
        toNodeId = this.generateNodeId(attributeName, 'attribute', 'current_file.cpp');
      }
    } else if (annotationType === 'type_annotation') {
      const typeName = this.extractTypeName(astNode);
      if (typeName) {
        toNodeId = this.generateNodeId(typeName, 'type', 'current_file.cpp');
      }
    } else if (annotationType === 'alignas') {
      const alignmentValue = this.extractAlignmentValue(astNode);
      if (alignmentValue) {
        toNodeId = this.generateNodeId(alignmentValue, 'alignas', 'current_file.cpp');
      }
    } else if (annotationType === 'modern_feature') {
      const featureName = this.extractFeatureName(astNode);
      if (featureName) {
        toNodeId = this.generateNodeId(featureName, 'modern_feature', 'current_file.cpp');
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取注解名称
   */
  private extractAnnotationName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.children && astNode.children.length > 0) {
      for (const child of astNode.children) {
        if (child.type === 'identifier') {
          return child.text || null;
        }
      }
    }
    return null;
  }

  /**
   * 提取类型名称
   */
  private extractTypeName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.children && astNode.children.length > 0) {
      for (const child of astNode.children) {
        if (child.type === 'type_identifier' || child.type === 'identifier') {
          return child.text || null;
        }
      }
    }
    return null;
  }

  /**
   * 提取对齐值
   */
  private extractAlignmentValue(astNode: Parser.SyntaxNode): string | null {
    // 对于alignas，提取对齐值
    for (const child of astNode.children) {
      if (child.type === 'number_literal' || child.type === 'type_identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  /**
   * 提取特性名称
   */
  private extractFeatureName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'concept_definition') {
      // 对于概念定义，提取概念名称
      for (const child of astNode.children) {
        if (child.type === 'identifier') {
          return child.text || null;
        }
      }
    } else if (astNode.type === 'requires_clause') {
      // 对于requires子句，返回requires
      return 'requires';
    }
    return null;
  }

  /**
   * 提取注解参数
   */
  private extractAnnotationParameters(astNode: Parser.SyntaxNode): Record<string, any> {
    const parameters: Record<string, any> = {};

    for (const child of astNode.children) {
      if (child.type === 'argument_list') {
        // 处理属性参数
        const args = this.extractCallArguments(child);
        parameters.args = args;
        break;
      } else if (child.type === 'template_argument_list') {
        // 处理模板参数
        const templateArgs = this.extractTemplateArguments(child);
        parameters.templateArgs = templateArgs;
        break;
      }
    }

    return parameters;
  }

  /**
   * 提取调用参数
   */
  private extractCallArguments(argList: Parser.SyntaxNode): any[] {
    const args: any[] = [];

    for (const child of argList.children) {
      if (child.type !== 'comment') { // 排除注释
        args.push({
          type: child.type,
          text: child.text
        });
      }
    }

    return args;
  }

  /**
   * 提取模板参数
   */
  private extractTemplateArguments(templateArgList: Parser.SyntaxNode): any[] {
    const args: any[] = [];

    for (const child of templateArgList.children) {
      if (child.type !== 'comment' && child.type !== ',' && child.type !== '<' && child.type !== '>') {
        args.push({
          type: child.type,
          text: child.text
        });
      }
    }

    return args;
  }

  /**
   * 判断是否为注解关系节点
   */
  private isAnnotationNode(astNode: Parser.SyntaxNode): boolean {
    const annotationNodeTypes = [
      'attribute_declaration',
      'attribute_specifier',
      'type_definition',
      'type_alias_declaration',
      'alignas_specifier',
      'requires_clause',
      'concept_definition'
    ];

    return annotationNodeTypes.includes(astNode.type);
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }

  /**
   * 查找C++属性声明
   */
  findAttributeDeclarations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const attributes: Parser.SyntaxNode[] = [];
    
    this.traverseTree(ast, (node) => {
      if (node.type === 'attribute_declaration' || node.type === 'attribute_specifier') {
        attributes.push(node);
      }
    });
    
    return attributes;
  }

  /**
   * 查找对齐说明符
   */
  findAlignasSpecifiers(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const alignasSpecifiers: Parser.SyntaxNode[] = [];
    
    this.traverseTree(ast, (node) => {
      if (node.type === 'alignas_specifier') {
        alignasSpecifiers.push(node);
      }
    });
    
    return alignasSpecifiers;
  }

  /**
   * 查找现代特性注解
   */
  findModernFeatureAnnotations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const modernFeatures: Parser.SyntaxNode[] = [];
    
    this.traverseTree(ast, (node) => {
      if (node.type === 'requires_clause' || node.type === 'concept_definition') {
        modernFeatures.push(node);
      }
    });
    
    return modernFeatures;
  }

  /**
   * 遍历AST树
   */
  private traverseTree(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void): void {
    callback(node);
    
    if (node.children) {
      for (const child of node.children) {
        this.traverseTree(child, callback);
      }
    }
  }

  /**
   * 分析注解关系
   */
  analyzeAnnotations(ast: Parser.SyntaxNode, filePath: string): Array<{
    sourceId: string;
    targetId: string;
    annotationType: string;
    annotationName: string;
    parameters: Record<string, any>;
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const annotations: Array<any> = [];

    // 查找所有属性声明
    const attributeDeclarations = this.findAttributeDeclarations(ast);
    for (const attrDecl of attributeDeclarations) {
      const annotationName = this.extractAnnotationName(attrDecl);
      const annotationType = this.determineAnnotationType(attrDecl);
      const parameters = this.extractAnnotationParameters(attrDecl);

      if (annotationName && annotationType) {
        annotations.push({
          sourceId: generateDeterministicNodeId(attrDecl),
          targetId: this.generateNodeId(annotationName, 'attribute', filePath),
          annotationType,
          annotationName,
          parameters,
          location: {
            filePath,
            lineNumber: attrDecl.startPosition.row + 1,
            columnNumber: attrDecl.startPosition.column + 1
          }
        });
      }
    }

    // 查找所有对齐说明符
    const alignasSpecifiers = this.findAlignasSpecifiers(ast);
    for (const alignas of alignasSpecifiers) {
      const alignmentValue = this.extractAlignmentValue(alignas);
      const annotationType = this.determineAnnotationType(alignas);

      if (alignmentValue && annotationType) {
        annotations.push({
          sourceId: generateDeterministicNodeId(alignas),
          targetId: this.generateNodeId(alignmentValue, 'alignas', filePath),
          annotationType,
          annotationName: 'alignas',
          parameters: { alignment: alignmentValue },
          location: {
            filePath,
            lineNumber: alignas.startPosition.row + 1,
            columnNumber: alignas.startPosition.column + 1
          }
        });
      }
    }

    // 查找所有现代特性注解
    const modernFeatures = this.findModernFeatureAnnotations(ast);
    for (const modernFeature of modernFeatures) {
      const featureName = this.extractFeatureName(modernFeature);
      const annotationType = this.determineAnnotationType(modernFeature);
      const parameters = this.extractAnnotationParameters(modernFeature);

      if (featureName && annotationType) {
        annotations.push({
          sourceId: generateDeterministicNodeId(modernFeature),
          targetId: this.generateNodeId(featureName, 'modern_feature', filePath),
          annotationType,
          annotationName: featureName,
          parameters,
          location: {
            filePath,
            lineNumber: modernFeature.startPosition.row + 1,
            columnNumber: modernFeature.startPosition.column + 1
          }
        });
      }
    }

    return annotations;
  }
}