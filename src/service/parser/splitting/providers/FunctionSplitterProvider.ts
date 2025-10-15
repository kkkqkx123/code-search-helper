import { IStrategyProvider } from '../interfaces/IStrategyProvider';
import { ISplitStrategy } from '../interfaces/ISplitStrategy';
import { ChunkingOptions } from '../types';
import { FunctionSplitter } from '../strategies/FunctionSplitter';

/**
 * FunctionSplitter策略提供者
 */
export class FunctionSplitterProvider implements IStrategyProvider {
  getName(): string {
    return 'FunctionSplitter';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new FunctionSplitter(options);
  }

  getDependencies(): string[] {
    return ['TreeSitterService', 'LoggerService'];
  }
}