import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy } from '../../../interfaces/ISplitStrategy';
import { PriorityManager } from './PriorityManager';

/**
 * 动态优先级策略包装器
 * 为策略提供基于配置的动态优先级
 */
@injectable()
export class DynamicPriorityStrategy implements ISplitStrategy {
  private strategy: ISplitStrategy;
  private priorityManager: PriorityManager;
  private logger?: LoggerService;

  constructor(
    strategy: ISplitStrategy,
    priorityManager: PriorityManager,
    logger?: LoggerService
  ) {
    this.strategy = strategy;
    this.priorityManager = priorityManager;
    this.logger = logger;
  }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: any,
    nodeTracker?: any,
    ast?: any
  ): Promise<any[]> {
    return await this.strategy.split(content, language, filePath, options, nodeTracker, ast);
  }

  getName(): string {
    return this.strategy.getName();
  }

  supportsLanguage(language: string): boolean {
    return this.strategy.supportsLanguage(language);
  }

  getPriority(): number {
    // 使用动态优先级管理器获取优先级
    const context = {
      language,
      filePath: undefined // 在策略级别无法获取完整的上下文
    };
    
    const priority = this.priorityManager.getPriority(this.strategy.getName(), context);
    this.logger?.debug(`Dynamic priority for ${this.strategy.getName()}: ${priority}`);
    return priority;
  }

  getDescription?(): string {
    return this.strategy.getDescription?.() || '';
  }

  canHandleNode?(language: string, node: any): boolean {
    return this.strategy.canHandleNode?.(language, node) || false;
  }

  getSupportedNodeTypes?(language: string): Set<string> {
    return this.strategy.getSupportedNodeTypes?.(language) || new Set();
  }

  validateChunks?(chunks: any[]): boolean {
    return this.strategy.validateChunks?.(chunks) || true;
  }

  extractNodesFromChunk?(chunk: any, ast: any): any[] {
    return this.strategy.extractNodesFromChunk?.(chunk, ast) || [];
  }

  hasUsedNodes?(chunk: any, nodeTracker: any, ast: any): boolean {
    return this.strategy.hasUsedNodes?.(chunk, nodeTracker, ast) || false;
  }

  chunkByAST?(
    ast: any,
    content: string,
    language: string,
    filePath?: string,
    options?: any
  ): Promise<any[]> {
    return this.strategy.chunkByAST?.(ast, content, language, filePath, options) || Promise.resolve([]);
  }
}

/**
 * 动态优先级策略提供者包装器
 */
@injectable()
export class DynamicPriorityProvider {
  private provider: any;
  private priorityManager: PriorityManager;
  private logger?: LoggerService;

  constructor(
    provider: any,
    priorityManager: PriorityManager,
    logger?: LoggerService
  ) {
    this.provider = provider;
    this.priorityManager = priorityManager;
    this.logger = logger;
  }

  getName(): string {
    return this.provider.getName();
  }

  createStrategy(options?: any): ISplitStrategy {
    const baseStrategy = this.provider.createStrategy(options);
    return new DynamicPriorityStrategy(baseStrategy, this.priorityManager, this.logger);
  }

  getDependencies(): string[] {
    return this.provider.getDependencies();
  }

  supportsLanguage(language: string): boolean {
    return this.provider.supportsLanguage(language);
  }

  getPriority(): number {
    // 为提供者级别也提供动态优先级
    const context = { language: undefined, filePath: undefined };
    return this.priorityManager.getPriority(this.provider.getName(), context);
  }

  getDescription(): string {
    return this.provider.getDescription?.() || '';
  }
}