import { CodeChunk, ChunkType } from '../../core/types/ResultTypes';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { ScriptBlock, StyleBlock } from './LayeredHTMLConfig';
import { HTMLProcessingUtils } from './HTMLProcessingUtils';

/**
 * HTML代码块工厂
 * 负责创建各种类型的代码块
 */
export class HTMLChunkFactory {
    /**
     * 创建脚本块
     * @param script Script块信息
     * @param context 处理上下文
     * @param strategy 策略名称
     * @returns 脚本块
     */
    createScriptChunk(script: ScriptBlock, context: IProcessingContext, strategy: string): CodeChunk {
        return this.createChunk(
            script.content,
            script.position.line,
            script.position.line + script.content.split('\n').length - 1,
            script.language,
            undefined,
            {
                filePath: context.filePath,
                startLine: script.position.line,
                endLine: script.position.line + script.content.split('\n').length - 1,
                type: 'script_content',
                complexity: HTMLProcessingUtils.calculateComplexity(script.content),
                scriptId: script.id,
                scriptLanguage: script.language,
                scriptAttributes: script.attributes,
                contentHash: script.contentHash,
                strategy
            }
        );
    }

    /**
     * 创建样式块
     * @param style Style块信息
     * @param context 处理上下文
     * @param strategy 策略名称
     * @returns 样式块
     */
    createStyleChunk(style: StyleBlock, context: IProcessingContext, strategy: string): CodeChunk {
        return this.createChunk(
            style.content,
            style.position.line,
            style.position.line + style.content.split('\n').length - 1,
            style.styleType,
            undefined,
            {
                filePath: context.filePath,
                startLine: style.position.line,
                endLine: style.position.line + style.content.split('\n').length - 1,
                type: 'style_content',
                complexity: HTMLProcessingUtils.calculateComplexity(style.content),
                styleId: style.id,
                styleType: style.styleType,
                styleAttributes: style.attributes,
                contentHash: style.contentHash,
                strategy
            }
        );
    }

    /**
     * 从解析结果创建脚本块
     * @param script Script块信息
     * @param result 解析结果
     * @param context 处理上下文
     * @param strategy 策略名称
     * @returns 脚本块数组
     */
    createScriptChunksFromResult(
        script: ScriptBlock,
        result: { content: any; startLine: number; endLine: number; metadata: { complexity: any; }; nodeId: any; name: any; },
        context: IProcessingContext,
        strategy: string
    ): CodeChunk[] {
        const startLine = script.position.line + result.startLine - 1;
        const endLine = script.position.line + result.endLine - 1;
        
        return [{
            content: result.content,
            metadata: {
                ...result.metadata,
                startLine,
                endLine,
                language: script.language,
                filePath: context.filePath,
                type: ChunkType.GENERIC,
                nodeId: result.nodeId,
                name: result.name,
                scriptId: script.id,
                scriptLanguage: script.language,
                scriptAttributes: script.attributes,
                contentHash: script.contentHash,
                strategy,
                timestamp: Date.now(),
                size: result.content.length,
                lineCount: endLine - startLine + 1
            }
        }];
    }

    /**
     * 从解析结果创建样式块
     * @param style Style块信息
     * @param result 解析结果
     * @param context 处理上下文
     * @param strategy 策略名称
     * @returns 样式块数组
     */
    createStyleChunksFromResult(
        style: StyleBlock,
        result: { content: any; startLine: number; endLine: number; metadata: { complexity: any; }; nodeId: any; name: any; },
        context: IProcessingContext,
        strategy: string
    ): CodeChunk[] {
        const startLine = style.position.line + result.startLine - 1;
        const endLine = style.position.line + result.endLine - 1;
        
        return [{
            content: result.content,
            metadata: {
                ...result.metadata,
                startLine,
                endLine,
                language: style.styleType,
                filePath: context.filePath,
                type: ChunkType.GENERIC,
                nodeId: result.nodeId,
                name: result.name,
                styleId: style.id,
                styleType: style.styleType,
                styleAttributes: style.attributes,
                contentHash: style.contentHash,
                strategy,
                timestamp: Date.now(),
                size: result.content.length,
                lineCount: endLine - startLine + 1
            }
        }];
    }

    /**
     * 从解析结果创建HTML块
     * @param result 解析结果
     * @param context 处理上下文
     * @param strategy 策略名称
     * @returns HTML块数组
     */
    createHTMLChunksFromResult(
        result: { content: any; startLine: number; endLine: number; metadata: any; nodeId: any; name: any; },
        context: IProcessingContext,
        strategy: string
    ): CodeChunk[] {
        return [{
            content: result.content,
            metadata: {
                ...result.metadata,
                startLine: result.startLine,
                endLine: result.endLine,
                language: 'html',
                filePath: context.filePath,
                type: ChunkType.GENERIC,
                nodeId: result.nodeId,
                name: result.name,
                strategy,
                timestamp: Date.now(),
                size: result.content.length,
                lineCount: result.endLine - result.startLine + 1
            }
        }];
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