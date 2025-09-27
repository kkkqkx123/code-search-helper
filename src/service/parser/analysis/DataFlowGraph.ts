import { injectable } from 'inversify';
import Parser from 'tree-sitter';
import { SymbolTable, Symbol } from './SymbolTableBuilder';
import { ControlFlowGraph, CFGNode } from './CFGBuilder';

export interface DataFlowEdge {
  from: string;
  to: string;
  variable: string;
  type: DataFlowType;
  sourceNode: CFGNode;
  targetNode: CFGNode;
  isTainted: boolean;
  taintSources: string[];
}

export enum DataFlowType {
  DEFINITION = 'definition',
  USE = 'use',
  ASSIGNMENT = 'assignment',
  PARAMETER = 'parameter',
  RETURN = 'return',
  CALL = 'call',
  GLOBAL = 'global',
}

export interface TaintSource {
  name: string;
  type: TaintType;
  sources: string[];
  sinks: string[];
  sanitizers: string[];
}

export enum TaintType {
  USER_INPUT = 'user_input',
  FILE_INPUT = 'file_input',
  NETWORK_INPUT = 'network_input',
  DATABASE_INPUT = 'database_input',
  ENVIRONMENT_INPUT = 'environment_input',
  EXTERNAL_API = 'external_api',
}

export interface DataFlowGraph {
  variables: Map<string, Symbol>;
  flows: DataFlowEdge[];
  sources: Map<string, CFGNode[]>;
  sinks: Map<string, CFGNode[]>;
  taintSources: TaintSource[];
  getVariableFlows(variable: string): DataFlowEdge[];
  getTaintedFlows(): DataFlowEdge[];
  isVariableTainted(variable: string): boolean;
  getVariableDefinitions(variable: string): CFGNode[];
  getVariableUses(variable: string): CFGNode[];
}

export class DataFlowGraphImpl implements DataFlowGraph {
  variables: Map<string, Symbol> = new Map();
  flows: DataFlowEdge[] = [];
  sources: Map<string, CFGNode[]> = new Map();
  sinks: Map<string, CFGNode[]> = new Map();
  taintSources: TaintSource[] = [];

  private variableDefinitions: Map<string, CFGNode[]> = new Map();
  private variableUses: Map<string, CFGNode[]> = new Map();
  private taintMap: Map<string, boolean> = new Map();

  getVariableFlows(variable: string): DataFlowEdge[] {
    return this.flows.filter(flow => flow.variable === variable);
  }

  getTaintedFlows(): DataFlowEdge[] {
    return this.flows.filter(flow => flow.isTainted);
  }

  isVariableTainted(variable: string): boolean {
    return this.taintMap.get(variable) || false;
  }

  getVariableDefinitions(variable: string): CFGNode[] {
    return this.variableDefinitions.get(variable) || [];
  }

  getVariableUses(variable: string): CFGNode[] {
    return this.variableUses.get(variable) || [];
  }

  addVariable(symbol: Symbol): void {
    this.variables.set(symbol.name, symbol);
    this.taintMap.set(symbol.name, false);
  }

  addFlow(flow: DataFlowEdge): void {
    this.flows.push(flow);

    if (flow.type === DataFlowType.DEFINITION) {
      if (!this.variableDefinitions.has(flow.variable)) {
        this.variableDefinitions.set(flow.variable, []);
      }
      this.variableDefinitions.get(flow.variable)!.push(flow.sourceNode);
    } else if (flow.type === DataFlowType.USE) {
      if (!this.variableUses.has(flow.variable)) {
        this.variableUses.set(flow.variable, []);
      }
      this.variableUses.get(flow.variable)!.push(flow.targetNode);
    }
  }

  addTaintSource(source: TaintSource): void {
    this.taintSources.push(source);
  }

  setTainted(variable: string, isTainted: boolean): void {
    this.taintMap.set(variable, isTainted);
  }
}

@injectable()
export class DataFlowAnalyzer {
  private symbolTable!: SymbolTable;
  private cfg!: ControlFlowGraph;
  private dataFlowGraph!: DataFlowGraphImpl;
  private taintPatterns: TaintPattern[];

  constructor() {
    this.taintPatterns = this.initializeTaintPatterns();
  }

  analyze(cfg: ControlFlowGraph, symbols: SymbolTable): DataFlowGraph {
    this.symbolTable = symbols;
    this.cfg = cfg;
    this.dataFlowGraph = new DataFlowGraphImpl();

    this.buildVariableMap();
    this.buildDataFlowGraph();
    this.performTaintAnalysis();
    this.detectSecurityPatterns();

    return this.dataFlowGraph;
  }

  private buildVariableMap(): void {
    const symbols = this.symbolTable.getAllSymbols();
    for (const symbol of symbols) {
      this.dataFlowGraph.addVariable(symbol);
    }
  }

  private buildDataFlowGraph(): void {
    const nodes = this.cfg.nodes;

    for (const node of nodes) {
      const variables = this.extractVariablesFromNode(node);

      for (const variable of variables.definitions) {
        this.addDefinitionFlow(variable, node);
      }

      for (const variable of variables.uses) {
        this.addUseFlow(variable, node);
      }
    }

    this.connectDefinitionsToUses();
  }

  private extractVariablesFromNode(node: CFGNode): { definitions: string[]; uses: string[] } {
    const definitions: string[] = [];
    const uses: string[] = [];

    for (const statement of node.statements) {
      const vars = this.extractVariablesFromStatement(statement);
      definitions.push(...vars.definitions);
      uses.push(...vars.uses);
    }

    return { definitions, uses };
  }

  private extractVariablesFromStatement(node: Parser.SyntaxNode): {
    definitions: string[];
    uses: string[];
  } {
    const definitions: string[] = [];
    const uses: string[] = [];

    switch (node.type) {
      case 'variable_declaration':
      case 'lexical_declaration':
      case 'const_declaration':
        definitions.push(...this.extractVariableNames(node));
        break;
      case 'assignment_expression':
        definitions.push(...this.extractAssignmentTargets(node));
        uses.push(...this.extractAssignmentSources(node));
        break;
      case 'function_call':
        uses.push(...this.extractFunctionArguments(node));
        break;
      case 'return_statement':
        uses.push(...this.extractReturnValues(node));
        break;
      case 'if_statement':
      case 'while_statement':
      case 'for_statement':
        uses.push(...this.extractConditionVariables(node));
        break;
    }

    return { definitions, uses };
  }

  private extractVariableNames(node: Parser.SyntaxNode): string[] {
    const names: string[] = [];
    const identifiers = node.children.filter(child => child.type === 'identifier');

    for (const identifier of identifiers) {
      names.push(identifier.text);
    }

    return names;
  }

  private extractAssignmentTargets(node: Parser.SyntaxNode): string[] {
    const targets: string[] = [];
    const leftSide = node.children[0];
    if (leftSide && leftSide.type === 'identifier') {
      targets.push(leftSide.text);
    }
    return targets;
  }

  private extractAssignmentSources(node: Parser.SyntaxNode): string[] {
    const sources: string[] = [];
    const rightSide = node.children[2];
    if (rightSide) {
      const identifiers = this.findAllIdentifiers(rightSide);
      sources.push(...identifiers);
    }
    return sources;
  }

  private extractFunctionArguments(node: Parser.SyntaxNode): string[] {
    const args: string[] = [];
    const argList = node.children.find(child => child.type === 'arguments');
    if (argList) {
      const identifiers = this.findAllIdentifiers(argList);
      args.push(...identifiers);
    }
    return args;
  }

  private extractReturnValues(node: Parser.SyntaxNode): string[] {
    const values: string[] = [];
    const returnExpr = node.children.find(child => child.type === 'expression');
    if (returnExpr) {
      const identifiers = this.findAllIdentifiers(returnExpr);
      values.push(...identifiers);
    }
    return values;
  }

  private extractConditionVariables(node: Parser.SyntaxNode): string[] {
    const condition = node.children.find(child => child.type === 'parenthesized_expression');
    if (condition) {
      const identifiers = this.findAllIdentifiers(condition);
      return identifiers;
    }
    return [];
  }

  private findAllIdentifiers(node: Parser.SyntaxNode): string[] {
    const identifiers: string[] = [];

    if (node.type === 'identifier') {
      identifiers.push(node.text);
    }

    for (const child of node.children) {
      identifiers.push(...this.findAllIdentifiers(child));
    }

    return identifiers;
  }

  private addDefinitionFlow(variable: string, node: CFGNode): void {
    const flow: DataFlowEdge = {
      from: node.id,
      to: node.id,
      variable,
      type: DataFlowType.DEFINITION,
      sourceNode: node,
      targetNode: node,
      isTainted: false,
      taintSources: [],
    };
    this.dataFlowGraph.addFlow(flow);
  }

  private addUseFlow(variable: string, node: CFGNode): void {
    const definitions = this.dataFlowGraph.getVariableDefinitions(variable);

    for (const def of definitions) {
      if (this.cfg.isReachable(def.id, node.id)) {
        const flow: DataFlowEdge = {
          from: def.id,
          to: node.id,
          variable,
          type: DataFlowType.USE,
          sourceNode: def,
          targetNode: node,
          isTainted: false,
          taintSources: [],
        };
        this.dataFlowGraph.addFlow(flow);
      }
    }
  }

  private connectDefinitionsToUses(): void {
    const variables = Array.from(this.dataFlowGraph.variables.keys());

    for (const variable of variables) {
      const definitions = this.dataFlowGraph.getVariableDefinitions(variable);
      const uses = this.dataFlowGraph.getVariableUses(variable);

      for (const def of definitions) {
        for (const use of uses) {
          if (this.cfg.isReachable(def.id, use.id)) {
            const flow: DataFlowEdge = {
              from: def.id,
              to: use.id,
              variable,
              type: DataFlowType.ASSIGNMENT,
              sourceNode: def,
              targetNode: use,
              isTainted: false,
              taintSources: [],
            };
            this.dataFlowGraph.addFlow(flow);
          }
        }
      }
    }
  }

  private performTaintAnalysis(): void {
    const variables = Array.from(this.dataFlowGraph.variables.keys());

    for (const variable of variables) {
      const flows = this.dataFlowGraph.getVariableFlows(variable);

      for (const flow of flows) {
        if (this.isTaintSource(flow)) {
          flow.isTainted = true;
          flow.taintSources.push(variable);
          this.dataFlowGraph.setTainted(variable, true);
        }
      }
    }
  }

  private isTaintSource(flow: DataFlowEdge): boolean {
    for (const statement of flow.sourceNode.statements) {
      if (this.isTaintedStatement(statement)) {
        return true;
      }
    }
    return false;
  }

  private isTaintedStatement(node: Parser.SyntaxNode): boolean {
    const taintPatterns = [
      'prompt',
      'readline',
      'input',
      'scanf',
      'gets',
      'document.getElementById',
      'document.querySelector',
      'window.location',
      'location.href',
      'location.search',
      'req.body',
      'req.params',
      'req.query',
      'process.argv',
      'process.env',
    ];

    const text = node.text.toLowerCase();
    return taintPatterns.some(pattern => text.includes(pattern.toLowerCase()));
  }

  private detectSecurityPatterns(): void {
    this.detectSQLInjection();
    this.detectXSS();
    this.detectCommandInjection();
    this.detectPathTraversal();
  }

  private detectSQLInjection(): void {
    const taintedFlows = this.dataFlowGraph.getTaintedFlows();

    for (const flow of taintedFlows) {
      if (this.isSQLSink(flow)) {
        console.warn(`Potential SQL injection: variable ${flow.variable} flows to SQL sink`);
      }
    }
  }

  private detectXSS(): void {
    const taintedFlows = this.dataFlowGraph.getTaintedFlows();

    for (const flow of taintedFlows) {
      if (this.isXSSSink(flow)) {
        console.warn(`Potential XSS: variable ${flow.variable} flows to XSS sink`);
      }
    }
  }

  private detectCommandInjection(): void {
    const taintedFlows = this.dataFlowGraph.getTaintedFlows();

    for (const flow of taintedFlows) {
      if (this.isCommandSink(flow)) {
        console.warn(
          `Potential command injection: variable ${flow.variable} flows to command sink`
        );
      }
    }
  }

  private detectPathTraversal(): void {
    const taintedFlows = this.dataFlowGraph.getTaintedFlows();

    for (const flow of taintedFlows) {
      if (this.isPathTraversalSink(flow)) {
        console.warn(`Potential path traversal: variable ${flow.variable} flows to file operation`);
      }
    }
  }

  private isSQLSink(flow: DataFlowEdge): boolean {
    const sqlPatterns = ['query', 'execute', 'exec', 'prepare', 'Statement'];
    const text = flow.targetNode.statements
      .map(s => s.text)
      .join(' ')
      .toLowerCase();
    return sqlPatterns.some(pattern => text.includes(pattern.toLowerCase()));
  }

  private isXSSSink(flow: DataFlowEdge): boolean {
    const xssPatterns = ['innerHTML', 'outerHTML', 'document.write', 'eval'];
    const text = flow.targetNode.statements
      .map(s => s.text)
      .join(' ')
      .toLowerCase();
    return xssPatterns.some(pattern => text.includes(pattern.toLowerCase()));
  }

  private isCommandSink(flow: DataFlowEdge): boolean {
    const commandPatterns = ['exec', 'spawn', 'system', 'shell', 'cmd'];
    const text = flow.targetNode.statements
      .map(s => s.text)
      .join(' ')
      .toLowerCase();
    return commandPatterns.some(pattern => text.includes(pattern.toLowerCase()));
  }

  private isPathTraversalSink(flow: DataFlowEdge): boolean {
    const pathPatterns = ['readFile', 'writeFile', 'open', 'fs.', 'path.'];
    const text = flow.targetNode.statements
      .map(s => s.text)
      .join(' ')
      .toLowerCase();
    return pathPatterns.some(pattern => text.includes(pattern.toLowerCase()));
  }

  private initializeTaintPatterns(): TaintPattern[] {
    return [
      {
        name: 'user_input',
        sources: ['prompt', 'readline', 'input', 'document.getElementById'],
        sinks: ['query', 'innerHTML', 'exec'],
        sanitizers: ['escape', 'sanitize', 'validate'],
      },
      {
        name: 'file_input',
        sources: ['fs.readFile', 'readFileSync', 'require'],
        sinks: ['eval', 'Function', 'exec'],
        sanitizers: ['JSON.parse', 'sanitize'],
      },
    ];
  }
}

interface TaintPattern {
  name: string;
  sources: string[];
  sinks: string[];
  sanitizers: string[];
}
