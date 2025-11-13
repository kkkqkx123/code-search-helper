import { CodeChunk, ChunkType } from '../../core/types/ResultTypes';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { HTMLProcessingUtils } from './HTMLProcessingUtils';

/**
 * HTML降级处理器
 * 负责当Tree-sitter解析失败时的降级处理逻辑
 */
export class HTMLFallbackProcessor {
    /**
     * 创建降级块
     * @param context 处理上下文
     * @returns 降级块数组
     */
    createFallbackChunks(context: IProcessingContext): CodeChunk[] {
        return [this.createChunk(
            context.content,
            1,
            context.content.split('\n').length,
            context.language || 'html',
            undefined,
            {
                filePath: context.filePath,
                startLine: 1,
                endLine: context.content.split('\n').length,
                type: 'html_fallback',
                complexity: HTMLProcessingUtils.calculateComplexity(context.content),
                fallback: true
            }
        )];
    }

    /**
     * 创建降级HTML块
     * @param htmlContent HTML内容
     * @param context 处理上下文
     * @returns HTML块数组
     */
    createFallbackHTMLChunks(htmlContent: string, context: IProcessingContext): CodeChunk[] {
        const lines = htmlContent.split('\n');
        const chunks: CodeChunk[] = [];

        let currentChunk: string[] = [];
        let currentLine = 1;
        let tagDepth = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            currentChunk.push(line);

            // 计算标签深度
            tagDepth += HTMLProcessingUtils.countOpeningTags(line);
            tagDepth -= HTMLProcessingUtils.countClosingTags(line);

            // 分段条件：标签平衡且达到最小大小
            const chunkContent = currentChunk.join('\n');
            const shouldSplit = (tagDepth === 0 && currentChunk.length >= 5) ||
                chunkContent.length > 2000 ||
                i === lines.length - 1;

            if (shouldSplit) {
                chunks.push(this.createChunk(
                    chunkContent,
                    currentLine,
                    currentLine + currentChunk.length - 1,
                    'html',
                    undefined,
                    {
                        filePath: context.filePath,
                        startLine: currentLine,
                        endLine: currentLine + currentChunk.length - 1,
                        type: 'html_structure',
                        complexity: HTMLProcessingUtils.calculateComplexity(chunkContent),
                        fallback: true
                    }
                ));

                currentChunk = [];
                currentLine = i + 1;
                tagDepth = 0;
            }
        }

        // 处理剩余内容
        if (currentChunk.length > 0) {
            const chunkContent = currentChunk.join('\n');
            chunks.push(this.createChunk(
                chunkContent,
                currentLine,
                currentLine + currentChunk.length - 1,
                'html',
                undefined,
                {
                    filePath: context.filePath,
                    startLine: currentLine,
                    endLine: currentLine + currentChunk.length - 1,
                    type: 'html_structure',
                    complexity: HTMLProcessingUtils.calculateComplexity(chunkContent),
                    fallback: true
                }
            ));
        }

        return chunks;
    }

    /**
     * 创建代码块
     * @param content 内容
     * @param startLine 起始行
     * @param endLine 结束行
     * @param language 语言
     * @param name 名称
     * @param metadata 元数据
     * @returns 代码块
     */
    private createChunk(
        content: string,
        startLine: number,
        endLine: number,
        language: string,
        name?: string,
        metadata?: any
    ): CodeChunk {
        const mergedMetadata = {
            startLine,
            endLine,
            language,
            timestamp: Date.now(),
            type: ChunkType.GENERIC,
            size: content.length,
            lineCount: endLine - startLine + 1,
            ...metadata
        };

        return {
            content,
            metadata: mergedMetadata
        };
    }
}