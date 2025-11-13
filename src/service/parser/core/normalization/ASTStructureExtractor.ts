import { TopLevelStructure, NestedStructure, InternalStructure } from '../../../../utils/types/ContentTypes';
import Parser from 'tree-sitter';
import { QueryResultNormalizer } from './QueryResultNormalizer';
import { TreeSitterCoreService } from '../parse/TreeSitterCoreService';
import { StandardizedQueryResult } from './types';
import { LoggerService } from '../../../../utils/LoggerService';
import { LRUCache } from '../../../../utils/cache/LRUCache';
import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';
import { InfrastructureConfigService } from '../../../../infrastructure/config/InfrastructureConfigService';
import { GlobalASTStructureExtractorFactory } from './ASTStructureExtractorFactory';
import { StructureTypeConverter } from './utils/StructureTypeConverter';

/**
 * AST结构提取器 - 基于Normalization系统的新实现
 * 负责基于已解析的AST提取代码结构
 * 利用normalization系统的缓存和性能监控
 */
export class ASTStructureExtractor {
  private logger: LoggerService;
  private cache: LRUCache<string, any>;
  private performanceMonitor?: PerformanceMonitor;
  private typeConverter: StructureTypeConverter;

  constructor(
    private queryNormalizer: QueryResultNormalizer,
    private treeSitterService: TreeSitterCoreService
  ) {
    this.logger = new LoggerService();

    // 初始化缓存
    this.cache = new LRUCache(100, { enableStats: true });

    // 初始化性能监控
    this.performanceMonitor = new PerformanceMonitor(this.logger, new InfrastructureConfigService(this.logger, {
      get: () => ({}),
      set: () => { },
      has: () => false,
      clear: () => { }
    } as any));

    // 初始化类型转换器
    this.typeConverter = new StructureTypeConverter();
  }

  /**
   * 基于AST提取顶级结构
   * @param content 源代码内容
   * @param language 编程语言
   * @param ast 已解析的AST根节点
   * @returns 顶级结构数组
   */
  static async extractTopLevelStructuresFromAST(
    content: string,
    language: string,
    ast: Parser.SyntaxNode
  ): Promise<TopLevelStructure[]> {
    // 使用全局工厂获取实例
    const factory = GlobalASTStructureExtractorFactory.getFactory();
    const extractor = factory.getInstance();
    return extractor.extractTopLevelStructuresFromAST(content, language, ast);
  }

  /**
   * 基于AST提取嵌套结构
   * @param content 源代码内容
   * @param parentNode 父节点
   * @param level 嵌套层级
   * @param ast 已解析的AST根节点
   * @returns 嵌套结构数组
   */
  static async extractNestedStructuresFromAST(
    content: string,
    parentNode: Parser.SyntaxNode,
    level: number,
    ast: Parser.SyntaxNode
  ): Promise<NestedStructure[]> {
    const factory = GlobalASTStructureExtractorFactory.getFactory();
    const extractor = factory.getInstance();
    return extractor.extractNestedStructuresFromAST(content, parentNode, level, ast);
  }

  /**
   * 基于AST提取内部结构
   * @param content 源代码内容
   * @param parentNode 父节点
   * @param ast 已解析的AST根节点
   * @returns 内部结构数组
   */
  static async extractInternalStructuresFromAST(
    content: string,
    parentNode: Parser.SyntaxNode,
    ast: Parser.SyntaxNode
  ): Promise<InternalStructure[]> {
    const factory = GlobalASTStructureExtractorFactory.getFactory();
    const extractor = factory.getInstance();
    return extractor.extractInternalStructuresFromAST(content, parentNode, ast);
  }

  /**
   * 实例方法：提取顶级结构
   */
  async extractTopLevelStructuresFromAST(
    content: string,
    language: string,
    ast: Parser.SyntaxNode
  ): Promise<TopLevelStructure[]> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('topLevel', content, language, ast);

    // 检查缓存
    if (this.cache.has(cacheKey)) {
      this.performanceMonitor?.updateCacheHitRate(true);
      return this.cache.get(cacheKey);
    }

    try {
      // 使用QueryResultNormalizer进行标准化
      const standardizedResults = await this.queryNormalizer.normalize(ast, language);

      // 转换为TopLevelStructure格式
      const topLevelStructures = this.convertToTopLevelStructures(standardizedResults, content, language);

      // 缓存结果
      this.cache.set(cacheKey, topLevelStructures);

      // 更新性能监控
      this.performanceMonitor?.recordQueryExecution(Date.now() - startTime);
      this.performanceMonitor?.updateCacheHitRate(false);

      this.logger.debug(`提取到 ${topLevelStructures.length} 个顶级结构 (${language})`);
      return topLevelStructures;
    } catch (error) {
      this.logger.error(`提取顶级结构失败 (${language}):`, error);

      // 降级到原始实现
      return this.fallbackTopLevelExtraction(content, language, ast);
    }
  }

  /**
   * 实例方法：提取嵌套结构
   */
  async extractNestedStructuresFromAST(
    content: string,
    parentNode: Parser.SyntaxNode,
    level: number,
    ast: Parser.SyntaxNode
  ): Promise<NestedStructure[]> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('nested', content, '', ast, parentNode.id, level);

    // 检查缓存
    if (this.cache.has(cacheKey)) {
      this.performanceMonitor?.updateCacheHitRate(true);
      return this.cache.get(cacheKey);
    }

    try {
      // 使用QueryResultNormalizer进行标准化
      const standardizedResults = await this.queryNormalizer.normalize(parentNode, '');

      // 转换为NestedStructure格式
      const nestedStructures = this.convertToNestedStructures(standardizedResults, content, level);

      // 缓存结果
      this.cache.set(cacheKey, nestedStructures);

      // 更新性能监控
      this.performanceMonitor?.recordQueryExecution(Date.now() - startTime);
      this.performanceMonitor?.updateCacheHitRate(false);

      this.logger.debug(`提取到 ${nestedStructures.length} 个嵌套结构 (层级 ${level})`);
      return nestedStructures;
    } catch (error) {
      this.logger.error(`提取嵌套结构失败 (层级 ${level}):`, error);

      // 降级到原始实现
      return this.fallbackNestedExtraction(content, parentNode, level, ast);
    }
  }

  /**
   * 实例方法：提取内部结构
   */
  async extractInternalStructuresFromAST(
    content: string,
    parentNode: Parser.SyntaxNode,
    ast: Parser.SyntaxNode
  ): Promise<InternalStructure[]> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('internal', content, '', ast, parentNode.id);

    // 检查缓存
    if (this.cache.has(cacheKey)) {
      this.performanceMonitor?.updateCacheHitRate(true);
      return this.cache.get(cacheKey);
    }

    try {
      // 使用QueryResultNormalizer进行标准化
      const standardizedResults = await this.queryNormalizer.normalize(parentNode, '');

      // 转换为InternalStructure格式
      const internalStructures = this.convertToInternalStructures(standardizedResults, content);

      // 缓存结果
      this.cache.set(cacheKey, internalStructures);

      // 更新性能监控
      this.performanceMonitor?.recordQueryExecution(Date.now() - startTime);
      this.performanceMonitor?.updateCacheHitRate(false);

      this.logger.debug(`提取到 ${internalStructures.length} 个内部结构`);
      return internalStructures;
    } catch (error) {
      this.logger.error(`提取内部结构失败:`, error);

      // 降级到原始实现
      return this.fallbackInternalExtraction(content, parentNode, ast);
    }
  }

  /**
   * 将标准化结果转换为顶级结构
   */
  private convertToTopLevelStructures(
    standardizedResults: StandardizedQueryResult[],
    content: string,
    language: string
  ): TopLevelStructure[] {
    return this.typeConverter.convertToTopLevelStructures(standardizedResults, content, language);
  }

  /**
   * 将标准化结果转换为嵌套结构
   */
  private convertToNestedStructures(
    standardizedResults: StandardizedQueryResult[],
    content: string,
    level: number
  ): NestedStructure[] {
    return this.typeConverter.convertToNestedStructures(standardizedResults, content, level);
  }

  /**
   * 将标准化结果转换为内部结构
   */
  private convertToInternalStructures(
    standardizedResults: StandardizedQueryResult[],
    content: string
  ): InternalStructure[] {
    return this.typeConverter.convertToInternalStructures(standardizedResults, content);
  }



  /**
   * 生成缓存键
   */
  private generateCacheKey(
    type: string,
    content: string,
    language: string,
    ast: Parser.SyntaxNode,
    parentNodeId?: number,
    level?: number
  ): string {
    const components = [
      type,
      language,
      this.hashContent(content),
      this.hashAST(ast)
    ];

    if (parentNodeId !== undefined) {
      components.push(`parent:${parentNodeId}`);
    }

    if (level !== undefined) {
      components.push(`level:${level}`);
    }

    return components.join(':');
  }

  /**
   * 哈希内容
   */
  private hashContent(content: string): string {
    // 简单的哈希实现
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 哈希AST
   */
  private hashAST(ast: Parser.SyntaxNode): string {
    return `${ast.type}:${ast.startIndex}:${ast.endIndex}`;
  }

  /**
   * 降级顶级结构提取
   */
  private fallbackTopLevelExtraction(
    content: string,
    language: string,
    ast: Parser.SyntaxNode
  ): TopLevelStructure[] {
    this.logger.warn(`使用降级方法提取顶级结构 (${language})`);

    // 简单的降级实现
    const lines = content.split('\n');
    const structures: TopLevelStructure[] = [];

    // 基本结构检测
    this.extractBasicStructures(ast, lines, structures, language);

    return structures;
  }

  /**
   * 降级嵌套结构提取
   */
  private fallbackNestedExtraction(
    content: string,
    parentNode: Parser.SyntaxNode,
    level: number,
    ast: Parser.SyntaxNode
  ): NestedStructure[] {
    this.logger.warn(`使用降级方法提取嵌套结构 (层级 ${level})`);

    const lines = content.split('\n');
    const structures: NestedStructure[] = [];

    // 基本嵌套结构检测
    this.extractBasicNestedStructures(parentNode, lines, structures, level);

    return structures;
  }

  /**
   * 降级内部结构提取
   */
  private fallbackInternalExtraction(
    content: string,
    parentNode: Parser.SyntaxNode,
    ast: Parser.SyntaxNode
  ): InternalStructure[] {
    this.logger.warn(`使用降级方法提取内部结构`);

    const lines = content.split('\n');
    const structures: InternalStructure[] = [];

    // 基本内部结构检测
    this.extractBasicInternalStructures(parentNode, lines, structures);

    return structures;
  }

  /**
   * 提取基本结构
   */
  private extractBasicStructures(
    node: Parser.SyntaxNode,
    lines: string[],
    structures: TopLevelStructure[],
    language: string
  ): void {
    if (!node) return;

    // 基本结构类型检测
    const structureTypes = [
      'function_declaration', 'function_definition', 'function_item',
      'class_declaration', 'class_definition', 'class_specifier',
      'interface_declaration', 'interface_type',
      'struct_specifier', 'struct_item', 'struct_type',
      'enum_declaration', 'enum_specifier', 'enum_item',
      'type_declaration', 'type_definition',
      'import_statement', 'import_from_statement',
      'export_statement'
    ];

    if (structureTypes.includes(node.type)) {
      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;
      const name = this.extractNodeName(node) || `${node.type}_${startLine}`;

      structures.push({
        type: this.mapNodeTypeToStructureType(node.type),
        name,
        content: lines.slice(startLine - 1, endLine).join('\n'),
        location: { startLine, endLine },
        node,
        metadata: {
          language,
          confidence: 0.7 // 降级方法的置信度较低
        }
      });
    }

    // 递归处理子节点
    if (node.children) {
      for (const child of node.children) {
        this.extractBasicStructures(child, lines, structures, language);
      }
    }
  }

  /**
   * 提取基本嵌套结构
   */
  private extractBasicNestedStructures(
    node: Parser.SyntaxNode,
    lines: string[],
    structures: NestedStructure[],
    level: number
  ): void {
    if (!node || level > 10) return;

    // 嵌套结构类型检测
    const nestedTypes = [
      'function_declaration', 'function_definition', 'function_item',
      'class_declaration', 'class_definition', 'class_specifier',
      'method_definition', 'method_declaration',
      'if_statement', 'for_statement', 'while_statement', 'switch_statement'
    ];

    if (nestedTypes.includes(node.type)) {
      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;
      const name = this.extractNodeName(node) || `${node.type}_${startLine}`;

      structures.push({
        type: this.mapNodeTypeToStructureType(node.type),
        name,
        content: lines.slice(startLine - 1, endLine).join('\n'),
        location: { startLine, endLine },
        parentNode: node.parent,
        level,
        metadata: {
          nestingLevel: level,
          confidence: 0.6 // 降级方法的置信度较低
        }
      });
    }

    // 递归处理子节点
    if (node.children) {
      for (const child of node.children) {
        this.extractBasicNestedStructures(child, lines, structures, level + 1);
      }
    }
  }

  /**
   * 提取基本内部结构
   */
  private extractBasicInternalStructures(
    node: Parser.SyntaxNode,
    lines: string[],
    structures: InternalStructure[]
  ): void {
    if (!node) return;

    // 内部结构类型检测
    const internalTypes = [
      'variable_declaration', 'variable_declarator',
      'assignment_expression', 'let_declaration', 'const_declaration',
      'return_statement', 'expression_statement'
    ];

    if (internalTypes.includes(node.type)) {
      const startLine = node.startPosition.row + 1;
      const endLine = node.endPosition.row + 1;
      const name = this.extractNodeName(node) || `${node.type}_${startLine}`;

      structures.push({
        type: this.mapNodeTypeToStructureType(node.type),
        name,
        content: lines.slice(startLine - 1, endLine).join('\n'),
        location: { startLine, endLine },
        parentNode: node.parent,
        importance: this.calculateBasicImportance(node.type),
        metadata: {
          confidence: 0.5 // 降级方法的置信度较低
        }
      });
    }

    // 递归处理子节点
    if (node.children) {
      for (const child of node.children) {
        this.extractBasicInternalStructures(child, lines, structures);
      }
    }
  }

  /**
   * 提取节点名称
   */
  private extractNodeName(node: Parser.SyntaxNode): string | null {
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

      default:
        // 通用方法：查找第一个标识符子节点
        const identifier = this.findChildByType(node, 'identifier');
        return identifier ? identifier.text : null;
    }
  }

  /**
   * 查找指定类型的子节点
   */
  private findChildByType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
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
   * 将节点类型映射为结构类型
   */
  private mapNodeTypeToStructureType(nodeType: string): string {
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
      'export_statement': 'export',
      'variable_declaration': 'variable',
      'variable_declarator': 'variable',
      'assignment_expression': 'variable',
      'let_declaration': 'variable',
      'const_declaration': 'variable',
      'return_statement': 'return',
      'expression_statement': 'expression',
      'if_statement': 'control-flow',
      'for_statement': 'control-flow',
      'while_statement': 'control-flow',
      'switch_statement': 'control-flow',
      'method_definition': 'method',
      'method_declaration': 'method'
    };

    return typeMap[nodeType] || 'unknown';
  }

  /**
   * 计算基本重要性
   */
  private calculateBasicImportance(nodeType: string): 'low' | 'medium' | 'high' {
    const highImportanceTypes = ['function_declaration', 'function_definition', 'class_declaration', 'method_definition'];
    const mediumImportanceTypes = ['variable_declaration', 'import_statement', 'export_statement'];

    if (highImportanceTypes.includes(nodeType)) {
      return 'high';
    }

    if (mediumImportanceTypes.includes(nodeType)) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
    * 获取性能统计
    */
  getPerformanceStats() {
    return this.performanceMonitor?.getMetrics();
  }
}

