# 语言权重配置系统

## 概述

语言权重配置系统是代码分段系统中的关键组件，它为不同编程语言提供特定的权重配置，影响语义边界分析器中的边界评分计算。通过调整权重，系统可以针对不同编程语言的特点优化分段策略。

## 权重配置接口

### ILanguageWeights 接口

```typescript
export interface ILanguageWeights {
  syntactic: number;  // 语法权重
  function: number;   // 函数权重
  class: number;      // 类权重
  method: number;     // 方法权重
  import: number;     // 导入权重
  logical: number;    // 逻辑权重
  comment: number;    // 注释权重
}
```

### 权重范围

所有权重值都在 0-1 范围内，值越大表示该因素在边界评分中的重要性越高。

## 默认权重配置

### LanguageWeights 类

`LanguageWeights` 类提供默认权重配置和语言特定权重配置。

```typescript
export class LanguageWeights {
  private static readonly DEFAULT_WEIGHTS: ILanguageWeights = {
    syntactic: 0.7,
    function: 0.8,
    class: 0.8,
    method: 0.7,
    import: 0.7,
    logical: 0.6,
    comment: 0.4
  };
}
```

## 语言特定权重配置

### 1. TypeScript/JavaScript

```typescript
typescript: {
  syntactic: 0.8,
  function: 0.9,
  class: 0.9,
  method: 0.8,
  import: 0.7,
  logical: 0.6,
  comment: 0.4
},
javascript: {
  syntactic: 0.8,
  function: 0.9,
  class: 0.9,
  method: 0.8,
  import: 0.7,
  logical: 0.6,
  comment: 0.4
}
```

**特点**:
- 语法权重较高 (0.8)，因为 JavaScript/TypeScript 语法结构复杂
- 函数和类权重最高 (0.9)，因为函数和类是主要组织单位
- 方法权重较高 (0.8)，支持面向对象编程

### 2. Python

```typescript
python: {
  syntactic: 0.7,
  function: 0.9,
  class: 0.9,
  method: 0.8,
  import: 0.8,
  logical: 0.7,
  comment: 0.5
}
```

**特点**:
- 函数和类权重最高 (0.9)，因为 Python 是函数式和面向对象并重
- 导入权重较高 (0.8)，因为 Python 有丰富的模块系统
- 逻辑权重较高 (0.7)，因为 Python 强调代码可读性和逻辑结构
- 注释权重较高 (0.5)，因为 Python 鼓励文档字符串和注释

### 3. Java/C#

```typescript
java: {
  syntactic: 0.8,
  function: 0.9,
  class: 0.9,
  method: 0.8,
  import: 0.8,
  logical: 0.5,
  comment: 0.4
},
csharp: {
  syntactic: 0.8,
  function: 0.9,
  class: 0.9,
  method: 0.8,
  import: 0.8,
  logical: 0.5,
  comment: 0.4
}
```

**特点**:
- 语法权重较高 (0.8)，因为 Java/C# 语法严格
- 函数和类权重最高 (0.9)，因为 Java/C# 是强面向对象语言
- 导入权重较高 (0.8)，因为包和命名空间系统重要
- 逻辑权重较低 (0.5)，因为 Java/C# 结构更正式

### 4. Go

```typescript
go: {
  syntactic: 0.7,
  function: 0.9,
  class: 0.7,
  method: 0.7,
  import: 0.8,
  logical: 0.6,
  comment: 0.4
}
```

**特点**:
- 函数权重最高 (0.9)，因为 Go 是函数式语言
- 类权重较低 (0.7)，因为 Go 没有传统类，使用结构体
- 导入权重较高 (0.8)，因为 Go 有明确的导入机制
- 方法权重中等 (0.7)，支持结构体方法

### 5. Rust

```typescript
rust: {
  syntactic: 0.8,
  function: 0.9,
  class: 0.7,
  method: 0.8,
  import: 0.7,
  logical: 0.6,
  comment: 0.4
}
```

**特点**:
- 语法权重较高 (0.8)，因为 Rust 语法复杂但精确
- 函数权重最高 (0.9)，因为 Rust 强调函数式编程
- 类权重较低 (0.7)，因为 Rust 使用结构体和 trait
- 方法权重较高 (0.8)，支持 impl 块中的方法

### 6. C/C++

```typescript
cpp: {
  syntactic: 0.8,
  function: 0.9,
  class: 0.9,
  method: 0.8,
  import: 0.7,
  logical: 0.6,
  comment: 0.4
},
c: {
  syntactic: 0.7,
  function: 0.9,
  class: 0.5,
  method: 0.7,
  import: 0.6,
  logical: 0.6,
  comment: 0.4
}
```

**C++ 特点**:
- 语法权重较高 (0.8)，因为 C++ 语法复杂
- 函数和类权重最高 (0.9)，支持面向对象编程
- 方法权重较高 (0.8)，支持类方法

**C 特点**:
- 函数权重最高 (0.9)，因为 C 是过程式语言
- 类权重最低 (0.5)，因为 C 不支持类
- 导入权重较低 (0.6)，因为 C 使用 #include

### 7. Scala

```typescript
scala: {
  syntactic: 0.8,
  function: 0.9,
  class: 0.8,
  method: 0.8,
  import: 0.7,
  logical: 0.6,
  comment: 0.4
}
```

**特点**:
- 语法权重较高 (0.8)，因为 Scala 语法丰富
- 函数权重最高 (0.9)，因为 Scala 支持函数式编程
- 类权重较高 (0.8)，支持面向对象编程
- 方法权重较高 (0.8)，支持类和对象方法

## 权重配置管理

### LanguageWeightsProvider 类

`LanguageWeightsProvider` 类提供权重配置的获取和管理功能。

```typescript
export class LanguageWeightsProvider {
  private customWeights: Record<string, ILanguageWeights> = {};
  
  /**
   * 获取语言权重配置
   * @param language 编程语言名称
   * @returns 权重配置
   */
  getWeights(language: string): ILanguageWeights {
    if (this.customWeights[language]) {
      return { ...this.customWeights[language] };
    }
    
    return LanguageWeights.getWeights(language);
  }
  
  /**
   * 设置自定义权重配置
   * @param language 编程语言名称
   * @param weights 权重配置
   */
  setCustomWeights(language: string, weights: ILanguageWeights): void {
    if (LanguageWeights.validateWeights(weights)) {
      this.customWeights[language] = { ...weights };
    } else {
      console.warn(`Invalid weights provided for language: ${language}`);
    }
  }
  
  /**
   * 清除自定义权重配置
   * @param language 编程语言名称，如果不提供则清除所有
   */
  clearCustomWeights(language?: string): void {
    if (language) {
      delete this.customWeights[language];
    } else {
      this.customWeights = {};
    }
  }
}
```

## 权重验证

### 权重验证方法

```typescript
static validateWeights(weights: ILanguageWeights): boolean {
  if (!weights || typeof weights !== 'object') {
    return false;
  }
  
  const requiredFields: (keyof ILanguageWeights)[] = [
    'syntactic', 'function', 'class', 'method', 'import', 'logical', 'comment'
  ];
  
  for (const field of requiredFields) {
    if (typeof weights[field] !== 'number' || 
        weights[field] < 0 || 
        weights[field] > 1) {
      return false;
    }
  }
  
  return true;
}
```

### 权重标准化

```typescript
static normalizeWeights(weights: ILanguageWeights): ILanguageWeights {
  if (!weights) {
    return { ...LanguageWeights.DEFAULT_WEIGHTS };
  }
  
  const normalized: ILanguageWeights = { ...weights };
  
  // 确保所有值在0-1范围内
  Object.keys(normalized).forEach(key => {
    const value = normalized[key as keyof ILanguageWeights];
    if (typeof value === 'number') {
      normalized[key as keyof ILanguageWeights] = Math.max(0, Math.min(1, value));
    }
  });
  
  return normalized;
}
```

## 权重合并

### 权重合并方法

```typescript
static mergeWeights(
  baseWeights: ILanguageWeights, 
  overrideWeights: Partial<ILanguageWeights>
): ILanguageWeights {
  if (!baseWeights) {
    baseWeights = { ...LanguageWeights.DEFAULT_WEIGHTS };
  }
  
  if (!overrideWeights) {
    return { ...baseWeights };
  }
  
  return {
    ...baseWeights,
    ...overrideWeights
  };
}
```

## 权重应用

### 在边界评分中的应用

权重在 `SemanticBoundaryAnalyzer.calculateBoundaryScore` 方法中应用：

```typescript
calculateBoundaryScore(line: string, context: string[], language: string): BoundaryScore {
  // 使用公共的权重配置
  const weights = this.weightsProvider.getWeights(language);
  
  let score = 0;
  
  // 1. 基础语法完整性检查 (权重: 0.3)
  if (this.isSyntacticallySafe(line)) {
    score += weights.syntactic * 0.3;
  }
  
  // 2. 语义边界检查 (权重: 0.4)
  if (this.isFunctionEnd(line)) score += weights.function * 0.4;
  if (this.isClassEnd(line)) score += weights.class * 0.4;
  if (this.isMethodEnd(line)) score += weights.method * 0.35;
  if (this.isImportEnd(line)) score += weights.import * 0.2;
  
  // 3. 逻辑分组检查 (权重: 0.5)
  if (this.isEmptyLine(line) && this.hasLogicalSeparation(context)) {
    score += weights.logical * 0.5;
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
```

## 权重配置示例

### 自定义权重配置

```typescript
// 创建语义边界分析器
const analyzer = new SemanticBoundaryAnalyzer();

// 为 Python 设置自定义权重
analyzer.setCustomWeights('python', {
  syntactic: 0.8,
  function: 0.95,
  class: 0.95,
  method: 0.85,
  import: 0.9,
  logical: 0.8,
  comment: 0.6
});

// 获取权重配置
const pythonWeights = analyzer.getWeights('python');
console.log('Python weights:', pythonWeights);
```

### 权重配置验证

```typescript
import { LanguageWeights } from './LanguageWeights';

// 验证权重配置
const customWeights = {
  syntactic: 0.8,
  function: 0.9,
  class: 0.9,
  method: 0.8,
  import: 0.7,
  logical: 0.6,
  comment: 0.4
};

if (LanguageWeights.validateWeights(customWeights)) {
  console.log('Weights are valid');
} else {
  console.log('Weights are invalid');
}

// 标准化权重配置
const normalizedWeights = LanguageWeights.normalizeWeights({
  syntactic: 1.2,  // 超出范围，将被标准化为 1.0
  function: -0.1,  // 超出范围，将被标准化为 0.0
  class: 0.9,
  method: 0.8,
  import: 0.7,
  logical: 0.6,
  comment: 0.4
});

console.log('Normalized weights:', normalizedWeights);
```

## 权重配置的最佳实践

### 1. 权重设计原则

- **语法权重**: 反映语言语法的复杂性和严格性
- **函数权重**: 反映函数在语言中的重要性
- **类权重**: 反映面向对象特性的重要性
- **方法权重**: 反映方法在类中的重要性
- **导入权重**: 反映模块系统的重要性
- **逻辑权重**: 反映代码逻辑结构的重要性
- **注释权重**: 反映文档和注释的重要性

### 2. 权重调整策略

- **高权重 (0.8-1.0)**: 语言的核心组织单位
- **中权重 (0.5-0.8)**: 重要但非核心的组织单位
- **低权重 (0.0-0.5)**: 辅助性组织单位

### 3. 权重测试

- 使用典型代码库测试权重配置
- 根据分段结果调整权重
- 考虑不同编程风格的影响

## 总结

语言权重配置系统通过为不同编程语言提供特定的权重配置，使语义边界分析器能够针对不同语言的特点优化分段策略。系统支持默认权重、语言特定权重和自定义权重，提供了灵活而精确的权重管理机制。