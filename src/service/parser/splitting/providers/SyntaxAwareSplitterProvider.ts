import { IStrategyProvider } from '../interfaces/IStrategyProvider';
import { ISplitStrategy } from '../interfaces/ISplitStrategy';
import { ChunkingOptions } from '..';
import { SyntaxAwareSplitter } from '../strategies/SyntaxAwareSplitter';

/**
 * SyntaxAwareSplitter策略提供者
 */
export class SyntaxAwareSplitterProvider implements IStrategyProvider {
  getName(): string {
    return 'SyntaxAwareSplitter';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new SyntaxAwareSplitter(options);
  }

  getDependencies(): string[] {
    return ['TreeSitterService', 'LoggerService'];
  }
}