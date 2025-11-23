import { CppHelperMethods } from './CppHelperMethods';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';
import Parser from 'tree-sitter';

/**
 * C++依赖关系提取器
 * 处理头文件包含、using声明、模板依赖、命名空间等依赖关系
 */
export class CppDependencyRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取依赖关系元数据
   */
  extractDependencyMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    const dependencyType = this.determineDependencyType(astNode);
    const target = CppHelperMethods.extractDependencyTarget(astNode);

    if (!dependencyType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractDependencyNodes(astNode, dependencyType);
    const additionalInfo = this.extractAdditionalInfo(astNode, dependencyType);

    return {
      type: 'dependency',
      fromNodeId,
      toNodeId,
      dependencyType,
      target,
      ...additionalInfo,
      location: CppHelperMethods.createLocationInfo(astNode, symbolTable?.filePath)
    };
  }

  /**
   * 提取依赖关系数组
   */
  extractDependencyRelationships(result: any): Array<any> {
    return this.extractRelationships(
      result,
      (node: Parser.SyntaxNode) => CppHelperMethods.isDependencyNode(node),
      (result: any, astNode: Parser.SyntaxNode, symbolTable: any) =>
        this.extractDependencyMetadata(result, astNode, symbolTable)
    );
  }

  /**
   * 确定依赖类型
   */
  private determineDependencyType(astNode: Parser.SyntaxNode): string {
    const nodeType = astNode.type;

    // C++特有的依赖类型
    if (nodeType === 'preproc_include') {
      return 'include';
    } else if (nodeType === 'using_declaration') {
      return 'using_declaration';
    } else if (nodeType === 'using_directive') {
      return 'using_directive';
    } else if (nodeType === 'template_type' || nodeType === 'template_function') {
      return 'template';
    } else if (nodeType === 'namespace_definition') {
      return 'namespace';
    } else if (nodeType === 'friend_declaration') {
      return 'friend';
    } else if (nodeType === 'base_class_clause') {
      return 'inheritance';
    } else if (nodeType === 'type_parameter_constraints_clause') {
      return 'generic_constraint';
    } else if (nodeType === 'attribute_list') {
      return 'assembly_reference';
    }

    // 通用依赖类型
    if (nodeType === 'declaration') {
      return 'type_reference';
    } else if (nodeType === 'call_expression') {
      return 'function_call';
    } else if (nodeType === 'field_expression' || nodeType === 'member_access_expression') {
      return 'member_access';
    } else if (nodeType === 'assignment_expression') {
      return 'assignment';
    } else if (nodeType === 'delegate_declaration') {
      return 'delegate';
    } else if (nodeType === 'lambda_expression') {
      return 'lambda';
    }

    return 'unknown';
  }

  /**
   * 提取依赖关系的节点
   */
  private extractDependencyNodes(astNode: Parser.SyntaxNode, dependencyType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = CppHelperMethods.generateNodeId(astNode);
    let toNodeId = 'unknown';
    const target = CppHelperMethods.extractDependencyTarget(astNode);

    if (target) {
      const symbolType = this.getSymbolTypeForDependency(dependencyType);
      toNodeId = CppHelperMethods.generateNodeId(astNode, symbolType);
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 根据依赖类型获取符号类型
   */
  private getSymbolTypeForDependency(dependencyType: string): string {
    switch (dependencyType) {
      case 'include':
        return 'header';
      case 'using_declaration':
      case 'using_directive':
        return 'namespace';
      case 'template':
        return 'template';
      case 'inheritance':
        return 'class';
      case 'function_call':
        return 'function';
      case 'type_reference':
        return 'type';
      default:
        return 'symbol';
    }
  }

  /**
   * 提取附加信息
   */
  private extractAdditionalInfo(astNode: Parser.SyntaxNode, dependencyType: string): any {
    const additionalInfo: any = {};

    switch (dependencyType) {
      case 'include':
        additionalInfo.includeType = this.extractIncludeType(astNode);
        break;

      case 'template':
        additionalInfo.templateArguments = this.extractTemplateArguments(astNode);
        break;

      case 'inheritance':
        additionalInfo.inheritanceType = this.extractInheritanceType(astNode);
        break;

      case 'function_call':
        additionalInfo.arguments = this.extractCallArguments(astNode);
        break;

      case 'generic_constraint':
        additionalInfo.constraints = this.extractGenericConstraints(astNode);
        break;
    }

    return additionalInfo;
  }

  /**
   * 提取包含类型
   */
  private extractIncludeType(astNode: Parser.SyntaxNode): string {
    for (const child of astNode.children) {
      if (child.type === 'string_literal') {
        return 'user';
      } else if (child.type === 'system_lib_string') {
        return 'system';
      }
    }
    return 'unknown';
  }

  /**
   * 提取模板参数
   */
  private extractTemplateArguments(astNode: Parser.SyntaxNode): string[] {
    const templateArgs: string[] = [];
    const argsNode = astNode.childForFieldName('arguments');
    if (argsNode) {
      for (const child of argsNode.children) {
        if (child.text) {
          templateArgs.push(child.text);
        }
      }
    }
    return templateArgs;
  }

  /**
   * 提取继承类型
   */
  private extractInheritanceType(astNode: Parser.SyntaxNode): string {
    // 检查是否有virtual继承
    for (const child of astNode.children) {
      if (child.type === 'virtual_specifier') {
        return 'virtual';
      }
    }
    return 'normal';
  }

  /**
   * 提取调用参数
   */
  private extractCallArguments(astNode: Parser.SyntaxNode): string[] {
    const callArgs: string[] = [];
    const argsNode = astNode.childForFieldName('arguments');
    if (argsNode) {
      for (const child of argsNode.children) {
        if (child.text && child.type !== ',' && child.type !== '(' && child.type !== ')') {
          callArgs.push(child.text);
        }
      }
    }
    return callArgs;
  }

  /**
   * 提取泛型约束
   */
  private extractGenericConstraints(astNode: Parser.SyntaxNode): string[] {
    const constraints: string[] = [];
    for (const child of astNode.children) {
      if (child.type === 'type_parameter_constraint') {
        constraints.push(child.text);
      }
    }
    return constraints;
  }
}