import { ISplitStrategy as CoreISplitStrategy } from '../../interfaces/CoreISplitStrategy';
import { IStrategyProvider } from './IStrategyProvider';
import { CodeChunk, ChunkingOptions, ASTNode } from '../types/splitting-types';
import { StrategyConfiguration } from '../../interfaces/CoreISplitStrategy';

/**
 * 处理层分割策略接口 - 扩展核心接口
 */
export interface ISplitStrategy extends CoreISplitStrategy {
    /**
     * 提取代码块关联的AST节点
     * @param chunk 代码块
     * @param ast AST树
     */
    extractNodesFromChunk?(chunk: CodeChunk, ast: any): ASTNode[];

    /**
     * 检查代码块是否包含已使用的节点
     * @param chunk 代码块
     * @param nodeTracker 节点跟踪器
     * @param ast AST树
     */
    hasUsedNodes?(chunk: CodeChunk, nodeTracker: any, ast: any): boolean;
}

// 重新导出接口
export { IStrategyProvider };
export { ChunkingOptions };
export { StrategyConfiguration };
