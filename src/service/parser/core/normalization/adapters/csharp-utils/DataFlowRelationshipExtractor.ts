import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { CSharpHelperMethods } from './CSharpHelperMethods';
import Parser from 'tree-sitter';

/**
 * C# 数据流关系提取器
 * 从 CSharpLanguageAdapter 迁移
 */
export class DataFlowRelationshipExtractor {
    /**
     * 提取数据流关系元数据
     */
    extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
        const flowType = this.determineFlowType(astNode);
        const sourceNode = this.extractSourceNode(astNode);
        const targetNode = this.extractTargetNode(astNode);
        const flowPath = this.extractFlowPath(astNode);
        const dataType = this.extractDataType(astNode);

        return {
            type: 'data-flow',
            fromNodeId: sourceNode ? generateDeterministicNodeId(sourceNode) : 'unknown',
            toNodeId: targetNode ? generateDeterministicNodeId(targetNode) : 'unknown',
            flowType,
            flowPath,
            dataType,
            location: {
                filePath: symbolTable?.filePath || 'current_file.cs',
                lineNumber: astNode.startPosition.row + 1,
                columnNumber: astNode.startPosition.column + 1,
            }
        };
    }

    /**
     * 提取数据流关系数组
     */
    extractDataFlowRelationships(result: any): Array<{
        source: string;
        target: string;
        type: 'assignment' | 'parameter' | 'return';
    }> {
        const relationships: Array<{
            source: string;
            target: string;
            type: 'assignment' | 'parameter' | 'return';
        }> = [];
        const mainNode = result.captures?.[0]?.node;

        if (!mainNode) {
            return relationships;
        }

        // 从捕获中查找数据流关系
        for (const capture of result.captures || []) {
            if (capture.name.includes('source.variable')) {
                const source = capture.node?.text || '';
                const targetCapture = result.captures?.find((c: any) => c.name.includes('target.variable'));
                // @ts-ignore
                const target = targetCapture?.node?.text || '';

                if (source && target) {
                    relationships.push({
                        source,
                        target,
                        type: 'assignment'
                    });
                }
            } else if (capture.name.includes('source.parameter')) {
                const source = capture.node?.text || '';
                const targetCapture = result.captures?.find((c: any) => c.name.includes('target.function'));
                const target = targetCapture?.node?.text || '';

                if (source && target) {
                    relationships.push({
                        source,
                        target,
                        type: 'parameter'
                    });
                }
            } else if (capture.name.includes('source.variable') && result.captures?.some((c: any) => c.name.includes('data.flow.return'))) {
                const source = capture.node?.text || '';

                relationships.push({
                    source,
                    target: result.captures?.[0]?.node?.parent?.childForFieldName?.('name')?.text || 'unknown',
                    type: 'return'
                });
            }
        }

        return relationships;
    }

    /**
     * 确定数据流类型
     */
    private determineFlowType(node: Parser.SyntaxNode): 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access' | 'property_access' {
        if (node.type === 'assignment_expression') {
            return 'variable_assignment';
        } else if (node.type === 'parameter') {
            return 'parameter_passing';
        } else if (node.type === 'return_statement') {
            return 'return_value';
        } else if (node.type === 'member_access_expression') {
            return 'field_access';
        } else if (node.type === 'property_declaration') {
            return 'property_access';
        }

        return 'variable_assignment';
    }

    /**
     * 提取源节点
     */
    private extractSourceNode(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
        switch (node.type) {
            case 'assignment_expression':
                return node.childForFieldName('right');
            case 'parameter':
                return node.childForFieldName('type');
            case 'return_statement':
                return node.childForFieldName('expression');
            case 'member_access_expression':
                return node.childForFieldName('expression');
            case 'property_declaration':
                return node.childForFieldName('accessors');
            default:
                return null;
        }
    }

    /**
     * 提取目标节点
     */
    private extractTargetNode(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
        switch (node.type) {
            case 'assignment_expression':
                return node.childForFieldName('left');
            case 'parameter':
                return node.childForFieldName('name');
            case 'return_statement':
                return node.parent?.childForFieldName('name') ?? null;
            case 'member_access_expression':
                return node.childForFieldName('name');
            case 'property_declaration':
                return node.childForFieldName('name');
            default:
                return null;
        }
    }

    /**
     * 提取数据流路径
     */
    private extractFlowPath(node: Parser.SyntaxNode): string[] {
        const path: string[] = [];
        let current: Parser.SyntaxNode | null = node;

        while (current) {
            if (current.type === 'identifier' || current.type === 'member_access_expression') {
                path.unshift(current.text);
            }
            current = current.parent;
        }

        return path;
    }

    /**
     * 提取数据类型
     */
    private extractDataType(node: Parser.SyntaxNode): string | null {
        // 尝试从节点中提取类型信息
        switch (node.type) {
            case 'assignment_expression':
                const left = node.childForFieldName('left');
                if (left) {
                    // 尝试从变量声明中获取类型
                    const declaration = left.parent as Parser.SyntaxNode | null;
                    if (declaration?.type === 'variable_declaration') {
                        const typeNode = declaration.childForFieldName('type') as any;
                        return typeNode?.text || null;
                    }
                }
                break;
            case 'parameter':
            const typeNode = node.childForFieldName('type') as any;
            return typeNode ? typeNode.text : null;
            case 'property_declaration':
            const propertyType = node.childForFieldName('type') as any;
            return propertyType ? propertyType.text : null;
        }

        return null;
    }

    /**
     * 分析LINQ数据流
     */
    analyzeLinqDataFlow(node: Parser.SyntaxNode): Array<{
        source: string;
        target: string;
        type: 'linq_transformation' | 'linq_filtering' | 'linq_projection' | 'linq_grouping' | 'linq_ordering';
    }> {
        const relationships: Array<{
            source: string;
            target: string;
            type: 'linq_transformation' | 'linq_filtering' | 'linq_projection' | 'linq_grouping' | 'linq_ordering';
        }> = [];

        if (!CSharpHelperMethods.isLinqExpression(node)) {
            return relationships;
        }

        // 分析LINQ子句
        for (const child of node.children) {
            let linqType: 'linq_transformation' | 'linq_filtering' | 'linq_projection' | 'linq_grouping' | 'linq_ordering' | null = null;

            switch (child.type) {
                case 'from_clause':
                    linqType = 'linq_transformation';
                    break;
                case 'where_clause':
                    linqType = 'linq_filtering';
                    break;
                case 'select_clause':
                    linqType = 'linq_projection';
                    break;
                case 'group_clause':
                    linqType = 'linq_grouping';
                    break;
                case 'order_by_clause':
                    linqType = 'linq_ordering';
                    break;
            }

            if (linqType) {
                const source = this.extractLinqSource(child);
                const target = this.extractLinqTarget(child);

                if (source && target) {
                    relationships.push({
                        source,
                        target,
                        type: linqType
                    });
                }
            }
        }

        return relationships;
    }

    /**
     * 提取LINQ源
     */
    private extractLinqSource(node: Parser.SyntaxNode): string | null {
        // 根据LINQ子句类型提取源
        switch (node.type) {
            case 'from_clause':
                const fromExpression = node.childForFieldName('expression');
                return fromExpression?.text || null;
            case 'where_clause':
            case 'select_clause':
            case 'group_clause':
            case 'order_by_clause':
                // 这些子句的源是前一个子句的结果
                return 'previous_linq_result';
            default:
                return null;
        }
    }

    /**
     * 提取LINQ目标
     */
    private extractLinqTarget(node: Parser.SyntaxNode): string | null {
        // 根据LINQ子句类型提取目标
        switch (node.type) {
            case 'from_clause':
                const identifier = node.childForFieldName('identifier');
                return identifier?.text || null;
            case 'where_clause':
                const condition = node.childForFieldName('condition');
                return condition?.text || null;
            case 'select_clause':
                const expression = node.childForFieldName('expression');
                return expression?.text || null;
            case 'group_clause':
                const groupExpression = node.childForFieldName('group_expression');
                return groupExpression?.text || null;
            case 'order_by_clause':
                const ordering = node.childForFieldName('ordering');
                return ordering?.text || null;
            default:
                return null;
        }
    }
}