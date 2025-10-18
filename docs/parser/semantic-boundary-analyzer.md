# 语义边界分析器详解

## 概述

`SemanticBoundaryAnalyzer` 类是代码分段系统中的核心组件，负责分析代码边界并确定最佳的分割点。它通过多维度评估代码行作为分段边界的适合度，确保分段后的代码片段在语义上是完整和独立的。

## 类结构

```typescript
export class SemanticBoundaryAnalyzer {
  private balancedChunker: BalancedChunker;
  private weightsProvider = languageWeightsProvider;
  private structureDetector = structureDetector;
  
  constructor() {
    this.balancedChunker = new BalancedChunker();
  }
}
```

## 核心方法

### 1. calculateBoundaryScore

这是语义边界分析器的核心方法，用于计算代码行作为分段边界的适合度。

```typescript
calculateBoundaryScore(line: string, context: string[], language: string): BoundaryScore
```

#### 参数说明

- `line`: 当前评估的代码行
- `context`: 上下文行数组，用于逻辑分离检测
- `language`: 编程语言名称，用于获取语言特定权重

#### 返回值

返回一个 `BoundaryScore` 对象，包含：

```typescript
interface BoundaryScore {
  score: number; // 0-1之间的分数，越高越适合作为边界
  components: {
    syntactic: boolean;   // 语法完整性
    semantic: boolean;    // 语义边界
    logical: boolean;     // 逻辑分组
    comment: boolean;     // 注释边界
  };
}
```

#### 评分计算逻辑

1. **基础语法完整性检查** (权重: 0.3)
   ```typescript
   if (this.isSyntacticallySafe(line)) {
     score += weights.syntactic * 0.3;
   }
   ```

2. **语义边界检查** (权重: 0.4)
   ```typescript
   if (this.isFunctionEnd(line)) score += weights.function * 0.4;
   if (this.isClassEnd(line)) score += weights.class * 0.4;
   if (this.isMethodEnd(line)) score += weights.method * 0.35;
   if (this.isImportEnd(line)) score += weights.import * 0.2;
   ```

3. **逻辑分组检查** (权重: 0.5)
   ```typescript
   if (this.isEmptyLine(line) && this.hasLogicalSeparation(context)) {
     score += weights.logical * 0.5;
   }
   ```

4. **注释边界检查** (权重: 0.1)
   ```typescript
   if (this.isCommentBlockEnd(line)) score += weights.comment * 0.1;
   ```

### 2. 语法安全性检查

```typescript
private isSyntacticallySafe(line: string): boolean
```

#### 实现逻辑

1. **空行检查**: 空行总是语法安全的
   ```typescript
   const trimmedLine = line.trim();
   if (!trimmedLine) return true;
   ```

2. **简单符号检查**: 仅包含闭合符号的行是安全的
   ```typescript
   if (/^[\s\]\}\);]*$/.test(trimmedLine)) {
     return true;
   }
   ```

3. **符号平衡检查**: 使用 `BalancedChunker` 验证符号平衡
   ```typescript
   const originalState = this.balancedChunker.getCurrentState();
   this.balancedChunker.analyzeLineSymbols(trimmedLine);
   const isBalanced = this.balancedChunker.canSafelySplit();
   this.balancedChunker.setCurrentState(originalState);
   return isBalanced;
   ```

### 3. 语义边界检测方法

#### 3.1 函数结束检测

```typescript
private isFunctionEnd(line: string): boolean {
  return this.structureDetector.isFunctionEnd(line);
}
```

通过 `StructureDetector` 检测函数结束，支持多种编程语言的函数结束模式：

- JavaScript/TypeScript: `}`, `});`
- Python: 无明确结束标记，通过缩进检测
- Java/C#: `}`
- Go: `}`

#### 3.2 类结束检测

```typescript
private isClassEnd(line: string): boolean {
  return this.structureDetector.isClassEnd(line);
}
```

检测类定义的结束，支持：

- 类定义结束: `}`
- 接口定义结束: `}`
- 结构体定义结束: `}`

#### 3.3 方法结束检测

```typescript
private isMethodEnd(line: string): boolean {
  return this.structureDetector.isMethodEnd(line);
}
```

检测类方法的结束，通常与函数结束检测类似，但考虑类方法的特殊性。

#### 3.4 导入结束检测

```typescript
private isImportEnd(line: string): boolean {
  return this.structureDetector.isImportEnd(line);
}
```

检测导入语句的结束，支持多种导入格式：

- JavaScript/TypeScript: `import ... from '...'`, `export ...`
- Python: `import ...`, `from ... import ...`
- Java: `import ...;`
- C/C++: `#include ...`, `using ...`

### 4. 逻辑边界检测

#### 4.1 空行检测

```typescript
private isEmptyLine(line: string): boolean {
  return this.structureDetector.isEmptyLine(line);
}
```

简单检查行是否为空或仅包含空白字符。

#### 4.2 逻辑分离检测

```typescript
private hasLogicalSeparation(context: string[]): boolean {
  if (context.length < 3) return false;
  
  const prevLine = context[context.length - 3] || '';
  const currentLine = context[context.length - 2] || ''; // 当前行应该是空行
  const nextLine = context[context.length - 1] || '';
  
  // 确保当前行是空行
  if (currentLine.trim() !== '') return false;
  
  // 检查变量声明的分离
  const isPrevVarDeclaration = this.structureDetector.isVariableDeclaration(prevLine);
  const isNextVarDeclaration = this.structureDetector.isVariableDeclaration(nextLine);
  
  return (this.isFunctionStart(prevLine) || this.isClassStart(prevLine) ||
         this.isFunctionStart(nextLine) || this.isClassStart(nextLine)) ||
         (isPrevVarDeclaration && isNextVarDeclaration);
}
```

逻辑分离检测考虑以下情况：

1. 函数或类定义之间的空行
2. 变量声明组之间的空行
3. 不同逻辑块之间的空行

### 5. 注释边界检测

```typescript
private isCommentBlockEnd(line: string): boolean {
  return this.structureDetector.isCommentBlockEnd(line);
}
```

检测注释块的结束，支持多种注释格式：

- 单行注释: `//`, `#`, `--`
- 多行注释: `/* ... */`, `<!-- -->`
- 文档注释: `/**`, `*`, `*/`

### 6. 边界类型判断

#### 6.1 语义边界判断

```typescript
private isSemanticBoundary(line: string): boolean {
  return this.isFunctionEnd(line) || 
         this.isClassEnd(line) || 
         this.isMethodEnd(line) || 
         this.isImportEnd(line);
}
```

#### 6.2 逻辑边界判断

```typescript
private isLogicalBoundary(line: string, context: string[]): boolean {
  return this.isEmptyLine(line) && this.hasLogicalSeparation(context);
}
```

#### 6.3 注释边界判断

```typescript
private isCommentBoundary(line: string): boolean {
  return this.isCommentBlockEnd(line);
}
```

## 权重配置管理

### 1. 获取权重配置

```typescript
getWeights(language: string): LanguageWeights {
  return this.weightsProvider.getWeights(language);
}
```

### 2. 设置自定义权重

```typescript
setCustomWeights(language: string, weights: LanguageWeights): void {
  this.weightsProvider.setCustomWeights(language, weights);
}
```

### 3. 清除自定义权重

```typescript
clearCustomWeights(language?: string): void {
  this.weightsProvider.clearCustomWeights(language);
}
```

## 结构类型检测

```typescript
detectStructureType(line: string): string | null {
  return this.structureDetector.detectStructureType(line);
}
```

检测代码行的结构类型，返回值可能为：

- `function`: 函数开始
- `class`: 类开始
- `function_end`: 函数结束
- `class_end`: 类结束
- `method_end`: 方法结束
- `import`: 导入语句
- `comment`: 注释
- `function_signature`: 函数签名

## 使用示例

```typescript
// 创建语义边界分析器
const analyzer = new SemanticBoundaryAnalyzer();

// 分析代码行
const line = '  }';
const context = ['  function test() {', '    console.log("test");', '  }', ''];
const language = 'javascript';

// 计算边界评分
const score = analyzer.calculateBoundaryScore(line, context, language);

console.log(`边界评分: ${score.score}`);
console.log(`语法完整性: ${score.components.syntactic}`);
console.log(`语义边界: ${score.components.semantic}`);
console.log(`逻辑分组: ${score.components.logical}`);
console.log(`注释边界: ${score.components.comment}`);
```

## 性能优化

1. **缓存机制**: `BalancedChunker` 使用 LRU 缓存存储常见代码模式的符号变化
2. **预缓存**: 预缓存常见代码模式以提高性能
3. **状态管理**: 高效的状态保存和恢复机制

## 扩展性

1. **语言支持**: 通过 `StructureDetector` 支持多种编程语言
2. **权重配置**: 支持语言特定的权重配置
3. **自定义规则**: 可以通过继承和重写方法添加自定义边界检测规则

## 总结

`SemanticBoundaryAnalyzer` 类通过多维度评估代码行作为分段边界的适合度，确保分段后的代码片段在语法正确性和语义完整性方面达到最佳效果。它结合了语法分析、符号平衡、语义边界检测和权重配置，为不同编程语言提供了灵活而精确的边界分析能力。