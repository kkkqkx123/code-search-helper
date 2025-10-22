import { IStrategyProvider } from '../interfaces/IStrategyProvider';
import { ISplitStrategy } from '../interfaces/ISplitStrategy';
import { ChunkingOptions } from '..';
import { StructureAwareSplitter } from '../strategies/StructureAwareSplitter';

/**
 * StructureAwareSplitter策略提供者
 */
export class StructureAwareSplitterProvider implements IStrategyProvider {
  getName(): string {
    return 'StructureAwareSplitter';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new StructureAwareSplitter(options);
  }

  getDependencies(): string[] {
    return ['TreeSitterService', 'QueryResultNormalizer', 'LoggerService'];
  }

  getPriority(): number {
    return 1; // 最高优先级
  }

  isAvailable(): boolean {
    // 检查依赖是否可用
    try {
      // 这里可以添加依赖检查逻辑
      return true;
    } catch (error) {
      return false;
    }
  }

  getDescription(): string {
    return 'Structure-aware splitting strategy that uses tree-sitter query results for intelligent code segmentation';
  }

  getSupportedLanguages(): string[] {
    // 支持所有有语言适配器的语言
    return [
      'typescript',
      'javascript',
      'tsx',
      'jsx',
      'python',
      'java',
      'go',
      'rust',
      'cpp',
      'c',
      'c-sharp',
      'kotlin',
      'swift',
      'php',
      'ruby',
      'lua',
      'toml',
      'yaml',
      'json',
      'html',
      'css',
      'vue'
    ];
  }
}