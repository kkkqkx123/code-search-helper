import { BaseStrategy } from '../base/BaseStrategy';
import { ProcessingResult, CodeChunk, ChunkMetadata, ChunkType } from '../../core/types/ResultTypes';
import { StrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../utils/logger';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { HtmlLanguageAdapter } from '../../../core/normalization/adapters/HtmlLanguageAdapter';
import { HtmlRelationshipExtractor } from '../../../core/normalization/adapters/html-utils/HtmlRelationshipExtractor';
import { HtmlRelationship } from '../../../core/normalization/adapters/html-utils/HtmlRelationshipTypes';
import { HtmlGraphNodeGenerator } from '../../../core/normalization/adapters/html-utils/HtmlGraphNodeGenerator';
import { HtmlGraphRelationshipGenerator } from '../../../core/normalization/adapters/html-utils/HtmlGraphRelationshipGenerator';
import { CodeGraphNode, CodeGraphRelationship } from '../../../../graph/core/types';
import { HTMLContentExtractor } from '../../../processing/utils/html/HTMLContentExtractor';
import { HTMLProcessingUtils } from '../../../processing/utils/html/HTMLProcessingUtils';
import { ScriptBlock, StyleBlock } from '../../../processing/utils/html/LayeredHTMLConfig';
import Parser from 'tree-sitter';

/**
 * 混合HTML处理器
 * 结合LayeredHTMLStrategy的内容分离能力和AST解析的精确性
 */
export class HybridHTMLProcessor extends BaseStrategy {
    private logger: Logger;
    private htmlAdapter: HtmlLanguageAdapter;
    private relationshipExtractor: HtmlRelationshipExtractor;
    private htmlExtractor: HTMLContentExtractor;
    private nodeGenerator: HtmlGraphNodeGenerator;
    private relationshipGenerator: HtmlGraphRelationshipGenerator;
    private scriptCache: Map<string, any> = new Map();
    private styleCache: Map<string, any> = new Map();

    constructor(config: StrategyConfig, htmlAdapter?: HtmlLanguageAdapter) {
        super(config);
        this.logger = Logger.getInstance();
        this.htmlAdapter = htmlAdapter || new HtmlLanguageAdapter();
        this.relationshipExtractor = new HtmlRelationshipExtractor();
        this.htmlExtractor = new HTMLContentExtractor();
        this.nodeGenerator = new HtmlGraphNodeGenerator();
        this.relationshipGenerator = new HtmlGraphRelationshipGenerator();
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
            const separated = await this.separateContent(context.content);

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
            const chunks = this.mergeResults(
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
            return this.createFallbackChunks(context);
        }
    }

    /**
     * 获取支持的语言列表
     */
    getSupportedLanguages(): string[] {
        return ['html', 'htm'];
    }

    /**
     * 内容分离器
     * @param content HTML内容
     * @returns 分离后的内容
     */
    private async separateContent(content: string): Promise<{
        html: string;
        scripts: ScriptBlock[];
        styles: StyleBlock[];
    }> {
        // 使用HTMLContentExtractor提取内容
        const scripts = this.htmlExtractor.extractScripts(content);
        const styles = this.htmlExtractor.extractStyles(content);

        // 移除script和style标签，只保留HTML结构
        let htmlContent = content;

        // 移除script标签
        htmlContent = htmlContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

        // 移除style标签
        htmlContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

        return {
            html: htmlContent,
            scripts,
            styles
        };
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
                chunks: this.createFallbackHTMLChunks(htmlContent, context)
            };
        }

        // 使用适配器标准化查询结果
        const queryResults = await this.executeQuery(parseResult.ast, 'elements');
        const standardizedResults = await this.htmlAdapter.normalize(queryResults, 'elements', 'html');

        // 转换为CodeChunk格式
        const chunks = standardizedResults.map(result => ({
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
                strategy: this.name,
                timestamp: Date.now(),
                size: result.content.length,
                lineCount: result.endLine - result.startLine + 1
            }
        }));

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

                        chunks = standardizedResults.map((result: { content: any; startLine: number; endLine: number; metadata: { complexity: any; }; nodeId: any; name: any; }) => {
                            const startLine = script.position.line + result.startLine - 1;
                            const endLine = script.position.line + result.endLine - 1;
                            return {
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
                                    strategy: this.name,
                                    timestamp: Date.now(),
                                    size: result.content.length,
                                    lineCount: endLine - startLine + 1
                                }
                            };
                        });
                    } else {
                        // 创建简单的脚本块
                        chunks = [this.createScriptChunk(script, context)];
                    }
                } else {
                    // 创建简单的脚本块
                    chunks = [this.createScriptChunk(script, context)];
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
                    chunks: [this.createScriptChunk(script, context)]
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

                        chunks = standardizedResults.map((result: { content: any; startLine: number; endLine: number; metadata: { complexity: any; }; nodeId: any; name: any; }) => {
                            const startLine = style.position.line + result.startLine - 1;
                            const endLine = style.position.line + result.endLine - 1;
                            return {
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
                                    strategy: this.name,
                                    timestamp: Date.now(),
                                    size: result.content.length,
                                    lineCount: endLine - startLine + 1
                                }
                            };
                        });
                    } else {
                        // 创建简单的样式块
                        chunks = [this.createStyleChunk(style, context)];
                    }
                } else {
                    // 创建简单的样式块
                    chunks = [this.createStyleChunk(style, context)];
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
                    chunks: [this.createStyleChunk(style, context)]
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
     * 合并结果
     * @param htmlChunks HTML块
     * @param scriptChunks 脚本块
     * @param styleChunks 样式块
     * @param relationships 关系数组
     * @returns 合并后的块数组
     */
    private mergeResults(
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
            const chunkRelationships = relationshipMap.get(chunk.metadata.nodeId) || [];
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

        // 生成图节点和关系
        const combinedChunks = [...htmlChunks, ...scriptChunks, ...styleChunks];
        const graphData = this.generateGraphData(combinedChunks, relationships);

        // 将图数据添加到增强块中
        const finalChunks = enhancedChunks.map(chunk => {
            const chunkNodeIds = [(chunk.metadata as any).nodeId].filter(Boolean);
            const relatedNodes = graphData.nodes.filter((node: CodeGraphNode) => 
                chunkNodeIds.includes(node.id) || 
                this.isNodeRelatedToChunk(node, chunk, relationships)
            );
            
            const relatedRelationships = graphData.relationships.filter((rel: CodeGraphRelationship) => 
                chunkNodeIds.includes(rel.sourceId) || 
                chunkNodeIds.includes(rel.targetId)
            );

            return {
                ...chunk,
                metadata: {
                    ...chunk.metadata,
                    graphData: {
                        relatedNodes,
                        relatedRelationships,
                        nodeCount: relatedNodes.length,
                        relationshipCount: relatedRelationships.length
                    }
                }
            };
        });

        return finalChunks;
    }

    /**
     * 创建降级块
     * @param context 处理上下文
     * @returns 降级块数组
     */
    private createFallbackChunks(context: IProcessingContext): CodeChunk[] {
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
    private createFallbackHTMLChunks(htmlContent: string, context: IProcessingContext): CodeChunk[] {
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
     * 创建脚本块
     * @param script Script块信息
     * @param context 处理上下文
     * @returns 脚本块
     */
    private createScriptChunk(script: ScriptBlock, context: IProcessingContext): CodeChunk {
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
                contentHash: script.contentHash
            }
        );
    }

    /**
     * 创建样式块
     * @param style Style块信息
     * @param context 处理上下文
     * @returns 样式块
     */
    private createStyleChunk(style: StyleBlock, context: IProcessingContext): CodeChunk {
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
                contentHash: style.contentHash
            }
        );
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
     * 创建代码块
     * @param content 内容
     * @param startLine 起始行
     * @param endLine 结束行
     * @param language 语言
     * @param name 名称
     * @param metadata 元数据
     * @returns 代码块
     */
    protected createChunk(
        content: string,
        startLine: number,
        endLine: number,
        language: string,
        name?: string,
        metadata?: any
    ): CodeChunk {
        const mergedMetadata: ChunkMetadata = {
            startLine,
            endLine,
            language,
            strategy: this.name,
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

    /**
     * 生成图数据
     * @param chunks 代码块数组
     * @param relationships HTML关系数组
     * @returns 图数据
     */
    private generateGraphData(
        chunks: CodeChunk[],
        relationships: HtmlRelationship[]
    ): {
        nodes: CodeGraphNode[];
        relationships: CodeGraphRelationship[];
    } {
        try {
            // 生成图节点
            const nodes = this.nodeGenerator.generateNodes(chunks, relationships);
            
            // 生成图关系
            const graphRelationships = this.relationshipGenerator.generateRelationships(
                relationships,
                nodes
            );

            this.logger.debug(`Generated graph data: ${nodes.length} nodes, ${graphRelationships.length} relationships`);

            return {
                nodes,
                relationships: graphRelationships
            };
        } catch (error) {
            this.logger.error(`Failed to generate graph data: ${error}`);
            return {
                nodes: [],
                relationships: []
            };
        }
    }

    /**
     * 判断节点是否与代码块相关
     * @param node 图节点
     * @param chunk 代码块
     * @param relationships HTML关系数组
     * @returns 是否相关
     */
    private isNodeRelatedToChunk(
        node: CodeGraphNode,
        chunk: CodeChunk,
        relationships: HtmlRelationship[]
    ): boolean {
        // 检查节点是否在代码块的行范围内
        if (node.properties.startLine && node.properties.endLine) {
            const chunkStart = chunk.metadata.startLine;
            const chunkEnd = chunk.metadata.endLine;
            const nodeStart = node.properties.startLine;
            const nodeEnd = node.properties.endLine;

            if (nodeStart >= chunkStart && nodeEnd <= chunkEnd) {
                return true;
            }
        }

        // 检查节点是否通过关系与代码块相关
        const chunkNodeId = (chunk.metadata as any).nodeId;
        if (chunkNodeId) {
            for (const rel of relationships) {
                if ((rel.source === chunkNodeId && node.id.includes(rel.target)) ||
                    (rel.target === chunkNodeId && node.id.includes(rel.source))) {
                    return true;
                }
            }
        }

        // 检查文件路径是否匹配
        if (node.properties.filePath && chunk.metadata.filePath) {
            if (node.properties.filePath === chunk.metadata.filePath) {
                return true;
            }
        }

        return false;
    }
}