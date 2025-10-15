import { IStrategyProvider } from '../interfaces/IStrategyProvider';
import { ISplitStrategy } from '../interfaces/ISplitStrategy';
import { ChunkingOptions } from '../types';
import { ImportSplitter } from '../strategies/ImportSplitter';

/**
 * ImportSplitter策略提供者
 */
export class ImportSplitterProvider implements IStrategyProvider {
  getName(): string {
    return 'ImportSplitter';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new ImportSplitter(options);
  }

  getDependencies(): string[] {
    return ['TreeSitterService', 'LoggerService'];
  }
}