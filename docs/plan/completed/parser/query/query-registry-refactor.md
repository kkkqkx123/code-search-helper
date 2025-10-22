# QueryRegistry 重构方案

## 当前实现分析

当前的 [`QueryRegistry`](src/service/parser/core/query/QueryRegistry.ts) 直接从 [`SimpleQueryPatterns.ts`](src/service/parser/core/query/SimpleQueryPatterns.ts) 加载简化的查询模式。重构目标是将其改为从 [`constants/queries/`](src/service/parser/constants/queries/) 目录加载完整的查询语句。

## 重构后的 QueryRegistry

### 新的类结构

```typescript
// src/service/parser/core/query/QueryRegistry.ts (重构后)
import { QueryLoader } from './QueryLoader';
import { QueryTransformer } from './QueryTransformer';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 查询注册表 - 管理所有语言的查询模式
 * 重构版本：从常量查询文件加载，通过转换层提取特定模式
 */
export class QueryRegistry {
  private static patterns: Map<string, Map<string, string>> = new Map();
  private static queryLoader = new QueryLoader();
  private static logger = new LoggerService();
  private static initialized = false;

  /**
   * 异步初始化查询注册表
   */
  static async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.logger.info('初始化查询注册表...');
    
    try {
      // 初始化查询转换器
      QueryTransformer.initialize();
      
      // 从常量查询文件加载
      await this.loadFromConstants();
      
      this.initialized = true;
      this.logger.info(`查询注册表初始化完成，支持 ${this.patterns.size} 种语言`);
      
    } catch (error) {
      this.logger.error('查询注册表初始化失败:', error);
      throw error;
    }
  }

  /**
   * 从常量查询文件加载查询模式
   */
  private static async loadFromConstants(): Promise<void> {
    const languages = this.getSupportedLanguages();
    
    for (const language of languages) {
      try {
        await this.loadLanguageQueries(language);
      } catch (error) {
        this.logger.warn(`加载 ${language} 语言查询失败:`, error);
        // 继续加载其他语言，不中断整个初始化过程
      }
    }
  }

  /**
   * 加载指定语言的查询
   */
  private static async loadLanguageQueries(language: string): Promise<void> {
    this.logger.debug(`加载 ${language} 语言查询...`);
    
    // 加载完整的查询文件
    await this.queryLoader.loadLanguageQueries(language);
    const fullQuery = this.queryLoader.getQuery(language);
    
    // 提取所有支持的模式类型
    const patternTypes = QueryTransformer.getSupportedPatternTypesForLanguage(language);
    const languagePatterns = new Map<string, string>();
    
    let loadedCount = 0;
    for (const patternType of patternTypes) {
      try {
        const pattern = QueryTransformer.extractPatternType(fullQuery, patternType, language);
        if (pattern && pattern.trim()) {
          languagePatterns.set(patternType, pattern);
          loadedCount++;
        }
      } catch (error) {
        this.logger.warn(`提取 ${language}.${patternType} 模式失败:`, error);
      }
    }
    
    this.patterns.set(language, languagePatterns);
    this.logger.debug(`成功加载 ${language} 语言的 ${loadedCount} 种查询模式`);
  }

  /**
   * 获取指定语言的查询模式
   */
  static async getPattern(language: string, queryType: string): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const langPatterns = this.patterns.get(language.toLowerCase());
    if (!langPatterns) {
      this.logger.warn(`语言 ${language} 的查询模式未加载`);
      return null;
    }

    const pattern = langPatterns.get(queryType);
    if (!pattern) {
      this.logger.debug(`查询类型 ${queryType} 在语言 ${language} 中不存在`);
      return null;
    }

    return pattern;
  }

  /**
   * 同步获取查询模式（向后兼容）
   */
  static getPatternSync(language: string, queryType: string): string | null {
    if (!this.initialized) {
      this.logger.warn('查询注册表未初始化，使用同步方式获取模式可能返回空值');
      return null;
    }

    const langPatterns = this.patterns.get(language.toLowerCase());
    return langPatterns ? langPatterns.get(queryType) || null : null;
  }

  /**
   * 获取指定语言的所有查询模式
   */
  static getPatternsForLanguage(language: string): Record<string, string> {
    const langPatterns = this.patterns.get(language.toLowerCase());
    return langPatterns ? Object.fromEntries(langPatterns) : {};
  }

  /**
   * 获取支持的所有语言
   */
  static getSupportedLanguages(): string[] {
    return [
      'javascript', 'typescript', 'python', 'java', 'go', 'rust',
      'cpp', 'c', 'csharp', 'swift', 'kotlin', 'ruby', 'php', 'scala'
    ];
  }

  /**
   * 获取指定语言支持的所有查询类型
   */
  static getQueryTypesForLanguage(language: string): string[] {
    const langPatterns = this.patterns.get(language.toLowerCase());
    return langPatterns ? Array.from(langPatterns.keys()) : [];
  }

  /**
   * 重新加载指定语言的查询
   */
  static async reloadLanguageQueries(language: string): Promise<void> {
    this.logger.info(`重新加载 ${language} 语言查询...`);
    
    // 清除相关缓存
    this.patterns.delete(language.toLowerCase());
    await this.queryLoader.reloadLanguageQueries(language);
    
    // 重新加载
    await this.loadLanguageQueries(language);
    this.logger.info(`${language} 语言查询重新加载完成`);
  }

  /**
   * 获取注册表统计信息
   */
  static getStats() {
    let totalPatterns = 0;
    const languageStats: Record<string, number> = {};

    for (const [language, patterns] of this.patterns) {
      const count = patterns.size;
      languageStats[language] = count;
      totalPatterns += count;
    }

    return {
      initialized: this.initialized,
      totalLanguages: this.patterns.size,
      totalPatterns,
      languageStats
    };
  }

  /**
   * 检查是否支持特定语言和查询类型
   */
  static isSupported(language: string, queryType?: string): boolean {
    const langPatterns = this.patterns.get(language.toLowerCase());
    if (!langPatterns) {
      return false;
    }
    
    if (queryType) {
      return langPatterns.has(queryType);
    }
    
    return true;
  }

  /**
   * 获取所有可用的查询类型
   */
  static getAllQueryTypes(): string[] {
    const allTypes = new Set<string>();
    
    for (const patterns of this.patterns.values()) {
      for (const type of patterns.keys()) {
        allTypes.add(type);
      }
    }
    
    return Array.from(allTypes);
  }
}
```

## 向后兼容性处理

### 兼容性包装器

```typescript
// src/service/parser/core/query/QueryRegistryCompatibility.ts
import { QueryRegistry } from './QueryRegistry';

/**
 * 向后兼容性包装器
 * 确保现有代码无需修改即可继续工作
 */
export class QueryRegistryCompatibility {
  /**
   * 静态初始化（保持与旧版本相同的API）
   */
  static initialize(): void {
    // 异步初始化，但提供同步接口
    QueryRegistry.initialize().catch(error => {
      console.error('QueryRegistry异步初始化失败:', error);
    });
  }

  /**
   * 获取查询模式（同步版本，向后兼容）
   */
  static getPattern(language: string, queryType: string): string | null {
    return QueryRegistry.getPatternSync(language, queryType);
  }

  /**
   * 异步获取查询模式（新功能）
   */
  static async getPatternAsync(language: string, queryType: string): Promise<string | null> {
    return await QueryRegistry.getPattern(language, queryType);
  }

  /**
   * 其他方法保持相同签名
   */
  static getPatternsForLanguage(language: string): Record<string, string> {
    return QueryRegistry.getPatternsForLanguage(language);
  }

  static getSupportedLanguages(): string[] {
    return QueryRegistry.getSupportedLanguages();
  }

  static getQueryTypesForLanguage(language: string): string[] {
    return QueryRegistry.getQueryTypesForLanguage(language);
  }
}

// 保持原有的导出方式
export { QueryRegistryCompatibility as QueryRegistry };
```

### 渐进式迁移策略

1. **阶段一**：引入新的 QueryRegistry，但保持旧接口
2. **阶段二**：更新内部调用使用新接口
3. **阶段三**：移除兼容性包装器

## 集成到现有系统

### 更新 TreeSitterCoreService

```typescript
// src/service/parser/core/parse/TreeSitterCoreService.ts (部分更新)
export class TreeSitterCoreService {
  private queryRegistry: typeof QueryRegistry;

  constructor() {
    // 使用新的查询注册表
    this.queryRegistry = QueryRegistry;
    
    // 异步初始化
    this.initializeQuerySystem();
  }

  private async initializeQuerySystem(): Promise<void> {
    try {
      await this.queryRegistry.initialize();
      this.logger.info('查询系统初始化完成');
    } catch (error) {
      this.logger.error('查询系统初始化失败:', error);
    }
  }

  async extractFunctions(ast: any, language?: string): Promise<any[]> {
    const lang = language || 'javascript';
    
    try {
      // 使用新的异步接口
      const functionQuery = await this.queryRegistry.getPattern(lang, 'functions');
      if (!functionQuery) {
        this.logger.warn(`未找到 ${lang} 语言的函数查询模式`);
        return this.fallbackExtractFunctions(ast);
      }
      
      return this.queryTree(ast, functionQuery);
    } catch (error) {
      this.logger.error('函数提取失败:', error);
      return this.fallbackExtractFunctions(ast);
    }
  }
}
```

### 更新 QueryManager

```typescript
// src/service/parser/core/query/QueryManager.ts (更新后)
export class QueryManager {
  private static queryRegistry = QueryRegistry;

  static async initialize(): Promise<void> {
    await this.queryRegistry.initialize();
  }

  static async getQuery(language: string, queryType: string): Promise<string> {
    const query = await this.queryRegistry.getPattern(language, queryType);
    if (!query) {
      throw new Error(`未找到 ${language}.${queryType} 的查询模式`);
    }
    return query;
  }

  // 其他方法相应更新...
}
```

## 测试策略

### 单元测试

```typescript
// src/service/parser/core/__tests__/query/QueryRegistry.test.ts
describe('QueryRegistry (重构后)', () => {
  beforeEach(async () => {
    await QueryRegistry.initialize();
  });

  test('should load queries from constants directory', async () => {
    const functionQuery = await QueryRegistry.getPattern('javascript', 'functions');
    expect(functionQuery).toBeTruthy();
    expect(functionQuery).toContain('function_declaration');
  });

  test('should support all previously supported languages', () => {
    const languages = QueryRegistry.getSupportedLanguages();
    expect(languages).toContain('javascript');
    expect(languages).toContain('typescript');
    expect(languages).toContain('python');
  });

  test('should provide backward compatibility', () => {
    // 测试同步接口仍然工作
    const functionQuery = QueryRegistry.getPatternSync('javascript', 'functions');
    expect(functionQuery).toBeTruthy();
  });
});
```

### 集成测试

```typescript
// src/service/parser/core/__tests__/query/QueryRegistryIntegration.test.ts
describe('QueryRegistry Integration', () => {
  test('should work with TreeSitterCoreService', async () => {
    const service = new TreeSitterCoreService();
    const jsCode = `function test() { return "hello"; }`;
    
    const parseResult = await service.parseCode(jsCode, 'javascript');
    const functions = await service.extractFunctions(parseResult.ast, 'javascript');
    
    expect(functions.length).toBeGreaterThan(0);
  });
});
```

## 性能优化

### 缓存策略

1. **查询结果缓存**：转换后的查询模式应该被缓存
2. **文件加载缓存**：查询文件内容应该被缓存
3. **内存管理**：实现LRU缓存策略避免内存泄漏

### 懒加载优化

1. **按需加载**：只在第一次使用时加载查询文件
2. **预加载常用语言**：可以预加载JavaScript、TypeScript等常用语言
3. **后台加载**：在空闲时加载其他语言查询

## 错误处理

1. **优雅降级**：如果查询加载失败，使用默认模式
2. **详细日志**：记录加载过程中的错误信息
3. **重试机制**：对于临时性错误实现重试逻辑

## 迁移检查清单

- [ ] 更新 QueryRegistry 实现
- [ ] 创建 QueryTransformer
- [ ] 更新相关服务类
- [ ] 更新测试文件
- [ ] 验证向后兼容性
- [ ] 性能测试
- [ ] 文档更新