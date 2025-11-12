import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C++ 生命周期关系提取器
 * 从 CRelationshipExtractor/LifecycleExtractor.ts 迁移
 */
export class LifecycleRelationshipExtractor {
  /**
   * 提取生命周期关系元数据
   */
  extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    // 从CRelationshipExtractor/LifecycleExtractor.ts迁移
    const text = astNode.text || '';
    let lifecycleType = 'unknown';
    let lifecyclePhase = 'unknown';

    // 检测内存分配
    if (text.includes('new ') || text.includes('malloc') || text.includes('calloc')) {
      lifecycleType = 'instantiates';
      lifecyclePhase = 'creation';
    }
    // 检测内存释放
    else if (text.includes('delete ') || text.includes('free')) {
      lifecycleType = 'destroys';
      lifecyclePhase = 'teardown';
    }
    // 检测智能指针创建
    else if (text.includes('make_unique') || text.includes('make_shared')) {
      lifecycleType = 'instantiates';
      lifecyclePhase = 'creation';
    }
    // 检测文件操作
    else if (text.includes('fopen') || text.includes('open') || text.includes('std::ifstream') ||
      text.includes('std::ofstream') || text.includes('std::fstream')) {
      lifecycleType = 'manages';
      lifecyclePhase = 'setup';
    }
    // 检测文件关闭
    else if (text.includes('fclose') || text.includes('close')) {
      lifecycleType = 'destroys';
      lifecyclePhase = 'teardown';
    }
    // 检测构造函数调用
    else if (astNode.type === 'call_expression' &&
      astNode.parent?.type === 'new_expression') {
      lifecycleType = 'instantiates';
      lifecyclePhase = 'creation';
    }
    // 检测析构函数调用
    else if (text.includes('::~') || (astNode.type === 'call_expression' &&
      text.includes('delete'))) {
      lifecycleType = 'destroys';
      lifecyclePhase = 'teardown';
    }

    return {
      type: 'lifecycle',
      fromNodeId: NodeIdGenerator.forAstNode(astNode),
      toNodeId: 'unknown', // 需要更复杂的分析来确定目标
      lifecycleType,
      lifecyclePhase,
      location: {
        filePath: symbolTable?.filePath || 'current_file.cpp',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  /**
   * 提取生命周期关系
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

    // 构造函数关系
    if (mainNode.type === 'function_definition' &&
      (mainNode.text?.includes('constructor') || mainNode.text?.includes('ctor'))) {
      relationships.push({
        source: 'constructor',
        target: 'object_instance',
        type: 'initializes'
      });
    }

    // 析构函数关系
    if (mainNode.type === 'function_definition' &&
      (mainNode.text?.includes('destructor') || mainNode.text?.includes('dtor'))) {
      relationships.push({
        source: 'destructor',
        target: 'object_instance',
        type: 'destroys'
      });
    }

    // 智能指针管理关系
    const text = mainNode.text || '';
    if (text.includes('unique_ptr') || text.includes('shared_ptr')) {
      relationships.push({
        source: 'smart_pointer',
        target: 'managed_object',
        type: 'manages'
      });
    }

    return relationships;
  }
}