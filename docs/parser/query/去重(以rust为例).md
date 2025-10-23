# Rust查询结果标准化优化方案

## 概述

本文档详细描述了针对Rust语言查询结果标准化的优化方案，旨在解决当前系统中存在的去重机制不完善、查询类型映射不匹配等问题，提升Rust代码解析和分割的质量。

## 问题分析

### 1. 当前问题

#### 1.1 去重机制不完善
- **问题**：Rust适配器缺少有效的去重机制
- **影响**：可能导致重复结构被多次处理，影响分割质量和性能
- **位置**：[`RustLanguageAdapter.normalize()`](src/service/parser/core/normalization/adapters/RustLanguageAdapter.ts:15-43)

#### 1.2 查询类型映射不匹配
- **问题**：查询常量文件名与适配器期望的查询类型不完全匹配
- **影响**：可能导致查询加载失败或结果不正确
- **对比**：
  ```
  查询文件: functions-structs.ts, modules-imports.ts, variables-expressions.ts, types-macros.ts, control-flow.ts
  适配器期望: functions, classes, methods, imports, variables, control-flow, types, expressions, macros, modules
  ```

#### 1.3 集成机制可优化
- **问题**：与universal模块的集成缺少直接交互
- **影响**：降级时无法利用标准化结果

### 2. 根本原因

1. **架构设计**：查询文件命名与适配器接口设计不一致
2. **实现缺失**：去重逻辑未在适配器中实现
3. **集成策略**：缺少跨模块的深度集成机制

## 优化方案

### 1. 核心优化策略

#### 1.1 实现智能去重机制

**目标**：消除重复查询结果，提升处理效率

**实现方案**：
```typescript
// 在RustLanguageAdapter中集成去重逻辑
normalize(queryResults: any[], queryType: string, language: string): StandardizedQueryResult[] {
  // 1. 转换查询结果
  const convertedResults = this.convertQueryResults(queryResults, queryType, language);
  
  // 2. 智能去重
  const deduplicatedResults = this.deduplicateResults(convertedResults);
  
  // 3. 按行号排序
  return deduplicatedResults.sort((a, b) => a.startLine - b.startLine);
}

private deduplicateResults(results: StandardizedQueryResult[]): StandardizedQueryResult[] {
  const seen = new Map<string, StandardizedQueryResult>();
  
  for (const result of results) {
    // 创建唯一键：类型 + 名称 + 起始行
    const key = `${result.type}:${result.name}:${result.startLine}`;
    
    if (!seen.has(key)) {
      seen.set(key, result);
    } else {
      // 合并重复项的元数据
      const existing = seen.get(key)!;
      this.mergeMetadata(existing, result);
    }
  }
  
  return Array.from(seen.values());
}
```

#### 1.2 增强集成机制

**目标**：改善与universal模块的集成

**实现方案**：
```typescript
// 在UniversalTextSplitter中添加可选的标准化支持
async chunkBySemanticBoundaries(content: string, filePath?: string, language?: string): Promise<CodeChunk[]> {
  // 尝试使用标准化结果（如果可用）
  if (this.queryNormalizer && this.treeSitterService) {
    try {
      const parseResult = await this.treeSitterService.parseCode(content, language);
      if (parseResult.success && parseResult.ast) {
        const standardizedResults = await this.queryNormalizer.normalize(parseResult.ast, language);
        if (standardizedResults.length > 0) {
          return this.chunkByStandardizedResults(standardizedResults, content, language, filePath);
        }
      }
    } catch (error) {
      this.logger?.debug('Standardization failed, falling back to text-based chunking');
    }
  }
  
  // 回退到原有的文本分段逻辑
  return this.chunkByTextAnalysis(content, filePath, language);
}
```

### 2. 实施计划

#### 阶段1：核心功能实现（1-2天）

**任务清单**：
- [ ] 实现RustQueryResultConverter类
- [ ] 更新RustLanguageAdapter集成去重机制
- [ ] 修复QueryLoader的Rust查询类型映射
- [ ] 编写单元测试

**验收标准**：
- 去重机制正确工作
- 查询类型映射匹配
- 所有现有测试通过

#### 阶段2：集成优化（1天）

**任务清单**：
- [ ] 增强UniversalTextSplitter集成
- [ ] 实现降级策略优化
- [ ] 添加性能监控

**验收标准**：
- 集成测试通过
- 性能指标改善
- 错误处理完善

### 3. 技术实现细节

#### 3.1 去重算法优化

```typescript
/**
 * 智能去重算法
 * 1. 基于位置和内容的精确去重
 * 2. 语义相似度去重（可选）
 * 3. 元数据合并策略
 */
private deduplicateResults(results: StandardizedQueryResult[]): StandardizedQueryResult[] {
  // 第一阶段：精确去重
  const exactDeduplicated = this.exactDeduplication(results);
  
  // 第二阶段：语义去重（可选，通过配置启用）
  if (this.options.enableSemanticDeduplication) {
    return this.semanticDeduplication(exactDeduplicated);
  }
  
  return exactDeduplicated;
}

private exactDeduplication(results: StandardizedQueryResult[]): StandardizedQueryResult[] {
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

private generateUniqueKey(result: StandardizedQueryResult): string {
  // 使用类型、名称和位置生成唯一键
  return `${result.type}:${result.name}:${result.startLine}:${result.endLine}`;
}
```

#### 3.2 查询类型映射增强

```typescript
// 在QueryLoader中添加
private static languageSpecificMappings: Record<string, Record<string, string[]>> = {
  'rust': {
    'functions-structs': ['functions', 'classes'],
    'modules-imports': ['imports', 'modules'],
    'variables-expressions': ['variables', 'expressions'],
    'types-macros': ['types', 'macros'],
    'control-flow': ['control-flow']
  }
};

static async getQueryTypesForLanguage(language: string): Promise<string[]> {
  // 检查是否有语言特定映射
  const mapping = this.languageSpecificMappings[language];
  if (mapping) {
    const discoveredTypes = await this.discoverQueryTypes(language);
    const mappedTypes: string[] = [];
    
    for (const discoveredType of discoveredTypes) {
      const mapped = mapping[discoveredType];
      if (mapped) {
        mappedTypes.push(...mapped);
      } else {
        mappedTypes.push(discoveredType);
      }
    }
    
    return [...new Set(mappedTypes)]; // 去重
  }
  
  // 回退到默认逻辑
  return this.discoverQueryTypes(language);
}
```

#### 3.3 性能优化策略

```typescript
/**
 * 性能优化策略
 * 1. 结果缓存
 * 2. 增量更新
 * 3. 并行处理
 */
class PerformanceOptimizedRustAdapter extends RustLanguageAdapter {
  private resultCache = new LRUCache<string, StandardizedQueryResult[]>(100);
  private processingStats = new Map<string, ProcessingStats>();
  
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const cacheKey = this.generateCacheKey(queryResults, queryType, language);
    
    // 检查缓存
    if (this.resultCache.has(cacheKey)) {
      return this.resultCache.get(cacheKey)!;
    }
    
    const startTime = Date.now();
    
    // 并行处理大型结果集
    const results = queryResults.length > 1000 
      ? await this.parallelNormalize(queryResults, queryType, language)
      : this.normalizeSequential(queryResults, queryType, language);
    
    // 缓存结果
    this.resultCache.set(cacheKey, results);
    
    // 记录性能统计
    this.recordProcessingStats(queryType, Date.now() - startTime, results.length);
    
    return results;
  }
  
  private async parallelNormalize(
    queryResults: any[], 
    queryType: string, 
    language: string
  ): Promise<StandardizedQueryResult[]> {
    const chunkSize = 100;
    const chunks = [];
    
    for (let i = 0; i < queryResults.length; i += chunkSize) {
      chunks.push(queryResults.slice(i, i + chunkSize));
    }
    
    const results = await Promise.all(
      chunks.map(chunk => this.normalizeSequential(chunk, queryType, language))
    );
    
    return results.flat();
  }
}
```
