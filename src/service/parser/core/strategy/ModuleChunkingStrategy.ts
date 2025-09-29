import Parser from 'tree-sitter';
import { BaseChunkingStrategy, StrategyConfiguration } from './ChunkingStrategy';
import { TreeSitterQueryEngine } from '../query/TreeSitterQueryEngine';
import { LanguageConfigManager } from '../config/LanguageConfigManager';
import { CodeChunk } from '../types';

/**
 * 模块分段策略
 * 专门用于提取和处理模块级别的分段，如导入、导出、命名空间等
 */
export class ModuleChunkingStrategy extends BaseChunkingStrategy {
  readonly name = 'module_chunking';
  readonly priority = 0; // 最高优先级
  readonly description = 'Extract module-level declarations and imports/exports';
  readonly supportedLanguages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'c', 'cpp'];

  private queryEngine: TreeSitterQueryEngine;
  private configManager: LanguageConfigManager;

  constructor(config?: Partial<StrategyConfiguration>) {
    super(config);
    this.queryEngine = new TreeSitterQueryEngine();
    this.configManager = new LanguageConfigManager();
  }

  canHandle(language: string, node: Parser.SyntaxNode): boolean {
    if (!this.supportedLanguages.includes(language)) {
      return false;
    }

    const moduleTypes = this.getModuleTypes(language);
    return moduleTypes.has(node.type);
  }

  chunk(node: Parser.SyntaxNode, content: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    if (this.canHandle(this.detectLanguage(node), node)) {
      const chunk = this.createModuleChunk(node, content);
      if (chunk) {
        chunks.push(chunk);
      }

      // 提取模块内的独立声明
      const declarationChunks = this.extractModuleDeclarations(node, content);
      chunks.push(...declarationChunks);
    }

    return chunks;
  }

  getSupportedNodeTypes(language: string): Set<string> {
    return this.getModuleTypes(language);
  }

  /**
   * 获取特定语言的模块类型
   */
  private getModuleTypes(language: string): Set<string> {
    const typeMap: Record<string, string[]> = {
      typescript: [
        'program',
        'module',
        'namespace_declaration',
        'import_statement',
        'export_statement',
        'ambient_declaration'
      ],
      javascript: [
        'program',
        'import_statement',
        'export_statement'
      ],
      python: [
        'module',
        'import_statement',
        'import_from_statement',
        'future_import_statement'
      ],
      java: [
        'program',
        'package_declaration',
        'import_declaration'
      ],
      go: [
        'source_file',
        'package_clause',
        'import_declaration'
      ],
      rust: [
        'source_file',
        'mod_item',
        'use_declaration',
        'extern_crate'
      ],
      c: [
        'translation_unit',
        'include_directive'
      ],
      cpp: [
        'translation_unit',
        'include_directive',
        'namespace_definition',
        'using_declaration',
        'alias_declaration'
      ]
    };

    return new Set(typeMap[language] || []);
  }

  /**
   * 检测语言
   */
  private detectLanguage(node: Parser.SyntaxNode): string {
    // 简化的语言检测逻辑
    // 实际实现中应该从上下文或其他方式获取语言信息
    return 'typescript'; // 默认值
  }

  /**
   * 创建模块分段
   */
  private createModuleChunk(node: Parser.SyntaxNode, content: string): CodeChunk | null {
    const nodeContent = this.extractNodeContent(node, content);
    const location = this.getNodeLocation(node);

    // 验证分段大小
    if (nodeContent.length < this.config.minChunkSize ||
      nodeContent.length > this.config.maxChunkSize) {
      return null;
    }

    // 提取模块信息
    const moduleName = this.extractModuleName(node, content);
    const imports = this.extractImports(node, content);
    const exports = this.extractExports(node, content);
    const dependencies = this.extractDependencies(node, content);
    const complexity = this.calculateComplexity(nodeContent);

    const chunk: CodeChunk = {
      content: nodeContent,
      metadata: {
        startLine: location.startLine,
        endLine: location.endLine,
        language: this.detectLanguage(node),
        type: 'module',
        moduleName,
        imports,
        exports,
        dependencies,
        complexity,
        isEntryModule: this.isEntryModule(node, content),
        hasSideEffects: this.hasModuleSideEffects(node, content),
        moduleType: this.getModuleType(node),
        directives: this.extractDirectives(node, content)
      }
    };

    return chunk;
  }

  /**
   * 提取模块名称
   */
  private extractModuleName(node: Parser.SyntaxNode, content: string): string {
    const nameNode = node.childForFieldName('name');
    if (nameNode) {
      return this.extractNodeContent(nameNode, content);
    }

    // 处理package声明
    const packageNode = node.childForFieldName('package');
    if (packageNode) {
      return this.extractNodeContent(packageNode, content);
    }

    // 处理namespace声明
    const namespaceNode = node.childForFieldName('namespace');
    if (namespaceNode) {
      return this.extractNodeContent(namespaceNode, content);
    }

    // 从文件路径推断模块名称
    const filePath = this.extractFilePath(node);
    if (filePath) {
      return this.inferModuleNameFromPath(filePath);
    }

    return 'unknown';
  }

  /**
   * 提取导入语句
   */
  private extractImports(node: Parser.SyntaxNode, content: string): string[] {
    const imports: string[] = [];

    // 查找导入节点
    const importNodes = this.findNodesByType(node, this.getImportTypes(this.detectLanguage(node)));
    for (const importNode of importNodes) {
      const importText = this.extractNodeContent(importNode, content);
      if (importText.trim()) {
        imports.push(importText);
      }
    }

    return imports;
  }

  /**
   * 提取导出语句
   */
  private extractExports(node: Parser.SyntaxNode, content: string): string[] {
    const exports: string[] = [];

    // 查找导出节点
    const exportNodes = this.findNodesByType(node, this.getExportTypes(this.detectLanguage(node)));
    for (const exportNode of exportNodes) {
      const exportText = this.extractNodeContent(exportNode, content);
      if (exportText.trim()) {
        exports.push(exportText);
      }
    }

    return exports;
  }

  /**
   * 提取依赖关系
   */
  private extractDependencies(node: Parser.SyntaxNode, content: string): string[] {
    const dependencies: string[] = [];

    // 从导入语句中提取依赖
    const imports = this.extractImports(node, content);
    for (const importStatement of imports) {
      const deps = this.parseDependenciesFromImport(importStatement);
      dependencies.push(...deps);
    }

    // 去重
    return [...new Set(dependencies)];
  }

  /**
   * 从导入语句解析依赖
   */
  private parseDependenciesFromImport(importStatement: string): string[] {
    const dependencies: string[] = [];

    // TypeScript/JavaScript
    const tsJsMatch = importStatement.match(/from\s+['"`]([^'"`]+)['"`]/);
    if (tsJsMatch) {
      dependencies.push(tsJsMatch[1]);
    }

    // Python
    const pythonMatch = importStatement.match(/import\s+(\w+(?:\.\w+)*)/);
    if (pythonMatch) {
      dependencies.push(pythonMatch[1]);
    }

    const pythonFromMatch = importStatement.match(/from\s+(\w+(?:\.\w+)*)\s+import/);
    if (pythonFromMatch) {
      dependencies.push(pythonFromMatch[1]);
    }

    // Java
    const javaMatch = importStatement.match(/import\s+([^;]+);/);
    if (javaMatch) {
      dependencies.push(javaMatch[1].trim());
    }

    // Go
    const goMatch = importStatement.match(/['"`]([^'"`]+)['"`]/);
    if (goMatch) {
      dependencies.push(goMatch[1]);
    }

    // Rust
    const rustMatch = importStatement.match(/use\s+([^;]+);/);
    if (rustMatch) {
      dependencies.push(rustMatch[1].trim());
    }

    // C/C++
    const cMatch = importStatement.match(/#include\s*[<"]([^>"]+)[>"]/);
    if (cMatch) {
      dependencies.push(cMatch[1]);
    }

    return dependencies;
  }

  /**
   * 检查是否为入口模块
   */
  private isEntryModule(node: Parser.SyntaxNode, content: string): boolean {
    // 检查常见的入口模块特征
    const entryPatterns = [
      /main\s*\(/,           // main函数
      /index\./,             // index文件
      /app\./,               // app文件
      /__main__\./,          // Python主模块
      /package\s+main/,      // Go main包
      /int\s+main\s*\(/,     // C/C++ main函数
      /@EntryPoint/          // 自定义注解
    ];

    for (const pattern of entryPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查模块是否有副作用
   */
  private hasModuleSideEffects(node: Parser.SyntaxNode, content: string): boolean {
    const sideEffectPatterns = [
      /\bconsole\./g,
      /\bdocument\./g,
      /\bwindow\./g,
      /\bglobal\./g,
      /\bprocess\./g,
      /\bfs\./g,
      /\brequire\s*\(/g,
      /\bimport\s+.*\s+from/g,
      /\bexport\s+/g,
      /\bmodule\.exports/g,
      /\b__dirname/g,
      /\b__filename/g
    ];

    for (const pattern of sideEffectPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 获取模块类型
   */
  private getModuleType(node: Parser.SyntaxNode): string {
    const nodeType = node.type;

    switch (nodeType) {
      case 'program':
      case 'source_file':
      case 'translation_unit':
        return 'source';
      case 'module':
        return 'module';
      case 'namespace_declaration':
      case 'namespace_definition':
        return 'namespace';
      case 'ambient_declaration':
        return 'ambient';
      default:
        return 'unknown';
    }
  }

  /**
   * 提取指令（如预处理指令、shebang等）
   */
  private extractDirectives(node: Parser.SyntaxNode, content: string): string[] {
    const directives: string[] = [];

    // 查找指令节点
    const directiveNodes = this.findNodesByType(node, this.getDirectiveTypes(this.detectLanguage(node)));
    for (const directiveNode of directiveNodes) {
      const directiveText = this.extractNodeContent(directiveNode, content);
      if (directiveText.trim()) {
        directives.push(directiveText);
      }
    }

    return directives;
  }

  /**
   * 提取模块内的重要声明
   */
  private extractModuleDeclarations(node: Parser.SyntaxNode, content: string): CodeChunk[] {
    const declarationChunks: CodeChunk[] = [];

    // 查找类型声明、接口声明、函数声明等
    const declarationTypes = [
      'type_alias_declaration',
      'interface_declaration',
      'enum_declaration',
      'function_declaration',
      'variable_declaration'
    ];

    for (const declType of declarationTypes) {
      const declNodes = this.findNodesByType(node, [declType]);
      for (const declNode of declNodes) {
        const declContent = this.extractNodeContent(declNode, content);
        const location = this.getNodeLocation(declNode);

        if (declContent.length >= this.config.minChunkSize) {
          const declChunk: CodeChunk = {
            content: declContent,
            metadata: {
              startLine: location.startLine,
              endLine: location.endLine,
              language: this.detectLanguage(node),
              type: 'declaration',
              declarationType: declType,
              complexity: this.calculateComplexity(declContent)
            }
          };

          declarationChunks.push(declChunk);
        }
      }
    }

    return declarationChunks;
  }

  /**
   * 获取导入类型
   */
  private getImportTypes(language: string): string[] {
    const typeMap: Record<string, string[]> = {
      typescript: ['import_statement', 'import_clause'],
      javascript: ['import_statement', 'import_clause'],
      python: ['import_statement', 'import_from_statement', 'future_import_statement'],
      java: ['import_declaration'],
      go: ['import_declaration'],
      rust: ['use_declaration', 'extern_crate'],
      c: ['include_directive'],
      cpp: ['include_directive', 'using_declaration']
    };

    return typeMap[language] || [];
  }

  /**
   * 获取导出类型
   */
  private getExportTypes(language: string): string[] {
    const typeMap: Record<string, string[]> = {
      typescript: ['export_statement', 'export_clause', 'export_default_declaration'],
      javascript: ['export_statement', 'export_clause', 'export_default_declaration'],
      python: [], // Python没有显式的导出语句
      java: [], // Java没有显式的导出语句
      go: [], // Go没有显式的导出语句
      rust: [], // Rust没有显式的导出语句
      c: [], // C没有显式的导出语句
      cpp: [] // C++没有显式的导出语句
    };

    return typeMap[language] || [];
  }

  /**
   * 获取指令类型
   */
  private getDirectiveTypes(language: string): string[] {
    const typeMap: Record<string, string[]> = {
      typescript: [],
      javascript: [],
      python: [],
      java: [],
      go: [],
      rust: [],
      c: ['preproc_include', 'preproc_def', 'preproc_if'],
      cpp: ['preproc_include', 'preproc_def', 'preproc_if']
    };

    return typeMap[language] || [];
  }

  /**
   * 按类型查找节点
   */
  private findNodesByType(node: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];

    const traverse = (currentNode: Parser.SyntaxNode) => {
      if (types.includes(currentNode.type)) {
        nodes.push(currentNode);
      }

      if (currentNode.children && Array.isArray(currentNode.children)) {
        for (const child of currentNode.children) {
          traverse(child);
        }
      }
    };

    traverse(node);
    return nodes;
  }

  /**
   * 提取文件路径
   */
  private extractFilePath(node: Parser.SyntaxNode): string | null {
    // 简化的实现，实际应该从上下文获取
    return null;
  }

  /**
   * 从文件路径推断模块名称
   */
  private inferModuleNameFromPath(filePath: string): string {
    // 移除扩展名
    const name = filePath.replace(/\.[^/.]+$/, '');

    // 获取文件名
    const fileName = name.split('/').pop() || name.split('\\').pop();

    return fileName || 'unknown';
  }

  /**
   * 使用查询引擎提取模块
   */
  async extractModulesUsingQuery(
    ast: Parser.SyntaxNode,
    language: string,
    content: string
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    // 根据语言选择查询模式
    let queryPattern = 'program';
    if (language === 'python') {
      queryPattern = 'module';
    } else if (language === 'java') {
      queryPattern = 'package_declaration';
    } else if (language === 'go') {
      queryPattern = 'package_clause';
    }

    const queryResult = await this.queryEngine.executeQuery(ast, queryPattern, language);

    if (queryResult.success) {
      for (const match of queryResult.matches) {
        const chunk = this.createModuleChunk(match.node, content);
        if (chunk) {
          chunks.push(chunk);
        }
      }
    }

    return chunks;
  }

  /**
   * 优化模块分段
   */
  optimizeModuleChunks(chunks: CodeChunk[]): CodeChunk[] {
    return chunks.filter(chunk => {
      // 过滤掉过小的分段
      if (chunk.content.length < this.config.minChunkSize) {
        return false;
      }

      // 过滤掉过大的分段
      if (chunk.content.length > this.config.maxChunkSize) {
        return false;
      }

      // 过滤掉复杂度过高的分段
      if (chunk.metadata.complexity && chunk.metadata.complexity > 25) {
        return false;
      }

      return true;
    });
  }

  /**
   * 按优先级排序模块
   */
  sortModulesByPriority(chunks: CodeChunk[]): CodeChunk[] {
    return chunks.sort((a, b) => {
      // 入口模块优先级最高
      const aIsEntry = a.metadata.isEntryModule || false;
      const bIsEntry = b.metadata.isEntryModule || false;

      if (aIsEntry !== bIsEntry) {
        return aIsEntry ? -1 : 1;
      }

      // 按模块名称排序
      const aName = a.metadata.moduleName || '';
      const bName = b.metadata.moduleName || '';

      return aName.localeCompare(bName);
    });
  }
}