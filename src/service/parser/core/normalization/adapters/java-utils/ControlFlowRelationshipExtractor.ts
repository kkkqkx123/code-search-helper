import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import { JavaHelperMethods } from './JavaHelperMethods';
import Parser from 'tree-sitter';

/**
 * Java 控制流关系提取器
 * 从 JavaLanguageAdapter 迁移控制流关系提取逻辑
 */
export class ControlFlowRelationshipExtractor {
    /**
     * 提取控制流关系元数据
     */
    extractControlFlowMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
        const captures = result.captures || [];
        const metadata: any = {
            type: 'control-flow',
            location: {
                filePath: symbolTable?.filePath || 'current_file.java',
                lineNumber: astNode.startPosition.row + 1,
                columnNumber: astNode.startPosition.column
            }
        };

        // 提取控制流类型
        for (const capture of captures) {
            if (capture.name.includes('condition') || capture.name.includes('if')) {
                metadata.controlFlowType = 'conditional';
                metadata.condition = capture.node.text;
                metadata.fromNodeId = generateDeterministicNodeId(astNode);
                metadata.toNodeId = generateDeterministicNodeId(capture.node);
            } else if (capture.name.includes('loop') || capture.name.includes('for') || capture.name.includes('while')) {
                metadata.controlFlowType = 'loop';
                metadata.loopCondition = capture.node.text;
                metadata.fromNodeId = generateDeterministicNodeId(astNode);
                metadata.toNodeId = generateDeterministicNodeId(capture.node);
            } else if (capture.name.includes('exception') || capture.name.includes('try') || capture.name.includes('catch')) {
                metadata.controlFlowType = 'exception';
                metadata.exceptionType = capture.node.text;
                metadata.fromNodeId = generateDeterministicNodeId(astNode);
                metadata.toNodeId = generateDeterministicNodeId(capture.node);
            } else if (capture.name.includes('callback') || capture.name.includes('lambda')) {
                metadata.controlFlowType = 'callback';
                metadata.callbackFunction = capture.node.text;
                metadata.fromNodeId = generateDeterministicNodeId(astNode);
                metadata.toNodeId = generateDeterministicNodeId(capture.node);
            }
        }

        // 如果没有从捕获中获取到信息，尝试从AST节点分析
        if (!metadata.controlFlowType) {
            this.analyzeControlFlowFromAST(astNode, metadata);
        }

        return metadata;
    }

    /**
     * 从AST节点分析控制流关系
     */
    private analyzeControlFlowFromAST(astNode: Parser.SyntaxNode, metadata: any): void {
        // 提取条件控制流
        if (astNode.type === 'if_statement') {
            metadata.controlFlowType = 'conditional';
            const condition = astNode.childForFieldName('condition');
            if (condition?.text) {
                metadata.condition = condition.text;
                metadata.toNodeId = generateDeterministicNodeId(condition);
            }
            metadata.fromNodeId = generateDeterministicNodeId(astNode);
        }

        // 提取循环控制流
        if (astNode.type === 'for_statement' || astNode.type === 'while_statement' ||
            astNode.type === 'enhanced_for_statement' || astNode.type === 'do_statement') {
            metadata.controlFlowType = 'loop';
            const condition = astNode.childForFieldName('condition');
            if (condition?.text) {
                metadata.loopCondition = condition.text;
                metadata.toNodeId = generateDeterministicNodeId(condition);
            } else {
                // 对于for循环，尝试从for子句中提取条件
                const forClause = astNode.childForFieldName('init') ||
                    astNode.childForFieldName('update') ||
                    astNode.childForFieldName('body');
                if (forClause?.text) {
                    metadata.loopCondition = forClause.text;
                    metadata.toNodeId = generateDeterministicNodeId(forClause);
                }
            }
            metadata.fromNodeId = generateDeterministicNodeId(astNode);
        }

        // 提取异常控制流
        if (astNode.type === 'try_statement') {
            metadata.controlFlowType = 'exception';
            const tryBlock = astNode.childForFieldName('body');
            if (tryBlock?.text) {
                metadata.tryBlock = tryBlock.text;
                metadata.toNodeId = generateDeterministicNodeId(tryBlock);
            }

            // 检查catch子句
            const catchClauses = astNode.children.filter(child => child.type === 'catch_clause');
            if (catchClauses.length > 0) {
                metadata.catchClauses = catchClauses.map(catchClause => {
                    const parameter = catchClause.childForFieldName('parameter');
                    return parameter?.text || 'unknown';
                });
            }
            metadata.fromNodeId = generateDeterministicNodeId(astNode);
        }

        // 提取switch控制流
        if (astNode.type === 'switch_statement' || astNode.type === 'switch_expression') {
            metadata.controlFlowType = 'conditional';
            const value = astNode.childForFieldName('value');
            if (value?.text) {
                metadata.switchValue = value.text;
                metadata.toNodeId = generateDeterministicNodeId(value);
            }
            metadata.fromNodeId = generateDeterministicNodeId(astNode);
        }

        // 提取回调控制流
        if (astNode.type === 'lambda_expression') {
            metadata.controlFlowType = 'callback';
            metadata.lambdaExpression = astNode.text;
            metadata.fromNodeId = generateDeterministicNodeId(astNode);

            // 尝试找到回调的目标方法
            const parent = astNode.parent;
            if (parent?.type === 'method_invocation') {
                const method = parent.childForFieldName('name');
                if (method?.text) {
                    metadata.callbackTarget = method.text;
                    metadata.toNodeId = generateDeterministicNodeId(method);
                }
            }
        }

        // 提取方法调用控制流
        if (astNode.type === 'method_invocation') {
            const method = astNode.childForFieldName('name');
            if (method?.text) {
                // 检查是否是控制流相关的方法调用
                const controlFlowMethods = ['if', 'switch', 'for', 'while', 'do', 'break', 'continue', 'return', 'throw'];
                if (controlFlowMethods.some(cf => method.text.toLowerCase().includes(cf))) {
                    metadata.controlFlowType = 'method-control-flow';
                    metadata.controlMethod = method.text;
                    metadata.fromNodeId = generateDeterministicNodeId(astNode);
                    metadata.toNodeId = generateDeterministicNodeId(method);
                }
            }
        }
    }

    /**
     * 提取控制流关系数组
     */
    extractControlFlowRelationships(result: any): Array<{
        source: string;
        target: string;
        type: 'conditional' | 'loop' | 'exception' | 'callback';
    }> {
        const relationships: Array<{
            source: string;
            target: string;
            type: 'conditional' | 'loop' | 'exception' | 'callback';
        }> = [];

        const mainNode = result.captures?.[0]?.node;
        if (!mainNode) {
            return relationships;
        }

        // 提取条件控制流
        if (mainNode.type === 'if_statement') {
            const condition = mainNode.childForFieldName('condition');
            if (condition?.text) {
                relationships.push({
                    source: condition.text,
                    target: 'if-block',
                    type: 'conditional'
                });
            }
        }

        // 提取循环控制流
        if (mainNode.type === 'for_statement' || mainNode.type === 'while_statement' ||
            mainNode.type === 'enhanced_for_statement' || mainNode.type === 'do_statement') {
            const condition = mainNode.childForFieldName('condition');
            if (condition?.text) {
                relationships.push({
                    source: condition.text,
                    target: 'loop-body',
                    type: 'loop'
                });
            }
        }

        // 提取异常控制流
        if (mainNode.type === 'try_statement') {
            relationships.push({
                source: 'try-block',
                target: 'catch-block',
                type: 'exception'
            });
        }

        // 提取switch控制流
        if (mainNode.type === 'switch_statement' || mainNode.type === 'switch_expression') {
            const value = mainNode.childForFieldName('value');
            if (value?.text) {
                relationships.push({
                    source: value.text,
                    target: 'switch-cases',
                    type: 'conditional'
                });
            }
        }

        // 提取回调控制流
        if (mainNode.type === 'lambda_expression') {
            relationships.push({
                source: 'lambda-context',
                target: 'lambda-body',
                type: 'callback'
            });
        }

        // 提取方法调用控制流
        if (mainNode.type === 'method_invocation') {
            const method = mainNode.childForFieldName('name');
            if (method?.text) {
                // 检查是否是控制流相关的方法调用
                const controlFlowMethods = ['if', 'switch', 'for', 'while', 'do', 'break', 'continue', 'return', 'throw'];
                if (controlFlowMethods.some(cf => method.text.toLowerCase().includes(cf))) {
                    relationships.push({
                        source: 'caller',
                        target: method.text,
                        type: 'conditional'
                    });
                }
            }
        }

        return relationships;
    }
}