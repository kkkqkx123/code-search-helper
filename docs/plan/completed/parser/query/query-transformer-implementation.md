# 查询转换层实现方案

## 概述

查询转换层负责将完整的查询语句从 [`constants/queries/`](src/service/parser/constants/queries/) 目录转换为特定类型的简化查询模式。这个转换层是重构的核心组件。

## 核心设计

### QueryTransformer 类设计

```typescript
// src/service/parser/core/query/QueryTransformer.ts
export class QueryTransformer {
  private static patternTypeMappings: Map<string, string[]> = new Map();
  private static queryCache: Map<string, Map<string, string>> = new Map();

  /**
   * 初始化模式类型映射
   */
  static initialize(): void {
    this.initializePatternMappings();
  }

  /**
   * 从完整查询中提取特定类型的模式
   */
  static extractPatternType(fullQuery: string, patternType: string, language: string): string {
    const cacheKey = `${language}:${patternType}`;
    
    // 检查缓存
    if (this.queryCache.has(language) && this.queryCache.get(language)!.has(patternType)) {
      return this.queryCache.get(language)!.get(patternType)!;
    }

    const patterns = this.extractPatterns(fullQuery, patternType, language);
    const result = patterns.join('\n\n');

    // 缓存结果
    if (!this.queryCache.has(language)) {
      this.queryCache.set(language, new Map());
    }
    this.queryCache.get(language)!.set(patternType, result);

    return result;
  }

  /**
   * 获取所有支持的模式类型
   */
  static getSupportedPatternTypes(): string[] {
    return Array.from(this.patternTypeMappings.keys());
  }

  /**
   * 获取指定语言支持的模式类型
   */
  static getSupportedPatternTypesForLanguage(language: string): string[] {
    const supportedTypes: string[] = [];
    
    for (const [patternType, languages] of this.patternTypeMappings) {
      if (languages.includes(language)) {
        supportedTypes.push(patternType);
      }
    }
    
    return supportedTypes;
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  static getCacheStats() {
    let totalQueries = 0;
    const languageStats: Record<string, number> = {};

    for (const [language, patterns] of this.queryCache) {
      const count = patterns.size;
      languageStats[language] = count;
      totalQueries += count;
    }

    return {
      totalQueries,
      cachedLanguages: Object.keys(languageStats).length,
      languageStats
    };
  }
}
```

### 模式类型映射配置

```typescript
// src/service/parser/core/query/QueryTransformer.ts (续)
private static initializePatternMappings(): void {
  // 函数相关模式
  this.patternTypeMappings.set('functions', [
    'function_declaration',
    'function_definition', 
    'function_signature',
    'method_definition',
    'method_signature',
    'arrow_function',
    'function_expression',
    'generator_function_declaration'
  ]);

  // 类相关模式
  this.patternTypeMappings.set('classes', [
    'class_declaration',
    'class_definition',
    'abstract_class_declaration',
    'struct_declaration',
    'struct_definition',
    'enum_declaration',
    'interface_declaration'
  ]);

  // 导入相关模式
  this.patternTypeMappings.set('imports', [
    'import_statement',
    'import_from_statement',
    'import_declaration',
    'using_directive',
    'use_statement'
  ]);

  // 导出相关模式
  this.patternTypeMappings.set('exports', [
    'export_statement',
    'export_declaration',
    'export_default_declaration',
    'export_named_declaration'
  ]);

  // 方法相关模式
  this.patternTypeMappings.set('methods', [
    'method_definition',
    'method_signature',
    'abstract_method_signature'
  ]);

  // 接口相关模式
  this.patternTypeMappings.set('interfaces', [
    'interface_declaration'
  ]);

  // 类型相关模式
  this.patternTypeMappings.set('types', [
    'type_alias_declaration',
    'type_definition'
  ]);

  // 属性相关模式
  this.patternTypeMappings.set('properties', [
    'property_definition',
    'public_field_definition',
    'private_field_definition',
    'protected_field_definition'
  ]);

  // 变量相关模式
  this.patternTypeMappings.set('variables', [
    'variable_declaration',
    'lexical_declaration',
    'const_declaration',
    'let_declaration'
  ]);
}
```

### 查询提取算法

```typescript
// src/service/parser/core/query/QueryTransformer.ts (续)
private static extractPatterns(fullQuery: string, patternType: string, language: string): string[] {
  const targetKeywords = this.patternTypeMappings.get(patternType) || [];
  const lines = fullQuery.split('\n');
  const patterns: string[] = [];
  let currentPattern: string[] = [];
  let inPattern = false;
  let inComment = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 跳过空行和注释
    if (!line || line.startsWith(';')) {
      continue;
    }

    // 检查是否包含目标关键词
    const hasKeyword = targetKeywords.some(keyword => 
      line.includes(`(${keyword}`) || 
      line.includes(`[${keyword}`) ||
      line.includes(` ${keyword} `)
    );

    if (hasKeyword || inPattern) {
      currentPattern.push(lines[i]);
      inPattern = true;

      // 计算括号深度
      braceDepth += this.countChar(lines[i], '(');
      braceDepth -= this.countChar(lines[i], ')');

      // 如果括号平衡且不在注释中，可能是一个完整的模式
      if (braceDepth === 0 && !inComment) {
        const patternText = currentPattern.join('\n');
        if (this.isValidPattern(patternText)) {
          patterns.push(patternText);
        }
        currentPattern = [];
        inPattern = false;
      }
    }
  }

  // 处理未完成的模式
  if (currentPattern.length > 0 && braceDepth === 0) {
    const patternText = currentPattern.join('\n');
    if (this.isValidPattern(patternText)) {
      patterns.push(patternText);
    }
  }

  return patterns;
}

private static countChar(text: string, char: string): number {
  return text.split(char).length - 1;
}

private static isValidPattern(pattern: string): boolean {
  // 基本验证：检查括号平衡和基本结构
  const openParens = (pattern.match(/\(/g) || []).length;
  const closeParens = (pattern.match(/\)/g) || []).length;
  
  if (openParens !== closeParens) {
    return false;
  }

  // 检查是否包含有效的查询结构
  return pattern.includes('@') && pattern.includes('(');
}
```

### 语言特定配置

```typescript
// src/service/parser/core/query/QueryTransformer.ts (续)
private static languageSpecificPatterns: Record<string, Record<string, string[]>> = {
  javascript: {
    functions: ['function_declaration', 'arrow_function', 'function_expression'],
    classes: ['class_declaration'],
    methods: ['method_definition'],
    imports: ['import_statement'],
    exports: ['export_statement', 'export_default_declaration']
  },
  typescript: {
    functions: ['function_declaration', 'arrow_function', 'function_signature'],
    classes: ['class_declaration', 'abstract_class_declaration'],
    interfaces: ['interface_declaration'],
    types: ['type_alias_declaration'],
    methods: ['method_definition', 'method_signature'],
    imports: ['import_statement'],
    exports: ['export_statement', 'export_default_declaration']
  },
  python: {
    functions: ['function_definition'],
    classes: ['class_definition'],
    methods: ['function_definition'], // Python中方法也是函数定义
    imports: ['import_statement', 'import_from_statement']
  },
  java: {
    functions: ['method_declaration'],
    classes: ['class_declaration'],
    interfaces: ['interface_declaration'],
    methods: ['method_declaration'],
    imports: ['import_declaration']
  }
  // 其他语言的配置...
};
```

## 集成方案

### 1. 更新 QueryRegistry

```typescript
// src/service/parser/core/query/QueryRegistry.ts (更新后)
export class QueryRegistry {
  private static patterns: Map<string, Map<string, string>> = new Map();
  private static queryLoader = new QueryLoader();
  private static transformer = new QueryTransformer();

  static async initialize(): Promise<void> {
    QueryTransformer.initialize();
    await this.loadFromConstants();
  }

  private static async loadFromConstants(): Promise<void> {
    const languages = [
      'javascript', 'typescript', 'python', 'java', 'go', 'rust', 
      'cpp', 'c', 'csharp', 'swift', 'kotlin', 'ruby', 'php', 'scala'
    ];
    
    for (const language of languages) {
      try {
        await this.queryLoader.loadLanguageQueries(language);
        const fullQuery = this.queryLoader.getQuery(language);
        
        // 为每种语言提取所有支持的模式类型
        const patternTypes = QueryTransformer.getSupportedPatternTypesForLanguage(language);
        const languagePatterns = new Map<string, string>();
        
        for (const patternType of patternTypes) {
          try {
            const pattern = QueryTransformer.extractPatternType(fullQuery, patternType, language);
            if (pattern && pattern.trim()) {
              languagePatterns.set(patternType, pattern);
            }
          } catch (error) {
            console.warn(`Failed to extract ${patternType} pattern for ${language}:`, error);
          }
        }
        
        this.patterns.set(language, languagePatterns);
        
      } catch (error) {
        console.warn(`Failed to load queries for ${language}:`, error);
      }
    }
  }

  // 其他方法保持不变...
}
```

### 2. 向后兼容性

为了保持向后兼容性，我们提供迁移辅助方法：

```typescript
// src/service/parser/core/query/QueryMigrationHelper.ts
export class QueryMigrationHelper {
  /**
   * 将旧的简化查询模式迁移到新的常量查询系统
   */
  static migrateFromSimplePatterns(language: string, patternType: string): string | null {
    try {
      const fullQuery = QueryLoader.getQuery(language);
      return QueryTransformer.extractPatternType(fullQuery, patternType, language);
    } catch (error) {
      console.warn(`Migration failed for ${language}.${patternType}:`, error);
      return null;
    }
  }

  /**
   * 验证迁移后的查询是否与原始查询兼容
   */
  static validateMigration(originalQuery: string, migratedQuery: string): boolean {
    // 基本验证逻辑
    const originalLines = originalQuery.split('\n').filter(line => line.trim());
    const migratedLines = migratedQuery.split('\n').filter(line => line.trim());
    
    // 检查是否包含相同的关键节点类型
    const originalNodes = this.extractNodeTypes(originalQuery);
    const migratedNodes = this.extractNodeTypes(migratedQuery);
    
    return originalNodes.every(node => migratedNodes.includes(node));
  }

  private static extractNodeTypes(query: string): string[] {
    const nodeTypes: string[] = [];
    const nodeRegex = /\((\w+)/g;
    let match;
    
    while ((match = nodeRegex.exec(query)) !== null) {
      nodeTypes.push(match[1]);
    }
    
    return [...new Set(nodeTypes)];
  }
}
```

## 测试策略

### 单元测试

```typescript
// src/service/parser/core/__tests__/query/QueryTransformer.test.ts
describe('QueryTransformer', () => {
  beforeEach(() => {
    QueryTransformer.clearCache();
  });

  test('should extract function patterns from JavaScript query', () => {
    const jsQuery = `...完整的JavaScript查询...`;
    const functionPattern = QueryTransformer.extractPatternType(jsQuery, 'functions', 'javascript');
    
    expect(functionPattern).toContain('function_declaration');
    expect(functionPattern).toContain('arrow_function');
    expect(functionPattern).not.toContain('class_declaration');
  });

  test('should cache extracted patterns', () => {
    const jsQuery = `...完整的JavaScript查询...`;
    
    const result1 = QueryTransformer.extractPatternType(jsQuery, 'functions', 'javascript');
    const result2 = QueryTransformer.extractPatternType(jsQuery, 'functions', 'javascript');
    
    expect(result1).toBe(result2); // 应该返回相同的引用
    
    const stats = QueryTransformer.getCacheStats();
    expect(stats.languageStats.javascript).toBe(1);
  });
});
```

### 集成测试

```typescript
// src/service/parser/core/__tests__/query/QueryMigration.test.ts
describe('Query Migration Integration', () => {
  test('should migrate from simple patterns to constants', async () => {
    const originalQuery = SIMPLE_JAVASCRIPT_QUERIES.functions;
    const migratedQuery = await QueryMigrationHelper.migrateFromSimplePatterns('javascript', 'functions');
    
    expect(migratedQuery).not.toBeNull();
    expect(QueryMigrationHelper.validateMigration(originalQuery, migratedQuery!)).toBe(true);
  });
});
```

## 性能考虑

1. **缓存策略**：查询转换结果应该被缓存以避免重复处理
2. **懒加载**：只在需要时加载和转换查询
3. **预编译**：对于常用查询模式，可以预编译转换结果
4. **内存管理**：定期清理不常用的缓存条目

## 错误处理

1. **优雅降级**：如果转换失败，回退到默认查询模式
2. **详细日志**：记录转换过程中的错误和警告
3. **验证机制**：验证转换后的查询语法是否正确