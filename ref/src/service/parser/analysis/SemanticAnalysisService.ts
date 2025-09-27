import { inject, injectable } from 'inversify';
import { TreeSitterCoreService } from '../core/parse/TreeSitterCoreService';
import { SemgrepIntegrationService } from '../../static-analysis/core/SemgrepIntegrationService';
import { LoggerService } from '../../../core/LoggerService';
import { TYPES } from '../../../types';

export interface SemanticContext {
  controlFlow: CFGAnalysis;
  dataFlow: TaintAnalysis;
  crossFunction: CallGraphAnalysis;
}

export interface CFGAnalysis {
  complexity: number;
  nestingDepth: number;
  loopPatterns: LoopPattern[];
  unreachableCode: UnreachableCode[];
  missingBreaks: MissingBreak[];
}

export interface TaintAnalysis {
  taintSources: string[];
  sanitizationPoints: string[];
  dataDependencies: Dependency[];
  vulnerabilityPaths: VulnerabilityPath[];
}

export interface CallGraphAnalysis {
  functions: FunctionInfo[];
  callGraph: CallGraph;
  sideEffects: SideEffect[];
  pureFunctionScore: number;
}

export interface FunctionInfo {
  name: string;
  parameters: string[];
  returnType: string;
  complexity: number;
  sideEffects: SideEffect[];
}

export interface CallGraph {
  nodes: string[];
  edges: CallEdge[];
}

export interface CallEdge {
  from: string;
  to: string;
  callType: 'direct' | 'indirect' | 'callback';
}

export interface LoopPattern {
  type: 'for' | 'while' | 'do-while';
  complexity: number;
  hasBreak: boolean;
  hasContinue: boolean;
}

export interface UnreachableCode {
  location: string;
  reason: string;
  code: string;
}

export interface MissingBreak {
  switchCase: string;
  location: string;
}

export interface Dependency {
  from: string;
  to: string;
  type: 'data' | 'control';
}

export interface VulnerabilityPath {
  source: string;
  sink: string;
  path: string[];
  vulnerabilityType: string;
}

export interface SideEffect {
  type: 'mutation' | 'io' | 'network' | 'global';
  location: string;
  description: string;
}

@injectable()
export class SemanticAnalysisService {
  constructor(
    @inject(TYPES.TreeSitterCoreService) private treeSitterService: TreeSitterCoreService,
    @inject(TYPES.SemgrepIntegrationService) private semgrepService: SemgrepIntegrationService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) { }

  async analyzeSemanticContext(
    filePath: string,
    content: string,
    language: string
  ): Promise<SemanticContext> {
    try {
      this.logger.info(`Analyzing semantic context for ${filePath}`);

      // 获取AST
      const parseResult = await this.treeSitterService.parseCode(content, language);
      const ast = parseResult.ast;

      // 并行执行控制流、数据流和调用图分析
      const [controlFlow, dataFlow, crossFunction] = await Promise.all([
        this.analyzeControlFlow(filePath, content, language),
        this.analyzeDataFlow(filePath, content, language),
        this.analyzeCallGraph(filePath, content, language),
      ]);

      return {
        controlFlow,
        dataFlow,
        crossFunction,
      };
    } catch (error) {
      this.logger.error(`Failed to analyze semantic context: ${error}`);
      throw error;
    }
  }

  private async analyzeControlFlow(
    filePath: string,
    content: string,
    language: string
  ): Promise<CFGAnalysis> {
    // 使用现有的控制流分析规则
    const cfgRules = [
      'enhanced-rules/control-flow/enhanced-cfg-analysis.yml',
      'enhanced-rules/control-flow/complex-nested-conditions.yml',
    ];

    const results = await this.semgrepService.scanProject(filePath, { rules: cfgRules });

    // 解析semgrep结果并构建CFG分析
    return this.parseCFGResults(results, content);
  }

  private async analyzeDataFlow(
    filePath: string,
    content: string,
    language: string
  ): Promise<TaintAnalysis> {
    // 使用现有的数据流分析规则
    const dataFlowRules = [
      'enhanced-rules/data-flow/advanced-taint-analysis.yml',
      'enhanced-rules/data-flow/cross-function-taint.yml',
    ];

    const results = await this.semgrepService.scanProject(filePath, { rules: dataFlowRules });

    // 解析semgrep结果并构建数据流分析
    return this.parseDataFlowResults(results, content);
  }

  private async analyzeCallGraph(
    filePath: string,
    content: string,
    language: string
  ): Promise<CallGraphAnalysis> {
    // 使用tree-sitter提取函数信息
    const parseResult = await this.treeSitterService.parseCode(content, language);
    const ast = parseResult.ast;

    // 提取函数定义和调用关系
    const functions = this.extractFunctions(ast, content, language);
    const callGraph = this.buildCallGraph(ast, content, functions, language);
    const sideEffects = this.analyzeSideEffects(ast, content);

    return {
      functions,
      callGraph,
      sideEffects,
      pureFunctionScore: this.calculatePureFunctionScore(functions, sideEffects),
    };
  }

  private extractFunctions(ast: any, content: string, language: string): FunctionInfo[] {
    // 使用tree-sitter查询提取函数信息
    const functionNodes = this.treeSitterService.findNodeByType(
      ast,
      language === 'javascript' || language === 'typescript'
        ? 'function_declaration'
        : language === 'python'
          ? 'function_definition'
          : 'function_item'
    );

    return functionNodes.map((node: any) => ({
      name: this.extractFunctionName(node, content),
      parameters: this.extractParameters(node, content),
      returnType: this.extractReturnType(node, content),
      complexity: this.calculateComplexity(node, content),
      sideEffects: this.analyzeFunctionSideEffects(node, content),
    }));
  }

  private buildCallGraph(
    ast: any,
    content: string,
    functions: FunctionInfo[],
    language: string
  ): CallGraph {
    const nodes = functions.map(f => f.name);
    const edges: CallEdge[] = [];

    // 分析函数调用关系
    const callNodes = this.treeSitterService.findNodeByType(
      ast,
      language === 'javascript' || language === 'typescript'
        ? 'call_expression'
        : language === 'python'
          ? 'call'
          : 'call_expression'
    );

    // 构建调用图
    callNodes.forEach((call: any) => {
      const caller = this.findCallerContext(call, content);
      const callee = this.extractCalleeName(call, content);

      if (caller && callee && nodes.includes(callee)) {
        edges.push({
          from: caller,
          to: callee,
          callType: 'direct',
        });
      }
    });

    return { nodes, edges };
  }

  private analyzeSideEffects(ast: any, content: string): SideEffect[] {
    const sideEffects: SideEffect[] = [];

    // 分析全局变量修改
    const globalMutations = this.treeSitterService.findNodeByType(ast, 'assignment_expression');

    sideEffects.push(
      ...globalMutations.map((node: any) => ({
        type: 'mutation' as const,
        location: this.getLocation(node, content),
        description: 'Global variable modification',
      }))
    );

    // 分析I/O操作
    const ioOperations = this.treeSitterService.findNodeByType(ast, 'call_expression');

    sideEffects.push(
      ...ioOperations
        .filter((node: any) =>
          ['console.log', 'print', 'write', 'read'].some(op =>
            this.extractCalleeName(node, content).includes(op)
          )
        )
        .map((node: any) => ({
          type: 'io' as const,
          location: this.getLocation(node, content),
          description: 'I/O operation',
        }))
    );

    return sideEffects;
  }

  private parseCFGResults(results: any, content: string): CFGAnalysis {
    // 解析控制流分析结果
    // Since we're using SemgrepScanResult, we need to extract information from findings
    const findings = results.findings || [];

    return {
      complexity: 0, // Would need to extract from findings
      nestingDepth: 0, // Would need to extract from findings
      loopPatterns: [], // 从结果中提取循环模式
      unreachableCode: [], // 从结果中提取不可达代码
      missingBreaks: [], // 从结果中提取缺失的break
    };
  }

  private parseDataFlowResults(results: any, content: string): TaintAnalysis {
    // 解析数据流分析结果
    // Since we're using SemgrepScanResult, we need to extract information from findings
    const findings = results.findings || [];

    return {
      taintSources: [],
      sanitizationPoints: [],
      dataDependencies: [],
      vulnerabilityPaths: [],
    };
  }

  // 辅助方法
  private extractFunctionName(node: any, content: string): string {
    // 实现函数名提取逻辑
    return 'extracted_function';
  }

  private extractParameters(node: any, content: string): string[] {
    // 实现参数提取逻辑
    return [];
  }

  private extractReturnType(node: any, content: string): string {
    // 实现返回类型提取逻辑
    return 'unknown';
  }

  private calculateComplexity(node: any, content: string): number {
    // 实现复杂度计算逻辑
    return 1;
  }

  private analyzeFunctionSideEffects(node: any, content: string): SideEffect[] {
    return [];
  }

  private findCallerContext(node: any, content: string): string | null {
    return null;
  }

  private extractCalleeName(node: any, content: string): string {
    return 'callee';
  }

  private getLocation(node: any, content: string): string {
    return 'location';
  }

  private calculatePureFunctionScore(functions: FunctionInfo[], sideEffects: SideEffect[]): number {
    if (functions.length === 0) return 0;

    const pureFunctions = functions.filter(f => f.sideEffects.length === 0);
    return pureFunctions.length / functions.length;
  }
}
