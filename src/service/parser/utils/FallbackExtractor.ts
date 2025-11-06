import Parser from 'tree-sitter';
import { TreeSitterQueryFacade } from '../core/query/TreeSitterQueryFacade';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 回退提取器
 * 当语言特定查询失败时，提供智能的回退机制
 * 优先使用现有查询系统，最后才使用通用节点遍历
 */
export class FallbackExtractor {
  private static logger = new LoggerService();

  /**
   * 从节点提取文本内容
   * @param node 语法节点
   * @param sourceCode 源代码
   * @returns 节点文本
   */
  static getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }

  /**
   * 获取节点位置信息
   * @param node 语法节点
   * @returns 位置信息（行和列，从1开始）
   */
  static getNodeLocation(node: Parser.SyntaxNode): {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  } {
    return {
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endColumn: node.endPosition.column + 1,
    };
  }

  /**
   * 检测语言（从AST）
   * @param ast AST节点
   * @returns 语言名称或null
   */
  private static detectLanguageFromAST(ast: Parser.SyntaxNode): string | null {
    const tree = (ast as any).tree;
    if (tree && tree.language && tree.language.name) {
      const languageName = tree.language.name;
      const languageMap: Record<string, string> = {
        'typescript': 'typescript',
        'javascript': 'javascript',
        'python': 'python',
        'java': 'java',
        'go': 'go',
        'rust': 'rust',
        'cpp': 'cpp',
        'c': 'c',
        'c_sharp': 'csharp',
        'swift': 'swift',
        'kotlin': 'kotlin',
        'ruby': 'ruby',
        'php': 'php',
        'scala': 'scala'
      };

      return languageMap[languageName] || languageName;
    }

    return null;
  }

  /**
   * 提取函数节点
   * @param ast AST节点
   * @param language 可选的语言参数
   * @returns 函数节点数组
   */
  static async extractFunctions(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      // 尝试使用语言特定查询
      const lang = language || this.detectLanguageFromAST(ast);
      if (lang) {
        try {
          const functions = await TreeSitterQueryFacade.findFunctions(ast, lang);
          if (functions.length > 0) {
            this.logger.debug(`使用语言特定查询提取到 ${functions.length} 个函数 (${lang})`);
            return functions;
          }
        } catch (error) {
          this.logger.warn(`语言特定查询失败 (${lang}):`, error);
        }
      }

      // 回退到通用节点类型遍历
      return this.extractNodesByTypes(ast, this.getFunctionNodeTypes());
    } catch (error) {
      this.logger.error('函数提取失败:', error);
      return [];
    }
  }

  /**
   * 提取类节点
   * @param ast AST节点
   * @param language 可选的语言参数
   * @returns 类节点数组
   */
  static async extractClasses(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      // 尝试使用语言特定查询
      const lang = language || this.detectLanguageFromAST(ast);
      if (lang) {
        try {
          const classes = await TreeSitterQueryFacade.findClasses(ast, lang);
          if (classes.length > 0) {
            this.logger.debug(`使用语言特定查询提取到 ${classes.length} 个类 (${lang})`);
            return classes;
          }
        } catch (error) {
          this.logger.warn(`语言特定查询失败 (${lang}):`, error);
        }
      }

      // 回退到通用节点类型遍历
      return this.extractNodesByTypes(ast, this.getClassNodeTypes());
    } catch (error) {
      this.logger.error('类提取失败:', error);
      return [];
    }
  }

  /**
   * 提取导入节点
   * @param ast AST节点
   * @param language 可选的语言参数
   * @returns 导入节点数组
   */
  static async extractImports(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      // 尝试使用语言特定查询
      const lang = language || this.detectLanguageFromAST(ast);
      if (lang) {
        try {
          const imports = await TreeSitterQueryFacade.findImports(ast, lang);
          if (imports.length > 0) {
            this.logger.debug(`使用语言特定查询提取到 ${imports.length} 个导入 (${lang})`);
            return imports;
          }
        } catch (error) {
          this.logger.warn(`语言特定查询失败 (${lang}):`, error);
        }
      }

      // 回退到通用节点类型遍历
      return this.extractNodesByTypes(ast, this.getImportNodeTypes());
    } catch (error) {
      this.logger.error('导入提取失败:', error);
      return [];
    }
  }

  /**
   * 提取导出节点
   * @param ast AST节点
   * @param language 可选的语言参数
   * @returns 导出节点数组
   */
  static async extractExports(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      // 尝试使用语言特定查询
      const lang = language || this.detectLanguageFromAST(ast);
      if (lang) {
        try {
          const exports = await TreeSitterQueryFacade.findExports(ast, lang);
          if (exports.length > 0) {
            this.logger.debug(`使用语言特定查询提取到 ${exports.length} 个导出 (${lang})`);
            return exports;
          }
        } catch (error) {
          this.logger.warn(`语言特定查询失败 (${lang}):`, error);
        }
      }

      // 回退到通用节点类型遍历
      return this.extractNodesByTypes(ast, this.getExportNodeTypes());
    } catch (error) {
      this.logger.error('导出提取失败:', error);
      return [];
    }
  }

  /**
   * 提取导入文本（同步版本，兼容旧接口）
   * @param ast AST节点
   * @param sourceCode 源代码
   * @returns 导入文本数组
   */
  static extractImportTexts(ast: Parser.SyntaxNode, sourceCode?: string): string[] {
    if (!sourceCode) {
      return [];
    }

    const imports: string[] = [];
    const importTypes = this.getImportNodeTypes();

    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (depth > 100) return;

      if (importTypes.has(node.type)) {
        const importText = this.getNodeText(node, sourceCode);
        if (importText.trim().length > 0) {
          imports.push(importText);
        }
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(ast);
    return imports;
  }

  /**
   * 提取导入节点（同步版本，兼容旧接口）
   * @param ast AST节点
   * @returns 导入节点数组
   */
  static extractImportNodes(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    return this.extractNodesByTypes(ast, this.getImportNodeTypes());
  }

  /**
   * 获取节点名称（增强版，支持语言特定）
   * @param node 语法节点
   * @param language 可选的语言参数
   * @returns 节点名称
   */
  static getNodeName(node: Parser.SyntaxNode, language?: string): string {
    // 根据语言使用特定的提取逻辑
    if (language) {
      const name = this.extractNodeNameByLanguage(node, language);
      if (name !== 'unnamed') {
        return name;
      }
    }

    // 通用提取逻辑
    if (node.type === 'function_declaration' || node.type === 'method_definition') {
      const nameNode = node.children?.find(child => child.type === 'identifier');
      if (nameNode) {
        return nameNode.text || node.type;
      }
    }

    if (node.type === 'class_declaration') {
      const nameNode = node.children?.find(child => child.type === 'type_identifier' || child.type === 'identifier');
      if (nameNode) {
        return nameNode.text || node.type;
      }
    }

    return node.type;
  }

  /**
   * 根据语言提取节点名称
   * @param node 语法节点
   * @param language 语言名称
   * @returns 节点名称
   */
  private static extractNodeNameByLanguage(node: Parser.SyntaxNode, language: string): string {
    const lang = language.toLowerCase();
    
    // 尝试从不同的捕获中提取名称
    const nameFields = this.getNameFieldsByLanguage(lang);
    
    for (const fieldName of nameFields) {
      const nameNode = node.childForFieldName?.(fieldName);
      if (nameNode?.text) {
        return nameNode.text;
      }
    }

    // 尝试从特定类型的子节点中提取
    const nameTypes = this.getNameTypesByLanguage(lang);
    for (const type of nameTypes) {
      const nameNode = node.children?.find(child => child.type === type);
      if (nameNode?.text) {
        return nameNode.text;
      }
    }

    return 'unnamed';
  }

  /**
   * 根据语言获取名称字段
   * @param language 语言名称
   * @returns 字段名数组
   */
  private static getNameFieldsByLanguage(language: string): string[] {
    const commonFields = ['name', 'identifier'];
    
    const languageSpecificFields: Record<string, string[]> = {
      'python': ['name', 'identifier'],
      'javascript': ['id', 'name', 'identifier'],
      'typescript': ['id', 'name', 'identifier'],
      'java': ['name', 'identifier'],
      'c': ['name', 'identifier'],
      'cpp': ['name', 'identifier'],
      'go': ['name', 'identifier'],
      'rust': ['name', 'identifier'],
    };

    return [...commonFields, ...(languageSpecificFields[language] || [])];
  }

  /**
   * 根据语言获取名称节点类型
   * @param language 语言名称
   * @returns 节点类型数组
   */
  private static getNameTypesByLanguage(language: string): string[] {
    const commonTypes = ['identifier', 'type_identifier'];
    
    const languageSpecificTypes: Record<string, string[]> = {
      'python': ['identifier'],
      'javascript': ['identifier', 'property_identifier'],
      'typescript': ['identifier', 'type_identifier', 'property_identifier'],
      'java': ['identifier'],
      'c': ['identifier'],
      'cpp': ['identifier'],
      'go': ['identifier'],
      'rust': ['identifier'],
    };

    return [...commonTypes, ...(languageSpecificTypes[language] || [])];
  }

  /**
   * 按类型提取节点
   * @param ast AST节点
   * @param types 节点类型集合
   * @returns 节点数组
   */
  static extractNodesByTypes(ast: Parser.SyntaxNode, types: Set<string>): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];

    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (depth > 100) return;

      if (types.has(node.type)) {
        nodes.push(node);
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(ast);
    return nodes;
  }

  /**
   * 获取函数节点类型
   * @returns 函数节点类型集合
   */
  private static getFunctionNodeTypes(): Set<string> {
    return new Set([
      'function_declaration',
      'function_definition',
      'method_definition',
      'arrow_function',
      'function_expression',
      'generator_function',
      'generator_function_declaration',
      'method_signature',
      'method_declaration',
      'constructor_declaration',
      'destructor_declaration',
      'operator_declaration',
      'func_literal',
      'local_function_definition',
    ]);
  }

  /**
   * 获取类节点类型
   * @returns 类节点类型集合
   */
  private static getClassNodeTypes(): Set<string> {
    return new Set([
      'class_declaration',
      'class_definition',
      'class_expression',
      'interface_declaration',
      'interface_definition',
      'struct_specifier',
      'struct_definition',
      'union_specifier',
      'enum_specifier',
      'enum_declaration',
      'type_declaration',
      'type_definition',
      'type_alias_declaration',
      'trait_definition',
      'object_definition',
    ]);
  }

  /**
   * 获取导入节点类型
   * @returns 导入节点类型集合
   */
  private static getImportNodeTypes(): Set<string> {
    return new Set([
      'import_statement',
      'import_declaration',
      'import_clause',
      'import_specifier',
      'require',
      'import_from_statement',
      'import_alias',
      'preproc_include',
      'use_declaration',
    ]);
  }

  /**
   * 获取导出节点类型
   * @returns 导出节点类型集合
   */
  private static getExportNodeTypes(): Set<string> {
    return new Set([
      'export_statement',
      'export_declaration',
      'export_default_declaration',
      'export_named_declaration',
      'export_specifier',
      'export_alias',
      'export_clause',
      'export_from_statement',
      'export_as_clause',
      'preproc_def',
      'preproc_function_def',
    ]);
  }
}