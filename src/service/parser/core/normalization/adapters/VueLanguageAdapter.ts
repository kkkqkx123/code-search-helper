import { ILanguageAdapter, StandardizedQueryResult } from '../types';
import { LoggerService } from '../../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../../utils/ErrorHandlerService';
import Parser from 'tree-sitter';

/**
 * Vue语言适配器
 * 处理Vue文件的查询结果标准化
 * 使用分段解析策略解决tree-sitter-vue兼容性问题
 */
export class VueLanguageAdapter implements ILanguageAdapter {
    private typeScript: any = null;
    private css: any = null;
    private html: any = null;
    private logger = new LoggerService();
    private errorHandler: ErrorHandlerService;

    constructor() {
        this.errorHandler = new ErrorHandlerService(this.logger);
        this.initializeParsers();
    }

    /**
     * 异步初始化解析器
     */
    private async initializeParsers(): Promise<void> {
        try {
            // 加载TypeScript解析器
            this.typeScript = require('tree-sitter-typescript');
            this.logger.info('✅ TypeScript解析器加载成功');
        } catch (e) {
            this.logger.error('❌ TypeScript解析器加载失败:', e);
        }

        try {
            // 使用动态导入处理CSS的ESM问题
            const cssModule = await import('tree-sitter-css');
            this.css = cssModule.default;
            this.logger.info('✅ CSS解析器加载成功');
        } catch (e) {
            this.logger.error('❌ CSS解析器加载失败:', e);
        }

        try {
            // 尝试加载HTML解析器用于template部分
            this.html = require('tree-sitter-html');
            this.logger.info('✅ HTML解析器加载成功');
        } catch (e) {
            this.logger.warn('⚠️ HTML解析器加载失败，template部分将无法解析:', e);
        }
    }

    /**
     * 标准化Vue文件查询结果
     */
    async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
        // 对于Vue文件，我们需要根据查询类型分别处理不同部分
        const results: StandardizedQueryResult[] = [];

        // 如果查询结果来自Vue文件的分段解析，则进行特殊处理
        if (queryType === 'vue-file') {
            return this.normalizeVueFileStructure(queryResults);
        }

        // 否则按常规方式处理
        for (const result of queryResults) {
            try {
                const extraInfo = this.extractExtraInfo(result);
                results.push({
                    type: this.mapQueryTypeToStandardType(queryType),
                    name: this.extractName(result),
                    startLine: this.extractStartLine(result),
                    endLine: this.extractEndLine(result),
                    content: this.extractContent(result),
                    metadata: {
                        language,
                        complexity: this.calculateComplexity(result),
                        dependencies: this.extractDependencies(result),
                        modifiers: this.extractModifiers(result),
                        extra: Object.keys(extraInfo).length > 0 ? extraInfo : undefined
                    }
                });
            } catch (error) {
                this.logger.warn(`Failed to normalize Vue result for ${queryType}:`, error);
            }
        }

        return results;
    }

    /**
     * 标准化Vue文件结构
     */
    private normalizeVueFileStructure(vueFileAnalysis: any[]): StandardizedQueryResult[] {
        const results: StandardizedQueryResult[] = [];

        for (const analysis of vueFileAnalysis) {
            // 处理template部分
            if (analysis.template) {
                if (analysis.template.ast) {
                    // 如果有AST，创建HTML相关结果
                    results.push({
                        type: 'variable',
                        name: 'template',
                        startLine: 1,
                        endLine: analysis.template.statistics?.childCount ? analysis.template.statistics.childCount : 1,
                        content: analysis.template.ast.text || '',
                        metadata: {
                            language: 'html',
                            complexity: 1,
                            dependencies: [],
                            modifiers: ['vue-template']
                        }
                    });
                } else if (analysis.template.content) {
                    // 如果只有内容，创建内容结果
                    const lines = analysis.template.content.split('\n').length;
                    results.push({
                        type: 'variable',
                        name: 'template',
                        startLine: 1,
                        endLine: lines,
                        content: analysis.template.content,
                        metadata: {
                            language: 'html',
                            complexity: 1,
                            dependencies: [],
                            modifiers: ['vue-template']
                        }
                    });
                }
            }

            // 处理script部分
            if (analysis.script && Array.isArray(analysis.script)) {
                analysis.script.forEach((script: any, index: number) => {
                    if (script.ast) {
                        results.push({
                            type: 'function',
                            name: `script-${index}`,
                            startLine: 1,
                            endLine: script.statistics?.childCount ? script.statistics.childCount : 1,
                            content: script.ast.text || '',
                            metadata: {
                                language: script.lang,
                                complexity: script.statistics?.childCount || 1,
                                dependencies: [],
                                modifiers: ['vue-script', script.lang]
                            }
                        });
                    } else if (script.content) {
                        const lines = script.content.split('\n').length;
                        results.push({
                            type: 'function',
                            name: `script-${index}`,
                            startLine: 1,
                            endLine: lines,
                            content: script.content,
                            metadata: {
                                language: script.lang,
                                complexity: lines,
                                dependencies: [],
                                modifiers: ['vue-script', script.lang]
                            }
                        });
                    }
                });
            }

            // 处理style部分
            if (analysis.style && Array.isArray(analysis.style)) {
                analysis.style.forEach((style: any, index: number) => {
                    if (style.ast) {
                        results.push({
                            type: 'variable',
                            name: `style-${index}${style.scoped ? '-scoped' : ''}`,
                            startLine: 1,
                            endLine: style.statistics?.childCount ? style.statistics.childCount : 1,
                            content: style.ast.text || '',
                            metadata: {
                                language: 'css',
                                complexity: style.statistics?.childCount || 1,
                                dependencies: [],
                                modifiers: ['vue-style', style.scoped ? 'scoped' : 'global']
                            }
                        });
                    } else if (style.content) {
                        const lines = style.content.split('\n').length;
                        results.push({
                            type: 'variable',
                            name: `style-${index}${style.scoped ? '-scoped' : ''}`,
                            startLine: 1,
                            endLine: lines,
                            content: style.content,
                            metadata: {
                                language: 'css',
                                complexity: lines,
                                dependencies: [],
                                modifiers: ['vue-style', style.scoped ? 'scoped' : 'global']
                            }
                        });
                    }
                });
            }
        }

        return results;
    }

    /**
     * 获取支持的查询类型
     */
    getSupportedQueryTypes(): string[] {
        return [
            'template-elements',
            'template-directives',
            'component-definitions',
            'script-definitions',
            'style-definitions',
            'vue-exports',
            'vue-lifecycle',
            'vue-slots',
            'vue-interpolations'
        ];
    }

    /**
     * 映射节点类型
     */
    mapNodeType(nodeType: string): string {
        const typeMapping: Record<string, string> = {
            'template_element': 'element',
            'script_element': 'function',
            'style_element': 'element',
            'element': 'element',
            'start_tag': 'tag',
            'end_tag': 'tag',
            'attribute': 'attribute',
            'comment': 'comment',
            'function_declaration': 'function',
            'method_definition': 'method',
            'class_declaration': 'class',
            'import_statement': 'import',
            'export_statement': 'export',
            'variable_declaration': 'variable',
            'rule_set': 'element',
            'stylesheet': 'element'
        };

        return typeMapping[nodeType] || nodeType;
    }

    /**
     * 提取名称
     */
    extractName(result: any): string {
        // 尝试从不同的捕获中提取名称
        const nameCaptures = [
            'name.definition.function',
            'name.definition.method',
            'name.definition.class',
            'name.definition.component',
            'name.definition.directive',
            'name.definition.tag',
            'name.definition.component_name',
            'name.definition.event_handler',
            'name.definition.property_binding',
            'name.definition.slot_name',
            'name.definition.ref',
            'name.definition.key',
            'name.definition.v_model',
            'name.definition.show_hide',
            'name.definition.conditional',
            'name.definition.for_loop'
        ];

        for (const captureName of nameCaptures) {
            const capture = result.captures?.find((c: any) => c.name === captureName);
            if (capture?.node?.text) {
                return capture.node.text;
            }
        }

        // 如果没有找到名称捕获，尝试从主节点提取
        if (result.captures?.[0]?.node?.childForFieldName('name')?.text) {
            return result.captures[0].node.childForFieldName('name').text;
        }

        // 尝试从tag_name提取
        if (result.captures?.[0]?.node?.childForFieldName('tag_name')?.text) {
            return result.captures[0].node.childForFieldName('tag_name').text;
        }

        return 'unnamed';
    }

    /**
     * 提取内容
     */
    extractContent(result: any): string {
        const mainNode = result.captures?.[0]?.node;
        if (!mainNode) {
            return '';
        }

        return mainNode.text || '';
    }

    /**
     * 提取起始行
     */
    extractStartLine(result: any): number {
        const mainNode = result.captures?.[0]?.node;
        if (!mainNode) {
            return 1;
        }

        return (mainNode.startPosition?.row || 0) + 1; // 转换为1-based
    }

    /**
     * 提取结束行
     */
    extractEndLine(result: any): number {
        const mainNode = result.captures?.[0]?.node;
        if (!mainNode) {
            return 1;
        }

        return (mainNode.endPosition?.row || 0) + 1; // 转换为1-based
    }

    /**
     * 计算复杂度
     */
    calculateComplexity(result: any): number {
        let complexity = 1; // 基础复杂度

        const mainNode = result.captures?.[0]?.node;
        if (!mainNode) {
            return complexity;
        }

        // 基于节点类型增加复杂度
        const nodeType = mainNode.type;
        if (nodeType.includes('class')) complexity += 2;
        if (nodeType.includes('function')) complexity += 1;
        if (nodeType.includes('component')) complexity += 2;
        if (nodeType.includes('directive')) complexity += 0.5;

        // 基于代码行数增加复杂度
        const lineCount = this.extractEndLine(result) - this.extractStartLine(result) + 1;
        complexity += Math.floor(lineCount / 10);

        // 基于嵌套深度增加复杂度
        const nestingDepth = this.calculateNestingDepth(mainNode);
        complexity += nestingDepth;

        return complexity;
    }

    /**
     * 提取依赖
     */
    extractDependencies(result: any): string[] {
        const dependencies: string[] = [];
        const mainNode = result.captures?.[0]?.node;

        if (!mainNode) {
            return dependencies;
        }

        // 查找导入引用
        this.findImportReferences(mainNode, dependencies);

        // 查找组件引用
        this.findComponentReferences(mainNode, dependencies);

        return [...new Set(dependencies)]; // 去重
    }

    /**
     * 提取修饰符
     */
    extractModifiers(result: any): string[] {
        const modifiers: string[] = [];
        const mainNode = result.captures?.[0]?.node;

        if (!mainNode) {
            return modifiers;
        }

        // 检查常见的Vue修饰符和属性
        const text = mainNode.text || '';

        if (text.includes('export')) modifiers.push('export');
        if (text.includes('default')) modifiers.push('default');
        if (text.includes('async')) modifiers.push('async');
        if (text.includes('v-')) modifiers.push('vue-directive');
        if (text.includes('@')) modifiers.push('vue-event');
        if (text.includes(':')) modifiers.push('vue-binding');
        if (text.includes('#')) modifiers.push('vue-slot');

        return modifiers;
    }

    /**
     * 提取额外信息
     */
    extractExtraInfo(result: any): Record<string, any> {
        const extra: Record<string, any> = {};
        const mainNode = result.captures?.[0]?.node;

        if (!mainNode) {
            return extra;
        }

        // 提取Vue特定信息
        if (mainNode.type.includes('directive')) {
            extra.isVueDirective = true;
        }

        if (mainNode.type.includes('element')) {
            extra.isVueElement = true;
        }

        if (mainNode.type.includes('component')) {
            extra.isVueComponent = true;
        }

        return extra;
    }

    /**
     * 解析Vue文件，提取各个部分
     */
    parseVueFile(vueCode: string): VueFileSections {
        const sections: VueFileSections = {
            template: null,
            script: [],
            style: []
        };

        // 提取template部分
        const templateMatch = vueCode.match(/<template[^>]*>([\s\S]*?)<\/template>/);
        if (templateMatch) {
            sections.template = {
                content: templateMatch[1].trim(),
                lang: 'html'
            };
        }

        // 提取所有script部分
        const scriptMatches = vueCode.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g);
        for (const match of scriptMatches) {
            const scriptContent = match[1].trim();
            const langMatch = match[0].match(/lang="([^"]*)"/);
            const lang = langMatch ? langMatch[1] : 'javascript';
            sections.script.push({
                content: scriptContent,
                lang: lang
            });
        }

        // 提取所有style部分
        const styleMatches = vueCode.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g);
        for (const match of styleMatches) {
            const styleContent = match[1].trim();
            const scopedMatch = match[0].match(/scoped/);
            sections.style.push({
                content: styleContent,
                scoped: !!scopedMatch
            });
        }

        return sections;
    }

    /**
     * 解析Vue文件的各个部分
     */
    async analyzeVueFile(vueCode: string): Promise<VueFileAnalysis> {
        if (!this.typeScript || !this.css) {
            throw new Error('必要的解析器未初始化');
        }

        const sections = this.parseVueFile(vueCode);
        const analysis: VueFileAnalysis = {
            template: null,
            script: [],
            style: [],
            summary: {
                hasTemplate: !!sections.template,
                scriptCount: sections.script.length,
                styleCount: sections.style.length,
                hasTypeScript: sections.script.some(s => s.lang === 'ts'),
                hasScopedStyles: sections.style.some(s => s.scoped)
            }
        };

        // 分析template部分
        if (sections.template && this.html) {
            try {
                const parser = new Parser();
                parser.setLanguage(this.html);
                const tree = parser.parse(sections.template.content);

                analysis.template = {
                    ast: tree.rootNode,
                    statistics: {
                        nodeType: tree.rootNode.type,
                        childCount: tree.rootNode.childCount,
                        hasError: tree.rootNode.hasError
                    }
                };
            } catch (error) {
                analysis.template = {
                    error: error instanceof Error ? error.message : String(error),
                    content: sections.template.content
                };
            }
        } else if (sections.template) {
            analysis.template = {
                content: sections.template.content,
                note: 'HTML解析器不可用，仅显示原始内容'
            };
        }

        // 分析script部分
        for (let i = 0; i < sections.script.length; i++) {
            const script = sections.script[i];
            const scriptAnalysis: ScriptAnalysis = {
                lang: script.lang,
                ast: null,
                statistics: null,
                typescriptInfo: null,
                error: null
            };

            try {
                const parser = new Parser();
                const language = script.lang === 'ts' || script.lang === 'typescript'
                    ? this.typeScript.typescript
                    : this.typeScript.typescript;

                parser.setLanguage(language);
                const tree = parser.parse(script.content);

                scriptAnalysis.ast = tree.rootNode;
                scriptAnalysis.statistics = {
                    nodeType: tree.rootNode.type,
                    childCount: tree.rootNode.childCount,
                    hasError: tree.rootNode.hasError
                };

                // TypeScript特定分析
                if (script.lang === 'ts' || script.lang === 'typescript') {
                    const interfaces = tree.rootNode.descendantsOfType('interface_declaration');
                    const functions = tree.rootNode.descendantsOfType('function_declaration');
                    const variables = tree.rootNode.descendantsOfType('lexical_declaration');
                    const typeAliases = tree.rootNode.descendantsOfType('type_alias_declaration');

                    scriptAnalysis.typescriptInfo = {
                        interfaceCount: interfaces.length,
                        functionCount: functions.length,
                        variableCount: variables.length,
                        typeAliasCount: typeAliases.length,
                        interfaces: interfaces.map(n => n.childForFieldName('name')?.text).filter((text): text is string => text !== undefined) || [],
                        functions: functions.map(n => n.childForFieldName('name')?.text).filter((text): text is string => text !== undefined) || []
                    };
                }

            } catch (error) {
                scriptAnalysis.error = error instanceof Error ? error.message : String(error);
            }

            analysis.script.push(scriptAnalysis);
        }

        // 分析style部分
        for (let i = 0; i < sections.style.length; i++) {
            const style = sections.style[i];
            const styleAnalysis: StyleAnalysis = {
                scoped: style.scoped,
                ast: null,
                statistics: null,
                cssInfo: null,
                error: null
            };

            try {
                const parser = new Parser();
                parser.setLanguage(this.css);
                const tree = parser.parse(style.content);

                styleAnalysis.ast = tree.rootNode;
                styleAnalysis.statistics = {
                    nodeType: tree.rootNode.type,
                    childCount: tree.rootNode.childCount,
                    hasError: tree.rootNode.hasError
                };

                // CSS特定分析
                const ruleSets = tree.rootNode.descendantsOfType('rule_set');
                const mediaQueries = tree.rootNode.descendantsOfType('media_statement');
                const keyframes = tree.rootNode.descendantsOfType('keyframes_statement');

                styleAnalysis.cssInfo = {
                    ruleSetCount: ruleSets.length,
                    mediaQueryCount: mediaQueries.length,
                    keyframesCount: keyframes.length,
                    selectors: ruleSets.flatMap(rs =>
                        rs.childForFieldName('selectors')?.namedChildren.map(cn => cn.text) || []
                    )
                };

            } catch (error) {
                styleAnalysis.error = error instanceof Error ? error.message : String(error);
            }

            analysis.style.push(styleAnalysis);
        }

        return analysis;
    }

    /**
     * 检查是否已初始化
     */
    isInitialized(): boolean {
        return !!(this.typeScript && this.css);
    }

    /**
     * 等待初始化完成
     */
    async waitForInitialization(timeout = 1000): Promise<void> {
        const startTime = Date.now();

        while (!this.isInitialized() && Date.now() - startTime < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!this.isInitialized()) {
            throw new Error('VueLanguageAdapter初始化超时');
        }
    }

    private mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
        const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression'> = {
            'template-elements': 'variable',
            'template-directives': 'variable',
            'component-definitions': 'class',
            'script-definitions': 'function',
            'style-definitions': 'variable',
            'vue-exports': 'export',
            'vue-lifecycle': 'method',
            'vue-slots': 'variable',
            'vue-interpolations': 'expression'
        };

        return mapping[queryType] || 'expression';
    }

    private calculateNestingDepth(node: any, currentDepth: number = 0): number {
        if (!node || !node.children) {
            return currentDepth;
        }

        let maxDepth = currentDepth;

        for (const child of node.children) {
            if (this.isBlockNode(child)) {
                const childDepth = this.calculateNestingDepth(child, currentDepth + 1);
                maxDepth = Math.max(maxDepth, childDepth);
            }
        }

        return maxDepth;
    }

    private isBlockNode(node: any): boolean {
        const blockTypes = ['block', 'statement_block', 'class_body', 'element', 'template_element'];
        return blockTypes.includes(node.type);
    }

    private findImportReferences(node: any, dependencies: string[]): void {
        if (!node || !node.children) {
            return;
        }

        for (const child of node.children) {
            // 查找导入引用
            if (child.type === 'identifier' && child.text) {
                dependencies.push(child.text);
            } else if (child.type === 'import_specifier') {
                // 处理import { Component } from 'react'这类导入
                const importedName = child.childForFieldName('name');
                if (importedName && importedName.text) {
                    dependencies.push(importedName.text);
                }
            } else if (child.type === 'string' && child.text) {
                // 查找导入路径
                const path = child.text.replace(/['"]/g, '');
                if (path.startsWith('./') || path.startsWith('../') || path.startsWith('@/')) {
                    dependencies.push(path);
                }
            }

            this.findImportReferences(child, dependencies);
        }
    }

    private findComponentReferences(node: any, dependencies: string[]): void {
        if (!node || !node.children) {
            return;
        }

        for (const child of node.children) {
            // 查找组件引用（大写字母开头的标签名）
            if (child.type === 'tag_name' && child.text) {
                const tagName = child.text;
                if (tagName[0] === tagName[0].toUpperCase() && tagName !== tagName.toUpperCase()) {
                    dependencies.push(tagName);
                }
            } else if (child.type === 'element' && child.children) {
                // 查找元素内的组件
                for (const elementChild of child.children) {
                    if (elementChild.type === 'start_tag' && elementChild.children) {
                        for (const tagChild of elementChild.children) {
                            if (tagChild.type === 'tag_name' && tagChild.text) {
                                const tagName = tagChild.text;
                                if (tagName[0] === tagName[0].toUpperCase() && tagName !== tagName.toUpperCase()) {
                                    dependencies.push(tagName);
                                }
                            }
                        }
                    }
                }
            }

            this.findComponentReferences(child, dependencies);
        }
    }
}

// 类型定义
export interface VueSection {
    content: string;
    lang: string;
}

export interface VueScriptSection extends VueSection {
    lang: 'javascript' | 'typescript' | 'ts' | 'js' | string;
}

export interface VueStyleSection {
    content: string;
    scoped: boolean;
}

export interface VueFileSections {
    template: VueSection | null;
    script: VueScriptSection[];
    style: VueStyleSection[];
}

export interface ScriptStatistics {
    nodeType: string;
    childCount: number;
    hasError: boolean;
}

export interface TypeScriptInfo {
    interfaceCount: number;
    functionCount: number;
    variableCount: number;
    typeAliasCount: number;
    interfaces: string[];
    functions: string[];
}

export interface ScriptAnalysis {
    lang: string;
    ast: Parser.SyntaxNode | null;
    statistics: ScriptStatistics | null;
    typescriptInfo: TypeScriptInfo | null;
    error: string | null;
}

export interface StyleStatistics {
    nodeType: string;
    childCount: number;
    hasError: boolean;
}

export interface CSSInfo {
    ruleSetCount: number;
    mediaQueryCount: number;
    keyframesCount: number;
    selectors: string[];
}

export interface StyleAnalysis {
    scoped: boolean;
    ast: Parser.SyntaxNode | null;
    statistics: StyleStatistics | null;
    cssInfo: CSSInfo | null;
    error: string | null;
}

export interface TemplateAnalysis {
    ast?: Parser.SyntaxNode;
    statistics?: {
        nodeType: string;
        childCount: number;
        hasError: boolean;
    };
    content?: string;
    note?: string;
    error?: string;
}

export interface VueFileSummary {
    hasTemplate: boolean;
    scriptCount: number;
    styleCount: number;
    hasTypeScript: boolean;
    hasScopedStyles: boolean;
}

export interface VueFileAnalysis {
    template: TemplateAnalysis | null;
    script: ScriptAnalysis[];
    style: StyleAnalysis[];
    summary: VueFileSummary;
}