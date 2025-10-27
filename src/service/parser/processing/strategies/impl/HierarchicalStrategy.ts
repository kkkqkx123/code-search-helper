import Parser from 'tree-sitter';
import { FunctionStrategy } from './FunctionStrategy';
import { ClassStrategy } from './ClassStrategy';
import { ModuleStrategy } from './ModuleStrategy';
import { CodeChunk } from '../../splitting-types';
import { ISplitStrategy } from '../../../interfaces/ISplitStrategy';

/**
 * 分层分段策略
 * 按照优先级和层级关系执行多种分段策略，确保代码结构的完整性
 */
export class HierarchicalStrategy implements ISplitStrategy {
    readonly name = 'hierarchical_chunking';
    readonly priority = 0; // 最高优先级
    readonly description = 'Execute multiple chunking strategies in hierarchical order';
    readonly supportedLanguages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'c', 'cpp'];

    private strategies: ISplitStrategy[];

    constructor() {
        this.strategies = [];
        this.initializeStrategies();
    }

    /**
     * 初始化策略
     */
    private initializeStrategies(): void {
        // 按优先级顺序初始化策略
        const moduleStrategy = new ModuleStrategy();
        const classStrategy = new ClassStrategy();
        const functionStrategy = new FunctionStrategy();

        this.strategies = [moduleStrategy, classStrategy, functionStrategy];
    }

    supportsLanguage(language: string): boolean {
        // 分层策略可以处理所有支持的语言
        return this.supportedLanguages.includes(language);
    }

    getPriority(): number {
        return this.priority;
    }

    getName(): string {
        return this.name;
    }

    getDescription(): string {
        return this.description;
    }

    async split(
        content: string,
        language: string,
        filePath?: string,
        options?: any,
        nodeTracker?: any,
        ast?: any
    ): Promise<CodeChunk[]> {
        // 简化的实现，返回空数组
        return [];
    }

    getSupportedNodeTypes(language: string): Set<string> {
        // 返回所有支持的节点类型
        const allTypes = new Set<string>();

        for (const strategy of this.strategies) {
            if (strategy.getSupportedNodeTypes) {
                const types = strategy.getSupportedNodeTypes(language);
                types.forEach(type => allTypes.add(type));
            }
        }

        return allTypes;
    }

    validateChunks(chunks: CodeChunk[]): boolean {
        if (!chunks || chunks.length === 0) {
            return false;
        }

        // 验证所有分段
        for (const chunk of chunks) {
            if (!this.validateSingleChunk(chunk)) {
                return false;
            }
        }

        return true;
    }

    getConfiguration() {
        // 返回默认配置
        return {
            maxChunkSize: 2000,
            minChunkSize: 100,
            preserveComments: true,
            preserveEmptyLines: false,
            maxNestingLevel: 10
        };
    }

    /**
     * 验证单个分段
     */
    private validateSingleChunk(chunk: CodeChunk): boolean {
        // 检查基本属性
        if (!chunk.content || chunk.content.length === 0) {
            return false;
        }

        if (!chunk.metadata || !chunk.metadata.startLine || !chunk.metadata.endLine) {
            return false;
        }

        // 检查行号合理性
        if (chunk.metadata.startLine > chunk.metadata.endLine) {
            return false;
        }

        // 检查内容长度
        if (chunk.content.length < 100) { // 过小的分段
            return false;
        }

        if (chunk.content.length > 2000) { // 过大的分段
            return false;
        }

        return true;
    }

    /**
     * 过滤已处理的节点
     */
    private filterProcessedNodes(chunks: CodeChunk[], processedNodes: Set<string>): CodeChunk[] {
        return chunks.filter(chunk => {
            const nodeKey = this.generateNodeKey(chunk);
            return !processedNodes.has(nodeKey);
        });
    }

    /**
     * 标记已处理的节点
     */
    private markProcessedNodes(chunks: CodeChunk[], processedNodes: Set<string>): void {
        for (const chunk of chunks) {
            const nodeKey = this.generateNodeKey(chunk);
            processedNodes.add(nodeKey);
        }
    }

    /**
     * 生成节点键
     */
    private generateNodeKey(chunk: CodeChunk): string {
        return `${chunk.metadata.startLine}:${chunk.metadata.endLine}:${chunk.content.length}`;
    }

    /**
     * 按类型分组分段
     */
    private groupChunksByType(chunks: CodeChunk[]): Map<string, CodeChunk[]> {
        const grouped = new Map<string, CodeChunk[]>();

        for (const chunk of chunks) {
            const type = chunk.metadata.type || 'unknown';
            if (!grouped.has(type)) {
                grouped.set(type, []);
            }
            grouped.get(type)!.push(chunk);
        }

        return grouped;
    }

    /**
     * 按优先级排序分段
     */
    private sortChunksByPriority(groupedChunks: Map<string, CodeChunk[]>): CodeChunk[] {
        const typePriority: Record<string, number> = {
            'module': 0,
            'class': 1,
            'function': 2,
            'method': 3,
            'property': 4,
            'declaration': 5
        };

        const sortedChunks: CodeChunk[] = [];

        // 按优先级顺序添加分段
        const sortedTypes = Object.keys(typePriority).sort((a, b) => typePriority[a] - typePriority[b]);

        for (const type of sortedTypes) {
            const chunks = groupedChunks.get(type) || [];
            // 在同一类型内，按开始位置排序
            chunks.sort((a, b) => a.metadata.startLine - b.metadata.startLine);
            sortedChunks.push(...chunks);
        }

        // 添加未分组的分段
        const ungrouped = Array.from(groupedChunks.values())
            .flat()
            .filter(chunk => !typePriority.hasOwnProperty(chunk.metadata.type || ''));

        ungrouped.sort((a, b) => a.metadata.startLine - b.metadata.startLine);
        sortedChunks.push(...ungrouped);

        return sortedChunks;
    }
}