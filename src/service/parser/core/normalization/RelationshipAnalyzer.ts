import { NestingRelationship, CodeReference, CodeDependency } from '../../../../utils/types/ContentTypes';
import { QueryResultNormalizer } from './QueryResultNormalizer';
import { TreeSitterCoreService } from '../parse/TreeSitterCoreService';
import { LRUCache } from '../../../../utils/cache/LRUCache';
import { ContentHashUtils } from '../../../../utils/cache/ContentHashUtils';
import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';
import { LoggerService } from '../../../../utils/LoggerService';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../../../types';
import Parser from 'tree-sitter';
import { InfrastructureConfigService } from '../../../../infrastructure/config/InfrastructureConfigService';
import { StandardizedQueryResult } from './types';
import { LineLocation } from '../../../../utils/types/ContentTypes';

/**
 * 关系分析器
 * 基于normalization系统分析代码结构之间的各种关系
 */
@injectable()
export class RelationshipAnalyzer {
  private logger = new LoggerService();
  private cache: LRUCache<string, any>;
  private performanceMonitor: PerformanceMonitor;

  constructor(
    @inject(TYPES.QueryResultNormalizer)
    private readonly queryNormalizer: QueryResultNormalizer,
    @inject(TYPES.TreeSitterCoreService)
    private readonly treeSitterService: TreeSitterCoreService,
    @inject(TYPES.InfrastructureConfigService)
    private readonly configService: InfrastructureConfigService
  ) {
    this.cache = new LRUCache(100); // 缓存100个结果
    this.performanceMonitor = new PerformanceMonitor(this.logger, this.configService);
  }

  /**
   * 分析嵌套关系
   * 基于AST节点分析代码结构之间的嵌套关系
   */
  async analyzeNestingRelationships(
    content: string,
    language: string,
    ast: Parser.SyntaxNode
  ): Promise<NestingRelationship[]> {
    const cacheKey = `nesting:${language}:${this.hashContent(content)}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`使用缓存的嵌套关系分析结果 (${language})`);
      return cached;
    }

    return this.measureAsync('analyzeNestingRelationships', async () => {
      try {
         // 使用normalization系统获取标准化结果
         const normalizedResults = await this.queryNormalizer.normalize(
          ast,
          language
        );
         
         // 将标准化结果转换为预期格式
         const normalizedResult = this.convertNormalizedResults(normalizedResults);

        if (!normalizedResult || !normalizedResult.structures) {
          this.logger.warn(`标准化结果为空，使用基础分析 (${language})`);
          return this.analyzeNestingRelationshipsBasic(ast, content);
        }

        const relationships: NestingRelationship[] = [];
        const structures = normalizedResult.structures;

        // 分析包含关系
        for (let i = 0; i < structures.length; i++) {
          for (let j = i + 1; j < structures.length; j++) {
            const struct1 = structures[i];
            const struct2 = structures[j];

            if (this.isStructureContaining(struct1, struct2)) {
              relationships.push({
                parent: this.createLegacyNodeFromStandardized(struct1),
                child: this.createLegacyNodeFromStandardized(struct2),
                relationshipType: 'contains',
                strength: this.calculateRelationshipStrength(struct1, struct2)
              });
            }
          }
        }

        // 分析继承关系
        for (const struct of structures) {
          const inheritance = await this.analyzeInheritance(struct, language);
          relationships.push(...inheritance);
        }

        // 分析实现关系
        for (const struct of structures) {
          const implementations = await this.analyzeImplementation(struct, language);
          relationships.push(...implementations);
        }

        // 缓存结果
        this.cache.set(cacheKey, relationships);
        this.logger.debug(`分析到 ${relationships.length} 个嵌套关系 (${language})`);

        return relationships;
      } catch (error) {
        this.logger.warn(`嵌套关系分析失败，使用基础分析 (${language}):`, error);
        return this.analyzeNestingRelationshipsBasic(ast, content);
      }
    });
  }

  /**
   * 分析代码引用关系
   * 基于AST分析函数调用、变量引用等关系
   */
  async analyzeCodeReferences(
    content: string,
    language: string,
    ast: Parser.SyntaxNode
  ): Promise<CodeReference[]> {
    const cacheKey = `references:${language}:${this.hashContent(content)}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`使用缓存的引用关系分析结果 (${language})`);
      return cached;
    }

    return this.measureAsync('analyzeCodeReferences', async () => {
      try {
         // 使用normalization系统获取标准化结果
         const normalizedResults = await this.queryNormalizer.normalize(
          ast,
          language
        );
         
         // 将标准化结果转换为预期格式
         const normalizedResult = this.convertNormalizedResults(normalizedResults);

        if (!normalizedResult || !normalizedResult.references) {
          this.logger.warn(`标准化结果为空，使用基础引用分析 (${language})`);
          return this.analyzeCodeReferencesBasic(ast, content);
        }

        const references: CodeReference[] = [];

        // 转换标准化引用结果
        for (const ref of normalizedResult.references) {
          references.push({
            fromNode: this.createLegacyNodeFromStandardized(ref.from),
            toNode: this.createLegacyNodeFromStandardized(ref.to),
            referenceType: ref.type as any,
            line: ref.location?.startLine || 0,
            confidence: ref.confidence || 0.8
          });
        }

        // 缓存结果
        this.cache.set(cacheKey, references);
        this.logger.debug(`分析到 ${references.length} 个代码引用 (${language})`);

        return references;
      } catch (error) {
        this.logger.warn(`代码引用分析失败，使用基础分析 (${language}):`, error);
        return this.analyzeCodeReferencesBasic(ast, content);
      }
    });
  }

  /**
   * 分析代码依赖关系
   * 分析模块导入、包依赖等关系
   */
  async analyzeCodeDependencies(
    content: string,
    language: string,
    ast: Parser.SyntaxNode
  ): Promise<CodeDependency[]> {
    const cacheKey = `dependencies:${language}:${this.hashContent(content)}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`使用缓存的依赖关系分析结果 (${language})`);
      return cached;
    }

    return this.measureAsync('analyzeCodeDependencies', async () => {
      try {
         // 使用normalization系统获取标准化结果
         const normalizedResults = await this.queryNormalizer.normalize(
          ast,
          language
        );
         
         // 将标准化结果转换为预期格式
         const normalizedResult = this.convertNormalizedResults(normalizedResults);

        if (!normalizedResult || !normalizedResult.dependencies) {
          this.logger.warn(`标准化结果为空，使用基础依赖分析 (${language})`);
          return this.analyzeCodeDependenciesBasic(content, language);
        }

        const dependencies: CodeDependency[] = [];

        // 转换标准化依赖结果
        for (const dep of normalizedResult.dependencies) {
          dependencies.push({
            fromNode: this.createLegacyNodeFromStandardized(dep.from),
            dependencyType: dep.type as any,
            target: dep.target,
            line: dep.location?.startLine || 0,
            confidence: dep.confidence || 0.9
          });
        }

        // 缓存结果
        this.cache.set(cacheKey, dependencies);
        this.logger.debug(`分析到 ${dependencies.length} 个代码依赖 (${language})`);

        return dependencies;
      } catch (error) {
        this.logger.warn(`代码依赖分析失败，使用基础分析 (${language}):`, error);
        return this.analyzeCodeDependenciesBasic(content, language);
      }
    });
  }

  /**
   * 分析调用图
   * 构建函数调用关系图
   */
  async analyzeCallGraph(
    content: string,
    language: string,
    ast: Parser.SyntaxNode
  ): Promise<Map<string, string[]>> {
    const cacheKey = `callgraph:${language}:${this.hashContent(content)}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`使用缓存的调用图分析结果 (${language})`);
      return cached;
    }

    return this.measureAsync('analyzeCallGraph', async () => {
      try {
         const references = await this.analyzeCodeReferences(content, language, ast);
        const callGraph = new Map<string, string[]>();

        // 筛选函数调用引用
        const functionCalls = references.filter(ref => ref.referenceType === 'function_call');

        for (const call of functionCalls) {
          const fromFunction = call.fromNode?.name || 'unknown';
          const toFunction = call.toNode?.name || call.toNode?.name || 'unknown';

          if (!callGraph.has(fromFunction)) {
            callGraph.set(fromFunction, []);
          }
          callGraph.get(fromFunction)!.push(toFunction);
        }

        // 缓存结果
        this.cache.set(cacheKey, callGraph);
        this.logger.debug(`构建调用图，包含 ${callGraph.size} 个函数 (${language})`);

        return callGraph;
      } catch (error) {
        this.logger.warn(`调用图分析失败 (${language}):`, error);
        return new Map();
      }
    });
  }

  /**
   * 分析继承层次
   * 构建类继承关系图
   */
  async analyzeInheritanceHierarchy(
    content: string,
    language: string,
    ast: Parser.SyntaxNode
  ): Promise<Map<string, string[]>> {
    const cacheKey = `inheritance:${language}:${this.hashContent(content)}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`使用缓存的继承层次分析结果 (${language})`);
      return cached;
    }

    return this.measureAsync('analyzeInheritanceHierarchy', async () => {
      try {
         const relationships = await this.analyzeNestingRelationships(content, language, ast);
        const hierarchy = new Map<string, string[]>();

        // 筛选继承关系
        const inheritanceRelationships = relationships.filter(rel => rel.relationshipType === 'extends');

        for (const rel of inheritanceRelationships) {
          const child = rel.child?.name || 'unknown';
          const parent = rel.parent?.name || 'unknown';

          if (!hierarchy.has(child)) {
            hierarchy.set(child, []);
          }
          hierarchy.get(child)!.push(parent);
        }

        // 缓存结果
        this.cache.set(cacheKey, hierarchy);
        this.logger.debug(`构建继承层次，包含 ${hierarchy.size} 个类 (${language})`);

        return hierarchy;
      } catch (error) {
        this.logger.warn(`继承层次分析失败 (${language}):`, error);
        return new Map();
      }
    });
  }

  /**
   * 分析模块依赖图
   * 构建模块依赖关系
   */
  async analyzeModuleDependencies(
    content: string,
    language: string,
    ast: Parser.SyntaxNode
  ): Promise<Map<string, string[]>> {
    const cacheKey = `moduledeps:${language}:${this.hashContent(content)}`;

    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`使用缓存的模块依赖分析结果 (${language})`);
      return cached;
    }

    return this.measureAsync('analyzeModuleDependencies', async () => {
      try {
         const dependencies = await this.analyzeCodeDependencies(content, language, ast);
        const moduleDeps = new Map<string, string[]>();

        // 筛选导入依赖
        const importDependencies = dependencies.filter(dep => dep.dependencyType === 'import');

        for (const dep of importDependencies) {
          const fromModule = dep.fromNode?.name || 'root';
          const targetModule = dep.target;

          if (!moduleDeps.has(fromModule)) {
            moduleDeps.set(fromModule, []);
          }
          moduleDeps.get(fromModule)!.push(targetModule);
        }

        // 缓存结果
        this.cache.set(cacheKey, moduleDeps);
        this.logger.debug(`构建模块依赖图，包含 ${moduleDeps.size} 个模块 (${language})`);

        return moduleDeps;
      } catch (error) {
        this.logger.warn(`模块依赖分析失败 (${language}):`, error);
        return new Map();
      }
    });
  }

  /**
   * 基础嵌套关系分析（降级方案）
   */
  private analyzeNestingRelationshipsBasic(ast: Parser.SyntaxNode, content: string): NestingRelationship[] {
    const relationships: NestingRelationship[] = [];
    const nodes = this.extractAllNodes(ast);

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        if (this.isNodeContaining(node1, node2)) {
          relationships.push({
            parent: this.createLegacyNodeFromStandardized(node1),
            child: this.createLegacyNodeFromStandardized(node2),
            relationshipType: 'contains',
            strength: this.calculateRelationshipStrength(node1, node2)
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 基础代码引用分析（降级方案）
   */
  private analyzeCodeReferencesBasic(ast: Parser.SyntaxNode, content: string): CodeReference[] {
    const references: CodeReference[] = [];
    const nodes = this.extractAllNodes(ast);

    for (const node of nodes) {
      // 分析函数调用
      const functionCalls = this.extractFunctionCalls(node);
      for (const call of functionCalls) {
        references.push({
          fromNode: this.createLegacyNodeFromStandardized(node),
          toNode: this.findReferencedNode(call.name, nodes),
          referenceType: 'function_call',
          line: call.line,
          confidence: 0.8
        });
      }

      // 分析变量引用
      const variableRefs = this.extractVariableReferences(node);
      for (const ref of variableRefs) {
        references.push({
          fromNode: this.createLegacyNodeFromStandardized(node),
          toNode: this.findReferencedNode(ref.name, nodes),
          referenceType: 'variable_reference',
          line: ref.line,
          confidence: 0.7
        });
      }
    }

    return references;
  }

  /**
   * 基础代码依赖分析（降级方案）
   */
  private analyzeCodeDependenciesBasic(content: string, language: string): CodeDependency[] {
    const dependencies: CodeDependency[] = [];
    const imports = this.extractImportStatements(content, language);

    for (const importStmt of imports) {
      dependencies.push({
        fromNode: { name: 'root', type: 'module', location: { startLine: importStmt.line, endLine: importStmt.line } },
        dependencyType: 'import',
        target: importStmt.module,
        line: importStmt.line,
        confidence: 0.95
      });
    }

    return dependencies;
  }

  /**
    * 分析继承关系
    */
  private async analyzeInheritance(struct: any, language: string): Promise<NestingRelationship[]> {
    const relationships: NestingRelationship[] = [];

    try {
      // 简单的继承关系分析（基于结构名称模式）
      // 实际项目中应该使用树形语法信息进行更精确的分析
      if (struct.metadata && struct.metadata.parent) {
        relationships.push({
          parent: this.createLegacyNodeFromStandardized(struct.metadata.parent),
          child: this.createLegacyNodeFromStandardized(struct),
          relationshipType: 'extends',
          strength: 0.9
        });
      }
    } catch (error) {
      this.logger.warn(`继承关系分析失败 (${language}):`, error);
    }

    return relationships;
  }

  /**
    * 分析实现关系
    */
  private async analyzeImplementation(struct: any, language: string): Promise<NestingRelationship[]> {
    const relationships: NestingRelationship[] = [];

    try {
      // 简单的实现关系分析（基于结构元数据）
      // 实际项目中应该使用树形语法信息进行更精确的分析
      if (struct.metadata && struct.metadata.interfaces && Array.isArray(struct.metadata.interfaces)) {
        for (const iface of struct.metadata.interfaces) {
          relationships.push({
            parent: this.createLegacyNodeFromStandardized(iface),
            child: this.createLegacyNodeFromStandardized(struct),
            relationshipType: 'implements',
            strength: 0.85
          });
        }
      }
    } catch (error) {
      this.logger.warn(`实现关系分析失败 (${language}):`, error);
    }

    return relationships;
  }

  /**
   * 检查结构是否包含另一个结构
   */
  private isStructureContaining(struct1: any, struct2: any): boolean {
    if (!struct1.location || !struct2.location) return false;

    const loc1 = struct1.location;
    const loc2 = struct2.location;

    return (
      loc1.startLine <= loc2.startLine &&
      loc1.endLine >= loc2.endLine &&
      (loc1.startLine < loc2.startLine || loc1.startColumn <= loc2.startColumn) &&
      (loc1.endLine > loc2.endLine || loc1.endColumn >= loc2.endColumn)
    );
  }

  /**
   * 检查节点是否包含另一个节点
   */
  private isNodeContaining(node1: any, node2: any): boolean {
    if (!node1.node || !node2.node) return false;

    const n1 = node1.node;
    const n2 = node2.node;

    const n1Start = n1.startPosition;
    const n1End = n1.endPosition;
    const n2Start = n2.startPosition;
    const n2End = n2.endPosition;

    return (
      n1Start.row <= n2Start.row &&
      n1End.row >= n2End.row &&
      (n1Start.row < n2Start.row || n1Start.column <= n2Start.column) &&
      (n1End.row > n2End.row || n1End.column >= n2End.column)
    );
  }

  /**
   * 计算关系强度
   */
  private calculateRelationshipStrength(struct1: any, struct2: any): number {
    if (!struct1.location || !struct2.location) return 0;

    const loc1 = struct1.location;
    const loc2 = struct2.location;

    // 基于距离计算强度
    const distance = Math.abs(
      (loc1.startLine - loc2.startLine) + (loc1.startColumn - loc2.startColumn)
    );

    // 距离越近，关系越强
    return Math.max(0.1, 1.0 - (distance / 1000));
  }

  /**
   * 提取所有节点
   */
  private extractAllNodes(ast: Parser.SyntaxNode): any[] {
    const nodes: any[] = [];

    const traverse = (node: Parser.SyntaxNode) => {
      if (!node) return;

      // 只提取重要节点
      const importantTypes = [
        'function_declaration', 'class_declaration', 'interface_declaration',
        'method_definition', 'variable_declaration', 'import_statement'
      ];

      if (importantTypes.includes(node.type)) {
        nodes.push({
          name: this.extractNodeName(node),
          type: node.type,
          node: node,
          location: {
            startLine: node.startPosition.row + 1,
            endLine: node.endPosition.row + 1,
            startColumn: node.startPosition.column + 1,
            endColumn: node.endPosition.column + 1
          }
        });
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
   * 提取函数调用
   */
  private extractFunctionCalls(node: any): Array<{ name: string, line: number }> {
    const calls: Array<{ name: string, line: number }> = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (!n) return;

      if (n.type === 'call_expression') {
        const functionNode = this.findChildByType(n, 'identifier');
        if (functionNode) {
          calls.push({
            name: functionNode.text,
            line: n.startPosition.row + 1
          });
        }
      }

      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) {
          traverse(child);
        }
      }
    };

    traverse(node.node);
    return calls;
  }

  /**
   * 提取变量引用
   */
  private extractVariableReferences(node: any): Array<{ name: string, line: number }> {
    const refs: Array<{ name: string, line: number }> = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (!n) return;

      if (n.type === 'identifier') {
        // 检查是否是变量引用（不是声明）
        const parent = n.parent;
        if (parent && !['function_declaration', 'variable_declaration', 'parameter'].includes(parent.type)) {
          refs.push({
            name: n.text,
            line: n.startPosition.row + 1
          });
        }
      }

      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) {
          traverse(child);
        }
      }
    };

    traverse(node.node);
    return refs;
  }

  /**
   * 提取导入语句
   */
  private extractImportStatements(content: string, language: string): Array<{ module: string, line: number }> {
    const imports: Array<{ module: string, line: number }> = [];
    const lines = content.split('\n');

    // 根据语言定义不同的导入模式
    const patterns = {
      javascript: /^import\s+.*?from\s+['"]([^'"]+)['"]/,
      typescript: /^import\s+.*?from\s+['"]([^'"]+)['"]/,
      python: /^(?:from\s+(\S+)\s+)?import\s+(.+)/,
      java: /^import\s+([\w.]+);/,
      go: /^import\s+['"]([^'"]+)['"]/
    };

    const pattern = patterns[language as keyof typeof patterns] || patterns.javascript;

    lines.forEach((line, index) => {
      const match = line.match(pattern);
      if (match) {
        const module = language === 'python' ? (match[1] || match[2].split('.')[0]) : match[1];
        imports.push({ module, line: index + 1 });
      }
    });

    return imports;
  }

  /**
   * 查找被引用的节点
   */
  private findReferencedNode(name: string, nodes: any[]): any | null {
    for (const node of nodes) {
      if (node.name === name) {
        return node;
      }
    }
    return null;
  }

  /**
   * 从节点提取名称
   */
  private extractNodeName(node: Parser.SyntaxNode): string | null {
    if (!node) return null;

    const identifier = this.findChildByType(node, 'identifier');
    return identifier ? identifier.text : null;
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
   * 从标准化结果创建旧版节点格式
   */
  private createLegacyNodeFromStandardized(struct: StandardizedQueryResult | any): any {
    if (!struct) return null;

    // 如果已经是标准化查询结果格式，直接使用其字段
    if (this.isStandardizedQueryResult(struct)) {
      return {
        name: struct.name || 'unknown',
        type: struct.type || 'unknown',
        location: {
          startLine: struct.startLine || 0,
          endLine: struct.endLine || 0
        } as LineLocation,
        node: null, // StandardizedQueryResult没有node字段，所以这里为null
        metadata: struct.metadata || {}
      };
    }

    // 否则使用原来的转换逻辑
    return {
      name: struct.name || 'unknown',
      type: struct.type || 'unknown',
      location: struct.location || { startLine: 0, endLine: 0 } as LineLocation,
      node: struct.node || null,
      metadata: struct.metadata || {}
    };
  }

  /**
   * 检查对象是否为StandardizedQueryResult类型
   */
  private isStandardizedQueryResult(obj: any): obj is StandardizedQueryResult {
    return obj && 
           typeof obj === 'object' && 
           obj.nodeId !== undefined && 
           obj.name !== undefined && 
           obj.type !== undefined && 
           obj.startLine !== undefined && 
           obj.endLine !== undefined;
  }

  /**
   * 内容哈希方法
   */
  private hashContent(content: string): string {
   return ContentHashUtils.generateContentHash(content);
  }

  /**
    * 获取缓存统计
    */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
    * 获取性能统计
    */
  getPerformanceStats() {
    return this.performanceMonitor.getAllOperationStats();
  }

  /**
    * 清除缓存
    */
  clearCache() {
    this.cache.clear();
    this.logger.debug('关系分析器缓存已清除');
  }

  /**
   * 执行异步操作并记录性能
   */
  private async measureAsync<T>(operationName: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.performanceMonitor.recordOperation(operationName, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.performanceMonitor.recordOperation(operationName, duration);
      throw error;
    }
  }

  /**
   * 将标准化结果转换为预期格式
   */
  private convertNormalizedResults(results: any[]): { structures?: any[], references?: any[], dependencies?: any[] } {
    if (!results || !Array.isArray(results)) {
      return { structures: [], references: [], dependencies: [] };
    }

    // 按类型分类结果
    const structures: any[] = [];
    const references: any[] = [];
    const dependencies: any[] = [];

    for (const result of results) {
      if (result.type === 'import' || result.type === 'require') {
        dependencies.push(result);
      } else if (['function', 'class', 'interface', 'type', 'variable'].includes(result.type)) {
        structures.push(result);
      } else if (result.type === 'reference') {
        references.push(result);
      }
    }

    return { structures, references, dependencies };
  }
}