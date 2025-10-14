# Parser模块重构代码示例

本示例展示了重构后的理想代码结构和实现方式。

## 1. 统一类型定义结构

### 1.1 核心类型定义 (types/core-types.ts)
```typescript
/**
 * Parser模块核心类型定义
 * 统一管理和导出所有核心类型
 */

import { CodeChunk, CodeChunkMetadata } from './chunk-types';
import { ChunkingStrategy, StrategyConfig } from './strategy-types';
import { ParserConfig, LanguageConfig } from './config-types';

// 重新导出所有类型，提供统一的导入接口
export type {
  CodeChunk,
  CodeChunkMetadata,
  ChunkingStrategy,
  StrategyConfig,
  ParserConfig,
  LanguageConfig
};

// 解析器状态枚举
export enum ParserState {
  IDLE = 'IDLE',
  PARSING = 'PARSING',
  CHUNKING = 'CHUNKING',
  POST_PROCESSING = 'POST_PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

// 解析器事件类型
export interface ParserEvent {
  type: string;
  state: ParserState;
  timestamp: number;
  data?: any;
  error?: Error;
}

// 性能指标
export interface PerformanceMetrics {
  parseTime: number;
  chunkingTime: number;
  postProcessingTime: number;
  totalTime: number;
  memoryUsage: number;
  chunkCount: number;
}
```

### 1.2 代码块类型定义 (types/chunk-types.ts)
```typescript
/**
 * 代码块相关类型定义
 */

// 基础代码块接口
export interface CodeChunk {
  id?: string;
  content: string;
  metadata: CodeChunkMetadata;
}

// 代码块元数据
export interface CodeChunkMetadata {
  startLine: number;
  endLine: number;
  language: string;
  filePath?: string;
  type?: ChunkType;
  functionName?: string;
  className?: string;
  complexity?: number;
  nestingLevel?: number;
  imports?: string[];
  exports?: string[];
  [key: string]: any;
}

// 代码块类型枚举
export enum ChunkType {
  FUNCTION = 'function',
  CLASS = 'class',
  INTERFACE = 'interface',
  METHOD = 'method',
  IMPORT = 'import',
  GENERIC = 'generic',
  SEMANTIC = 'semantic',
  SYNTAX = 'syntax',
  OVERLAP = 'overlap'
}

// 分块结果
export interface ChunkingResult {
  chunks: CodeChunk[];
  metrics: ChunkingMetrics;
  errors: ChunkingError[];
}

// 分块指标
export interface ChunkingMetrics {
  totalChunks: number;
  averageChunkSize: number;
  largestChunk: number;
  smallestChunk: number;
  processingTime: number;
}
```

### 1.3 策略类型定义 (types/strategy-types.ts)
```typescript
/**
 * 分段策略相关类型定义
 */

import { CodeChunk, ChunkingOptions } from './chunk-types';
import Parser from 'tree-sitter';

// 分段策略接口
export interface ChunkingStrategy {
  readonly name: string;
  readonly priority: number;
  readonly supportedLanguages: string[];
  
  canHandle(language: string, ast: Parser.SyntaxNode): boolean;
  chunk(ast: Parser.SyntaxNode, sourceCode: string): CodeChunk[];
  validateChunks(chunks: CodeChunk[]): boolean;
}

// 策略执行上下文
export interface StrategyContext {
  language: string;
  sourceCode: string;
  ast: Parser.SyntaxNode;
  filePath?: string;
  options: ChunkingOptions;
}

// 策略执行结果
export interface StrategyResult {
  strategyName: string;
  chunks: CodeChunk[];
  executionTime: number;
  success: boolean;
  error?: Error;
}

// 策略配置
export interface StrategyConfig {
  enabled: boolean;
  priority?: number;
  options?: Record<string, any>;
  languageOverrides?: Map<string, Record<string, any>>;
}
```

## 2. 重构后的策略实现

### 2.1 策略基类 (strategies/base/BaseStrategy.ts)
```typescript
/**
 * 分段策略基类
 * 提供通用的策略实现框架
 */

import { injectable } from 'inversify';
import { ChunkingStrategy, StrategyContext, StrategyResult } from '../../types';
import { CodeChunk } from '../../types';
import Parser from 'tree-sitter';

@injectable()
export abstract class BaseStrategy implements ChunkingStrategy {
  abstract readonly name: string;
  abstract readonly priority: number;
  abstract readonly supportedLanguages: string[];

  canHandle(language: string, ast: Parser.SyntaxNode): boolean {
    return this.supportedLanguages.includes(language);
  }

  abstract chunk(ast: Parser.SyntaxNode, sourceCode: string): CodeChunk[];

  validateChunks(chunks: CodeChunk[]): boolean {
    if (!chunks || chunks.length === 0) {
      return false;
    }

    // 验证每个代码块的有效性
    for (const chunk of chunks) {
      if (!this.isValidChunk(chunk)) {
        return false;
      }
    }

    // 验证代码块之间没有重叠（除非明确允许）
    return this.hasNoOverlaps(chunks);
  }

  protected isValidChunk(chunk: CodeChunk): boolean {
    return (
      chunk != null &&
      typeof chunk.content === 'string' &&
      chunk.content.length > 0 &&
      chunk.metadata != null &&
      typeof chunk.metadata.startLine === 'number' &&
      typeof chunk.metadata.endLine === 'number' &&
      chunk.metadata.startLine <= chunk.metadata.endLine
    );
  }

  protected hasNoOverlaps(chunks: CodeChunk[]): boolean {
    const sortedChunks = [...chunks].sort(
      (a, b) => a.metadata.startLine - b.metadata.startLine
    );

    for (let i = 1; i < sortedChunks.length; i++) {
      const prev = sortedChunks[i - 1];
      const curr = sortedChunks[i];
      
      if (prev.metadata.endLine >= curr.metadata.startLine) {
        return false; // 发现重叠
      }
    }

    return true;
  }

  protected createChunk(
    content: string,
    startLine: number,
    endLine: number,
    language: string,
    type: string,
    additionalMetadata: Record<string, any> = {}
  ): CodeChunk {
    return {
      content,
      metadata: {
        startLine,
        endLine,
        language,
        type: type as any,
        ...additionalMetadata
      }
    };
  }
}
```

### 2.2 函数分割策略 (strategies/code/FunctionStrategy.ts)
```typescript
/**
 * 函数分割策略实现
 */

import { injectable } from 'inversify';
import { BaseStrategy } from '../base/BaseStrategy';
import { CodeChunk } from '../../types';
import Parser from 'tree-sitter';

@injectable()
export class FunctionStrategy extends BaseStrategy {
  readonly name = 'FunctionSplitter';
  readonly priority = 80;
  readonly supportedLanguages = [
    'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
    'go', 'rust', 'php', 'ruby', 'swift', 'kotlin'
  ];

  chunk(ast: Parser.SyntaxNode, sourceCode: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const functionNodes = this.extractFunctions(ast);

    for (const funcNode of functionNodes) {
      const chunk = this.createFunctionChunk(funcNode, sourceCode);
      if (chunk) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  private extractFunctions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const functions: Parser.SyntaxNode[] = [];
    
    // 递归遍历AST，查找函数节点
    this.traverseAST(ast, (node) => {
      if (this.isFunctionNode(node)) {
        functions.push(node);
      }
    });

    return functions;
  }

  private isFunctionNode(node: Parser.SyntaxNode): boolean {
    const functionTypes = [
      'function_declaration',
      'method_definition',
      'function_definition',
      'def',
      'function_item'
    ];

    return functionTypes.includes(node.type);
  }

  private createFunctionChunk(
    funcNode: Parser.SyntaxNode,
    sourceCode: string
  ): CodeChunk | null {
    const content = this.getNodeContent(funcNode, sourceCode);
    const functionName = this.extractFunctionName(funcNode);

    return this.createChunk(
      content,
      funcNode.startPosition.row + 1,
      funcNode.endPosition.row + 1,
      'javascript', // 应该从上下文获取
      'function',
      {
        functionName,
        complexity: this.calculateComplexity(funcNode)
      }
    );
  }

  private extractFunctionName(funcNode: Parser.SyntaxNode): string {
    // 根据节点类型提取函数名
    const nameNode = funcNode.childForFieldName('name');
    return nameNode ? nameNode.text : 'anonymous';
  }

  private calculateComplexity(node: Parser.SyntaxNode): number {
    // 简单的复杂度计算：基于嵌套层级和控制流语句
    let complexity = 1;
    
    this.traverseAST(node, (child) => {
      if (['if_statement', 'for_statement', 'while_statement', 'switch_statement'].includes(child.type)) {
        complexity++;
      }
    });

    return complexity;
  }

  private traverseAST(
    node: Parser.SyntaxNode,
    callback: (node: Parser.SyntaxNode) => void
  ): void {
    callback(node);
    for (const child of node.children) {
      this.traverseAST(child, callback);
    }
  }

  private getNodeContent(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }
}
```

## 3. 重构后的策略管理器

### 3.1 策略注册中心 (strategies/registry/StrategyRegistry.ts)
```typescript
/**
 * 策略注册中心
 * 统一管理和注册所有分段策略
 */

import { injectable } from 'inversify';
import { ChunkingStrategy } from '../../types';

@injectable()
export class StrategyRegistry {
  private strategies: Map<string, ChunkingStrategy> = new Map();
  private languageStrategyMap: Map<string, string[]> = new Map();

  register(strategy: ChunkingStrategy): void {
    this.strategies.set(strategy.name, strategy);
    this.updateLanguageMapping(strategy);
  }

  unregister(strategyName: string): void {
    const strategy = this.strategies.get(strategyName);
    if (strategy) {
      this.strategies.delete(strategyName);
      this.removeFromLanguageMapping(strategy);
    }
  }

  get(strategyName: string): ChunkingStrategy | undefined {
    return this.strategies.get(strategyName);
  }

  getStrategiesForLanguage(language: string): ChunkingStrategy[] {
    const strategyNames = this.languageStrategyMap.get(language) || [];
    return strategyNames
      .map(name => this.strategies.get(name))
      .filter(strategy => strategy != null) as ChunkingStrategy[];
  }

  getAllStrategies(): ChunkingStrategy[] {
    return Array.from(this.strategies.values());
  }

  getEnabledStrategies(): ChunkingStrategy[] {
    return this.getAllStrategies().filter(strategy => this.isStrategyEnabled(strategy));
  }

  private updateLanguageMapping(strategy: ChunkingStrategy): void {
    for (const language of strategy.supportedLanguages) {
      const strategies = this.languageStrategyMap.get(language) || [];
      if (!strategies.includes(strategy.name)) {
        strategies.push(strategy.name);
        strategies.sort((a, b) => {
          const strategyA = this.strategies.get(a)!;
          const strategyB = this.strategies.get(b)!;
          return strategyB.priority - strategyA.priority; // 降序排列
        });
        this.languageStrategyMap.set(language, strategies);
      }
    }
  }

  private removeFromLanguageMapping(strategy: ChunkingStrategy): void {
    for (const language of strategy.supportedLanguages) {
      const strategies = this.languageStrategyMap.get(language) || [];
      const index = strategies.indexOf(strategy.name);
      if (index !== -1) {
        strategies.splice(index, 1);
        if (strategies.length === 0) {
          this.languageStrategyMap.delete(language);
        } else {
          this.languageStrategyMap.set(language, strategies);
        }
      }
    }
  }

  private isStrategyEnabled(strategy: ChunkingStrategy): boolean {
    // 这里可以添加启用/禁用逻辑
    return true;
  }
}
```

### 3.2 策略执行协调器 (core/StrategyCoordinator.ts)
```typescript
/**
 * 策略执行协调器
 * 协调多个策略的执行，处理策略间的依赖关系
 */

import { injectable, inject } from 'inversify';
import { StrategyRegistry } from '../../strategies/registry/StrategyRegistry';
import { StrategyContext, StrategyResult, CodeChunk } from '../../types';
import { LoggerService } from '../../../utils/LoggerService';

@injectable()
export class StrategyCoordinator {
  constructor(
    @inject('StrategyRegistry') private registry: StrategyRegistry,
    @inject('LoggerService') private logger: LoggerService
  ) {}

  async executeStrategies(context: StrategyContext): Promise<StrategyResult[]> {
    const strategies = this.registry.getStrategiesForLanguage(context.language);
    const results: StrategyResult[] = [];

    this.logger.info(`Executing ${strategies.length} strategies for ${context.language}`);

    for (const strategy of strategies) {
      try {
        const startTime = Date.now();
        const chunks = await this.executeStrategy(strategy, context);
        const executionTime = Date.now() - startTime;

        const result: StrategyResult = {
          strategyName: strategy.name,
          chunks,
          executionTime,
          success: true
        };

        results.push(result);
        this.logger.debug(`Strategy ${strategy.name} completed in ${executionTime}ms with ${chunks.length} chunks`);
      } catch (error) {
        const result: StrategyResult = {
          strategyName: strategy.name,
          chunks: [],
          executionTime: 0,
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };

        results.push(result);
        this.logger.error(`Strategy ${strategy.name} failed: ${error}`);
      }
    }

    return results;
  }

  private async executeStrategy(
    strategy: ChunkingStrategy,
    context: StrategyContext
  ): Promise<CodeChunk[]> {
    // 验证策略是否可以处理
    if (!strategy.canHandle(context.language, context.ast)) {
      throw new Error(`Strategy ${strategy.name} cannot handle language ${context.language}`);
    }

    // 执行策略
    const chunks = strategy.chunk(context.ast, context.sourceCode);

    // 验证结果
    if (!strategy.validateChunks(chunks)) {
      throw new Error(`Strategy ${strategy.name} produced invalid chunks`);
    }

    return chunks;
  }
}
```

## 4. 重构后的配置管理

### 4.1 统一配置管理器 (config/ConfigurationManager.ts)
```typescript
/**
 * 统一配置管理器
 * 集中管理所有parser模块的配置
 */

import { injectable } from 'inversify';
import { ParserConfig, LanguageConfig, StrategyConfig } from '../types';

@injectable()
export class ConfigurationManager {
  private globalConfig: ParserConfig;
  private languageConfigs: Map<string, LanguageConfig> = new Map();
  private strategyConfigs: Map<string, StrategyConfig> = new Map();

  constructor(initialConfig?: Partial<ParserConfig>) {
    this.globalConfig = this.createDefaultConfig();
    if (initialConfig) {
      this.updateGlobalConfig(initialConfig);
    }
  }

  // 全局配置管理
  getGlobalConfig(): ParserConfig {
    return { ...this.globalConfig };
  }

  updateGlobalConfig(config: Partial<ParserConfig>): void {
    this.globalConfig = { ...this.globalConfig, ...config };
    this.validateConfig();
  }

  // 语言特定配置
  getLanguageConfig(language: string): LanguageConfig {
    const config = this.languageConfigs.get(language);
    return config ? { ...config } : this.createDefaultLanguageConfig(language);
  }

  setLanguageConfig(language: string, config: LanguageConfig): void {
    this.languageConfigs.set(language, config);
    this.validateConfig();
  }

  // 策略特定配置
  getStrategyConfig(strategyName: string): StrategyConfig {
    const config = this.strategyConfigs.get(strategyName);
    return config ? { ...config } : this.createDefaultStrategyConfig(strategyName);
  }

  setStrategyConfig(strategyName: string, config: StrategyConfig): void {
    this.strategyConfigs.set(strategyName, config);
    this.validateConfig();
  }

  // 合并配置获取
  getMergedConfig(language?: string, strategyName?: string): ParserConfig {
    let config = { ...this.globalConfig };

    if (language) {
      const langConfig = this.getLanguageConfig(language);
      config = this.mergeLanguageConfig(config, langConfig);
    }

    if (strategyName) {
      const strategyConfig = this.getStrategyConfig(strategyName);
      config = this.mergeStrategyConfig(config, strategyConfig);
    }

    return config;
  }

  // 配置验证
  private validateConfig(): void {
    // 验证配置的有效性
    if (this.globalConfig.maxChunkSize < this.globalConfig.minChunkSize) {
      throw new Error('maxChunkSize must be greater than or equal to minChunkSize');
    }

    if (this.globalConfig.overlapSize >= this.globalConfig.maxChunkSize) {
      throw new Error('overlapSize must be less than maxChunkSize');
    }
  }

  // 默认配置创建方法
  private createDefaultConfig(): ParserConfig {
    return {
      maxChunkSize: 2000,
      minChunkSize: 100,
      overlapSize: 200,
      enableOverlap: true,
      enablePerformanceMonitoring: true,
      maxExecutionTime: 30000,
      memoryLimitMB: 500
    };
  }

  private createDefaultLanguageConfig(language: string): LanguageConfig {
    return {
      language,
      enabled: true,
      customOptions: {}
    };
  }

  private createDefaultStrategyConfig(strategyName: string): StrategyConfig {
    return {
      enabled: true,
      priority: 50,
      options: {}
    };
  }

  // 配置合并方法
  private mergeLanguageConfig(globalConfig: ParserConfig, langConfig: LanguageConfig): ParserConfig {
    return {
      ...globalConfig,
      ...langConfig.customOptions
    };
  }

  private mergeStrategyConfig(globalConfig: ParserConfig, strategyConfig: StrategyConfig): ParserConfig {
    return {
      ...globalConfig,
      ...strategyConfig.options
    };
  }
}
```

## 5. 重构后的主分割器

### 5.1 统一分割器 (ParserOrchestrator.ts)
```typescript
/**
 * 统一的解析器协调器
 * 协调整个代码分割流程
 */

import { injectable, inject } from 'inversify';
import { ConfigurationManager } from './config/ConfigurationManager';
import { StrategyCoordinator } from './core/StrategyCoordinator';
import { UniversalTextSplitter } from './universal/UniversalTextSplitter';
import { TreeSitterService } from './core/TreeSitterService';
import { LoggerService } from '../utils/LoggerService';
import { CodeChunk, ChunkingResult } from './types';

@injectable()
export class ParserOrchestrator {
  constructor(
    @inject('ConfigurationManager') private configManager: ConfigurationManager,
    @inject('StrategyCoordinator') private strategyCoordinator: StrategyCoordinator,
    @inject('UniversalTextSplitter') private universalSplitter: UniversalTextSplitter,
    @inject('TreeSitterService') private treeSitterService: TreeSitterService,
    @inject('LoggerService') private logger: LoggerService
  ) {}

  async parseAndChunk(
    content: string,
    language: string,
    filePath?: string
  ): Promise<ChunkingResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`Starting parsing and chunking for ${language} file: ${filePath || 'unknown'}`);

      // 获取合并配置
      const config = this.configManager.getMergedConfig(language);

      // 根据文件类型选择处理方式
      if (this.isCodeFile(language)) {
        return await this.processCodeFile(content, language, filePath, config);
      } else {
        return await this.processTextFile(content, language, filePath, config);
      }
    } catch (error) {
      this.logger.error(`Parsing and chunking failed: ${error}`);
      throw error;
    } finally {
      const totalTime = Date.now() - startTime;
      this.logger.debug(`Total processing time: ${totalTime}ms`);
    }
  }

  private async processCodeFile(
    content: string,
    language: string,
    filePath: string | undefined,
    config: any
  ): Promise<ChunkingResult> {
    // 解析代码生成AST
    const parseResult = await this.treeSitterService.parseCode(content, language);
    
    if (!parseResult.success) {
      // 解析失败，使用回退策略
      return this.processWithFallback(content, language, filePath, config);
    }

    // 执行策略协调
    const strategyContext = {
      language,
      sourceCode: content,
      ast: parseResult.ast,
      filePath,
      options: config
    };

    const strategyResults = await this.strategyCoordinator.executeStrategies(strategyContext);

    // 合并策略结果
    const allChunks = this.mergeStrategyResults(strategyResults);

    // 后处理
    const processedChunks = this.postProcessChunks(allChunks, config);

    return {
      chunks: processedChunks,
      metrics: this.calculateMetrics(processedChunks),
      errors: this.extractErrors(strategyResults)
    };
  }

  private async processTextFile(
    content: string,
    language: string,
    filePath: string | undefined,
    config: any
  ): Promise<ChunkingResult> {
    // 使用通用文本分割器
    const chunks = await this.universalSplitter.split(content, language, filePath);
    
    return {
      chunks,
      metrics: this.calculateMetrics(chunks),
      errors: []
    };
  }

  private processWithFallback(
    content: string,
    language: string,
    filePath: string | undefined,
    config: any
  ): Promise<ChunkingResult> {
    this.logger.warn(`Using fallback strategy for ${language}`);
    // 实现回退逻辑
    return this.processTextFile(content, language, filePath, config);
  }

  private isCodeFile(language: string): boolean {
    const codeLanguages = [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
    ];
    
    return codeLanguages.includes(language);
  }

  private mergeStrategyResults(strategyResults: any[]): any[] {
    const allChunks: any[] = [];
    
    for (const result of strategyResults) {
      if (result.success && result.chunks.length > 0) {
        allChunks.push(...result.chunks);
      }
    }
    
    return allChunks;
  }

  private postProcessChunks(chunks: CodeChunk[], config: any): CodeChunk[] {
    // 实现后处理逻辑：去重、重叠处理、大小平衡等
    return chunks;
  }

  private calculateMetrics(chunks: CodeChunk[]): any {
    const totalChunks = chunks.length;
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    
    return {
      totalChunks,
      averageChunkSize: totalChunks > 0 ? totalSize / totalChunks : 0,
      largestChunk: Math.max(...chunks.map(c => c.content.length)),
      smallestChunk: Math.min(...chunks.map(c => c.content.length)),
      processingTime: 0 // 这里应该记录实际处理时间
    };
  }

  private extractErrors(strategyResults: any[]): any[] {
    const errors: any[] = [];
    
    for (const result of strategyResults) {
      if (!result.success && result.error) {
        errors.push({
          strategy: result.strategyName,
          error: result.error
        });
      }
    }
    
    return errors;
  }
}
```

## 6. 重构后的依赖注入配置

### 6.1 容器配置 (parser/container/ParserContainer.ts)
```typescript
/**
 * Parser模块的依赖注入配置
 */

import { Container } from 'inversify';
import { ParserOrchestrator } from '../ParserOrchestrator';
import { StrategyRegistry } from '../strategies/registry/StrategyRegistry';
import { StrategyCoordinator } from '../core/StrategyCoordinator';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { UniversalTextSplitter } from '../universal/UniversalTextSplitter';
import { TreeSitterService } from '../core/TreeSitterService';
import { FunctionStrategy } from '../strategies/code/FunctionStrategy';
import { ClassStrategy } from '../strategies/code/ClassStrategy';
import { ImportStrategy } from '../strategies/code/ImportStrategy';

// 定义依赖注入标识符
export const PARSER_TYPES = {
  ParserOrchestrator: Symbol.for('ParserOrchestrator'),
  StrategyRegistry: Symbol.for('StrategyRegistry'),
  StrategyCoordinator: Symbol.for('StrategyCoordinator'),
  ConfigurationManager: Symbol.for('ConfigurationManager'),
  UniversalTextSplitter: Symbol.for('UniversalTextSplitter'),
  TreeSitterService: Symbol.for('TreeSitterService'),
  
  // 策略类型
  FunctionStrategy: Symbol.for('FunctionStrategy'),
  ClassStrategy: Symbol.for('ClassStrategy'),
  ImportStrategy: Symbol.for('ImportStrategy')
};

export function createParserContainer(): Container {
  const container = new Container();

  // 绑定核心服务
  container.bind<ParserOrchestrator>(PARSER_TYPES.ParserOrchestrator).to(ParserOrchestrator).inSingletonScope();
  container.bind<StrategyRegistry>(PARSER_TYPES.StrategyRegistry).to(StrategyRegistry).inSingletonScope();
  container.bind<StrategyCoordinator>(PARSER_TYPES.StrategyCoordinator).to(StrategyCoordinator).inSingletonScope();
  container.bind<ConfigurationManager>(PARSER_TYPES.ConfigurationManager).to(ConfigurationManager).inSingletonScope();
  container.bind<UniversalTextSplitter>(PARSER_TYPES.UniversalTextSplitter).to(UniversalTextSplitter).inSingletonScope();
  container.bind<TreeSitterService>(PARSER_TYPES.TreeSitterService).to(TreeSitterService).inSingletonScope();

  // 绑定策略
  container.bind<FunctionStrategy>(PARSER_TYPES.FunctionStrategy).to(FunctionStrategy);
  container.bind<ClassStrategy>(PARSER_TYPES.ClassStrategy).to(ClassStrategy);
  container.bind<ImportStrategy>(PARSER_TYPES.ImportStrategy).to(ImportStrategy);

  return container;
}

// 初始化策略注册
export function initializeStrategies(container: Container): void {
  const registry = container.get<StrategyRegistry>(PARSER_TYPES.StrategyRegistry);
  
  // 注册所有策略
  const functionStrategy = container.get<FunctionStrategy>(PARSER_TYPES.FunctionStrategy);
  const classStrategy = container.get<ClassStrategy>(PARSER_TYPES.ClassStrategy);
  const importStrategy = container.get<ImportStrategy>(PARSER_TYPES.ImportStrategy);
  
  registry.register(functionStrategy);
  registry.register(classStrategy);
  registry.register(importStrategy);
}
```

## 7. 重构后的使用示例

### 7.1 基本使用示例
```typescript
import { createParserContainer, initializeStrategies } from './parser/container/ParserContainer';
import { PARSER_TYPES } from './parser/container/ParserContainer';

// 创建容器并初始化
const container = createParserContainer();
initializeStrategies(container);

// 获取解析器
const parser = container.get(PARSER_TYPES.ParserOrchestrator);

// 使用解析器
async function example() {
  const code = `
    function hello(name) {
      console.log('Hello, ' + name);
    }
    
    class Calculator {
      add(a, b) {
        return a + b;
      }
    }
  `;
  
  try {
    const result = await parser.parseAndChunk(code, 'javascript', 'example.js');
    
    console.log(`Generated ${result.chunks.length} chunks`);
    console.log('Metrics:', result.metrics);
    
    if (result.errors.length > 0) {
      console.log('Errors:', result.errors);
    }
  } catch (error) {
    console.error('Parsing failed:', error);
  }
}
```

这个重构示例展示了：
1. 统一的类型定义结构
2. 清晰的策略实现框架
3. 完善的策略管理机制
4. 集中的配置管理
5. 协调的主分割流程
6. 合理的依赖注入配置
7. 简洁的使用方式

通过这样的重构，Parser模块将具有更好的可维护性、扩展性和性能。