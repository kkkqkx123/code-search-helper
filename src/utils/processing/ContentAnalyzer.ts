/**
 * 内容分析工具类
 * 统一内容分析逻辑，支持分层提取架构
 */

import { LineLocation } from './validation/ValidationUtils';
import { BracketCounter, BracketCountResult } from '../structure/BracketCounter';

/**
 * 结构检测结果接口
 */
export interface StructureDetectionResult {
  /** 检测到的结构类型 */
  structureTypes: string[];
  /** 结构数量 */
  structureCount: number;
  /** 详细信息 */
  details: {
    functions?: number;
    classes?: number;
    imports?: number;
    exports?: number;
    comments?: number;
    blocks?: number;
  };
  /** 置信度 */
  confidence: number;
}

/**
 * 结构详情类型
 */
type StructureDetails = {
  functions?: number;
  classes?: number;
  imports?: number;
  exports?: number;
  comments?: number;
  blocks?: number;
};

/**
 * 括号计数接口
 */
export interface BracketCount {
  /** 开括号数量 */
  open: number;
  /** 闭括号数量 */
  close: number;
  /** 是否平衡 */
  balanced: boolean;
  /** 嵌套深度 */
  depth: number;
}

/**
 * XML标签接口
 */
export interface XmlTag {
  /** 标签名 */
  name: string;
  /** 是否为闭合标签 */
  isClosing: boolean;
  /** 是否为自闭合标签 */
  isSelfClosing: boolean;
  /** 属性 */
  attributes: Record<string, string>;
  /** 位置 */
  position: {
    start: number;
    end: number;
  };
}

/**
 * Markdown结构结果接口
 */
export interface MarkdownStructureResult {
  /** 标题数量 */
  headings: Array<{
    level: number;
    text: string;
    line: number;
  }>;
  /** 代码块数量 */
  codeBlocks: number;
  /** 表格数量 */
  tables: number;
  /** 列表数量 */
  lists: number;
  /** 链接数量 */
  links: number;
}

/**
 * 分割标准接口
 */
export interface SplitCriteria {
  /** 最大块大小 */
  maxChunkSize: number;
  /** 最小块大小 */
  minChunkSize: number;
  /** 优先语义边界 */
  preferSemanticBoundaries: boolean;
  /** 最大重叠 */
  maxOverlap: number;
}

/**
 * HTML标签分析接口
 */
export interface HtmlTagAnalysis {
  /** 标签统计 */
  tagStats: Record<string, number>;
  /** 嵌套深度 */
  maxDepth: number;
  /** 自闭合标签数量 */
  selfClosingCount: number;
  /** 脚本标签数量 */
  scriptCount: number;
  /** 样式标签数量 */
  styleCount: number;
}

/**
 * 顶级结构接口
 */
export interface TopLevelStructure {
  /** 结构类型 */
  type: string;
  /** 名称 */
  name: string;
  /** 内容 */
  content: string;
  /** 位置 */
  location: LineLocation;
  /** AST节点 */
  node: any;
  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * 嵌套结构接口
 */
export interface NestedStructure {
  /** 结构类型 */
  type: string;
  /** 名称 */
  name: string;
  /** 内容 */
  content: string;
  /** 位置 */
  location: LineLocation;
  /** 父节点 */
  parentNode: any;
  /** 嵌套级别 */
  level: number;
  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * 内部结构接口
 */
export interface InternalStructure {
  /** 结构类型 */
  type: string;
  /** 名称 */
  name?: string;
  /** 内容 */
  content: string;
  /** 位置 */
  location: LineLocation;
  /** 父节点 */
  parentNode: any;
  /** 重要性 */
  importance: 'high' | 'medium' | 'low';
  /** 元数据 */
  metadata: Record<string, any>;
}

/**
 * 嵌套关系接口
 */
export interface NestingRelationship {
  /** 父节点 */
  parent: any;
  /** 子节点 */
  child: any;
  /** 关系类型 */
  relationshipType: 'contains' | 'extends' | 'implements' | 'uses';
  /** 强度 */
  strength: number;
}

/**
 * 语义边界接口
 */
export interface SemanticBoundary {
  /** 边界类型 */
  type: string;
  /** 起始位置 */
  start: LineLocation;
  /** 结束位置 */
  end: LineLocation;
  /** 置信度 */
  confidence: number;
  /** 描述 */
  description?: string;
}

/**
 * 内容分析器类
 */
export class ContentAnalyzer {
  /**
   * 检测代码结构
   */
  static detectCodeStructure(content: string): StructureDetectionResult {
    const structureTypes: string[] = [];
    const details: StructureDetails = {};

    // 检测函数
    const functionMatches = content.match(/\b(function|func|def)\s+\w+/g);
    if (functionMatches) {
      structureTypes.push('functions');
      details.functions = functionMatches.length;
    }

    // 检测类
    const classMatches = content.match(/\b(class|interface|struct)\s+\w+/g);
    if (classMatches) {
      structureTypes.push('classes');
      details.classes = classMatches.length;
    }

    // 检测导入
    const importMatches = content.match(/\b(import|include|using)\s+/g);
    if (importMatches) {
      structureTypes.push('imports');
      details.imports = importMatches.length;
    }

    // 检测导出
    const exportMatches = content.match(/\b(export|module\.exports)\b/g);
    if (exportMatches) {
      structureTypes.push('exports');
      details.exports = exportMatches.length;
    }

    // 检测注释
    const commentMatches = content.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm);
    if (commentMatches) {
      structureTypes.push('comments');
      details.comments = commentMatches.length;
    }

    // 检测代码块
    const blockMatches = content.match(/\{[^}]*\}/g);
    if (blockMatches) {
      structureTypes.push('blocks');
      details.blocks = blockMatches.length;
    }

    // 计算置信度
    const totalStructures = Object.values(details).reduce((sum: number, count: number | undefined) => sum + (count ?? 0), 0);
    const confidence = Math.min(1, totalStructures / 10);

    return {
      structureTypes,
      structureCount: totalStructures,
      details,
      confidence
    };
  }

  /**
   * 计算括号数量（直接使用 BracketCounter）
   */
  static countBrackets(line: string): BracketCount {
    const result = BracketCounter.countCurlyBrackets(line);
    return {
      open: result.open,
      close: result.close,
      balanced: result.balanced,
      depth: result.depth
    };
  }

  /**
   * 提取XML标签
   */
  static extractXmlTags(line: string): XmlTag[] {
    const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g;
    const tags: XmlTag[] = [];
    let match;

    while ((match = tagPattern.exec(line)) !== null) {
      const fullTag = match[0];
      const tagName = match[1];
      const attributesStr = match[2];

      const isClosing = fullTag.startsWith('</');
      const isSelfClosing = fullTag.endsWith('/>');

      // 解析属性
      const attributes: Record<string, string> = {};
      const attrPattern = /(\w+)=["']([^"']*)["']/g;
      let attrMatch;

      while ((attrMatch = attrPattern.exec(attributesStr)) !== null) {
        attributes[attrMatch[1]] = attrMatch[2];
      }

      tags.push({
        name: tagName,
        isClosing,
        isSelfClosing,
        attributes,
        position: {
          start: match.index,
          end: match.index + fullTag.length
        }
      });
    }

    return tags;
  }

  /**
   * 检测Markdown结构
   */
  static detectMarkdownStructure(content: string): MarkdownStructureResult {
    const lines = content.split('\n');
    const result: MarkdownStructureResult = {
      headings: [],
      codeBlocks: 0,
      tables: 0,
      lists: 0,
      links: 0
    };

    let inCodeBlock = false;

    lines.forEach((line, index) => {
      // 检测标题
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        result.headings.push({
          level: headingMatch[1].length,
          text: headingMatch[2].trim(),
          line: index + 1
        });
      }

      // 检测代码块
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
        } else {
          inCodeBlock = false;
          result.codeBlocks++;
        }
      }

      // 检测表格
      if (line.includes('|')) {
        const columns = line.split('|').filter(col => col.trim() !== '');
        if (columns.length >= 2) {
          result.tables++;
        }
      }

      // 检测列表
      if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        result.lists++;
      }

      // 检测链接
      if (/\[.*\]\(.*\)/.test(line)) {
        result.links++;
      }
    });

    return result;
  }

  /**
   * 查找最佳分割点
   */
  static findOptimalSplitPoints(lines: string[], criteria: SplitCriteria): number[] {
    const splitPoints: number[] = [];
    let currentSize = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentSize += line.length + 1; // +1 for newline

      // 检查是否需要分割
      if (currentSize >= criteria.maxChunkSize) {
        // 寻找语义边界
        if (criteria.preferSemanticBoundaries) {
          const boundaryPoint = this.findSemanticBoundary(lines, i, criteria);
          if (boundaryPoint !== -1) {
            splitPoints.push(boundaryPoint);
            currentSize = this.calculateSizeFromPoint(lines, boundaryPoint + 1, i);
            continue;
          }
        }

        // 如果没有找到语义边界，直接分割
        splitPoints.push(i);
        currentSize = 0;
      }
    }

    return splitPoints;
  }

  /**
   * 分析HTML标签
   */
  static analyzeHtmlTags(content: string): HtmlTagAnalysis {
    const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
    const tagStats: Record<string, number> = {};
    let maxDepth = 0;
    let currentDepth = 0;
    let selfClosingCount = 0;
    let scriptCount = 0;
    let styleCount = 0;

    let match;
    while ((match = tagPattern.exec(content)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();

      // 统计标签
      tagStats[tagName] = (tagStats[tagName] || 0) + 1;

      // 计算嵌套深度
      if (fullTag.startsWith('</')) {
        currentDepth--;
      } else {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
        
        if (fullTag.endsWith('/>')) {
          selfClosingCount++;
          currentDepth--; // 自闭合标签不增加深度
        }
      }

      // 统计特殊标签
      if (tagName === 'script') scriptCount++;
      if (tagName === 'style') styleCount++;
    }

    return {
      tagStats,
      maxDepth,
      selfClosingCount,
      scriptCount,
      styleCount
    };
  }

  /**
   * 提取顶级结构
   */
  static extractTopLevelStructures(content: string, language: string): TopLevelStructure[] {
    const structures: TopLevelStructure[] = [];
    const lines = content.split('\n');

    // 根据语言定义不同的模式
    const patterns = this.getLanguagePatterns(language);

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern.regex);
      
      for (const match of matches) {
        const startLine = this.getLineNumber(content, match.index!);
        const endLine = this.findStructureEnd(content, startLine, pattern.type);
        
        structures.push({
          type: pattern.type,
          name: this.extractName(match, pattern.type),
          content: lines.slice(startLine - 1, endLine).join('\n'),
          location: {
            startLine,
            endLine
          },
          node: null, // 在实际实现中应该包含AST节点
          metadata: {
            language,
            confidence: pattern.confidence || 0.8
          }
        });
      }
    }

    return structures;
  }

  /**
   * 提取嵌套结构
   */
  static extractNestedStructures(content: string, parentNode: any, level: number): NestedStructure[] {
    const structures: NestedStructure[] = [];
    
    // 在实际实现中，这里应该分析AST节点
    // 简化实现，基于文本模式匹配
    const patterns = [
      { type: 'method', regex: /\b(function|def|func)\s+(\w+)\s*\([^)]*\)/g },
      { type: 'nested_class', regex: /\b(class|struct)\s+(\w+)/g },
      { type: 'nested_function', regex: /\b(function|def|func)\s+(\w+)\s*\([^)]*\)/g }
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern.regex);
      
      for (const match of matches) {
        const startLine = this.getLineNumber(content, match.index!);
        const endLine = this.findStructureEnd(content, startLine, pattern.type);
        
        structures.push({
          type: pattern.type,
          name: match[2] || 'unknown',
          content: content.split('\n').slice(startLine - 1, endLine).join('\n'),
          location: {
            startLine,
            endLine
          },
          parentNode,
          level,
          metadata: {
            nestingLevel: level,
            confidence: 0.7
          }
        });
      }
    }

    return structures;
  }

  /**
   * 提取内部结构
   */
  static extractInternalStructures(content: string, parentNode: any): InternalStructure[] {
    const structures: InternalStructure[] = [];
    const lines = content.split('\n');

    // 提取重要变量声明
    const variablePattern = /\b(const|let|var)\s+(\w+)\s*=\s*([^;]+)/g;
    let match;
    
    while ((match = variablePattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);
      
      structures.push({
        type: 'variable',
        name: match[2],
        content: match[0],
        location: {
          startLine: lineNum,
          endLine: lineNum
        },
        parentNode,
        importance: 'medium',
        metadata: {
          variableType: match[1],
          confidence: 0.8
        }
      });
    }

    // 提取控制流结构
    const controlFlowPatterns = [
      { type: 'if', regex: /\bif\s*\([^)]+\)/g, importance: 'high' as const },
      { type: 'for', regex: /\bfor\s*\([^)]+\)/g, importance: 'high' as const },
      { type: 'while', regex: /\bwhile\s*\([^)]+\)/g, importance: 'high' as const },
      { type: 'switch', regex: /\bswitch\s*\([^)]+\)/g, importance: 'high' as const }
    ];

    for (const pattern of controlFlowPatterns) {
      const matches = content.matchAll(pattern.regex);
      
      for (const match of matches) {
        const lineNum = this.getLineNumber(content, match.index!);
        
        structures.push({
          type: pattern.type,
          content: match[0],
          location: {
            startLine: lineNum,
            endLine: lineNum
          },
          parentNode,
          importance: pattern.importance,
          metadata: {
            confidence: 0.9
          }
        });
      }
    }

    return structures;
  }

  /**
   * 分析嵌套关系
   */
  static analyzeNestingRelationships(nodes: any[]): NestingRelationship[] {
    const relationships: NestingRelationship[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        // 检查包含关系
        if (this.isNodeContaining(node1, node2)) {
          relationships.push({
            parent: node1,
            child: node2,
            relationshipType: 'contains',
            strength: this.calculateRelationshipStrength(node1, node2)
          });
        }

        // 检查继承关系
        if (this.isInheritanceRelationship(node1, node2)) {
          relationships.push({
            parent: node2,
            child: node1,
            relationshipType: 'extends',
            strength: 0.9
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 检测语义边界
   */
  static detectSemanticBoundaries(content: string, language: string): SemanticBoundary[] {
    const boundaries: SemanticBoundary[] = [];
    const lines = content.split('\n');

    // 根据语言检测不同的语义边界
    const patterns = this.getSemanticBoundaryPatterns(language);

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern.regex);
      
      for (const match of matches) {
        const startLine = this.getLineNumber(content, match.index!);
        const endLine = this.findBoundaryEnd(content, startLine, pattern.type);
        
        boundaries.push({
          type: pattern.type,
          start: { startLine, endLine: startLine },
          end: { startLine: endLine, endLine },
          confidence: pattern.confidence || 0.8,
          description: pattern.description
        });
      }
    }

    return boundaries;
  }

  // 私有辅助方法

  /**
   * 获取语言模式
   */
  private static getLanguagePatterns(language: string): Array<{
    type: string;
    regex: RegExp;
    confidence?: number;
  }> {
    const commonPatterns = [
      { type: 'function', regex: /\b(function|def|func)\s+(\w+)\s*\([^)]*\)/g },
      { type: 'class', regex: /\b(class|interface|struct)\s+(\w+)/g },
      { type: 'namespace', regex: /\b(namespace|module|package)\s+(\w+)/g },
      { type: 'import', regex: /\b(import|include|using)\s+[^;]+/g }
    ];

    // 语言特定模式
    const languageSpecific: Record<string, any> = {
      javascript: [
        { type: 'arrow_function', regex: /\bconst\s+(\w+)\s*=\s*\([^)]*\)\s*=>/g },
        { type: 'class', regex: /\bclass\s+(\w+)/g }
      ],
      python: [
        { type: 'function', regex: /\bdef\s+(\w+)\s*\([^)]*\):/g },
        { type: 'class', regex: /\bclass\s+(\w+):/g },
        { type: 'decorator', regex: /@\w+/g }
      ],
      cpp: [
        { type: 'template', regex: /\btemplate\s*<[^>]*>/g },
        { type: 'namespace', regex: /\bnamespace\s+(\w+)/g }
      ]
    };

    return [...commonPatterns, ...(languageSpecific[language] || [])];
  }

  /**
   * 获取语义边界模式
   */
  private static getSemanticBoundaryPatterns(language: string): Array<{
    type: string;
    regex: RegExp;
    confidence?: number;
    description?: string;
  }> {
    return [
      {
        type: 'function',
        regex: /\b(function|def|func)\s+\w+\s*\([^)]*\)\s*[:{]/g,
        confidence: 0.9,
        description: 'Function definition'
      },
      {
        type: 'class',
        regex: /\b(class|interface|struct)\s+\w+/g,
        confidence: 0.9,
        description: 'Class definition'
      },
      {
        type: 'block',
        regex: /\{[^}]*\}/g,
        confidence: 0.7,
        description: 'Code block'
      }
    ];
  }

  /**
   * 获取行号
   */
  private static getLineNumber(content: string, index: number): number {
    const before = content.substring(0, index);
    return before.split('\n').length;
  }

  /**
   * 查找结构结束位置
   */
  private static findStructureEnd(content: string, startLine: number, type: string): number {
    const lines = content.split('\n');
    let braceCount = 0;
    let inBlock = false;

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];
      
      if (type === 'function' || type === 'class' || type === 'namespace') {
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        
        braceCount += openBraces - closeBraces;
        
        if (braceCount > 0) inBlock = true;
        if (inBlock && braceCount === 0) return i + 1;
      }
    }

    return lines.length;
  }

  /**
   * 提取名称
   */
  private static extractName(match: RegExpMatchArray, type: string): string {
    if (match.length >= 3) {
      return match[2];
    }
    return 'unknown';
  }

  /**
   * 查找语义边界
   */
  private static findSemanticBoundary(lines: string[], currentIndex: number, criteria: SplitCriteria): number {
    // 向前查找语义边界
    for (let i = currentIndex; i >= Math.max(0, currentIndex - 10); i--) {
      const line = lines[i];
      
      // 检查是否为语义边界
      if (this.isSemanticBoundary(line)) {
        return i;
      }
    }
    
    return -1;
  }

  /**
   * 检查是否为语义边界
   */
  private static isSemanticBoundary(line: string): boolean {
    const boundaryPatterns = [
      /^\s*\}/,                    // 块结束
      /^\s*(function|def|class)/,  // 函数或类开始
      /^\s*(if|for|while|switch)/, // 控制流开始
      /^\s*\/\/.*$/,               // 注释行
      /^\s*$/                      // 空行
    ];
    
    return boundaryPatterns.some(pattern => pattern.test(line));
  }

  /**
   * 从指定点计算大小
   */
  private static calculateSizeFromPoint(lines: string[], startPoint: number, endPoint: number): number {
    let size = 0;
    for (let i = startPoint; i <= endPoint && i < lines.length; i++) {
      size += lines[i].length + 1; // +1 for newline
    }
    return size;
  }

  /**
   * 检查节点包含关系
   */
  private static isNodeContaining(node1: any, node2: any): boolean {
    if (!node1.location || !node2.location) return false;
    
    return node1.location.startLine <= node2.location.startLine &&
           node1.location.endLine >= node2.location.endLine;
  }

  /**
   * 检查继承关系
   */
  private static isInheritanceRelationship(node1: any, node2: any): boolean {
    // 简化实现，实际应该分析AST
    return node1.type === 'class' && node2.type === 'class' &&
           node1.content.includes(`extends ${node2.name}`);
  }

  /**
   * 计算关系强度
   */
  private static calculateRelationshipStrength(node1: any, node2: any): number {
    // 基于包含程度计算关系强度
    if (!node1.location || !node2.location) return 0;
    
    const parentSize = node1.location.endLine - node1.location.startLine + 1;
    const childSize = node2.location.endLine - node2.location.startLine + 1;
    
    return Math.min(1, childSize / parentSize);
  }

  /**
   * 查找边界结束位置
   */
  private static findBoundaryEnd(content: string, startLine: number, type: string): number {
    // 简化实现，返回下一行
    return startLine + 1;
  }
}