import { CodeChunk, CodeChunkMetadata } from '../../../splitting';

export interface OverlapResult {
  content: string;
  lines: number;
  strategy: 'semantic' | 'syntactic' | 'size-based' | 'hybrid';
  quality: number;
}

export interface ChunkRelationship {
  type: 'sequential_functions' | 'class_methods' | 'related_imports' | 'function_calls' | 'none';
  similarity: number;
  context: string;
}

export interface ContextAnalysisResult {
  relationship: ChunkRelationship;
  contextLines: string[];
  keyIdentifiers: string[];
}

export class ContextAwareOverlapOptimizer {
  /**
   * 根据上下文优化重叠内容
   */
  optimizeOverlapForContext(
    overlap: OverlapResult,
    currentChunk: CodeChunk,
    nextChunk: CodeChunk
  ): OverlapResult {
    // 分析当前块和下一块的关系
    const relationship = this.analyzeChunkRelationship(currentChunk, nextChunk);

    switch (relationship.type) {
      case 'sequential_functions':
        return this.optimizeForSequentialFunctions(overlap, currentChunk, nextChunk);
      case 'class_methods':
        return this.optimizeForClassMethods(overlap, currentChunk, nextChunk);
      case 'related_imports':
        return this.optimizeForRelatedImports(overlap, currentChunk, nextChunk);
      case 'function_calls':
        return this.optimizeForFunctionCalls(overlap, currentChunk, nextChunk);
      default:
        return this.optimizeForGenericContext(overlap, currentChunk, nextChunk);
    }
  }

  /**
   * 分析块之间的关系
   */
  private analyzeChunkRelationship(currentChunk: CodeChunk, nextChunk: CodeChunk): ChunkRelationship {
    const currentLines = currentChunk.content.split('\n');
    const nextLines = nextChunk.content.split('\n');

    // 检查是否是连续的函数定义
    if (this.isSequentialFunctions(currentLines, nextLines, currentChunk, nextChunk)) {
      return {
        type: 'sequential_functions',
        similarity: 0.9,
        context: 'Sequential function definitions'
      };
    }

    // 检查是否是类方法
    if (this.isClassMethods(currentLines, nextLines, currentChunk, nextChunk)) {
      return {
        type: 'class_methods',
        similarity: 0.8,
        context: 'Class methods in the same class'
      };
    }

    // 检查是否是相关的导入语句
    if (this.isRelatedImports(currentLines, nextLines)) {
      return {
        type: 'related_imports',
        similarity: 0.7,
        context: 'Related import statements'
      };
    }

    // 检查是否是函数调用关系
    if (this.isFunctionCalls(currentLines, nextLines)) {
      return {
        type: 'function_calls',
        similarity: 0.8,
        context: 'Function definition and usage'
      };
    }

    return {
      type: 'none',
      similarity: 0,
      context: 'No specific relationship'
    };
  }

  private isSequentialFunctions(currentLines: string[], nextLines: string[], currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    // 检查当前块是否以函数结束，下一块是否以函数开始
    const lastLineOfCurrent = currentLines[currentLines.length - 1]?.trim() || '';
    const firstLineOfNext = nextLines[0]?.trim() || '';

    // 检查当前块是否以函数体结束（大括号）
    const isCurrentEndFunction = lastLineOfCurrent === '}' || lastLineOfCurrent === '};';

    // 检查下一块是否以函数定义开始
    const isNextStartFunction = /^function\s+\w+\s*\(/.test(firstLineOfNext) ||
      /^\w+\s*=\s*\([^)]*\)\s*=>/.test(firstLineOfNext) ||
      /^\s*\w+\s*\([^)]*\)\s*:\s*\w+\s*=>/.test(firstLineOfNext) ||
      /^\s*\w+\s*:\s*\([^)]*\)\s*=>/.test(firstLineOfNext);

    // 检查语言是否支持这种模式
    return isCurrentEndFunction && isNextStartFunction &&
      (currentChunk.metadata.language === 'typescript' ||
        currentChunk.metadata.language === 'javascript' ||
        currentChunk.metadata.language === 'python' ||
        currentChunk.metadata.language === 'java');
  }

  private isClassMethods(currentLines: string[], nextLines: string[], currentChunk: CodeChunk, nextChunk: CodeChunk): boolean {
    // 检查是否在同一类中定义的方法
    const firstLineOfNext = nextLines[0]?.trim() || '';

    // 检查下一块是否是方法定义
    const isMethodDefinition = /^\s*(async\s+)?\w+\s*\([^)]*\)\s*\{/.test(firstLineOfNext) ||
      /^\s*(async\s+)?\w+\s*:\s*\([^)]*\)\s*=>/.test(firstLineOfNext) ||
      /^\s*(public|private|protected)\s+\w+\s*\([^)]*\)\s*\{/.test(firstLineOfNext);

    return isMethodDefinition &&
      (currentChunk.metadata.language === 'typescript' ||
        currentChunk.metadata.language === 'javascript' ||
        currentChunk.metadata.language === 'java' ||
        currentChunk.metadata.language === 'python');
  }

  private isRelatedImports(currentLines: string[], nextLines: string[]): boolean {
    // 检查两块是否都包含导入语句
    const currentHasImport = currentLines.some(line =>
      /^import\s+/.test(line.trim()) || /^from\s+/.test(line.trim())
    );

    const nextHasImport = nextLines.some(line =>
      /^import\s+/.test(line.trim()) || /^from\s+/.test(line.trim())
    );

    return currentHasImport && nextHasImport;
  }

  private isFunctionCalls(currentLines: string[], nextLines: string[]): boolean {
    // 检查是否存在函数定义和调用的关系
    const functionNames = this.extractFunctionNames(currentLines);
    const callNames = this.extractFunctionCalls(nextLines);

    // 检查是否有函数名在定义和调用之间匹配
    return functionNames.some(fn => callNames.includes(fn));
  }

  private extractFunctionNames(lines: string[]): string[] {
    const names: string[] = [];
    for (const line of lines) {
      const trimmedLine = line.trim();

      // 匹配各种函数定义模式
      const functionMatch = trimmedLine.match(/(?:function\s+|const\s+\w+\s*=\s*|let\s+\w+\s*=\s*|var\s+\w+\s*=\s*)(\w+)(?=\s*\()/);
      if (functionMatch) {
        names.push(functionMatch[1]);
      }

      // 匹配箭头函数
      const arrowFunctionMatch = trimmedLine.match(/(\w+)\s*=\s*\([^)]*\)\s*=>/);
      if (arrowFunctionMatch) {
        names.push(arrowFunctionMatch[1]);
      }
    }
    return names;
  }

  private extractFunctionCalls(lines: string[]): string[] {
    const names: string[] = [];
    for (const line of lines) {
      // 匹配函数调用模式
      const callMatches = line.match(/(\w+)\s*\(/g);
      if (callMatches) {
        for (const match of callMatches) {
          const name = match.replace(/\s*\(/, '');
          names.push(name);
        }
      }
    }
    return names;
  }

  /**
   * 为连续函数优化重叠
   */
  private optimizeForSequentialFunctions(overlap: OverlapResult, currentChunk: CodeChunk, nextChunk: CodeChunk): OverlapResult {
    // 对于连续函数，保留函数签名和导入语句
    const lines = overlap.content.split('\n');
    const optimizedLines: string[] = [];

    for (const line of lines) {
      // 保留函数签名、导入语句和类型定义
      if (this.isFunctionSignature(line) ||
        this.isImportStatement(line) ||
        this.isTypeDefinition(line) ||
        this.isVariableDeclaration(line) ||
        this.isFunctionEnd(line)) { // 添加对函数结束符的处理
        optimizedLines.push(line);
      }
    }

    return {
      ...overlap,
      content: optimizedLines.join('\n'),
      lines: optimizedLines.length,
      quality: Math.min(overlap.quality + 0.1, 1.0) // 提高质量评分
    };
  }

  /**
   * 为类方法优化重叠
   */
  private optimizeForClassMethods(overlap: OverlapResult, currentChunk: CodeChunk, nextChunk: CodeChunk): OverlapResult {
    // 对于类方法，保留类声明和方法签名
    const lines = overlap.content.split('\n');
    const optimizedLines: string[] = [];

    let inClass = false;
    for (const line of lines) {
      if (/^class\s+\w+/.test(line.trim())) {
        inClass = true;
        optimizedLines.push(line);
      } else if (inClass && this.isMethodSignature(line)) {
        optimizedLines.push(line);
      } else if (inClass && this.isClassProperty(line)) {
        optimizedLines.push(line);
      } else if (/^}$/.test(line.trim())) {
        inClass = false;
        optimizedLines.push(line);
      } else if (!inClass) {
        // 保留非类相关的有用上下文
        if (this.isImportStatement(line) || this.isTypeDefinition(line)) {
          optimizedLines.push(line);
        }
      }
    }

    return {
      ...overlap,
      content: optimizedLines.join('\n'),
      lines: optimizedLines.length,
      quality: Math.min(overlap.quality + 0.1, 1.0) // 提高质量评分
    };
  }

  /**
   * 为相关导入优化重叠
   */
  private optimizeForRelatedImports(overlap: OverlapResult, currentChunk: CodeChunk, nextChunk: CodeChunk): OverlapResult {
    // 对于导入语句，保留所有导入行
    const lines = overlap.content.split('\n');
    const optimizedLines = lines.filter(line => this.isImportStatement(line));

    return {
      ...overlap,
      content: optimizedLines.join('\n'),
      lines: optimizedLines.length,
      quality: Math.min(overlap.quality + 0.05, 1.0) // 略微提高质量评分
    };
  }

  /**
   * 为函数调用关系优化重叠
   */
  private optimizeForFunctionCalls(overlap: OverlapResult, currentChunk: CodeChunk, nextChunk: CodeChunk): OverlapResult {
    // 对于函数定义和使用，保留函数签名和调用
    const lines = overlap.content.split('\n');
    const optimizedLines: string[] = [];

    for (const line of lines) {
      if (this.isFunctionSignature(line) || this.isFunctionCall(line)) {
        optimizedLines.push(line);
      }
    }

    return {
      ...overlap,
      content: optimizedLines.join('\n'),
      lines: optimizedLines.length,
      quality: Math.min(overlap.quality + 0.15, 1.0) // 显著提高质量评分
    };
  }

  /**
   * 为通用上下文优化重叠
   */
  private optimizeForGenericContext(overlap: OverlapResult, currentChunk: CodeChunk, nextChunk: CodeChunk): OverlapResult {
    // 通用优化：保留语法完整性
    const lines = overlap.content.split('\n');
    const optimizedLines: string[] = [];

    // 保留重要的上下文行
    for (const line of lines) {
      if (this.isImportantContext(line)) {
        optimizedLines.push(line);
      }
    }

    return {
      ...overlap,
      content: optimizedLines.join('\n'),
      lines: optimizedLines.length,
      quality: overlap.quality // 保持原有质量评分
    };
  }

  // 辅助方法用于识别代码结构
  private isFunctionSignature(line: string): boolean {
    const trimmed = line.trim();
    return /^function\s+\w+\s*\(/.test(trimmed) ||
      /^\w+\s*=\s*\([^)]*\)\s*=>/.test(trimmed) ||
      /^\s*\w+\s*\([^)]*\)\s*:\s*\w+\s*=>/.test(trimmed) ||
      /^\s*\w+\s*:\s*\([^)]*\)\s*=>/.test(trimmed) ||
      /^\s*(public|private|protected)?\s*\w+\s*\([^)]*\)\s*\{/.test(trimmed);
  }

  private isMethodSignature(line: string): boolean {
    const trimmed = line.trim();
    return /^\s*(async\s+)?\w+\s*\([^)]*\)\s*\{/.test(trimmed) ||
      /^\s*(async\s+)?\w+\s*:\s*\([^)]*\)\s*=>/.test(trimmed) ||
      /^\s*(public|private|protected)\s+\w+\s*\([^)]*\)\s*\{/.test(trimmed) ||
      /^\s*(static)?\s*\w+\s*\([^)]*\)\s*\{/.test(trimmed);
  }

  private isImportStatement(line: string): boolean {
    const trimmed = line.trim();
    return /^import\s+/.test(trimmed) ||
      /^from\s+/.test(trimmed) ||
      /^export\s+/.test(trimmed) ||
      /^require\(/.test(trimmed);
  }

  private isTypeDefinition(line: string): boolean {
    const trimmed = line.trim();
    return /^type\s+\w+\s*=/.test(trimmed) ||
      /^interface\s+\w+/.test(trimmed) ||
      /^enum\s+\w+/.test(trimmed) ||
      /^declare\s+/.test(trimmed);
  }

  private isVariableDeclaration(line: string): boolean {
    const trimmed = line.trim();
    return /^(const|let|var)\s+\w+\s*=/.test(trimmed) ||
      /^(const|let|var)\s+\w+\s*:\s*\w+\s*=/.test(trimmed);
  }

  private isClassProperty(line: string): boolean {
    const trimmed = line.trim();
    return /^\s*\w+\s*:\s*\w+\s*;?$/.test(trimmed) ||
      /^\s*\w+\s*=\s*.+;?$/.test(trimmed) ||
      /^\s*(public|private|protected)\s+\w+\s*:\s*\w+\s*;?$/.test(trimmed);
  }

  private isFunctionCall(line: string): boolean {
    // 检查是否包含函数调用
    return /\w+\s*\([^)]*\)/.test(line) && !this.isFunctionSignature(line);
  }

  private isImportantContext(line: string): boolean {
    const trimmed = line.trim();
    return trimmed !== '' &&  // 非空行
      !trimmed.startsWith('//') &&  // 非单行注释
      !trimmed.startsWith('/*') &&  // 非块注释开始
      !trimmed.startsWith('*') &&   // 非块注释内容
      !trimmed.startsWith('*/');    // 非块注释结束
  }

  private isFunctionEnd(line: string): boolean {
    const trimmedLine = line.trim();
    // 检查是否是函数结束的大括号
    return /^\s*}\s*(\/\/.*)?$/.test(trimmedLine) ||
      /^\s*}\s*;?\s*$/.test(trimmedLine) ||
      /.*=>\s*\{.*\}\s*;?$/.test(line) ||  // 箭头函数
      /.*function.*\)\s*\{.*\}\s*;?$/.test(line); // 内联函数
  }
}