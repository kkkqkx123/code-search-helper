import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';

/**
 * Vue语言适配器
 * 处理Vue文件的查询结果标准化
 */
export class VueLanguageAdapter extends BaseLanguageAdapter {
    constructor(options: AdapterOptions = {}) {
        super(options);
    }

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

    mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
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

        // Vue特定的复杂度因素
        const text = mainNode.text || '';
        if (text.includes('v-for')) complexity += 1; // 循环
        if (text.includes('v-if') || text.includes('v-else')) complexity += 1; // 条件
        if (text.includes('computed')) complexity += 1; // 计算属性
        if (text.includes('watch')) complexity += 1; // 监听器
        if (text.includes('async') || text.includes('await')) complexity += 1; // 异步
        if (text.includes('vuex') || text.includes('vue-router')) complexity += 1; // 复杂框架集成

        return complexity;
    }

    extractDependencies(result: any): string[] {
        const dependencies: string[] = [];
        const mainNode = result.captures?.[0]?.node;

        if (!mainNode) {
            return dependencies;
        }

        // 首先检查捕获中的依赖项
        if (result.captures && Array.isArray(result.captures)) {
            for (const capture of result.captures) {
                if (capture.name && capture.name.includes('import') && capture.node?.text) {
                    // 提取导入的标识符
                    const importText = capture.node.text;
                    // 例如从 "Component" 提取标识符
                    const identifierMatch = importText.match(/[A-Za-z_][A-Za-z0-9_]*/g);
                    if (identifierMatch) {
                        dependencies.push(...identifierMatch);
                    }
                }
            }
        }


        // 查找类型引用
        this.findTypeReferences(mainNode, dependencies);

        // 查找导入引用
        this.findImportReferences(mainNode, dependencies);

        // 查找Vue组件引用（大写字母开头的标签名）
        this.findComponentReferences(mainNode, dependencies);

        // 查找类型引用
        this.findTypeReferences(mainNode, dependencies);
        
        // 查找导入引用
        this.findImportReferences(mainNode, dependencies);
   
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