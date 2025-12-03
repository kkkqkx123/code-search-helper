import Parser from 'tree-sitter';
import { LoggerService } from '../../../utils/LoggerService';
import { ParseOptions } from '../types';
import { TREE_SITTER_LANGUAGE_MAP } from '../constants/language-constants';
import { DynamicParserManager } from '../query/DynamicParserManager';
import { QueryExecutor } from '../query/QueryExecutor';

/**
 * 代码结构服务
 * 专门负责具体的代码结构提取业务逻辑
 * 重构为使用新的解析模块
 */
export class CodeStructureService {
  private logger = new LoggerService();
  private parserManager: DynamicParserManager;
  private queryEngine: TreeSitterQueryEngine;

  constructor() {
    this.parserManager = new DynamicParserManager();
    this.queryEngine = new TreeSitterQueryEngine();
  }

  /**
   * 提取函数节点
   * @param ast AST节点
   * @param language 可选的语言参数
   * @returns 函数节点数组
   */
  async extractFunctions(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      const lang = language || this.detectLanguageFromAST(ast);
      if (!lang) {
        this.logger.warn('无法检测语言，使用通用查询');
        return this.findNodeByType(ast, 'function_declaration');
      }

      // 使用查询引擎执行函数查询
      const result = await this.queryEngine.executeEntityQuery(ast, 'function', lang, {});

      // 如果查询系统返回空结果，回退到直接使用节点类型
      if (result.length === 0) {
        this.logger.warn('查询系统未找到函数，回退到节点类型匹配');
        return this.findNodeByType(ast, 'function_declaration');
      }

      return result.map((entity: any) => entity.node);
    } catch (error) {
      this.logger.error('提取函数失败:', error);
      // 回退到通用节点查找，使用Go语言的具体节点类型
      return this.findNodeByType(ast, 'function_declaration');
    }
  }

  /**
   * 提取类节点
   * @param ast AST节点
   * @param language 可选的语言参数
   * @returns 类节点数组
   */
  async extractClasses(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      const lang = language || this.detectLanguageFromAST(ast);
      if (!lang) {
        this.logger.warn('无法检测语言，使用通用查询');
        return this.findNodeByType(ast, 'type_declaration');
      }

      // 使用查询引擎执行类查询
      const result = await this.queryEngine.executeEntityQuery(ast, 'class', lang, {});

      // 如果查询系统返回空结果，回退到直接使用节点类型
      if (result.length === 0) {
        this.logger.warn('查询系统未找到类，回退到节点类型匹配');
        return this.findNodeByType(ast, 'type_declaration');
      }

      return result.map((entity: any) => entity.node);
    } catch (error) {
      this.logger.error('提取类失败:', error);
      // 回退到通用节点查找，使用Go语言的具体节点类型
      return this.findNodeByType(ast, 'type_declaration');
    }
  }

  /**
   * 提取导入节点
   * @param ast AST节点
   * @param language 可选的语言参数
   * @returns 导入节点数组
   */
  async extractImports(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      const lang = language || this.detectLanguageFromAST(ast);
      if (!lang) {
        this.logger.warn('无法检测语言，使用通用查询');
        return this.findNodeByType(ast, 'import');
      }

      // 使用查询引擎执行导入查询
      const result = await this.queryEngine.executeEntityQuery(ast, 'import', lang, {});
      return result.map((entity: any) => entity.node);
    } catch (error) {
      this.logger.error('提取导入失败:', error);
      // 回退到通用节点查找
      return this.findNodeByType(ast, 'import');
    }
  }

  /**
   * 提取导出节点
   * @param ast AST节点
   * @param language 可选的语言参数
   * @returns 导出节点数组
   */
  async extractExports(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      const lang = language || this.detectLanguageFromAST(ast);
      if (!lang) {
        this.logger.warn('无法检测语言，使用通用查询');
        return this.findNodeByType(ast, 'export');
      }

      // 使用查询引擎执行导出查询
      const result = await this.queryEngine.executeEntityQuery(ast, 'export', lang, {});
      return result.map((entity: any) => entity.node);
    } catch (error) {
      this.logger.error('提取导出失败:', error);
      // 回退到通用节点查找
      return this.findNodeByType(ast, 'export');
    }
  }

  /**
   * 提取语义关系节点
   * @param ast AST节点
   * @param language 可选的语言参数
   * @param options 解析选项
   * @returns 关系节点数组
   */
  async extractSemanticRelationships(ast: Parser.SyntaxNode, language?: string, options?: ParseOptions): Promise<Parser.SyntaxNode[]> {
    // 检查是否应该提取关系节点
    if (!this.shouldExtractRelationships(options)) {
      this.logger.debug('关系节点提取已禁用，跳过语义关系提取');
      return [];
    }

    try {
      const lang = language || this.detectLanguageFromAST(ast);
      if (!lang) {
        this.logger.warn('无法检测语言，跳过语义关系提取');
        return [];
      }

      // 使用查询引擎执行语义关系查询
      const result = await this.queryEngine.executeRelationshipQuery(ast, 'semantic', lang, {});

      this.logger.debug(`提取到 ${result.length} 个语义关系节点`);
      return result.map((relationship: any) => relationship.node);
    } catch (error) {
      this.logger.error('提取语义关系失败:', error);
      return [];
    }
  }

  /**
   * 判断是否应该提取关系节点
   * @param options 解析选项
   * @returns 是否应该提取关系节点
   */
  private shouldExtractRelationships(options?: ParseOptions): boolean {
    // 首先检查 NEBULA_ENABLED 环境变量（最高优先级）
    const nebulaEnabled = process.env.NEBULA_ENABLED?.toLowerCase() !== 'false';
    if (!nebulaEnabled) {
      return false;
    }

    // 如果显式禁用了关系提取，直接返回 false
    if (options?.extractRelationships === false) {
      return false;
    }

    // 如果没有显式设置选项，则根据 NEBULA_ENABLED 决定（此时已确认为 true）
    if (options?.extractRelationships === undefined) {
      return true;
    }

    // 如果显式启用了关系提取，则返回 true
    return options.extractRelationships === true;
  }

  /**
   * 提取导入节点（同步版本）
   * @param ast AST节点
   * @returns 导入节点数组
   */
  extractImportNodes(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    try {
      return this.findNodeByType(ast, 'import');
    } catch (error) {
      this.logger.error('提取导入节点失败:', error);
      return [];
    }
  }

  /**
   * 提取导入节点（异步版本）
   * @param ast AST节点
   * @returns 导入节点数组
   */
  async extractImportNodesAsync(ast: Parser.SyntaxNode): Promise<Parser.SyntaxNode[]> {
    try {
      return await this.extractImports(ast);
    } catch (error) {
      this.logger.error('提取导入节点失败:', error);
      return [];
    }
  }

  /**
   * 从AST检测语言
   * @param ast AST节点
   * @returns 语言名称或null
   */
  private detectLanguageFromAST(ast: Parser.SyntaxNode): string | null {
    const tree = (ast as any).tree;
    if (tree && tree.language && tree.language.name) {
      const languageName = tree.language.name;
      return TREE_SITTER_LANGUAGE_MAP[languageName] || languageName;
    }

    return null;
  }

  /**
   * 提取方法节点
   * @param ast AST节点
   * @param language 可选的语言参数
   * @returns 方法节点数组
   */
  async extractMethods(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      const lang = language || this.detectLanguageFromAST(ast);
      if (!lang) {
        this.logger.warn('无法检测语言，使用通用查询');
        return this.findNodeByType(ast, 'method');
      }

      // 使用查询引擎执行方法查询
      const result = await this.queryEngine.executeEntityQuery(ast, 'method', lang, {});
      return result.map((entity: any) => entity.node);
    } catch (error) {
      this.logger.error('提取方法失败:', error);
      // 回退到通用节点查找
      return this.findNodeByType(ast, 'method');
    }
  }

  /**
   * 提取接口节点
   * @param ast AST节点
   * @param language 可选的语言参数
   * @returns 接口节点数组
   */
  async extractInterfaces(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      const lang = language || this.detectLanguageFromAST(ast);
      if (!lang) {
        this.logger.warn('无法检测语言，使用通用查询');
        return this.findNodeByType(ast, 'interface');
      }

      // 使用查询引擎执行接口查询
      const result = await this.queryEngine.executeEntityQuery(ast, 'interface', lang, {});
      return result.map((entity: any) => entity.node);
    } catch (error) {
      this.logger.error('提取接口失败:', error);
      // 回退到通用节点查找
      return this.findNodeByType(ast, 'interface');
    }
  }

  /**
   * 提取类型定义节点
   * @param ast AST节点
   * @param language 可选的语言参数
   * @returns 类型定义节点数组
   */
  async extractTypes(ast: Parser.SyntaxNode, language?: string): Promise<Parser.SyntaxNode[]> {
    try {
      const lang = language || this.detectLanguageFromAST(ast);
      if (!lang) {
        this.logger.warn('无法检测语言，使用通用查询');
        return this.findNodeByType(ast, 'type');
      }

      // 使用查询引擎执行类型查询
      const result = await this.queryEngine.executeEntityQuery(ast, 'type', lang, {});
      return result.map((entity: any) => entity.node);
    } catch (error) {
      this.logger.error('提取类型定义失败:', error);
      // 回退到通用节点查找
      return this.findNodeByType(ast, 'type');
    }
  }

  /**
   * 查找指定类型的节点
   * @param ast AST节点
   * @param nodeType 节点类型
   * @returns 匹配的节点数组
   */
  private findNodeByType(ast: Parser.SyntaxNode, nodeType: string): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];

    // 递归遍历AST查找指定类型的节点
    const traverse = (node: Parser.SyntaxNode) => {
      if (node.type === nodeType) {
        nodes.push(node);
      }

      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          traverse(child);
        }
      }
    };

    traverse(ast);
    return nodes;
  }

  /**
   * 提取完整的代码结构
   * @param ast AST节点
   * @param language 编程语言
   * @returns 完整的代码结构
   */
  async extractStructure(ast: Parser.SyntaxNode, language: string): Promise<any> {
    try {
      const functions = await this.extractFunctions(ast, language);
      const classes = await this.extractClasses(ast, language);
      const imports = await this.extractImports(ast, language);
      const exports = await this.extractExports(ast, language);
      const methods = await this.extractMethods(ast, language);
      const interfaces = await this.extractInterfaces(ast, language);
      const types = await this.extractTypes(ast, language);
      const relationships = await this.extractSemanticRelationships(ast, language);

      return {
        functions: functions.length,
        classes: classes.length,
        imports: imports.length,
        exports: exports.length,
        methods: methods.length,
        interfaces: interfaces.length,
        types: types.length,
        relationships: relationships.length,
        details: {
          functions,
          classes,
          imports,
          exports,
          methods,
          interfaces,
          types,
          relationships
        }
      };
    } catch (error) {
      this.logger.error('提取代码结构失败:', error);
      return {
        functions: 0,
        classes: 0,
        imports: 0,
        exports: 0,
        methods: 0,
        interfaces: 0,
        types: 0,
        relationships: 0,
        details: {}
      };
    }
  }
}