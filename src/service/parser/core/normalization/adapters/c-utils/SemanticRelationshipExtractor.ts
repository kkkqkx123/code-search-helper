import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { CHelperMethods } from '.';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';

/**
 * C语言语义关系提取器
 * 用于提取指针关系、函数指针、设计模式、内存管理等高级语义关系
 */
export class SemanticRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取语义关系元数据
   */
  extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    if (!astNode) {
      return null;
    }

    const semanticType = this.determineSemanticType(astNode);
    const semanticInfo = this.extractSemanticInfo(astNode, semanticType);

    return {
      type: 'semantic',
      fromNodeId: NodeIdGenerator.forAstNode(astNode),
      toNodeId: semanticInfo.targetNodeId || 'unknown',
      semanticType,
      semanticInfo,
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
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => this.isSemanticNode(node),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractSemanticMetadata(result, astNode, symbolTable)
    );
  }

  /**
   * 确定语义类型
   */
  private determineSemanticType(astNode: Parser.SyntaxNode): string {
    if (astNode.type === 'field_declaration') {
      const typeNode = astNode.childForFieldName('type');
      const declaratorNode = astNode.childForFieldName('declarator');
      
      if (declaratorNode && declaratorNode.type === 'pointer_declarator') {
        if (typeNode && typeNode.type === 'struct_specifier') {
          return 'pointer_struct';
        } else if (typeNode && typeNode.type === 'primitive_type') {
          return 'pointer_primitive';
        }
      }
    } else if (astNode.type === 'type_definition') {
      const declaratorNode = astNode.childForFieldName('declarator');
      if (declaratorNode && declaratorNode.type === 'function_declarator') {
        return 'function_pointer_type';
      }
    } else if (astNode.type === 'call_expression') {
      const functionName = CHelperMethods.extractCalleeName(astNode);
      if (functionName) {
        const memoryPatterns = ['malloc', 'calloc', 'realloc', 'free'];
        if (memoryPatterns.some(pattern => functionName.includes(pattern))) {
          return 'memory_management';
        }
      }
    } else if (astNode.type === 'return_statement') {
      const valueNode = astNode.childForFieldName('value');
      if (valueNode && this.isErrorCode(valueNode.text)) {
        return 'error_return';
      }
    } else if (astNode.type === 'if_statement') {
      const conditionNode = astNode.childForFieldName('condition');
      if (conditionNode && this.isErrorChecking(conditionNode)) {
        return 'error_checking';
      }
    } else if (astNode.type === 'function_definition') {
      return this.analyzeFunctionPattern(astNode);
    } else if (astNode.type === 'declaration') {
      return this.analyzeDeclarationPattern(astNode);
    }

    return 'unknown';
  }

  /**
   * 提取语义信息
   */
  private extractSemanticInfo(astNode: Parser.SyntaxNode, semanticType: string): any {
    const semanticInfo: any = {
      targetNodeId: 'unknown',
      details: {}
    };

    switch (semanticType) {
      case 'pointer_struct':
      case 'pointer_primitive':
        this.extractPointerInfo(astNode, semanticInfo);
        break;
      case 'function_pointer_type':
        this.extractFunctionPointerInfo(astNode, semanticInfo);
        break;
      case 'memory_management':
        this.extractMemoryManagementInfo(astNode, semanticInfo);
        break;
      case 'error_return':
      case 'error_checking':
        this.extractErrorHandlingInfo(astNode, semanticInfo);
        break;
      case 'design_pattern':
        this.extractDesignPatternInfo(astNode, semanticInfo);
        break;
      case 'resource_initialization':
      case 'cleanup_pattern':
        this.extractResourcePatternInfo(astNode, semanticInfo);
        break;
      case 'callback_pattern':
        this.extractCallbackInfo(astNode, semanticInfo);
        break;
    }

    return semanticInfo;
  }

  /**
   * 提取指针信息
   */
  private extractPointerInfo(astNode: Parser.SyntaxNode, semanticInfo: any): void {
    const typeNode = astNode.childForFieldName('type');
    const declaratorNode = astNode.childForFieldName('declarator');
    
    if (typeNode) {
      semanticInfo.details.pointedType = typeNode.text;
      semanticInfo.details.pointedNodeType = typeNode.type;
      semanticInfo.targetNodeId = NodeIdGenerator.forAstNode(typeNode);
    }
    
    if (declaratorNode) {
      const fieldIdentifier = declaratorNode.childForFieldName('declarator');
      if (fieldIdentifier) {
        semanticInfo.details.pointerField = fieldIdentifier.text;
        semanticInfo.targetNodeId = NodeIdGenerator.forAstNode(fieldIdentifier);
      }
    }
  }

  /**
   * 提取函数指针信息
   */
  private extractFunctionPointerInfo(astNode: Parser.SyntaxNode, semanticInfo: any): void {
    const declaratorNode = astNode.childForFieldName('declarator');
    if (declaratorNode) {
      const parenthesizedDeclarator = declaratorNode.childForFieldName('declarator');
      if (parenthesizedDeclarator) {
        const pointerDeclarator = parenthesizedDeclarator.childForFieldName('declarator');
        if (pointerDeclarator) {
          const typeIdentifier = pointerDeclarator.childForFieldName('declarator');
          if (typeIdentifier) {
            semanticInfo.details.functionPointerType = typeIdentifier.text;
            semanticInfo.targetNodeId = NodeIdGenerator.forAstNode(typeIdentifier);
          }
        }
      }
    }
  }

  /**
   * 提取内存管理信息
   */
  private extractMemoryManagementInfo(astNode: Parser.SyntaxNode, semanticInfo: any): void {
    const functionNode = astNode.childForFieldName('function');
    const argumentsNode = astNode.childForFieldName('arguments');
    
    if (functionNode) {
      semanticInfo.details.memoryFunction = functionNode.text;
    }
    
    if (argumentsNode) {
      const args = [];
      for (let i = 0; i < argumentsNode.childCount; i++) {
        const arg = argumentsNode.childForFieldName(i.toString());
        if (arg) {
          args.push({
            index: i,
            value: arg.text,
            type: arg.type
          });
        }
      }
      semanticInfo.details.arguments = args;
    }
  }

  /**
   * 提取错误处理信息
   */
  private extractErrorHandlingInfo(astNode: Parser.SyntaxNode, semanticInfo: any): void {
    if (astNode.type === 'return_statement') {
      const valueNode = astNode.childForFieldName('value');
      if (valueNode) {
        semanticInfo.details.errorCode = valueNode.text;
        semanticInfo.targetNodeId = NodeIdGenerator.forAstNode(valueNode);
      }
    } else if (astNode.type === 'if_statement') {
      const conditionNode = astNode.childForFieldName('condition');
      if (conditionNode) {
        semanticInfo.details.errorCondition = conditionNode.text;
        semanticInfo.targetNodeId = NodeIdGenerator.forAstNode(conditionNode);
        
        const consequenceNode = astNode.childForFieldName('consequence');
        if (consequenceNode) {
          semanticInfo.details.errorHandlingBlock = consequenceNode.text;
        }
      }
    }
  }

  /**
   * 提取设计模式信息
   */
  private extractDesignPatternInfo(astNode: Parser.SyntaxNode, semanticInfo: any): void {
    const declaratorNode = astNode.childForFieldName('declarator');
    if (declaratorNode) {
      const className = this.extractNameFromNode(declaratorNode);
      if (className) {
        semanticInfo.details.patternClass = className;
        semanticInfo.details.patternType = this.identifyDesignPattern(className);
      }
    }
    
    const bodyNode = astNode.childForFieldName('body');
    if (bodyNode) {
      const fields = [];
      const methods = [];
      
      for (const child of bodyNode.children) {
        if (child.type === 'field_declaration') {
          const fieldDeclarator = child.childForFieldName('declarator');
          if (fieldDeclarator) {
            fields.push(this.extractNameFromNode(fieldDeclarator));
          }
        } else if (child.type === 'function_definition') {
          const functionDeclarator = child.childForFieldName('declarator');
          if (functionDeclarator) {
            methods.push(this.extractNameFromNode(functionDeclarator));
          }
        }
      }
      
      semanticInfo.details.fields = fields;
      semanticInfo.details.methods = methods;
    }
  }

  /**
   * 提取资源模式信息
   */
  private extractResourcePatternInfo(astNode: Parser.SyntaxNode, semanticInfo: any): void {
    const declaratorNode = astNode.childForFieldName('declarator');
    if (declaratorNode) {
      semanticInfo.details.functionName = this.extractNameFromNode(declaratorNode);
    }
    
    const parametersNode = astNode.childForFieldName('parameters');
    if (parametersNode) {
      const parameters = [];
      for (const child of parametersNode.children) {
        if (child.type === 'parameter_declaration') {
          const paramType = child.childForFieldName('type');
          const paramDeclarator = child.childForFieldName('declarator');
          parameters.push({
            type: paramType?.text || 'unknown',
            name: this.extractNameFromNode(paramDeclarator) || 'unknown'
          });
        }
      }
      semanticInfo.details.parameters = parameters;
    }
    
    const bodyNode = astNode.childForFieldName('body');
    if (bodyNode) {
      semanticInfo.details.hasBody = true;
    }
  }

  /**
   * 提取回调信息
   */
  private extractCallbackInfo(astNode: Parser.SyntaxNode, semanticInfo: any): void {
    if (astNode.type === 'declaration') {
      const typeNode = astNode.childForFieldName('type');
      const declaratorNode = astNode.childForFieldName('declarator');
      
      if (typeNode) {
        semanticInfo.details.callbackType = typeNode.text;
      }
      
      if (declaratorNode) {
        const initNode = declaratorNode.childForFieldName('value');
        if (initNode) {
          semanticInfo.details.callbackFunction = initNode.text;
          semanticInfo.targetNodeId = NodeIdGenerator.forAstNode(initNode);
        }
        semanticInfo.details.callbackVariable = this.extractNameFromNode(declaratorNode);
      }
    } else if (astNode.type === 'type_definition') {
      this.extractFunctionPointerInfo(astNode, semanticInfo);
    }
  }

  /**
   * 分析函数模式
   */
  private analyzeFunctionPattern(astNode: Parser.SyntaxNode): string {
    const declaratorNode = astNode.childForFieldName('declarator');
    if (declaratorNode) {
      const functionName = this.extractNameFromNode(declaratorNode);
      if (functionName) {
        if (functionName.includes('init') || functionName.includes('create')) {
          return 'resource_initialization';
        } else if (functionName.includes('cleanup') || functionName.includes('destroy')) {
          return 'cleanup_pattern';
        }
      }
    }
    
    return 'unknown';
  }

  /**
   * 分析声明模式
   */
  private analyzeDeclarationPattern(astNode: Parser.SyntaxNode): string {
    const declaratorNode = astNode.childForFieldName('declarator');
    if (declaratorNode) {
      const initNode = declaratorNode.childForFieldName('value');
      if (initNode) {
        if (initNode.type === 'identifier') {
          return 'callback_assignment';
        }
      }
    }
    
    return 'unknown';
  }

  /**
   * 识别设计模式
   */
  private identifyDesignPattern(className: string): string {
    const patterns = ['Observer', 'Subject', 'Strategy', 'Factory', 'Singleton'];
    
    for (const pattern of patterns) {
      if (className.includes(pattern)) {
        return pattern;
      }
    }
    
    return 'unknown';
  }

  /**
   * 检查是否为错误代码
   */
  private isErrorCode(text: string): boolean {
    const errorPatterns = ['ERROR', 'FAIL', 'INVALID', 'NULL'];
    return errorPatterns.some(pattern => text.includes(pattern));
  }

  /**
   * 检查是否为错误检查
   */
  private isErrorChecking(conditionNode: Parser.SyntaxNode): boolean {
    if (conditionNode.type === 'binary_expression') {
      const leftNode = conditionNode.childForFieldName('left');
      const rightNode = conditionNode.childForFieldName('right');
      
      if (leftNode && rightNode) {
        return this.isErrorCode(leftNode.text) || this.isErrorCode(rightNode.text);
      }
    }
    
    return false;
  }

  /**
   * 判断是否为语义相关节点
   */
  private isSemanticNode(astNode: Parser.SyntaxNode): boolean {
    const semanticNodeTypes = [
      'field_declaration',
      'type_definition',
      'call_expression',
      'return_statement',
      'if_statement',
      'function_definition',
      'declaration'
    ];

    if (!semanticNodeTypes.includes(astNode.type)) {
      return false;
    }

    // 进一步检查具体的语义特征
    if (astNode.type === 'field_declaration') {
      const declaratorNode = astNode.childForFieldName('declarator');
      return declaratorNode && declaratorNode.type === 'pointer_declarator';
    } else if (astNode.type === 'type_definition') {
      const declaratorNode = astNode.childForFieldName('declarator');
      return declaratorNode && declaratorNode.type === 'function_declarator';
    } else if (astNode.type === 'call_expression') {
      const functionNode = astNode.childForFieldName('function');
      if (functionNode) {
        const functionName = functionNode.text;
        const semanticPatterns = ['malloc', 'calloc', 'realloc', 'free'];
        return semanticPatterns.some(pattern => functionName.includes(pattern));
      }
    } else if (astNode.type === 'return_statement') {
      const valueNode = astNode.childForFieldName('value');
      return valueNode && this.isErrorCode(valueNode.text);
    } else if (astNode.type === 'if_statement') {
      const conditionNode = astNode.childForFieldName('condition');
      return conditionNode && this.isErrorChecking(conditionNode);
    }

    return true; // 对于函数定义和声明，默认认为是语义相关的
  }

  /**
   * 提取指针关系元数据
   */
  extractPointerMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    if (!astNode || astNode.type !== 'field_declaration') {
      return null;
    }

    const pointerInfo = this.extractPointerInfo(astNode, { details: {}, targetNodeId: 'unknown' });
    
    return {
      type: 'pointer',
      fromNodeId: NodeIdGenerator.forAstNode(astNode),
      toNodeId: pointerInfo.targetNodeId || 'unknown',
      pointerType: pointerInfo.details.pointedNodeType === 'struct_specifier' ? 'struct' : 'primitive',
      pointedType: pointerInfo.details.pointedType || 'unknown',
      pointerField: pointerInfo.details.pointerField || 'unknown',
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取指针关系
   */
  extractPointerRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => node.type === 'field_declaration',
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractPointerMetadata(result, astNode, symbolTable)
    );
  }
}