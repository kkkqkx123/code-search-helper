# UniversalTextSplitter 模块接口设计

## 核心类型定义

### SegmentationContext

```typescript
/**
 * 分段上下文，包含分段所需的所有信息
 */
export interface SegmentationContext {
  /** 文件内容 */
  content: string;
  /** 文件路径 */
  filePath?: string;
  /** 编程语言 */
  language?: string;
  /** 分段选项 */
  options: UniversalChunkingOptions;
  /** 保护上下文 */
  protectionContext?: ProtectionContext;
  /** 元数据 */
  metadata: {
    contentLength: number;
    lineCount: number;
    isSmallFile: boolean;
    isCodeFile: boolean;
    isMarkdownFile: boolean;
  };
}
```

### UniversalChunkingOptions (增强版)

```typescript
/**
 * 通用分段选项（重构后版本）
 */
export interface UniversalChunkingOptions {
  // 基础分段参数
  maxChunkSize: number;
  overlapSize: number;
  maxLinesPerChunk: number;
  
  // 功能开关
  enableBracketBalance: boolean;
  enableSemanticDetection: boolean;
  enableCodeOverlap: boolean;
  enableStandardization: boolean;
  standardizationFallback: boolean;
  
  // 重叠控制
  maxOverlapRatio: number;
  
  // 错误和性能控制
  errorThreshold: number;
  memoryLimitMB: number;
  
  // 策略优先级（可配置）
  strategyPriorities: Record<string, number>;
  
  // 处理器配置
  filterConfig: {
    enableSmallChunkFilter: boolean;
    enableChunkRebalancing: boolean;
    minChunkSize: number;
    maxChunkSize: number;
  };
  
  // 保护配置
  protectionConfig: {
    enableProtection: boolean;
    protectionLevel: 'low' | 'medium' | 'high';
  };
}
```

## 核心接口定义

### 1. ISegmentationStrategy

```typescript
/**
 * 分段策略接口
 */
export interface ISegmentationStrategy {
  /**
   * 检查是否可以处理给定的上下文
   */
  canHandle(context: SegmentationContext): boolean;
  
  /**
   * 执行分段
   */
  segment(context: SegmentationContext): Promise<CodeChunk[]>;
  
  /**
   * 获取策略名称
   */
  getName(): string;
  
  /**
   * 获取策略优先级（数值越小优先级越高）
   */
  getPriority(): number;
  
  /**
   * 获取策略支持的语言列表（可选）
   */
  getSupportedLanguages?(): string[];
  
  /**
   * 验证上下文是否适合此策略（可选）
   */
  validateContext?(context: SegmentationContext): boolean;
}
```

### 2. ISegmentationProcessor

```typescript
/**
 * 分段处理器接口，用于处理分段后的各种操作
 */
export interface ISegmentationProcessor {
  /**
   * 处理分段结果
   */
  process(chunks: CodeChunk[], context: SegmentationContext): Promise<CodeChunk[]>;
  
  /**
   * 获取处理器名称
   */
  getName(): string;
  
  /**
   * 检查是否应该应用此处理器
   */
  shouldApply(chunks: CodeChunk[], context: SegmentationContext): boolean;
}
```

### 3. IProtectionCoordinator

```typescript
/**
 * 保护协调器接口
 */
export interface IProtectionCoordinator {
  /**
   * 设置保护拦截器链
   */
  setProtectionChain(chain: ProtectionInterceptorChain): void;
  
  /**
   * 检查操作是否被允许
   */
  checkProtection(context: ProtectionContext): Promise<boolean>;
  
  /**
   * 创建保护上下文
   */
  createProtectionContext(
    operation: string,
    segmentationContext: SegmentationContext,
    additionalMetadata?: Record<string, any>
  ): ProtectionContext;
}
```

### 4. IConfigurationManager

```typescript
/**
 * 配置管理器接口
 */
export interface IConfigurationManager {
  /**
   * 获取默认配置
   */
  getDefaultOptions(): UniversalChunkingOptions;
  
  /**
   * 验证配置
   */
  validateOptions(options: Partial<UniversalChunkingOptions>): boolean;
  
  /**
   * 合并配置
   */
  mergeOptions(
    base: UniversalChunkingOptions,
    override: Partial<UniversalChunkingOptions>
  ): UniversalChunkingOptions;
  
  /**
   * 获取特定语言的配置
   */
  getLanguageSpecificConfig(language: string): Partial<UniversalChunkingOptions>;
}
```

## 核心类设计

### 1. UniversalTextSplitter (重构后)

```typescript
/**
 * 通用文本分段器（重构后版本）
 * 职责：作为分段服务的入口点，协调各个组件的工作
 */
@injectable()
export class UniversalTextSplitter implements ITextSplitter {
  private contextManager: ISegmentationContextManager;
  private processors: ISegmentationProcessor[];
  private protectionCoordinator: IProtectionCoordinator;
  private configManager: IConfigurationManager;
  private options: UniversalChunkingOptions;
  private logger?: LoggerService;
  
  constructor(
    contextManager: ISegmentationContextManager,
    processors: ISegmentationProcessor[],
    protectionCoordinator: IProtectionCoordinator,
    configManager: IConfigurationManager,
    logger?: LoggerService
  ) {
    this.contextManager = contextManager;
    this.processors = processors;
    this.protectionCoordinator = protectionCoordinator;
    this.configManager = configManager;
    this.options = configManager.getDefaultOptions();
    this.logger = logger;
  }
  
  /**
   * 基于语义边界的分段
   */
  async chunkBySemanticBoundaries(
    content: string, 
    filePath?: string, 
    language?: string
  ): Promise<CodeChunk[]> {
    const context = this.createSegmentationContext(content, filePath, language);
    return this.executeSegmentation('semantic', context);
  }
  
  /**
   * 基于括号和行数的分段
   */
  async chunkByBracketsAndLines(
    content: string, 
    filePath?: string, 
    language?: string
  ): Promise<CodeChunk[]> {
    const context = this.createSegmentationContext(content, filePath, language);
    return this.executeSegmentation('bracket', context);
  }
  
  /**
   * 基于行数的分段
   */
  async chunkByLines(
    content: string, 
    filePath?: string, 
    language?: string
  ): Promise<CodeChunk[]> {
    const context = this.createSegmentationContext(content, filePath, language);
    return this.executeSegmentation('line', context);
  }
  
  /**
   * 设置分段选项
   */
  setOptions(options: Partial<UniversalChunkingOptions>): void {
    this.options = this.configManager.mergeOptions(this.options, options);
  }
  
  /**
   * 获取当前分段选项
   */
  getOptions(): UniversalChunkingOptions {
    return { ...this.options };
  }
  
  /**
   * 创建分段上下文
   */
  private createSegmentationContext(
    content: string, 
    filePath?: string, 
    language?: string
  ): SegmentationContext {
    return {
      content,
      filePath,
      language,
      options: this.options,
      metadata: {
        contentLength: content.length,
        lineCount: content.split('\n').length,
        isSmallFile: this.isSmallFile(content),
        isCodeFile: this.isCodeFile(language, filePath),
        isMarkdownFile: this.isMarkdownFile(language, filePath)
      }
    };
  }
  
  /**
   * 执行分段
   */
  private async executeSegmentation(
    strategyType: string, 
    context: SegmentationContext
  ): Promise<CodeChunk[]> {
    // 保护检查
    if (context.options.protectionConfig.enableProtection) {
      const protectionContext = this.protectionCoordinator.createProtectionContext(
        strategyType + '_chunk',
        context
      );
      
      if (!await this.protectionCoordinator.checkProtection(protectionContext)) {
        this.logger?.warn(`${strategyType} segmentation blocked by protection mechanism`);
        // 降级到行数分段
        return this.contextManager.executeStrategy(
          this.contextManager.selectStrategy(context, 'line'),
          context
        );
      }
    }
    
    // 选择并执行策略
    const strategy = this.contextManager.selectStrategy(context, strategyType);
    let chunks = await this.contextManager.executeStrategy(strategy, context);
    
    // 应用处理器
    for (const processor of this.processors) {
      if (processor.shouldApply(chunks, context)) {
        chunks = await processor.process(chunks, context);
      }
    }
    
    return chunks;
  }
}
```

### 2. SegmentationContextManager

```typescript
/**
 * 分段上下文管理器
 * 职责：管理分段上下文，选择和执行分段策略
 */
@injectable()
export class SegmentationContextManager implements ISegmentationContextManager {
  private strategies: ISegmentationStrategy[];
  private logger?: LoggerService;
  
  constructor(
    strategies: ISegmentationStrategy[],
    logger?: LoggerService
  ) {
    this.strategies = strategies.sort((a, b) => a.getPriority() - b.getPriority());
    this.logger = logger;
  }
  
  /**
   * 选择合适的分段策略
   */
  selectStrategy(
    context: SegmentationContext, 
    preferredType?: string
  ): ISegmentationStrategy {
    // 如果指定了首选类型，优先选择
    if (preferredType) {
      const preferredStrategy = this.strategies.find(s => 
        s.getName() === preferredType && s.canHandle(context)
      );
      if (preferredStrategy) {
        this.logger?.debug(`Using preferred strategy: ${preferredType}`);
        return preferredStrategy;
      }
    }
    
    // 按优先级选择第一个可用的策略
    for (const strategy of this.strategies) {
      if (strategy.canHandle(context)) {
        this.logger?.debug(`Selected strategy: ${strategy.getName()}`);
        return strategy;
      }
    }
    
    throw new Error('No suitable segmentation strategy found');
  }
  
  /**
   * 执行分段策略
   */
  async executeStrategy(
    strategy: ISegmentationStrategy, 
    context: SegmentationContext
  ): Promise<CodeChunk[]> {
    try {
      this.logger?.debug(`Executing strategy: ${strategy.getName()}`);
      return await strategy.segment(context);
    } catch (error) {
      this.logger?.error(`Strategy ${strategy.getName()} failed:`, error);
      
      // 尝试降级到行数分段
      const fallbackStrategy = this.strategies.find(s => 
        s.getName() === 'line' && s.canHandle(context)
      );
      
      if (fallbackStrategy && fallbackStrategy !== strategy) {
        this.logger?.warn('Falling back to line-based segmentation');
        return await fallbackStrategy.segment(context);
      }
      
      throw error;
    }
  }
  
  /**
   * 创建分段上下文
   */
  createSegmentationContext(
    content: string, 
    filePath?: string, 
    language?: string,
    options?: UniversalChunkingOptions
  ): SegmentationContext {
    return {
      content,
      filePath,
      language,
      options: options || this.getDefaultOptions(),
      metadata: {
        contentLength: content.length,
        lineCount: content.split('\n').length,
        isSmallFile: this.isSmallFile(content),
        isCodeFile: this.isCodeFile(language, filePath),
        isMarkdownFile: this.isMarkdownFile(language, filePath)
      }
    };
  }
  
  /**
   * 添加策略
   */
  addStrategy(strategy: ISegmentationStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => a.getPriority() - b.getPriority());
  }
  
  /**
   * 移除策略
   */
  removeStrategy(strategyName: string): void {
    this.strategies = this.strategies.filter(s => s.getName() !== strategyName);
  }
  
  /**
   * 获取所有策略
   */
  getStrategies(): ISegmentationStrategy[] {
    return [...this.strategies];
  }
}
```

## 策略实现示例

### SemanticSegmentationStrategy

```typescript
/**
 * 语义分段策略
 * 职责：基于语义边界进行分段
 */
@injectable()
export class SemanticSegmentationStrategy implements ISegmentationStrategy {
  private complexityCalculator: IComplexityCalculator;
  private logger?: LoggerService;
  
  constructor(
    complexityCalculator: IComplexityCalculator,
    logger?: LoggerService
  ) {
    this.complexityCalculator = complexityCalculator;
    this.logger = logger;
  }
  
  canHandle(context: SegmentationContext): boolean {
    // 小文件不使用语义分段
    if (context.metadata.isSmallFile) {
      return false;
    }
    
    // Markdown文件使用专门的策略
    if (context.metadata.isMarkdownFile) {
      return false;
    }
    
    // 需要启用语义检测
    return context.options.enableSemanticDetection;
  }
  
  async segment(context: SegmentationContext): Promise<CodeChunk[]> {
    const { content, filePath, language } = context;
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    
    let currentChunk: string[] = [];
    let currentLine = 1;
    let semanticScore = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // 计算语义分数
      const lineScore = this.calculateSemanticScore(trimmedLine, language);
      semanticScore += lineScore;
      
      // 决定是否分段
      const shouldSplit = this.shouldSplitAtSemanticBoundary(
        trimmedLine,
        currentChunk,
        semanticScore,
        i,
        lines.length
      );
      
      if (shouldSplit && currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        const complexity = this.complexityCalculator.calculate(chunkContent);
        
        chunks.push({
          content: chunkContent,
          metadata: {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: language || 'unknown',
            filePath,
            type: 'semantic',
            complexity
          }
        });
        
        currentChunk = [];
        currentLine = i + 1;
        semanticScore = 0;
      }
      
      currentChunk.push(line);
    }
    
    // 处理最后的chunk
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      const complexity = this.complexityCalculator.calculate(chunkContent);
      
      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: language || 'unknown',
          filePath,
          type: 'semantic',
          complexity
        }
      });
    }
    
    return chunks;
  }
  
  getName(): string {
    return 'semantic';
  }
  
  getPriority(): number {
    return 3; // 中等优先级
  }
  
  getSupportedLanguages(): string[] {
    return ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp', 'go', 'rust'];
  }
  
  private calculateSemanticScore(line: string, language?: string): number {
    // 实现语义分数计算逻辑
    // ...
    return line.length;
  }
  
  private shouldSplitAtSemanticBoundary(
    line: string,
    currentChunk: string[],
    semanticScore: number,
    currentIndex: number,
    maxLines: number
  ): boolean {
    // 实现语义边界判断逻辑
    // ...
    return false;
  }
}
```

## 处理器实现示例

### OverlapProcessor

```typescript
/**
 * 重叠处理器
 * 职责：为分段结果添加重叠内容
 */
@injectable()
export class OverlapProcessor implements ISegmentationProcessor {
  private logger?: LoggerService;
  
  constructor(logger?: LoggerService) {
    this.logger = logger;
  }
  
  async process(chunks: CodeChunk[], context: SegmentationContext): Promise<CodeChunk[]> {
    if (chunks.length <= 1) {
      return chunks;
    }
    
    // 代码文件的重叠处理
    if (context.metadata.isCodeFile && !context.options.enableCodeOverlap) {
      return this.processCodeFileChunks(chunks, context);
    }
    
    // 非代码文件的重叠处理
    return this.processTextFileChunks(chunks, context);
  }
  
  getName(): string {
    return 'overlap';
  }
  
  shouldApply(chunks: CodeChunk[], context: SegmentationContext): boolean {
    return chunks.length > 1 && context.options.overlapSize > 0;
  }
  
  private processCodeFileChunks(
    chunks: CodeChunk[], 
    context: SegmentationContext
  ): CodeChunk[] {
    const finalChunks: CodeChunk[] = [];
    
    for (const chunk of chunks) {
      // 只对过大的块进行重叠拆分
      if (chunk.content.length > context.options.maxChunkSize) {
        const overlappedChunks = this.splitLargeChunkWithOverlap(chunk, context);
        finalChunks.push(...overlappedChunks);
      } else {
        finalChunks.push(chunk);
      }
    }
    
    return finalChunks;
  }
  
  private processTextFileChunks(
    chunks: CodeChunk[], 
    context: SegmentationContext
  ): CodeChunk[] {
    const overlappedChunks: CodeChunk[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      if (i < chunks.length - 1) {
        const overlapContent = this.calculateOverlapContent(
          chunk, 
          chunks[i + 1], 
          context.content
        );
        
        if (overlapContent) {
          overlappedChunks.push({
            ...chunk,
            content: chunk.content + '\n' + overlapContent
          });
        } else {
          overlappedChunks.push(chunk);
        }
      } else {
        overlappedChunks.push(chunk);
      }
    }
    
    return overlappedChunks;
  }
  
  private splitLargeChunkWithOverlap(
    chunk: CodeChunk, 
    context: SegmentationContext
  ): CodeChunk[] {
    // 实现大块重叠拆分逻辑
    // ...
    return [chunk];
  }
  
  private calculateOverlapContent(
    currentChunk: CodeChunk, 
    nextChunk: CodeChunk, 
    originalContent: string
  ): string {
    // 实现重叠内容计算逻辑
    // ...
    return '';
  }
}
```

## 依赖注入配置

```typescript
/**
 * 分段器模块的依赖注入配置
 */
export const segmentationModule = new ContainerModule((bind) => {
  // 核心类
  bind<ITextSplitter>(TYPES.TextSplitter).to(UniversalTextSplitter).inSingletonScope();
  bind<ISegmentationContextManager>(TYPES.SegmentationContextManager)
    .to(SegmentationContextManager).inSingletonScope();
  
  // 策略
  bind<ISegmentationStrategy>(TYPES.SegmentationStrategy)
    .to(SemanticSegmentationStrategy).inSingletonScope();
  bind<ISegmentationStrategy>(TYPES.SegmentationStrategy)
    .to(BracketSegmentationStrategy).inSingletonScope();
  bind<ISegmentationStrategy>(TYPES.SegmentationStrategy)
    .to(LineSegmentationStrategy).inSingletonScope();
  bind<ISegmentationStrategy>(TYPES.SegmentationStrategy)
    .to(MarkdownSegmentationStrategy).inSingletonScope();
  bind<ISegmentationStrategy>(TYPES.SegmentationStrategy)
    .to(StandardizationSegmentationStrategy).inSingletonScope();
  
  // 处理器
  bind<ISegmentationProcessor>(TYPES.SegmentationProcessor)
    .to(OverlapProcessor).inSingletonScope();
  bind<ISegmentationProcessor>(TYPES.SegmentationProcessor)
    .to(ChunkFilter).inSingletonScope();
  bind<ISegmentationProcessor>(TYPES.SegmentationProcessor)
    .to(ChunkRebalancer).inSingletonScope();
  
  // 其他组件
  bind<IProtectionCoordinator>(TYPES.ProtectionCoordinator)
    .to(ProtectionCoordinator).inSingletonScope();
  bind<IConfigurationManager>(TYPES.ConfigurationManager)
    .to(ConfigurationManager).inSingletonScope();
  bind<IComplexityCalculator>(TYPES.ComplexityCalculator)
    .to(ComplexityCalculator).inSingletonScope();
});
```

## 总结

这个模块化设计将原来的单一大型类拆分为多个职责单一的组件，每个组件都有明确的接口和职责。通过依赖注入和策略模式，系统变得更加灵活、可扩展和可测试。

主要优势：
1. **单一职责**: 每个类只负责一个明确的功能
2. **开闭原则**: 可以轻松添加新的策略和处理器
3. **依赖倒置**: 依赖抽象接口而不是具体实现
4. **可测试性**: 每个组件都可以独立测试
5. **可配置性**: 通过配置管理器可以灵活调整行为