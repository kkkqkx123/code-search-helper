import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { CppHelperMethods } from './CppHelperMethods';
import Parser from 'tree-sitter';

/**
 * C++ 继承关系提取器
 * 从 CRelationshipExtractor/InheritanceExtractor.ts 迁移
 */
export class InheritanceRelationshipExtractor {
  /**
   * 提取继承关系元数据
   */
  extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    // 从CRelationshipExtractor/InheritanceExtractor.ts迁移
    // C++中的继承关系处理
    if (astNode.type === 'base_class_clause') {
      const childClass = astNode.parent;
      const parentClass = astNode.children.find(child =>
        child.type === 'type_identifier' || child.type === 'template_type'
      );

      if (childClass && parentClass) {
        const childName = CppHelperMethods.extractNameFromNode(childClass);
        const parentName = parentClass.text;

        return {
          type: 'inheritance',
          fromNodeId: NodeIdGenerator.forAstNode(childClass),
          toNodeId: NodeIdGenerator.forAstNode(parentClass),
          inheritanceType: 'extends',
          location: {
            filePath: symbolTable?.filePath || 'current_file.cpp',
            lineNumber: astNode.startPosition.row + 1,
          }
        };
      }
    }

    // 处理结构体嵌入（C风格的继承模拟）
    if (astNode.type === 'field_declaration') {
      const structType = astNode.childForFieldName('type');
      if (structType && (structType.type === 'type_identifier' || structType.type === 'struct_specifier')) {
        const parentStruct = astNode.parent;
        if (parentStruct && parentStruct.type === 'struct_specifier') {
          const parentName = CppHelperMethods.extractNameFromNode(parentStruct);
          const childName = structType.text;

          return {
            type: 'inheritance',
            fromNodeId: NodeIdGenerator.forAstNode(parentStruct),
            toNodeId: NodeIdGenerator.forAstNode(structType),
            inheritanceType: 'embedded_struct',
            location: {
              filePath: symbolTable?.filePath || 'current_file.cpp',
              lineNumber: astNode.startPosition.row + 1,
            }
          };
        }
      }
    }

    return null;
  }
}