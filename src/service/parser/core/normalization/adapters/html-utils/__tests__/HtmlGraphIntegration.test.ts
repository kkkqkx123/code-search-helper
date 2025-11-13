import { HtmlGraphNodeGenerator } from '../HtmlGraphNodeGenerator';
import { HtmlGraphRelationshipGenerator } from '../HtmlGraphRelationshipGenerator';
import { HtmlRelationshipExtractor } from '../HtmlRelationshipExtractor';
import { CodeChunk } from '../../../../types';
import { HtmlRelationship } from '../HtmlRelationshipTypes';

describe('HTML Graph Integration Tests', () => {
    let nodeGenerator: HtmlGraphNodeGenerator;
    let relationshipGenerator: HtmlGraphRelationshipGenerator;
    let relationshipExtractor: HtmlRelationshipExtractor;

    beforeEach(() => {
        nodeGenerator = new HtmlGraphNodeGenerator();
        relationshipGenerator = new HtmlGraphRelationshipGenerator();
        relationshipExtractor = new HtmlRelationshipExtractor();
    });

    describe('Node Generation', () => {
        test('should generate nodes from HTML chunks', () => {
            // 创建模拟的代码块
            const chunks: CodeChunk[] = [
                {
                    content: '<div class="container">Hello World</div>',
                    metadata: {
                        startLine: 1,
                        endLine: 1,
                        language: 'html',
                        filePath: 'test.html',
                        type: 'element',
                        tagName: 'div',
                        elementType: 'container',
                        attributes: { class: 'container' },
                        nodeId: 'test.html:1:element'
                    }
                },
                {
                    content: 'console.log("Hello");',
                    metadata: {
                        startLine: 2,
                        endLine: 2,
                        language: 'javascript',
                        filePath: 'test.html',
                        type: 'script',
                        scriptId: 'script1',
                        scriptLanguage: 'javascript',
                        nodeId: 'test.html:2:script'
                    }
                }
            ];

            // 创建模拟的关系
            const relationships: HtmlRelationship[] = [
                {
                    type: 'parent-child',
                    source: 'test.html:1:element',
                    target: 'test.html:2:script',
                    metadata: {
                        sourceTag: 'div',
                        targetTag: 'script'
                    },
                    sourceTag: 'div',
                    targetTag: 'script'
                }
            ];

            // 生成节点
            const nodes = nodeGenerator.generateNodes(chunks, relationships);

            expect(nodes).toHaveLength(2);
            expect(nodes[0].type).toBe('Element');
            expect(nodes[0].name).toBe('div');
            expect(nodes[1].type).toBe('Script');
            expect(nodes[1].name).toBe('script:script1');
        });

        test('should generate external resource nodes', () => {
            const chunks: CodeChunk[] = [];
            const relationships: HtmlRelationship[] = [
                {
                    type: 'resource-dependency',
                    source: 'test.html:1:element',
                    target: 'https://example.com/script.js',
                    metadata: {
                        resourceType: 'script',
                        attribute: 'src'
                    },
                    dependencyType: 'src',
                    resourceType: 'script',
                    resourceUrl: 'https://example.com/script.js',
                    isExternal: true
                }
            ];

            const nodes = nodeGenerator.generateNodes(chunks, relationships);

            expect(nodes).toHaveLength(1);
            expect(nodes[0].type).toBe('Resource');
            expect(nodes[0].name).toBe('script.js');
            expect(nodes[0].properties.isExternal).toBe(true);
        });
    });

    describe('Relationship Generation', () => {
        test('should generate graph relationships from HTML relationships', () => {
            // 创建模拟的图节点
            const nodes = [
                {
                    id: 'test.html:1:element',
                    type: 'Element',
                    name: 'div',
                    properties: {}
                },
                {
                    id: 'test.html:2:script',
                    type: 'Script',
                    name: 'script',
                    properties: {}
                }
            ];

            // 创建模拟的HTML关系
            const relationships: HtmlRelationship[] = [
                {
                    type: 'parent-child',
                    source: 'test.html:1:element',
                    target: 'test.html:2:script',
                    metadata: {
                        sourceTag: 'div',
                        targetTag: 'script'
                    },
                    sourceTag: 'div',
                    targetTag: 'script'
                }
            ];

            // 生成图关系
            const graphRelationships = relationshipGenerator.generateRelationships(relationships, nodes);

            expect(graphRelationships).toHaveLength(1);
            expect(graphRelationships[0].type).toBe('CONTAINS');
            expect(graphRelationships[0].sourceId).toBe('test.html:1:element');
            expect(graphRelationships[0].targetId).toBe('test.html:2:script');
            expect(graphRelationships[0].properties.originalType).toBe('parent-child');
        });

        test('should handle missing nodes gracefully', () => {
            const nodes = [
                {
                    id: 'test.html:1:element',
                    type: 'Element',
                    name: 'div',
                    properties: {}
                }
            ];

            const relationships: HtmlRelationship[] = [
                {
                    type: 'parent-child',
                    source: 'test.html:1:element',
                    target: 'test.html:2:script', // 这个节点不存在
                    metadata: {},
                    sourceTag: 'div',
                    targetTag: 'script'
                }
            ];

            const graphRelationships = relationshipGenerator.generateRelationships(relationships, nodes);

            // 应该返回空数组，因为目标节点不存在
            expect(graphRelationships).toHaveLength(0);
        });
    });

    describe('Integration Test', () => {
        test('should work end-to-end with realistic data', () => {
            // 创建更真实的HTML代码块
            const chunks: CodeChunk[] = [
                {
                    content: '<html><head><title>Test</title></head><body>',
                    metadata: {
                        startLine: 1,
                        endLine: 1,
                        language: 'html',
                        filePath: 'test.html',
                        type: 'document',
                        nodeId: 'test.html:1:document'
                    }
                },
                {
                    content: '<div id="main" class="container">',
                    metadata: {
                        startLine: 2,
                        endLine: 2,
                        language: 'html',
                        filePath: 'test.html',
                        type: 'element',
                        tagName: 'div',
                        attributes: { id: 'main', class: 'container' },
                        nodeId: 'test.html:2:element'
                    }
                },
                {
                    content: '<script src="app.js"></script>',
                    metadata: {
                        startLine: 3,
                        endLine: 3,
                        language: 'html',
                        filePath: 'test.html',
                        type: 'element',
                        tagName: 'script',
                        attributes: { src: 'app.js' },
                        nodeId: 'test.html:3:element'
                    }
                }
            ];

            const relationships: HtmlRelationship[] = [
                {
                    type: 'parent-child',
                    source: 'test.html:1:document',
                    target: 'test.html:2:element',
                    metadata: {
                        sourceTag: 'html',
                        targetTag: 'div'
                    },
                    sourceTag: 'html',
                    targetTag: 'div'
                },
                {
                    type: 'resource-dependency',
                    source: 'test.html:3:element',
                    target: 'app.js',
                    metadata: {
                        resourceType: 'script',
                        attribute: 'src'
                    },
                    dependencyType: 'src',
                    resourceType: 'script',
                    resourceUrl: 'app.js',
                    isExternal: false
                }
            ];

            // 生成节点
            const nodes = nodeGenerator.generateNodes(chunks, relationships);
            expect(nodes).toHaveLength(4); // 3个内部节点 + 1个外部资源节点

            // 生成关系
            const graphRelationships = relationshipGenerator.generateRelationships(relationships, nodes);
            expect(graphRelationships).toHaveLength(2); // 1个结构关系 + 1个依赖关系

            // 验证关系类型映射
            const containsRel = graphRelationships.find(rel => rel.type === 'CONTAINS');
            expect(containsRel).toBeDefined();
            
            const dependsRel = graphRelationships.find(rel => rel.type === 'DEPENDS_ON');
            expect(dependsRel).toBeDefined();
        });
    });
});