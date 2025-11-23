import { BaseLanguageAdapter, AdapterOptions } from './base/BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';
import { NodeIdGenerator } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import {
    JsHelperMethods,
    JS_SUPPORTED_QUERY_TYPES,
    JS_NODE_TYPE_MAPPING,
    JS_NAME_CAPTURES,
    JS_COMPLEXITY_KEYWORDS,
    CallRelationshipExtractor,
    DataFlowRelationshipExtractor,
    InheritanceRelationshipExtractor,
    ConcurrencyRelationshipExtractor,
    LifecycleRelationshipExtractor,
    SemanticRelationshipExtractor,
    ControlFlowRelationshipExtractor
} from './js-utils';

/**
 * Vue语言适配器
 * 处理Vue文件的查询结果标准化
 */
export class VueLanguageAdapter extends BaseLanguageAdapter {
    // 关系提取器实例
    private callExtractor: CallRelationshipExtractor;
    private dataFlowExtractor: DataFlowRelationshipExtractor;
    private inheritanceExtractor: InheritanceRelationshipExtractor;
    private concurrencyExtractor: ConcurrencyRelationshipExtractor;
    private lifecycleExtractor: LifecycleRelationshipExtractor;
    private semanticExtractor: SemanticRelationshipExtractor;
    private controlFlowExtractor: ControlFlowRelationshipExtractor;

    constructor(options: AdapterOptions = {}) {
        super(options);

        // 初始化关系提取器
        this.callExtractor = new CallRelationshipExtractor();
        this.dataFlowExtractor = new DataFlowRelationshipExtractor();
        this.inheritanceExtractor = new InheritanceRelationshipExtractor();
        this.concurrencyExtractor = new ConcurrencyRelationshipExtractor();
        this.lifecycleExtractor = new LifecycleRelationshipExtractor();
        this.semanticExtractor = new SemanticRelationshipExtractor();
        this.controlFlowExtractor = new ControlFlowRelationshipExtractor();
    }

    getSupportedQueryTypes(): string[] {
        // 基于JavaScript支持的查询类型，添加Vue特定的类型
        return [
            ...JS_SUPPORTED_QUERY_TYPES,
            'components',
            'template-directives',
            'annotation-relationships',
            'creation-relationships',
            'reference-relationships',
            'dependency-relationships'
        ];
    }

    mapNodeType(nodeType: string): string {
        // 首先尝试Vue特定的映射
        const vueTypeMapping: Record<string, string> = {
            'template_element': 'class',
            'script_element': 'class',
            'style_element': 'class',
            'element': 'class',
            'start_tag': 'class',
            'end_tag': 'class',
            'attribute': 'expression',
            'attribute_name': 'expression',
            'comment': 'expression',
            'function_declaration': 'function',
            'method_definition': 'method',
            'lifecycle_hook': 'method',
            'class_declaration': 'class',
            'component_tag': 'class',
            'import_statement': 'import',
            'export_statement': 'export',
            'variable_declaration': 'variable',
            'interpolation': 'variable',
            'property_identifier': 'expression',
            'tag_name': 'expression',
            'rule_set': 'class',
            'stylesheet': 'class'
        };

        // 如果Vue特定映射存在，使用它；否则使用JavaScript的映射；最后返回默认值
        return vueTypeMapping[nodeType] || JS_NODE_TYPE_MAPPING[nodeType] || 'expression';
    }

    extractName(result: any): string {
        // 尝试从JavaScript的名称捕获中提取名称
        for (const captureName of JS_NAME_CAPTURES) {
            const capture = result.captures?.find((c: any) => c.name === captureName);
            if (capture?.node?.text) {
                return capture.node.text;
            }
        }

        // 尝试从Vue特定的捕获中提取名称
        const vueNameCaptures = [
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

        for (const captureName of vueNameCaptures) {
            const capture = result.captures?.find((c: any) => c.name === captureName);
            if (capture?.node?.text) {
                return capture.node.text;
            }
        }

        // 如果没有找到名称捕获，尝试从主节点提取
        if (result.captures?.[0]?.node?.childForFieldName?.('name')?.text) {
            return result.captures[0].node.childForFieldName('name').text;
        }

        // 尝试从tag_name提取
        if (result.captures?.[0]?.node?.childForFieldName?.('tag_name')?.text) {
            return result.captures[0].node.childForFieldName('tag_name').text;
        }

        return 'unnamed';
    }

    extractLanguageSpecificMetadata(result: any): Record<string, any> {
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

        // 检查是否有v-前缀的属性（Vue指令）
        if (mainNode.type === 'attribute' && mainNode.text && mainNode.text.startsWith('v-')) {
            extra.vueDirective = mainNode.text.split('=')[0];
        }

        return extra;
    }

    mapQueryTypeToStandardType(queryType: string): StandardizedQueryResult['type'] {
        const mapping: Record<string, StandardizedQueryResult['type']> = {
            'components': 'class',
            'template-directives': 'variable',

            // 关系类型
            'calls': 'call',
            'data-flows': 'data-flow',
            'inheritance': 'inheritance',

            // 高级关系类型
            'concurrency-relationships': 'concurrency',
            'control-flow-relationships': 'control-flow',
            'lifecycle-relationships': 'lifecycle',
            'semantic-relationships': 'semantic'
        };

        return mapping[queryType] || 'expression';
    }

    calculateComplexity(result: any): number {
        let complexity = this.calculateBaseComplexity(result);

        const mainNode = result.captures?.[0]?.node;
        if (!mainNode) {
            return complexity;
        }

        // 基于节点类型增加复杂度
        const nodeType = mainNode.type || '';
        if (nodeType && nodeType.includes('class')) complexity += 2;
        if (nodeType && nodeType.includes('function')) complexity += 1;
        if (nodeType && nodeType.includes('component')) complexity += 2;
        if (nodeType && nodeType.includes('directive')) complexity += 0.5;

        // JavaScript/TypeScript特定的复杂度因素
        const text = mainNode.text || '';
        for (const keyword of JS_COMPLEXITY_KEYWORDS) {
            if (new RegExp(keyword.pattern).test(text)) {
                complexity += keyword.weight;
            }
        }

        // Vue特定的复杂度因素
        if (text.includes('v-for')) complexity += 1; // 循环
        if (text.includes('v-if') || text.includes('v-else')) complexity += 1; // 条件
        if (text.includes('computed')) complexity += 1; // 计算属性
        if (text.includes('watch')) complexity += 1; // 监听器
        if (text.includes('vuex') || text.includes('vue-router')) complexity += 1; // 复杂框架集成

        return complexity;
    }

    extractDependencies(result: any): string[] {
        const dependencies: string[] = [];
        const mainNode = result.captures?.[0]?.node;

        if (!mainNode) {
            return dependencies;
        }

        // 使用辅助方法查找依赖
        JsHelperMethods.findTypeReferences(mainNode, dependencies);
        JsHelperMethods.findFunctionCalls(mainNode, dependencies);
        JsHelperMethods.findImportDependencies(mainNode, dependencies);
        JsHelperMethods.findDataFlowDependencies(mainNode, dependencies);
        JsHelperMethods.findConcurrencyDependencies(mainNode, dependencies);
        JsHelperMethods.findInheritanceDependencies(mainNode, dependencies);
        JsHelperMethods.findInterfaceDependencies(mainNode, dependencies);
        JsHelperMethods.findTypeAliasDependencies(mainNode, dependencies);

        // 查找Vue组件引用（大写字母开头的标签名）
        this.findComponentReferences(mainNode, dependencies);

        return [...new Set(dependencies)]; // 去重
    }

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
        if (text.includes('computed')) modifiers.push('computed');
        if (text.includes('watch')) modifiers.push('watch');
        if (text.includes('methods')) modifiers.push('methods');
        if (text.includes('data')) modifiers.push('data');

        return modifiers;
    }

    // Vue特定的辅助方法
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

    // 重写normalize方法以集成nodeId生成和符号信息
    async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
        const results: StandardizedQueryResult[] = [];

        for (const result of queryResults) {
            try {
                const standardType = this.mapQueryTypeToStandardType(queryType);
                const name = this.extractName(result);
                const content = this.extractContent(result);
                const complexity = this.calculateComplexity(result);
                const dependencies = this.extractDependencies(result);
                const modifiers = this.extractModifiers(result);
                const extra = this.extractLanguageSpecificMetadata(result);

                // 获取AST节点以生成确定性ID
                const astNode = result.captures?.[0]?.node;
                const nodeId = NodeIdGenerator.safeForAstNode(astNode, standardType, name);

                let relationshipMetadata: any = null;

                // 对于关系类型，提取特定的元数据
                if (this.isRelationshipType(standardType)) {
                    relationshipMetadata = this.extractRelationshipMetadata(result, standardType, astNode);
                }

                results.push({
                    nodeId,
                    type: standardType,
                    name,
                    startLine: result.startLine || 1,
                    endLine: result.endLine || 1,
                    content,
                    metadata: {
                        language,
                        complexity,
                        dependencies,
                        modifiers,
                        extra: {
                            ...extra,
                            ...relationshipMetadata // 合并关系特定的元数据
                        }
                    }
                });
            } catch (error) {
                this.logger?.error(`Error normalizing Vue language result: ${error}`);
            }
        }

        return results;
    }

    private isRelationshipType(type: StandardizedQueryResult['type']): boolean {
        return ['call', 'data-flow', 'inheritance', 'concurrency', 'lifecycle', 'semantic', 'control-flow'].includes(type);
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

    private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
        if (!astNode) return null;

        switch (standardType) {
            case 'call':
                return this.callExtractor.extractCallMetadata(result, astNode, null);
            case 'data-flow':
                return this.dataFlowExtractor.extractDataFlowMetadata(result, astNode, null);
            case 'inheritance':
                return this.inheritanceExtractor.extractInheritanceMetadata(result, astNode, null);
            case 'concurrency':
                return this.concurrencyExtractor.extractConcurrencyMetadata(result, astNode, null);
            case 'lifecycle':
                return this.lifecycleExtractor.extractLifecycleMetadata(result, astNode, null);
            case 'semantic':
                return this.semanticExtractor.extractSemanticMetadata(result, astNode, null);
            case 'control-flow':
                return this.controlFlowExtractor.extractControlFlowMetadata(result, astNode, null);
            default:
                return null;
        }
    }
}