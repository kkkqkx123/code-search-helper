import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * React Framework Rule - Identifies React components, hooks, and patterns
 */
export class ReactRule extends AbstractSnippetRule {
  readonly name = 'ReactRule';
  readonly supportedNodeTypes = new Set([
    // Component definitions
    'function_declaration',
    'arrow_function',
    'class_declaration',

    // JSX elements
    'jsx_element',
    'jsx_self_closing_element',
    'jsx_fragment',

    // Hook calls
    'call_expression',
    'identifier',

    // React-specific patterns
    'import_statement',
    'export_statement',
  ]);

  protected readonly snippetType = 'react_component' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check if this is React-related code
    return this.isReactCode(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const reactMetadata = this.extractReactMetadata(node, content, sourceCode);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractReactImports(node, sourceCode),
      exports: this.extractReactExports(node, sourceCode),
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateReactComplexity(content),
        isStandalone: this.isStandaloneComponent(node, content),
        hasSideEffects: this.hasSideEffects(content),
        reactInfo: reactMetadata,
      },
    };
  }

  private isReactCode(content: string): boolean {
    const reactPatterns = [
      // React imports
      /import\s+.*\bReact\b/,
      /import\s+.*\buseState\b/,
      /import\s+.*\buseEffect\b/,
      /import\s+.*\buseContext\b/,
      /import\s+.*\buseReducer\b/,
      /import\s+.*\buseCallback\b/,
      /import\s+.*\buseMemo\b/,

      // JSX patterns
      /<[A-Z][a-zA-Z0-9]*.*>/,
      /<\/[A-Z][a-zA-Z0-9]*>/,
      /<[a-z][a-zA-Z0-9]*.*>/,

      // Hook patterns
      /useState\s*\(/,
      /useEffect\s*\(/,
      /useContext\s*\(/,
      /useReducer\s*\(/,
      /useCallback\s*\(/,
      /useMemo\s*\(/,

      // Component patterns
      /function\s+[A-Z][a-zA-Z0-9]*\s*\([^)]*\)\s*{.*return\s*<[^>]+>/,
      /const\s+[A-Z][a-zA-Z0-9]*\s*=\s*\([^)]*\)\s*=>\s*{.*return\s*<[^>]+>/,
      /class\s+[A-Z][a-zA-Z0-9]*\s+extends\s+(React\.)?Component/,
    ];

    return reactPatterns.some(pattern => pattern.test(content));
  }

  private extractReactMetadata(node: Parser.SyntaxNode, content: string, sourceCode: string) {
    const componentType = this.determineComponentType(node, content);
    const hooks = this.extractHooks(content);
    const jsxComplexity = this.analyzeJSXComplexity(content);
    const props = this.extractPropsInfo(content);
    const state = this.extractStateInfo(content);
    const lifecycle = this.extractLifecycleInfo(content);
    const performance = this.extractPerformanceInfo(content);

    return {
      componentType,
      hooks,
      jsxComplexity,
      props,
      state,
      lifecycle,
      performance,
    };
  }

  private determineComponentType(node: Parser.SyntaxNode, content: string): 'functional' | 'class' {
    if (node.type === 'class_declaration' && content.includes('extends')) {
      if (content.includes('React.Component') || content.includes('Component')) {
        return 'class';
      }
    }

    if (node.type === 'function_declaration' || node.type === 'arrow_function') {
      if (content.includes('return') && (content.includes('<') || content.includes('JSX'))) {
        return 'functional';
      }
    }

    // Default to functional if it has hooks or JSX
    if (content.includes('useState') || content.includes('useEffect') || content.includes('<')) {
      return 'functional';
    }

    return 'functional'; // Default assumption
  }

  private extractHooks(content: string) {
    const hooks = {
      useState: (content.match(/useState\s*\(/g) || []).length,
      useEffect: (content.match(/useEffect\s*\(/g) || []).length,
      useContext: (content.match(/useContext\s*\(/g) || []).length,
      useReducer: (content.match(/useReducer\s*\(/g) || []).length,
      useCallback: (content.match(/useCallback\s*\(/g) || []).length,
      useMemo: (content.match(/useMemo\s*\(/g) || []).length,
      customHooks: this.extractCustomHooks(content),
    };

    return hooks;
  }

  private extractCustomHooks(content: string): string[] {
    const customHookPattern = /use[A-Z][a-zA-Z0-9]*\s*\(/g;
    const matches = content.match(customHookPattern) || [];
    return matches.map(match => match.replace(/\s*\(/, ''));
  }

  private analyzeJSXComplexity(content: string) {
    const jsxElements = (content.match(/<[a-zA-Z][^>]*>/g) || []).length;
    const selfClosingElements = (content.match(/<[a-zA-Z][^>]*\/>/g) || []).length;
    const conditionalRendering =
      content.includes('&&') || content.includes('?:') || content.includes('{');
    const listRendering = content.includes('.map(');

    // Calculate nested depth
    const nestedDepth = this.calculateJSXNesting(content);

    return {
      elementCount: jsxElements + selfClosingElements,
      nestedDepth,
      conditionalRendering,
      listRendering,
    };
  }

  private calculateJSXNesting(content: string): number {
    let maxDepth = 0;
    let currentDepth = 0;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === '<' && content[i + 1] !== '/') {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      } else if (char === '<' && content[i + 1] === '/') {
        currentDepth--;
      }
    }

    return maxDepth;
  }

  private extractPropsInfo(content: string) {
    const destructuredProps = (content.match(/\{\s*[a-zA-Z_][a-zA-Z0-9_]*\s*[,}]/g) || [])
      .map(match => match.replace(/[{}]/g, '').trim().replace(',', ''))
      .filter(prop => prop.length > 0);

    const defaultPropsPattern = /defaultProps\s*=\s*{([^}]+)}/;
    const defaultPropsMatch = content.match(defaultPropsPattern);
    const defaultValues: Record<string, any> = {};

    if (defaultPropsMatch) {
      try {
        // Simple parsing for default values
        const propsString = defaultPropsMatch[1];
        const props = propsString.split(',');
        props.forEach(prop => {
          const [key, value] = prop.split(':').map(p => p.trim());
          if (key && value) {
            defaultValues[key] = value;
          }
        });
      } catch (error) {
        // Ignore parsing errors
      }
    }

    const validation =
      content.includes('PropTypes') || content.includes('interface') || content.includes('type');

    return {
      destructured: destructuredProps,
      defaultValues,
      validation,
    };
  }

  private extractStateInfo(content: string) {
    const useStatePattern = /useState\s*\(\s*([^)]*)\s*\)/g;
    const stateVariables: string[] = [];
    const stateUpdaters: string[] = [];

    let match;
    while ((match = useStatePattern.exec(content)) !== null) {
      const stateInit = match[1];
      // Extract variable name from destructuring
      const destructuringPattern = /const\s*\[([^\]]+)\]/;
      const destructuringMatch = content.slice(match.index).match(destructuringPattern);
      if (destructuringMatch) {
        const vars = destructuringMatch[1].split(',').map(v => v.trim());
        if (vars.length >= 1) stateVariables.push(vars[0]);
        if (vars.length >= 2) stateUpdaters.push(vars[1]);
      }
    }

    // Check for complex state (objects, arrays, nested state)
    const complexState =
      content.includes('useState({') ||
      content.includes('useState([') ||
      stateVariables.some(
        variable =>
          content.includes(`${variable}.`) ||
          content.includes(`set${variable.charAt(0).toUpperCase() + variable.slice(1)}(`)
      );

    return {
      stateVariables,
      stateUpdaters,
      complexState,
    };
  }

  private extractLifecycleInfo(content: string) {
    const useEffectPattern = /useEffect\s*\(\s*\([^)]*\)\s*=>\s*{[^}]*}\s*,\s*\[([^]]*)\]\s*\)/g;
    const useEffectDeps: string[][] = [];
    let cleanupFunctions = 0;

    let match;
    while ((match = useEffectPattern.exec(content)) !== null) {
      const deps = match[1]
        .split(',')
        .map(dep => dep.trim())
        .filter(dep => dep.length > 0);
      useEffectDeps.push(deps);

      // Check for cleanup functions
      const effectBody = content.slice(match.index, match.index + match[0].length);
      if (effectBody.includes('return') && effectBody.includes('()')) {
        cleanupFunctions++;
      }
    }

    return {
      useEffectDeps,
      cleanupFunctions,
    };
  }

  private extractPerformanceInfo(content: string) {
    const memoizedComponents = content.includes('React.memo') || content.includes('memo(');
    const memoizedCallbacks = content.includes('useCallback') || content.includes('useMemo');
    const lazyComponents = content.includes('React.lazy') || content.includes('lazy(');

    return {
      memoizedComponents,
      memoizedCallbacks,
      lazyComponents,
    };
  }

  private extractReactImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement') {
        const importText = this.getNodeText(n, sourceCode);
        if (
          importText.includes('react') ||
          importText.includes('useState') ||
          importText.includes('useEffect') ||
          importText.includes('useContext') ||
          importText.includes('useReducer') ||
          importText.includes('useCallback') ||
          importText.includes('useMemo')
        ) {
          imports.push(importText);
        }
      }

      if (n.children) {
        n.children.forEach(traverse);
      }
    };

    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return imports;
  }

  private extractReactExports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const exports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'export_statement' || n.type === 'export_named_declaration') {
        const exportText = this.getNodeText(n, sourceCode);
        if (exportText.includes('default') || /[A-Z]/.test(exportText)) {
          exports.push(exportText);
        }
      }

      if (n.children) {
        n.children.forEach(traverse);
      }
    };

    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return exports;
  }

  private isStandaloneComponent(node: Parser.SyntaxNode, content: string): boolean {
    const componentTypes = ['function_declaration', 'arrow_function', 'class_declaration'];
    return (
      componentTypes.includes(node.type) &&
      (content.includes('return') || content.includes('render')) &&
      (content.includes('<') || content.includes('JSX'))
    );
  }

  private calculateReactComplexity(content: string): number {
    let complexity = 0;

    // Base component complexity
    complexity += content.match(/function\s+[A-Z]/g)?.length || 0;
    complexity += content.match(/class\s+[A-Z]/g)?.length || 0;

    // Hook complexity
    complexity += (content.match(/useState\s*\(/g) || []).length * 2;
    complexity += (content.match(/useEffect\s*\(/g) || []).length * 3;
    complexity += (content.match(/useContext\s*\(/g) || []).length * 2;
    complexity += (content.match(/useCallback\s*\(/g) || []).length * 2;
    complexity += (content.match(/useMemo\s*\(/g) || []).length * 2;

    // JSX complexity
    complexity += (content.match(/<[^>]+>/g) || []).length;
    complexity += (content.match(/\{[^}]*\}/g) || []).length * 0.5;

    // Nested components
    const nestedDepth = this.calculateJSXNesting(content);
    complexity += nestedDepth * 2;

    // Conditional rendering
    if (content.includes('&&') || content.includes('?:') || content.includes('if')) {
      complexity += 2;
    }

    // List rendering
    if (content.includes('.map')) {
      complexity += 2;
    }

    return complexity;
  }
}
