# 符号平衡检查与语法验证

## 概述

符号平衡检查和语法验证是代码分段系统中的关键组件，确保分段后的代码片段在语法上是完整和正确的。本文档详细介绍符号平衡检查和语法验证的实现原理和应用场景。

## 符号平衡检查

### 1. BalancedChunker 类

`BalancedChunker` 类负责跟踪代码中的符号平衡状态，确保分段不会破坏语法结构。

#### 1.1 符号栈接口

```typescript
export interface SymbolStack {
  brackets: number;    // 圆括号 ()
  braces: number;      // 花括号 {}
  squares: number;     // 方括号 []
  templates: number;   // 模板字符串 ``
}
```

#### 1.2 符号变化接口

```typescript
export interface SymbolStackChange {
  brackets: number;
  braces: number;
  squares: number;
  templates: number;
}
```

### 2. 符号分析方法

#### 2.1 行符号分析

```typescript
analyzeLineSymbols(line: string, lineNumber?: number): void {
  const lineHash = this.simpleHash(line);
  
  // 检查缓存
  const cachedChange = this.getCachedChange(lineHash);
  if (cachedChange) {
    this.applySymbolChange(cachedChange);
    return;
  }

  // 首次分析并缓存
  const originalState = { ...this.symbolStack };
  this.analyzeLineSymbolsInternal(line);
  const symbolChange = this.calculateSymbolChange(originalState, this.symbolStack);
  this.setCachedChange(lineHash, symbolChange);
}
```

#### 2.2 内部符号分析

```typescript
private analyzeLineSymbolsInternal(line: string): void {
  // 保存初始状态用于调试
  const initialStack = { ...this.symbolStack };

  // 单行注释在每行开始时重置
  const wasInSingleComment = this.inSingleComment;
  this.inSingleComment = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    // 跳过注释和字符串内容
    if (this.inSingleComment) continue;
    if (this.inMultiComment) {
      if (char === '*' && nextChar === '/') {
        this.inMultiComment = false;
        i++; // 跳过'*/'
      }
      continue;
    }
    if (this.inString) {
      // 处理转义字符
      if (char === '\\' && i + 1 < line.length) {
        i++; // 跳过下一个字符
        continue;
      }
      
      // 处理模板字符串中的表达式
      if (this.stringChar === '`' && char === '$' && nextChar === '{') {
        this.templateExprDepth++;
        this.symbolStack.braces++; // 表达式开始增加花括号计数
        i++; // 跳过'{'
        continue;
      }
      
      // 处理模板字符串中表达式的结束
      if (this.stringChar === '`' && char === '}' && this.templateExprDepth > 0) {
        this.templateExprDepth--;
        this.symbolStack.braces--; // 表达式结束减少花括号计数
        continue;
      }
      
      // 结束字符串（对于模板字符串，只有在顶层时才能结束）
      if (char === this.stringChar && (this.stringChar !== '`' || this.templateExprDepth === 0)) {
        this.inString = false;
        if (this.stringChar === '`') this.symbolStack.templates--;
        continue;
      }
      
      continue;
    }

    // 处理符号
    switch (char) {
      case '/':
        if (nextChar === '/') {
          this.inSingleComment = true;
          continue;
        }
        if (nextChar === '*') {
          this.inMultiComment = true;
          i++; // 跳过'/*'
          continue;
        }
        break;
      case '"': case "'": case '`':
        this.inString = true;
        this.stringChar = char;
        if (char === '`') this.symbolStack.templates++;
        break;
      case '(': this.symbolStack.brackets++; break;
      case ')': this.symbolStack.brackets--; break;
      case '{': this.symbolStack.braces++; break;
      case '}': this.symbolStack.braces--; break;
      case '[': this.symbolStack.squares++; break;
      case ']': this.symbolStack.squares--; break;
    }
  }
}
```

### 3. 安全分段检查

#### 3.1 符号平衡检查

```typescript
canSafelySplit(): boolean {
  return this.symbolStack.brackets === 0 &&
         this.symbolStack.braces === 0 &&
         this.symbolStack.squares === 0 &&
         this.symbolStack.templates === 0;
}
```

#### 3.2 代码平衡验证

```typescript
validateCodeBalance(code: string): boolean {
  const tempState = { ...this.symbolStack };
  const lines = code.split('\n');
  
  for (const line of lines) {
    this.analyzeLineSymbolsInternal(line);
  }
  
  const isBalanced = this.canSafelySplit();
  this.symbolStack = tempState; // 恢复状态
  
  return isBalanced;
}
```

### 4. 缓存优化

#### 4.1 LRU 缓存机制

```typescript
private analysisCache: Map<string, SymbolStackChange> = new Map();
private static readonly MAX_CACHE_SIZE = 1000;
private accessOrder: string[] = [];
```

#### 4.2 缓存操作

```typescript
private getCachedChange(lineHash: string): SymbolStackChange | undefined {
  const result = this.analysisCache.get(lineHash);
  if (result) {
    // 更新访问顺序（LRU）
    this.accessOrder = this.accessOrder.filter(hash => hash !== lineHash);
    this.accessOrder.push(lineHash);
  }
  return result;
}

private setCachedChange(lineHash: string, change: SymbolStackChange): void {
  if (this.analysisCache.size >= BalancedChunker.MAX_CACHE_SIZE) {
    // 移除最久未使用的条目
    const oldestHash = this.accessOrder.shift();
    if (oldestHash) {
      this.analysisCache.delete(oldestHash);
    }
  }
  
  this.analysisCache.set(lineHash, change);
  this.accessOrder.push(lineHash);
}
```

#### 4.3 预缓存常见模式

```typescript
preCacheCommonPatterns(): void {
  const commonPatterns = [
    'function () {}',
    'if () {}',
    'for () {}',
    'while () {}',
    'try {} catch {}',
    'class {}',
    '[]',
    '{}'
  ];

  commonPatterns.forEach(pattern => {
    const lineHash = this.simpleHash(pattern);
    if (!this.analysisCache.has(lineHash)) {
      const tempState = { ...this.symbolStack };
      this.analyzeLineSymbolsInternal(pattern);
      const symbolChange = this.calculateSymbolChange(tempState, this.symbolStack);
      this.setCachedChange(lineHash, symbolChange);
      this.symbolStack = tempState; // 恢复状态
    }
  });
}
```

### 5. 状态管理

#### 5.1 状态获取和设置

```typescript
getCurrentState(): SymbolStack {
  return { ...this.symbolStack };
}

setCurrentState(state: SymbolStack): void {
  this.symbolStack = { ...state };
}
```

#### 5.2 状态重置

```typescript
reset(): void {
  this.symbolStack = {
    brackets: 0,
    braces: 0,
    squares: 0,
    templates: 0
  };
  
  // 重置解析状态
  this.inSingleComment = false;
  this.inMultiComment = false;
  this.inString = false;
  this.stringChar = '';
  this.templateExprDepth = 0;
}
```

## 语法验证

### 1. SyntaxValidator 类

`SyntaxValidator` 类验证代码段的语法完整性，确保分段后的代码片段语法正确。

#### 1.1 类结构

```typescript
export class SyntaxValidator implements SyntaxValidatorInterface {
  private balancedChunker: BalancedChunker;

  constructor(balancedChunker: BalancedChunker) {
    this.balancedChunker = balancedChunker;
  }
}
```

### 2. 验证方法

#### 2.1 主验证方法

```typescript
validate(content: string, language: string): boolean {
  try {
    // 使用BalancedChunker验证符号平衡
    if (!this.balancedChunker.validateCodeBalance(content)) {
      return false;
    }

    // 对于JavaScript/TypeScript，进行额外的语法检查
    if (language === 'javascript' || language === 'typescript') {
      const bracketBalance = this.checkBracketBalance(content);
      const braceBalance = this.checkBraceBalance(content);

      if (bracketBalance !== 0 || braceBalance !== 0) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}
```

#### 2.2 括号平衡检查

```typescript
checkBracketBalance(content: string): number {
  let balance = 0;
  for (const char of content) {
    if (char === '(') balance++;
    if (char === ')') balance--;
  }
  return balance;
}
```

#### 2.3 花括号平衡检查

```typescript
checkBraceBalance(content: string): number {
  let balance = 0;
  for (const char of content) {
    if (char === '{') balance++;
    if (char === '}') balance--;
  }
  return balance;
}
```

#### 2.4 符号平衡检查

```typescript
checkSymbolBalance(content: string): boolean {
  return this.balancedChunker.validateCodeBalance(content);
}
```

## 在分段中的应用

### 1. IntelligentSplitter 中的应用

```typescript
private shouldSplitWithSemanticBoundary(
  line: string,
  currentChunk: string[],
  currentSize: number,
  lineSize: number,
  maxChunkSize: number,
  language: string,
  allLines: string[],
  currentIndex: number
): boolean {
  // 大小限制检查（优先）
  if (currentSize + lineSize > maxChunkSize) {
    return true;
  }

  // 符号平衡检查 - 只有在符号平衡时才允许分段
  if (!this.balancedChunker.canSafelySplit()) {
    return false;
  }

  // 使用语义边界评分
  if (this.semanticBoundaryAnalyzer) {
    const context = allLines.slice(Math.max(0, currentIndex - 2), currentIndex + 1);
    const boundaryScore = this.semanticBoundaryAnalyzer.calculateBoundaryScore(line, context, language);

    // 如果边界评分足够高，允许分段
    if (boundaryScore.score > 0.7) {
      return currentSize > maxChunkSize * 0.3;
    }

    // 如果边界评分中等，需要更大的块大小
    if (boundaryScore.score > 0.5) {
      return currentSize > maxChunkSize * 0.5;
    }
  }

  // 如果没有语义边界分析器，使用简单的大小检查
  return currentSize > maxChunkSize * 0.8;
}
```

### 2. 语法验证在分段中的应用

```typescript
if (shouldSplit && currentChunk.length > 0) {
  const chunkContent = currentChunk.join('\n');

  // 验证分段语法
  if (this.syntaxValidator.validate(chunkContent, language)) {
    const complexity = this.complexityCalculator.calculate(chunkContent);

    const metadata: CodeChunkMetadata = {
      startLine: currentLine,
      endLine: currentLine + currentChunk.length - 1,
      language,
      filePath,
      type: 'generic',
      complexity
    };

    chunks.push({
      content: chunkContent,
      metadata
    });
  } else {
    this.logger?.warn(`Skipping chunk due to syntax validation failure at line ${currentLine}`);
    // 如果验证失败，尝试在下一个安全点分段
    continue;
  }
}
```

### 3. ASTCodeSplitter 中的应用

```typescript
private simpleTextSplit(code: string, language: string, filePath?: string): CodeChunk[] {
  const chunks: CodeChunk[] = [];
  const lines = code.split('\n');
  const maxChunkSize = this.options.maxChunkSize || 1000;

  if (lines.length === 0) {
    return chunks;
  }

  // 使用BalancedChunker来确保符号平衡
  this.balancedChunker.reset();

  let currentChunkLines: string[] = [];
  let currentLineStart = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    currentChunkLines.push(line);

    // 分析当前行的符号变化
    this.balancedChunker.analyzeLineSymbols(line, i + 1);

    // 检查是否达到块大小限制并且可以安全分割
    const currentChunkSize = currentChunkLines.join('\n').length;
    if (currentChunkSize >= maxChunkSize && this.balancedChunker.canSafelySplit()) {
      // 创建当前块
      if (currentChunkLines.length > 0) {
        chunks.push({
          content: currentChunkLines.join('\n'),
          metadata: {
            startLine: currentLineStart,
            endLine: currentLineStart + currentChunkLines.length - 1,
            language,
            filePath,
            type: 'code'
          }
        });
      }

      // 重置当前块
      currentChunkLines = [];
      currentLineStart = i + 1;
      this.balancedChunker.reset();
    }
  }

  // 添加最后一个块
  if (currentChunkLines.length > 0) {
    chunks.push({
      content: currentChunkLines.join('\n'),
      metadata: {
        startLine: currentLineStart,
        endLine: currentLineStart + currentChunkLines.length - 1,
        language,
        filePath,
        type: 'code'
      }
    });
  }

  return chunks;
}
```

## 性能优化

### 1. 缓存策略

- **LRU 缓存**: 使用最近最少使用算法缓存符号分析结果
- **预缓存**: 预缓存常见代码模式
- **哈希优化**: 使用简单哈希函数快速识别重复代码行

### 2. 状态管理优化

- **状态保存和恢复**: 高效的状态保存和恢复机制
- **增量分析**: 只分析变化的符号状态
- **批量处理**: 批量处理多行代码以提高效率

### 3. 内存管理

- **缓存大小限制**: 限制缓存大小防止内存溢出
- **定期清理**: 定期清理过期缓存条目
- **内存监控**: 监控内存使用情况

## 扩展性

### 1. 语言支持扩展

- **语言特定验证**: 为不同语言添加特定的语法验证规则
- **符号集扩展**: 支持更多语言的特定符号
- **语法模式**: 支持不同语言的语法模式

### 2. 验证规则扩展

- **自定义验证规则**: 支持添加自定义验证规则
- **规则优先级**: 支持验证规则的优先级设置
- **规则组合**: 支持多个验证规则的组合

## 总结

符号平衡检查和语法验证是代码分段系统中的关键组件，确保分段后的代码片段在语法上是完整和正确的。通过多层次的符号跟踪和语法验证，系统能够在各种编程语言和代码结构中提供可靠的分段结果。