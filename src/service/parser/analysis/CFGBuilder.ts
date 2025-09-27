import { injectable } from 'inversify';
import Parser from 'tree-sitter';

export enum CFGNodeType {
  ENTRY = 'entry',
  EXIT = 'exit',
  STATEMENT = 'statement',
  CONDITION = 'condition',
  LOOP = 'loop',
  BRANCH = 'branch',
  FUNCTION_CALL = 'function_call',
  RETURN = 'return',
  TRY = 'try',
  CATCH = 'catch',
  FINALLY = 'finally',
  BREAK = 'break',
  CONTINUE = 'continue',
}

export enum CFGEdgeType {
  NORMAL = 'normal',
  CONDITION_TRUE = 'condition_true',
  CONDITION_FALSE = 'condition_false',
  LOOP_BODY = 'loop_body',
  LOOP_EXIT = 'loop_exit',
  EXCEPTION = 'exception',
  RETURN = 'return',
  BREAK = 'break',
  CONTINUE = 'continue',
}

export interface CFGNode {
  id: string;
  type: CFGNodeType;
  statements: Parser.SyntaxNode[];
  startLine: number;
  endLine: number;
  scope: string;
  isEntry: boolean;
  isExit: boolean;
  conditions?: string[];
}

export interface CFGEdge {
  from: string;
  to: string;
  type: CFGEdgeType;
  condition?: string;
  probability?: number;
}

export interface ControlFlowGraph {
  nodes: CFGNode[];
  edges: CFGEdge[];
  entryPoint: string;
  exitPoints: string[];
  functions: Map<string, ControlFlowGraph>;
  getNode(id: string): CFGNode | undefined;
  getSuccessors(nodeId: string): CFGNode[];
  getPredecessors(nodeId: string): CFGNode[];
  getDominators(nodeId: string): CFGNode[];
  isReachable(from: string, to: string): boolean;
}

export class ControlFlowGraphImpl implements ControlFlowGraph {
  public nodes: CFGNode[] = [];
  public edges: CFGEdge[] = [];
  public entryPoint: string = 'entry';
  public exitPoints: string[] = ['exit'];
  public functions: Map<string, ControlFlowGraph> = new Map();

  getNode(id: string): CFGNode | undefined {
    return this.nodes.find(node => node.id === id);
  }

  getSuccessors(nodeId: string): CFGNode[] {
    const successors = this.edges
      .filter(edge => edge.from === nodeId)
      .map(edge => this.getNode(edge.to))
      .filter((node): node is CFGNode => node !== undefined);
    return successors;
  }

  getPredecessors(nodeId: string): CFGNode[] {
    const predecessors = this.edges
      .filter(edge => edge.to === nodeId)
      .map(edge => this.getNode(edge.from))
      .filter((node): node is CFGNode => node !== undefined);
    return predecessors;
  }

  getDominators(nodeId: string): CFGNode[] {
    // 简化的支配节点计算
    const dominators: CFGNode[] = [];
    const node = this.getNode(nodeId);
    if (!node) return dominators;

    // 找到所有能到达该节点的路径
    const visited = new Set<string>();
    const findPaths = (current: string, path: CFGNode[]): CFGNode[][] => {
      if (current === nodeId) {
        const currentNode = this.getNode(current);
        return currentNode ? [[...path, currentNode]] : [path];
      }

      if (visited.has(current)) return [];
      visited.add(current);

      const paths: CFGNode[][] = [];
      const currentNode = this.getNode(current);
      if (currentNode) {
        const newPath = [...path, currentNode];
        const successors = this.getSuccessors(current);
        for (const successor of successors) {
          paths.push(...findPaths(successor.id, newPath));
        }
      }

      return paths;
    };

    const paths = findPaths(this.entryPoint, []);
    if (paths.length > 0) {
      // 所有路径共有的节点都是支配节点
      const firstPath = paths[0];
      for (const node of firstPath) {
        if (paths.every(path => path.some(p => p.id === node.id))) {
          dominators.push(node);
        }
      }
    }

    return dominators;
  }

  isReachable(from: string, to: string): boolean {
    const visited = new Set<string>();
    const dfs = (current: string): boolean => {
      if (current === to) return true;
      if (visited.has(current)) return false;

      visited.add(current);
      const successors = this.getSuccessors(current);

      for (const successor of successors) {
        if (dfs(successor.id)) return true;
      }

      return false;
    };

    return dfs(from);
  }

  addNode(node: CFGNode): void {
    this.nodes.push(node);
  }

  addEdge(edge: CFGEdge): void {
    this.edges.push(edge);
  }

  addFunction(name: string, cfg: ControlFlowGraph): void {
    this.functions.set(name, cfg);
  }
}

@injectable()
export class CFGBuilder {
  private cfg!: ControlFlowGraphImpl;
  private nodeCounter: number = 0;

  build(ast: Parser.SyntaxNode, filePath: string): ControlFlowGraph {
    this.cfg = new ControlFlowGraphImpl();
    this.nodeCounter = 0;

    const entryNode = this.createNode('entry', CFGNodeType.ENTRY, 'entry', 0, 0, 'global');
    entryNode.isEntry = true;
    this.cfg.addNode(entryNode);

    this.processNode(ast, 'global');

    const exitNode = this.createNode('exit', CFGNodeType.EXIT, 'exit', 0, 0, 'global');
    exitNode.isExit = true;
    this.cfg.addNode(exitNode);

    return this.cfg;
  }

  private processNode(node: Parser.SyntaxNode, scope: string): void {
    switch (node.type) {
      case 'program':
      case 'source_file':
        this.processProgram(node, scope);
        break;
      case 'function_declaration':
      case 'function_definition':
      case 'method_declaration':
        this.processFunction(node, scope);
        break;
      case 'if_statement':
        this.processIfStatement(node, scope);
        break;
      case 'while_statement':
        this.processWhileStatement(node, scope);
        break;
      case 'for_statement':
      case 'for_in_statement':
        this.processForStatement(node, scope);
        break;
      case 'switch_statement':
        this.processSwitchStatement(node, scope);
        break;
      case 'try_statement':
        this.processTryStatement(node, scope);
        break;
      case 'return_statement':
        this.processReturnStatement(node, scope);
        break;
      case 'break_statement':
        this.processBreakStatement(node, scope);
        break;
      case 'case_statement':
      case 'default_statement':
      case 'statement_block':
      case 'expression_statement':
      case 'declaration':
        this.processStatementBlock(node, scope);
        break;
      default:
        if (node.children && node.children.length > 0) {
          for (const child of node.children) {
            this.processNode(child, scope);
          }
        }
    }
  }

  private processProgram(node: Parser.SyntaxNode, scope: string): void {
    for (const child of node.children) {
      this.processNode(child, scope);
    }
  }

  private processFunction(node: Parser.SyntaxNode, scope: string): void {
    const functionName = this.extractFunctionName(node);
    const funcScope = functionName || `anonymous_${this.nodeCounter++}`;

    const funcNode = this.createNode(
      `func_${funcScope}`,
      CFGNodeType.FUNCTION_CALL,
      functionName || 'anonymous',
      node.startPosition.row,
      node.endPosition.row,
      scope
    );

    this.cfg.addNode(funcNode);

    // 处理函数体
    const body =
      node.childForFieldName('body') ||
      node.children.find(child => child.type === 'statement_block');

    if (body) {
      this.processNode(body, funcScope);
    }
  }

  private processIfStatement(node: Parser.SyntaxNode, scope: string): void {
    const condition = node.childForFieldName('condition');
    const consequence = node.childForFieldName('consequence');
    const alternative = node.childForFieldName('alternative');

    const ifNode = this.createNode(
      `if_${this.nodeCounter++}`,
      CFGNodeType.CONDITION,
      condition?.text || 'if',
      node.startPosition.row,
      node.endPosition.row,
      scope
    );

    if (condition) {
      ifNode.conditions = [condition.text];
    }

    this.cfg.addNode(ifNode);

    if (consequence) {
      this.processNode(consequence, scope);
    }

    if (alternative) {
      this.processNode(alternative, scope);
    }
  }

  private processWhileStatement(node: Parser.SyntaxNode, scope: string): void {
    const condition = node.childForFieldName('condition');
    const body = node.childForFieldName('body');

    const whileNode = this.createNode(
      `while_${this.nodeCounter++}`,
      CFGNodeType.LOOP,
      condition?.text || 'while',
      node.startPosition.row,
      node.endPosition.row,
      scope
    );

    if (condition) {
      whileNode.conditions = [condition.text];
    }

    this.cfg.addNode(whileNode);

    if (body) {
      this.processNode(body, scope);
    }
  }

  private processForStatement(node: Parser.SyntaxNode, scope: string): void {
    const body = node.childForFieldName('body');

    const forNode = this.createNode(
      `for_${this.nodeCounter++}`,
      CFGNodeType.LOOP,
      'for',
      node.startPosition.row,
      node.endPosition.row,
      scope
    );

    this.cfg.addNode(forNode);

    if (body) {
      this.processNode(body, scope);
    }
  }

  private processSwitchStatement(node: Parser.SyntaxNode, scope: string): void {
    const condition = node.childForFieldName('condition');
    const cases = node.children.filter(
      child => child.type === 'switch_case' || child.type === 'switch_default'
    );

    const switchNode = this.createNode(
      `switch_${this.nodeCounter++}`,
      CFGNodeType.BRANCH,
      condition?.text || 'switch',
      node.startPosition.row,
      node.endPosition.row,
      scope
    );

    this.cfg.addNode(switchNode);

    for (const caseNode of cases) {
      this.processNode(caseNode, scope);
    }
  }

  private processTryStatement(node: Parser.SyntaxNode, scope: string): void {
    const body = node.childForFieldName('body');
    const handlers = node.children.filter(child => child.type === 'catch_clause');
    const finalizer = node.childForFieldName('finalizer');

    const tryNode = this.createNode(
      `try_${this.nodeCounter++}`,
      CFGNodeType.TRY,
      'try',
      node.startPosition.row,
      node.endPosition.row,
      scope
    );

    this.cfg.addNode(tryNode);

    if (body) {
      this.processNode(body, scope);
    }

    for (const handler of handlers) {
      this.processNode(handler, scope);
    }

    if (finalizer) {
      this.processNode(finalizer, scope);
    }
  }

  private processReturnStatement(node: Parser.SyntaxNode, scope: string): void {
    const returnNode = this.createNode(
      `return_${this.nodeCounter++}`,
      CFGNodeType.RETURN,
      node.text || 'return',
      node.startPosition.row,
      node.endPosition.row,
      scope
    );

    this.cfg.addNode(returnNode);
  }

  private processBreakStatement(node: Parser.SyntaxNode, scope: string): void {
    const breakNode = this.createNode(
      `break_${this.nodeCounter++}`,
      CFGNodeType.BREAK,
      'break',
      node.startPosition.row,
      node.endPosition.row,
      scope
    );

    this.cfg.addNode(breakNode);
  }

  private processContinueStatement(node: Parser.SyntaxNode, scope: string): void {
    const continueNode = this.createNode(
      `continue_${this.nodeCounter++}`,
      CFGNodeType.CONTINUE,
      'continue',
      node.startPosition.row,
      node.endPosition.row,
      scope
    );

    this.cfg.addNode(continueNode);
  }

  private processStatementBlock(node: Parser.SyntaxNode, scope: string): void {
    for (const child of node.children) {
      this.processNode(child, scope);
    }
  }

  private createNode(
    id: string,
    type: CFGNodeType,
    label: string,
    startLine: number,
    endLine: number,
    scope: string
  ): CFGNode {
    return {
      id,
      type,
      statements: [],
      startLine,
      endLine,
      scope,
      isEntry: false,
      isExit: false,
      conditions: [],
    };
  }

  private extractFunctionName(node: Parser.SyntaxNode): string | null {
    const nameNode =
      node.childForFieldName('name') || node.children.find(child => child.type === 'identifier');
    return nameNode ? nameNode.text : null;
  }
}
