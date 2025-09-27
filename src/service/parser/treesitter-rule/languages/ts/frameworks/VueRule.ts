import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * Vue.js Framework Rule - Identifies Vue.js components, patterns, and architecture
 */
export class VueRule extends AbstractSnippetRule {
  readonly name = 'VueRule';
  readonly supportedNodeTypes = new Set([
    // Component definitions
    'export_statement',
    'variable_declaration',
    'function_declaration',
    'class_declaration',
    'object',

    // Template-related
    'jsx_element',
    'jsx_opening_element',
    'jsx_closing_element',
    'jsx_self_closing_element',
    'jsx_text',

    // Script setup
    'import_statement',
    'call_expression',
    'assignment_expression',

    // Vue specific patterns
    'template_literal',
    'property_identifier',
    'method_definition',
  ]);

  protected readonly snippetType = 'vue_component' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check if this is Vue.js-related code
    return this.isVueCode(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const vueMetadata = this.extractVueMetadata(node, content, sourceCode);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractVueImports(node, sourceCode),
      exports: this.extractVueExports(node, sourceCode),
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateVueComplexity(content),
        isStandalone: this.isStandaloneVueComponent(node, content),
        hasSideEffects: this.hasSideEffects(content),
        vueInfo: vueMetadata,
      },
    };
  }

  private isVueCode(content: string): boolean {
    const vuePatterns = [
      // Vue imports
      /import\s+.*\bfrom\s+['"]vue['"]/,
      /import\s+.*\bfrom\s+['"]@vue\/[^'"]+['"]/,
      /import\s+.*\bfrom\s+['"]vue-[^'"]+['"]/,

      // Vue component patterns
      /export\s+default\s+{/,
      /defineComponent\s*\(/,
      /setup\s*\(\)/,
      /<script/,
      /<template/,

      // Vue specific APIs
      /ref\s*\(/,
      /reactive\s*\(/,
      /computed\s*\(/,
      /watch\s*\(/,
      /onMounted\s*\(/,
      /onUnmounted\s*\(/,

      // Vue directives in JSX
      /v-[a-zA-Z-]+/,
      /@click/,
      /@input/,
      /@submit/,

      // Vue Router
      /useRouter\s*\(/,
      /useRoute\s*\(/,
      /router\.push/,

      // Vuex/Pinia
      /useStore\s*\(/,
      /defineStore\s*\(/,
      /createPinia\s*\(/,

      // Vue CLI patterns
      /\.vue$/,
      /Vue\.createApp/,
      /createSSRApp/,
      /createApp/,
    ];

    return vuePatterns.some(pattern => pattern.test(content));
  }

  private extractVueMetadata(node: Parser.SyntaxNode, content: string, sourceCode: string) {
    return {
      componentType: this.determineComponentType(content),
      setupFunction: this.extractSetupFunctionInfo(content),
      template: this.extractTemplateInfo(content),
      stateManagement: this.extractStateManagementInfo(content),
      composition: this.extractCompositionInfo(content),
      routing: this.extractRoutingInfo(content),
    };
  }

  private determineComponentType(
    content: string
  ): 'options_api' | 'composition_api' | 'vue2' | 'vue3' {
    if (content.includes('setup()') || content.includes('setup ()')) {
      return content.includes('ref(') || content.includes('reactive(') ? 'vue3' : 'vue2';
    }

    if (
      content.includes('<script setup>') ||
      content.includes('setup>') ||
      content.includes('defineComponent')
    ) {
      return 'composition_api';
    }

    if (
      content.includes('data()') ||
      content.includes('methods:') ||
      content.includes('computed:')
    ) {
      return 'options_api';
    }

    // Default to composition API for modern Vue
    return 'composition_api';
  }

  private extractSetupFunctionInfo(content: string) {
    const usesSetup =
      content.includes('setup(') ||
      content.includes('setup>') ||
      content.includes('defineComponent');

    const reactiveDeclarations = this.extractPatternMatches(content, [
      /ref\s*\(\s*([^)]+)\)/g,
      /reactive\s*\(\s*([^)]+)\)/g,
    ]);

    const computedProperties = this.extractPatternMatches(content, [
      /computed\s*\(\s*\(\)\s*=>\s*{([^}]+)}\s*\)/g,
      /computed\s*\(\s*{([^}]+)}\s*\)/g,
    ]);

    const lifecycleHooks = {
      created: (content.match(/onCreated\s*\(/g) || []).length,
      mounted: (content.match(/onMounted\s*\(/g) || []).length,
      updated: (content.match(/onUpdated\s*\(/g) || []).length,
      unmounted: (content.match(/onUnmounted\s*\(/g) || []).length,
    };

    return {
      usesSetup,
      reactiveDeclarations,
      computedProperties,
      lifecycleHooks,
    };
  }

  private extractTemplateInfo(content: string) {
    const directives = this.extractPatternMatches(content, [
      /v-([a-zA-Z-]+)/g,
      /:([a-zA-Z-]+)=/g,
      /@([a-zA-Z-]+)=/g,
    ]);

    const componentUsage = this.extractPatternMatches(content, [
      /<([A-Z][a-zA-Z0-9]*)/g,
      /<([a-z][a-zA-Z0-9]*-[a-zA-Z0-9]*)/g,
    ]);

    const eventHandling = /@click|@input|@submit|@change/.test(content);
    const conditionalRendering = /v-if|v-else|v-show/.test(content);
    const listRendering = /v-for/.test(content);

    return {
      directives,
      componentUsage,
      eventHandling,
      conditionalRendering,
      listRendering,
    };
  }

  private extractStateManagementInfo(content: string) {
    const dataProperties = this.extractPatternMatches(content, [
      /data\s*\(\)\s*{\s*return\s*{([^}]+)}/g,
      /const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*ref\s*\(/g,
    ]);

    const methods = this.extractPatternMatches(content, [
      /methods:\s*{([^}]+)}/g,
      /const\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\([^)]*\)\s*=>/g,
    ]);

    const watchers = this.extractPatternMatches(content, [
      /watch\s*\(\s*([^,]+),\s*\([^)]*\)\s*=>/g,
      /watch:\s*{([^}]+)}/g,
    ]);

    const usesVuex = /useStore|store\./.test(content);
    const usesPinia = /defineStore|pinia/.test(content);

    return {
      dataProperties,
      methods,
      watchers,
      usesVuex,
      usesPinia,
    };
  }

  private extractCompositionInfo(content: string) {
    const refs = this.extractPatternMatches(content, [
      /ref\s*\(\s*([^)]+)\)/g,
      /shallowRef\s*\(\s*([^)]+)\)/g,
    ]);

    const reactives = this.extractPatternMatches(content, [/reactive\s*\(\s*([^)]+)\)/g]);

    const composables = this.extractPatternMatches(content, [/use[A-Z][a-zA-Z0-9]*/g]);

    const injectProvide = /inject\s*\(|provide\s*\(/.test(content);

    return {
      refs,
      reactives,
      composables,
      injectProvide,
    };
  }

  private extractRoutingInfo(content: string) {
    const usesVueRouter = /useRouter|useRoute|router\./.test(content);

    const routeParams = this.extractPatternMatches(content, [
      /route\.params\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
      /\$route\.params\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
    ]);

    const navigationMethods = this.extractPatternMatches(content, [
      /router\.([a-zA-Z]+)/g,
      /\$router\.([a-zA-Z]+)/g,
    ]);

    return {
      usesVueRouter,
      routeParams,
      navigationMethods,
    };
  }

  private extractPatternMatches(content: string, patterns: RegExp[]): string[] {
    const matches: string[] = [];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          matches.push(match[1]);
        }
      }
    });

    return [...new Set(matches)]; // Remove duplicates
  }

  private extractVueImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement') {
        const importText = this.getNodeText(n, sourceCode);
        if (
          importText.includes('vue') ||
          importText.includes('@vue') ||
          importText.includes('vue-router') ||
          importText.includes('vuex') ||
          importText.includes('pinia')
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

  private extractVueExports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const exports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'export_statement') {
        const exportText = this.getNodeText(n, sourceCode);
        if (
          exportText.includes('default') ||
          exportText.includes('defineComponent') ||
          exportText.includes('export {')
        ) {
          exports.push(exportText);
        }
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

  private isStandaloneVueComponent(node: Parser.SyntaxNode, content: string): boolean {
    const componentPatterns = [
      /export\s+default\s+{/,
      /defineComponent\s*\(/,
      /<script\s+(setup|lang)/,
    ];

    return (
      (node.type === 'export_statement' ||
        node.type === 'variable_declaration' ||
        node.type === 'object') &&
      componentPatterns.some(pattern => pattern.test(content))
    );
  }

  private calculateVueComplexity(content: string): number {
    let complexity = 0;

    // Base component complexity
    complexity += content.includes('export default') ? 3 : 0;
    complexity += content.includes('defineComponent') ? 3 : 0;

    // Setup function complexity
    complexity += content.includes('setup(') ? 2 : 0;
    complexity += content.includes('<script setup>') ? 2 : 0;

    // Reactivity complexity
    complexity += (content.match(/ref\s*\(/g) || []).length * 2;
    complexity += (content.match(/reactive\s*\(/g) || []).length * 2;
    complexity += (content.match(/computed\s*\(/g) || []).length * 3;
    complexity += (content.match(/watch\s*\(/g) || []).length * 2;

    // Lifecycle complexity
    complexity += (content.match(/onMounted\s*\(/g) || []).length * 2;
    complexity += (content.match(/onUnmounted\s*\(/g) || []).length * 2;
    complexity += (content.match(/onUpdated\s*\(/g) || []).length * 2;

    // Template complexity
    complexity += (content.match(/v-if/g) || []).length * 2;
    complexity += (content.match(/v-for/g) || []).length * 3;
    complexity += (content.match(/v-model/g) || []).length * 2;
    complexity += (content.match(/@[a-zA-Z-]+/g) || []).length;

    // Component communication
    complexity += (content.match(/emit\s*\(/g) || []).length * 2;
    complexity += (content.match(/props\s*:/g) || []).length * 2;
    complexity += (content.match(/defineProps\s*\(/g) || []).length * 2;
    complexity += (content.match(/defineEmits\s*\(/g) || []).length * 2;

    // State management complexity
    complexity += (content.match(/useStore\s*\(/g) || []).length * 2;
    complexity += (content.match(/defineStore\s*\(/g) || []).length * 3;

    // Routing complexity
    complexity += (content.match(/useRouter\s*\(/g) || []).length * 2;
    complexity += (content.match(/useRoute\s*\(/g) || []).length * 2;

    return Math.max(1, complexity);
  }
}
