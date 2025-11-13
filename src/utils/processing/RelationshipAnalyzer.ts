import { NestingRelationship, CodeReference, CodeDependency } from '../types/ContentTypes';

/**
 * 关系分析器
 * 负责分析代码结构之间的各种关系
 */
export class RelationshipAnalyzer {
  
  /**
   * 分析嵌套关系
   * 基于AST节点分析代码结构之间的嵌套关系
   */
  static analyzeNestingRelationships(nodes: any[]): NestingRelationship[] {
    const relationships: NestingRelationship[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];

        // 检查包含关系
        if (this.isNodeContaining(node1, node2)) {
          relationships.push({
            parent: node1,
            child: node2,
            relationshipType: 'contains',
            strength: this.calculateRelationshipStrength(node1, node2)
          });
        }

        // 检查继承关系
        if (this.isInheritanceRelationship(node1, node2)) {
          relationships.push({
            parent: node2,
            child: node1,
            relationshipType: 'extends',
            strength: 0.9
          });
        }

        // 检查实现关系
        if (this.isImplementationRelationship(node1, node2)) {
          relationships.push({
            parent: node2,
            child: node1,
            relationshipType: 'implements',
            strength: 0.85
          });
        }
      }
    }

    return relationships;
  }

  /**
   * 分析代码引用关系
   * 基于AST分析函数调用、变量引用等关系
   */
  static analyzeCodeReferences(nodes: any[], content: string): CodeReference[] {
    const references: CodeReference[] = [];

    for (const node of nodes) {
      if (!node.node) continue;

      // 分析函数调用
      const functionCalls = this.extractFunctionCalls(node.node);
      for (const call of functionCalls) {
        references.push({
          fromNode: node,
          toNode: this.findReferencedNode(call.name, nodes),
          referenceType: 'function_call',
          line: call.line,
          confidence: 0.8
        });
      }

      // 分析变量引用
      const variableRefs = this.extractVariableReferences(node.node);
      for (const ref of variableRefs) {
        references.push({
          fromNode: node,
          toNode: this.findReferencedNode(ref.name, nodes),
          referenceType: 'variable_reference',
          line: ref.line,
          confidence: 0.7
        });
      }

      // 分析类型引用
      const typeRefs = this.extractTypeReferences(node.node);
      for (const ref of typeRefs) {
        references.push({
          fromNode: node,
          toNode: this.findReferencedNode(ref.name, nodes),
          referenceType: 'type_reference',
          line: ref.line,
          confidence: 0.9
        });
      }
    }

    return references;
  }

  /**
   * 分析代码依赖关系
   * 分析模块导入、包依赖等关系
   */
  static analyzeCodeDependencies(nodes: any[], content: string): CodeDependency[] {
    const dependencies: CodeDependency[] = [];

    // 分析导入语句
    const imports = this.extractImportStatements(content);
    for (const importStmt of imports) {
      dependencies.push({
        fromNode: this.findNodeContainingImport(nodes, importStmt.line),
        dependencyType: 'import',
        target: importStmt.module,
        line: importStmt.line,
        confidence: 0.95
      });
    }

    // 分析继承依赖
    for (const node of nodes) {
      if (!node.node) continue;

      const inheritance = this.extractInheritanceDependencies(node.node);
      for (const dep of inheritance) {
        dependencies.push({
          fromNode: node,
          dependencyType: 'inheritance',
          target: dep.parent,
          line: dep.line,
          confidence: 0.9
        });
      }
    }

    // 分析接口实现依赖
    for (const node of nodes) {
      if (!node.node) continue;

      const implementations = this.extractImplementationDependencies(node.node);
      for (const impl of implementations) {
        dependencies.push({
          fromNode: node,
          dependencyType: 'implementation',
          target: impl.interface,
          line: impl.line,
          confidence: 0.85
        });
      }
    }

    return dependencies;
  }

  /**
   * 检查节点是否包含另一个节点
   */
  private static isNodeContaining(node1: any, node2: any): boolean {
    if (!node1.node || !node2.node) return false;

    const n1 = node1.node;
    const n2 = node2.node;

    // 检查位置包含关系
    const n1Start = n1.startPosition;
    const n1End = n1.endPosition;
    const n2Start = n2.startPosition;
    const n2End = n2.endPosition;

    return (
      n1Start.row <= n2Start.row &&
      n1End.row >= n2End.row &&
      (n1Start.row < n2Start.row || n1Start.column <= n2Start.column) &&
      (n1End.row > n2End.row || n1End.column >= n2End.column)
    );
  }

  /**
   * 检查继承关系
   */
  private static isInheritanceRelationship(node1: any, node2: any): boolean {
    if (!node1.node || !node2.node) return false;

    const n1 = node1.node;
    const n2 = node2.node;

    // 检查类继承
    if (n1.type === 'class_declaration' && n2.type === 'class_declaration') {
      const heritageClause = this.findChildByType(n1, 'heritage_clause');
      if (heritageClause) {
        const extendsClause = this.findChildByType(heritageClause, 'extends_clause');
        if (extendsClause) {
          const typeName = this.findChildByType(extendsClause, 'type_identifier');
          if (typeName && typeName.text === this.extractNodeName(n2)) {
            return true;
          }
        }
      }
    }

    // Python继承
    if (n1.type === 'class_definition' && n2.type === 'class_definition') {
      const argumentList = this.findChildByType(n1, 'argument_list');
      if (argumentList) {
        for (let i = 0; i < argumentList.childCount; i++) {
          const child = argumentList.child(i);
          if (child && child.type === 'identifier' && child.text === this.extractNodeName(n2)) {
            return true;
          }
        }
      }
    }

    // Java继承
    if (n1.type === 'class_declaration' && n2.type === 'class_declaration') {
      const superClass = this.findChildByType(n1, 'superclass');
      if (superClass) {
        const typeName = this.findChildByType(superClass, 'type_identifier');
        if (typeName && typeName.text === this.extractNodeName(n2)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 检查实现关系
   */
  private static isImplementationRelationship(node1: any, node2: any): boolean {
    if (!node1.node || !node2.node) return false;

    const n1 = node1.node;
    const n2 = node2.node;

    // TypeScript接口实现
    if (n1.type === 'class_declaration' && n2.type === 'interface_declaration') {
      const heritageClause = this.findChildByType(n1, 'heritage_clause');
      if (heritageClause) {
        const implementsClause = this.findChildByType(heritageClause, 'implements_clause');
        if (implementsClause) {
          const typeName = this.findChildByType(implementsClause, 'type_identifier');
          if (typeName && typeName.text === this.extractNodeName(n2)) {
            return true;
          }
        }
      }
    }

    // Java接口实现
    if (n1.type === 'class_declaration' && n2.type === 'interface_declaration') {
      const interfaces = this.findChildByType(n1, 'interfaces');
      if (interfaces) {
        const typeList = this.findChildByType(interfaces, 'type_list');
        if (typeList) {
          for (let i = 0; i < typeList.childCount; i++) {
            const child = typeList.child(i);
            if (child && child.type === 'type_identifier' && child.text === this.extractNodeName(n2)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * 计算关系强度
   */
  private static calculateRelationshipStrength(node1: any, node2: any): number {
    if (!node1.node || !node2.node) return 0;

    const n1 = node1.node;
    const n2 = node2.node;

    // 基于嵌套深度计算强度
    const depthDiff = Math.abs(
      (n1.startPosition.row - n2.startPosition.row) +
      (n1.startPosition.column - n2.startPosition.column)
    );

    // 距离越近，关系越强
    return Math.max(0.1, 1.0 - (depthDiff / 1000));
  }

  /**
   * 提取函数调用
   */
  private static extractFunctionCalls(node: any): Array<{name: string, line: number}> {
    const calls: Array<{name: string, line: number}> = [];

    const traverse = (n: any) => {
      if (!n) return;

      if (n.type === 'call_expression') {
        const functionNode = this.findChildByType(n, 'identifier');
        if (functionNode) {
          calls.push({
            name: functionNode.text,
            line: n.startPosition.row + 1
          });
        }
      }

      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) {
          traverse(child);
        }
      }
    };

    traverse(node);
    return calls;
  }

  /**
   * 提取变量引用
   */
  private static extractVariableReferences(node: any): Array<{name: string, line: number}> {
    const refs: Array<{name: string, line: number}> = [];

    const traverse = (n: any) => {
      if (!n) return;

      if (n.type === 'identifier') {
        // 检查是否是变量引用（不是声明）
        const parent = n.parent;
        if (parent && !['function_declaration', 'variable_declaration', 'parameter'].includes(parent.type)) {
          refs.push({
            name: n.text,
            line: n.startPosition.row + 1
          });
        }
      }

      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) {
          traverse(child);
        }
      }
    };

    traverse(node);
    return refs;
  }

  /**
   * 提取类型引用
   */
  private static extractTypeReferences(node: any): Array<{name: string, line: number}> {
    const refs: Array<{name: string, line: number}> = [];

    const traverse = (n: any) => {
      if (!n) return;

      if (['type_identifier', 'generic_type', 'type_annotation'].includes(n.type)) {
        const identifier = this.findChildByType(n, 'identifier') || n;
        if (identifier && identifier.text) {
          refs.push({
            name: identifier.text,
            line: n.startPosition.row + 1
          });
        }
      }

      for (let i = 0; i < n.childCount; i++) {
        const child = n.child(i);
        if (child) {
          traverse(child);
        }
      }
    };

    traverse(node);
    return refs;
  }

  /**
   * 提取导入语句
   */
  private static extractImportStatements(content: string): Array<{module: string, line: number}> {
    const imports: Array<{module: string, line: number}> = [];
    const lines = content.split('\n');

    // JavaScript/TypeScript导入
    const jsImportRegex = /^import\s+.*?from\s+['"]([^'"]+)['"]/;
    // Python导入
    const pythonImportRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)/;
    // Java导入
    const javaImportRegex = /^import\s+([\w.]+);/;
    // Go导入
    const goImportRegex = /^import\s+['"]([^'"]+)['"]/;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      let match = line.match(jsImportRegex);
      if (match) {
        imports.push({ module: match[1], line: lineNum });
        return;
      }

      match = line.match(pythonImportRegex);
      if (match) {
        const module = match[1] || match[2].split('.')[0];
        imports.push({ module, line: lineNum });
        return;
      }

      match = line.match(javaImportRegex);
      if (match) {
        imports.push({ module: match[1], line: lineNum });
        return;
      }

      match = line.match(goImportRegex);
      if (match) {
        imports.push({ module: match[1], line: lineNum });
        return;
      }
    });

    return imports;
  }

  /**
   * 提取继承依赖
   */
  private static extractInheritanceDependencies(node: any): Array<{parent: string, line: number}> {
    const dependencies: Array<{parent: string, line: number}> = [];

    if (node.type === 'class_declaration') {
      const heritageClause = this.findChildByType(node, 'heritage_clause');
      if (heritageClause) {
        const extendsClause = this.findChildByType(heritageClause, 'extends_clause');
        if (extendsClause) {
          const typeName = this.findChildByType(extendsClause, 'type_identifier');
          if (typeName) {
            dependencies.push({
              parent: typeName.text,
              line: node.startPosition.row + 1
            });
          }
        }
      }
    }

    if (node.type === 'class_definition') {
      const argumentList = this.findChildByType(node, 'argument_list');
      if (argumentList) {
        for (let i = 0; i < argumentList.childCount; i++) {
          const child = argumentList.child(i);
          if (child && child.type === 'identifier') {
            dependencies.push({
              parent: child.text,
              line: node.startPosition.row + 1
            });
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * 提取实现依赖
   */
  private static extractImplementationDependencies(node: any): Array<{interface: string, line: number}> {
    const dependencies: Array<{interface: string, line: number}> = [];

    if (node.type === 'class_declaration') {
      const heritageClause = this.findChildByType(node, 'heritage_clause');
      if (heritageClause) {
        const implementsClause = this.findChildByType(heritageClause, 'implements_clause');
        if (implementsClause) {
          const typeName = this.findChildByType(implementsClause, 'type_identifier');
          if (typeName) {
            dependencies.push({
              interface: typeName.text,
              line: node.startPosition.row + 1
            });
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * 查找被引用的节点
   */
  private static findReferencedNode(name: string, nodes: any[]): any | null {
    for (const node of nodes) {
      if (node.name === name) {
        return node;
      }
    }
    return null;
  }

  /**
   * 查找包含导入语句的节点
   */
  private static findNodeContainingImport(nodes: any[], line: number): any | null {
    for (const node of nodes) {
      if (node.location && 
          node.location.startLine <= line && 
          node.location.endLine >= line) {
        return node;
      }
    }
    return null;
  }

  /**
   * 从节点提取名称
   */
  private static extractNodeName(node: any): string | null {
    if (!node) return null;

    const identifier = this.findChildByType(node, 'identifier');
    return identifier ? identifier.text : null;
  }

  /**
   * 查找指定类型的子节点
   */
  private static findChildByType(node: any, type: string): any | null {
    if (!node) return null;

    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child && child.type === type) {
        return child;
      }
    }

    return null;
  }

  /**
   * 分析调用图
   * 构建函数调用关系图
   */
  static analyzeCallGraph(nodes: any[]): Map<string, string[]> {
    const callGraph = new Map<string, string[]>();

    for (const node of nodes) {
      if (node.type === 'function' || node.type === 'method') {
        const calls = this.extractFunctionCalls(node.node);
        const calledFunctions = calls.map(call => call.name);
        callGraph.set(node.name, calledFunctions);
      }
    }

    return callGraph;
  }

  /**
   * 分析继承层次
   * 构建类继承关系图
   */
  static analyzeInheritanceHierarchy(nodes: any[]): Map<string, string[]> {
    const hierarchy = new Map<string, string[]>();

    for (const node of nodes) {
      if (node.type === 'class') {
        const dependencies = this.extractInheritanceDependencies(node.node);
        const parents = dependencies.map(dep => dep.parent);
        hierarchy.set(node.name, parents);
      }
    }

    return hierarchy;
  }

  /**
   * 分析模块依赖图
   * 构建模块依赖关系
   */
  static analyzeModuleDependencies(nodes: any[], content: string): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();
    const imports = this.extractImportStatements(content);

    // 按文件/模块分组导入
    const moduleImports = new Map<string, string[]>();
    
    for (const importStmt of imports) {
      const containingNode = this.findNodeContainingImport(nodes, importStmt.line);
      if (containingNode) {
        const moduleName = containingNode.name || 'root';
        if (!moduleImports.has(moduleName)) {
          moduleImports.set(moduleName, []);
        }
        moduleImports.get(moduleName)!.push(importStmt.module);
      }
    }

    return moduleImports;
  }
}