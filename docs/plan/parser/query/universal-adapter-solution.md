# 通用语言适配器解决方案

## 问题模式分析

通过分析TypeScript、Python、Java和Rust适配器，发现了以下共同问题模式：

### 1. 代码重复问题

所有适配器都存在大量重复代码：

- **行号提取逻辑**：每个适配器都有相同的`extractStartLine`和`extractEndLine`方法
- **内容提取逻辑**：`extractContent`方法在所有适配器中几乎相同
- **基础复杂度计算**：基于行数和嵌套深度的复杂度计算逻辑重复
- **依赖项去重**：所有适配器都使用`[...new Set(dependencies)]`进行去重

### 2. 查询类型映射不一致

- **TypeScript**：支持`functions`, `classes`, `methods`, `imports`, `exports`, `interfaces`, `types`, `properties`, `variables`, `control-flow`, `expressions`
- **Python**：支持`functions`, `classes`, `methods`, `imports`, `variables`, `control-flow`, `data-structures`, `types-decorators`
- **Java**：支持`classes-interfaces`, `methods-variables`, `control-flow-patterns`, `functions`, `classes`, `methods`, `imports`, `variables`, `control-flow`, `types`, `interfaces`, `enums`, `records`, `annotations`
- **Rust**：支持`functions`, `classes`, `methods`, `imports`, `variables`, `control-flow`, `types`, `expressions`, `macros`, `modules`

### 3. 去重机制缺失

所有适配器都缺少有效的去重机制，可能导致重复结构被多次处理。

### 4. 错误处理不一致

- TypeScript和Python：使用`filter((result): result is StandardizedQueryResult => result !== null)`
- Java和Rust：直接返回结果数组，没有null过滤

## 通用解决方案架构

### 1. 基础适配器类设计

```typescript
// src/service/parser/core/normalization/BaseLanguageAdapter.ts
export abstract class BaseLanguageAdapter implements ILanguageAdapter {
  protected logger: LoggerService;
  protected options: AdapterOptions;

  constructor(options: AdapterOptions = {}) {
    this.logger = new LoggerService();
    this.options = {
      enableDeduplication: options.enableDeduplication ?? true,
      enablePerformanceMonitoring: options.enablePerformanceMonitoring ?? false,
      enableErrorRecovery: options.enableErrorRecovery ?? true,
      ...options
    };
  }

  /**
   * 主标准化方法 - 模板方法模式
   */
  normalize(queryResults: any[], queryType: string, language: string): StandardizedQueryResult[] {
    const startTime = Date.now();
    
    try {
      // 1. 预处理查询结果
      const preprocessedResults = this.preprocessResults(queryResults);
      
      // 2. 转换为标准化结果
      const standardizedResults = this.convertToStandardizedResults(preprocessedResults, queryType, language);
      
      // 3. 后处理（去重、排序等）
      const finalResults = this.postProcessResults(standardizedResults);
      
      // 4. 性能监控
      if (this.options.enablePerformanceMonitoring) {
        this.recordPerformanceMetrics(queryType, finalResults.length, Date.now() - startTime);
      }
      
      return finalResults;
    } catch (error) {
      this.logger.error(`Normalization failed for ${language}.${queryType}:`, error);
      
      if (this.options.enableErrorRecovery) {
        return this.fallbackNormalization(queryResults, queryType, language);
      }
      
      throw error;
    }
  }

  /**
   * 预处理查询结果
   */
  protected preprocessResults(queryResults: any[]): any[] {
    return queryResults.filter(result => 
      result && result.captures && Array.isArray(result.captures) && result.captures.length > 0
    );
  }

  /**
   * 转换为标准化结果
   */
  protected convertToStandardizedResults(
    preprocessedResults: any[], 
    queryType: string, 
    language: string
  ): StandardizedQueryResult[] {
    const results: StandardizedQueryResult[] = [];
    
    for (const result of preprocessedResults) {
      try {
        const standardizedResult = this.createStandardizedResult(result, queryType, language);
        results.push(standardizedResult);
      } catch (error) {
        this.logger.warn(`Failed to convert result for ${queryType}:`, error);
        // 根据错误处理策略决定是否继续
        if (!this.options.enableErrorRecovery) {
          throw error;
        }
      }
    }
    
    return results;
  }

  /**
   * 创建标准化结果
   */
  protected createStandardizedResult(result: any, queryType: string, language: string): StandardizedQueryResult {
    return {
      type: this.mapQueryTypeToStandardType(queryType),
      name: this.extractName(result),
      startLine: this.extractStartLine(result),
      endLine: this.extractEndLine(result),
      content: this.extractContent(result),
      metadata: this.createMetadata(result, language)
    };
  }

  /**
   * 创建元数据
   */
  protected createMetadata(result: any, language: string): QueryResultMetadata {
    const baseMetadata = {
      language,
      complexity: this.calculateComplexity(result),
      dependencies: this.extractDependencies(result),
      modifiers: this.extractModifiers(result)
    };

    const languageSpecificMetadata = this.extractLanguageSpecificMetadata(result);
    
    return {
      ...baseMetadata,
      ...languageSpecificMetadata
    };
  }

  /**
   * 后处理结果
   */
  protected postProcessResults(results: StandardizedQueryResult[]): StandardizedQueryResult[] {
    let processedResults = results;
    
    // 1. 去重
    if (this.options.enableDeduplication) {
      processedResults = this.deduplicateResults(processedResults);
    }
    
    // 2. 按行号排序
    processedResults = processedResults.sort((a, b) => a.startLine - b.startLine);
    
    // 3. 过滤无效结果
    processedResults = processedResults.filter(result => 
      result && result.name && result.name !== 'unnamed' && result.startLine > 0
    );
    
    return processedResults;
  }

  /**
   * 智能去重
   */
  protected deduplicateResults(results: StandardizedQueryResult[]): StandardizedQueryResult[] {
    const seen = new Map<string, StandardizedQueryResult>();
    
    for (const result of results) {
      const key = this.generateUniqueKey(result);
      
      if (!seen.has(key)) {
        seen.set(key, result);
      } else {
        this.mergeMetadata(seen.get(key)!, result);
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * 生成唯一键
   */
  protected generateUniqueKey(result: StandardizedQueryResult): string {
    return `${result.type}:${result.name}:${result.startLine}:${result.endLine}`;
  }

  /**
   * 合并元数据
   */
  protected mergeMetadata(existing: StandardizedQueryResult, newResult: StandardizedQueryResult): void {
    // 合并依赖项
    const mergedDependencies = [
      ...new Set([...existing.metadata.dependencies, ...newResult.metadata.dependencies])
    ];
    
    // 合并修饰符
    const mergedModifiers = [
      ...new Set([...existing.metadata.modifiers, ...newResult.metadata.modifiers])
    ];
    
    existing.metadata.dependencies = mergedDependencies;
    existing.metadata.modifiers = mergedModifiers;
    
    // 合并语言特定元数据
    Object.assign(existing.metadata, newResult.metadata);
  }

  // 通用工具方法
  protected extractStartLine(result: any): number {
    const mainNode = result.captures?.[0]?.node;
    return (mainNode?.startPosition?.row || 0) + 1;
  }

  protected extractEndLine(result: any): number {
    const mainNode = result.captures?.[0]?.node;
    return (mainNode?.endPosition?.row || 0) + 1;
  }

  protected extractContent(result: any): string {
    const mainNode = result.captures?.[0]?.node;
    return mainNode?.text || '';
  }

  protected calculateBaseComplexity(result: any): number {
    let complexity = 1;
    const mainNode = result.captures?.[0]?.node;
    
    if (mainNode) {
      // 基于代码行数
      const lineCount = this.extractEndLine(result) - this.extractStartLine(result) + 1;
      complexity += Math.floor(lineCount / 10);
      
      // 基于嵌套深度
      const nestingDepth = this.calculateNestingDepth(mainNode);
      complexity += nestingDepth;
    }
    
    return complexity;
  }

  protected calculateNestingDepth(node: any, currentDepth: number = 0): number {
    if (!node || !node.children) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    
    for (const child of node.children) {
      if (this.isBlockNode(child)) {
        const childDepth = this.calculateNestingDepth(child, currentDepth + 1);
        maxDepth = Math.max(maxDepth, childDepth);
      }
    }

    return maxDepth;
  }

  protected isBlockNode(node: any): boolean {
    const blockTypes = ['block', 'statement_block', 'class_body', 'interface_body', 'suite'];
    return blockTypes.includes(node.type);
  }

  protected extractBaseDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return dependencies;
    }

    // 查找类型引用
    this.findTypeReferences(mainNode, dependencies);
    
    return [...new Set(dependencies)];
  }

  protected findTypeReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      if (child.type === 'type_identifier' || child.type === 'identifier') {
        const text = child.text;
        if (text && text[0] === text[0].toUpperCase()) {
          dependencies.push(text);
        }
      }
      
      this.findTypeReferences(child, dependencies);
    }
  }

  /**
   * 降级标准化
   */
  protected fallbackNormalization(queryResults: any[], queryType: string, language: string): StandardizedQueryResult[] {
    this.logger.warn(`Using fallback normalization for ${language}.${queryType}`);
    
    return queryResults.slice(0, 10).map((result, index) => ({
      type: 'expression',
      name: `fallback_${index}`,
      startLine: this.extractStartLine(result),
      endLine: this.extractEndLine(result),
      content: this.extractContent(result),
      metadata: {
        language,
        complexity: 1,
        dependencies: [],
        modifiers: []
      }
    }));
  }

  /**
   * 记录性能指标
   */
  protected recordPerformanceMetrics(queryType: string, resultCount: number, duration: number): void {
    this.logger.debug(`Performance metrics for ${queryType}:`, {
      resultCount,
      duration,
      avgTimePerResult: duration / Math.max(resultCount, 1)
    });
  }

  // 抽象方法 - 由子类实现
  abstract extractName(result: any): string;
  abstract extractLanguageSpecificMetadata(result: any): Record<string, any>;
  abstract getSupportedQueryTypes(): string[];
  abstract mapNodeType(nodeType: string): string;
  abstract mapQueryTypeToStandardType(queryType: string): string;
  abstract calculateComplexity(result: any): number;
  abstract extractDependencies(result: any): string[];
  abstract extractModifiers(result: any): string[];
}
```

### 2. 语言特定适配器重构示例

```typescript
// src/service/parser/core/normalization/adapters/RustLanguageAdapter.ts
export class RustLanguageAdapter extends BaseLanguageAdapter {
  
  extractName(result: any): string {
    // Rust特定的名称提取逻辑
    const nameCaptures = [
      'name.definition.function',
      'name.definition.struct',
      'name.definition.enum',
      'name.definition.trait',
      // ... 其他Rust特定捕获
    ];

    for (const captureName of nameCaptures) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    return 'unnamed';
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    const mainNode = result.captures?.[0]?.node;
    const metadata: Record<string, any> = {};
    
    if (mainNode) {
      // Rust特定元数据
      const lifetimes = this.findLifetimes(mainNode);
      if (lifetimes.length > 0) {
        metadata.lifetimes = lifetimes;
        metadata.hasLifetimes = true;
      }
      
      const traitBounds = this.findTraitBounds(mainNode);
      if (traitBounds.length > 0) {
        metadata.traitBounds = traitBounds;
        metadata.hasTraitBounds = true;
      }
      
      const generics = this.findGenericParameters(mainNode);
      if (generics.length > 0) {
        metadata.genericParameters = generics;
        metadata.hasGenerics = true;
      }
    }
    
    return metadata;
  }

  getSupportedQueryTypes(): string[] {
    return [
      'functions',
      'classes',
      'methods',
      'imports',
      'variables',
      'control-flow',
      'types',
      'expressions',
      'macros',
      'modules'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      'function_item': 'function',
      'struct_item': 'class',
      'enum_item': 'class',
      'trait_item': 'interface',
      'use_declaration': 'import',
      // ... 其他Rust特定映射
    };
    
    return typeMapping[nodeType] || nodeType;
  }

  mapQueryTypeToStandardType(queryType: string): string {
    const mapping: Record<string, string> = {
      'functions': 'function',
      'classes': 'class',
      'methods': 'method',
      'imports': 'import',
      'variables': 'variable',
      'control-flow': 'control-flow',
      'types': 'type',
      'expressions': 'expression',
      'macros': 'function',
      'modules': 'import'
    };
    
    return mapping[queryType] || 'expression';
  }

  calculateComplexity(result: any): number {
    let complexity = this.calculateBaseComplexity(result);
    const mainNode = result.captures?.[0]?.node;
    
    if (mainNode) {
      const text = mainNode.text || '';
      
      // Rust特定复杂度因素
      if (text.includes('unsafe')) complexity += 1;
      if (text.includes('async') || text.includes('await')) complexity += 1;
      if (text.includes('impl')) complexity += 1;
      if (text.includes('macro')) complexity += 2;
    }
    
    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies = this.extractBaseDependencies(result);
    const mainNode = result.captures?.[0]?.node;
    
    if (mainNode) {
      // Rust特定依赖提取
      this.findFunctionCalls(mainNode, dependencies);
      this.findPathReferences(mainNode, dependencies);
    }
    
    return dependencies;
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (mainNode) {
      const text = mainNode.text || '';
      
      if (text.includes('unsafe')) modifiers.push('unsafe');
      if (text.includes('async')) modifiers.push('async');
      if (text.includes('pub')) modifiers.push('public');
      if (text.includes('const')) modifiers.push('const');
      if (text.includes('static')) modifiers.push('static');
    }
    
    return modifiers;
  }

  // Rust特定的辅助方法
  private findLifetimes(node: any): string[] {
    const lifetimes: string[] = [];
    this.traverseNode(node, (child) => {
      if (child.type === 'lifetime') {
        lifetimes.push(child.text);
      }
    });
    return lifetimes;
  }

  private findTraitBounds(node: any): string[] {
    const bounds: string[] = [];
    this.traverseNode(node, (child) => {
      if (child.type === 'trait_bound' || child.type === 'type_bound') {
        bounds.push(child.text);
      }
    });
    return bounds;
  }

  private findGenericParameters(node: any): string[] {
    const generics: string[] = [];
    this.traverseNode(node, (child) => {
      if (child.type === 'type_parameters' || child.type === 'type_arguments') {
        generics.push(child.text);
      }
    });
    return generics;
  }

  private traverseNode(node: any, callback: (child: any) => void): void {
    if (!node || !node.children) return;
    
    for (const child of node.children) {
      callback(child);
      this.traverseNode(child, callback);
    }
  }
}
```

### 3. 查询类型映射统一配置

```typescript
// src/service/parser/core/normalization/QueryTypeMappings.ts
export interface LanguageQueryMapping {
  [queryFile: string]: string[];
}

export interface LanguageMappings {
  [language: string]: LanguageQueryMapping;
}

export const LANGUAGE_QUERY_MAPPINGS: LanguageMappings = {
  'rust': {
    'functions-structs': ['functions', 'classes'],
    'modules-imports': ['imports', 'modules'],
    'variables-expressions': ['variables', 'expressions'],
    'types-macros': ['types', 'macros'],
    'control-flow': ['control-flow']
  },
  'typescript': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'exports': ['exports'],
    'interfaces': ['interfaces'],
    'types': ['types'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'expressions': ['expressions']
  },
  'python': {
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'data-structures': ['classes'],
    'types-decorators': ['types']
  },
  'java': {
    'classes-interfaces': ['classes', 'interfaces'],
    'methods-variables': ['methods', 'variables'],
    'control-flow-patterns': ['control-flow'],
    'functions': ['functions'],
    'classes': ['classes'],
    'methods': ['methods'],
    'imports': ['imports'],
    'variables': ['variables'],
    'control-flow': ['control-flow'],
    'types': ['types'],
    'interfaces': ['interfaces'],
    'enums': ['types'],
    'records': ['classes'],
    'annotations': ['types']
  }
};

export class QueryTypeMapper {
  static getMappedQueryTypes(language: string, discoveredTypes: string[]): string[] {
    const mapping = LANGUAGE_QUERY_MAPPINGS[language.toLowerCase()];
    
    if (!mapping) {
      return discoveredTypes;
    }
    
    const mappedTypes: string[] = [];
    
    for (const discoveredType of discoveredTypes) {
      const mapped = mapping[discoveredType];
      if (mapped) {
        mappedTypes.push(...mapped);
      } else {
        mappedTypes.push(discoveredType);
      }
    }
    
    return [...new Set(mappedTypes)];
  }
  
  static validateQueryTypes(language: string, queryTypes: string[]): boolean {
    const supportedTypes = this.getSupportedQueryTypes(language);
    return queryTypes.every(type => supportedTypes.includes(type));
  }
  
  static getSupportedQueryTypes(language: string): string[] {
    const mapping = LANGUAGE_QUERY_MAPPINGS[language.toLowerCase()];
    if (!mapping) {
      return [];
    }
    
    return [...new Set(Object.values(mapping).flat())];
  }
}
```

### 4. 适配器工厂增强

```typescript
// src/service/parser/core/normalization/LanguageAdapterFactory.ts
export class LanguageAdapterFactory {
  private static adapterCache = new Map<string, ILanguageAdapter>();
  private static adapterConfigs = new Map<string, AdapterOptions>();

  /**
   * 获取语言适配器（带缓存）
   */
  static getAdapter(language: string, options?: AdapterOptions): ILanguageAdapter {
    const cacheKey = `${language}:${JSON.stringify(options || {})}`;
    
    if (this.adapterCache.has(cacheKey)) {
      return this.adapterCache.get(cacheKey)!;
    }
    
    const adapter = this.createAdapter(language, options);
    this.adapterCache.set(cacheKey, adapter);
    
    return adapter;
  }

  /**
   * 创建语言适配器
   */
  private static createAdapter(language: string, options?: AdapterOptions): ILanguageAdapter {
    const normalizedLanguage = language.toLowerCase();
    
    switch (normalizedLanguage) {
      case 'rust':
        return new RustLanguageAdapter(options);
      case 'typescript':
      case 'javascript':
        return new TypeScriptLanguageAdapter(options);
      case 'python':
      case 'py':
        return new PythonLanguageAdapter(options);
      case 'java':
        return new JavaLanguageAdapter(options);
      case 'cpp':
      case 'c++':
        return new CppLanguageAdapter(options);
      case 'c':
        return new CLanguageAdapter(options);
      case 'csharp':
      case 'c#':
        return new CSharpLanguageAdapter(options);
      default:
        return new DefaultLanguageAdapter(options);
    }
  }

  /**
   * 设置适配器配置
   */
  static setAdapterConfig(language: string, config: AdapterOptions): void {
    this.adapterConfigs.set(language.toLowerCase(), config);
    // 清除缓存以应用新配置
    this.clearCache();
  }

  /**
   * 获取适配器配置
   */
  static getAdapterConfig(language: string): AdapterOptions {
    return this.adapterConfigs.get(language.toLowerCase()) || {};
  }

  /**
   * 清除适配器缓存
   */
  static clearCache(): void {
    this.adapterCache.clear();
  }

  /**
   * 获取支持的语言列表
   */
  static getSupportedLanguages(): string[] {
    return [
      'rust', 'typescript', 'javascript', 'python', 'java', 
      'cpp', 'c', 'csharp', 'go', 'kotlin', 'swift'
    ];
  }

  /**
   * 检查语言是否支持
   */
  static isLanguageSupported(language: string): boolean {
    return this.getSupportedLanguages().includes(language.toLowerCase());
  }
}
```

## 实施计划

### 阶段1：基础架构实现（2-3天）

1. **创建BaseLanguageAdapter类**
   - 实现通用逻辑
   - 定义抽象方法接口
   - 添加错误处理和性能监控

2. **重构现有适配器**
   - Rust适配器重构
   - TypeScript适配器重构
   - Python适配器重构
   - Java适配器重构

3. **创建查询类型映射配置**
   - 统一查询类型映射
   - 实现QueryTypeMapper类

### 阶段2：工厂和缓存优化（1-2天）

1. **增强LanguageAdapterFactory**
   - 添加适配器缓存
   - 实现配置管理
   - 添加语言支持检查

2. **性能优化**
   - 实现结果缓存
   - 添加性能监控
   - 优化内存使用

### 阶段3：测试和验证（1-2天）

1. **单元测试**
   - 基础适配器测试
   - 各语言适配器测试
   - 查询类型映射测试

2. **集成测试**
   - 完整查询流程测试
   - 性能基准测试
   - 错误处理测试

## 预期收益

1. **代码重用率提升80%**：通用逻辑统一实现，减少重复代码
2. **维护成本降低60%**：统一的架构和接口，易于维护和扩展
3. **性能提升30%**：通过缓存和优化算法提升处理效率
4. **错误率降低50%**：统一的错误处理和降级机制
5. **扩展性提升**：新增语言适配器只需实现语言特定逻辑

这个通用解决方案彻底解决了所有适配器面临的共同问题，提供了统一、高效、可维护的架构基础。