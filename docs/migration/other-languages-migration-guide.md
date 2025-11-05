# 其他语言提取器迁移指南

## 概述

本指南基于C语言提取器的成功迁移经验，为其他语言（JavaScript、TypeScript、Python、Java、Rust等）提供详细的迁移步骤和最佳实践。

## 迁移核心原则

1. **保持功能完整性**：确保所有关系提取功能在新架构中得到保留
2. **遵循统一模式**：使用与C语言相同的迁移模式和结构
3. **优化性能**：在迁移过程中优化关系提取的性能
4. **增强可维护性**：简化代码结构，提高可读性和可维护性

## 通用迁移步骤

### 步骤1：分析现有提取器

对于每种语言，首先分析其现有的提取器实现：

```bash
# 分析JavaScript提取器
src/service/graph/mapping/extractors/JavaScriptRelationshipExtractor/

# 分析TypeScript提取器
src/service/graph/mapping/extractors/TypeScriptRelationshipExtractor/

# 分析Python提取器
src/service/graph/mapping/extractors/PythonRelationshipExtractor/

# 分析Java提取器
src/service/graph/mapping/extractors/JavaRelationshipExtractor/

# 分析Rust提取器
src/service/graph/mapping/extractors/RustRelationshipExtractor/
```

### 步骤2：创建或更新语言适配器

确保每种语言都有对应的适配器，位于：
```
src/service/parser/core/normalization/adapters/
```

### 步骤3：迁移关系提取逻辑

将提取器中的关系提取逻辑迁移到适配器的`extractRelationshipMetadata`方法中。

## JavaScript/TypeScript 迁移指南

### 1. 创建JavaScriptLanguageAdapter

```typescript
// src/service/parser/core/normalization/adapters/JavaScriptLanguageAdapter.ts
import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

export class JavaScriptLanguageAdapter extends BaseLanguageAdapter {
  private symbolTable: SymbolTable | null = null;

  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      // Entity types
      'functions',
      'classes',
      'variables',
      'imports',
      'exports',
      // Relationship types
      'calls',
      'data-flows',
      'inheritance',
      'concurrency-relationships',
      'control-flow-relationships',
      'lifecycle-relationships',
      'semantic-relationships'
    ];
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = {
      'functions': 'function',
      'classes': 'class',
      'variables': 'variable',
      'imports': 'import',
      'exports': 'export',
      'calls': 'call',
      'data-flows': 'data-flow',
      'inheritance': 'inheritance'
    };

    return mapping[queryType] || 'expression';
  }

  // 迁移的关系提取方法
  private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
    if (!astNode) return null;

    switch (standardType) {
      case 'call':
        return this.extractCallMetadata(result, astNode);
      case 'data-flow':
        return this.extractDataFlowMetadata(result, astNode);
      case 'inheritance':
        return this.extractInheritanceMetadata(result, astNode);
      case 'concurrency':
        return this.extractConcurrencyMetadata(result, astNode);
      case 'lifecycle':
        return this.extractLifecycleMetadata(result, astNode);
      case 'semantic':
        return this.extractSemanticMetadata(result, astNode);
      default:
        return null;
    }
  }

  private extractCallMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // 从JavaScriptRelationshipExtractor/CallExtractor.ts迁移
    const calleeName = this.extractCalleeName(astNode);
    const callerNode = this.findCallerFunctionContext(astNode);
    const callContext = this.analyzeCallContext(astNode);

    return {
      type: 'call',
      fromNodeId: callerNode ? generateDeterministicNodeId(callerNode) : 'unknown',
      toNodeId: generateDeterministicNodeId(astNode),
      callName: calleeName || 'unknown',
      callType: this.determineCallType(astNode, null),
      callContext,
      location: {
        filePath: this.symbolTable?.filePath || 'current_file.js',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  // 从BaseJavaScriptRelationshipExtractor迁移的辅助方法
  private extractCalleeName(callExpr: Parser.SyntaxNode): string | null {
    if (callExpr.children && callExpr.children.length > 0) {
      const funcNode = callExpr.children[0];
      if (funcNode.type === 'identifier') {
        return funcNode.text;
      } else if (funcNode.type === 'member_expression') {
        return this.extractMethodNameFromMemberExpression(funcNode);
      } else if (funcNode.type === 'call_expression') {
        return this.extractCalleeName(funcNode);
      }
    }
    return null;
  }

  private extractMethodNameFromMemberExpression(memberExpr: Parser.SyntaxNode): string | null {
    if (memberExpr.children && memberExpr.children.length > 0) {
      const lastChild = memberExpr.children[memberExpr.children.length - 1];
      if (lastChild.type === 'property_identifier' || lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }

  private analyzeCallContext(callExpr: Parser.SyntaxNode): {
    isChained: boolean;
    chainDepth?: number;
    isAsync: boolean;
  } {
    const isChained = callExpr.parent?.type === 'call_expression' || callExpr.parent?.type === 'member_expression';
    const isAsync = callExpr.text.includes('await');

    return {
      isChained,
      isAsync,
      chainDepth: isChained ? this.calculateChainDepth(callExpr) : 0
    };
  }

  private calculateChainDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node;
    while (current.parent && (current.parent.type === 'call_expression' || current.parent.type === 'member_expression')) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  private determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: any): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    if (callExpr.children[0]?.type === 'new_expression') {
      return 'constructor';
    }

    if (callExpr.parent?.type === 'decorator') {
      return 'decorator';
    }

    if (resolvedSymbol) {
      if (resolvedSymbol.type === 'method') {
        return 'method';
      } else if (resolvedSymbol.type === 'function') {
        return 'function';
      }
    }

    return 'function';
  }

  // 其他关系提取方法...
  private extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // 从JavaScriptRelationshipExtractor/DataFlowExtractor.ts迁移
    // 实现JavaScript特定的数据流提取逻辑
  }

  private extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // 从JavaScriptRelationshipExtractor/InheritanceExtractor.ts迁移
    // 实现JavaScript特定的继承关系提取逻辑
  }

  // 实现其他抽象方法...
  extractName(result: any): string {
    // 实现名称提取逻辑
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    // 实现语言特定元数据提取
  }

  mapNodeType(nodeType: string): string {
    // 实现节点类型映射
  }

  calculateComplexity(result: any): number {
    // 实现复杂度计算
  }

  extractDependencies(result: any): string[] {
    // 实现依赖项提取
  }

  extractModifiers(result: any): string[] {
    // 实现修饰符提取
  }
}
```

### 2. TypeScript适配器

TypeScript适配器可以继承JavaScript适配器，并添加TypeScript特有的功能：

```typescript
// src/service/parser/core/normalization/adapters/TypeScriptLanguageAdapter.ts
import { JavaScriptLanguageAdapter, AdapterOptions } from './JavaScriptLanguageAdapter';
import { StandardizedQueryResult } from '../types';
import Parser from 'tree-sitter';

export class TypeScriptLanguageAdapter extends JavaScriptLanguageAdapter {
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    const jsTypes = super.getSupportedQueryTypes();
    return [...jsTypes, 'interfaces', 'types', 'generics'];
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const jsMapping = super.mapQueryTypeToStandardType(queryType);
    const tsMapping: Record<string, StandardType> = {
      'interfaces': 'interface',
      'types': 'type',
      'generics': 'type'
    };

    return tsMapping[queryType] || jsMapping;
  }

  // TypeScript特有的关系提取
  private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
    // 先调用父类方法
    const baseMetadata = super.extractRelationshipMetadata(result, standardType, astNode);
    
    // 添加TypeScript特有的处理
    if (standardType === 'inheritance') {
      return this.extractTypeScriptInheritanceMetadata(result, astNode) || baseMetadata;
    }
    
    return baseMetadata;
  }

  private extractTypeScriptInheritanceMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // 实现TypeScript特有的继承关系提取（接口实现、泛型约束等）
  }
}
```

## Python 迁移指南

### 1. 创建PythonLanguageAdapter

```typescript
// src/service/parser/core/normalization/adapters/PythonLanguageAdapter.ts
import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

export class PythonLanguageAdapter extends BaseLanguageAdapter {
  private symbolTable: SymbolTable | null = null;

  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'functions',
      'classes',
      'variables',
      'imports',
      'decorators',
      'calls',
      'data-flows',
      'inheritance',
      'concurrency-relationships',
      'control-flow-relationships',
      'lifecycle-relationships',
      'semantic-relationships'
    ];
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = {
      'functions': 'function',
      'classes': 'class',
      'variables': 'variable',
      'imports': 'import',
      'decorators': 'annotation',
      'calls': 'call',
      'data-flows': 'data-flow',
      'inheritance': 'inheritance'
    };

    return mapping[queryType] || 'expression';
  }

  private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
    if (!astNode) return null;

    switch (standardType) {
      case 'call':
        return this.extractCallMetadata(result, astNode);
      case 'data-flow':
        return this.extractDataFlowMetadata(result, astNode);
      case 'inheritance':
        return this.extractInheritanceMetadata(result, astNode);
      case 'concurrency':
        return this.extractConcurrencyMetadata(result, astNode);
      case 'lifecycle':
        return this.extractLifecycleMetadata(result, astNode);
      case 'semantic':
        return this.extractSemanticMetadata(result, astNode);
      default:
        return null;
    }
  }

  private extractCallMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // 从PythonRelationshipExtractor/CallExtractor.ts迁移
    const calleeName = this.extractCalleeName(astNode);
    const callerNode = this.findCallerFunctionContext(astNode);

    return {
      type: 'call',
      fromNodeId: callerNode ? generateDeterministicNodeId(callerNode) : 'unknown',
      toNodeId: generateDeterministicNodeId(astNode),
      callName: calleeName || 'unknown',
      callType: this.determineCallType(astNode, null),
      location: {
        filePath: this.symbolTable?.filePath || 'current_file.py',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  // 从BasePythonRelationshipExtractor迁移的辅助方法
  private extractCalleeName(callExpr: Parser.SyntaxNode): string | null {
    // 实现Python特有的调用名提取逻辑
  }

  // 实现其他抽象方法...
}
```

## Java 迁移指南

### 1. 创建JavaLanguageAdapter

```typescript
// src/service/parser/core/normalization/adapters/JavaLanguageAdapter.ts
import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

export class JavaLanguageAdapter extends BaseLanguageAdapter {
  private symbolTable: SymbolTable | null = null;

  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'functions',
      'classes',
      'interfaces',
      'variables',
      'imports',
      'annotations',
      'calls',
      'data-flows',
      'inheritance',
      'concurrency-relationships',
      'control-flow-relationships',
      'lifecycle-relationships',
      'semantic-relationships'
    ];
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = {
      'functions': 'method',
      'classes': 'class',
      'interfaces': 'interface',
      'variables': 'variable',
      'imports': 'import',
      'annotations': 'annotation',
      'calls': 'call',
      'data-flows': 'data-flow',
      'inheritance': 'inheritance'
    };

    return mapping[queryType] || 'expression';
  }

  private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
    if (!astNode) return null;

    switch (standardType) {
      case 'call':
        return this.extractCallMetadata(result, astNode);
      case 'data-flow':
        return this.extractDataFlowMetadata(result, astNode);
      case 'inheritance':
        return this.extractInheritanceMetadata(result, astNode);
      case 'concurrency':
        return this.extractConcurrencyMetadata(result, astNode);
      case 'lifecycle':
        return this.extractLifecycleMetadata(result, astNode);
      case 'semantic':
        return this.extractSemanticMetadata(result, astNode);
      default:
        return null;
    }
  }

  private extractCallMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // 从JavaRelationshipExtractor迁移
    const calleeName = this.extractCalleeName(astNode);
    const callerNode = this.findCallerFunctionContext(astNode);

    return {
      type: 'call',
      fromNodeId: callerNode ? generateDeterministicNodeId(callerNode) : 'unknown',
      toNodeId: generateDeterministicNodeId(astNode),
      callName: calleeName || 'unknown',
      callType: this.determineCallType(astNode, null),
      location: {
        filePath: this.symbolTable?.filePath || 'current_file.java',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  // 实现其他抽象方法...
}
```

## Rust 迁移指南

### 1. 创建RustLanguageAdapter

```typescript
// src/service/parser/core/normalization/adapters/RustLanguageAdapter.ts
import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

export class RustLanguageAdapter extends BaseLanguageAdapter {
  private symbolTable: SymbolTable | null = null;

  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'functions',
      'structs',
      'enums',
      'traits',
      'variables',
      'imports',
      'macros',
      'calls',
      'data-flows',
      'inheritance',
      'concurrency-relationships',
      'control-flow-relationships',
      'lifecycle-relationships',
      'semantic-relationships'
    ];
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = {
      'functions': 'function',
      'structs': 'class',
      'enums': 'enum',
      'traits': 'interface',
      'variables': 'variable',
      'imports': 'import',
      'macros': 'expression',
      'calls': 'call',
      'data-flows': 'data-flow',
      'inheritance': 'inheritance'
    };

    return mapping[queryType] || 'expression';
  }

  private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
    if (!astNode) return null;

    switch (standardType) {
      case 'call':
        return this.extractCallMetadata(result, astNode);
      case 'data-flow':
        return this.extractDataFlowMetadata(result, astNode);
      case 'inheritance':
        return this.extractInheritanceMetadata(result, astNode);
      case 'concurrency':
        return this.extractConcurrencyMetadata(result, astNode);
      case 'lifecycle':
        return this.extractLifecycleMetadata(result, astNode);
      case 'semantic':
        return this.extractSemanticMetadata(result, astNode);
      default:
        return null;
    }
  }

  private extractCallMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // 从RustRelationshipExtractor/CallExtractor.ts迁移
    const calleeName = this.extractCalleeName(astNode);
    const callerNode = this.findCallerFunctionContext(astNode);

    return {
      type: 'call',
      fromNodeId: callerNode ? generateDeterministicNodeId(callerNode) : 'unknown',
      toNodeId: generateDeterministicNodeId(astNode),
      callName: calleeName || 'unknown',
      callType: this.determineCallType(astNode, null),
      location: {
        filePath: this.symbolTable?.filePath || 'current_file.rs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column + 1,
      }
    };
  }

  // 实现其他抽象方法...
}
```

## 通用迁移模式

### 1. 关系元数据结构

所有语言的关系元数据都应遵循统一结构：

```typescript
// 调用关系
{
  type: 'call',
  fromNodeId: string,
  toNodeId: string,
  callName: string,
  callType: 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator',
  callContext?: {
    isChained: boolean;
    chainDepth?: number;
    isAsync: boolean;
  },
  location: {
    filePath: string,
    lineNumber: number,
    columnNumber: number
  }
}

// 数据流关系
{
  type: 'data-flow',
  fromNodeId: string,
  toNodeId: string,
  flowType: 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access',
  dataType?: string,
  flowPath: string[],
  location: {
    filePath: string,
    lineNumber: number,
    columnNumber: number
  }
}

// 继承关系
{
  type: 'inheritance',
  fromNodeId: string,
  toNodeId: string,
  inheritanceType: 'extends' | 'implements' | 'mixin' | 'enum_member' | 'contains' | 'embedded_struct',
  location: {
    filePath: string,
    lineNumber: number
  }
}
```

### 2. 辅助方法迁移

从BaseRelationshipExtractor迁移的通用辅助方法：

```typescript
// 查找调用者函数上下文
private findCallerFunctionContext(callNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
  let current = callNode.parent;
  while (current) {
    if (this.isFunctionNode(current)) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

// 判断是否为函数节点
private isFunctionNode(node: Parser.SyntaxNode): boolean {
  const functionTypes = this.getLanguageSpecificFunctionTypes();
  return functionTypes.includes(node.type);
}

// 生成节点ID
private generateNodeId(name: string, type: string, filePath: string): string {
  return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
}
```

### 3. 语言特定处理

每种语言都需要实现特定的处理逻辑：

```typescript
// JavaScript/TypeScript特定
private determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: any): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
  if (callExpr.children[0]?.type === 'new_expression') {
    return 'constructor';
  }
  // 其他语言特定逻辑...
}

// Python特定
private determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: any): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
  if (callExpr.parent?.type === 'decorator') {
    return 'decorator';
  }
  // 其他语言特定逻辑...
}

// Java特定
private determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: any): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
  if (callExpr.type === 'method_invocation') {
    return 'method';
  } else if (callExpr.type === 'object_creation_expression') {
    return 'constructor';
  }
  // 其他语言特定逻辑...
}
```

## 测试策略

### 1. 单元测试

为每个适配器创建单元测试：

```typescript
// src/service/parser/core/normalization/adapters/__tests__/JavaScriptLanguageAdapter.test.ts
import { JavaScriptLanguageAdapter } from '../JavaScriptLanguageAdapter';

describe('JavaScriptLanguageAdapter', () => {
  let adapter: JavaScriptLanguageAdapter;

  beforeEach(() => {
    adapter = new JavaScriptLanguageAdapter();
  });

  describe('extractCallMetadata', () => {
    it('should extract function call metadata correctly', () => {
      // 测试函数调用关系提取
    });

    it('should extract method call metadata correctly', () => {
      // 测试方法调用关系提取
    });

    it('should extract constructor call metadata correctly', () => {
      // 测试构造函数调用关系提取
    });
  });

  // 其他测试...
});
```

### 2. 集成测试

创建跨语言的集成测试：

```typescript
// src/service/parser/core/normalization/__tests__/cross-language-integration.test.ts
describe('Cross-Language Integration Tests', () => {
  it('should produce consistent relationship metadata across languages', () => {
    // 测试不同语言产生的关系元数据结构一致性
  });

  it('should handle mixed-language projects correctly', () => {
    // 测试混合语言项目的处理
  });
});
```

## 迁移后清理

完成所有语言迁移后，执行以下清理步骤：

1. **移除extractors目录**：
   ```bash
   rm -rf src/service/graph/mapping/extractors
   ```

2. **清理相关依赖**：
   - 移除RelationshipExtractorFactory
   - 更新依赖注入配置
   - 清理不再使用的导入和类型定义

3. **更新文档**：
   - 更新架构文档
   - 更新API文档
   - 创建迁移指南

## 总结

通过遵循本指南，可以系统性地将所有语言的提取器迁移到新架构中。这种迁移不仅简化了代码结构，提高了可维护性，还为未来的功能扩展奠定了坚实的基础。迁移完成后，整个系统将拥有更清晰的职责分离和更统一的处理流程。