import { IStrategyProvider } from '../interfaces/IStrategyProvider';
import { ISplitStrategy } from '../interfaces/ISplitStrategy';
import { ChunkingOptions } from '..';
import { IntelligentSplitter } from '../strategies/IntelligentSplitter';

/**
 * IntelligentSplitter策略提供者
 */
export class IntelligentSplitterProvider implements IStrategyProvider {
  getName(): string {
    return 'IntelligentSplitter';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new IntelligentSplitter(options);
  }

  getDependencies(): string[] {
    return ['TreeSitterService', 'LoggerService'];
  }
}