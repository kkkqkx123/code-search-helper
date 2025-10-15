import { IStrategyProvider } from '../interfaces/IStrategyProvider';
import { ISplitStrategy } from '../interfaces/ISplitStrategy';
import { ChunkingOptions } from '../types';
import { ClassSplitter } from '../strategies/ClassSplitter';

/**
 * ClassSplitter策略提供者
 */
export class ClassSplitterProvider implements IStrategyProvider {
  getName(): string {
    return 'ClassSplitter';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new ClassSplitter(options);
  }

  getDependencies(): string[] {
    return ['TreeSitterService', 'LoggerService'];
  }
}