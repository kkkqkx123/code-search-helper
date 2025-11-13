import { BaseStrategy } from '../base/BaseStrategy';
import { ProcessingResult, CodeChunk, ChunkMetadata, ChunkType } from '../../core/types/ResultTypes';
import { StrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../utils/logger';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { HtmlLanguageAdapter } from '../../../core/normalization/adapters/HtmlLanguageAdapter';
import { HtmlRelationshipExtractor } from '../../../core/normalization/adapters/html-utils/HtmlRelationshipExtractor';
import { HtmlRelationship } from '../../../core/normalization/adapters/html-utils/HtmlRelationshipTypes';
import {
    HTMLContentExtractor,
    HTMLProcessingUtils,
    ScriptBlock,
    StyleBlock,
    HTMLContentSeparator,
    HTMLFallbackProcessor,
    HTMLChunkFactory,
    HTMLResultMerger
} from '../../../processing/utils/html';
import Parser from 'tree-sitter';

/**
 * 混合HTML处理器
 * 结合LayeredHTMLStrategy的内容分离能力和AST解析的精确性
 */
export class HybridHTMLProcessor extends BaseStrategy {
    private logger: Logger;
    private htmlAdapter: HtmlLanguageAdapter;
    private relationshipExtractor: HtmlRelationshipExtractor;
    private contentSeparator: HTMLContentSeparator;
    private fallbackProcessor: HTMLFallbackProcessor;
    private chunkFactory: HTMLChunkFactory;
    private resultMerger: HTMLResultMerger;
    private scriptCache: Map<string, any> = new Map();
    private styleCache: Map<string, any> = new Map();

    constructor(config: StrategyConfig, htmlAdapter?: HtmlLanguageAdapter) {
        super(config);
        this.logger = Logger.getInstance();
        this.htmlAdapter = htmlAdapter || new HtmlLanguageAdapter();
        this.relationshipExtractor = new HtmlRelationshipExtractor();
        this.contentSeparator = new HTMLContentSeparator();
        this.fallbackProcessor = new HTMLFallbackProcessor();
        this.chunkFactory = new HTMLChunkFactory();
        this.resultMerger = new HTMLResultMerger();
    }

    async execute(context: IProcessingContext): Promise<ProcessingResult> {
        const startTime = Date.now();
        const chunks = await this.process(context);
        const executionTime = Date.now() - startTime;

        return {
            chunks,
            success: true,
            executionTime,
            strategy: this.name
        };
    }

    /**
     * 检查是否可以处理指定的上下文
     */
    canHandle(context: IProcessingContext): boolean {
        const { language, content } = context;

        // 只处理HTML文件
        if (!language || !['html', 'htm'].includes(language.toLowerCase())) {
            return false;
        }

        // 检查内容是否包含HTML结构
        return /<[^>]+>/.test(content);
    }

    /**
     * 执行分段处理
     */
    async process(context: IProcessingContext): Promise<CodeChunk[]> {
        const startTime = Date.now();
        this.logger.info(`Starting hybrid HTML processing for ${context.filePath}`);

        try {
            // 1. 内容分离
            const separated = this.contentSeparator.separateContent(context.content);

            // 2. 并行AST解析
            const [htmlResult, scriptResults, styleResults] = await Promise.all([
                this.parseHTMLStructure(separated.html, context),
                this.parseScriptContent(separated.scripts, context),
                this.parseStyleContent(separated.styles, context)
            ]);

            // 3. 关系提取
            const relationships = await this.extractRelationships(
                htmlResult.ast,
                scriptResults,
                styleResults
            );

            // 4. 结果合并
            const chunks = this.resultMerger.mergeResults(
                htmlResult.chunks,
                scriptResults.flatMap(r => r.chunks),
                styleResults.flatMap(r => r.chunks),
                relationships
            );

            const processingTime = Date.now() - startTime;
            this.updatePerformanceStats(processingTime, true, chunks.length);
            this.logger.info(`Hybrid HTML processing completed in ${processingTime}ms`);

            return chunks;
        } catch (error) {
            this.logger.error(`Hybrid HTML processing failed: ${error}`);

            // 降级到简单的HTML处理
            this.logger.warn(`Falling back to simple HTML processing for ${context.filePath}`);
            return this.fallbackProcessor.createFallbackChunks(context);
        }
    }

    /**
     * 获取支持的语言列表
     */
    getSupportedLanguages(): string[] {
        return ['html', 'htm'];
    }

    /**
     * 解析HTML结构
     * @param htmlContent HTML内容
     * @param context 处理上下文
     * @returns 解析结果
     */
    private async parseHTMLStructure(
        htmlContent: string,
        context: IProcessingContext
    ): Promise<{
        ast: Parser.SyntaxNode;
        chunks: CodeChunk[];
    }> {
        // 使用Tree-sitter解析HTML结构
        const parseResult = await this.parseWithTreeSitter(htmlContent, 'html');

        if (!parseResult.success || !parseResult.ast) {
            this.logger.warn('Failed to parse HTML with Tree-sitter, using fallback processing');
            return {
                ast: null as any,
                chunks: this.fallbackProcessor.createFallbackHTMLChunks(htmlContent, context)
            };
        }

        // 使用适配器标准化查询结果
        const queryResults = await this.executeQuery(parseResult.ast, 'elements');
        const standardizedResults = await this.htmlAdapter.normalize(queryResults, 'elements', 'html');

        // 转换为CodeChunk格式
        const chunks = standardizedResults.flatMap(result =>
            this.chunkFactory.createHTMLChunksFromResult(result, context, this.name)
        );

        return {
            ast: parseResult.ast,
            chunks
        };
    }

    /**
     * 解析Script内容
     * @param scripts Script块数组
     * @param context 处理上下文
     * @returns 解析结果数组
     */
    private async parseScriptContent(
        scripts: ScriptBlock[],
        context: IProcessingContext
    ): Promise<Array<{
        ast: Parser.SyntaxNode | null;
        chunks: CodeChunk[];
    }>> {
        const results = [];

        for (const script of scripts) {
            try {
                this.logger.debug(`Processing script: ${script.id} (${script.language})`);

                // 生成缓存键
                const cacheKey = HTMLProcessingUtils.generateScriptCacheKey(script);

                // 检查缓存
                const cached = this.scriptCache.get(cacheKey);
                if (cached) {
                    this.logger.debug(`Using cached result for script ${script.id}`);
                    results.push(cached);
                    continue;
                }

                // 使用Tree-sitter解析脚本内容
                const parseResult = await this.parseWithTreeSitter(script.content, script.language);

                let chunks: CodeChunk[] = [];

                if (parseResult.success && parseResult.ast) {
                    // 使用相应的语言适配器处理
                    const languageAdapter = this.getLanguageAdapter(script.language);
                    if (languageAdapter) {
                        const queryResults = await this.executeQuery(parseResult.ast, 'functions');
                        const standardizedResults = await languageAdapter.normalize(queryResults, 'functions', script.language);

                        chunks = standardizedResults.flatMap((result: any) =>
                            this.chunkFactory.createScriptChunksFromResult(script, result, context, this.name)
                        );
                    } else {
                        // 创建简单的脚本块
                        chunks = [this.chunkFactory.createScriptChunk(script, context, this.name)];
                    }
                } else {
                    // 创建简单的脚本块
                    chunks = [this.chunkFactory.createScriptChunk(script, context, this.name)];
                }

                const result = {
                    ast: parseResult.success ? parseResult.ast : null,
                    chunks
                };

                // 缓存结果
                this.scriptCache.set(cacheKey, result);
                results.push(result);

            } catch (error) {
                this.logger.warn(`Failed to process script ${script.id}: ${error}`);

                // 创建简单的脚本块
                results.push({
                    ast: null,
                    chunks: [this.chunkFactory.createScriptChunk(script, context, this.name)]
                });
            }
        }

        return results;
    }

    /**
     * 解析Style内容
     * @param styles Style块数组
     * @param context 处理上下文
     * @returns 解析结果数组
     */
    private async parseStyleContent(
        styles: StyleBlock[],
        context: IProcessingContext
    ): Promise<Array<{
        ast: Parser.SyntaxNode | null;
        chunks: CodeChunk[];
    }>> {
        const results = [];

        for (const style of styles) {
            try {
                this.logger.debug(`Processing style: ${style.id} (${style.styleType})`);

                // 生成缓存键
                const cacheKey = HTMLProcessingUtils.generateStyleCacheKey(style);

                // 检查缓存
                const cached = this.styleCache.get(cacheKey);
                if (cached) {
                    this.logger.debug(`Using cached result for style ${style.id}`);
                    results.push(cached);
                    continue;
                }

                // 使用Tree-sitter解析样式内容
                const parseResult = await this.parseWithTreeSitter(style.content, style.styleType);

                let chunks: CodeChunk[] = [];

                if (parseResult.success && parseResult.ast) {
                    // 使用相应的语言适配器处理
                    const languageAdapter = this.getLanguageAdapter(style.styleType);
                    if (languageAdapter) {
                        const queryResults = await this.executeQuery(parseResult.ast, 'rules');
                        const standardizedResults = await languageAdapter.normalize(queryResults, 'rules', style.styleType);

                        chunks = standardizedResults.flatMap((result: { content: any; startLine: number; endLine: number; metadata: { complexity: any; }; nodeId: any; name: any; }) =>
                            this.chunkFactory.createStyleChunksFromResult(style, result, context, this.name)
                        );
                    } else {
                        // 创建简单的样式块
                        chunks = [this.chunkFactory.createStyleChunk(style, context, this.name)];
                    }
                } else {
                    // 创建简单的样式块
                    chunks = [this.chunkFactory.createStyleChunk(style, context, this.name)];
                }

                const result = {
                    ast: parseResult.success ? parseResult.ast : null,
                    chunks
                };

                // 缓存结果
                this.styleCache.set(cacheKey, result);
                results.push(result);

            } catch (error) {
                this.logger.warn(`Failed to process style ${style.id}: ${error}`);

                // 创建简单的样式块
                results.push({
                    ast: null,
                    chunks: [this.chunkFactory.createStyleChunk(style, context, this.name)]
                });
            }
        }

        return results;
    }

    /**
      * 提取关系
      * @param htmlAST HTML AST
      * @param scriptResults 脚本解析结果
      * @param styleResults 样式解析结果
      * @returns 关系数组
      */
    private async extractRelationships(
        htmlAST: Parser.SyntaxNode,
        scriptResults: Array<{ ast: Parser.SyntaxNode | null; chunks: CodeChunk[] }>,
        styleResults: Array<{ ast: Parser.SyntaxNode | null; chunks: CodeChunk[] }>
    ): Promise<HtmlRelationship[]> {
        const allRelationships: HtmlRelationship[] = [];

        // 提取HTML结构关系
        if (htmlAST) {
            const result = await this.relationshipExtractor.extractAllRelationships(htmlAST);
            allRelationships.push(...result.relationships);
        }

        // 提取脚本关系
        for (const scriptResult of scriptResults) {
            if (scriptResult.ast) {
                try {
                    // 这里可以添加脚本特定的关系提取逻辑
                    // 暂时跳过，因为脚本关系提取比较复杂
                } catch (error) {
                    this.logger.warn(`Failed to extract script relationships: ${error}`);
                }
            }
        }

        // 提取样式关系
        for (const styleResult of styleResults) {
            if (styleResult.ast) {
                try {
                    // 这里可以添加样式特定的关系提取逻辑
                    // 暂时跳过，因为样式关系提取比较复杂
                } catch (error) {
                    this.logger.warn(`Failed to extract style relationships: ${error}`);
                }
            }
        }

        return allRelationships;
    }

    /**
     * 使用Tree-sitter解析内容
     * @param content 内容
     * @param language 语言
     * @returns 解析结果
     */
    private async parseWithTreeSitter(
        content: string,
        language: string
    ): Promise<{
        success: boolean;
        ast: Parser.SyntaxNode | null;
        error?: string;
    }> {
        try {
            // 这里应该使用实际的Tree-sitter解析器
            // 暂时返回模拟结果
            return {
                success: true,
                ast: null as any // 实际应该是解析后的AST
            };
        } catch (error) {
            return {
                success: false,
                ast: null,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 执行查询
     * @param ast AST节点
     * @param queryType 查询类型
     * @returns 查询结果
     */
    private async executeQuery(
        ast: Parser.SyntaxNode,
        queryType: string
    ): Promise<any[]> {
        try {
            // 这里应该使用实际的查询执行器
            // 暂时返回空结果
            return [];
        } catch (error) {
            this.logger.error(`Query execution failed: ${error}`);
            return [];
        }
    }

    /**
     * 获取语言适配器
     * @param language 语言
     * @returns 语言适配器
     */
    private getLanguageAdapter(language: string): any {
        // 这里应该根据语言类型返回相应的适配器
        // 暂时返回null，表示使用默认处理
        return null;
    }

    /**
     * 清理缓存
     */
    public clearCache(): void {
        this.scriptCache.clear();
        this.styleCache.clear();
        this.logger.debug('Hybrid HTML processor cache cleared');
    }

    /**
     * 获取缓存统计
     */
    public getCacheStats(): { scriptCache: number; styleCache: number } {
        return {
            scriptCache: this.scriptCache.size,
            styleCache: this.styleCache.size
        };
    }
}