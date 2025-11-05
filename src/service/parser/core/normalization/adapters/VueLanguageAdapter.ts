import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

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
            // Entity types
            'components',
            'template-directives',
            
            // Relationship types
            'calls',
            'data-flows',
            'inheritance',
            
            // Advanced relationship types
            'concurrency-relationships',
            'control-flow-relationships',
            'lifecycle-relationships',
            'semantic-relationships'
        ];
    }

    mapNodeType(nodeType: string): string {
        const typeMapping: Record<string, string> = {
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

        return typeMapping[nodeType] || 'expression';
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
              const nodeId = astNode ? generateDeterministicNodeId(astNode) : `${standardType}:${name}:${Date.now()}`;
    
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
          return ['call', 'data-flow', 'inheritance', 'concurrency', 'lifecycle', 'semantic'].includes(type);
        }
    
        private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
          if (!astNode) return null;
    
          switch (standardType) {
            case 'call':
              return this.extractCallMetadata(result, astNode);
            case 'data-flow':
              return this.extractDataFlowMetadata(result, astNode);
            case 'inheritance':
              return this.extractInheritanceMetadata(result, astNode);
            case 'concurrency':
              return this.extractConcurrencyMetadata(result, astNode);
            case 'lifecycle':
              return this.extractLifecycleMetadata(result, astNode);
            case 'semantic':
              return this.extractSemanticMetadata(result, astNode);
            default:
              return null;
          }
        }
    
        private extractCallMetadata(result: any, astNode: Parser.SyntaxNode): any {
          // Vue特定的调用元数据提取
          const functionNode = astNode.childForFieldName('function');
          const callerNode = this.findCallerFunctionContext(astNode);
    
          return {
            fromNodeId: callerNode ? generateDeterministicNodeId(callerNode) : 'unknown',
            toNodeId: functionNode ? generateDeterministicNodeId(functionNode) : 'unknown',
            callName: functionNode?.text || 'unknown',
            location: {
              filePath: 'current_file.vue',
              lineNumber: astNode.startPosition.row + 1,
              columnNumber: astNode.startPosition.column,
            }
          };
        }
    
        private extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode): any {
          // Vue特定的数据流元数据提取
          const left = astNode.childForFieldName('left');
          const right = astNode.childForFieldName('right');
    
          return {
            fromNodeId: right ? generateDeterministicNodeId(right) : 'unknown',
            toNodeId: left ? generateDeterministicNodeId(left) : 'unknown',
            flowType: 'assignment',
            location: {
              filePath: 'current_file.vue',
              lineNumber: astNode.startPosition.row + 1,
              columnNumber: astNode.startPosition.column,
            }
          };
        }
    
        private extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode): any {
          // Vue组件继承关系元数据提取
          return {
            type: 'inheritance',
            operation: 'extends', // Vue组件继承
            location: {
              filePath: 'current_file.vue',
              lineNumber: astNode.startPosition.row + 1,
            }
          };
        }
    
        private findCallerFunctionContext(callNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
          let current = callNode.parent;
          while (current) {
            if (current.type === 'function_declaration' || current.type === 'method_definition') {
              return current;
            }
            current = current.parent;
          }
          return null;
        }
    
        private extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode): any {
          // Vue并发关系元数据提取（例如异步操作）
          return {
            type: 'concurrency',
            operation: 'async-operation', // Vue中的异步操作
            location: {
              filePath: 'current_file.vue',
              lineNumber: astNode.startPosition.row + 1,
            }
          };
        }
    
        private extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode): any {
          // Vue生命周期关系元数据提取
          return {
            type: 'lifecycle',
            operation: 'lifecycle-hook', // Vue生命周期钩子
            location: {
              filePath: 'current_file.vue',
              lineNumber: astNode.startPosition.row + 1,
            }
          };
        }
    
        private extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode): any {
          // Vue语义关系元数据提取
          return {
            type: 'semantic',
            pattern: 'component-pattern', // Vue组件模式
            location: {
              filePath: 'current_file.vue',
              lineNumber: astNode.startPosition.row + 1,
            }
          };
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