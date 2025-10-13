/**
 * 代码结构检测器接口
 */
export interface IStructureDetector {
  isFunctionStart(line: string): boolean;
  isClassStart(line: string): boolean;
  isFunctionEnd(line: string): boolean;
  isClassEnd(line: string): boolean;
  isMethodEnd(line: string): boolean;
  isImportEnd(line: string): boolean;
  isCommentBlockEnd(line: string): boolean;
  isFunctionSignature(line: string): boolean;
  detectStructureType(line: string): string | null;
}

/**
 * 代码结构检测器实现
 * 提供各种代码结构的检测功能，如函数、类、导入等
 */
export class StructureDetector implements IStructureDetector {
  // 函数开始模式
  private static readonly FUNCTION_START_PATTERNS = [
    /^function\s+\w+\s*\(/,
    /^\w+\s*=\s*\([^)]*\)\s*=>/,
    /^\w+\s*=\s*async\s*\([^)]*\)\s*=>/,
    /^\w+\s*:\s*\([^)]*\)\s*=>/,
    /^\w+\s*:\s*async\s*\([^)]*\)\s*=>/,
    /^\s*async\s+function/,
    /^\s*static\s+\w+\s*\(/,
    /^\s*\w+\s*\([^)]*\)\s*\{/, // method declaration
    /^\s*\w+\s*\([^)]*\)\s*:\s*\w+\s*\{/, // typed method
    /^\s*\w+\s*\([^)]*\)\s*:\s*\w+\s*=>/, // typed arrow function
    /^\s*export\s+function\s+\w+\s*\(/,
    /^\s*export\s+const\s+\w+\s*=\s*\([^)]*\)\s*=>/,
    /^\s*export\s+async\s+function\s+\w+\s*\(/,
    /^\s*def\s+\w+\s*\(/, // Python
    /^\s*func\s+\w+\s*\(/, // Go
    /^\s*fn\s+\w+\s*\(/, // Rust
    /^\s*\w+\s+fn\s+\w+\s*\(/, // Rust method
    /^\s*public\s+\w+\s+\w+\s*\(/, // Java/C#
    /^\s*private\s+\w+\s+\w+\s*\(/, // Java/C#
    /^\s*protected\s+\w+\s+\w+\s*\(/, // Java/C#
    /^\s*static\s+\w+\s+\w+\s*\(/, // Java/C#
    /^\s*\w+\s+\w+\s*\(/ // General method/function
  ];

  // 类开始模式
  private static readonly CLASS_START_PATTERNS = [
    /^class\s+\w+/,
    /^export\s+default\s+class/,
    /^export\s+class/,
    /^\s*abstract\s+class/,
    /^\s*sealed\s+class/,
    /^\s*partial\s+class/,
    /^\s*public\s+class/,
    /^\s*private\s+class/,
    /^\s*protected\s+class/,
    /^\s*interface\s+\w+/,
    /^\s*struct\s+\w+/,
    /^\s*enum\s+\w+/,
    /^\s*trait\s+\w+/,
    /^\s*type\s+\w+\s*=/, // TypeScript type alias
    /^\s*type\s+\w+\s*=/, // Go type definition
    /^\s*impl\s+\w+/, // Rust implementation
    /^\s*class\s+\w+.*:/, // Python class
    /^\s*trait\s+\w+.*:/, // Rust trait
    /^\s*struct\s+\w+.*{/ // Go struct
  ];

  // 函数结束模式
  private static readonly FUNCTION_END_PATTERNS = [
    /^\s*}\s*(\/\/.*)?$/,
    /^\s*}\s*;?\s*$/,
    /.*=>\s*\{.*\}\s*;?$/, // 箭头函数
    /.*function.*\)\s*\{.*\}\s*;?$/, // 内联函数
    /^\s*end\s*$/, // Ruby/Basic
    /^\s*endif\s*$/, // Basic
    /^\s*endfunction\s*$/, // Basic
    /^\s*end\s+function\s*$/ // Basic
  ];

  // 类结束模式
  private static readonly CLASS_END_PATTERNS = [
    /^\s*}\s*(\/\/.*)?$/,
    /^\s*}\s*;?\s*$/
  ];

  // 方法结束模式
  private static readonly METHOD_END_PATTERNS = [
    /^\s*}\s*(\/\/.*)?$/,
    /^\s*}\s*;?\s*$/
  ];

  // 导入结束模式
  private static readonly IMPORT_END_PATTERNS = [
    /^import\s+.*$/,
    /^from\s+.*$/,
    /^export\s+.*$/,
    /^#include\s+[<"]/,
    /^using\s+[\w.]+/,
    /^package\s+[\w.]+/,
    /^require\s*\(/
  ];

  // 注释块结束模式
  private static readonly COMMENT_BLOCK_END_PATTERNS = [
    /^\/\/.*$/,
    /^\s*\*\s.*$/, // JSDoc-style comment
    /^\/\*.*\*\/$/, // Inline block comment
    /^\s*\*\//, // End of block comment
    /^\s*#.*$/, // Shell/Python comment
    /^\s*--.*$/, // SQL comment
    /^\s*<!--.*-->$/, // HTML comment
    /^\s*\/\//, // Start of line comment
    /^\s*\*\s*@/ // JSDoc annotation
  ];

  /**
   * 检查行是否为函数开始
   * @param line 代码行
   * @returns 是否为函数开始
   */
  isFunctionStart(line: string): boolean {
    const trimmedLine = line.trim();
    return StructureDetector.FUNCTION_START_PATTERNS.some(pattern => 
      pattern.test(trimmedLine)
    );
  }

  /**
   * 检查行是否为类开始
   * @param line 代码行
   * @returns 是否为类开始
   */
  isClassStart(line: string): boolean {
    const trimmedLine = line.trim();
    return StructureDetector.CLASS_START_PATTERNS.some(pattern => 
      pattern.test(trimmedLine)
    );
  }

  /**
   * 检查行是否为函数结束
   * @param line 代码行
   * @returns 是否为函数结束
   */
  isFunctionEnd(line: string): boolean {
    const trimmedLine = line.trim();
    return StructureDetector.FUNCTION_END_PATTERNS.some(pattern => 
      pattern.test(trimmedLine)
    );
  }

  /**
   * 检查行是否为类结束
   * @param line 代码行
   * @returns 是否为类结束
   */
  isClassEnd(line: string): boolean {
    const trimmedLine = line.trim();
    return StructureDetector.CLASS_END_PATTERNS.some(pattern => 
      pattern.test(trimmedLine)
    );
  }

  /**
   * 检查行是否为方法结束
   * @param line 代码行
   * @returns 是否为方法结束
   */
  isMethodEnd(line: string): boolean {
    const trimmedLine = line.trim();
    return StructureDetector.METHOD_END_PATTERNS.some(pattern => 
      pattern.test(trimmedLine)
    );
  }

  /**
   * 检查行是否为导入结束
   * @param line 代码行
   * @returns 是否为导入结束
   */
  isImportEnd(line: string): boolean {
    const trimmedLine = line.trim();
    return StructureDetector.IMPORT_END_PATTERNS.some(pattern => 
      pattern.test(trimmedLine)
    );
  }

  /**
   * 检查行是否为注释块结束
   * @param line 代码行
   * @returns 是否为注释块结束
   */
  isCommentBlockEnd(line: string): boolean {
    const trimmedLine = line.trim();
    return StructureDetector.COMMENT_BLOCK_END_PATTERNS.some(pattern => 
      pattern.test(trimmedLine)
    );
  }

  /**
   * 检查行是否为函数签名
   * @param line 代码行
   * @returns 是否为函数签名
   */
  isFunctionSignature(line: string): boolean {
    const trimmedLine = line.trim();
    const functionSignaturePatterns = [
      /^function\s+\w+\s*\(/,
      /^\w+\s*=\s*\([^)]*\)\s*=>/,
      /^\w+\s*:\s*\([^)]*\)\s*=>/,
      /^\w+\s*:\s*async\s*\([^)]*\)\s*=>/,
      /^\s*\w+\s*\([^)]*\)\s*:\s*\w+\s*=>/,
      /^\s*\w+\s*:\s*\([^)]*\)\s*:\s*\w+\s*=>/,
      /^\s*def\s+\w+\s*\(/, // Python
      /^\s*func\s+\w+\s*\(/, // Go
      /^\s*fn\s+\w+\s*\(/, // Rust
      /^\s*public\s+\w+\s+\w+\s*\(/, // Java/C#
      /^\s*private\s+\w+\s+\w+\s*\(/, // Java/C#
      /^\s*protected\s+\w+\s+\w+\s*\(/, // Java/C#
      /^\s*static\s+\w+\s+\w+\s*\(/ // Java/C#
    ];

    return functionSignaturePatterns.some(pattern => pattern.test(trimmedLine));
  }

  /**
   * 检测代码结构类型
   * @param line 代码行
   * @returns 结构类型名称或null
   */
  detectStructureType(line: string): string | null {
    if (this.isFunctionStart(line)) {
      return 'function';
    }
    
    if (this.isClassStart(line)) {
      return 'class';
    }
    
    if (this.isFunctionEnd(line)) {
      return 'function_end';
    }
    
    if (this.isClassEnd(line)) {
      return 'class_end';
    }
    
    if (this.isMethodEnd(line)) {
      return 'method_end';
    }
    
    if (this.isImportEnd(line)) {
      return 'import';
    }
    
    if (this.isCommentBlockEnd(line)) {
      return 'comment';
    }
    
    if (this.isFunctionSignature(line)) {
      return 'function_signature';
    }
    
    return null;
  }

  /**
   * 检查行是否为变量声明
   * @param line 代码行
   * @returns 是否为变量声明
   */
  isVariableDeclaration(line: string): boolean {
    const trimmedLine = line.trim();
    const variablePatterns = [
      /^(const|let|var)\s+\w+/,
      /^\w+\s*=\s*[^=]/,
      /^\w+\s*:\s*\w+\s*=/,
      /^let\s+mut\s+\w+/, // Rust
      /^var\s+\w+/,
      /^val\s+\w+/, // Kotlin
      /^dim\s+\w+/, // VB
      /^\w+\s+\w+\s*=/, // General typed variable
      /^const\s+\w+/ // C/C++ const
    ];

    return variablePatterns.some(pattern => pattern.test(trimmedLine));
  }

  /**
   * 检查行是否为控制流语句
   * @param line 代码行
   * @returns 是否为控制流语句
   */
  isControlFlowStatement(line: string): boolean {
    const trimmedLine = line.trim();
    const controlFlowPatterns = [
      /^if\s+/,
      /^else\s+/,
      /^elif\s+/,
      /^for\s+/,
      /^while\s+/,
      /^do\s+/,
      /^switch\s+/,
      /^case\s+/,
      /^break$/,
      /^continue$/,
      /^return\s+/,
      /^goto\s+/,
      /^try\s*{/,
      /^catch\s*\(/,
      /^finally\s*{/,
      /^throw\s+/,
      /^except\s+/, // Python
      /^raise\s+/, // Python
      /^match\s+/, // Rust
      /^select\s+{/, // Go
      /^with\s+/, // Python
      /^using\s*\(/
    ];

    return controlFlowPatterns.some(pattern => pattern.test(trimmedLine));
  }

  /**
   * 检查行是否为空行或仅包含空白字符
   * @param line 代码行
   * @returns 是否为空行
   */
  isEmptyLine(line: string): boolean {
    return line.trim() === '';
  }

  /**
   * 检查行是否包含语法错误标记
   * @param line 代码行
   * @returns 是否包含错误标记
   */
  hasErrorMarkers(line: string): boolean {
    const errorPatterns = [
      /TODO|FIXME|XXX|HACK/,
      /Error|error|ERROR/,
      /Warning|warning|WARNING/,
      /BUG|bug/,
      /FIXME:|TODO:|XXX:/,
      /\/\*\s*.*\s*\*\//, // Comments that might indicate issues
      /\/\/\s*.*[Tt]odo|.*[Ff]ixme/
    ];

    return errorPatterns.some(pattern => pattern.test(line));
  }
}

/**
 * 单例实例，供整个应用使用
 */
export const structureDetector = new StructureDetector();