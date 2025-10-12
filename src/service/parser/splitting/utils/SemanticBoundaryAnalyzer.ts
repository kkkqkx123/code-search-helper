import { BalancedChunker } from '../BalancedChunker';

export interface BoundaryScore {
  score: number; // 0-1之间的分数，越高越适合作为边界
  components: {
    syntactic: boolean;
    semantic: boolean;
    logical: boolean;
    comment: boolean;
 };
}

export interface LanguageWeights {
  syntactic: number;
 function: number;
  class: number;
  method: number;
  import: number;
  logical: number;
  comment: number;
}

export interface PreAnalysisResult {
  boundaryCandidates: Array<{
    line: number;
    score: number;
    properties: any;
  }>;
  estimatedComplexity: number;
}

const LANGUAGE_WEIGHTS: Record<string, LanguageWeights> = {
  typescript: {
    syntactic: 0.8, function: 0.9, class: 0.9, method: 0.8,
    import: 0.7, logical: 0.6, comment: 0.4
  },
  python: {
    syntactic: 0.7, function: 0.9, class: 0.9, method: 0.8,
    import: 0.8, logical: 0.7, comment: 0.5
  },
  javascript: {
    syntactic: 0.8, function: 0.9, class: 0.9, method: 0.8,
    import: 0.7, logical: 0.6, comment: 0.4
  },
  java: {
    syntactic: 0.8, function: 0.9, class: 0.9, method: 0.8,
    import: 0.8, logical: 0.5, comment: 0.4
  },
  go: {
    syntactic: 0.7, function: 0.9, class: 0.7, method: 0.7,
    import: 0.8, logical: 0.6, comment: 0.4
  },
  rust: {
    syntactic: 0.8, function: 0.9, class: 0.7, method: 0.8,
    import: 0.7, logical: 0.6, comment: 0.4
  },
  default: {
    syntactic: 0.7, function: 0.8, class: 0.8, method: 0.7,
    import: 0.7, logical: 0.6, comment: 0.4
  }
};

export class SemanticBoundaryAnalyzer {
  private balancedChunker: BalancedChunker;

  constructor() {
    this.balancedChunker = new BalancedChunker();
  }

  /**
   * 计算行作为分割边界的合适度
   * 返回 0-1 的分数，越高越适合作为边界
   */
  calculateBoundaryScore(line: string, context: string[], language: string): BoundaryScore {
    let score = 0;
    const weights = this.getLanguageSpecificWeights(language);
    
    // 1. 基础语法完整性检查 (权重: 0.3)
    if (this.isSyntacticallySafe(line)) {
      score += weights.syntactic * 0.3;
    }
    
    // 2. 语义边界检查 (权重: 0.4)
    if (this.isFunctionEnd(line)) score += weights.function * 0.4;
    if (this.isClassEnd(line)) score += weights.class * 0.4;
    if (this.isMethodEnd(line)) score += weights.method * 0.35;
    if (this.isImportEnd(line)) score += weights.import * 0.2;
    
    // 3. 逻辑分组检查 (权重: 0.2)
    if (this.isEmptyLine(line) && this.hasLogicalSeparation(context)) {
      score += weights.logical * 0.2;
    }
    
    // 4. 注释边界检查 (权重: 0.1)
    if (this.isCommentBlockEnd(line)) score += weights.comment * 0.1;
    
    return {
      score: Math.min(score, 1.0),
      components: {
        syntactic: this.isSyntacticallySafe(line),
        semantic: this.isSemanticBoundary(line),
        logical: this.isLogicalBoundary(line, context),
        comment: this.isCommentBoundary(line)
      }
    };
  }

  private getLanguageSpecificWeights(language: string): LanguageWeights {
    return LANGUAGE_WEIGHTS[language] || LANGUAGE_WEIGHTS.default;
  }

  private isSyntacticallySafe(line: string): boolean {
    // 检查是否有完整的语法结构，例如闭合的括号、花括号等
    const trimmedLine = line.trim();
    if (!trimmedLine) return true;
    
    // 使用balanced chunker来检查符号平衡
    const originalState = this.balancedChunker.getCurrentState();
    this.balancedChunker.analyzeLineSymbols(trimmedLine);
    const isBalanced = this.balancedChunker.canSafelySplit();
    this.balancedChunker.setCurrentState(originalState);
    return isBalanced;
  }

  private isFunctionEnd(line: string): boolean {
    const trimmedLine = line.trim();
    // 检查是否是函数结束的大括号
    return /^\s*}\s*(\/\/.*)?$/.test(trimmedLine) || 
           /^\s*}\s*;?\s*$/.test(trimmedLine) ||
           /.*=>\s*\{.*\}\s*;?$/.test(line) ||  // 箭头函数
           /.*function.*\)\s*\{.*\}\s*;?$/.test(line); // 内联函数
  }

 private isClassEnd(line: string): boolean {
    const trimmedLine = line.trim();
    return /^\s*}\s*(\/\/.*)?$/.test(trimmedLine) || 
           /^\s*}\s*;?\s*$/.test(trimmedLine);
  }

  private isMethodEnd(line: string): boolean {
    const trimmedLine = line.trim();
    return /^\s*}\s*(\/\/.*)?$/.test(trimmedLine);
  }

  private isImportEnd(line: string): boolean {
    const trimmedLine = line.trim();
    // 检查是否是导入语句
    return /^import\s+.*$/.test(trimmedLine) || 
           /^from\s+.*$/.test(trimmedLine) ||
           /^export\s+.*$/.test(trimmedLine);
  }

  private isEmptyLine(line: string): boolean {
    return line.trim() === '';
  }

  private hasLogicalSeparation(context: string[]): boolean {
    // 检查上下文中的逻辑分离
    if (context.length < 2) return false;
    
    // 检查前后是否有相关的函数、类或语句
    const prevLine = context[context.length - 2] || '';
    const nextLine = context[context.length - 1] || '';
    
    return this.isFunctionStart(prevLine) || this.isClassStart(prevLine) || 
           this.isFunctionStart(nextLine) || this.isClassStart(nextLine);
  }

  private isFunctionStart(line: string): boolean {
    const trimmedLine = line.trim();
    return /^function\s+\w+\s*\(/.test(trimmedLine) ||
           /^\w+\s*=\s*\([^)]*\)\s*=>/.test(trimmedLine) ||
           /^\w+\s*\([^)]*\)\s*:\s*\w+\s*=>/.test(trimmedLine) ||
           /^.*=>\s*[^{]/.test(trimmedLine) ||
           /^\s*async\s+function/.test(trimmedLine) ||
           /^\s*static\s+\w+\s*\(/.test(trimmedLine) ||
           /^\s*\w+\s*\([^)]*\)\s*\{/.test(trimmedLine); // method declaration
  }

  private isClassStart(line: string): boolean {
    const trimmedLine = line.trim();
    return /^class\s+\w+/.test(trimmedLine) ||
           /^export\s+default\s+class/.test(trimmedLine) ||
           /^export\s+class/.test(trimmedLine);
  }

  private isCommentBlockEnd(line: string): boolean {
    const trimmedLine = line.trim();
    return /^\/\/.*$/.test(trimmedLine) ||
           /^\s*\*\s.*$/.test(trimmedLine) || // JSDoc-style comment
           /^\/\*.*\*\/$/.test(trimmedLine);    // Inline block comment
  }

  private isSemanticBoundary(line: string): boolean {
    return this.isFunctionEnd(line) || 
           this.isClassEnd(line) || 
           this.isMethodEnd(line) || 
           this.isImportEnd(line);
  }

 private isLogicalBoundary(line: string, context: string[]): boolean {
    return this.isEmptyLine(line) && this.hasLogicalSeparation(context);
  }

  private isCommentBoundary(line: string): boolean {
    return this.isCommentBlockEnd(line);
 }
}