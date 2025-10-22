# 服务模块更新方案

## 概述

为了适配新的查询系统，需要更新相关的服务模块。主要涉及以下核心服务：

1. **TreeSitterCoreService** - 核心解析服务
2. **QueryManager** - 查询管理服务  
3. **TreeSitterQueryEngine** - 查询执行引擎
4. **其他依赖查询系统的服务**

## 核心服务更新

### 1. TreeSitterCoreService 更新

```typescript
// src/service/parser/core/parse/TreeSitterCoreService.ts (更新后)
import { QueryRegistry } from '../query/QueryRegistry';
import { QueryTransformer } from '../query/QueryTransformer';
import { LoggerService } from '../../../../utils/LoggerService';

export class TreeSitterCoreService {
  private queryRegistry: typeof QueryRegistry;
  private logger: LoggerService;
  private querySystemInitialized = false;

  constructor() {
    this.logger = new LoggerService();
    this.queryRegistry = QueryRegistry;
    
    // 异步初始化查询系统
    this.initializeQuerySystem();
  }

  /**
   * 异步初始化查询系统
   */
  private async initializeQuerySystem(): Promise<void> {
    try {
      await this.queryRegistry.initialize();
      this.querySystemInitialized = true;
      this.logger.info('查询系统初始化完成');
    } catch (error) {
      this.logger.error('查询系统初始化失败:', error);
      // 即使初始化失败，服务仍可运行（使用回退机制）
    }
  }

  /**
   * 提取函数节点
   */
  async extractFunctions(ast: any, language?: string): Promise<any[]> {
    const lang = language || 'javascript';
    
    try {
      // 等待查询系统初始化
      if (!this.querySystemInitialized) {
        await this.waitForQuerySystem();
      }
      
      const functionQuery = await this.queryRegistry.getPattern(lang, 'functions');
      if (!functionQuery) {
        this.logger.warn(`未找到 ${lang} 语言的函数查询模式，使用回退机制`);
        return this.fallbackExtractFunctions(ast);
      }
      
      const results = this.queryTree(ast, functionQuery);
      this.logger.debug(`提取到 ${results.length} 个函数节点`);
      return results;
      
    } catch (error) {
      this.logger.error('函数提取失败:', error);
      return this.fallbackExtractFunctions(ast);
    }
  }

  /**
   * 提取类节点
   */
  async extractClasses(ast: any, language?: string): Promise<any[]> {
    const lang = language || 'javascript';
    
    try {
      if (!this.querySystemInitialized) {
        await this.waitForQuerySystem();
      }
      
      const classQuery = await this.queryRegistry.getPattern(lang, 'classes');
      if (!classQuery) {
        this.logger.warn(`未找到 ${lang} 语言的类查询模式，使用回退机制`);
        return this.fallbackExtractClasses(ast);
      }
      
      const results = this.queryTree(ast, classQuery);
      this.logger.debug(`提取到 ${results.length} 个类节点`);
      return results;
      
    } catch (error) {
      this.logger.error('类提取失败:', error);
      return this.fallbackExtractClasses(ast);
    }
  }

  /**
   * 提取导入节点
   */
  async extractImports(ast: any, language?: string): Promise<any[]> {
    const lang = language || 'javascript';
    
    try {
      if (!this.querySystemInitialized) {
        await this.waitForQuerySystem();
      }
      
      const importQuery = await this.queryRegistry.getPattern(lang, 'imports');
      if (!importQuery) {
        this.logger.warn(`未找到 ${lang} 语言的导入查询模式，使用回退机制`);
        return this.fallbackExtractImports(ast);
      }
      
      const results = this.queryTree(ast, importQuery);
      this.logger.debug(`提取到 ${results.length} 个导入节点`);
      return results;
      
    } catch (error) {
      this.logger.error('导入提取失败:', error);
      return this.fallbackExtractImports(ast);
    }
  }

  /**
   * 提取导出节点
   */
  async extractExports(ast: any, sourceCode: string, language?: string): Promise<string[]> {
    const lang = language || 'javascript';
    
    try {
      if (!this.querySystemInitialized) {
        await this.waitForQuerySystem();
      }
      
      const exportQuery = await this.queryRegistry.getPattern(lang, 'exports');
      if (!exportQuery) {
        this.logger.warn(`未找到 ${lang} 语言的导出查询模式，使用回退机制`);
        return this.fallbackExtractExports(ast, sourceCode);
      }
      
      const results = this.queryTree(ast, exportQuery);
      const exportStrings = this.processExportResults(results, sourceCode);
      this.logger.debug(`提取到 ${exportStrings.length} 个导出`);
      return exportStrings;
      
    } catch (error) {
      this.logger.error('导出提取失败:', error);
      return this.fallbackExtractExports(ast, sourceCode);
    }
  }

  /**
   * 等待查询系统初始化
   */
  private async waitForQuerySystem(timeout = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (!this.querySystemInitialized && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!this.querySystemInitialized) {
      throw new Error('查询系统初始化超时');
    }
  }

  /**
   * 回退机制：函数提取
   */
  private fallbackExtractFunctions(ast: any): any[] {
    this.logger.warn('使用回退机制提取函数');
    // 实现原有的硬编码提取逻辑
    return this.traverseForType(ast, ['function_declaration', 'function_expression']);
  }

  /**
   * 回退机制：类提取
   */
  private fallbackExtractClasses(ast: any): any[] {
    this.logger.warn('使用回退机制提取类');
    return this.traverseForType(ast, ['class_declaration']);
  }

  /**
   * 回退机制：导入提取
   */
  private fallbackExtractImports(ast: any): any[] {
    this.logger.warn('使用回退机制提取导入');
    return this.traverseForType(ast, ['import_statement', 'import_declaration']);
  }

  /**
   * 回退机制：导出提取
   */
  private fallbackExtractExports(ast: any, sourceCode: string): string[] {
    this.logger.warn('使用回退机制提取导出');
    const exportNodes = this.traverseForType(ast, ['export_statement', 'export_declaration']);
    return exportNodes.map(node => node.text);
  }

  /**
   * 按类型遍历AST
   */
  private traverseForType(node: any, types: string[]): any[] {
    const results: any[] = [];
    
    const traverse = (currentNode: any) => {
      if (types.includes(currentNode.type)) {
        results.push(currentNode);
      }
      
      if (currentNode.children) {
        currentNode.children.forEach((child: any) => traverse(child));
      }
    };
    
    traverse(node);
    return results;
  }

  /**
   * 获取查询系统状态
   */
  getQuerySystemStatus() {
    return {
      initialized: this.querySystemInitialized,
      stats: this.queryRegistry.getStats()
    };
  }

  /**
   * 重新初始化查询系统
   */
  async reinitializeQuerySystem(): Promise<void> {
    this.querySystemInitialized = false;
    await this.initializeQuerySystem();
  }
}
```

### 2. QueryManager 更新

```typescript
// src/service/parser/core/query/QueryManager.ts (更新后)
import { QueryRegistry } from './QueryRegistry';
import { QueryTransformer } from './QueryTransformer';
import { LoggerService } from '../../../../utils/LoggerService';

export class QueryManager {
  private static queryRegistry = QueryRegistry;
  private static logger = new LoggerService();
  private static initialized = false;

  /**
   * 异步初始化
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.queryRegistry.initialize();
      this.initialized = true;
      this.logger.info('QueryManager 初始化完成');
    } catch (error) {
      this.logger.error('QueryManager 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取查询
   */
  static async getQuery(language: string, queryType: string): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const query = await this.queryRegistry.getPattern(language, queryType);
    if (!query) {
      throw new Error(`未找到 ${language}.${queryType} 的查询模式`);
    }

    return query;
  }

  /**
   * 检查查询是否支持
   */
  static async isQuerySupported(language: string, queryType: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.queryRegistry.isSupported(language, queryType);
  }

  /**
   * 获取支持的语言列表
   */
  static getSupportedLanguages(): string[] {
    return this.queryRegistry.getSupportedLanguages();
  }

  /**
   * 获取指定语言支持的查询类型
   */
  static getQueryTypesForLanguage(language: string): string[] {
    return this.queryRegistry.getQueryTypesForLanguage(language);
  }

  /**
   * 重新加载语言查询
   */
  static async reloadLanguageQueries(language: string): Promise<void> {
    await this.queryRegistry.reloadLanguageQueries(language);
  }

  /**
   * 获取查询统计信息
   */
  static getQueryStats() {
    return this.queryRegistry.getStats();
  }

  /**
   * 获取转换器统计信息
   */
  static getTransformerStats() {
    return QueryTransformer.getCacheStats();
  }

  /**
   * 清除所有缓存
   */
  static clearAllCaches(): void {
    this.queryRegistry.clearCache();
    QueryTransformer.clearCache();
    this.logger.info('所有查询缓存已清除');
  }
}
```

### 3. TreeSitterQueryEngine 更新

```typescript
// src/service/parser/core/query/TreeSitterQueryEngine.ts (更新后)
import Parser from 'tree-sitter';
import { QueryRegistry } from './QueryRegistry';
import { LoggerService } from '../../../../utils/LoggerService';

export class TreeSitterQueryEngine {
  private patterns: Map<string, QueryPattern> = new Map();
  private cache: Map<string, QueryResult> = new Map();
  private queryRegistry: typeof QueryRegistry;
  private logger: LoggerService;
  private initialized = false;

  constructor() {
    this.logger = new LoggerService();
    this.queryRegistry = QueryRegistry;
    this.initialize();
  }

  /**
   * 异步初始化
   */
  private async initialize(): Promise<void> {
    try {
      await this.queryRegistry.initialize();
      await this.loadPatternsFromRegistry();
      this.initialized = true;
      this.logger.info('TreeSitterQueryEngine 初始化完成');
    } catch (error) {
      this.logger.error('TreeSitterQueryEngine 初始化失败:', error);
    }
  }

  /**
   * 从注册表加载模式
   */
  private async loadPatternsFromRegistry(): Promise<void> {
    const languages = this.queryRegistry.getSupportedLanguages();
    
    for (const language of languages) {
      const patternTypes = this.queryRegistry.getQueryTypesForLanguage(language);
      
      for (const patternType of patternTypes) {
        try {
          const patternString = await this.queryRegistry.getPattern(language, patternType);
          if (patternString) {
            this.addPatternFromString(patternType, patternString, language);
          }
        } catch (error) {
          this.logger.warn(`加载模式 ${language}.${patternType} 失败:`, error);
        }
      }
    }
  }

  /**
   * 从字符串添加模式
   */
  private addPatternFromString(name: string, patternString: string, language: string): void {
    const pattern: QueryPattern = {
      name: `${language}_${name}`,
      description: `Auto-generated pattern for ${language}.${name}`,
      pattern: patternString,
      languages: [language],
      captures: this.extractCapturesFromPattern(patternString)
    };

    this.patterns.set(pattern.name, pattern);
  }

  /**
   * 从模式字符串中提取捕获
   */
  private extractCapturesFromPattern(pattern: string): Record<string, string> {
    const captures: Record<string, string> = {};
    const captureRegex = /@([\w\.]+)/g;
    let match;

    while ((match = captureRegex.exec(pattern)) !== null) {
      const captureName = match[1];
      captures[captureName] = captureName.replace(/\./g, ' ');
    }

    return captures;
  }

  /**
   * 执行查询
   */
  async executeQuery(
    ast: Parser.SyntaxNode,
    patternName: string,
    language: string
  ): Promise<QueryResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const fullPatternName = `${language}_${patternName}`;
    return await this.executeQueryInternal(ast, fullPatternName, language);
  }

  /**
   * 内部查询执行
   */
  private async executeQueryInternal(
    ast: Parser.SyntaxNode,
    patternName: string,
    language: string
  ): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      const pattern = this.patterns.get(patternName);
      if (!pattern) {
        throw new Error(`Query pattern '${patternName}' not found`);
      }

      if (!pattern.languages.includes(language)) {
        throw new Error(`Pattern '${patternName}' does not support language '${language}'`);
      }

      // 检查缓存
      const cacheKey = this.generateCacheKey(ast, patternName, language);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // 执行查询
      const matches = this.executeQueryPattern(ast, pattern);

      const result: QueryResult = {
        matches,
        executionTime: Date.now() - startTime,
        success: true
      };

      // 缓存结果
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      return {
        matches: [],
        executionTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // 其他方法保持不变...
}
```

## 其他服务更新

### 4. 解析协调服务更新

```typescript
// src/service/parser/ChunkToVectorCoordinationService.ts (部分更新)
export class ChunkToVectorCoordinationService {
  private treeSitterService: TreeSitterCoreService;

  constructor() {
    this.treeSitterService = new TreeSitterCoreService();
  }

  async processCodeFile(filePath: string, content: string): Promise<CodeChunk[]> {
    try {
      // 使用新的异步接口
      const parseResult = await this.treeSitterService.parseCode(content, this.detectLanguage(filePath));
      
      if (!parseResult.success) {
        throw new Error(`解析文件失败: ${parseResult.error}`);
      }

      // 提取各种代码结构
      const functions = await this.treeSitterService.extractFunctions(parseResult.ast);
      const classes = await this.treeSitterService.extractClasses(parseResult.ast);
      const imports = await this.treeSitterService.extractImports(parseResult.ast);
      
      // 处理代码块...
      return this.processChunks(functions, classes, imports, filePath, content);
      
    } catch (error) {
      this.logger.error(`处理代码文件失败 ${filePath}:`, error);
      return [];
    }
  }
}
```

### 5. 配置管理更新

```typescript
// src/service/parser/core/config/LanguageConfigManager.ts (部分更新)
export class LanguageConfigManager {
  private queryManager: typeof QueryManager;

  constructor() {
    this.queryManager = QueryManager;
  }

  async getLanguageConfig(language: string): Promise<LanguageConfig> {
    try {
      // 检查查询支持情况
      const supportedQueries = await this.queryManager.getQueryTypesForLanguage(language);
      
      return {
        language,
        supported: supportedQueries.length > 0,
        supportedQueries,
        // 其他配置...
      };
    } catch (error) {
      return {
        language,
        supported: false,
        supportedQueries: [],
        // 其他配置...
      };
    }
  }
}
```

## 错误处理和回退机制

### 1. 分级错误处理

```typescript
// 错误处理策略
export class QueryErrorHandler {
  static async handleQueryError(
    operation: string,
    language: string,
    queryType: string,
    fallback: () => any
  ): Promise<any> {
    try {
      // 尝试主路径
      return await operation();
    } catch (error) {
      console.warn(`查询操作失败 ${language}.${queryType}:`, error);
      
      // 一级回退：尝试重新加载查询
      try {
        await QueryRegistry.reloadLanguageQueries(language);
        return await operation();
      } catch (reloadError) {
        console.warn(`重新加载查询失败:`, reloadError);
        
        // 二级回退：使用简化模式
        try {
          const simpleQuery = this.getSimpleQuery(language, queryType);
          if (simpleQuery) {
            return await this.executeWithSimpleQuery(simpleQuery);
          }
        } catch (simpleError) {
          console.warn(`简化查询失败:`, simpleError);
        }
        
        // 最终回退：使用硬编码逻辑
        return fallback();
      }
    }
  }
}
```

### 2. 健康检查

```typescript
// 健康检查服务
export class QuerySystemHealthChecker {
  static async checkHealth(): Promise<HealthStatus> {
    const status: HealthStatus = {
      queryRegistry: false,
      queryTransformer: false,
      overall: false,
      issues: []
    };

    try {
      // 检查查询注册表
      const registryStats = QueryRegistry.getStats();
      status.queryRegistry = registryStats.initialized && registryStats.totalLanguages > 0;
      
      if (!status.queryRegistry) {
        status.issues.push('查询注册表未正确初始化');
      }

      // 检查转换器
      const transformerStats = QueryTransformer.getCacheStats();
      status.queryTransformer = true; // 转换器总是可用的
      
      status.overall = status.queryRegistry && status.queryTransformer;
      
    } catch (error) {
      status.issues.push(`健康检查失败: ${error}`);
    }

    return status;
  }
}
```

## 性能监控

### 1. 性能指标收集

```typescript
// 性能监控
export class QueryPerformanceMonitor {
  private static metrics: QueryMetric[] = [];

  static recordQueryExecution(
    language: string,
    queryType: string,
    executionTime: number,
    success: boolean
  ): void {
    this.metrics.push({
      timestamp: Date.now(),
      language,
      queryType,
      executionTime,
      success
    });

    // 保持最近1000条记录
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  static getPerformanceReport(): PerformanceReport {
    const recentMetrics = this.metrics.filter(m => 
      Date.now() - m.timestamp < 24 * 60 * 60 * 1000 // 24小时内
    );

    return {
      totalQueries: recentMetrics.length,
      successRate: recentMetrics.filter(m => m.success).length / recentMetrics.length,
      averageTime: recentMetrics.reduce((sum, m) => sum + m.executionTime, 0) / recentMetrics.length,
      byLanguage: this.groupByLanguage(recentMetrics),
      byQueryType: this.groupByQueryType(recentMetrics)
    };
  }
}
```

## 迁移检查清单

- [ ] 更新 TreeSitterCoreService 使用新的查询系统
- [ ] 更新 QueryManager 集成 QueryRegistry
- [ ] 更新 TreeSitterQueryEngine 从注册表加载模式
- [ ] 更新所有依赖的服务类
- [ ] 实现错误处理和回退机制
- [ ] 添加性能监控
- [ ] 更新配置管理
- [ ] 验证服务间协作

通过这种全面的服务模块更新，可以确保整个解析系统能够充分利用新的查询架构，同时保持稳定性和性能。