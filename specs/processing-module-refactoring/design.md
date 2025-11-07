# 代码处理模块重构设计文档

## 概述

本文档基于需求规格说明和对上下游模块的实际分析，详细描述了代码处理模块重构的技术设计方案。设计重点在于建立清晰的模块架构、统一的类型系统和高效的组件协作机制，确保Processing模块专注于其核心职责：代码分割策略和后处理优化。

## 架构设计

### 整体架构描述

#### 模块层次结构

**上游模块**:
- TreeSitterCoreService: 提供AST解析、语言检测、查询执行等核心功能
- DynamicParserManager: 管理动态解析器加载、缓存和性能优化
- TreeSitterService: 提供统一的TreeSitter服务接口，委托给核心服务

**Processing模块内部**:
- Core Module: 定义核心接口和类型，提供模块间契约保障
- Types Module: 提供统一的类型定义系统，确保类型一致性
- Strategies Module: 实现各种代码分割策略（行级、语义、AST、括号平衡等）
- Factory Module: 创建和管理策略实例，提供策略注册和缓存
- Coordinator Module: 协调策略选择和执行，管理分割流程
- Post-Processing Module: 对分割结果进行优化和调整
- Constants Module: 定义processing专用常量
- Utils Module: 提供processing专用工具函数

**Parser级别模块**:
- Config Module: 提供parser级别的统一配置管理
- Detection Module: 提供parser级别的文件特征检测和语言识别
- Parser Utils Module: 提供parser级别的通用工具类
- Parser Constants Module: 定义parser级别的通用常量

**下游模块**:
- ChunkToVectorCoordinationService: 协调代码分段到向量嵌入的转换
- GraphDataMappingService: 将代码块和分析结果映射为图数据库节点和关系

**基础设施模块**:
- Monitoring: 性能监控和统计
- Protection: 系统保护机制
- Caching: 缓存服务

#### 模块间依赖关系

**上游到Processing的依赖**:
- TreeSitterCoreService → Coordinator (提供AST解析结果)
- DynamicParserManager → Coordinator (提供解析器管理)
- TreeSitterService → Coordinator (提供统一服务接口)

**Processing内部依赖**:
- Core → Types (依赖类型定义)
- Strategies → Core, Types (依赖接口和类型)
- Factory → Core, Types, Strategies (管理策略实例)
- Coordinator → Core, Types, Factory, PostProcessing (协调处理流程)
- PostProcessing → Core, Types, Utils, Constants (执行后处理)

**Parser级别依赖**:
- Config → Types (提供配置类型)
- Detection → Core, Types, Config (提供检测服务)
- Parser Utils → Types, ParserConstants (提供工具支持)

**Processing到下游的依赖**:
- Coordinator → ChunkToVectorCoordinationService (提供分割结果)
- PostProcessing → ChunkToVectorCoordinationService (提供优化结果)
- Coordinator → GraphDataMappingService (提供分割结果)
- PostProcessing → GraphDataMappingService (提供优化结果)

**基础设施依赖**:
- Monitoring → Coordinator, Strategies (性能监控)
- Protection → Coordinator (系统保护)
- Caching → Factory, Detection (缓存服务)

### 模块层次结构

#### 分层架构描述

**Layer 1: 基础层 (Foundation)**
- Types: 提供统一的类型定义系统
- Core: 定义核心接口和基础抽象

**Layer 2: 服务层 (Services)**
- Config: 提供配置管理服务
- Detection: 提供文件特征检测服务
- Factory: 提供策略创建和管理服务

**Layer 3: 处理层 (Processing)**
- Strategies: 实现各种代码分割策略
- Coordinator: 协调处理流程和策略选择
- PostProcessing: 提供后处理优化服务

**Layer 4: 工具层 (Utilities)**
- Utils: 提供processing专用工具
- Constants: 定义processing专用常量
- ParserUtils: 提供parser级别工具

**Layer 5: 基础设施层 (Infrastructure)**
- Monitoring: 性能监控服务
- Protection: 系统保护机制
- Caching: 缓存服务

#### 层间依赖关系

**基础层到服务层**:
- Types → Core (类型支持)
- Core → Config (接口支持)
- Core → Detection (接口支持)
- Core → Factory (接口支持)

**服务层到处理层**:
- Config → Strategies (配置支持)
- Detection → Strategies (特征支持)
- Factory → Strategies (策略管理)

**处理层内部**:
- Strategies → Coordinator (策略执行)
- Coordinator → PostProcessing (流程协调)

**工具层到处理层**:
- Types → Utils (类型支持)
- Types → Constants (类型支持)
- Types → ParserUtils (类型支持)
- Utils → Strategies (算法支持)
- Utils → PostProcessing (优化工具)
- Constants → Strategies (参数支持)
- Constants → PostProcessing (配置支持)

**基础设施层到处理层**:
- Monitoring → Coordinator (性能监控)
- Monitoring → Strategies (策略监控)
- Protection → Coordinator (系统保护)
- Caching → Factory (策略缓存)

## 组件设计

### 1. 核心模块 (core/)

#### 接口设计

**IProcessingStrategy.ts**
```typescript
export interface IProcessingStrategy {
  readonly name: string;
  readonly priority: number;
  readonly supportedLanguages: string[];
  
  canHandle(context: IProcessingContext): boolean;
  execute(context: IProcessingContext): Promise<ProcessingResult>;
  validateContext?(context: IProcessingContext): boolean;
  getPerformanceStats?(): StrategyPerformanceStats;
}
```

**IStrategyFactory.ts**
```typescript
export interface IStrategyFactory {
  createStrategy(strategyType: string, config?: ProcessingConfig): IProcessingStrategy;
  getAvailableStrategies(): string[];
  supportsStrategy(strategyType: string): boolean;
  registerStrategy(strategyType: string, strategyClass: StrategyConstructor): void;
  unregisterStrategy(strategyType: string): void;
}
```

**IProcessingContext.ts**
```typescript
export interface IProcessingContext {
  content: string;
  language: string;
  filePath?: string;
  config: ProcessingConfig;
  features: FileFeatures;
  metadata: ContextMetadata;
  ast?: any;
  nodeTracker?: any;
}
```

**IPostProcessor.ts**
```typescript
export interface IPostProcessor {
  readonly name: string;
  readonly priority: number;
  
  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean;
  process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]>;
}
```

**IConfigManager.ts**
```typescript
export interface IConfigManager {
  getConfig(): ProcessingConfig;
  getLanguageConfig(language: string): LanguageConfig;
  updateConfig(updates: Partial<ProcessingConfig>): void;
  resetToDefaults(): void;
  validateConfig(config: ProcessingConfig): ConfigValidationResult;
  addConfigListener(listener: ConfigChangeListener): void;
  removeConfigListener(listener: ConfigChangeListener): void;
}
```

### 2. 类型系统模块 (types/)

#### 核心类型设计

**CodeChunk.ts**
```typescript
export interface CodeChunk {
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  startLine: number;
  endLine: number;
  language: string;
  filePath?: string;
  strategy: string;
  complexity?: number;
  hash?: string;
  timestamp: number;
  type: ChunkType;
  [key: string]: any;
}

export enum ChunkType {
  FUNCTION = 'function',
  CLASS = 'class',
  IMPORT = 'import',
  EXPORT = 'export',
  GENERIC = 'generic',
  COMMENT = 'comment',
  DOCUMENTATION = 'documentation'
}
```

**Processing.ts**
```typescript
export interface ProcessingResult {
  chunks: CodeChunk[];
  success: boolean;
  executionTime: number;
  strategy: string;
  error?: string;
  metadata?: ResultMetadata;
}

export interface ResultMetadata {
  language: string;
  filePath?: string;
  chunkCount: number;
  averageChunkSize: number;
  totalSize: number;
  [key: string]: any;
}

export enum ProcessingStrategy {
  LINE = 'line',
  SEMANTIC = 'semantic',
  AST = 'ast',
  BRACKET = 'bracket',
  HYBRID = 'hybrid'
}
```

**Context.ts**
```typescript
export interface ProcessingContext implements IProcessingContext {
  content: string;
  language: string;
  filePath?: string;
  config: ProcessingConfig;
  features: FileFeatures;
  metadata: ContextMetadata;
  ast?: any;
  nodeTracker?: any;
}

export interface ContextMetadata {
  contentLength: number;
  lineCount: number;
  size: number;
  isSmallFile: boolean;
  isCodeFile: boolean;
  isStructuredFile: boolean;
  complexity: number;
  hasImports: boolean;
  hasExports: boolean;
  hasFunctions: boolean;
  hasClasses: boolean;
  [key: string]: any;
}

export class ContextBuilder {
  private context: Partial<ProcessingContext> = {};
  
  constructor(content: string) {
    this.context.content = content;
    this.context.metadata = this.initializeMetadata(content);
  }
  
  setFilePath(filePath: string): ContextBuilder;
  setLanguage(language: string): ContextBuilder;
  setConfig(config: ProcessingConfig): ContextBuilder;
  setAST(ast: any): ContextBuilder;
  setNodeTracker(nodeTracker: any): ContextBuilder;
  setFeatures(features: FileFeatures): ContextBuilder;
  addMetadata(key: string, value: any): ContextBuilder;
  build(): ProcessingContext;
}
```

**Config.ts**
```typescript
export interface ProcessingConfig {
  chunking: ChunkingConfig;
  features: FeatureConfig;
  performance: PerformanceConfig;
  languages: Record<string, LanguageConfig>;
  postProcessing: PostProcessingConfig;
}

export interface ChunkingConfig {
  maxChunkSize: number;
  minChunkSize: number;
  overlapSize: number;
  maxLinesPerChunk: number;
  minLinesPerChunk: number;
  maxOverlapRatio: number;
}

export interface FeatureConfig {
  enableAST: boolean;
  enableSemanticDetection: boolean;
  enableBracketBalance: boolean;
  enableCodeOverlap: boolean;
  enableStandardization: boolean;
  standardizationFallback: boolean;
}

export interface PerformanceConfig {
  memoryLimitMB: number;
  maxExecutionTime: number;
  enableCaching: boolean;
  cacheSizeLimit: number;
  enablePerformanceMonitoring: boolean;
}

export interface LanguageConfig {
  boundaries: BoundaryConfig;
  weights: WeightConfig;
  chunking: LanguageChunkingConfig;
}

export interface PostProcessingConfig {
  enabled: boolean;
  enabledProcessors: string[];
  processorConfigs: Record<string, any>;
}
```

**PostProcessing.ts**
```typescript
export interface PostProcessor implements IPostProcessor {
  name: string;
  priority: number;
  
  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean;
  process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]>;
}

export interface PostProcessingContext {
  originalContent: string;
  language: string;
  filePath?: string;
  config: ProcessingConfig;
  strategyName: string;
  metadata?: PostProcessingMetadata;
}

export interface PostProcessingResult {
  chunks: CodeChunk[];
  processor: string;
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface PostProcessingMetadata {
  originalChunkCount: number;
  processedChunkCount: number;
  optimizationRatio: number;
  [key: string]: any;
}
```

### 3. 策略模块 (strategies/)

#### 基础策略类

**BaseStrategy.ts**
```typescript
export abstract class BaseStrategy implements IProcessingStrategy {
  protected readonly name: string;
  protected readonly priority: number;
  protected readonly supportedLanguages: string[];
  protected performanceStats: StrategyPerformanceStats;
  
  constructor(config: StrategyConfig) {
    this.name = config.name;
    this.priority = config.priority;
    this.supportedLanguages = config.supportedLanguages;
    this.performanceStats = this.initializeStats();
  }
  
  abstract canHandle(context: IProcessingContext): boolean;
  abstract execute(context: IProcessingContext): Promise<ProcessingResult>;
  
  validateContext(context: IProcessingContext): boolean {
    return context && context.content && context.language && context.config;
  }
  
  getPerformanceStats(): StrategyPerformanceStats {
    return { ...this.performanceStats };
  }
  
  protected updatePerformanceStats(executionTime: number, success: boolean): void;
  protected initializeStats(): StrategyPerformanceStats;
}
```

#### 具体策略实现

**LineStrategy.ts**
```typescript
export class LineStrategy extends BaseStrategy {
  constructor(config: StrategyConfig) {
    super({
      ...config,
      name: 'line-strategy',
      priority: 100,
      supportedLanguages: ['*']
    });
  }
  
  canHandle(context: IProcessingContext): boolean {
    return this.validateContext(context) && 
           context.config.chunking.maxLinesPerChunk > 0;
  }
  
  async execute(context: IProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      const chunks = this.splitByLines(context);
      const result: ProcessingResult = {
        chunks,
        success: true,
        executionTime: Date.now() - startTime,
        strategy: this.name,
        metadata: this.generateMetadata(chunks, context)
      };
      
      this.updatePerformanceStats(result.executionTime, true);
      return result;
    } catch (error) {
      this.updatePerformanceStats(Date.now() - startTime, false);
      throw error;
    }
  }
  
  private splitByLines(context: IProcessingContext): CodeChunk[];
  private generateMetadata(chunks: CodeChunk[], context: IProcessingContext): ResultMetadata;
}
```

### 4. 工厂模块 (factory/)

#### 策略工厂实现

**StrategyFactory.ts**
```typescript
export class StrategyFactory implements IStrategyFactory {
  private strategies: Map<string, StrategyConstructor> = new Map();
  private instances: Map<string, IProcessingStrategy> = new Map();
  private config: ProcessingConfig;
  
  constructor(config: ProcessingConfig) {
    this.config = config;
    this.registerDefaultStrategies();
  }
  
  createStrategy(strategyType: string, config?: ProcessingConfig): IProcessingStrategy {
    const StrategyClass = this.strategies.get(strategyType);
    if (!StrategyClass) {
      throw new Error(`Unknown strategy type: ${strategyType}`);
    }
    
    const instance = new StrategyClass(config || this.config);
    this.instances.set(strategyType, instance);
    return instance;
  }
  
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
  
  supportsStrategy(strategyType: string): boolean {
    return this.strategies.has(strategyType);
  }
  
  registerStrategy(strategyType: string, strategyClass: StrategyConstructor): void {
    this.strategies.set(strategyType, strategyClass);
  }
  
  unregisterStrategy(strategyType: string): void {
    this.strategies.delete(strategyType);
    this.instances.delete(strategyType);
  }
  
  private registerDefaultStrategies(): void {
    this.registerStrategy('line', LineStrategy);
    this.registerStrategy('semantic', SemanticStrategy);
    this.registerStrategy('ast', ASTStrategy);
    this.registerStrategy('bracket', BracketStrategy);
  }
}
```

### 5. 协调器模块 (coordinator/)

#### 处理协调器实现

**ProcessingCoordinator.ts**
```typescript
export class ProcessingCoordinator {
  private strategyFactory: IStrategyFactory;
  private configManager: IConfigManager;
  private detectionService: DetectionService;
  private postProcessorCoordinator: PostProcessorCoordinator;
  private performanceMonitor: PerformanceMonitor;
  
  constructor(
    strategyFactory: IStrategyFactory,
    configManager: IConfigManager,
    detectionService: DetectionService,
    postProcessorCoordinator: PostProcessorCoordinator
  ) {
    this.strategyFactory = strategyFactory;
    this.configManager = configManager;
    this.detectionService = detectionService;
    this.postProcessorCoordinator = postProcessorCoordinator;
    this.performanceMonitor = new PerformanceMonitor();
  }
  
  async process(content: string, language: string, filePath?: string): Promise<ProcessingResult> {
    const startTime = Date.now();
    
    try {
      // 1. 创建处理上下文
      const context = await this.createContext(content, language, filePath);
      
      // 2. 选择并执行策略
      const strategy = this.selectStrategy(context);
      const result = await strategy.execute(context);
      
      // 3. 后处理
      const processedResult = await this.postProcess(result, context);
      
      // 4. 更新性能统计
      this.performanceMonitor.record(Date.now() - startTime, result.chunks.length);
      
      return processedResult;
    } catch (error) {
      return {
        chunks: [],
        success: false,
        executionTime: Date.now() - startTime,
        strategy: 'unknown',
        error: error.message
      };
    }
  }
  
  private async createContext(content: string, language: string, filePath?: string): Promise<ProcessingContext>;
  private selectStrategy(context: ProcessingContext): IProcessingStrategy;
  private async postProcess(result: ProcessingResult, context: ProcessingContext): Promise<ProcessingResult>;
}
```

### 6. 后处理模块 (post-processing/)

#### 后处理器协调器

**PostProcessorCoordinator.ts**
```typescript
export class PostProcessorCoordinator {
  private processors: Map<string, IPostProcessor> = new Map();
  private executionOrder: string[] = [];
  
  constructor() {
    this.registerDefaultProcessors();
  }
  
  async process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    let processedChunks = [...chunks];
    
    for (const processorName of this.executionOrder) {
      const processor = this.processors.get(processorName);
      if (processor && processor.shouldApply(processedChunks, context)) {
        processedChunks = await processor.process(processedChunks, context);
      }
    }
    
    return processedChunks;
  }
  
  registerProcessor(processor: IPostProcessor): void {
    this.processors.set(processor.name, processor);
    this.updateExecutionOrder();
  }
  
  unregisterProcessor(processorName: string): void {
    this.processors.delete(processorName);
    this.updateExecutionOrder();
  }
  
  private registerDefaultProcessors(): void {
    this.registerProcessor(new SymbolBalancePostProcessor());
    this.registerProcessor(new IntelligentFilterPostProcessor());
    this.registerProcessor(new SmartRebalancingPostProcessor());
    this.registerProcessor(new AdvancedMergingPostProcessor());
    this.registerProcessor(new BoundaryOptimizationPostProcessor());
    this.registerProcessor(new OverlapPostProcessor());
  }
  
  private updateExecutionOrder(): void {
    this.executionOrder = Array.from(this.processors.values())
      .sort((a, b) => a.priority - b.priority)
      .map(processor => processor.name);
  }
}
```

#### 具体后处理器实现

**AdvancedMergingPostProcessor.ts**
```typescript
export class AdvancedMergingPostProcessor implements IPostProcessor {
  readonly name = 'advanced-merging-processor';
  readonly priority = 200;
  
  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean {
    return chunks.length > 1 && 
           context.config.postProcessing.enabledProcessors.includes(this.name);
  }
  
  async process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    const merger = new ChunkMerger(context.config);
    return await merger.mergeOverlappingChunks(chunks);
  }
}
```

## 数据模型

### 核心数据流

#### 处理流程描述

1. **客户端请求**: Client调用Coordinator的process方法，传入content、language和filePath
2. **特征检测**: Coordinator调用Detection服务检测文件特征（如果上游未提供）
3. **上下文创建**: Coordinator创建ProcessingContext，包含内容、语言、配置和特征
4. **策略选择**: Coordinator通过Factory获取合适的处理策略
5. **策略执行**: Strategy执行代码分割，返回ProcessingResult
6. **后处理**: PostProcessor对分割结果进行优化
7. **结果返回**: Coordinator将最终结果返回给Client

#### 数据传递关系

- **输入**: content (string), language (string), filePath (string)
- **中间数据**: FileFeatures, ProcessingContext, ProcessingResult
- **输出**: 优化后的CodeChunk数组

### 配置数据模型

#### 配置层次结构

**ProcessingConfig (主配置)**
- 包含: ChunkingConfig, FeatureConfig, PerformanceConfig, LanguageConfig, PostProcessingConfig

**LanguageConfig (语言配置)**
- 包含: BoundaryConfig, WeightConfig, LanguageChunkingConfig

**PostProcessingConfig (后处理配置)**
- 包含: ProcessorConfig (处理器配置映射)

#### 配置关系说明

- ProcessingConfig是根配置，包含所有子配置
- LanguageConfig为每种编程语言提供特定配置
- PostProcessingConfig控制后处理流程的行为
- 所有配置都支持运行时动态更新

## 错误处理

### 错误分类体系

```typescript
export enum ProcessingErrorType {
  VALIDATION_ERROR = 'validation_error',
  STRATEGY_ERROR = 'strategy_error',
  CONFIG_ERROR = 'config_error',
  PERFORMANCE_ERROR = 'performance_error',
  POST_PROCESSING_ERROR = 'post_processing_error'
}

export class ProcessingError extends Error {
  constructor(
    public type: ProcessingErrorType,
    message: string,
    public context?: any,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ProcessingError';
  }
}
```

### 错误处理策略

#### 职责分离原则

Processing模块的错误处理应该专注于**处理逻辑相关的错误**，而将以下职责交给其他模块：

- **输入验证** → 上游调用模块（Parser入口）
- **系统级错误处理** → Infrastructure模块
- **配置验证和修复** → Config模块
- **性能监控和保护** → Infrastructure/Monitoring模块
- **日志记录** → Infrastructure/Logging模块

#### Processing模块内的错误处理

**1. 策略选择和执行错误**
```typescript
// ProcessingCoordinator.ts
private async executeStrategyWithFallback(
  context: ProcessingContext
): Promise<ProcessingResult> {
  const strategy = this.selectStrategy(context);
  
  try {
    return await strategy.execute(context);
  } catch (error) {
    // 策略执行失败时，尝试降级到更简单的策略
    if (this.canFallbackToSimplerStrategy(strategy)) {
      const fallbackStrategy = this.getSimplerStrategy(context);
      return await fallbackStrategy.execute(context);
    }
    throw new ProcessingError(
      ProcessingErrorType.STRATEGY_ERROR,
      `Strategy execution failed: ${error.message}`,
      { strategy: strategy.name, language: context.language },
      error
    );
  }
}
```

**2. 后处理错误处理**
```typescript
// PostProcessorCoordinator.ts
async process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
  let processedChunks = [...chunks];
  const errors: Array<{ processor: string; error: Error }> = [];
  
  for (const processor of this.processors) {
    try {
      if (processor.shouldApply(processedChunks, context)) {
        processedChunks = await processor.process(processedChunks, context);
      }
    } catch (error) {
      errors.push({ processor: processor.name, error });
      // 记录错误但继续执行其他处理器
      // 实际项目中应该委托给日志模块
    }
  }
  
  // 如果有错误，可以在结果中包含错误信息
  if (errors.length > 0) {
    // 通过metadata传递错误信息，而不是抛出异常
    processedChunks[0].metadata.processingErrors = errors;
  }
  
  return processedChunks;
}
```

**3. 上下文创建错误**
```typescript
// ProcessingCoordinator.ts
private async createContext(
  content: string,
  language: string,
  filePath?: string
): Promise<ProcessingContext> {
  try {
    // 假设上游已经验证了基本参数，这里只关注处理相关的验证
    const features = await this.detectionService.detectFeatures(content, language);
    const config = await this.configManager.getConfig();
    
    return new ContextBuilder(content)
      .setLanguage(language)
      .setFilePath(filePath)
      .setConfig(config)
      .setFeatures(features)
      .build();
  } catch (error) {
    throw new ProcessingError(
      ProcessingErrorType.CONTEXT_ERROR,
      `Failed to create processing context: ${error.message}`,
      { content, language, filePath },
      error
    );
  }
}
```

#### 跨模块协作的错误处理

**配置错误处理**（委托给Config模块）:
```typescript
// ProcessingCoordinator.ts
private async getConfig(): Promise<ProcessingConfig> {
  try {
    return await this.configManager.getConfig();
  } catch (error) {
    // Config模块负责提供默认配置和错误处理
    throw new ProcessingError(
      ProcessingErrorType.CONFIG_ERROR,
      `Configuration error: ${error.message}`,
      { originalError: error }
    );
  }
}
```

**检测服务错误处理**（委托给Detection模块）:
```typescript
// ProcessingCoordinator.ts
private async detectFeatures(
  content: string,
  language: string
): Promise<FileFeatures> {
  try {
    return await this.detectionService.detectFeatures(content, language);
  } catch (error) {
    // 使用默认特征，不中断处理流程
    return this.getDefaultFileFeatures(content, language);
  }
}
```

#### 错误分类和传播

```typescript
// types/Processing.ts
export enum ProcessingErrorType {
  STRATEGY_ERROR = 'strategy_error',          // 策略执行错误
  POST_PROCESSING_ERROR = 'post_processing_error', // 后处理错误
  CONTEXT_ERROR = 'context_error',            // 上下文创建错误
  CONFIG_ERROR = 'config_error',              // 配置错误（传播）
  PERFORMANCE_ERROR = 'performance_error'     // 性能错误（传播）
}

export class ProcessingError extends Error {
  constructor(
    public type: ProcessingErrorType,
    message: string,
    public context?: any,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ProcessingError';
  }
}
```

#### 错误处理边界

**Processing模块负责**:
- 策略选择和执行错误处理
- 后处理协调和错误恢复
- 上下文创建相关错误
- 模块内错误的分类和传播

**Processing模块不负责**:
- 输入参数验证（上游模块负责）
- 系统资源监控（内存、CPU）
- 配置文件的读取和验证
- 日志记录和输出
- 网络或文件系统错误
- 全局错误恢复机制

#### 输入验证的职责划分

**上游模块（Parser入口）负责**:
```typescript
// Parser入口处的验证
export async function parseCode(
  content: string,
  language: string,
  filePath?: string
): Promise<ProcessingResult> {
  // 基本输入验证
  if (!content || content.trim().length === 0) {
    throw new ValidationError('Content cannot be empty');
  }
  
  if (!language || !isValidLanguage(language)) {
    throw new ValidationError(`Invalid language: ${language}`);
  }
  
  // 传递给Processing模块时，数据已经验证
  return await processingCoordinator.process(content, language, filePath);
}
```

这种设计确保了职责清晰分离，避免重复验证，同时保持系统的健壮性。

## 性能优化

### 优化策略

1. **缓存机制**: 策略实例缓存、检测结果缓存
2. **懒加载**: 按需创建策略实例和处理器
3. **并行处理**: 独立后处理器的并行执行
4. **内存管理**: 及时释放不需要的对象和引用
5. **算法优化**: 优化核心算法的时间复杂度

### 性能监控

```typescript
export interface PerformanceMetrics {
  totalProcessingTime: number;
  strategyExecutionTime: number;
  postProcessingTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  chunkCount: number;
  averageChunkSize: number;
}
```

## 迁移策略

### 迁移阶段

1. **阶段1**: 创建新的类型系统和核心接口
2. **阶段2**: 创建策略系统和工厂
3. **阶段3**: 创建协调器和后处理模块
4. **阶段4**: 创建配置和检测模块
5. **阶段5**: 清理旧代码和优化

## 总结

本设计方案通过清晰的模块划分、统一的类型系统和高效的协作机制，解决了原有系统的问题。设计重点包括：

1. **模块化架构**: 清晰的职责分离和依赖关系
2. **类型安全**: 统一的类型定义和严格的类型检查
3. **可扩展性**: 灵活的策略注册和处理器扩展机制
4. **性能优化**: 多层次的性能优化和监控机制
5. **向后兼容**: 平滑的迁移路径和兼容性保证

该设计为后续的实现提供了详细的技术指导，确保重构过程的顺利进行和系统质量的提升。