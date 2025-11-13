import { TopLevelStructure, NestedStructure, InternalStructure } from '../types/ContentTypes';
import Parser from 'tree-sitter';

/**
 * AST结构提取器
 * 负责基于已解析的AST提取代码结构
 * 注意：此类不执行AST解析，只处理已解析的AST节点
 * 
 * @deprecated 此类已迁移到 src\service\parser\core\normalization\ASTStructureExtractor
 * 请使用新的 ASTStructureExtractor 类，它基于 normalization 系统提供更好的性能和功能
 * 迁移指南：请参考 docs\parser\core\ast-structure-extractor-migration-guide.md
 */
export class ASTStructureExtractor {
  
  /**
   * 基于AST提取顶级结构
   * @param content 源代码内容
   * @param language 编程语言
   * @param ast 已解析的AST根节点
   * @returns 顶级结构数组
   */
  static extractTopLevelStructuresFromAST(
    content: string, 
    language: string, 
    ast: Parser.SyntaxNode
  ): TopLevelStructure[] {
    const structures: TopLevelStructure[] = [];
    
    if (!ast) {
      console.warn(`No AST provided for ${language}`);
      return [];
    }

    try {
      const lines = content.split('\n');

      // 根据语言类型提取不同的顶级结构
      switch (language) {
        case 'javascript':
        case 'typescript':
          structures.push(...this.extractJavaScriptTopLevel(ast, lines, language));
          break;
        case 'python':
          structures.push(...this.extractPythonTopLevel(ast, lines, language));
          break;
        case 'java':
          structures.push(...this.extractJavaTopLevel(ast, lines, language));
          break;
        case 'go':
          structures.push(...this.extractGoTopLevel(ast, lines, language));
          break;
        case 'rust':
          structures.push(...this.extractRustTopLevel(ast, lines, language));
          break;
        case 'cpp':
        case 'c':
          structures.push(...this.extractCTopLevel(ast, lines, language));
          break;
        case 'json':
          structures.push(...this.extractJSONTopLevel(ast, lines, language));
          break;
        case 'yaml':
          structures.push(...this.extractYAMLTopLevel(ast, lines, language));
          break;
        default:
          console.warn(`Unsupported language for AST analysis: ${language}`);
          // 使用通用提取方法
          structures.push(...this.extractGenericTopLevel(ast, lines, language));
      }
    } catch (error) {
      console.error(`Error extracting AST structures for ${language}:`, error);
    }

    return structures;
  }

  /**
   * 基于AST提取嵌套结构
   * @param content 源代码内容
   * @param parentNode 父节点
   * @param level 嵌套层级
   * @param ast 已解析的AST根节点
   * @returns 嵌套结构数组
   */
  static extractNestedStructuresFromAST(
    content: string,
    parentNode: Parser.SyntaxNode,
    level: number,
    ast: Parser.SyntaxNode
  ): NestedStructure[] {
    const structures: NestedStructure[] = [];
    
    if (!ast || !parentNode) {
      return [];
    }

    try {
      const lines = content.split('\n');
      
      // 遍历AST节点，提取嵌套结构
      this.extractNestedFromNode(parentNode, lines, structures, level);
    } catch (error) {
      console.error('Error extracting nested structures from AST:', error);
    }

    return structures;
  }

  /**
   * 基于AST提取内部结构
   * @param content 源代码内容
   * @param parentNode 父节点
   * @param ast 已解析的AST根节点
   * @returns 内部结构数组
   */
  static extractInternalStructuresFromAST(
    content: string,
    parentNode: Parser.SyntaxNode,
    ast: Parser.SyntaxNode
  ): InternalStructure[] {
    const structures: InternalStructure[] = [];
    
    if (!ast || !parentNode) {
      return [];
    }

    try {
      const lines = content.split('\n');
      
      // 提取变量声明
      this.extractVariablesFromNode(parentNode, lines, structures);
      
      // 提取控制流结构
      this.extractControlFlowFromNode(parentNode, lines, structures);
      
      // 提取其他重要内部结构
      this.extractOtherInternalStructures(parentNode, lines, structures);
    } catch (error) {
      console.error('Error extracting internal structures from AST:', error);
    }

    return structures;
  }

  /**
   * JavaScript/TypeScript顶级结构提取
   */
  private static extractJavaScriptTopLevel(
    rootNode: Parser.SyntaxNode, 
    lines: string[], 
    language: string
  ): TopLevelStructure[] {
    const structures: TopLevelStructure[] = [];

    // 提取函数声明
    const functionNodes = this.findNodesByType(rootNode, 'function_declaration');
    for (const node of functionNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'function', language));
    }

    // 提取类声明
    const classNodes = this.findNodesByType(rootNode, 'class_declaration');
    for (const node of classNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'class', language));
    }

    // 提取变量声明（const、let、var）
    const variableNodes = this.findNodesByType(rootNode, 'variable_declaration');
    for (const node of variableNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'variable', language));
    }

    // 提取导出声明
    const exportNodes = this.findNodesByType(rootNode, 'export_statement');
    for (const node of exportNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'export', language));
    }

    // 提取接口声明（TypeScript）
    const interfaceNodes = this.findNodesByType(rootNode, 'interface_declaration');
    for (const node of interfaceNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'interface', language));
    }

    return structures;
  }

  /**
   * Python顶级结构提取
   */
  private static extractPythonTopLevel(
    rootNode: Parser.SyntaxNode, 
    lines: string[], 
    language: string
  ): TopLevelStructure[] {
    const structures: TopLevelStructure[] = [];

    // 提取函数定义
    const functionNodes = this.findNodesByType(rootNode, 'function_definition');
    for (const node of functionNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'function', language));
    }

    // 提取类定义
    const classNodes = this.findNodesByType(rootNode, 'class_definition');
    for (const node of classNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'class', language));
    }

    // 提取导入语句
    const importNodes = this.findNodesByType(rootNode, 'import_statement');
    for (const node of importNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'import', language));
    }

    // 提取从导入语句
    const importFromNodes = this.findNodesByType(rootNode, 'import_from_statement');
    for (const node of importFromNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'import', language));
    }

    return structures;
  }

  /**
   * Java顶级结构提取
   */
  private static extractJavaTopLevel(
    rootNode: Parser.SyntaxNode, 
    lines: string[], 
    language: string
  ): TopLevelStructure[] {
    const structures: TopLevelStructure[] = [];

    // 提取类声明
    const classNodes = this.findNodesByType(rootNode, 'class_declaration');
    for (const node of classNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'class', language));
    }

    // 提取接口声明
    const interfaceNodes = this.findNodesByType(rootNode, 'interface_declaration');
    for (const node of interfaceNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'interface', language));
    }

    // 提取枚举声明
    const enumNodes = this.findNodesByType(rootNode, 'enum_declaration');
    for (const node of enumNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'enum', language));
    }

    // 提取方法声明
    const methodNodes = this.findNodesByType(rootNode, 'method_declaration');
    for (const node of methodNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'method', language));
    }

    return structures;
  }

  /**
   * Go顶级结构提取
   */
  private static extractGoTopLevel(
    rootNode: Parser.SyntaxNode, 
    lines: string[], 
    language: string
  ): TopLevelStructure[] {
    const structures: TopLevelStructure[] = [];

    // 提取函数声明
    const functionNodes = this.findNodesByType(rootNode, 'function_declaration');
    for (const node of functionNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'function', language));
    }

    // 提取类型声明
    const typeNodes = this.findNodesByType(rootNode, 'type_declaration');
    for (const node of typeNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'type', language));
    }

    // 提取结构体声明
    const structNodes = this.findNodesByType(rootNode, 'struct_type');
    for (const node of structNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'struct', language));
    }

    // 提取接口声明
    const interfaceNodes = this.findNodesByType(rootNode, 'interface_type');
    for (const node of interfaceNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'interface', language));
    }

    return structures;
  }

  /**
   * Rust顶级结构提取
   */
  private static extractRustTopLevel(
    rootNode: Parser.SyntaxNode, 
    lines: string[], 
    language: string
  ): TopLevelStructure[] {
    const structures: TopLevelStructure[] = [];

    // 提取函数声明
    const functionNodes = this.findNodesByType(rootNode, 'function_item');
    for (const node of functionNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'function', language));
    }

    // 提取结构体声明
    const structNodes = this.findNodesByType(rootNode, 'struct_item');
    for (const node of structNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'struct', language));
    }

    // 提取枚举声明
    const enumNodes = this.findNodesByType(rootNode, 'enum_item');
    for (const node of enumNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'enum', language));
    }

    // 提取trait声明
    const traitNodes = this.findNodesByType(rootNode, 'trait_item');
    for (const node of traitNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'trait', language));
    }

    // 提取impl块
    const implNodes = this.findNodesByType(rootNode, 'impl_item');
    for (const node of implNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'impl', language));
    }

    return structures;
  }

  /**
   * C/C++顶级结构提取
   */
  private static extractCTopLevel(
    rootNode: Parser.SyntaxNode, 
    lines: string[], 
    language: string
  ): TopLevelStructure[] {
    const structures: TopLevelStructure[] = [];

    // 提取函数定义
    const functionNodes = this.findNodesByType(rootNode, 'function_definition');
    for (const node of functionNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'function', language));
    }

    // 提取结构体声明
    const structNodes = this.findNodesByType(rootNode, 'struct_specifier');
    for (const node of structNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'struct', language));
    }

    // 提取类声明（C++）
    const classNodes = this.findNodesByType(rootNode, 'class_specifier');
    for (const node of classNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'class', language));
    }

    // 提取枚举声明
    const enumNodes = this.findNodesByType(rootNode, 'enum_specifier');
    for (const node of enumNodes) {
      structures.push(this.createTopLevelStructure(node, lines, 'enum', language));
    }

    return structures;
  }

  /**
   * JSON顶级结构提取
   */
  private static extractJSONTopLevel(
    rootNode: Parser.SyntaxNode, 
    lines: string[], 
    language: string
  ): TopLevelStructure[] {
    const structures: TopLevelStructure[] = [];

    // JSON文档本身就是一个顶级结构
    structures.push({
      type: 'document',
      name: 'root',
      content: lines.join('\n'),
      location: {
        startLine: 1,
        endLine: lines.length
      },
      node: rootNode,
      metadata: {
        language,
        confidence: 1.0
      }
    });

    // 如果是对象，提取顶级键
    if (rootNode.type === 'object') {
      for (let i = 0; i < rootNode.childCount; i++) {
        const child = rootNode.child(i);
        if (child && child.type === 'pair') {
          structures.push(this.createTopLevelStructure(child, lines, 'key_value', language));
        }
      }
    }

    return structures;
  }

  /**
   * YAML顶级结构提取
   */
  private static extractYAMLTopLevel(
    rootNode: Parser.SyntaxNode, 
    lines: string[], 
    language: string
  ): TopLevelStructure[] {
    const structures: TopLevelStructure[] = [];

    // YAML文档本身就是一个顶级结构
    structures.push({
      type: 'document',
      name: 'root',
      content: lines.join('\n'),
      location: {
        startLine: 1,
        endLine: lines.length
      },
      node: rootNode,
      metadata: {
        language,
        confidence: 1.0
      }
    });

    // 提取顶级块节点
    for (let i = 0; i < rootNode.childCount; i++) {
      const child = rootNode.child(i);
      if (child && (child.type === 'block_mapping_pair' || child.type === 'block_sequence_item')) {
        structures.push(this.createTopLevelStructure(child, lines, 'block', language));
      }
    }

    return structures;
  }

  /**
   * 通用顶级结构提取
   */
  private static extractGenericTopLevel(
    rootNode: Parser.SyntaxNode, 
    lines: string[], 
    language: string
  ): TopLevelStructure[] {
    const structures: TopLevelStructure[] = [];

    // 通用的顶级结构类型
    const topLevelTypes = [
      'function_declaration', 'function_definition', 'function_item',
      'class_declaration', 'class_definition', 'class_specifier',
      'interface_declaration', 'interface_type',
      'struct_specifier', 'struct_item', 'struct_type',
      'enum_declaration', 'enum_specifier', 'enum_item',
      'type_declaration', 'type_definition',
      'import_statement', 'import_from_statement',
      'export_statement'
    ];

    for (const type of topLevelTypes) {
      const nodes = this.findNodesByType(rootNode, type);
      for (const node of nodes) {
        const structureType = this.mapNodeTypeToStructureType(type);
        structures.push(this.createTopLevelStructure(node, lines, structureType, language));
      }
    }

    return structures;
  }

  /**
   * 从节点递归提取嵌套结构
   */
  private static extractNestedFromNode(
    node: Parser.SyntaxNode,
    lines: string[],
    structures: NestedStructure[],
    level: number
  ): void {
    if (!node || level > 10) return; // 防止过深递归

    // 根据节点类型提取嵌套结构
    const nodeType = node.type;
    
    // 函数/方法
    if (nodeType.includes('function') || nodeType.includes('method')) {
      structures.push(this.createNestedStructure(node, lines, 'method', level));
    }
    
    // 类/结构体
    if (nodeType.includes('class') || nodeType.includes('struct')) {
      structures.push(this.createNestedStructure(node, lines, 'nested_class', level));
    }
    
    // 控制流
    if (['if_statement', 'for_statement', 'while_statement', 'switch_statement'].includes(nodeType)) {
      structures.push(this.createNestedStructure(node, lines, 'control-flow', level));
    }
    
    // 递归处理子节点
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.extractNestedFromNode(child, lines, structures, level + 1);
      }
    }
  }

  /**
   * 从节点提取变量声明
   */
  private static extractVariablesFromNode(
    node: Parser.SyntaxNode,
    lines: string[],
    structures: InternalStructure[]
  ): void {
    if (!node) return;

    // 查找变量声明节点
    const variableTypes = [
      'variable_declaration',
      'variable_declarator',
      'assignment_expression',
      'let_declaration',
      'const_declaration'
    ];

    if (variableTypes.includes(node.type)) {
      structures.push(this.createInternalStructure(node, lines, 'variable', 'medium'));
    }

    // 递归处理子节点
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.extractVariablesFromNode(child, lines, structures);
      }
    }
  }

  /**
   * 从节点提取控制流结构
   */
  private static extractControlFlowFromNode(
    node: Parser.SyntaxNode,
    lines: string[],
    structures: InternalStructure[]
  ): void {
    if (!node) return;

    const controlFlowTypes = [
      'if_statement',
      'for_statement',
      'while_statement',
      'switch_statement',
      'case'
    ];

    if (controlFlowTypes.includes(node.type)) {
      structures.push(this.createInternalStructure(node, lines, node.type.replace('_statement', ''), 'high'));
    }

    // 递归处理子节点
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.extractControlFlowFromNode(child, lines, structures);
      }
    }
  }

  /**
   * 提取其他内部结构
   */
  private static extractOtherInternalStructures(
    node: Parser.SyntaxNode,
    lines: string[],
    structures: InternalStructure[]
  ): void {
    if (!node) return;

    // 提取返回语句
    if (node.type === 'return_statement') {
      structures.push(this.createInternalStructure(node, lines, 'return', 'high'));
    }

    // 提取表达式语句
    if (node.type === 'expression_statement') {
      structures.push(this.createInternalStructure(node, lines, 'expression', 'medium'));
    }

    // 递归处理子节点
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        this.extractOtherInternalStructures(child, lines, structures);
      }
    }
  }

  /**
   * 创建顶级结构对象
   */
  private static createTopLevelStructure(
    node: Parser.SyntaxNode,
    lines: string[],
    type: string,
    language: string
  ): TopLevelStructure {
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const name = this.extractNodeName(node) || `${type}_${startLine}`;

    return {
      type,
      name,
      content: lines.slice(startLine - 1, endLine).join('\n'),
      location: {
        startLine,
        endLine
      },
      node,
      metadata: {
        language,
        confidence: 0.95
      }
    };
  }

  /**
   * 创建嵌套结构对象
   */
  private static createNestedStructure(
    node: Parser.SyntaxNode,
    lines: string[],
    type: string,
    level: number
  ): NestedStructure {
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const name = this.extractNodeName(node) || `${type}_${startLine}`;

    return {
      type,
      name,
      content: lines.slice(startLine - 1, endLine).join('\n'),
      location: {
        startLine,
        endLine
      },
      parentNode: node.parent,
      level,
      metadata: {
        nestingLevel: level,
        confidence: 0.9
      }
    };
  }

  /**
   * 创建内部结构对象
   */
  private static createInternalStructure(
    node: Parser.SyntaxNode,
    lines: string[],
    type: string,
    importance: 'low' | 'medium' | 'high'
  ): InternalStructure {
    const startLine = node.startPosition.row + 1;
    const endLine = node.endPosition.row + 1;
    const name = this.extractNodeName(node) || `${type}_${startLine}`;

    return {
      type,
      name,
      content: lines.slice(startLine - 1, endLine).join('\n'),
      location: {
        startLine,
        endLine
      },
      parentNode: node.parent,
      importance,
      metadata: {
        confidence: 0.85
      }
    };
  }

  /**
   * 从节点提取名称
   */
  private static extractNodeName(node: Parser.SyntaxNode): string | null {
    if (!node) return null;

    // 尝试从不同的节点类型中提取名称
    switch (node.type) {
      case 'function_declaration':
      case 'function_definition':
      case 'function_item':
        const funcName = this.findChildByType(node, 'identifier');
        return funcName ? funcName.text : null;
        
      case 'class_declaration':
      case 'class_definition':
      case 'class_specifier':
      case 'struct_specifier':
      case 'struct_item':
        const className = this.findChildByType(node, 'identifier');
        return className ? className.text : null;
        
      case 'variable_declaration':
      case 'variable_declarator':
        const varName = this.findChildByType(node, 'identifier');
        return varName ? varName.text : null;
        
      case 'interface_declaration':
      case 'interface_type':
        const interfaceName = this.findChildByType(node, 'identifier');
        return interfaceName ? interfaceName.text : null;
        
      case 'enum_declaration':
      case 'enum_specifier':
      case 'enum_item':
        const enumName = this.findChildByType(node, 'identifier');
        return enumName ? enumName.text : null;
        
      default:
        // 通用方法：查找第一个标识符子节点
        const identifier = this.findChildByType(node, 'identifier');
        return identifier ? identifier.text : null;
    }
  }

  /**
   * 查找指定类型的子节点
   */
  private static findChildByType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
    if (!node) return null;

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === type) {
        return child;
      }
    }

    return null;
  }

  /**
   * 查找所有指定类型的节点
   */
  private static findNodesByType(rootNode: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];
    
    const traverse = (node: Parser.SyntaxNode) => {
      if (!node) return;
      
      if (node.type === type) {
        nodes.push(node);
      }
      
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          traverse(child);
        }
      }
    };
    
    traverse(rootNode);
    return nodes;
  }

  /**
   * 将节点类型映射为结构类型
   */
  private static mapNodeTypeToStructureType(nodeType: string): string {
    const typeMap: Record<string, string> = {
      'function_declaration': 'function',
      'function_definition': 'function',
      'function_item': 'function',
      'class_declaration': 'class',
      'class_definition': 'class',
      'class_specifier': 'class',
      'interface_declaration': 'interface',
      'interface_type': 'interface',
      'struct_specifier': 'struct',
      'struct_item': 'struct',
      'struct_type': 'struct',
      'enum_declaration': 'enum',
      'enum_specifier': 'enum',
      'enum_item': 'enum',
      'type_declaration': 'type',
      'type_definition': 'type',
      'import_statement': 'import',
      'import_from_statement': 'import',
      'export_statement': 'export'
    };

    return typeMap[nodeType] || 'unknown';
  }
}