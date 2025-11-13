import { HtmlRelationshipExtractor } from '../HtmlRelationshipExtractor';
import { HtmlRelationship } from '../HtmlRelationshipTypes';

describe('HTML Graph Integration Tests', () => {
    let relationshipExtractor: HtmlRelationshipExtractor;

    beforeEach(() => {
        relationshipExtractor = new HtmlRelationshipExtractor();
    });

    describe('Relationship Extraction', () => {
        test('should extract HTML relationships correctly', async () => {
            // 创建模拟的AST节点
            const mockAST = {
                type: 'document',
                startPosition: { row: 0, column: 0 },
                children: [
                    {
                        type: 'element',
                        childForFieldName: 'body',
                        startPosition: { row: 0, column: 0 },
                        children: [
                            {
                                type: 'start_tag',
                                childForFieldName: 'tag_name',
                                text: 'div',
                                startPosition: { row: 0, column: 0 }
                            },
                            {
                                type: 'element',
                                childForFieldName: 'div',
                                startPosition: { row: 0, column: 0 },
                                children: [
                                    {
                                        type: 'start_tag',
                                        childForFieldName: 'tag_name',
                                        text: 'script',
                                        startPosition: { row: 0, column: 0 }
                                    },
                                    {
                                        type: 'attribute',
                                        childForFieldName: 'attribute_name',
                                        text: 'src',
                                        startPosition: { row: 0, column: 0 }
                                    },
                                    {
                                        type: 'quoted_attribute_value',
                                        text: '"app.js"',
                                        startPosition: { row: 0, column: 0 }
                                    }
                                ]
                            }
                        ]
                    }
                ]
            } as any;

            // 提取关系
            const result = await relationshipExtractor.extractAllRelationships(mockAST);

            expect(result.relationships).toBeDefined();
            expect(result.relationships.length).toBeGreaterThan(0);
        });

        test('should extract structural relationships', async () => {
            const mockAST = {
                type: 'element',
                childForFieldName: 'div',
                startPosition: { row: 0, column: 0 },
                children: [
                    {
                        type: 'element',
                        childForFieldName: 'p',
                        startPosition: { row: 0, column: 0 },
                        children: [
                            {
                                type: 'start_tag',
                                childForFieldName: 'tag_name',
                                text: 'p',
                                startPosition: { row: 0, column: 0 }
                            }
                        ]
                    }
                ]
            } as any;

            const result = await relationshipExtractor.extractAllRelationships(mockAST);

            // 应该提取到父子关系
            const parentChildRelations = result.relationships.filter(
                (rel: HtmlRelationship) => rel.type === 'parent-child'
            );
            expect(parentChildRelations.length).toBeGreaterThan(0);
        });

        test('should extract dependency relationships', async () => {
            const mockAST = {
                type: 'element',
                childForFieldName: 'script',
                startPosition: { row: 0, column: 0 },
                children: [
                    {
                        type: 'attribute',
                        childForFieldName: 'attribute_name',
                        text: 'src',
                        startPosition: { row: 0, column: 0 }
                    },
                    {
                        type: 'quoted_attribute_value',
                        text: '"app.js"',
                        startPosition: { row: 0, column: 0 }
                    }
                ]
            } as any;

            const result = await relationshipExtractor.extractAllRelationships(mockAST);

            // 应该提取到资源依赖关系
            const dependencyRelations = result.relationships.filter(
                (rel: HtmlRelationship) => rel.type === 'resource-dependency'
            );
            expect(dependencyRelations.length).toBeGreaterThan(0);
        });

        test('should extract reference relationships', async () => {
            const mockAST = {
                type: 'element',
                childForFieldName: 'label',
                startPosition: { row: 0, column: 0 },
                children: [
                    {
                        type: 'attribute',
                        childForFieldName: 'attribute_name',
                        text: 'for',
                        startPosition: { row: 0, column: 0 }
                    },
                    {
                        type: 'quoted_attribute_value',
                        text: '"input-id"',
                        startPosition: { row: 0, column: 0 }
                    }
                ]
            } as any;

            const result = await relationshipExtractor.extractAllRelationships(mockAST);

            // 应该提取到引用关系
            const referenceRelations = result.relationships.filter(
                (rel: HtmlRelationship) => rel.type === 'id-reference'
            );
            expect(referenceRelations.length).toBeGreaterThan(0);
        });
    });

    describe('Relationship Types', () => {
        test('should create proper structural relationships', () => {
            const structuralRel: HtmlRelationship = {
                type: 'parent-child',
                source: 'div-1',
                target: 'p-1',
                metadata: {
                    sourceTag: 'div',
                    targetTag: 'p'
                },
                sourceTag: 'div',
                targetTag: 'p'
            };

            expect(structuralRel.type).toBe('parent-child');
            expect(structuralRel.sourceTag).toBe('div');
            expect(structuralRel.targetTag).toBe('p');
        });

        test('should create proper dependency relationships', () => {
            const dependencyRel: HtmlRelationship = {
                type: 'resource-dependency',
                source: 'script-1',
                target: 'app.js',
                metadata: {
                    resourceType: 'script',
                    attribute: 'src'
                },
                dependencyType: 'src',
                resourceType: 'script',
                resourceUrl: 'app.js',
                isExternal: false
            };

            expect(dependencyRel.type).toBe('resource-dependency');
            expect(dependencyRel.dependencyType).toBe('src');
            expect(dependencyRel.resourceType).toBe('script');
            expect(dependencyRel.resourceUrl).toBe('app.js');
        });

        test('should create proper reference relationships', () => {
            const referenceRel: HtmlRelationship = {
                type: 'id-reference',
                source: 'label-1',
                target: 'input-1',
                metadata: {
                    referenceType: 'for',
                    referenceValue: 'input-id'
                },
                referenceType: 'for',
                referenceValue: 'input-id',
                referenceAttribute: 'for'
            };

            expect(referenceRel.type).toBe('id-reference');
            expect(referenceRel.referenceType).toBe('for');
            expect(referenceRel.referenceValue).toBe('input-id');
        });
    });

    describe('Integration Test', () => {
        test('should handle complex HTML structure', async () => {
            const mockAST = {
                type: 'document',
                startPosition: { row: 0, column: 0 },
                children: [
                    {
                        type: 'element',
                        childForFieldName: 'html',
                        startPosition: { row: 0, column: 0 },
                        children: [
                            {
                                type: 'element',
                                childForFieldName: 'head',
                                startPosition: { row: 0, column: 0 },
                                children: [
                                    {
                                        type: 'element',
                                        childForFieldName: 'title',
                                        startPosition: { row: 0, column: 0 },
                                        children: [
                                            {
                                                type: 'text',
                                                text: 'Test Page',
                                                startPosition: { row: 0, column: 0 }
                                            }
                                        ]
                                    },
                                    {
                                        type: 'element',
                                        childForFieldName: 'link',
                                        startPosition: { row: 0, column: 0 },
                                        children: [
                                            {
                                                type: 'attribute',
                                                childForFieldName: 'attribute_name',
                                                text: 'rel',
                                                startPosition: { row: 0, column: 0 }
                                            },
                                            {
                                                type: 'quoted_attribute_value',
                                                text: '"stylesheet"',
                                                startPosition: { row: 0, column: 0 }
                                            },
                                            {
                                                type: 'attribute',
                                                childForFieldName: 'attribute_name',
                                                text: 'href',
                                                startPosition: { row: 0, column: 0 }
                                            },
                                            {
                                                type: 'quoted_attribute_value',
                                                text: '"styles.css"',
                                                startPosition: { row: 0, column: 0 }
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                type: 'element',
                                childForFieldName: 'body',
                                startPosition: { row: 0, column: 0 },
                                children: [
                                    {
                                        type: 'element',
                                        childForFieldName: 'div',
                                        startPosition: { row: 0, column: 0 },
                                        children: [
                                            {
                                                type: 'attribute',
                                                childForFieldName: 'attribute_name',
                                                text: 'id',
                                                startPosition: { row: 0, column: 0 }
                                            },
                                            {
                                                type: 'quoted_attribute_value',
                                                text: '"main"',
                                                startPosition: { row: 0, column: 0 }
                                            },
                                            {
                                                type: 'element',
                                                childForFieldName: 'button',
                                                startPosition: { row: 0, column: 0 },
                                                children: [
                                                    {
                                                        type: 'attribute',
                                                        childForFieldName: 'attribute_name',
                                                        text: 'onclick',
                                                        startPosition: { row: 0, column: 0 }
                                                    },
                                                    {
                                                        type: 'quoted_attribute_value',
                                                        text: '"handleClick()"',
                                                        startPosition: { row: 0, column: 0 }
                                                    }
                                                ]
                                            }
                                        ]
                                    },
                                    {
                                        type: 'element',
                                        childForFieldName: 'script',
                                        startPosition: { row: 0, column: 0 },
                                        children: [
                                            {
                                                type: 'attribute',
                                                childForFieldName: 'attribute_name',
                                                text: 'src',
                                                startPosition: { row: 0, column: 0 }
                                            },
                                            {
                                                type: 'quoted_attribute_value',
                                                text: '"app.js"',
                                                startPosition: { row: 0, column: 0 }
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]
            } as any;

            const result = await relationshipExtractor.extractAllRelationships(mockAST);

            expect(result.relationships.length).toBeGreaterThan(0);

            // 验证不同类型的关系都被提取
            const types = new Set(result.relationships.map(rel => rel.type));
            expect(types.has('parent-child')).toBe(true);
            expect(types.has('resource-dependency')).toBe(true);
        });
    });
});