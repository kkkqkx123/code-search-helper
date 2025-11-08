/**
 * 复杂度计算工具类
 * 统一各种内容类型的复杂度计算逻辑
 */

import { ChunkType } from '../../service/parser/processing/types/CodeChunk';

/**
 * 复杂度计算配置接口
 */
export interface ComplexityConfig {
  /** 基础复杂度权重 */
  baseWeight?: number;
  /** 关键字权重 */
  keywordWeight?: number;
  /** 结构权重 */
  structureWeight?: number;
  /** 长度权重 */
  lengthWeight?: number;
}

/**
 * 代码复杂度计算配置
 */
export interface CodeComplexityConfig extends ComplexityConfig {
  /** 控制流关键字权重 */
  controlFlowWeight?: number;
  /** 函数/类关键字权重 */
  functionClassWeight?: number;
  /** 括号权重 */
  bracketWeight?: number;
  /** 圆括号权重 */
  bracketParenWeight?: number;
}

/**
 * Markdown复杂度计算配置
 */
export interface MarkdownComplexityConfig extends ComplexityConfig {
  /** 标题权重 */
  headingWeight?: number;
  /** 代码块权重 */
  codeBlockWeight?: number;
  /** 表格权重 */
  tableWeight?: number;
  /** 列表权重 */
  listWeight?: number;
}

/**
 * XML复杂度计算配置
 */
export interface XmlComplexityConfig extends ComplexityConfig {
  /** 标签权重 */
  tagWeight?: number;
  /** 属性权重 */
  attributeWeight?: number;
  /** 嵌套深度权重 */
  depthWeight?: number;
}

/**
 * 复杂度计算结果
 */
export interface ComplexityResult {
  /** 复杂度分数 */
  score: number;
  /** 详细分析 */
  analysis: {
    /** 关键字数量 */
    keywordCount: number;
    /** 结构元素数量 */
    structureCount: number;
    /** 内容长度 */
    contentLength: number;
    /** 行数 */
    lineCount: number;
    /** 其他指标 */
    [key: string]: number;
  };
}

/**
 * 复杂度计算器
 */
export class ComplexityCalculator {
  /**
   * 计算代码复杂度
   * 基于代码结构、关键字、括号和行数计算
   */
  static calculateCodeComplexity(content: string, config: CodeComplexityConfig = {}): ComplexityResult {
    const {
      controlFlowWeight = 2,
      functionClassWeight = 3,
      bracketWeight = 1,
      bracketParenWeight = 0.5,
      lengthWeight = 2
    } = config;

    let complexity = 0;
    const analysis: any = {};

    // 基于控制流关键字计算复杂度
    const controlFlowMatches = content.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/g) || [];
    analysis.controlFlowCount = controlFlowMatches.length;
    complexity += controlFlowMatches.length * controlFlowWeight;

    // 基于函数/类关键字计算复杂度
    const functionClassMatches = content.match(/\b(function|method|class|interface)\b/g) || [];
    analysis.functionClassCount = functionClassMatches.length;
    complexity += functionClassMatches.length * functionClassWeight;

    // 基于括号计算复杂度
    const bracketMatches = content.match(/[{}]/g) || [];
    analysis.bracketCount = bracketMatches.length;
    complexity += bracketMatches.length * bracketWeight;

    // 基于圆括号计算复杂度
    const parenMatches = content.match(/[()]/g) || [];
    analysis.parenCount = parenMatches.length;
    complexity += parenMatches.length * bracketParenWeight;

    // 基于代码长度调整
    const lines = content.split('\n');
    analysis.lineCount = lines.length;
    analysis.contentLength = content.length;
    complexity += Math.log10(lines.length + 1) * lengthWeight;

    return {
      score: Math.round(complexity),
      analysis
    };
  }

  /**
   * 计算Markdown复杂度
   * 基于Markdown特有结构计算
   */
  static calculateMarkdownComplexity(content: string, config: MarkdownComplexityConfig = {}): ComplexityResult {
    const {
      headingWeight = 2,
      codeBlockWeight = 3,
      tableWeight = 0.5,
      listWeight = 1,
      lengthWeight = 2
    } = config;

    let complexity = 0;
    const analysis: any = {};

    // 基于内容长度计算基础复杂度
    analysis.contentLength = content.length;
    complexity += content.length * 0.01;

    // 基于标题计算复杂度
    const headingMatches = content.match(/^#{1,6}\s+/gm) || [];
    analysis.headingCount = headingMatches.length;
    complexity += headingMatches.length * headingWeight;

    // 基于代码块计算复杂度
    const codeBlockMatches = content.match(/```/g) || [];
    analysis.codeBlockCount = codeBlockMatches.length / 2; // 每对```算一个代码块
    complexity += analysis.codeBlockCount * codeBlockWeight;

    // 基于表格计算复杂度
    const tableMatches = content.match(/\|/g) || [];
    analysis.tableCellCount = tableMatches.length;
    complexity += tableMatches.length * tableWeight;

    // 基于列表计算复杂度
    const listMatches = content.match(/^[-*+]\s+/gm) || [];
    analysis.listCount = listMatches.length;
    complexity += listMatches.length * listWeight;

    // 基于行数调整
    const lines = content.split('\n');
    analysis.lineCount = lines.length;
    complexity += Math.log10(lines.length + 1) * lengthWeight;

    return {
      score: Math.round(complexity),
      analysis
    };
  }

  /**
   * 计算XML复杂度
   * 基于标签、属性和嵌套深度计算
   */
  static calculateXmlComplexity(content: string, config: XmlComplexityConfig = {}): ComplexityResult {
    const {
      tagWeight = 2,
      attributeWeight = 1,
      depthWeight = 3,
      lengthWeight = 2
    } = config;

    let complexity = 0;
    const analysis: any = {};

    // 基于标签数量计算复杂度
    const tagMatches = content.match(/<\/?[^>]+>/g) || [];
    analysis.tagCount = tagMatches.length;
    complexity += tagMatches.length * tagWeight;

    // 基于属性数量计算复杂度
    const attributeMatches = content.match(/\w+\s*=\s*["'][^"']*["']/g) || [];
    analysis.attributeCount = attributeMatches.length;
    complexity += attributeMatches.length * attributeWeight;

    // 基于嵌套深度计算复杂度
    const openTags = content.match(/<[^\/][^>]*>/g) || [];
    const closeTags = content.match(/<\/[^>]*>/g) || [];
    let maxDepth = 0;
    let currentDepth = 0;

    // 简化的深度计算
    for (const tag of content.split('\n')) {
      const openCount = (tag.match(/<[^\/][^>]*>/g) || []).length;
      const closeCount = (tag.match(/<\/[^>]*>/g) || []).length;
      currentDepth += openCount - closeCount;
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    analysis.maxDepth = maxDepth;
    complexity += maxDepth * depthWeight;

    // 基于内容长度调整
    const lines = content.split('\n');
    analysis.lineCount = lines.length;
    analysis.contentLength = content.length;
    complexity += Math.log10(lines.length + 1) * lengthWeight;

    return {
      score: Math.round(complexity),
      analysis
    };
  }

  /**
   * 计算HTML复杂度
   * 简化的HTML复杂度计算
   */
  static calculateHtmlComplexity(content: string, config: ComplexityConfig = {}): ComplexityResult {
    const { lengthWeight = 1 } = config;

    let complexity = 1; // 基础复杂度
    const analysis: any = {};

    // 基于长度
    analysis.contentLength = content.length;
    complexity += Math.log10(content.length + 1);

    // 基于行数
    const lines = content.split('\n');
    analysis.lineCount = lines.length;
    complexity += Math.log10(lines.length + 1);

    // 基于关键字数量（简单实现）
    const keywords = content.match(/\b(function|class|const|let|var|if|for|while|return|import|export)\b/g);
    if (keywords) {
      analysis.keywordCount = keywords.length;
      complexity += keywords.length * 0.5;
    }

    complexity += Math.log10(lines.length + 1) * lengthWeight;

    return {
      score: Math.round(Math.max(1, complexity)),
      analysis
    };
  }

  /**
   * 计算通用复杂度
   * 适用于未知或混合内容类型
   */
  static calculateGenericComplexity(content: string, config: ComplexityConfig = {}): ComplexityResult {
    const { baseWeight = 1, lengthWeight = 2 } = config;

    let complexity = baseWeight;
    const analysis: any = {};

    // 基于内容长度
    analysis.contentLength = content.length;
    complexity += Math.log10(content.length + 1);

    // 基于行数
    const lines = content.split('\n');
    analysis.lineCount = lines.length;
    complexity += Math.log10(lines.length + 1) * lengthWeight;

    // 基于字符多样性
    const uniqueChars = new Set(content).size;
    analysis.uniqueCharCount = uniqueChars;
    complexity += Math.log10(uniqueChars + 1) * 0.5;

    return {
      score: Math.round(Math.max(1, complexity)),
      analysis
    };
  }

  /**
   * 根据块类型自动选择合适的复杂度计算方法
   */
  static calculateComplexityByType(content: string, chunkType: ChunkType, config?: any): ComplexityResult {
    switch (chunkType) {
      case ChunkType.FUNCTION:
      case ChunkType.CLASS:
      case ChunkType.METHOD:
      case ChunkType.INTERFACE:
      case ChunkType.BLOCK:
        return this.calculateCodeComplexity(content, config);
      
      case ChunkType.DOCUMENTATION:
        return this.calculateMarkdownComplexity(content, config);
      
      case ChunkType.TYPE:
        return this.calculateCodeComplexity(content, config);
      
      default:
        return this.calculateGenericComplexity(content, config);
    }
  }

  /**
   * 批量计算复杂度
   */
  static calculateBatchComplexity(contents: string[], chunkType: ChunkType, config?: any): ComplexityResult[] {
    return contents.map(content => this.calculateComplexityByType(content, chunkType, config));
  }

  /**
   * 比较两个内容的复杂度
   */
  static compareComplexity(content1: string, content2: string, chunkType?: ChunkType): {
    content1: ComplexityResult;
    content2: ComplexityResult;
    moreComplex: 'content1' | 'content2' | 'equal';
    difference: number;
  } {
    const type1 = chunkType || ChunkType.GENERIC;
    const type2 = chunkType || ChunkType.GENERIC;
    
    const result1 = this.calculateComplexityByType(content1, type1);
    const result2 = this.calculateComplexityByType(content2, type2);
    
    const difference = Math.abs(result1.score - result2.score);
    const moreComplex = result1.score > result2.score ? 'content1' : 
                       result1.score < result2.score ? 'content2' : 'equal';
    
    return {
      content1: result1,
      content2: result2,
      moreComplex,
      difference
    };
  }
}