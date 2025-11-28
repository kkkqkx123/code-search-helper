import { CodeChunk } from '../../core/types/ResultTypes';
import { HtmlRelationship } from '../../../normalization/adapters/html-utils/HtmlRelationshipTypes';

/**
 * HTML结果合并器
 * 负责合并不同类型的解析结果
 */
export class HTMLResultMerger {
    /**
     * 合并结果
     * @param htmlChunks HTML块
     * @param scriptChunks 脚本块
     * @param styleChunks 样式块
     * @param relationships 关系数组
     * @returns 合并后的块数组
     */
    mergeResults(
        htmlChunks: CodeChunk[],
        scriptChunks: CodeChunk[],
        styleChunks: CodeChunk[],
        relationships: HtmlRelationship[]
    ): CodeChunk[] {
        const allChunks: CodeChunk[] = [];

        // 添加所有块
        allChunks.push(...htmlChunks);
        allChunks.push(...scriptChunks);
        allChunks.push(...styleChunks);

        // 为每个块添加相关的关系信息
        const relationshipMap = new Map<string, HtmlRelationship[]>();
        for (const rel of relationships) {
            if (!relationshipMap.has(rel.source)) {
                relationshipMap.set(rel.source, []);
            }
            relationshipMap.get(rel.source)!.push(rel);
        }

        // 将关系信息添加到相关块中
        const enhancedChunks = allChunks.map(chunk => {
            const chunkRelationships = relationshipMap.get((chunk.metadata as any).nodeId) || [];
            return {
                ...chunk,
                metadata: {
                    ...chunk.metadata,
                    relationships: chunkRelationships,
                    relationshipCount: chunkRelationships.length
                }
            };
        });

        // 根据位置排序
        enhancedChunks.sort((a, b) => {
            const aStart = a.metadata.startLine;
            const bStart = b.metadata.startLine;
            return aStart - bStart;
        });

        return enhancedChunks;
    }

    /**
     * 简单合并结果（不包含关系信息）
     * @param htmlChunks HTML块
     * @param scriptChunks 脚本块
     * @param styleChunks 样式块
     * @returns 合并后的块数组
     */
    simpleMergeResults(
        htmlChunks: CodeChunk[],
        scriptChunks: CodeChunk[],
        styleChunks: CodeChunk[]
    ): CodeChunk[] {
        const allChunks: CodeChunk[] = [];

        // 添加所有块
        allChunks.push(...htmlChunks);
        allChunks.push(...scriptChunks);
        allChunks.push(...styleChunks);

        // 根据位置排序
        allChunks.sort((a, b) => {
            const aStart = a.metadata.startLine;
            const bStart = b.metadata.startLine;
            return aStart - bStart;
        });

        return allChunks;
    }

    /**
     * 合并结果并添加元数据
     * @param htmlChunks HTML块
     * @param scriptChunks 脚本块
     * @param styleChunks 样式块
     * @param relationships 关系数组
     * @param additionalMetadata 额外的元数据
     * @returns 合并后的块数组
     */
    mergeResultsWithMetadata(
        htmlChunks: CodeChunk[],
        scriptChunks: CodeChunk[],
        styleChunks: CodeChunk[],
        relationships: HtmlRelationship[],
        additionalMetadata: any
    ): CodeChunk[] {
        const mergedChunks = this.mergeResults(htmlChunks, scriptChunks, styleChunks, relationships);

        // 为每个块添加额外的元数据
        return mergedChunks.map(chunk => ({
            ...chunk,
            metadata: {
                ...chunk.metadata,
                ...additionalMetadata
            }
        }));
    }
}