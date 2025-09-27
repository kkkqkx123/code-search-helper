import { injectable } from 'inversify';
import Parser from 'tree-sitter';

export interface Symbol {
  name: string;
  type: SymbolType;
  scope: SymbolScope;
  definition: SymbolLocation;
  isMutable: boolean;
  dataType?: string;
  initialValue?: any;
  references: SymbolLocation[];
}

export interface SymbolLocation {
  filePath: string;
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  nodeType: string;
}

export enum SymbolType {
  VARIABLE = 'variable',
  FUNCTION = 'function',
  CLASS = 'class',
  METHOD = 'method',
  PARAMETER = 'parameter',
  CONSTANT = 'constant',
  IMPORT = 'import',
  EXPORT = 'export',
}

export enum SymbolScope {
  GLOBAL = 'global',
  FUNCTION = 'function',
  CLASS = 'class',
  BLOCK = 'block',
  MODULE = 'module',
}

export interface SymbolTable {
  symbols: Map<string, Symbol>;
  scopes: Map<string, SymbolScope>;
  functions: Map<string, Symbol>;
  classes: Map<string, Symbol>;
  getSymbol(name: string, scope?: string): Symbol | undefined;
  getSymbolsInScope(scope: string): Symbol[];
  getAllSymbols(): Symbol[];
}

export class SymbolTableImpl implements SymbolTable {
  symbols = new Map<string, Symbol>();
  scopes = new Map<string, SymbolScope>();
  functions = new Map<string, Symbol>();
  classes = new Map<string, Symbol>();

  getSymbol(name: string, scope?: string): Symbol | undefined {
    if (scope) {
      const scopedName = `${scope}.${name}`;
      return this.symbols.get(scopedName) || this.symbols.get(name);
    }
    return this.symbols.get(name);
  }

  getSymbolsInScope(scope: string): Symbol[] {
    return Array.from(this.symbols.values()).filter(
      symbol => symbol.scope === scope || symbol.scope === SymbolScope.GLOBAL
    );
  }

  getAllSymbols(): Symbol[] {
    return Array.from(this.symbols.values());
  }
}

@injectable()
export class SymbolTableBuilder {
  private filePath: string = '';
  private symbolTable: SymbolTableImpl = new SymbolTableImpl();
  private currentScope: SymbolScope = SymbolScope.GLOBAL;

  private handleVariableDeclaration(node: Parser.SyntaxNode): void {
    const declarators = node.children.filter(
      child => child.type === 'variable_declarator' || child.type === 'lexical_declaration'
    );

    declarators.forEach(declarator => {
      this.processVariableDeclarator(declarator);
    });
  }

  private addSymbol(symbol: Symbol): void {
    this.symbolTable.symbols.set(symbol.name, symbol);
  }
  private scopeStack: SymbolScope[] = [SymbolScope.GLOBAL];

  build(ast: Parser.SyntaxNode, filePath: string): SymbolTable {
    this.filePath = filePath;
    this.symbolTable = new SymbolTableImpl();
    this.currentScope = SymbolScope.GLOBAL;
    this.scopeStack = [SymbolScope.GLOBAL];

    this.traverseAST(ast);
    return this.symbolTable;
  }

  private traverseAST(node: Parser.SyntaxNode): void {
    switch (node.type) {
      case 'program':
      case 'module':
        this.handleProgram(node);
        break;
      case 'function_declaration':
      case 'function_definition':
      case 'arrow_function':
      case 'method_definition':
        this.handleFunction(node);
        break;
      case 'class_declaration':
      case 'class_definition':
        this.handleClass(node);
        break;
      case 'variable_declaration':
      case 'lexical_declaration':
        this.handleVariableDeclaration(node);
        break;
      case 'import_statement':
        this.handleImport(node);
        break;
      case 'export_statement':
        this.handleExport(node);
        break;
      case 'parameter':
      case 'formal_parameter':
        this.handleParameter(node);
        break;
    }

    for (const child of node.children) {
      this.traverseAST(child);
    }
  }

  private handleProgram(node: Parser.SyntaxNode): void {
    this.currentScope = SymbolScope.MODULE;
  }

  private handleFunction(node: Parser.SyntaxNode): void {
    const functionName = this.extractFunctionName(node);
    if (functionName) {
      const symbol: Symbol = {
        name: functionName,
        type: SymbolType.FUNCTION,
        scope: this.currentScope,
        definition: this.createLocation(node),
        isMutable: false,
        references: [],
      };

      this.symbolTable.functions.set(functionName, symbol);
      this.symbolTable.symbols.set(functionName, symbol);

      // Enter function scope
      this.scopeStack.push(SymbolScope.FUNCTION);
      this.currentScope = SymbolScope.FUNCTION;

      // Process parameters and body
      this.processFunctionBody(node);

      // Exit function scope
      this.scopeStack.pop();
      this.currentScope = this.scopeStack[this.scopeStack.length - 1];
    }
  }

  private handleClass(node: Parser.SyntaxNode): void {
    const className = this.extractClassName(node);
    if (className) {
      const symbol: Symbol = {
        name: className,
        type: SymbolType.CLASS,
        scope: this.currentScope,
        definition: this.createLocation(node),
        isMutable: false,
        references: [],
      };

      this.symbolTable.classes.set(className, symbol);
      this.symbolTable.symbols.set(className, symbol);

      // Enter class scope
      this.scopeStack.push(SymbolScope.CLASS);
      this.currentScope = SymbolScope.CLASS;

      // Process class body
      this.processClassBody(node);

      // Exit class scope
      this.scopeStack.pop();
      this.currentScope = this.scopeStack[this.scopeStack.length - 1];
    }
  }

  private processVariableDeclarator(node: Parser.SyntaxNode): void {
    const identifier =
      node.childForFieldName('name') || node.children.find(child => child.type === 'identifier');

    if (identifier) {
      const variableName = this.getNodeText(identifier);
      const symbol: Symbol = {
        name: variableName,
        type: SymbolType.VARIABLE,
        scope: this.currentScope,
        definition: this.createLocation(identifier),
        isMutable: !this.isConstDeclaration(node.parent || undefined),
        initialValue: this.extractInitialValue(node),
        references: [],
      };

      const scopedName = `${this.currentScope}.${variableName}`;
      this.symbolTable.symbols.set(scopedName, symbol);
    }
  }

  private isConstDeclaration(parent: Parser.SyntaxNode | undefined): boolean {
    return (
      parent?.type === 'lexical_declaration' &&
      parent?.children.some(child => child.type === 'const')
    );
  }

  private extractFunctionName(node: Parser.SyntaxNode): string | null {
    const nameNode =
      node.childForFieldName('name') || node.children.find(child => child.type === 'identifier');
    return nameNode ? this.getNodeText(nameNode) : null;
  }

  private extractClassName(node: Parser.SyntaxNode): string | null {
    const nameNode =
      node.childForFieldName('name') || node.children.find(child => child.type === 'identifier');
    return nameNode ? this.getNodeText(nameNode) : null;
  }

  private getNodeText(node: Parser.SyntaxNode): string {
    return node.text || '';
  }

  private handleParameter(node: Parser.SyntaxNode): void {
    const paramName = this.getNodeText(node);
    const symbol: Symbol = {
      name: paramName,
      type: SymbolType.PARAMETER,
      scope: this.currentScope,
      definition: this.createLocation(node),
      isMutable: false,
      references: [],
    };

    const scopedName = `${this.currentScope}.${paramName}`;
    this.symbolTable.symbols.set(scopedName, symbol);
  }

  private handleImport(node: Parser.SyntaxNode): void {
    const identifiers = node.children.filter(child => child.type === 'identifier');
    identifiers.forEach(idNode => {
      const importName = this.getNodeText(idNode);
      const symbol: Symbol = {
        name: importName,
        type: SymbolType.IMPORT,
        scope: SymbolScope.MODULE,
        definition: this.createLocation(idNode),
        isMutable: false,
        references: [],
      };
      this.symbolTable.symbols.set(importName, symbol);
    });
  }

  private handleExport(node: Parser.SyntaxNode): void {
    const identifiers = node.children.filter(child => child.type === 'identifier');
    identifiers.forEach(idNode => {
      const exportName = this.getNodeText(idNode);
      const symbol: Symbol = {
        name: exportName,
        type: SymbolType.EXPORT,
        scope: SymbolScope.MODULE,
        definition: this.createLocation(idNode),
        isMutable: false,
        references: [],
      };
      this.symbolTable.symbols.set(exportName, symbol);
    });
  }

  private createLocation(node: Parser.SyntaxNode): SymbolLocation {
    return {
      filePath: this.filePath,
      startLine: node.startPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endLine: node.endPosition.row + 1,
      endColumn: node.endPosition.column + 1,
      nodeType: node.type,
    };
  }

  private processFunctionBody(node: Parser.SyntaxNode): void {
    // Implementation for processing function body
  }

  private processClassBody(node: Parser.SyntaxNode): void {
    // Implementation for processing class body
  }

  private extractInitialValue(node: Parser.SyntaxNode): any {
    const valueNode = node.childForFieldName('value');
    return valueNode ? this.getNodeText(valueNode) : undefined;
  }
}
