import { inject, injectable } from 'inversify';
import { ParserService } from '../core/parse/ParserService';
import { LoggerService } from '../../../core/LoggerService';
import { TYPES } from '../../../types';
import fs from 'fs/promises';

export interface FunctionNode {
  id: string;
  name: string;
  file: string;
  startLine: number;
  endLine: number;
  parameters: Parameter[];
  returnType: string;
  complexity: number;
  isPure: boolean;
  isExported: boolean;
  isAsync: boolean;
}

export interface Parameter {
  name: string;
  type: string;
  optional: boolean;
}

export interface CallEdge {
  from: string;
  to: string;
  type: 'direct' | 'indirect' | 'callback' | 'async';
  line: number;
  column: number;
  context: string;
}

export interface CallGraph {
  nodes: FunctionNode[];
  edges: CallEdge[];
  entryPoints: string[];
  cycles: string[][];
  depth: number;
}

export interface AnalysisOptions {
  includeExternalCalls: boolean;
  includeCallbacks: boolean;
  includeAsync: boolean;
  maxDepth: number;
  ignorePatterns: string[];
}

export interface FunctionAnalysis {
  node: FunctionNode;
  callers: string[];
  callees: string[];
  complexity: number;
  riskLevel: 'low' | 'medium' | 'high';
  testCoverage: number;
}

@injectable()
export class CallGraphService {
  private callGraphs: Map<string, CallGraph> = new Map();

  constructor(
    @inject(ParserService) private parserService: ParserService,
    @inject(LoggerService) private logger: LoggerService
  ) { }

  async buildCallGraph(
    projectPath: string,
    options: AnalysisOptions = {
      includeExternalCalls: false,
      includeCallbacks: true,
      includeAsync: true,
      maxDepth: 10,
      ignorePatterns: ['node_modules', '.test.', '.spec.'],
    }
  ): Promise<CallGraph> {
    try {
      this.logger.info(`Building call graph for ${projectPath}`);

      // 获取项目中的所有文件
      const files = await this.getProjectFiles(projectPath, options.ignorePatterns);

      // 使用ParserService的批量处理功能
      const parseResults = await this.parserService.parseFiles(files, {
        focus: 'functions',
        includeAST: true,
      });

      // 解析每个文件的函数定义和调用关系
      const nodes: FunctionNode[] = [];
      const edges: CallEdge[] = [];

      // 提取所有函数
      for (const result of parseResults) {
        const fileFunctions = await this.extractFunctionsFromFile(result.filePath);
        nodes.push(...fileFunctions);
      }

      // 提取所有函数调用
      for (const file of files) {
        const fileEdges = await this.extractCallsFromFile(file, nodes);
        edges.push(...fileEdges);
      }

      // 构建调用图
      const callGraph: CallGraph = {
        nodes,
        edges,
        entryPoints: this.findEntryPoints(nodes),
        cycles: this.detectCycles(nodes, edges),
        depth: this.calculateDepth(nodes, edges),
      };

      this.callGraphs.set(projectPath, callGraph);
      return callGraph;
    } catch (error) {
      this.logger.error(`Failed to build call graph: ${error}`);
      throw error;
    }
  }

  async analyzeFunction(
    projectPath: string,
    functionName: string,
    filePath?: string
  ): Promise<FunctionAnalysis | null> {
    const callGraph = this.callGraphs.get(projectPath);
    if (!callGraph) {
      await this.buildCallGraph(projectPath);
    }

    const graph = this.callGraphs.get(projectPath);
    if (!graph) return null;

    const node = graph.nodes.find(
      n => n.name === functionName && (!filePath || n.file === filePath)
    );

    if (!node) return null;

    const callers = this.findCallers(graph, node.id);
    const callees = this.findCallees(graph, node.id);
    const riskLevel = this.calculateRiskLevel(node, callers.length, callees.length);

    return {
      node,
      callers,
      callees,
      complexity: node.complexity,
      riskLevel,
      testCoverage: await this.estimateTestCoverage(node),
    };
  }

  async getCallPaths(
    projectPath: string,
    fromFunction: string,
    toFunction: string,
    maxPaths: number = 10
  ): Promise<string[][]> {
    const callGraph = this.callGraphs.get(projectPath);
    if (!callGraph) {
      await this.buildCallGraph(projectPath);
    }

    const graph = this.callGraphs.get(projectPath);
    if (!graph) return [];

    return this.findAllPaths(graph, fromFunction, toFunction, maxPaths);
  }

  async detectCircularDependencies(projectPath: string): Promise<string[][]> {
    const callGraph = this.callGraphs.get(projectPath);
    if (!callGraph) {
      await this.buildCallGraph(projectPath);
    }

    const graph = this.callGraphs.get(projectPath);
    return graph?.cycles || [];
  }

  async getDeadCode(projectPath: string): Promise<FunctionNode[]> {
    const callGraph = this.callGraphs.get(projectPath);
    if (!callGraph) {
      await this.buildCallGraph(projectPath);
    }

    const graph = this.callGraphs.get(projectPath);
    if (!graph) return [];

    return graph.nodes.filter(node => {
      const isCalled = graph.edges.some(edge => edge.to === node.id);
      const isEntryPoint = graph.entryPoints.includes(node.id);
      const isExported = node.isExported;

      return !isCalled && !isEntryPoint && !isExported;
    });
  }

  private async getProjectFiles(projectPath: string, ignorePatterns: string[]): Promise<string[]> {
    // 这里应该实现文件遍历逻辑
    // 简化实现，返回模拟数据
    return [
      `${projectPath}/src/main.ts`,
      `${projectPath}/src/utils.ts`,
      `${projectPath}/src/services/api.ts`,
    ];
  }

  private async extractFunctionsFromFile(filePath: string): Promise<FunctionNode[]> {
    try {
      // 使用ParserService解析文件
      const parseResult = await this.parserService.parseFile(filePath, {
        focus: 'functions',
        includeAST: true,
      });

      const functions: FunctionNode[] = [];

      // 从ParserService的结果中提取函数信息
      for (const func of parseResult.functions) {
        const node: FunctionNode = {
          id: `${filePath}:${func.name || 'anonymous'}`,
          name: func.name || 'anonymous',
          file: filePath,
          startLine: func.startLine || 0,
          endLine: func.endLine || 0,
          parameters: this.extractParametersFromAST(func),
          returnType: this.inferReturnTypeFromAST(func),
          complexity: this.calculateCyclomaticComplexityFromAST(func),
          isPure: this.isPureFunctionFromAST(func),
          isExported: this.isExportedFunctionFromAST(func),
          isAsync: this.isAsyncFunctionFromAST(func),
        };

        functions.push(node);
      }

      return functions;
    } catch (error) {
      this.logger.warn(`Failed to extract functions from ${filePath}: ${error}`);
      return [];
    }
  }

  private async extractCallsFromFile(
    filePath: string,
    functions: FunctionNode[]
  ): Promise<CallEdge[]> {
    const edges: CallEdge[] = [];
    const functionMap = new Map(functions.map(f => [f.name, f]));

    try {
      // 使用ParserService的AST查询功能
      const queryResult = await this.parserService.queryAST(filePath, '//call_expression');

      for (const node of queryResult) {
        // 提取调用信息
        const callInfo = this.extractCallInfoFromAST(node);
        if (callInfo) {
          const callerFunc = this.findEnclosingFunction(filePath, node.startLine || 0, functions);
          const calleeFunc = functionMap.get(callInfo.functionName);

          if (callerFunc && calleeFunc) {
            edges.push({
              from: callerFunc.id,
              to: calleeFunc.id,
              type: this.determineCallTypeFromAST(node),
              line: node.startLine || 0,
              column: node.startColumn || 0,
              context: callInfo.context,
            });
          }
        }
      }

      return edges;
    } catch (error) {
      this.logger.warn(`Failed to extract calls from ${filePath}: ${error}`);
      return [];
    }
  }

  private extractParametersFromAST(func: any): Parameter[] {
    if (!func.parameters) return [];

    try {
      // 从AST节点中提取参数信息
      return func.parameters.map((param: any) => ({
        name: param.name || 'unknown',
        type: param.type || 'unknown',
        optional: param.optional || false,
      }));
    } catch (error) {
      this.logger.warn(`Failed to extract parameters: ${error}`);
      return [];
    }
  }

  private extractCallInfoFromAST(node: any): { functionName: string; context: string } | null {
    try {
      // 从AST调用表达式中提取函数名和上下文
      const functionName = node.name || node.text || 'unknown';
      const context = this.getNodeContext(node);

      return { functionName, context };
    } catch (error) {
      this.logger.warn(`Failed to extract call info: ${error}`);
      return null;
    }
  }

  private getNodeContext(node: any): string {
    // 提取节点的上下文信息
    return node.text || '';
  }

  private inferReturnTypeFromAST(func: any): string {
    // 简化实现
    return func.returnType || 'unknown';
  }

  private calculateCyclomaticComplexityFromAST(func: any): number {
    // 简化实现
    return func.complexity || 1;
  }

  private isPureFunctionFromAST(func: any): boolean {
    // 简化实现
    return func.isPure || false;
  }

  private isExportedFunctionFromAST(func: any): boolean {
    // 简化实现
    return func.isExported || false;
  }

  private isAsyncFunctionFromAST(func: any): boolean {
    // 简化实现
    return func.isAsync || false;
  }

  private findEnclosingFunction(
    filePath: string,
    line: number,
    functions: FunctionNode[]
  ): FunctionNode | null {
    return (
      functions.find(f => f.file === filePath && line >= f.startLine && line <= f.endLine) || null
    );
  }

  private determineCallTypeFromAST(node: any): 'direct' | 'indirect' | 'callback' | 'async' {
    // 简化实现
    return 'direct';
  }

  private getCallContextFromAST(node: any): string {
    // 简化实现
    return node.text || '';
  }

  private findEntryPoints(nodes: FunctionNode[]): string[] {
    return nodes
      .filter(n => n.isExported || n.name === 'main' || n.name === 'start')
      .map(n => n.id);
  }

  private detectCycles(nodes: FunctionNode[], edges: CallEdge[]): string[][] {
    const graph = this.buildAdjacencyList(edges);
    const cycles: string[][] = [];

    for (const node of nodes) {
      const visited = new Set<string>();
      const path = new Set<string>();
      this.findCycles(node.id, node.id, graph, visited, path, cycles);
    }

    return cycles;
  }

  private buildAdjacencyList(edges: CallEdge[]): Map<string, string[]> {
    const adj = new Map<string, string[]>();

    for (const edge of edges) {
      if (!adj.has(edge.from)) {
        adj.set(edge.from, []);
      }
      adj.get(edge.from)!.push(edge.to);
    }

    return adj;
  }

  private findCycles(
    current: string,
    start: string,
    graph: Map<string, string[]>,
    visited: Set<string>,
    path: Set<string>,
    cycles: string[][]
  ): boolean {
    if (current === start && path.size > 0) {
      cycles.push(Array.from(path));
      return true;
    }

    if (path.has(current)) return false;

    path.add(current);
    visited.add(current);

    const neighbors = graph.get(current) || [];
    for (const neighbor of neighbors) {
      this.findCycles(neighbor, start, graph, visited, path, cycles);
    }

    path.delete(current);
    return false;
  }

  private calculateDepth(nodes: FunctionNode[], edges: CallEdge[]): number {
    const depths = new Map<string, number>();
    const visited = new Set<string>();

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        this.calculateNodeDepth(node.id, edges, depths, visited, 0);
      }
    }

    return Math.max(...depths.values());
  }

  private calculateNodeDepth(
    nodeId: string,
    edges: CallEdge[],
    depths: Map<string, number>,
    visited: Set<string>,
    currentDepth: number
  ): void {
    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    depths.set(nodeId, Math.max(depths.get(nodeId) || 0, currentDepth));

    const outgoingEdges = edges.filter(e => e.from === nodeId);
    for (const edge of outgoingEdges) {
      this.calculateNodeDepth(edge.to, edges, depths, visited, currentDepth + 1);
    }
  }

  private findCallers(graph: CallGraph, functionId: string): string[] {
    return graph.edges.filter(edge => edge.to === functionId).map(edge => edge.from);
  }

  private findCallees(graph: CallGraph, functionId: string): string[] {
    return graph.edges.filter(edge => edge.from === functionId).map(edge => edge.to);
  }

  private findAllPaths(graph: CallGraph, from: string, to: string, maxPaths: number): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    this.dfs(graph, from, to, [], visited, paths, maxPaths);
    return paths.slice(0, maxPaths);
  }

  private dfs(
    graph: CallGraph,
    current: string,
    target: string,
    path: string[],
    visited: Set<string>,
    paths: string[][],
    maxPaths: number
  ): void {
    if (paths.length >= maxPaths) return;

    path.push(current);
    visited.add(current);

    if (current === target) {
      paths.push([...path]);
    } else {
      const outgoingEdges = graph.edges.filter(e => e.from === current);
      for (const edge of outgoingEdges) {
        if (!visited.has(edge.to)) {
          this.dfs(graph, edge.to, target, path, visited, paths, maxPaths);
        }
      }
    }

    path.pop();
    visited.delete(current);
  }

  private calculateRiskLevel(
    node: FunctionNode,
    callerCount: number,
    calleeCount: number
  ): 'low' | 'medium' | 'high' {
    if (node.complexity > 10 || callerCount > 5 || calleeCount > 10) {
      return 'high';
    } else if (node.complexity > 5 || callerCount > 2 || calleeCount > 5) {
      return 'medium';
    }
    return 'low';
  }

  private async estimateTestCoverage(node: FunctionNode): Promise<number> {
    // 简化实现：基于函数名和文件路径估计测试覆盖率
    const testFilePath = node.file.replace('/src/', '/test/').replace('.ts', '.test.ts');

    try {
      // 这里应该检查测试文件是否存在并分析覆盖率
      return 0.7; // 模拟70%覆盖率
    } catch {
      return 0.0;
    }
  }

  async exportCallGraph(projectPath: string, format: 'json' | 'dot' | 'mermaid'): Promise<string> {
    const callGraph = this.callGraphs.get(projectPath);
    if (!callGraph) {
      await this.buildCallGraph(projectPath);
    }

    const graph = this.callGraphs.get(projectPath);
    if (!graph) return '';

    switch (format) {
      case 'json':
        return JSON.stringify(graph, null, 2);
      case 'dot':
        return this.generateDotGraph(graph);
      case 'mermaid':
        return this.generateMermaidGraph(graph);
      default:
        return JSON.stringify(graph, null, 2);
    }
  }

  private generateDotGraph(graph: CallGraph): string {
    let dot = 'digraph CallGraph {\n';

    for (const node of graph.nodes) {
      dot += `  "${node.id}" [label="${node.name}"];\n`;
    }

    for (const edge of graph.edges) {
      dot += `  "${edge.from}" -> "${edge.to}";\n`;
    }

    dot += '}';
    return dot;
  }

  private generateMermaidGraph(graph: CallGraph): string {
    let mermaid = 'graph TD\n';

    for (const node of graph.nodes) {
      mermaid += `  ${node.id}["${node.name}"]\n`;
    }

    for (const edge of graph.edges) {
      mermaid += `  ${edge.from} --> ${edge.to}\n`;
    }

    return mermaid;
  }
}
