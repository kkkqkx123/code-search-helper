import { TopLevelStructure, NestedStructure, InternalStructure, NestingRelationship, CodeReference, CodeDependency } from '../types/ContentTypes';
import { TextPatternAnalyzer } from './TextPatternAnalyzer';
import { ASTStructureExtractor } from './ASTStructureExtractor';
import { RelationshipAnalyzer } from './RelationshipAnalyzer';
import { TreeSitterService } from '../../service/parser/core/parse/TreeSitterService';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../LoggerService';
import Parser from 'tree-sitter';

/**
 * 内容分析器
 * 负责分析代码内容并提取各种结构信息
 * 重构后使用组合模式，将不同的分析职责委托给专门的工具类
 */
@injectable()
export class ContentAnalyzer {
  private logger = new LoggerService();

  constructor(
    @inject(TYPES.TreeSitterService)
    private readonly treeSitterService: TreeSitterService
  ) {}

  /**
   * 提取顶级结构
   * 优先使用AST分析，如果失败则回退到文本模式匹配
   */
  async extractTopLevelStructures(content: string, language: string): Promise<TopLevelStructure[]> {
    try {
      // 尝试使用AST分析
      if (this.treeSitterService.isInitialized() && this.isLanguageSupported(language)) {
        const parseResult = await this.treeSitterService.parseCode(content, language);
        if (parseResult && parseResult.ast) {
          const astStructures = ASTStructureExtractor.extractTopLevelStructuresFromAST(
            content, 
            language, 
            parseResult.ast
          );
          
          if (astStructures.length > 0) {
            this.logger.debug(`使用AST提取到 ${astStructures.length} 个顶级结构 (${language})`);
            return astStructures;
          }
        }
      }
    } catch (error) {
      this.logger.warn(`AST分析失败，回退到文本模式匹配 (${language}):`, error);
    }

    // 回退到文本模式匹配
    const textStructures = TextPatternAnalyzer.extractTopLevelStructures(content, language);
    this.logger.debug(`使用文本模式匹配提取到 ${textStructures.length} 个顶级结构 (${language})`);
    return textStructures;
  }

  /**
   * 提取嵌套结构
   * 优先使用AST分析，如果失败则回退到文本模式匹配
   */
  async extractNestedStructures(
    content: string, 
    parentNode: any, 
    level: number,
    language: string
  ): Promise<NestedStructure[]> {
    try {
      // 尝试使用AST分析
      if (this.treeSitterService.isInitialized() && this.isLanguageSupported(language)) {
        const parseResult = await this.treeSitterService.parseCode(content, language);
        if (parseResult && parseResult.ast) {
          const astStructures = ASTStructureExtractor.extractNestedStructuresFromAST(
            content,
            parentNode,
            level,
            parseResult.ast
          );
          
          if (astStructures.length > 0) {
            this.logger.debug(`使用AST提取到 ${astStructures.length} 个嵌套结构 (${language})`);
            return astStructures;
          }
        }
      }
    } catch (error) {
      this.logger.warn(`AST分析失败，回退到文本模式匹配 (${language}):`, error);
    }

    // 回退到文本模式匹配
    const textStructures = TextPatternAnalyzer.extractNestedStructures(content, parentNode, level);
    this.logger.debug(`使用文本模式匹配提取到 ${textStructures.length} 个嵌套结构 (${language})`);
    return textStructures;
  }

  /**
   * 提取内部结构
   * 优先使用AST分析，如果失败则回退到文本模式匹配
   */
  async extractInternalStructures(
    content: string,
    parentNode: any,
    language: string
  ): Promise<InternalStructure[]> {
    try {
      // 尝试使用AST分析
      if (this.treeSitterService.isInitialized() && this.isLanguageSupported(language)) {
        const parseResult = await this.treeSitterService.parseCode(content, language);
        if (parseResult && parseResult.ast) {
          const astStructures = ASTStructureExtractor.extractInternalStructuresFromAST(
            content,
            parentNode,
            parseResult.ast
          );
          
          if (astStructures.length > 0) {
            this.logger.debug(`使用AST提取到 ${astStructures.length} 个内部结构 (${language})`);
            return astStructures;
          }
        }
      }
    } catch (error) {
      this.logger.warn(`AST分析失败，回退到文本模式匹配 (${language}):`, error);
    }

    // 回退到文本模式匹配
    const textStructures = TextPatternAnalyzer.extractInternalStructures(content, parentNode);
    this.logger.debug(`使用文本模式匹配提取到 ${textStructures.length} 个内部结构 (${language})`);
    return textStructures;
  }

  /**
   * 分析嵌套关系
   * 委托给RelationshipAnalyzer处理
   */
  analyzeNestingRelationships(nodes: any[]): NestingRelationship[] {
    return RelationshipAnalyzer.analyzeNestingRelationships(nodes);
  }

  /**
   * 分析代码引用关系
   * 委托给RelationshipAnalyzer处理
   */
  analyzeCodeReferences(nodes: any[], content: string): CodeReference[] {
    return RelationshipAnalyzer.analyzeCodeReferences(nodes, content);
  }

  /**
   * 分析代码依赖关系
   * 委托给RelationshipAnalyzer处理
   */
  analyzeCodeDependencies(nodes: any[], content: string): CodeDependency[] {
    return RelationshipAnalyzer.analyzeCodeDependencies(nodes, content);
  }

  /**
   * 分析调用图
   * 委托给RelationshipAnalyzer处理
   */
  analyzeCallGraph(nodes: any[]): Map<string, string[]> {
    return RelationshipAnalyzer.analyzeCallGraph(nodes);
  }

  /**
   * 分析继承层次
   * 委托给RelationshipAnalyzer处理
   */
  analyzeInheritanceHierarchy(nodes: any[]): Map<string, string[]> {
    return RelationshipAnalyzer.analyzeInheritanceHierarchy(nodes);
  }

  /**
   * 分析模块依赖图
   * 委托给RelationshipAnalyzer处理
   */
  analyzeModuleDependencies(nodes: any[], content: string): Map<string, string[]> {
    return RelationshipAnalyzer.analyzeModuleDependencies(nodes, content);
  }

  /**
   * 检查语言是否支持AST分析
   */
  private isLanguageSupported(language: string): boolean {
    const supportedLanguages = this.treeSitterService.getSupportedLanguages();
    return supportedLanguages.some(lang => 
      (typeof lang === 'string' ? lang : lang.name || '').toLowerCase() === language.toLowerCase()
    );
  }

  /**
   * 检测文件语言
   */
  async detectLanguage(filePath: string): Promise<string | null> {
    try {
      const detectedLanguage = await this.treeSitterService.detectLanguage(filePath);
      return detectedLanguage?.name || null;
    } catch (error) {
      this.logger.warn(`语言检测失败 (${filePath}):`, error);
      return null;
    }
  }

  /**
   * 获取支持的编程语言列表
   */
  getSupportedLanguages(): string[] {
    try {
      const languages = this.treeSitterService.getSupportedLanguages();
      return languages.map(lang => typeof lang === 'string' ? lang : lang.name || lang.toString());
    } catch (error) {
      this.logger.error('获取支持的语言列表失败:', error);
      return [];
    }
  }

  /**
   * 分析代码复杂度
   * 基于AST节点分析代码复杂度指标
   */
  async analyzeComplexity(content: string, language: string): Promise<{
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    nestingDepth: number;
    linesOfCode: number;
  }> {
    try {
      if (!this.treeSitterService.isInitialized() || !this.isLanguageSupported(language)) {
        // 回退到简单的文本分析
        return this.analyzeComplexityFromText(content);
      }

      const parseResult = await this.treeSitterService.parseCode(content, language);
      if (!parseResult || !parseResult.ast) {
        return this.analyzeComplexityFromText(content);
      }

      // 基于AST计算复杂度
      const complexity = this.calculateComplexityFromAST(parseResult.ast);
      this.logger.debug(`基于AST计算复杂度 (${language}):`, complexity);
      return complexity;
    } catch (error) {
      this.logger.warn(`复杂度分析失败，使用文本分析 (${language}):`, error);
      return this.analyzeComplexityFromText(content);
    }
  }

  /**
   * 基于AST计算复杂度
   */
  private calculateComplexityFromAST(ast: Parser.SyntaxNode): {
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    nestingDepth: number;
    linesOfCode: number;
  } {
    let cyclomaticComplexity = 1; // 基础复杂度
    let cognitiveComplexity = 0;
    let maxNestingDepth = 0;
    let currentNestingDepth = 0;

    const traverse = (node: Parser.SyntaxNode) => {
      if (!node) return;

      // 计算圈复杂度
      const complexityNodes = [
        'if_statement', 'while_statement', 'for_statement', 
        'switch_statement', 'case', 'catch_clause', 'conditional_expression'
      ];
      
      if (complexityNodes.includes(node.type)) {
        cyclomaticComplexity++;
        cognitiveComplexity++;
      }

      // 计算嵌套深度
      const nestingNodes = [
        'if_statement', 'while_statement', 'for_statement', 
        'switch_statement', 'try_statement', 'catch_clause'
      ];
      
      if (nestingNodes.includes(node.type)) {
        currentNestingDepth++;
        maxNestingDepth = Math.max(maxNestingDepth, currentNestingDepth);
        
        // 递归处理子节点
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            traverse(child);
          }
        }
        
        currentNestingDepth--;
      } else {
        // 递归处理子节点
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) {
            traverse(child);
          }
        }
      }
    };

    traverse(ast);

    const linesOfCode = ast.text ? ast.text.split('\n').length : 0;

    return {
      cyclomaticComplexity,
      cognitiveComplexity,
      nestingDepth: maxNestingDepth,
      linesOfCode
    };
  }

  /**
   * 基于文本分析复杂度（降级方案）
   */
  private analyzeComplexityFromText(content: string): {
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    nestingDepth: number;
    linesOfCode: number;
  } {
    const lines = content.split('\n');
    const linesOfCode = lines.length;
    
    // 简单的文本模式匹配计算复杂度
    const complexityPatterns = [
      /\bif\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?/g  // 三元运算符
    ];

    let cyclomaticComplexity = 1; // 基础复杂度
    complexityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        cyclomaticComplexity += matches.length;
      }
    });

    // 简单的嵌套深度计算
    let maxNestingDepth = 0;
    let currentNestingDepth = 0;
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      // 检查开始嵌套的语句
      if (/\b(if|while|for|switch|try|catch)\b/.test(trimmedLine)) {
        currentNestingDepth++;
        maxNestingDepth = Math.max(maxNestingDepth, currentNestingDepth);
      }
      
      // 简单的结束嵌套检测（不精确，但作为降级方案）
      if (/^\s*}\s*$/.test(trimmedLine)) {
        currentNestingDepth = Math.max(0, currentNestingDepth - 1);
      }
    });

    return {
      cyclomaticComplexity,
      cognitiveComplexity: cyclomaticComplexity, // 简化处理
      nestingDepth: maxNestingDepth,
      linesOfCode
    };
  }

  /**
   * 提取代码摘要
   * 生成代码的简短摘要信息
   */
  async extractCodeSummary(content: string, language: string): Promise<{
    functions: number;
    classes: number;
    imports: number;
    exports: number;
    linesOfCode: number;
    complexity: number;
  }> {
    try {
      const structures = await this.extractTopLevelStructures(content, language);
      const complexity = await this.analyzeComplexity(content, language);
      
      const summary = {
        functions: structures.filter(s => s.type === 'function').length,
        classes: structures.filter(s => s.type === 'class').length,
        imports: structures.filter(s => s.type === 'import').length,
        exports: structures.filter(s => s.type === 'export').length,
        linesOfCode: complexity.linesOfCode,
        complexity: complexity.cyclomaticComplexity
      };

      this.logger.debug(`代码摘要 (${language}):`, summary);
      return summary;
    } catch (error) {
      this.logger.error(`提取代码摘要失败 (${language}):`, error);
      return {
        functions: 0,
        classes: 0,
        imports: 0,
        exports: 0,
        linesOfCode: content.split('\n').length,
        complexity: 1
      };
    }
  }

  /**
   * 验证代码语法
   * 检查代码语法是否正确
   */
  async validateSyntax(content: string, language: string): Promise<{
    isValid: boolean;
    errors: Array<{
      line: number;
      column: number;
      message: string;
    }>;
  }> {
    try {
      if (!this.treeSitterService.isInitialized() || !this.isLanguageSupported(language)) {
        // 无法进行语法验证，假设有效
        return { isValid: true, errors: [] };
      }

      const parseResult = await this.treeSitterService.parseCode(content, language);
      
      if (!parseResult || !parseResult.ast) {
        return { isValid: false, errors: [{ line: 1, column: 1, message: '解析失败' }] };
      }

      // 检查是否有语法错误节点
      const errors = this.extractSyntaxErrors(parseResult.ast);
      
      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      this.logger.warn(`语法验证失败 (${language}):`, error);
      return { 
        isValid: false, 
        errors: [{ line: 1, column: 1, message: '验证过程中发生错误' }] 
      };
    }
  }

  /**
   * 提取语法错误
   */
  private extractSyntaxErrors(ast: Parser.SyntaxNode): Array<{
    line: number;
    column: number;
    message: string;
  }> {
    const errors: Array<{
      line: number;
      column: number;
      message: string;
    }> = [];

    const traverse = (node: Parser.SyntaxNode) => {
      if (!node) return;

      // 检查错误节点
      if (node.type === 'ERROR' || (node as any).isMissing) {
        errors.push({
          line: node.startPosition.row + 1,
          column: node.startPosition.column + 1,
          message: node.type === 'ERROR' ? '语法错误' : '缺少语法元素'
        });
      }

      // 递归处理子节点
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          traverse(child);
        }
      }
    };

    traverse(ast);
    return errors;
  }

  // 静态方法，用于向后兼容
  private static instance: ContentAnalyzer | null = null;

  /**
   * 获取ContentAnalyzer实例（用于静态方法调用）
   */
  private static getInstance(): ContentAnalyzer {
    if (!this.instance) {
      // 创建一个简单的实例，不依赖依赖注入
      this.instance = new ContentAnalyzer(null as any);
    }
    return this.instance;
  }

  /**
   * 静态方法：提取顶级结构
   */
  static async extractTopLevelStructures(content: string, language: string): Promise<TopLevelStructure[]> {
    return this.getInstance().extractTopLevelStructures(content, language);
  }

  /**
   * 静态方法：提取嵌套结构
   */
  static async extractNestedStructures(
    content: string, 
    parentNode: any, 
    level: number,
    ast?: Parser.SyntaxNode,
    language?: string
  ): Promise<NestedStructure[]> {
    // 如果没有提供语言，尝试从内容推断
    if (!language) {
      language = 'typescript'; // 默认语言
    }
    return this.getInstance().extractNestedStructures(content, parentNode, level, language);
  }

  /**
   * 静态方法：检测代码结构
   */
  static detectCodeStructure(content: string): {
    structureCount: number;
    confidence: number;
    structures: Array<{
      type: string;
      name: string;
      location: { startLine: number; endLine: number };
    }>;
  } {
    // 简单的结构检测实现
    const structures: Array<{
      type: string;
      name: string;
      location: { startLine: number; endLine: number };
    }> = [];
    
    const lines = content.split('\n');
    let structureCount = 0;
    let confidence = 0.5; // 默认置信度

    // 检测函数
    const functionRegex = /\b(function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|class\s+\w+|interface\s+\w+)/g;
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const matchText = match[0];
      const lineIndex = content.substring(0, match.index).split('\n').length - 1;
      
      let type = 'unknown';
      let name = 'unknown';
      
      if (matchText.startsWith('function')) {
        type = 'function';
        name = matchText.replace('function ', '').split('(')[0].trim();
      } else if (matchText.startsWith('class')) {
        type = 'class';
        name = matchText.replace('class ', '').trim();
      } else if (matchText.startsWith('interface')) {
        type = 'interface';
        name = matchText.replace('interface ', '').trim();
      } else if (matchText.startsWith('const')) {
        type = 'function';
        name = matchText.split('=')[0].replace('const ', '').trim();
      }
      
      structures.push({
        type,
        name,
        location: { startLine: lineIndex + 1, endLine: lineIndex + 1 }
      });
      
      structureCount++;
    }

    // 根据检测到的结构数量调整置信度
    if (structureCount > 0) {
      confidence = Math.min(0.9, 0.5 + (structureCount * 0.1));
    }

    return {
      structureCount,
      confidence,
      structures
    };
  }
}