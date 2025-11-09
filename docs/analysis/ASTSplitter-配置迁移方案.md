# AST Splitter 配置迁移方案

## 概述

本文档提供了将 `ASTCodeSplitter` 配置从 `src/utils/processing` 迁移到 `src/config` 目录的详细方案，以复用现有的配置有效性检查机制，并支持直接从 `.env` 文件选择配置方案。

## 迁移优势

1. **统一配置管理**：与项目其他配置保持一致的管理方式
2. **环境变量支持**：通过 `.env` 文件直接选择配置方案
3. **配置验证复用**：利用现有的 Joi 验证机制
4. **类型安全**：保持 TypeScript 类型检查
5. **依赖注入集成**：与现有的 DI 容器无缝集成

## 迁移步骤

### 第一步：创建 AST Splitter 配置类型

在 `src/config/ConfigTypes.ts` 中添加 AST Splitter 配置接口：

```typescript
// AST Splitter 配置接口
export interface ASTSplitterConfig {
  // 基础大小限制
  maxFunctionSize?: number;
  maxClassSize?: number;
  maxNamespaceSize?: number;
  minFunctionLines?: number;
  minClassLines?: number;
  maxChunkSize?: number;
  minChunkSize?: number;
  
  // 嵌套提取控制
  enableNestedExtraction?: boolean;
  maxNestingLevel?: number;
  preserveNestedMethods?: boolean;
  preserveNestedFunctions?: boolean;
  preserveNestedClasses?: boolean;
  
  // 语义边界控制
  preferSemanticBoundaries?: boolean;
  extractImports?: boolean;
  extractNamespaces?: boolean;
  extractTemplates?: boolean;
  
  // 降级策略
  fallbackStrategies?: string[];
  enableFallback?: boolean;
  fallbackThreshold?: number;
  
  // 性能配置
  performance?: {
    enableCaching?: boolean;
    maxCacheSize?: number;
    enableParallelProcessing?: boolean;
    maxConcurrency?: number;
    timeout?: number;
    memoryLimit?: number;
  };
  
  // 提取配置
  extraction?: {
    structureTypes?: string[];
    minStructureSize?: number;
    maxStructureSize?: number;
    extractComments?: boolean;
    extractDocstrings?: boolean;
    extractTypeDefinitions?: boolean;
  };
  
  // 验证配置
  validation?: {
    enableValidation?: boolean;
    strictMode?: boolean;
    customRules?: Array<{
      name: string;
      pattern: RegExp;
      action: 'include' | 'exclude';
    }>;
  };
  
  // 语言特定配置
  languageSpecific?: {
    [language: string]: {
      [key: string]: any;
    };
  };
  
  // 高级选项
  advanced?: {
    enableExperimental?: boolean;
    debugMode?: boolean;
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    customProcessors?: Array<{
      name: string;
      priority: number;
      processor: (content: string, language: string) => any[];
    }>;
  };
}

// 配置方案枚举
export enum ASTSplitterConfigMode {
  DEFAULT = 'default',
  HIGH_PERFORMANCE = 'high-performance',
  HIGH_QUALITY = 'high-quality',
  LANGUAGE_SPECIFIC = 'language-specific',
  CUSTOM = 'custom'
}
```

### 第二步：创建配置验证模式

在 `src/config/validation/ConfigValidation.ts` 中添加 AST Splitter 验证模式：

```typescript
// AST Splitter 配置验证模式
export const astSplitterSchema = Joi.object({
  // 基础大小限制
  maxFunctionSize: Joi.number().positive().default(1000),
  maxClassSize: Joi.number().positive().default(2000),
  maxNamespaceSize: Joi.number().positive().default(3000),
  minFunctionLines: Joi.number().positive().default(3),
  minClassLines: Joi.number().positive().default(2),
  maxChunkSize: Joi.number().positive().default(1500),
  minChunkSize: Joi.number().positive().default(50),
  
  // 嵌套提取控制
  enableNestedExtraction: Joi.boolean().default(true),
  maxNestingLevel: Joi.number().positive().default(2),
  preserveNestedMethods: Joi.boolean().default(true),
  preserveNestedFunctions: Joi.boolean().default(false),
  preserveNestedClasses: Joi.boolean().default(false),
  
  // 语义边界控制
  preferSemanticBoundaries: Joi.boolean().default(true),
  extractImports: Joi.boolean().default(true),
  extractNamespaces: Joi.boolean().default(true),
  extractTemplates: Joi.boolean().default(true),
  
  // 降级策略
  fallbackStrategies: Joi.array().items(Joi.string()).default(['line-based', 'bracket-balancing']),
  enableFallback: Joi.boolean().default(true),
  fallbackThreshold: Joi.number().min(0).max(1).default(0.5),
  
  // 性能配置
  performance: Joi.object({
    enableCaching: Joi.boolean().default(true),
    maxCacheSize: Joi.number().positive().default(1000),
    enableParallelProcessing: Joi.boolean().default(true),
    maxConcurrency: Joi.number().positive().default(4),
    timeout: Joi.number().positive().default(30000),
    memoryLimit: Joi.number().positive().default(512),
  }).optional(),
  
  // 提取配置
  extraction: Joi.object({
    structureTypes: Joi.array().items(Joi.string()).default(['function', 'class', 'namespace', 'import', 'template']),
    minStructureSize: Joi.number().positive().default(10),
    maxStructureSize: Joi.number().positive().default(5000),
    extractComments: Joi.boolean().default(false),
    extractDocstrings: Joi.boolean().default(true),
    extractTypeDefinitions: Joi.boolean().default(true),
  }).optional(),
  
  // 验证配置
  validation: Joi.object({
    enableValidation: Joi.boolean().default(true),
    strictMode: Joi.boolean().default(false),
    customRules: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      pattern: Joi.object().required(),
      action: Joi.string().valid('include', 'exclude').required(),
    })).default([]),
  }).optional(),
  
  // 语言特定配置
  languageSpecific: Joi.object().pattern(Joi.string(), Joi.object()).optional(),
  
  // 高级选项
  advanced: Joi.object({
    enableExperimental: Joi.boolean().default(false),
    debugMode: Joi.boolean().default(false),
    logLevel: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    customProcessors: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      priority: Joi.number().required(),
      processor: Joi.function().required(),
    })).default([]),
  }).optional(),
});

// 更新主配置验证模式
export const mainConfigSchema = Joi.object({
  // ... 现有配置
  astSplitter: astSplitterSchema,
});
```

### 第三步：创建 AST Splitter 配置服务

创建 `src/config/service/ASTSplitterConfigService.ts`：

```typescript
import { injectable } from 'inversify';
import { ASTSplitterConfig, ASTSplitterConfigMode } from '../ConfigTypes';
import { ValidationUtils } from '../utils/ValidationUtils';
import { astSplitterSchema } from '../validation/ConfigValidation';

@injectable()
export class ASTSplitterConfigService {
  private config: ASTSplitterConfig | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    // 从环境变量获取配置模式
    const configMode = process.env.AST_SPLITTER_CONFIG_MODE || ASTSplitterConfigMode.DEFAULT;
    
    // 根据模式创建配置
    this.config = this.createConfigByMode(configMode);
    
    // 应用环境变量覆盖
    this.applyEnvironmentOverrides();
    
    // 验证配置
    this.validateConfig();
  }

  private createConfigByMode(mode: string): ASTSplitterConfig {
    switch (mode) {
      case ASTSplitterConfigMode.HIGH_PERFORMANCE:
        return this.createHighPerformanceConfig();
      
      case ASTSplitterConfigMode.HIGH_QUALITY:
        return this.createHighQualityConfig();
      
      case ASTSplitterConfigMode.LANGUAGE_SPECIFIC:
        const language = process.env.AST_SPLITTER_TARGET_LANGUAGE || 'typescript';
        return this.createLanguageSpecificConfig(language);
      
      case ASTSplitterConfigMode.CUSTOM:
        return this.createCustomConfig();
      
      default:
        return this.createDefaultConfig();
    }
  }

  private createDefaultConfig(): ASTSplitterConfig {
    return {
      // 基础大小限制
      maxFunctionSize: 1000,
      maxClassSize: 2000,
      maxNamespaceSize: 3000,
      minFunctionLines: 3,
      minClassLines: 2,
      maxChunkSize: 1500,
      minChunkSize: 50,
      
      // 嵌套提取控制
      enableNestedExtraction: true,
      maxNestingLevel: 2,
      preserveNestedMethods: true,
      preserveNestedFunctions: false,
      preserveNestedClasses: false,
      
      // 语义边界控制
      preferSemanticBoundaries: true,
      extractImports: true,
      extractNamespaces: true,
      extractTemplates: true,
      
      // 降级策略
      fallbackStrategies: ['line-based', 'bracket-balancing'],
      enableFallback: true,
      fallbackThreshold: 0.5,
      
      // 性能配置
      performance: {
        enableCaching: true,
        maxCacheSize: 1000,
        enableParallelProcessing: true,
        maxConcurrency: 4,
        timeout: 30000,
        memoryLimit: 512
      },
      
      // 提取配置
      extraction: {
        structureTypes: ['function', 'class', 'namespace', 'import', 'template'],
        minStructureSize: 10,
        maxStructureSize: 5000,
        extractComments: false,
        extractDocstrings: true,
        extractTypeDefinitions: true
      },
      
      // 验证配置
      validation: {
        enableValidation: true,
        strictMode: false,
        customRules: []
      },
      
      // 高级选项
      advanced: {
        enableExperimental: false,
        debugMode: false,
        logLevel: 'info',
        customProcessors: []
      }
    };
  }

  private createHighPerformanceConfig(): ASTSplitterConfig {
    const config = this.createDefaultConfig();
    
    // 优化性能设置
    if (config.performance) {
      config.performance.enableCaching = true;
      config.performance.maxCacheSize = 2000;
      config.performance.enableParallelProcessing = true;
      config.performance.maxConcurrency = 8;
      config.performance.timeout = 15000;
    }
    
    // 禁用一些耗时功能
    if (config.extraction) {
      config.extraction.extractComments = false;
      config.extraction.extractDocstrings = false;
    }
    
    if (config.validation) {
      config.validation.strictMode = false;
    }
    
    return config;
  }

  private createHighQualityConfig(): ASTSplitterConfig {
    const config = this.createDefaultConfig();
    
    // 启用所有提取功能
    if (config.extraction) {
      config.extraction.extractComments = true;
      config.extraction.extractDocstrings = true;
      config.extraction.extractTypeDefinitions = true;
    }
    
    // 启用严格验证
    if (config.validation) {
      config.validation.strictMode = true;
    }
    
    // 启用嵌套提取
    config.enableNestedExtraction = true;
    config.maxNestingLevel = 3;
    config.preserveNestedMethods = true;
    config.preserveNestedFunctions = true;
    config.preserveNestedClasses = true;
    
    return config;
  }

  private createLanguageSpecificConfig(language: string): ASTSplitterConfig {
    const config = this.createDefaultConfig();
    
    // 根据语言调整配置
    switch (language.toLowerCase()) {
      case 'python':
        config.maxFunctionSize = 800;
        config.maxClassSize = 1500;
        if (config.extraction) {
          config.extraction.structureTypes = ['function', 'class', 'import'];
        }
        break;
        
      case 'javascript':
      case 'typescript':
        config.maxFunctionSize = 600;
        config.maxClassSize = 1200;
        if (config.extraction) {
          config.extraction.structureTypes = ['function', 'class', 'import', 'export'];
        }
        break;
        
      case 'cpp':
        config.maxNamespaceSize = 4000;
        if (config.extraction) {
          config.extraction.structureTypes = ['function', 'class', 'namespace', 'template', 'import'];
        }
        break;
        
      case 'java':
        config.maxClassSize = 2500;
        if (config.extraction) {
          config.extraction.structureTypes = ['class', 'method', 'import', 'package'];
        }
        break;
        
      case 'go':
        config.maxFunctionSize = 700;
        if (config.extraction) {
          config.extraction.structureTypes = ['function', 'struct', 'interface', 'import'];
        }
        break;
    }
    
    return config;
  }

  private createCustomConfig(): ASTSplitterConfig {
    // 从环境变量读取自定义配置
    return {
      maxFunctionSize: parseInt(process.env.AST_SPLITTER_MAX_FUNCTION_SIZE || '1000', 10),
      maxClassSize: parseInt(process.env.AST_SPLITTER_MAX_CLASS_SIZE || '2000', 10),
      maxNamespaceSize: parseInt(process.env.AST_SPLITTER_MAX_NAMESPACE_SIZE || '3000', 10),
      minFunctionLines: parseInt(process.env.AST_SPLITTER_MIN_FUNCTION_LINES || '3', 10),
      minClassLines: parseInt(process.env.AST_SPLITTER_MIN_CLASS_LINES || '2', 10),
      maxChunkSize: parseInt(process.env.AST_SPLITTER_MAX_CHUNK_SIZE || '1500', 10),
      minChunkSize: parseInt(process.env.AST_SPLITTER_MIN_CHUNK_SIZE || '50', 10),
      
      enableNestedExtraction: process.env.AST_SPLITTER_ENABLE_NESTED_EXTRACTION !== 'false',
      maxNestingLevel: parseInt(process.env.AST_SPLITTER_MAX_NESTING_LEVEL || '2', 10),
      preserveNestedMethods: process.env.AST_SPLITTER_PRESERVE_NESTED_METHODS === 'true',
      preserveNestedFunctions: process.env.AST_SPLITTER_PRESERVE_NESTED_FUNCTIONS === 'true',
      preserveNestedClasses: process.env.AST_SPLITTER_PRESERVE_NESTED_CLASSES === 'true',
      
      preferSemanticBoundaries: process.env.AST_SPLITTER_PREFER_SEMANTIC_BOUNDARIES !== 'false',
      extractImports: process.env.AST_SPLITTER_EXTRACT_IMPORTS !== 'false',
      extractNamespaces: process.env.AST_SPLITTER_EXTRACT_NAMESPACES !== 'false',
      extractTemplates: process.env.AST_SPLITTER_EXTRACT_TEMPLATES !== 'false',
      
      performance: {
        enableCaching: process.env.AST_SPLITTER_ENABLE_CACHING !== 'false',
        maxCacheSize: parseInt(process.env.AST_SPLITTER_MAX_CACHE_SIZE || '1000', 10),
        enableParallelProcessing: process.env.AST_SPLITTER_ENABLE_PARALLEL_PROCESSING !== 'false',
        maxConcurrency: parseInt(process.env.AST_SPLITTER_MAX_CONCURRENCY || '4', 10),
        timeout: parseInt(process.env.AST_SPLITTER_TIMEOUT || '30000', 10),
        memoryLimit: parseInt(process.env.AST_SPLITTER_MEMORY_LIMIT || '512', 10),
      }
    };
  }

  private applyEnvironmentOverrides(): void {
    if (!this.config) return;
    
    // 应用环境变量覆盖
    if (process.env.AST_SPLITTER_MAX_FUNCTION_SIZE) {
      this.config.maxFunctionSize = parseInt(process.env.AST_SPLITTER_MAX_FUNCTION_SIZE, 10);
    }
    
    if (process.env.AST_SPLITTER_ENABLE_CACHING) {
      if (!this.config.performance) {
        this.config.performance = {};
      }
      this.config.performance.enableCaching = process.env.AST_SPLITTER_ENABLE_CACHING === 'true';
    }
    
    // 可以添加更多环境变量覆盖
  }

  private validateConfig(): void {
    if (!this.config) return;
    
    const { error } = astSplitterSchema.validate(this.config);
    if (error) {
      throw new Error(`AST Splitter configuration validation failed: ${error.message}`);
    }
  }

  getConfig(): ASTSplitterConfig {
    if (!this.config) {
      throw new Error('AST Splitter configuration not initialized');
    }
    return { ...this.config };
  }

  updateConfig(updates: Partial<ASTSplitterConfig>): void {
    if (!this.config) {
      throw new Error('AST Splitter configuration not initialized');
    }
    
    this.config = { ...this.config, ...updates };
    this.validateConfig();
  }
}
```

### 第四步：更新环境变量配置

在 `.env.example` 中添加 AST Splitter 配置：

```bash
# AST Splitter Configuration
# 配置模式: default, high-performance, high-quality, language-specific, custom
AST_SPLITTER_CONFIG_MODE = default

# 语言特定配置的目标语言（当模式为 language-specific 时使用）
AST_SPLITTER_TARGET_LANGUAGE = typescript

# 基础配置覆盖
AST_SPLITTER_MAX_FUNCTION_SIZE = 1000
AST_SPLITTER_MAX_CLASS_SIZE = 2000
AST_SPLITTER_MAX_NAMESPACE_SIZE = 3000
AST_SPLITTER_MIN_FUNCTION_LINES = 3
AST_SPLITTER_MIN_CLASS_LINES = 2
AST_SPLITTER_MAX_CHUNK_SIZE = 1500
AST_SPLITTER_MIN_CHUNK_SIZE = 50

# 嵌套提取配置
AST_SPLITTER_ENABLE_NESTED_EXTRACTION = true
AST_SPLITTER_MAX_NESTING_LEVEL = 2
AST_SPLITTER_PRESERVE_NESTED_METHODS = true
AST_SPLITTER_PRESERVE_NESTED_FUNCTIONS = false
AST_SPLITTER_PRESERVE_NESTED_CLASSES = false

# 语义边界配置
AST_SPLITTER_PREFER_SEMANTIC_BOUNDARIES = true
AST_SPLITTER_EXTRACT_IMPORTS = true
AST_SPLITTER_EXTRACT_NAMESPACES = true
AST_SPLITTER_EXTRACT_TEMPLATES = true

# 性能配置
AST_SPLITTER_ENABLE_CACHING = true
AST_SPLITTER_MAX_CACHE_SIZE = 1000
AST_SPLITTER_ENABLE_PARALLEL_PROCESSING = true
AST_SPLITTER_MAX_CONCURRENCY = 4
AST_SPLITTER_TIMEOUT = 30000
AST_SPLITTER_MEMORY_LIMIT = 512
```

### 第五步：更新主配置服务

在 `src/config/ConfigService.ts` 中集成 AST Splitter 配置：

```typescript
import { ASTSplitterConfigService } from './service/ASTSplitterConfigService';

@injectable()
export class ConfigService {
  constructor(
    // ... 现有依赖
    @inject(TYPES.ASTSplitterConfigService) private astSplitterConfigService: ASTSplitterConfigService,
  ) { }

  async initialize(): Promise<void> {
    try {
      // ... 现有初始化代码
      
      // 添加 AST Splitter 配置
      const astSplitter = this.astSplitterConfigService.getConfig();

      // 构建完整的应用配置
      this.config = {
        // ... 现有配置
        astSplitter,
      };
    } catch (error) {
      throw new Error(`Failed to initialize configuration: ${error}`);
    }
  }
}
```

### 第六步：更新依赖注入容器

在 `src/core/registrars/BusinessServiceRegistrar.ts` 中注册 AST Splitter 配置服务：

```typescript
import { ASTSplitterConfigService } from '../../config/service/ASTSplitterConfigService';

export class BusinessServiceRegistrar {
  static register(container: Container): void {
    // ... 现有注册代码
    
    // 注册 AST Splitter 配置服务
    container.bind<ASTSplitterConfigService>(TYPES.ASTSplitterConfigService).to(ASTSplitterConfigService).inSingletonScope();
    
    // 更新 AST Splitter 注册，使用配置服务
    container.bind<ASTCodeSplitter>(TYPES.ASTCodeSplitter).toDynamicValue(context => {
      const treeSitterService = context.get<TreeSitterService>(TYPES.TreeSitterService);
      const languageDetectionService = context.get<LanguageDetectionService>(TYPES.LanguageDetectionService);
      const logger = context.get<LoggerService>(TYPES.LoggerService);
      const cacheService = context.get<ICacheService>(TYPES.CacheService);
      const performanceMonitor = context.get<IPerformanceMonitor>(TYPES.PerformanceMonitor);
      const astSplitterConfigService = context.get<ASTSplitterConfigService>(TYPES.ASTSplitterConfigService);
      
      // 从配置服务获取配置
      const config = astSplitterConfigService.getConfig();
      
      return new ASTCodeSplitter(
        treeSitterService,
        languageDetectionService,
        logger,
        cacheService,
        performanceMonitor,
        config
      );
    }).inSingletonScope();
  }
}
```

### 第七步：更新类型定义

在 `src/types.ts` 中添加新的类型：

```typescript
export const TYPES = {
  // ... 现有类型
  ASTSplitterConfigService: Symbol.for('ASTSplitterConfigService'),
};
```

## 使用示例

### 通过环境变量选择配置

```bash
# 使用高质量配置
AST_SPLITTER_CONFIG_MODE=high-quality

# 使用高性能配置
AST_SPLITTER_CONFIG_MODE=high-performance

# 使用语言特定配置
AST_SPLITTER_CONFIG_MODE=language-specific
AST_SPLITTER_TARGET_LANGUAGE=python

# 使用自定义配置
AST_SPLITTER_CONFIG_MODE=custom
AST_SPLITTER_MAX_FUNCTION_SIZE=1500
AST_SPLITTER_ENABLE_CACHING=true
```

### 运行时更新配置

```typescript
// 获取配置服务
const astSplitterConfigService = diContainer.get<ASTSplitterConfigService>(TYPES.ASTSplitterConfigService);

// 获取当前配置
const currentConfig = astSplitterConfigService.getConfig();

// 更新配置
astSplitterConfigService.updateConfig({
  maxFunctionSize: 2000,
  enableNestedExtraction: false
});
```

## 迁移检查清单

- [ ] 创建 AST Splitter 配置类型定义
- [ ] 添加配置验证模式
- [ ] 实现 AST Splitter 配置服务
- [ ] 更新环境变量配置
- [ ] 集成到主配置服务
- [ ] 更新依赖注入容器
- [ ] 更新类型定义
- [ ] 编写单元测试
- [ ] 更新文档
- [ ] 验证配置加载和验证

## 总结

通过这个迁移方案，AST Splitter 配置将完全集成到项目的配置管理系统中，提供：

1. **统一的配置管理**：与其他配置保持一致的管理方式
2. **环境变量支持**：通过 `.env` 文件灵活选择配置方案
3. **配置验证**：利用 Joi 验证确保配置正确性
4. **类型安全**：保持 TypeScript 类型检查
5. **运行时更新**：支持动态配置更新

这种方案既保持了原有配置系统的灵活性，又提供了更好的集成和管理体验。